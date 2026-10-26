'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet'
import { MapPin, Phone, Navigation } from 'lucide-react'
import type { NearbyPlace } from '@/lib/api'
import { useT } from '@/contexts/LocaleContext'

interface NearbyMapProps {
  userLat: number
  userLon: number
  results: NearbyPlace[]
  type: 'veterinary' | 'petshop' | string
  onSelect?: (place: NearbyPlace) => void
}

// Ícones lucide (Stethoscope / ShoppingBag) em SVG puro: o marcador do Leaflet é HTML solto.
const SVG_ATTRS = 'xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
const STETHOSCOPE = `<svg ${SVG_ATTRS}><path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/></svg>`
const SHOPPING_BAG = `<svg ${SVG_ATTRS}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`

const vetIcon = L.divIcon({
  className: 'petlife-marker',
  html: `<div style="background:#047857;border:3px solid white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(4,120,87,0.4);">${STETHOSCOPE}</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -16],
})

const petshopIcon = L.divIcon({
  className: 'petlife-marker',
  html: `<div style="background:#b45309;border:3px solid white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(180,83,9,0.4);">${SHOPPING_BAG}</div>`,
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
  const t = useT()
  const icon = useMemo(() => (type === 'petshop' ? petshopIcon : vetIcon), [type])
  const ref = useRef<L.Map | null>(null)

  return (
    <div className="relative isolate z-0 rounded-2xl overflow-hidden border border-surface-200/70 dark:border-surface-800 bg-surface-100 dark:bg-surface-900 shadow-sm" style={{ height: 420 }}>
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
          <Popup>
            <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" aria-hidden /> {t('wk.nearby.youAreHere')}</span>
          </Popup>
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
                  {r.address && <div className="text-surface-600 mb-1">{r.address}</div>}
                  {r.distance_km != null && (
                    <div className="text-xs text-primary-800 font-medium inline-flex items-center gap-1">
                      <Navigation className="w-3 h-3" aria-hidden /> {r.distance_km.toFixed(1)} km
                    </div>
                  )}
                  {r.phone && (
                    <a href={`tel:${r.phone}`} className="flex items-center gap-1 min-h-[44px] text-sm text-primary-800 font-semibold hover:underline">
                      <Phone className="w-3.5 h-3.5" aria-hidden /> {r.phone}
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
