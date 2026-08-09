'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'

export interface UserPoint {
  id: number
  name: string
  lat: number
  lng: number
  source: string | null
  state: string | null
}

function InvalidateOnMount() {
  const map = useMap()
  useEffect(() => {
    const fix = () => map.invalidateSize()
    const t1 = setTimeout(fix, 0)
    const t2 = setTimeout(fix, 200)
    const t3 = setTimeout(fix, 500)
    window.addEventListener('resize', fix)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); window.removeEventListener('resize', fix) }
  }, [map])
  return null
}

/** Mapa dos usuários (admin): verde = GPS de passeio; azul = estado pelo DDD. */
export default function AdminUserMap({ points }: { points: UserPoint[] }) {
  const center: [number, number] = points.length
    ? [points.reduce((a, p) => a + p.lat, 0) / points.length, points.reduce((a, p) => a + p.lng, 0) / points.length]
    : [-14.24, -51.93] // centro do Brasil

  return (
    <MapContainer center={center} zoom={points.length > 1 ? 4 : 10} style={{ height: 380, width: '100%', borderRadius: 16 }} scrollWheelZoom>
      <InvalidateOnMount />
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map(p => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={p.source === 'gps' ? 9 : 7}
          pathOptions={{
            color: '#ffffff', weight: 2,
            fillColor: p.source === 'gps' ? '#059669' : '#2563EB',
            fillOpacity: 0.85,
          }}
        >
          <Popup>
            <b>{p.name}</b><br />
            {p.state ? `${p.state} · ` : ''}{p.source === 'gps' ? 'GPS (passeio)' : 'DDD do telefone'}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
