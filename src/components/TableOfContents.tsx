'use client'

import { useEffect, useState } from 'react'

import type { TocItem } from '@/lib/toc'

/**
 * Contents list for a long page, with the current section highlighted.
 *
 * A client component only for the highlighting — the links themselves are
 * plain anchors and work with JavaScript switched off, which matters for a
 * page whose job is to be readable.
 */
export const TableOfContents = ({
  items,
  label,
}: {
  items: TocItem[]
  label: string
}) => {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null)

    if (headings.length === 0) return

    /**
     * Which section is being read is not a question IntersectionObserver
     * answers directly — several headings can be on screen at once, and none
     * is on screen in the middle of a long section. So the observer is used
     * only as a cheap "something moved" signal, and the answer is worked out
     * by looking for the last heading above the top of the viewport.
     */
    const update = () => {
      const top = 100
      let current = headings[0]

      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= top) current = heading
        else break
      }

      setActiveId(current.id)
    }

    update()

    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [items])

  return (
    <nav aria-label={label} className="text-sm">
      <h2 className="text-xs font-semibold tracking-[0.14em] text-brand-500 uppercase">
        {label}
      </h2>

      <ul className="mt-3 space-y-1 border-l border-brand-100">
        {items.map((item) => {
          const active = item.id === activeId

          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={active ? 'true' : undefined}
                className={`-ml-px block border-l-2 py-1 transition ${
                  item.level >= 4 ? 'pl-6' : 'pl-4'
                } ${
                  active
                    ? 'border-gold-400 font-medium text-brand-900'
                    : 'border-transparent text-slate-600 hover:border-brand-300 hover:text-brand-800'
                }`}
              >
                {item.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
