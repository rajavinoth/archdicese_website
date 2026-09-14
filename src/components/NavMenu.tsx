'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/**
 * One drop-down in the main navigation.
 *
 * The header had six links and no room for more. The newsletter and the two
 * galleries are three more, and nine links across the top wraps onto two rows
 * on a laptop and looks like a list rather than a menu — so the three that
 * belong together are grouped under one heading.
 *
 * Behaviour a menu is expected to have, and which a bare hover-menu does not:
 * it opens on a click (so it works on a touchscreen), Escape closes it and
 * puts focus back on the button, clicking anywhere else closes it, and moving
 * focus out of it with the keyboard closes it too. Every item is a real link,
 * so it still works with a keyboard, with a screen reader, and — since the
 * same links are in the footer — with no JavaScript at all.
 */
export const NavMenu = ({
  label,
  items,
}: {
  label: string
  items: { href: string; label: string }[]
}) => {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement | null>(null)
  const button = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div
      ref={container}
      className="relative"
      /**
       * Tabbing past the last item should close the menu. `relatedTarget` is
       * whatever is receiving focus; if it is still inside the menu, this is
       * movement within it rather than departure from it.
       */
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false)
        }
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1 text-brand-100 underline-offset-4 transition hover:text-gold-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
      >
        {label}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/*
        Which edge the menu hangs from depends on where the button is. On a
        phone the navigation wraps to its own row at the left of the screen,
        and a menu aligned to the button's right edge opens off the side of the
        display — 129px of it, unreachable. There it hangs from the left. From
        `sm` up the navigation sits at the right of the header, where the
        opposite is true.
      */}
      {open && (
        <ul className="absolute left-0 z-50 mt-2 min-w-52 rounded-lg border border-brand-100 bg-white py-1.5 shadow-lg sm:right-0 sm:left-auto">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-slate-700 transition hover:bg-brand-50 hover:text-brand-900 focus:bg-brand-50 focus:outline-none"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
