'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

import {
  DAYS,
  bandLabels,
  bandOf,
  dayLabel,
  formatTime,
  kindLabel,
  languageLabel,
  minutesOfDay,
  type Service,
  type TimeBand,
} from '@/lib/services'
import { distanceKm, formatDistance } from '@/lib/geo'
import { fill } from '@/lib/i18n'
import type { MapPin } from './ParishMap'

/**
 * Leaflet reads `window` as soon as it loads, so the map must never render on
 * the server. `ssr: false` is only allowed inside a Client Component, which is
 * one reason this file carries the "use client" directive.
 */
const ParishMap = dynamic(() => import('./ParishMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[28rem] animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
  ),
})

export type DeaneryOption = { id: string; name: string }

export type ParishSummary = {
  id: string
  slug: string
  name: string
  patron: string | null
  isShrine: boolean
  latitude: number | null
  longitude: number | null
  city: string | null
  deanery: DeaneryOption | null
  priestName: string | null
  services: Service[]
  /** True when the services above are demonstration data, not a real schedule. */
  timingsAreSample: boolean
}

/** Mirrors the `language` options on the Parishes collection. */
const LANGUAGE_CODES = ['tamil', 'english', 'telugu', 'hindi', 'malayalam', 'latin']

type Origin = { latitude: number; longitude: number }

export type ParishLabels = {
  search: string
  searchPlaceholder: string
  deanery: string
  allDeaneries: string
  massLanguage: string
  anyLanguage: string
  day: string
  anyDay: string
  time: string
  anyTime: string
  findNearMe: string
  locating: string
  locationSet: string
  shrinesOnly: string
  showMap: string
  hideMap: string
  shrine: string
  showing: string
  parishesNoun: string
  noneMatch: string
  sampleTimingsTitle: string
  sampleTimingsBody: string
}

export function ParishFinder({
  parishes,
  deaneries,
  labels,
  basePath,
  locale,
}: {
  parishes: ParishSummary[]
  deaneries: DeaneryOption[]
  labels: ParishLabels
  /** Locale-aware prefix, e.g. "/parishes" or "/ta/parishes". */
  basePath: string
  locale: string
}) {
  const anyDeaneryAssigned = parishes.some((parish) => parish.deanery !== null)

  const [query, setQuery] = useState('')
  const [deaneryId, setDeaneryId] = useState('all')
  const [language, setLanguage] = useState('all')
  const [day, setDay] = useState('all')
  const [band, setBand] = useState<'all' | TimeBand>('all')
  const [shrinesOnly, setShrinesOnly] = useState(false)
  const [showMap, setShowMap] = useState(true)

  // Set once the visitor allows geolocation; enables distance sorting.
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('This browser cannot share your location.')
      return
    }

    setLocating(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocating(false)
      },
      () => {
        setLocationError('Could not get your location. Check browser permissions.')
        setLocating(false)
      },
      { timeout: 10_000 },
    )
  }

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const serviceFiltersActive = language !== 'all' || day !== 'all' || band !== 'all'

    const matched = parishes.filter((parish) => {
      if (deaneryId !== 'all' && parish.deanery?.id !== deaneryId) return false
      if (shrinesOnly && !parish.isShrine) return false

      if (needle) {
        const haystack = [
          parish.name,
          parish.patron,
          parish.city,
          parish.deanery?.name,
          parish.priestName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(needle)) return false
      }

      // A parish qualifies only if ONE service satisfies every active timing
      // filter -- "an English mass on Sunday morning" must be the same service,
      // not an English mass on Tuesday plus a Tamil one on Sunday.
      if (serviceFiltersActive) {
        const hit = parish.services.some((service) => {
          if (language !== 'all' && service.language !== language) return false
          if (day !== 'all' && service.day !== day) return false
          if (band !== 'all' && bandOf(service.time) !== band) return false
          return true
        })
        if (!hit) return false
      }

      return true
    })

    const withDistance = matched.map((parish) => ({
      parish,
      distance:
        origin && parish.latitude != null && parish.longitude != null
          ? distanceKm(origin, {
              latitude: parish.latitude,
              longitude: parish.longitude,
            })
          : null,
    }))

    withDistance.sort((a, b) => {
      if (a.distance != null && b.distance != null) return a.distance - b.distance
      if (a.distance != null) return -1
      if (b.distance != null) return 1
      return a.parish.name.localeCompare(b.parish.name)
    })

    return withDistance
  }, [parishes, query, deaneryId, language, day, band, shrinesOnly, origin])

  /**
   * Whether any parish *currently on screen* is showing invented timings.
   * Computed from the filtered results rather than the whole set, so the
   * warning is about what the visitor can actually see.
   */
  const anySampleTimings = results.some(({ parish }) => parish.timingsAreSample)

  const pins: MapPin[] = results
    .filter(({ parish }) => parish.latitude != null && parish.longitude != null)
    .map(({ parish }) => ({
      id: parish.id,
      slug: parish.slug,
      name: parish.name,
      latitude: parish.latitude as number,
      longitude: parish.longitude as number,
      isShrine: parish.isShrine,
    }))

  /** The services a card should highlight, given the active filters. */
  const relevantServices = (parish: ParishSummary): Service[] =>
    parish.services
      .filter((service) => {
        if (language !== 'all' && service.language !== language) return false
        if (day !== 'all' && service.day !== day) return false
        if (band !== 'all' && bandOf(service.time) !== band) return false
        return true
      })
      .sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time))
      .slice(0, 3)

  return (
    <section className="mt-8">
      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1">
            <label
              htmlFor="parish-search"
              className="block text-xs font-medium text-slate-600"
            >
              {labels.search}
            </label>
            <input
              id="parish-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          {/* Hidden until parishes are actually assigned to a deanery. */}
          <div hidden={!anyDeaneryAssigned}>
            <label
              htmlFor="parish-deanery"
              className="block text-xs font-medium text-slate-600"
            >
              {labels.deanery}
            </label>
            <select
              id="parish-deanery"
              value={deaneryId}
              onChange={(event) => setDeaneryId(event.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="all">{labels.allDeaneries}</option>
              {deaneries.map((deanery) => (
                <option key={deanery.id} value={deanery.id}>
                  {deanery.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="parish-language"
              className="block text-xs font-medium text-slate-600"
            >
              {labels.massLanguage}
            </label>
            <select
              id="parish-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="all">{labels.anyLanguage}</option>
              {LANGUAGE_CODES.map((value) => (
                <option key={value} value={value}>
                  {languageLabel(value, locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="parish-day"
              className="block text-xs font-medium text-slate-600"
            >
              {labels.day}
            </label>
            <select
              id="parish-day"
              value={day}
              onChange={(event) => setDay(event.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="all">{labels.anyDay}</option>
              {DAYS.map((value) => (
                <option key={value} value={value}>
                  {dayLabel(value, locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="parish-band"
              className="block text-xs font-medium text-slate-600"
            >
              {labels.time}
            </label>
            <select
              id="parish-band"
              value={band}
              onChange={(event) => setBand(event.target.value as 'all' | TimeBand)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="all">{labels.anyTime}</option>
              {Object.entries(bandLabels(locale)).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={requestLocation}
            disabled={locating}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-500 disabled:opacity-60"
          >
            {locating
              ? labels.locating
              : origin
                ? labels.locationSet
                : labels.findNearMe}
          </button>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={shrinesOnly}
              onChange={(event) => setShrinesOnly(event.target.checked)}
              className="rounded border-slate-300"
            />
            {labels.shrinesOnly}
          </label>

          <button
            type="button"
            onClick={() => setShowMap((current) => !current)}
            className="text-sm text-slate-600 underline hover:text-slate-900"
          >
            {showMap ? labels.hideMap : labels.showMap}
          </button>
        </div>

        {locationError && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {locationError}
          </p>
        )}
      </div>

      {showMap && (
        <div className="mt-6">
          <ParishMap pins={pins} basePath={basePath} />
        </div>
      )}

      {/*
        If any of the timings driving these filters are invented, say so here --
        above the results, not beneath them. Somebody filtering for "Sunday
        morning, Tamil" is about to act on the answer.
      */}
      {anySampleTimings && (
        <div className="mt-6 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {labels.sampleTimingsTitle}
          </p>
          <p className="mt-1 text-sm text-amber-900">{labels.sampleTimingsBody}</p>
        </div>
      )}

      <p className="mt-6 text-sm text-slate-500" aria-live="polite">
        {fill(labels.showing, {
          shown: results.length,
          total: parishes.length,
          noun: labels.parishesNoun,
        })}
      </p>

      {results.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {labels.noneMatch}
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {results.map(({ parish, distance }) => {
            const services = relevantServices(parish)

            return (
              <li
                key={parish.id}
                className="rounded-lg border border-slate-200 p-5 transition-colors hover:border-slate-400"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">
                      <Link href={`${basePath}/${parish.slug}`} className="hover:underline">
                        {parish.name}
                      </Link>
                    </h2>
                  </div>

                  {parish.isShrine && (
                    <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      {labels.shrine}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {[parish.deanery?.name, parish.city].filter(Boolean).join(' · ')}
                </p>

                {distance != null && (
                  <p className="mt-1 text-xs font-medium text-slate-700">
                    {formatDistance(distance)}
                  </p>
                )}

                {services.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {services.map((service, index) => (
                      <li key={index} className="text-slate-700">
                        <span className="font-medium">{formatTime(service.time, locale)}</span>{' '}
                        {dayLabel(service.day, locale)}
                        {service.language &&
                          ` · ${languageLabel(service.language, locale)}`}
                        {service.kind !== 'mass' &&
                          ` · ${kindLabel(service.kind, locale)}`}
                        {service.note && (
                          <span className="text-slate-500"> ({service.note})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {parish.priestName && (
                  <p className="mt-3 text-xs text-slate-500">{parish.priestName}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
