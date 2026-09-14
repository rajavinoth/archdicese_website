import { localePath, type Locale } from '@/lib/i18n'

type Props = {
  locale: Locale
  placeholder: string
  /** Accessible name for the field; visually hidden. */
  label: string
  submit: string
  defaultValue?: string
  /** Ids must be unique per page — the header and the search page both use one. */
  id?: string
  autoFocus?: boolean
  compact?: boolean
}

/**
 * Site search box.
 *
 * Deliberately a plain GET form rather than a client component: it needs no
 * JavaScript, it survives being opened in a new tab, and the results page is
 * a real URL that can be shared or bookmarked. `action` carries the language
 * prefix so a Tamil visitor stays in Tamil.
 */
export const SearchForm = ({
  locale,
  placeholder,
  label,
  submit,
  defaultValue,
  id = 'site-search',
  autoFocus = false,
  compact = false,
}: Props) => (
  <form
    action={localePath('/search', locale)}
    method="get"
    role="search"
    className={compact ? 'flex items-center' : 'flex gap-2'}
  >
    <label htmlFor={id} className="sr-only">
      {label}
    </label>
    <input
      id={id}
      type="search"
      name="q"
      defaultValue={defaultValue}
      placeholder={placeholder}
      autoFocus={autoFocus}
      /*
       * Both variants set their background explicitly. Tailwind's preflight
       * resets form controls to `background-color: transparent`, so an input
       * with no background of its own takes on whatever is behind it — which
       * on the navy header meant dark slate text on dark navy, effectively
       * invisible. The compact variant is styled for that dark header; the
       * full-width one for a white page.
       */
      className={
        compact
          ? 'w-40 rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-brand-200 focus:border-gold-300 focus:bg-white/20 focus:outline-none lg:w-52'
          : 'w-full rounded-md border border-brand-200 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none'
      }
    />
    {compact ? (
      <button type="submit" className="sr-only">
        {submit}
      </button>
    ) : (
      <button
        type="submit"
        className="rounded-md bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
      >
        {submit}
      </button>
    )}
  </form>
)
