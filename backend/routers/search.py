import math
import httpx
from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from schemas import NearbyLocation

router = APIRouter(prefix="/search", tags=["Busca por Localização"])

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# O servidor público principal do Overpass vive sobrecarregado (504) e recusa
# clientes mal identificados (406). Tenta espelhos em ordem, com prazo curto
# em cada um, e guarda o resultado por 12h (clínicas não mudam de lugar).
OVERPASS_MIRRORS = [
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]  # poucos e rápidos: se falharem, o app consulta o mapa direto do aparelho
OVERPASS_HEADERS = {
    "User-Agent": "PetLife/1.2 (+https://petlife-frontend-production.up.railway.app; glauterw@gmail.com)",
    "Accept": "application/json",
}
_NEARBY_CACHE: dict = {}
_NEARBY_TTL = 12 * 3600
NOMINATIM_URL = "https://nominatim.openstreetmap.org"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _build_overpass_query(lat: float, lon: float, radius_m: int, place_type: str) -> str:
    if place_type == "vet":
        amenity_filter = '["amenity"="veterinary"]'
    else:
        amenity_filter = '["shop"="pet"]'

    query = f"""
    [out:json][timeout:25];
    (
      node{amenity_filter}(around:{radius_m},{lat},{lon});
      way{amenity_filter}(around:{radius_m},{lat},{lon});
      relation{amenity_filter}(around:{radius_m},{lat},{lon});
    );
    out center tags;
    """
    return query


def _parse_overpass_elements(elements: list, user_lat: float, user_lon: float, place_type: str) -> List[NearbyLocation]:
    locations = []
    for el in elements:
        tags = el.get("tags", {})

        if el.get("type") == "node":
            lat = el.get("lat")
            lon = el.get("lon")
        elif "center" in el:
            lat = el["center"]["lat"]
            lon = el["center"]["lon"]
        else:
            continue

        if lat is None or lon is None:
            continue

        name = tags.get("name") or tags.get("operator") or "Sem nome"
        address_parts = []
        if tags.get("addr:street"):
            address_parts.append(tags["addr:street"])
            if tags.get("addr:housenumber"):
                address_parts.append(tags["addr:housenumber"])
        if tags.get("addr:city"):
            address_parts.append(tags["addr:city"])

        address = ", ".join(address_parts) if address_parts else tags.get("addr:full", None)
        phone = tags.get("phone") or tags.get("contact:phone") or None
        opening_hours = tags.get("opening_hours") or None

        distance = _haversine_km(user_lat, user_lon, lat, lon)

        services = []
        if place_type == "vet":
            if tags.get("emergency") == "yes":
                services.append("Emergência 24h")
            if tags.get("healthcare:specialisation"):
                services.append(tags["healthcare:specialisation"])
            services.append("Consultas")
        else:
            if tags.get("dog") == "yes" or tags.get("animal"):
                services.append("Pets em geral")
            services.append("Produtos para pets")

        locations.append(
            NearbyLocation(
                id=str(el.get("id", "")),
                name=name,
                address=address,
                phone=phone,
                latitude=lat,
                longitude=lon,
                distance_km=round(distance, 2),
                type=place_type,
                services=services if services else None,
                rating=None,
                opening_hours=opening_hours,
            )
        )

    locations.sort(key=lambda x: x.distance_km or 999)
    return locations


PHOTON_URL = "https://photon.komoot.io/api/"
# O Photon busca por texto: várias palavras comuns cobrem quase todos os nomes
# de clínica e pet shop dentro do quadrado ao redor do tutor.
PHOTON_TERMS = {
    "vet": ("amenity:veterinary", ["veterinaria", "veterinario", "vet", "clinica", "hospital", "pet", "animal"]),
    "petshop": ("shop:pet", ["pet", "shop", "racao", "animal", "agro", "casa"]),
}


async def _nearby_from_photon(lat: float, lon: float, radius_m: int, place_type: str) -> tuple:
    import asyncio
    tag, terms = PHOTON_TERMS[place_type]
    lat, lon = round(lat, 3), round(lon, 3)  # ~100 m: basta para achar clínicas
    dlat = radius_m / 111_000
    dlon = radius_m / (111_000 * max(math.cos(math.radians(lat)), 0.01))
    bbox = f"{lon - dlon},{lat - dlat},{lon + dlon},{lat + dlat}"

    async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=4.0), headers=OVERPASS_HEADERS) as client:
        sem = asyncio.Semaphore(3)  # o Photon pede uso moderado

        async def one(q: str):
            async with sem:
                return await _one(q)

        async def _one(q: str):
            try:
                r = await client.get(PHOTON_URL, params={"q": q, "bbox": bbox, "osm_tag": tag, "limit": 50})
                return r.json().get("features", []) if r.status_code == 200 else None
            except (httpx.HTTPError, ValueError):
                return None
        batches = await asyncio.gather(*(one(q) for q in terms))

    if all(b is None for b in batches):
        return None, False
    elements, seen = [], set()
    for feats in batches:
        for f in feats or []:
            p = f.get("properties", {})
            key = (p.get("osm_type"), p.get("osm_id"))
            coords = (f.get("geometry") or {}).get("coordinates") or []
            if key in seen or len(coords) != 2:
                continue
            seen.add(key)
            tags = {"name": p.get("name")}
            if p.get("street"):
                tags["addr:street"] = p["street"]
            if p.get("housenumber"):
                tags["addr:housenumber"] = p["housenumber"]
            if p.get("city"):
                tags["addr:city"] = p["city"]
            elements.append({"type": "node", "id": p.get("osm_id"), "lat": coords[1], "lon": coords[0], "tags": tags})
    radius_km = radius_m / 1000
    found = [l for l in _parse_overpass_elements(elements, lat, lon, place_type) if (l.distance_km or 0) <= radius_km][:30]
    return found, all(b is not None for b in batches)


@router.get("/nearby", response_model=List[NearbyLocation])
async def search_nearby(
    lat: float = Query(..., description="Latitude do usuário"),
    lon: float = Query(..., description="Longitude do usuário"),
    type: str = Query("vet", description="Tipo: 'vet' ou 'petshop'"),
    radius: float = Query(5.0, description="Raio de busca em km"),
):
    if type not in ("vet", "petshop"):
        raise HTTPException(status_code=400, detail="Tipo deve ser 'vet' ou 'petshop'")

    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Coordenadas inválidas")

    radius_m = int(min(radius, 50) * 1000)

    query = _build_overpass_query(lat, lon, radius_m, type)

    import time as _time
    key = (round(lat, 2), round(lon, 2), radius_m, type)
    hit = _NEARBY_CACHE.get(key)
    if hit and _time.time() - hit[0] < _NEARBY_TTL:
        return hit[1]

    async def _overpass():
        async with httpx.AsyncClient(timeout=httpx.Timeout(4.0, connect=3.0)) as client:
            for url in OVERPASS_MIRRORS:
                try:
                    response = await client.post(url, data={"data": query}, headers=OVERPASS_HEADERS)
                    if response.status_code == 200:
                        return response.json()
                except (httpx.HTTPError, ValueError):
                    continue
        return None

    import asyncio
    # Prazo total curto: se o Overpass enrolar, o Photon responde em ~2s.
    try:
        data = await asyncio.wait_for(_overpass(), timeout=5.0)
    except asyncio.TimeoutError:
        data = None
    if data is not None:
        locations = _parse_overpass_elements(data.get("elements", []), lat, lon, type)[:30]
    else:
        # Overpass fora do ar (acontece com frequência): usa o Photon, outro
        # índice do mesmo mapa aberto, que responde de forma mais estável.
        locations, complete = await _nearby_from_photon(lat, lon, radius_m, type)
        if locations is None:
            raise HTTPException(
                status_code=503,
                detail="O serviço de mapas está fora do ar agora. Tente de novo em alguns minutos.",
            )
    # Resultado do Photon (plano B) vale só 30 min, para o Overpass voltar a
    # mandar quando se recuperar; lista parcial ou vazia não é guardada.
    if data is not None:
        _NEARBY_CACHE[key] = (_time.time(), locations)
    elif complete and locations:
        _NEARBY_CACHE[key] = (_time.time() - _NEARBY_TTL + 1800, locations)
    if len(_NEARBY_CACHE) > 2000:
        _NEARBY_CACHE.clear()
    return locations


@router.get("/geocode")
async def geocode_address(address: str = Query(..., description="Endereço para geocodificar")):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{NOMINATIM_URL}/search",
                params={"q": address, "format": "json", "limit": 1, "countrycodes": "br"},
                headers={"User-Agent": "PetLife/1.0"},
            )
            response.raise_for_status()
            results = response.json()

        if not results:
            raise HTTPException(status_code=404, detail="Endereço não encontrado")

        first = results[0]
        return {
            "latitude": float(first["lat"]),
            "longitude": float(first["lon"]),
            "display_name": first["display_name"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao geocodificar: {str(e)}")
