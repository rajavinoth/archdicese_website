/**
 * Renders a schema.org JSON-LD block.
 *
 * `dangerouslySetInnerHTML` is the documented way to emit JSON-LD in React —
 * a script tag's contents are not JSX children. The input is our own data, not
 * anything a visitor typed, but `<` is still escaped so a stray "</script>"
 * inside a page title could never close the tag early.
 */
export const JsonLd = ({ data }: { data: unknown }) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(data).replace(/</g, '\\u003c'),
    }}
  />
)
