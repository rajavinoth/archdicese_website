import { fill } from '@/lib/i18n'

/**
 * Downloads, as cards.
 *
 * The list this replaces was migrated WordPress prose: a title, then a
 * paragraph containing only the word "Download", repeated twelve times with no
 * spacing. Nothing told you what a file was, how big it was, or which of the
 * two Pre-Nuptial forms was the Tamil one.
 *
 * Each card is one link, not a title with a "Download" link beside it — the
 * whole card is the target, which is easier to hit on a phone and gives screen
 * readers one clear thing to announce instead of a dangling "Download" with no
 * context.
 */

export type DocumentCard = {
  id: string
  title: string
  description: string | null
  url: string
  filename: string
  mimeType: string | null
  filesize: number | null
  language: string | null
}

type Props = {
  documents: DocumentCard[]
  labels: {
    /**
     * Optional. The newsletter archive puts each year in a tab, and the tab
     * already names the group — a "Downloads" heading under it would be a
     * second label for the same thing.
     */
    heading?: string
    download: string
    /** Template with {type} and {size}, e.g. "PDF · 152 KB". */
    fileMeta: string
    tamil: string
    english: string
  }
}

/** "PDF", "Word", "Excel" — what the visitor would call it. */
const typeLabel = (mimeType: string | null, filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  if (mimeType?.includes('pdf') || extension === 'pdf') return 'PDF'
  if (extension === 'doc' || extension === 'docx') return 'Word'
  if (extension === 'xls' || extension === 'xlsx') return 'Excel'
  return extension.toUpperCase() || 'File'
}

/**
 * File size in the units people use. Rounded, because "151.7 KB" invites a
 * precision nobody wants from a form download.
 */
const sizeLabel = (bytes: number | null): string | null => {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Inline SVG rather than an icon font: two shapes, no extra request. */
const DownloadIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
    aria-hidden="true"
  >
    <path d="M12 3v12" />
    <path d="m7 12 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
)

const FileIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-6"
    aria-hidden="true"
  >
    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
    <path d="M14 2v5h5" />
  </svg>
)

export const DocumentList = ({ documents, labels }: Props) => {
  if (documents.length === 0) return null

  return (
    <section className={labels.heading ? 'mt-10' : ''}>
      {labels.heading && (
        <h2 className="text-xl font-semibold tracking-tight text-brand-900">
          {labels.heading}
        </h2>
      )}

      <ul className={`grid gap-4 sm:grid-cols-2 ${labels.heading ? 'mt-5' : ''}`}>
        {documents.map((doc) => {
          const type = typeLabel(doc.mimeType, doc.filename)
          const size = sizeLabel(doc.filesize)
          const meta = size
            ? fill(labels.fileMeta, { type, size })
            : type

          return (
            <li key={doc.id}>
              <a
                href={doc.url}
                // `download` asks the browser to save rather than navigate;
                // a PDF otherwise opens in a viewer and the visitor loses the
                // page they were on.
                download
                className="group flex h-full items-start gap-4 rounded-xl border border-brand-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white"
                >
                  <FileIcon />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-brand-900 group-hover:underline">
                    {doc.title}
                  </span>

                  {doc.description && (
                    <span className="mt-1 block text-sm text-slate-600">
                      {doc.description}
                    </span>
                  )}

                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      {meta}
                    </span>
                    {/* Only worth saying when it is not the default. */}
                    {doc.language === 'tamil' && (
                      <span className="rounded bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-600">
                        {labels.tamil}
                      </span>
                    )}
                  </span>
                </span>

                <span
                  aria-hidden="true"
                  className="mt-0.5 text-brand-400 transition group-hover:text-brand-700"
                >
                  <DownloadIcon />
                </span>

                {/* The visible card says everything; this names the action. */}
                <span className="sr-only">{labels.download}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
