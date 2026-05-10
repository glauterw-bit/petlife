import math
import httpx
from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from schemas import NearbyLocation

router = APIRouter(prefix="/search", tags=["Busca por Localização"])

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
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

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": "PetLife/1.0"},
            )
            response.raise_for_status()
            data = response.json()

        elements = data.get("elements", [])
        locations = _parse_overpass_elements(elements, lat, lon, type)
        return locations[:30]

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout ao buscar locais. Tente novamente.")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar mapa: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


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
