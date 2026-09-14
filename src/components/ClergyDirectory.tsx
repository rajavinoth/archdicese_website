'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

import { formatClergyName } from '@/lib/clergy'
import { fill } from '@/lib/i18n'

export type DeaneryOption = {
  id: string
  name: string
}

export type ClergyMember = {
  id: string
  slug: string
  name: string
  photo: { url: string; alt: string } | null
  honorific: 'fr' | 'msgr' | 'mostRev' | 'rev'
  status: 'active' | 'retired' | 'away' | 'onLeave' | 'deceased'
  currentAssignment: string | null
  languages: string[]
  deanery: DeaneryOption | null
}

/**
 * The interactive half of the directory. "use client" at the top of the file is
 * what makes useState and onChange available -- without it this would run only
 * on the server.
 *
 * All the records arrive as props from the server, already fetched, so
 * filtering happens instantly in the browser with no further requests.
 */
export type ClergyLabels = {
  searchLabel: string
  searchPlaceholder: string
  deanery: string
  allDeaneries: string
  status: string
  anyStatus: string
  active: string
  retired: string
  away: string
  onLeave: string
  deceased: string
  showing: string
  priests: string
  noResults: string
}

export function ClergyDirectory({
  clergy,
  deaneries,
  labels,
  basePath,
}: {
  clergy: ClergyMember[]
  deaneries: DeaneryOption[]
  labels: ClergyLabels
  /** Locale-aware prefix, e.g. "/clergy" or "/ta/clergy". */
  basePath: string
}) {
  const statusLabel: Record<ClergyMember['status'], string> = {
    active: labels.active,
    retired: labels.retired,
    away: labels.away,
    onLeave: labels.onLeave,
    deceased: labels.deceased,
  }

  const anyDeaneryAssigned = clergy.some((priest) => priest.deanery !== null)

  const [query, setQuery] = useState('')
  const [deaneryId, setDeaneryId] = useState('all')
  const [status, setStatus] = useState<'all' | ClergyMember['status']>('active')

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return clergy.filter((priest) => {
      if (deaneryId !== 'all' && priest.deanery?.id !== deaneryId) return false
      if (status !== 'all' && priest.status !== status) return false
      if (!needle) return true

      const haystack = [priest.name, priest.currentAssignment, priest.deanery?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [clergy, query, deaneryId, status])

  return (
    <section className="mt-8">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="min-w-56 flex-1">
          <label
            htmlFor="clergy-search"
            className="block text-xs font-medium text-slate-600"
          >
            {labels.searchLabel}
          </label>
          <input
            id="clergy-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.searchPlaceholder}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>

        {/*
          Only worth showing once priests actually have a deanery. The 2026
          appointments letter names the six deaneries but does not map priests
          to them, so until the curia supplies that the filter would match
          nothing and read as broken.
        */}
        <div hidden={!anyDeaneryAssigned}>
          <label
            htmlFor="clergy-deanery"
            className="block text-xs font-medium text-slate-600"
          >
            {labels.deanery}
          </label>
          <select
            id="clergy-deanery"
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
            htmlFor="clergy-status"
            className="block text-xs font-medium text-slate-600"
          >
            {labels.status}
          </label>
          <select
            id="clergy-status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as 'all' | ClergyMember['status'])
            }
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="all">{labels.anyStatus}</option>
            <option value="active">{labels.active}</option>
            <option value="retired">{labels.retired}</option>
            <option value="away">{labels.away}</option>
            <option value="onLeave">{labels.onLeave}</option>
          </select>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500" aria-live="polite">
        {fill(labels.showing, {
          shown: results.length,
          total: clergy.length,
          noun: labels.priests,
        })}
      </p>

      {/* Results */}
      {results.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {labels.noResults}
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((priest) => (
            <li
              key={priest.id}
              className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-slate-400"
            >
              <Link href={`${basePath}/${priest.slug}`} className="flex gap-3">
                {priest.photo ? (
                  <Image
                    src={priest.photo.url}
                    alt={priest.photo.alt}
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-14 w-14 shrink-0 rounded-full bg-slate-100"
                  />
                )}

                <span className="min-w-0">
                <h2 className="font-medium text-slate-900">
                  {formatClergyName(priest.honorific, priest.name)}
                </h2>

                {priest.currentAssignment && (
                  <p className="mt-1 text-sm text-slate-600">
                    {priest.currentAssignment}
                  </p>
                )}

                {priest.deanery && (
                  <p className="mt-1 text-xs text-slate-500">{priest.deanery.name}</p>
                )}

                {priest.status !== 'active' && (
                  <p className="mt-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {statusLabel[priest.status]}
                  </p>
                )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
