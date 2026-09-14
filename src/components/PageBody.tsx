import { RichText } from '@payloadcms/richtext-lexical/react'

import { TableOfContents } from '@/components/TableOfContents'
import { findShapes, type LexicalNode } from '@/lib/rich-text-shapes'
import { buildToc, TOC_MIN_HEADINGS } from '@/lib/toc'

/**
 * A migrated CMS page's body: the prose, plus a contents list when the page is
 * long enough to need one.
 *
 * Two shapes get special treatment, because the migration flattened them into
 * prose and they are unreadable that way — label/value field rows and lists of
 * prelates with their terms. See src/lib/rich-text-shapes.ts for what they
 * look like and why they can be recovered rather than re-typed.
 *
 * Headings get `id` attributes here rather than in the stored content, so
 * nothing has to be rewritten in the database and an editor renaming a section
 * gets a matching anchor for free.
 */
export const PageBody = ({
  content,
  tocLabel,
}: {
  content: unknown
  tocLabel: string
}) => {
  const shapes = findShapes(content)
  const { items, ids } = buildToc(
    content,
    new Set([...shapes.fields.keys(), ...shapes.prose]),
  )
  const showToc = items.length >= TOC_MIN_HEADINGS

  const body = (
    <div className="prose prose-slate prose-page max-w-none">
      <RichText
        data={content as never}
        converters={({ defaultConverters }) => ({
          ...defaultConverters,

          heading: ({ node, nodesToJSX }) => {
            const field = shapes.fields.get(node as LexicalNode)

            /**
             * A label and its value, not a heading. Rendered as a one-item
             * definition list: valid HTML, and it tells a screen reader that
             * "PHONE" describes the number rather than introducing a section.
             */
            if (field) {
              return (
                <dl className="not-prose m-0 grid grid-cols-1 gap-x-6 border-b border-brand-50 py-2.5 last:border-0 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <dt className="text-xs font-semibold tracking-wide text-brand-500 uppercase sm:pt-0.5">
                    {field.label}
                  </dt>
                  <dd className="m-0 text-slate-700">
                    {field.values.map((value, index) => (
                      <span key={index} className="block">
                        {value}
                      </span>
                    ))}
                  </dd>
                </dl>
              )
            }

            /**
             * A whole paragraph that was marked up as a heading. The old site
             * did this for the entire HISTORY section — nine `h4` elements,
             * one of them 411 characters long. Rendered as what it is.
             */
            if (shapes.prose.has(node as LexicalNode)) {
              return <p>{nodesToJSX({ nodes: node.children })}</p>
            }

            const Tag = (node.tag ?? 'h3') as 'h2' | 'h3' | 'h4'
            return (
              <Tag id={ids.get(node as LexicalNode)}>
                {nodesToJSX({ nodes: node.children })}
              </Tag>
            )
          },

          paragraph: ({ node, nodesToJSX }) => {
            const lexical = node as LexicalNode

            // The term paragraph was already rendered beside its name.
            if (shapes.consumed.has(lexical)) return null

            const row = shapes.succession.get(lexical)
            if (row) {
              return (
                <div className="not-prose flex items-baseline justify-between gap-4 border-b border-brand-50 py-2 last:border-0">
                  <span className="text-slate-800">{row.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-brand-500">
                    {row.term}
                  </span>
                </div>
              )
            }

            /**
             * A line that continues the value of the field row above it —
             * the rest of the Archbishop's address, for instance. Aligned
             * under the value column so it reads as part of that field
             * instead of as an orphaned paragraph at full width.
             */
            if (shapes.continuations.has(lexical)) {
              return (
                <div className="not-prose grid grid-cols-1 gap-x-6 border-b border-brand-50 pb-2.5 last:border-0 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <span aria-hidden="true" />
                  <div className="text-slate-700">
                    {nodesToJSX({ nodes: node.children })}
                  </div>
                </div>
              )
            }

            const children = nodesToJSX({ nodes: node.children })

            // Matches the default converter: an empty paragraph is a spacer.
            if (!children?.length) {
              return (
                <p>
                  <br />
                </p>
              )
            }

            /**
             * 76 paragraphs on this page contain a horizontal rule. `<hr>`
             * cannot live inside a `<p>` — the browser closes the paragraph
             * early, the server and client then disagree about the shape of
             * the tree, and React throws a hydration error. A `<div>` holds
             * exactly the same content and is valid.
             */
            const hasRule = (node.children ?? []).some(
              (child) => (child as LexicalNode).type === 'horizontalrule',
            )
            if (hasRule) return <div className="my-4">{children}</div>

            return <p>{children}</p>
          },
        })}
      />
    </div>
  )

  if (!showToc) return <div className="mt-8">{body}</div>

  return (
    <div className="mt-8 gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
      {body}

      {/*
        Second in the DOM so the article is what a screen reader and a search
        engine meet first. It sits alongside, sticky, and collapses out of the
        way on narrow screens where a fixed sidebar has nowhere to live.
      */}
      <aside className="mt-12 hidden lg:sticky lg:top-24 lg:mt-0 lg:block">
        <TableOfContents items={items} label={tocLabel} />
      </aside>
    </div>
  )
}
