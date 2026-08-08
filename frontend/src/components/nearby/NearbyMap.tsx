'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet'
import type { NearbyPlace } from '@/lib/api'

interface NearbyMapProps {
  userLat: number
  userLon: number
  results: NearbyPlace[]
  type: 'veterinary' | 'petshop' | string
  onSelect?: (place: NearbyPlace) => void
}

const vetIcon = L.divIcon({
  className: 'petlife-marker',
  html: `<div style="background:#10b981;border:3px solid white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(16,185,129,0.4);font-size:18px;">🏥</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -16],
})

const petshopIcon = L.divIcon({
  className: 'petlife-marker',
  html: `<div style="background:#f59e0b;border:3px solid white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(245,158,11,0.4);font-size:18px;">🛍️</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -16],
})

function FitBounds({ userLat, userLon, results }: { userLat: number; userLon: number; results: NearbyPlace[] }) {
  const map = useMap()
  useEffect(() => {
    const points: [number, number][] = [[userLat, userLon]]
    results.forEach(r => {
      if (r.lat != null && r.lon != null) points.push([r.lat, r.lon])
    })
    if (points.length === 1) {
      map.setView(points[0], 14)
    } else {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 15 })
    }
  }, [map, userLat, userLon, results])
  return null
}

export default function NearbyMap({ userLat, userLon, results, type, onSelect }: NearbyMapProps) {
  const icon = useMemo(() => (type === 'petshop' ? petshopIcon : vetIcon), [type])
  const ref = useRef<L.Map | null>(null)

  return (
    <div className="rounded-2xl overflow-hidden border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 shadow-sm" style={{ height: 420 }}>
      <MapContainer
        ref={ref as never}
        center={[userLat, userLon]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker
          center={[userLat, userLon]}
          radius={8}
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 3 }}
        >
          <Popup>📍 Você está aqui</Popup>
        </CircleMarker>
        {results
          .filter(r => r.lat != null && r.lon != null)
          .map((r, i) => (
            <Marker
              key={`${r.name}-${i}`}
              position={[r.lat as number, r.lon as number]}
              icon={icon}
              eventHandlers={{ click: () => onSelect?.(r) }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold mb-1">{r.name}</div>
                  {r.address && <div className="text-surface-600 dark:text-surface-300 mb-1">{r.address}</div>}
                  {r.distance_km != null && (
                    <div className="text-xs text-primary-700 font-medium">📍 {r.distance_km.toFixed(1)} km</div>
                  )}
                  {r.phone && (
                    <a href={`tel:${r.phone}`} className="text-xs text-primary-600 hover:underline">
                      📞 {r.phone}
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        <FitBounds userLat={userLat} userLon={userLon} results={results} />
      </MapContainer>
    </div>
  )
}
