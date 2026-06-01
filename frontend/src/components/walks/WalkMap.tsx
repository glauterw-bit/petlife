'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import type { RoutePoint } from '@/lib/api'

interface WalkMapProps {
  points: RoutePoint[]
  currentLat?: number
  currentLng?: number
  height?: number
  /** Se true, segue a posição atual centralizando o mapa */
  follow?: boolean
}

/** Corrige o bug clássico do Leaflet em container que carrega via dynamic import /
 *  dentro de flexbox: o mapa inicializa com tamanho 0 e renderiza cinza/branco
 *  até invalidateSize() ser chamado depois do layout estabilizar. */
function InvalidateOnMount() {
  const map = useMap()
  useEffect(() => {
    const fix = () => map.invalidateSize()
    // várias tentativas: imediato, após paint, após animações de entrada
    const t1 = setTimeout(fix, 0)
    const t2 = setTimeout(fix, 150)
    const t3 = setTimeout(fix, 450)
    window.addEventListener('resize', fix)
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
      window.removeEventListener('resize', fix)
    }
  }, [map])
  return null
}

function FollowOrFit({
  points,
  currentLat,
  currentLng,
  follow,
}: { points: RoutePoint[]; currentLat?: number; currentLng?: number; follow: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (follow && currentLat != null && currentLng != null) {
      map.setView([currentLat, currentLng], Math.max(map.getZoom(), 16), { animate: true })
      return
    }
    if (points.length === 0) {
      if (currentLat != null && currentLng != null) {
        map.setView([currentLat, currentLng], 16)
      }
      return
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16)
      return
    }
    const latlngs: L.LatLngTuple[] = points.map(p => [p.lat, p.lng])
    if (currentLat != null && currentLng != null) latlngs.push([currentLat, currentLng])
    map.fitBounds(latlngs, { padding: [30, 30], maxZoom: 17 })
  }, [map, points, currentLat, currentLng, follow])

  return null
}

export default function WalkMap({ points, currentLat, currentLng, height = 420, follow = true }: WalkMapProps) {
  const ref = useRef<L.Map | null>(null)

  // Centro inicial fallback: SP
  const initialCenter: [number, number] = useMemo(() => {
    if (currentLat != null && currentLng != null) return [currentLat, currentLng]
    if (points.length > 0) return [points[0].lat, points[0].lng]
    return [-23.5505, -46.6333]
  }, [currentLat, currentLng, points])

  const polylinePositions = useMemo(
    () => points.map(p => [p.lat, p.lng] as [number, number]),
    [points],
  )

  return (
    <div className="rounded-2xl overflow-hidden border border-surface-200 dark:border-surface-700 bg-white shadow-sm" style={{ height }}>
      <MapContainer
        ref={ref as never}
        center={initialCenter}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />

        {/* Rota percorrida */}
        {polylinePositions.length >= 2 && (
          <Polyline positions={polylinePositions} pathOptions={{ color: '#10b981', weight: 6, opacity: 0.85, lineCap: 'round' }} />
        )}

        {/* Marker de início */}
        {points.length >= 1 && (
          <CircleMarker
            center={[points[0].lat, points[0].lng]}
            radius={8}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#10b981', fillOpacity: 1 }}
          />
        )}

        {/* Marker de posição atual (live) */}
        {currentLat != null && currentLng != null && (
          <>
            <CircleMarker
              center={[currentLat, currentLng]}
              radius={20}
              pathOptions={{ color: '#10b981', weight: 0, fillColor: '#10b981', fillOpacity: 0.2 }}
            />
            <CircleMarker
              center={[currentLat, currentLng]}
              radius={10}
              pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }}
            />
          </>
        )}

        <InvalidateOnMount />
        <FollowOrFit
          points={points}
          currentLat={currentLat}
          currentLng={currentLng}
          follow={follow}
        />
      </MapContainer>
    </div>
  )
}
