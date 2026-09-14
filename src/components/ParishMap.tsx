'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { CHENNAI_CENTRE } from '@/lib/geo'

export type MapPin = {
  id: string
  slug: string
  name: string
  latitude: number
  longitude: number
  isShrine: boolean
}

/**
 * Leaflet's default marker is a PNG referenced by a relative path, which
 * bundlers rewrite and break. An inline SVG icon avoids the asset pipeline
 * altogether and lets us style shrines differently.
 */
const pinIcon = (isShrine: boolean) =>
  L.divIcon({
    className: 'parish-pin',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
    html: `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C7.6 0 4 3.6 4 8c0 5.4 8 16 8 16s8-10.6 8-16c0-4.4-3.6-8-8-8z"
            fill="${isShrine ? '#b45309' : '#0f172a'}" />
      <circle cx="12" cy="8" r="3" fill="#ffffff" />
    </svg>`,
  })

/**
 * Keeps the viewport in step with the filtered results. Lives as a child of
 * MapContainer because useMap() only works inside it.
 */
function FitToPins({ pins }: { pins: MapPin[] }) {
  const map = useMap()

  useEffect(() => {
    if (pins.length === 0) return

    if (pins.length === 1) {
      map.setView([pins[0].latitude, pins[0].longitude], 15)
      return
    }

    const bounds = L.latLngBounds(
      pins.map((pin) => [pin.latitude, pin.longitude] as [number, number]),
    )
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [pins, map])

  return null
}

export default function ParishMap({
  pins,
  basePath = '/parishes',
}: {
  pins: MapPin[]
  /** Locale-aware prefix so popups link within the current language. */
  basePath?: string
}) {
  // Only parishes with coordinates can be plotted.
  const plottable = useMemo(
    () => pins.filter((pin) => pin.latitude != null && pin.longitude != null),
    [pins],
  )

  return (
    <div className="h-[28rem] overflow-hidden rounded-lg border border-slate-200">
      <MapContainer
        center={[CHENNAI_CENTRE.latitude, CHENNAI_CENTRE.longitude]}
        zoom={12}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          // OpenStreetMap: no API key, no billing account. Attribution is
          // required by their tile usage policy.
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        <FitToPins pins={plottable} />

        {plottable.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.latitude, pin.longitude]}
            icon={pinIcon(pin.isShrine)}
          >
            <Popup>
              <a href={`${basePath}/${pin.slug}`} className="font-medium">
                {pin.name}
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
