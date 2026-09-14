'use client'

import { useId, useRef, useState } from 'react'

/**
 * Tabs, built to the WAI-ARIA tabs pattern.
 *
 * Used on /archbishop, which is five unrelated sections — a profile, two
 * successions of bishops, a set of photo cards and four episcopal conferences.
 * As one page it was an eight-screen scroll in which nothing could be found.
 *
 * Every panel is rendered into the DOM and hidden with the `hidden` attribute
 * rather than mounted on demand. That costs a little markup and buys three
 * things: search engines index all of it, in-page `Ctrl+F` still works for
 * anything a visitor remembers seeing, and there is no flash of nothing when a
 * tab is selected.
 *
 * Keyboard behaviour follows the pattern: arrow keys move between tabs, Home
 * and End jump to the ends, and only the selected tab is in the tab order, so
 * Tab moves out of the tab list and into the panel rather than through every
 * tab in turn.
 */

export type Tab = {
  id: string
  label: string
  content: React.ReactNode
}

export const Tabs = ({
  tabs,
  label,
  variant = 'primary',
}: {
  tabs: Tab[]
  /** Names the tab list for screen readers, e.g. "Archbishop page sections". */
  label: string
  /** `nested` is the quieter treatment used for tabs inside a panel. */
  variant?: 'primary' | 'nested'
}) => {
  const [active, setActive] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const base = useId()

  if (tabs.length === 0) return null

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = tabs.length - 1
    let next: number | null = null

    if (event.key === 'ArrowRight') next = active === last ? 0 : active + 1
    else if (event.key === 'ArrowLeft') next = active === 0 ? last : active - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last

    if (next === null) return

    event.preventDefault()
    setActive(next)
    buttons.current[next]?.focus()
  }

  const primary = variant === 'primary'

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        /**
         * On a phone the five labels wrap onto five rows — 177px of tab list
         * before any content. A horizontal scroller is the usual mobile
         * treatment and keeps the panel in view; from `sm` up they all fit and
         * wrap normally.
         */
        className={
          primary
            ? 'flex gap-1 overflow-x-auto border-b border-brand-100 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden'
            : 'flex flex-wrap gap-2'
        }
      >
        {tabs.map((tab, index) => {
          const selected = index === active

          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              // Only the selected tab is reachable with Tab; the arrow keys
              // move within the list. That is the ARIA pattern.
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={
                primary
                  ? `-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      selected
                        ? 'border-gold-400 text-brand-900'
                        : 'border-transparent text-slate-600 hover:border-brand-200 hover:text-brand-800'
                    }`
                  : `rounded-full px-4 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      selected
                        ? 'bg-brand-700 text-white'
                        : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                    }`
              }
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={index !== active}
          // A panel is focusable so that tabbing out of the tab list lands
          // inside the content it describes.
          tabIndex={0}
          className={primary ? 'pt-8 focus:outline-none' : 'pt-6 focus:outline-none'}
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
