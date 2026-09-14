# Archdiocese of Madras-Mylapore — website

Rebuild of [archdioceseofmadrasmylapore.in](https://archdioceseofmadrasmylapore.in/).

## Stack

| Piece    | Choice                              | Why                                                        |
| -------- | ----------------------------------- | ---------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19   | Server-rendered, so all content is indexable by Google     |
| CMS      | Payload 3, running inside Next.js   | One codebase, one deploy, no per-seat fees, we own the data |
| Database | SQLite in dev, Postgres in prod     | No local database server needed to get started             |
| Styling  | Tailwind CSS 4                      | —                                                          |

## Getting started

```bash
npm install
```

Copy `.env.example` to `.env` and set `PAYLOAD_SECRET` to a long random string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Seed the development database (creates an admin user, 3 deaneries, 46 clergy, 4 parishes):

```bash
npm run seed
```

Start the dev server:

```bash
npm run dev
```

- Public site: http://localhost:3000
- Admin panel: http://localhost:3000/admin — `admin@example.com` / `changeme123`

> The seeded priest names and deanery names are real, taken from the current
> public website. **Assignments, dates, coordinates and mass timings are
> placeholder values** used to build the interface. All of it must be replaced
> from the archdiocese's own records before launch.

## Scripts

| Command                     | What it does                                        |
| --------------------------- | --------------------------------------------------- |
| `npm run dev`               | Dev server                                          |
| `npm run devsafe`           | Dev server after clearing the `.next` cache         |
| `npm run build`             | Production build                                    |
| `npm run seed`              | Seed development data (safe to re-run; it upserts)  |
| `npm run generate:types`    | Regenerate `src/payload-types.ts` after schema edits |
| `npm run generate:importmap`| Regenerate the admin import map                     |
| `npm run lint`              | ESLint                                              |
| `npm run posts:quarantine`  | Unpublish the news posts that were theme demo content |
| `npm run worksheet:export`  | Write the CSV worksheets the curia fills in          |
| `npm run worksheet:import:dry` | Report what the returned worksheets would change  |
| `npm run worksheet:import`  | Apply the returned worksheets                        |
| `npm run check:times`       | Verify the worksheet time parser against the site's formatter |
| `npm run homepage:seed`     | Seed the verse-of-the-day pool and the carousel slides |
| `npm run parishes:geocode`  | Look up parish coordinates in OpenStreetMap          |
| `npm run documents:import`  | Pull the downloadable forms onto this site and turn them into records |
| `npm run newsletter:import` | Download the newsletter issues onto this site (this year and last by default) |
| `npm run videos:import`     | Rebuild the video gallery from the ids the old page embedded |
| `npm run albums:import`     | Recover the photo albums, and repair the photographs' alt text |
| `npm run demo:prepare`      | Build `demo-data/diocese.db` — the database with every priest's personal detail emptied out, safe to commit |
| `npm run content:tidy`      | Clear WordPress's justified alignment and decode leftover HTML entities |
| `npm run archbishop:import` | Load the Archbishop page from the archdiocese's corrected document |
| `npm run translation:apply` | Write the Tamil translations into the `ta` locale      |
| `npm run timings:sample`    | Load **sample** mass timings so the finder can be demonstrated |
| `npm run timings:sample clear` | Remove every sample timing. **Run before launch.** |

**After changing any collection in `src/collections/`, run `npm run generate:types`.**

## Layout

```
src/
  app/
    (frontend)/        Public website. Its layout.tsx is the site shell.
    (payload)/         Payload admin + REST/GraphQL API. Do not hand-edit.
  collections/         The content model — one file per content type.
  access/roles.ts      Who is allowed to read and write what.
  components/          React components used by the frontend.
  db.ts                Database adapter, isolated for the Postgres switch.
  payload.config.ts    Ties it all together.
  payload-types.ts     Generated. Do not edit by hand.
```

`(frontend)` and `(payload)` are Next.js *route groups* — the parentheses mean
the folder name does not appear in the URL. Each has its own root layout, which
is why there is no shared `src/app/layout.tsx`.

## What is built

- **/** — homepage: picture carousel, verse of the day, record counts, "how can
  we help" links, the diocesan calendar and the latest news
- **/parishes** — parish & mass-time finder: search, deanery / language / day /
  time-of-day filters, "find mass near me" (browser geolocation, sorted by
  distance), and a Leaflet + OpenStreetMap map
- **/parishes/[slug]** — timings grouped by day, address, contact, clergy
- **/clergy** — searchable, filterable directory of all priests
- **/clergy/[slug]** — profile, ministry details, assignment history
- **/news**, **/news/[slug]** — news and announcements
- **/events**, **/events/[slug]** — diocesan calendar
- **/[slug]** — CMS pages migrated from the old site
- **/archbishop** — the Archbishop, the two successions and the conferences, in tabs
- **/newsletter** — the *Niraivalvu* archive, a tab per year
- **/photo-gallery** — albums of photographs, with a viewer
- **/video-gallery** — videos that load from YouTube only when played
- **/contact** — office details and a working contact form
- **/search** — site-wide search over parishes, clergy, pages, news and the
  calendar, from the box in the header
- **/sitemap.xml**, **/robots.txt** — generated from the database, both
  languages, with hreflang alternates
- **schema.org JSON-LD** on the homepage and on every parish, priest, event and
  news page

## Bilingual: English and Tamil

**English lives at the root, Tamil under `/ta/`:**

| URL | Language |
| --- | --- |
| `/clergy` | English |
| `/ta/clergy` | Tamil |
| `/en/clergy` | 308 → `/clergy` (one canonical URL per page) |

English is *not* prefixed on purpose. All 270 redirects carried over from the
old site point at root paths, and prefixing English would have invalidated
every one of them.

`src/proxy.ts` (Next 16's renamed `middleware`) rewrites unprefixed paths to
`/en/...` internally — a rewrite, so the address bar still shows `/clergy`.
Verified that the legacy redirects still fire: `next.config` redirects run
*before* the proxy.

### Content vs interface

Two separate things:

- **Interface strings** live in `src/lib/i18n.ts` — nav, labels, buttons,
  validation messages, plus Tamil day names, mass languages and service kinds.
- **Content** is localized in Payload itself (`localization` in
  `payload.config.ts`), with `fallback: true` so a Tamil page shows the English
  text until someone translates it. Slugs are **not** localized: one page keeps
  one identity in both languages, which is what keeps the redirects valid.

Localized fields: page/post/event titles, excerpts and bodies; parish name,
patron and history; clergy name, assignment and biography; deanery and category
names.

> **The Tamil interface strings are a first pass and need review by a
> Tamil-speaking member of the archdiocese before launch.** Liturgical
> vocabulary has settled conventions that this file may not have got right.

### The first translated page

`/history-of-archdiocese` is fully translated into Tamil — title, thirteen
section headings and 13,888 characters of body text. Everything else still
falls back to English.

**It is a machine translation and the page says so**, in Tamil, above the text:
*"This page was translated by machine and has not yet been checked by a Tamil
speaker. The English version is the authoritative one."* It is a diocesan
history full of papal names, canonical vocabulary and transliterated personal
names — the last of these being the most likely to need correcting, since the
archdiocese will have its own preferred spelling for each. Unticking
**"This translation still needs review"** in the admin removes the notice. That
flag is *localized*, because it is a fact about one translation, not about the
page: the English original is never flagged.

The translation lives in `scripts/data/history-of-archdiocese-ta.json`, with its
vocabulary choices documented at the top, so it can be reviewed as a document
rather than read out of the database.

#### How the mapping cannot drift

The file is an ordered array of strings, one per **text node** in the English
document. `npm run translation:apply` clones the English Lexical tree and
replaces each text node in turn, so every heading, paragraph, line break and
inline format is preserved — the structure *is* the English structure.

That hangs entirely on the array being the same length as the document, so the
count is asserted before anything is written. Edit the English page and the
script refuses:

```
REFUSED — history-of-archdiocese
  the English page has 81 text nodes,
  the translation file has 82.
  Applying it anyway would shift every paragraph out of position, so
  nothing was written.
```

Without that check, a single added paragraph would shift every translation one
position along and produce a page that looked entirely plausible and said the
wrong things. Verified by deliberately adding a node.

Tamil headings get Tamil anchors — `#மயிலை-மறைமாவட்டத்தின்-தோற்றம்` — because the
slug builder keeps the Tamil Unicode block rather than reducing it to hyphens.

### Two things worth knowing

**`canonical` must be set per page, never in the layout.** A layout cannot see
the current path, so a canonical declared there tells Google every page is a
duplicate of the homepage — which is exactly what it did before
`alternatesFor()` in `src/lib/i18n.ts` existed. Each page now emits its own
canonical plus `hreflang` alternates for both languages.

**"6:00 AM" is correct in Tamil.** `ta-IN` in CLDR uses AM/PM for the
abbreviated day period, so the times are not left untranslated by mistake.
Dates and months *do* localize (`திங், 27 ஜனவரி, 2025`).

### The contact form stores messages; it does not email them

There is no email adapter configured yet, so Payload would only write mail to
the server console and it would be lost. Submissions therefore go into the
`contact-submissions` collection, where staff can work through them
(New / In progress / Answered / Spam).

Access is deliberately asymmetric: **anyone may create, only staff may read** —
messages from the public are not public. Verified: an anonymous
`GET /api/contact-submissions` returns 403.

Once SMTP exists, add an `afterChange` hook on that collection to notify the
office; nothing else needs to change.

Spam defences are a honeypot field and a minimum time-on-page check. Both are
cheap and neither is sufficient on their own — **a live deployment should add a
captcha or edge rate limiting**, since the create endpoint is necessarily
public.

### Two decisions worth knowing

**Maps use Leaflet + OpenStreetMap**, not Google Maps: no API key, no billing
account, no per-load charges. The map lives entirely in
`src/components/ParishMap.tsx`, so swapping providers later touches one file.

**Service times are formatted in `Asia/Kolkata`, always.** Payload's time
picker stores a full ISO instant, so formatting without a fixed timezone gives
one answer on the server (often UTC in production) and another in the browser —
which React reports as a hydration mismatch. See `src/lib/services.ts`.

### Editing content updates the site automatically

Pages are prerendered for speed, so `src/hooks/revalidate.ts` tells Next.js
which URLs went stale whenever a record is saved or deleted. Without it an
editor would save a change, reload, see nothing, and assume the site is broken.

Bulk imports can opt out by passing `context: { disableRevalidate: true }` to
any Payload write — the seed script does this.

## Content model

- **Deaneries** — the three deaneries; each parish belongs to one.
- **Parishes** — name, patron, deanery, coordinates, contact, and a `services`
  list (mass / novena / adoration / confession, by day, time and language).
  This is what will drive the parish and mass-time finder.
- **Clergy** — one record per priest, replacing the ~47 hand-built `/fr-...`
  pages on the current site. Searchable and filterable by deanery.
- **Documents** — downloadable files: the forms, and every newsletter issue
  (`category: 'newsletter'` with an `issueDate`, which is what /newsletter
  groups by).
- **Videos** — a YouTube id, a title, the publishing channel and a locally
  held thumbnail. Never an embed: see "The video gallery" below.
- **Albums** — a set of photographs from one occasion, for /photo-gallery.
- **Verses** — the pool the homepage's verse of the day is drawn from.
- **Media**, **Users** — uploads and accounts.

### Roles

| Role           | Can do                                              |
| -------------- | --------------------------------------------------- |
| `admin`        | Everything, including managing accounts             |
| `editor`       | Publish and edit all content                        |
| `parishPriest` | Edit **only** their own parish record               |

## Enabling localization on live data — read this first

`src/db.ts` uses `push: true`, which is fine for development but **is not a
migration**. Turning localization on moved every localized field into
`_locales` tables, and Drizzle's push offered to *delete* the old columns
without copying the data across:

```
· You're about to delete title column in events table with 199 items
DATA LOSS WARNING: Possible data loss detected if schema is pushed.
```

In development that was harmless — everything is reproducible from
`.migration/` plus `npm run seed`, so the database was rebuilt from scratch.
**On production it would destroy content.** Before making a schema change to a
live database, generate a real migration (`payload migrate:create`) that copies
existing values into the new locale tables, and turn `push` off.

## The demo deployment (Render)

A demo runs on Render rather than on Vercel or Netlify, and the reason is the
filesystem. This site keeps its database in a SQLite **file** and its uploads
as **files on disk** — 23 MB of images and 55 MB of PDFs. A serverless host
gives each invocation a read-only, throw-away filesystem, so the admin panel
would appear to work and then lose every change, and no upload would ever
succeed. Render runs a container with a mounted disk, where all three simply
work. (Of the two the question was originally about, Vercel is the better:
first-party Next.js support rather than a community runtime. It just needs
Postgres and object storage first, which is the real production setup and not
a demo.)

`render.yaml` is a blueprint — Render reads it and creates the service. The
`Dockerfile` is deliberately one stage: `next start` loads `next.config.ts`,
which imports the redirect overrides as TypeScript, and the entrypoint runs a
Payload script, which loads everything under `src/`. A trimmed runtime image
has to list every one of those files, and a missing one fails inside a
deployed container, which is the worst place to find out.

### The database had to be sanitised first, and the reason is not obvious

The site is careful with clergy contact details. Every priest's email,
telephone, home address and date of birth sits behind a `contactPublic`
checkbox, that checkbox is off for all 104 of them, and the field-level access
rules mean the public pages never render any of it. That part is correct and
was correct before any of this.

None of it helps here. Access control runs when *Payload* reads a row, and
there is no Payload between `git clone` and a reader with a SQLite browser. A
committed `diocese.db` publishes every column in it. That is how a site which
carefully hides 46 priests' home addresses ends up publishing 46 priests' home
addresses — through the demo, not through the site.

So `npm run demo:prepare` builds a separate database:

1. `scripts/demo-copy.mjs` copies it with SQLite's own `VACUUM INTO`, not a
   file copy — recent writes live in a write-ahead log, and a plain copy can
   miss them.
2. `scripts/demo-prepare.ts` empties the contact fields of every priest not
   marked public, deletes the contact-form submissions, and deletes every
   account. It refuses to run unless `DATABASE_URI` names the copy, because
   pointing it at the real database would destroy contact details that took a
   while to parse out of the curia's letter.
3. `scripts/demo-scrub.mjs` does what the first two cannot.

That third step is the one worth remembering. Clearing a field through Payload
clears the current record and nothing else; `Clergy` has drafts enabled, so
every past edit is still in `_clergy_v`. **419 version rows still held an email
address, a telephone number and a home address, and 410 held a date of birth,
after the visible records had been emptied and looked clean.** Version rows are
not reachable through the Local API, so that step goes through SQL, and it ends
by re-checking every table and exiting non-zero if anything is left.

### No account is committed either

The demo database ships with **no users at all**. A password hash in a
committed file is published to anyone who can clone the repository, and
guessing at a hash offline has no rate limit.

That leaves one hazard, which `scripts/ensure-admin.ts` exists to close: Payload
offers a "create the first user" screen when a project has no accounts — right
on a laptop, wrong on a public address, where the first stranger to find
`/admin` becomes the administrator of a real archdiocese's website. The
entrypoint runs that script before the server starts, and it exits non-zero if
`ADMIN_EMAIL` and `ADMIN_PASSWORD` are not set. A container that will not boot
is a visible failure; an open sign-up page is an invisible one.

### The demo is not indexed

`DEMO_NOINDEX=1` makes `robots.txt` disallow everything and adds a `noindex`
header to every page. Both are needed: robots.txt stops a crawler fetching a
page, but a page linked from somewhere else can still be listed without ever
being fetched — only the header prevents that. A public copy of a real
archdiocese's website is a second site with the same content, competing with
the archdiocese's own pages, and someone who found it in a search result would
have no way of knowing it was not the real one. It stays readable by anyone
with the link, which is what a demo is for.

### Two things that were nearly shipped

- **`.gitignore` was excluding the demo database.** The rule read `diocese.db`
  with no leading slash, and git matches an unanchored name at every level — so
  it silently excluded `demo-data/diocese.db` as well. The build would have
  produced a site with no content and nothing to say why. It is `/diocese.db`
  now.
- The version-history leak above, which looked clean from every direction
  except SQL.

### What the demo still has in it, on purpose

The **sample mass timings**. They are invented, and the site says so wherever
they appear — a banner on the parish pages and a note in the finder. Clearing
them (`npm run timings:sample clear`) would leave the parish finder, which is
the most substantial thing here, with nothing to demonstrate. The trade is
deliberate: labelled sample data on a page nobody can find by searching. Before
anything real is launched, they go.

The **archdiocesan office address, telephone and email** also remain. Those the
old site published on its own contact page.

## Going to production

1. Install `@payloadcms/db-postgres` and swap the export in `src/db.ts` — the
   file has the replacement code in a comment. Nothing else changes.
2. Set `DATABASE_URI`, `PAYLOAD_SECRET` and `NEXT_PUBLIC_SERVER_URL`.
   **`NEXT_PUBLIC_SERVER_URL` is not cosmetic:** the sitemap, robots.txt and
   all the JSON-LD emit absolute URLs built from it, so leaving it at
   `localhost:3000` would publish a sitemap full of localhost links. It is the
   only place the domain is configured (`src/lib/site.ts`).
3. Move uploads off local disk to S3 or similar (`@payloadcms/storage-s3`).
   **Two directories now**: `media/` (images) and `documents/` (the PDF forms).
4. Add an email adapter — Payload currently logs emails to the console, which
   is why contact form submissions are stored rather than sent.
5. Add a captcha or edge rate limiting in front of the contact form.
6. Redirects already ship in `redirects.generated.json`; regenerate with
   `npm run wp:report` if the content model changes. Hand-written overrides in
   `redirects.overrides.ts` are applied first and survive regeneration.
7. Delete the seeded `admin@example.com` / `changeme123` account.
8. Submit `/sitemap.xml` to Google Search Console after cutover, so the ~274
   old URLs are recrawled and their redirects followed.
9. Consider a real search index. `/search` currently cannot see page body text
   — see the search section above.

## Migrating the old content

Four steps, each a separate npm script so the mapping can be refined without
re-downloading anything:

| Command                 | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `npm run wp:fetch`      | Caches pages/posts/media into `.migration/` (resumable)    |
| `npm run wp:fetch-events` | Scrapes the events (they are not in the REST API)        |
| `npm run wp:probe-stubs` | Checks what the empty-looking pages really contain       |
| `npm run deaneries:apply` | Writes the six real deaneries; clears fabricated ones   |
| `npm run appointments:apply` | Writes parish assignments from the 2026 letter       |
| `npm run parishes:apply` | Creates the 53 parishes from the letter; clears placeholders |
| `npm run wp:report`     | Dry run: what would be imported/skipped + redirect map    |
| `npm run wp:import:dry` | Dry run against the database, no writes                   |
| `npm run wp:import`     | The real import (idempotent, safe to re-run)              |
| `npm run wp:prune`      | Removes imported records the current rules no longer want  |

`scripts/wp-classify.mjs` holds the rules and is shared by the report and the
import, so the dry run always describes what the import will actually do.

### What came across

| Result | Count |
| ------ | ----- |
| Clergy profiles | 47 |
| Parishes | 3 merged into existing records |
| Content pages | 31 |
| Elementor stubs (flagged for review) | 14 |
| News articles | 11 |
| Categories | 8 |
| Events | 199 |
| Media files imported | 124 |
| Skipped (plugin pages, tests, junk) | 35 |
| 301 redirects generated | 270 |

### Quirks of the old site, all found the hard way

- **Response size ceiling.** Anything over roughly 20KB returns HTTP 200 with an
  *empty body*. `per_page=100` silently returned short pages — real data loss.
  The fetcher uses `per_page=20` and verifies every page against
  `x-wp-total`.
- **Rate limiting.** Sustained parallel requests fail at the network level in
  clusters. The fetcher is slow, near-serial and resumable.
- **Leaked theme HTML.** Some REST responses emit sidebar widget markup *before*
  the JSON. Everything before the first `{` or `[` is stripped.
- **Elementor content is invisible to the API.** Elementor stores layout in the
  `_elementor_data` post meta, which WordPress does not expose, so
  `content.rendered` is empty for 14 pages that clearly have content on screen.
  They are imported as stubs flagged `needsReview`, with the legacy URL kept, so
  an editor can rebuild them and Google keeps a redirect target.
- **Inline images need two attributes to survive.** `convertHTMLToLexical`
  turns `<img>` into a Lexical *upload node*, and it reads
  `data-lexical-upload-relation-to` and `data-lexical-upload-id` to decide what
  that node points at. Without them it emits a *pending* node that fails
  validation. The importer downloads each image into the media library and
  stamps those attributes on (`markImage` in `scripts/wp-html.mjs`).
  One further catch: the converter reads the id as a **string**, but this
  database uses numeric ids, so `normalizeUploadNodes` coerces them back or
  every image fails with "not a valid upload ID".
  **All 124 inline images are imported** and served from the local media
  library, so nothing depends on the old server staying up.
- **Broken media references.** Six featured images point at attachments that
  return 404, and one returns 401. That is bad data on the old site, not a
  fetch failure.

- **Near-duplicate pages are flagged, never auto-deduped.** The old site has
  `fr-a-amal-raj` / `fr-a-amal-raj-2` (identical) but also `others` /
  `others-2` and `cbci-links` / `cbci-links-2`, where the *base* page is the
  empty Elementor stub and the "-2" holds the real content. A naive "drop the
  -2" rule would have deleted the good copy, so all four are flagged
  `needsReview` with a note naming the counterpart.

### Events had to be scraped, not fetched

The events live in the `ai1ec_event` post type (All-in-One Event Calendar),
which is **not** exposed over REST. `/wp/v2/tribe_events` — the one that *is*
exposed — belongs to a second, unused calendar plugin and is empty. The RSS
feed (`?post_type=ai1ec_event&feed=rss2`) returns only the 10 most recent and
ignores `paged`.

There are **200** of them, not the ~60 a first look at the sitemap suggested.

`npm run wp:fetch-events` takes the URL list from
`wp-sitemap-posts-ai1ec_event-1.xml` and scrapes each page. That is worth doing
rather than parsing "January 27, 2025 – February 4, 2025" by hand, because the
plugin leaves machine-readable datetimes in hidden divs:

```html
<div class="ai1ec-hidden dt-start">2022-05-01T00:00:00+00:00</div>
```

**All-day dates are read from the string, not the instant.** Those offsets are
wildly inconsistent — `+00:00`, `-01:00` and `+07:00` all appear across the 200
records — so converting to an instant would shift some dates by a day. For
all-day entries the importer takes the date part verbatim and pins it to UTC
midnight, and `src/lib/events.ts` formats all-day events in UTC to match.
Verified: all 199 imported events render the same date the old site displayed.

These events carry **no body text** — confirmed against both the rendered pages
and the RSS `content:encoded`, which contain only the When/Where block. They
are diary entries, so title, date and location is the whole record.

Old event URLs were singular (`/event/foo`) and are plural here
(`/events/foo`), so all 200 have redirects.

### Parish records: 56, built from the letter alone

`npm run parishes:apply` creates a parish for each of the **53 places** the 2026
letter names, and links their priests: 23 have a parish priest, 26 have
assistants. Three dedications the letter itself supplies as "Place -
Dedication" are kept in `patron` (George Town → Assumption, Royapuram → Mater
Dol, Vepery → St Joseph's). "Santhome" is recognised as the existing cathedral
rather than duplicated.

**A parish is named after its place, which is provisional.** "Adyar" is
accurate — it is the Adyar parish — but the dedication ("St Antony's Church")
has to come from the curia.

**An approach I tried and rejected.** The old clergy profiles carry postal
addresses, several naming a church, so mining them for parish names looked
promising. Two things killed it:

1. **They are stale.** Fr Antony Doss's stored address is a church in
   Villivakkam while the letter posts him to Chintadripet. He moved, so an
   address does not identify a priest's current parish.
2. **Place-name matching is unsafe.** "Avadi" matched a *Villivakkam* address
   because the street is "Oth-avadi" Street. Six candidates came out of it and
   at least one was provably wrong, so none were used.

### Placeholder mass timings have been removed

The seed had invented mass times and coordinates for four parishes to exercise
the finder. Those are gone. **A wrong mass time is the most harmful thing this
site could publish** — somebody could arrive for a mass that does not exist —
so it goes the same way the fabricated deaneries did, along with the seed's
round-robin parish-priest links on the three parishes the letter does not name.

Parishes therefore show "Timings have not been published for this parish yet"
and the map has no pins. The finder is built and tested; it fills in the moment
real timings are entered. Nothing on the site is invented any more: where a
detail has not been published, the field is empty.

Two names were also tidied on import: `St Mark's Catholic Church . . .` lost its
filler dots, and `St. Louis Church புனித லூயிஸ் ஆலயம்` was split so the Tamil
name sits in the `ta` locale where it belongs — the first piece of real
localized content on the site.

### Parish assignments come from the 2026 appointments letter

The same letter carries the current appointments, and `npm run appointments:apply`
writes them from `scripts/data/appointments-2026.json`:

| Section | Entries |
| ------- | ------- |
| Parish Priests | 28 |
| Assistant Parish Priests | 33 |
| Special Ministries | 12 |
| Higher Studies | 2 |
| On Leave | 3 |
| Retirement | 1 |

That is **69 named priests**. Nine appointments name a religious congregation
rather than a person (SCJ, SDM, MMI, IVD, Guanellian, "Religious") and are never
turned into clergy records.

Result: 7 existing records updated, **58 created**, 4 held back (below). The
directory went from 46 priests to 104, because the old website only ever
published profiles for priests A–H — roughly a third of the presbyterate.
`currentAssignment` is now "Parish Priest, Adyar" rather than a generic
"Diocesan Parish Priest", and `status` reflects retirement, leave and higher
studies. A new `onLeave` status exists because the letter distinguishes leave
from study, and "away" would have misdescribed it.

**Name matching, and why it is deliberately cautious.** The letter and the old
website disagree on spellings, so names are compared on their sorted word
tokens. Four entries looked like existing records under a different spelling and
were **not** created — they are reported for a human instead:

```
Arockia Velankanni Stalin  ~  existing "Arokia Velankanni Stalin"
L Charles Anandaraj        ~  existing "Charles Anandaraj F"
L Albert Jude              ~  existing "Albert Jude J"
J Edward Antony Raj        ~  existing "Edward Raj S"
```

Only real name parts count as evidence; initials are ignored. An earlier
version counted them and paired "G J Jasper" with "Anthonysamy G J", and
"S Alexraj" with "Balraj S" — different priests in both cases. The last of the
four above is probably also a false positive, but declining to create is the
safe direction: the failure mode is "ask a human", never "invent a duplicate".

> Every record written from this letter is flagged `needsReview` with the
> reference number, because the names were transcribed by reading a scan. The
> 58 created records contain only what the letter states — name, assignment,
> status — and have no photo, biography or contact details.

### Deaneries are real; deanery *assignments* are deliberately empty

The seed originally invented three deaneries (lifted from three near-empty blog
posts) and then assigned every priest and parish to one of them round-robin.
That put fabricated information on a diocesan website while looking
authoritative, which is worse than showing nothing.

The real source is the **Change of Assignments & Appointments 2026** letter
(ref ADMM/ASN/01/2026, 1 May 2026, signed by Archbishop George Antonysamy),
linked from the old site as `2026-TRANSFER-LIST.pdf`. Section VII, *Vicars
Forane*, settles it — there are **six** deaneries, not three, and "Our Lady of
Lourdes" (one of the seeded three) is not among them:

| Deanery | Seat | Dean |
| ------- | ---- | ---- |
| St Thomas, the Apostle | Santhome | Rev Fr E Arulappa |
| St John the Baptist | Nungambakkam | Rev Fr D F Don Bosco |
| the Sacred Heart of Jesus | Egmore | Rev Fr Peter Jerald |
| St Jude | Minjur | Rev Fr N Sekar |
| St Antony | Guindy | Rev Fr J Joseph Arockia Jayakumar |
| St Theresa of Child Jesus | Thiruvottiyur | Rev Fr M V Jacob |

`npm run deaneries:apply` writes these from
`scripts/data/deaneries-2026.json`, deletes any deanery the letter does not
list, and **clears the fabricated deanery from every priest and parish**,
flagging each record.

**Why the assignments stay empty.** The letter gives parish → priest, and
deanery → dean + seat. It does not give parish → deanery, so a priest's deanery
is not derivable from anything published. Guessing it would recreate the
problem this change fixes. The deanery filters on `/clergy` and `/parishes` are
hidden until real assignments exist, so they cannot read as broken.

Only one dean links to a clergy record (Fr E Arulappa). The rest are stored as
`deanName` text, because the old website only ever published profiles for
priests A–H. Note the matcher compares sorted name tokens and correctly did
*not* confuse "Rev Fr D F Don Bosco" with our "Bosco Y F" — different priests.

> The PDF is a scan with no text layer, so these six entries were transcribed
> by reading the rendered pages, not by OCR. Worth re-checking against the
> original before launch.

### Near-duplicates: resolved by comparison, not by rule

Four records were near-duplicates. A "drop the -2 copy" rule would have been
destructive, because in each pair the *base* slug is the empty navigation
shortcut and the "-N" copy holds the real content.

| Serves the content | Content taken from | Redirects to it |
| ------------------ | ------------------ | --------------- |
| `/others` | `others-3` | `/others-2`, `/others-3` |
| `/cbci-links` | `cbci-links-2` (42KB) | `/cbci-links-2` |
| `/clergy/a-amal-raj` | existing record | `/fr-a-amal-raj-2` |

How `others-3` beat `others-2`: identical text, 24 links each, differing in
exactly one URL — `-2` points at thecatholicuniverse.com, `-3` at
universecatholicweekly.co.uk. Same publication after a rebrand, so `-3` is the
later correction. (Both are unreachable today, which is noted on the page.)
`fr-a-amal-raj` and `fr-a-amal-raj-2` are identical once tags are stripped:
the same priest entered twice.

The decisions and their evidence live in `DUPLICATE_OF` / `CONTENT_SOURCE` in
`scripts/wp-classify.mjs`, so the report, the import and the redirect map all
agree and the reasoning survives.

**Resource tables become proper lists.** Those two pages are two-column tables
of "organisation name | VIEW link". Lexical drops table structure, which
separated every name from its link, so `linkifyTwoColumnTables` in
`scripts/wp-html.mjs` rewrites each row into a list item with the name as the
link text. Both halves come from the row — nothing is invented — and a table is
only rewritten when *every* row matches the pattern.

### The "Elementor stub" pages were not content pages at all

Fourteen pages returned empty `content.rendered`, and the first conclusion was
that Elementor held their layout in `_elementor_data` post meta and the content
would have to be retyped. **That was wrong**, and `npm run wp:probe-stubs`
proved it by scraping the live pages.

Getting a straight answer needed care, because the site's header *and footer*
are themselves Elementor templates: counting `elementor-section` finds the
header, and the longest piece of prose on `/the-bible/` is a footer widget, not
page copy. Taking only the region between `</header>` and `<footer` shows what
the page itself contains — for `/the-bible/` that is 9 characters (its own
title), no images, and one link.

So these were **navigation shortcuts**, not pages:

| Outcome | Count | Treatment |
| ------- | ----- | --------- |
| Link to an external resource | 7 | `externalUrl` set; the page renders a "published on another website" card |
| Link that is already broken on the old site | 3 | Flagged for review; the dead URL is **not** carried across |
| Dead daily-content widget ("No thoughts to display") | 3 | Flagged for review |
| The old event-calendar widget | 1 | `/calendar` redirects to `/events` |

The seven live ones point at vatican.va (Bible, Catechism, Canon Law),
vaticannews.va, and cbci.in (documents, reflections, Christian unity). Their
URLs are kept so existing links and search results still work, and the page
says plainly that the resource lives elsewhere rather than silently bouncing
the visitor off-site.

Nothing had to be retyped, because there was never any text to retype.

### Clergy pages are parsed, not just copied

The old priest pages are a structured record dressed up as prose:

```html
<strong>Mobile</strong><br><span>9566145337</span>
```

The importer parses those labels into real fields — assignment, ordination
date, date of birth, phone, email, address — and **removes the contact rows
from the biography text**. Two reasons:

1. The data becomes usable: ordination dates sort, phone numbers are searchable.
2. Dumping personal contact details into public rich text would have defeated
   the `contactPublic` checkbox this collection defines. Contact details are
   imported with `contactPublic: false`, so they are stored for the curia but
   hidden from the public site until someone ticks the box.

`contactVisible` in `src/access/roles.ts` enforces that at **field level**, not
just in the page template — `clergy` is publicly readable, so without it
`/api/clergy` would hand every priest's mobile number to anyone who asked.

The single inline portrait on each page is promoted to the `photo` field and
removed from the biography, so the same picture is not rendered twice.

### Redirects

`npm run wp:report` writes `redirects.generated.json`, which `next.config.ts`
imports and serves. Sources are written **without** a trailing slash — Next.js
normalises the slash before matching redirects, so `/fr-x/` would never match.

## Search, sitemap and structured data

### Search is deliberately narrow, and says so

`/search` covers titles, names, assignments and place names across parishes,
clergy, pages, news and the calendar. It does **not** search the body text of
pages, and the page tells the visitor that rather than quietly returning
nothing.

The reason is that rich text is stored as Lexical JSON. Running SQL `LIKE` over
that JSON matches node types and field names as readily as words somebody
typed, so it produces confident nonsense. Doing it properly needs a real index
— a search plugin, or Postgres full-text once the database moves — which is a
production task.

### The search box strips `%` and `_`, and that is not paranoia

Payload's `like` operator drops the value straight into a SQL `LIKE` pattern.
The adapter's own code is:

```js
val.split(' ').map((word) => ilike(column, `%${word}%`))
```

So `%` typed by a visitor is a wildcard, not a character, and a search for `%`
would match every row in the collection. This is the same trap that once
matched — and deleted — all four parishes in this database from a
`contains: '%'` filter. `sanitizeQuery()` in `src/lib/search.ts` strips both
wildcards rather than escaping them, because Payload offers no way to add a
`LIKE ... ESCAPE` clause.

Two consequences worth knowing:

- A multi-word query ANDs the words **within one field**. "Antony Adyar" finds
  a parish whose name contains both words, not a parish called Antony in the
  area of Adyar.
- `/search` is `noindex` and disallowed in robots.txt. Result pages are thin
  content and infinite in number.

### `sitemap.ts` and `robots.ts` must sit in `src/app`, not in `(frontend)`

Both are at the app root, and they have to be. A `sitemap.ts` inside the
`(frontend)` route group does work, but a `robots.ts` inside it **does not** —
`/robots.txt` gets swallowed by the `[locale]` dynamic segment and returns a
404, with nothing in the log to explain why. Keeping the pair at the app root
avoids the asymmetry. Neither needs a root layout; they are route handlers, not
pages.

The sitemap lists each page once with its Tamil twin as an `alternates` entry —
407 URLs — rather than emitting two sitemaps that read as duplicate content.

### Structured data states only what is known

Every builder in `src/lib/structured-data.ts` drops empty properties, so a
parish with no published address emits a `Church` with a name and a URL and
nothing more. Markup that overstates what the site knows is the machine-readable
version of inventing an address, and Google penalises structured data that
disagrees with the visible page.

Two details that are easy to get wrong:

- All-day events emit a **date** (`2025-01-27`), not a timestamp, and the date
  parts are read in UTC. Reading them in India time moves every all-day event
  to the previous day.
- Clergy email and telephone appear only when `contactPublic` is ticked,
  matching the field-level access control. JSON-LD is public text like anything
  else on the page.

## The public site must pass `overrideAccess: false`

Payload's Local API **skips access control by default**. Every `payload.find`
in a page therefore has to pass `overrideAccess: false`, or the `publishedOrStaff`
rule never runs and the site serves drafts.

It was doing exactly that: after ten news posts were unpublished they carried on
rendering on `/news`, because nothing asked Payload to apply the rule. All 17
queries in `src/app/(frontend)/` now pass it, and the reason is recorded on
`publishedOrStaff` in `src/access/roles.ts`.

Scripts under `scripts/` deliberately do not pass it — they are meant to see
everything.

## Ten of the eleven news posts were not the archdiocese's

`npm run posts:quarantine` unpublishes them. Six were the WordPress theme's demo
content, never removed after the old site was built. That is not a judgement
call:

- `church-urges-government-to-address-poverty` is titled "'The Gospel According
  to Satan' Releases Today" and its body is a book announcement for "Midwestern
  Seminary's author in residence, Jared C. Wilson" from "Thomas Nelson". A
  Catholic archdiocese did not write a Baptist seminary's book promotion.
- The slugs and titles disagree — `objectively-create-quality-bandwidth`,
  `join-us-as-we-celebrate-baptism` — which is the signature of a demo import
  over placeholder slugs.
- All six are dated 2019-11-14 and 2020-01-24, in two batches minutes apart,
  well before any real content on the site (2022 onwards).
- One of them teaches Keswick theology, which is not Catholic doctrine.

Four more were empty: a "welcome" post whose title was its own slug, and three
deanery posts that were headings with no body.

They are **unpublished, not deleted**. The record of what the old site carried
is worth keeping, the decision is the archdiocese's to reverse, and each draft
holds the reason in `legacy.reviewNote`.

Their old URLs are handled in `redirects.overrides.ts`, which is applied
*before* the generated redirect map. Without it, `/the-dog-likeness-of-christ`
would 301 to a page that now 404s — a permanent redirect into a dead end. They
go to `/news` instead, with a 302, because the archdiocese may yet write real
content at those addresses.

That leaves **one** published news post, which is the honest state of the
archdiocese's news archive.

## Look and feel

### The palette had to be invented, and that is stated rather than hidden

The old website looked like it had brand colours. It did not — every colour in
its markup belongs to somebody else:

| Colour | What it actually is |
| --- | --- |
| `#e1624b` | the default accent of the Post Carousel plugin |
| `#6EC1E4`, `#61CE70` | Elementor's factory palette, never customised |
| `#f78da7`, `#cf2e2e`, `#7bdcb5` … | the stock WordPress block palette |

So the palette in `globals.css` is a deliberate design choice, anchored on the
one piece of real identity the archdiocese has: **its seal**, downloaded from
the old site to `public/brand/seal.png`. Navy because that is the seal's ink,
gold because it is the traditional livery of a Catholic see, warm parchment
because the seal is a document. Six darkened liturgical accents give each
homepage card its own colour.

Every colour pair on the homepage was measured against WCAG AA and passes — the
lowest is the gold section heading on cream, at 4.99:1.

Two things broke while making the chrome navy, both worth remembering:

- **The language switcher** still carried `text-slate-900`, invisible on navy.
  Dark-on-dark does not announce itself; it has to be looked for after any
  change of background.
- **The search input had no background at all.** Tailwind's preflight resets
  form controls to `background-color: transparent`, so the field took the navy
  behind it and its dark placeholder text vanished. Both variants now set a
  background explicitly.

### The seal is knocked out with a filter, not a second file

The seal is dark line art on a transparent background, so it needs to be white
on the navy header and footer. `.seal-knockout` uses
`filter: brightness(0) invert(1)`, which drives every visible pixel to white
and leaves the alpha channel alone. A plain `invert(1)` would turn the
transparent surround into an opaque white block.

The old theme did ship an `i-logoimg-w.png` "white logo", but it is a 47×80
blank — an empty placeholder. It is not used.

### Single light theme, on purpose

An earlier scaffold had a `prefers-color-scheme: dark` block containing a bare
`body { background }` rule, which overrode the utility classes and rendered the
whole site dark-on-dark. Rather than reintroduce that risk for a site nobody
asked to be dark, this commits to one warm light palette.

## Verse of the day

One verse, chosen by the date, the same for every visitor all day, turning over
at midnight **in Chennai** — `src/lib/verse.ts` derives the day number in
`Asia/Kolkata`, because a UTC-based day would change the verse at half past
five in the morning. It is deliberately not random: a random verse would differ
between two visitors at the same moment, and would defeat the page cache and
cause a hydration mismatch.

**It is not the lectionary, and does not claim to be.** Working out today's Mass
readings needs the liturgical calendar, the three-year Sunday cycle and the
two-year weekday cycle; getting that wrong on a diocesan website would be a
real error. The panel is labelled "verse of the day" and says as much
underneath.

The verses live in a collection (Content → Verse of the day) rather than coming
from a Bible API, for three reasons: the archdiocese would otherwise be
publishing scripture it had not chosen, in a translation it had not approved;
most modern translations (NRSV, NABRE, RSV-CE, the Jerusalem Bible) are under
copyright and need a licence; and the old site's own "Verse of the Day" and
"Daily Readings" pages were both dead third-party widgets by the time it was
migrated — exactly the failure an external dependency invites.

`npm run homepage:seed` adds 18 verses in the **World English Bible**, which is
public domain. **All 18 are flagged `needsReview`**: a website that misquotes
scripture is worse than one with no verse at all, so the wording should be
checked against a printed copy. The `translation` field on each record exists so
the archdiocese can swap in its own approved translation and still say where its
scripture comes from.

## The homepage carousel

Configured under Settings → Homepage, with no code changes:

| Setting | Effect |
| --- | --- |
| Show the carousel | Hides the whole band |
| How many slides to show | Takes the first N of the list, so slides can be kept ready without publishing them |
| Slides visible at once | One, two or three side by side. Narrow screens always show one |
| Advance every (seconds) | 0 turns autoplay off and leaves the arrows |

Hand-rolled rather than a library: the wanted behaviour is small, and the
libraries that do it well are 30–50kB of JavaScript on the most-visited page of
the site. What they mostly add is momentum-scrolling physics, which the CSS
scroll-snap track already provides — including native swiping on a phone, which
matters most here.

Autoplay stops on hover, on focus, and when the tab is hidden, and never starts
for a visitor who has asked for reduced motion. Slides scrolled out of view are
hidden from the accessibility tree and taken out of the tab order.

### Three things that were wrong, and are worth remembering

**`behavior: 'auto'` does not mean "instant".** It means "use the CSS
`scroll-behavior`", which here is `smooth`. The carousel's fallback jump was
written with `'auto'` and so failed in exactly the situation it existed to
rescue. The value wanted is `'instant'`.

**A smooth scroll is a request, not a promise.** Some embedded and headless
browsers drop the animation entirely — this one does — and the arrows then
updated the dots while moving nothing, which reads as a broken site. `goTo` now
checks shortly afterwards and sets the position outright if nothing moved.

**`scrollIntoView`, not `scrollTo` with arithmetic.** A child's `offsetLeft` is
measured from its nearest *positioned* ancestor, which here is the wrapper
holding the arrows, not the scroll container. The subtraction happens to come
out right today and would break silently the next time the markup changed.

### Images: real ones only, and big enough

Slides come only from genuinely archdiocesan photographs already in the media
library. The old theme shipped `banner1.jpg`, `home1bg.jpg` and
`church-3481187_1920.jpg` — that last one a Pixabay stock photo, its filename
still carrying the stock ID — and putting those on the front page would repeat
the mistake that left six demo blog posts on the old site for six years.

The seed also enforces a **1000px minimum width**. A 640px photo upscaled into
the full-width 21:9 band was visibly soft and lost two thirds of its height, so
it is skipped and reported rather than published.

## Two configuration traps

**`images.localPatterns` in `next.config.ts` is an allowlist.** Declaring it at
all means anything unmatched is refused outright — with a 500, not a broken
image. Adding the seal under `/brand` broke the entire homepage until that path
was listed alongside `/api/media/file/**`.

**`push: true` is not idempotent.** Registering the Verses collection and the
Homepage global left the schema correct, but made Payload's dev push try to
re-create `payload_locked_documents_rels_order_idx`, which already existed —
and every page then 500'd inside `getPayload`. Dropping that one index (an index
holds no data) cleared it. This is the same `push` fragility the migration
warning above describes, and another reason production must use
`payload migrate:create`.

## Long pages: /about and /history-of-archdiocese

### `prose` was doing nothing at all

Every migrated page rendered its rich text inside `prose prose-slate`. The
plugin those classes come from, `@tailwindcss/typography`, **had never been
installed** — so they styled nothing, while Tailwind's own preflight actively
stripped the formatting underneath it:

```css
/* Tailwind preflight, paraphrased */
h1, h2, h3, h4 { font-size: inherit; font-weight: inherit }
ol, ul         { list-style: none; padding: 0 }
```

Measured on /about before the fix: `<h3>` computed to **16px, weight 400** —
byte for byte the same as body text, so a 36-section page had no visible
structure at all — and `<ol>` to `list-style-type: none; padding-left: 0`, which
is why the numbered lists had no numbers.

Installing the plugin fixed both. `.prose-page` in `globals.css` then tunes it
to the brand through the plugin's own CSS variables rather than by overriding
its selectors, so the plugin keeps control of the vertical rhythm. The migrated
pages use `h3`/`h4` for what are really sections and sub-sections — WordPress
themes reserve `h1`/`h2` for the page title and site name — so those two are
promoted enough to break up a long page, with a hairline rule under each
section.

### Two migration artefacts, fixed in the data

`npm run content:tidy` handles both.

**Justified text.**

The old theme justified 45 paragraphs. Browsers justify without hyphenation,
which opens rivers of white space — on /history-of-archdiocese it stretched
lines like "by an agreement between the Holy Father and the King of Portugal"
right across the measure. It reads worse, and markedly worse for dyslexic
readers.

The alignment is an inline `style="text-align:justify"`, which beats any
stylesheet, so a CSS fix would have needed `!important` — and would then also
override an editor who deliberately justified something later.
The script clears the stored value instead, leaving the admin's alignment
control working normally. The eight **centred** paragraphs are left alone; they
look deliberate.

**Un-decoded HTML entities.** Six text nodes still held a literal `&amp;` —
"Prayer &amp; Preaching Ministry". Stored as text rather than markup, React
escapes it again on the way out, so the page displayed the entity instead of an
ampersand. Only the five standard XML entities and numeric escapes are decoded.

> **The dry run caught a bug worth remembering.** The first pass reported
> identical counts for `en` and `ta` on all four pages — because with
> `fallback: true`, asking for an untranslated Tamil page returns the *English*
> content. Writing that back under `ta` would have created real Tamil records
> full of English text, freezing today's English into the Tamil column and
> silently killing the fallback for every one of those pages. Every script that
> writes localized content must pass **`fallbackLocale: false`**.

### A table of contents, and anchors

Thirteen sections and several thousand words needed a way in. Long pages now
carry a sticky contents list (four headings or more), with the current section
highlighted as you scroll, and every heading gets an `id` so a section can be
linked to directly — `/about#synods`.

The ids are assigned **once**, in `src/lib/toc.ts`, and handed to the renderer
in a Map keyed by the heading node itself. Deriving them from the heading text
in two places would work only while no two headings share text — true today,
and a silent breakage the day somebody adds a second "Overview".

The contents list is a client component only for the highlighting; the links
are plain anchors and work without JavaScript. Highlighting is computed from
"the last heading above the top of the viewport" rather than from
IntersectionObserver alone, because several headings can be on screen at once
and none is on screen in the middle of a long section.

## /archbishop: rebuilt from the archdiocese's own document

### What was irrecoverable

On the old site this was a plugin tab set. Flattened to HTML it became one
283-block page holding five unrelated things end to end — and two of them had
lost their **pairing**: every photograph and name came first, then every
biography afterwards, so nothing connected a bishop to his own dates. The
conference officers had gone the same way.

Rendering cannot fix that. The association is simply not in the migrated
document any more. It had to come from a source that still had it, and the
archdiocese supplied one: `Archbishop.docx`, compiled from the old site and put
back in order. `scripts/data/archbishop.json` is the extract, the 20
photographs came with it, and `npm run archbishop:import` loads the lot.

Result: **8 prelates, each with their own photograph and their own dates**, and
15 conference officers likewise.

### Structured data, not prose

`src/globals/ArchbishopPage.ts` models it properly — profile fields, history,
two succession lists, the prelate cards, and four conferences with their
officers — so the pairing is explicit and stays that way. All of it is editable
in the admin, which the flattened prose never really was. The migrated page is
kept as an unpublished draft for reference.

### Tabs, not an eight-screen scroll

`/archbishop` is now five tabs — Profile, Former Prelates of Madras, Former
Prelates of Mylapore, Archbishops of Madras–Mylapore, Conferences — with the
four conferences as nested tabs inside the last one.

`src/components/Tabs.tsx` follows the WAI-ARIA tabs pattern: arrow keys move
between tabs, Home and End jump to the ends, and only the selected tab is in
the tab order so Tab moves into the panel rather than through every tab.

**Every panel is rendered into the DOM and hidden with the `hidden`
attribute**, not mounted on demand. That costs a little markup and buys three
things: search engines index all of it, in-page Ctrl+F still finds anything a
visitor remembers seeing, and there is no flash of nothing when a tab is
clicked.

### One thing for the curia to settle

The document keeps the old site's tab labels, which put the **1606–1951**
Portuguese padroado bishops under "Former Prelates of *Madras*" and the
**1832–1952** bishops under "*Mylapore*". The archdiocese's own history page
contradicts that in three places:

- "The old Diocese of Mylapore was erected by Pope Paul V on 9th January 1606"
- "the Vicariate Apostolic of Madras was created on 14th July 1832"
- "The last padroado Bishop of Mylapore, His Excellency Dom MM Guerreiro" — who
  is the last entry in the *first* list

The first list is also entirely Portuguese padroado names, the second Irish and
British ones ending with Louis Mathias, who became the first Archbishop of
Madras–Mylapore.

The document is followed because it is what the archdiocese supplied. If the
curia confirms the history page, swapping the labels is one edit to the `group`
value on those rows in the admin — no code change.

## The rich-text shape recovery (still used elsewhere)

On the old site this was a WonderPlugin tab set. Flattening it to HTML threw
away the tabs and left **one 283-block page** containing four unrelated things
end to end, with the tab labels stranded as a bullet list at the top. Ninety of
those blocks were `h4` elements whose text was a label and its value jammed
together, so the page read:

```
PHONE
044-24 64 11 02, 24 64 08 33
FAX
044 - 24 64 19 99
```

— ninety pseudo-headings in a row, no alignment, and a ninety-entry contents
list.

### Recovering the shapes instead of re-typing them

The mess is perfectly regular, so `src/lib/rich-text-shapes.ts` recognises it
and `PageBody` renders it properly. Nothing is re-typed and nothing is migrated:

| Shape | Recognised by | Rendered as |
| --- | --- | --- |
| **Field row** | a heading whose children are `[text][linebreak][text]…` | a definition list, label left, value right — 81 of them |
| **Succession row** | a name paragraph followed by a paragraph holding only a year or range | a two-column list — 34 prelates, 1606 onwards |
| **Prose heading** | a "heading" longer than 70 characters | a paragraph, because that is what it is |
| **Field divider** | a rule between two field rows | dropped; each row draws its own |
| **Continuation** | a paragraph directly after a field row | aligned under the value column |

The 70-character rule deserves a note: the whole HISTORY section was nine `h4`
elements each holding a full paragraph, one of them 411 characters long. Left
as headings they gave the page nine fake sections and filled the contents list
with half-sentences. The longest genuine heading on these pages is 53
characters, the shortest offender 82, so the threshold is not finely balanced.

Everything is keyed by the node object itself, so the renderer's lookup cannot
disagree with the analysis — the same trick the heading ids use.

### Restoring the categories

`npm run archbishop:restructure` turns the stranded tab labels back into real
headings at the points where their content begins, and removes what should
never have survived: a dead Timely calendar widget ("There are no upcoming
events to display at this time", plus "Add to Google / Outlook / Apple
Calendar" links that go nowhere) and the tab plugin's own "WordPress Tabs"
credit line, twice.

The section boundaries were **read off the content, not guessed**:

- the first succession list runs 1606–1951 and ends with Dom Manuel de Medeiros
  Guerreiro — that is **Mylapore**, whose diocese was erected in 1606 and whose
  last padroado bishop he was, as the history page independently says;
- the second runs 1832–1952 from Dom John bede Polding — that is **Madras**,
  whose vicariate was created in 1832;
- the list after them opens with Louis Mathias as "First Archbishop 1952", so it
  is the **Archdiocese of Madras–Mylapore**.

The script refuses to run if it cannot find all three, rather than inserting
headings at the wrong places.

Result: a contents list of 11 real sections instead of 96, and 11 headings on
the page instead of 96.

### Two bugs found on the way

**`<hr>` inside `<p>` was breaking hydration.** 76 paragraphs on this page
contain a horizontal rule. A browser closes the paragraph early when it meets
one, so the server and client disagreed about the shape of the tree and React
threw a hydration error on every load — before this work, too. Those paragraphs
now render in a `div`, which holds the same content and is valid.

**`/administration` was serving a 404.** The proxy matcher excluded
`admin|api|_next|media` as *prefixes* rather than as whole path segments, so a
real published page whose slug merely began with "admin" never reached the
locale rewrite. Each name now carries a `(?:/|$)` boundary. Any future page
with a slug starting "api" or "media" would have hit the same wall.

## Downloads: /forms, and the files the old site still owned

`npm run documents:import` converts the forms page from migrated prose into
real records. Two problems it solves, one of them invisible.

**The visible one.** /forms arrived from WordPress as alternating paragraphs —
a title, then a paragraph containing only a link labelled "Downloard" (the typo
is the old site's). Rendered as prose that is a wall of twenty-four lines with
no spacing, nothing saying what any file is, and no way to tell which of the
two Pre-Nuptial forms is the Tamil one. It is now a card grid: file icon,
title, `PDF · 152 KB`, a download arrow, and a Tamil badge where it applies.

**The invisible one.** Every link pointed into the old site's uploads folder.
The day that site is switched off, every form the archdiocese offers 404s — and
nobody would notice until someone needed a baptism extract. All twelve files
are now downloaded into a `Documents` collection and served from this site.

### Why a separate collection from Media

Media is an image collection: it generates three resized copies of everything
and requires `alt` text, neither of which means anything for a PDF. Documents
carry what a download actually needs — a title, a description, and a language,
since several forms exist in both English and Tamil.

Pages gained a `documents` field, so any page can offer downloads and an editor
can reorder them by dragging.

### The conversion is conservative

It only matches an exact shape: a plain-text paragraph followed by a paragraph
whose **only** content is a link to a file. A sentence with a link in the middle
of it is prose and is left alone. A file that cannot be fetched keeps its
original paragraphs, so the page still links to it rather than losing it
silently. Re-running is safe — documents are matched on their original URL.

It also drops a leftover paragraph that merely repeats the page's own title.
WordPress pages habitually restate their heading in the body; invisible while
the body was a wall of links, glaring once the page became short — /forms showed
"FORMS" as its heading and "FORMS" again directly beneath.

### What is deliberately not converted

`news-letter-2` and `fcra-report` are document libraries too — 86 and 34 file
links — but grouped by year and quarter, several links to a paragraph, having
once been tabbed Elementor widgets. They need grouping by year to be usable at
all, which is a different model from this flat one. Half-converting them would
be worse than leaving them.

### One thing to remember at cutover

Uploads now live in **two** directories, `media/` and `documents/`. The move to
S3 has to cover both.

## Parish locations, from OpenStreetMap

`npm run parishes:geocode` places **40 of the 56 parishes** on the map, at two
declared levels of precision:

| Precision | Count | What it means |
| --- | --- | --- |
| `church` | 5 | An actual place of worship matched by name |
| `locality` | 35 | The centre of the locality. Accurate to a few hundred metres — fine for sorting by distance, not the church door |
| *(none)* | 16 | No confident match. Left empty rather than guessed |

Coordinates were empty until now because the only alternative was inventing
them. This does not invent them: it records **which OSM object it matched**, on
the record, so the answer can be checked. It is still not authoritative — OSM
is crowd-sourced and the archdiocese has published none of this — so every
value is flagged for review, and the parish page prints the caveat in both
languages whenever the precision is `locality`.

### Why only five churches

Asking OpenStreetMap for every Catholic church in the archdiocese returns about
thirty. Several are mis-tagged (a CSI church tagged `denomination=catholic`),
and **seven belong to the Syro-Malabar eparchy** rather than to Madras-Mylapore
— Catholic, but a different Church *sui iuris*, so pinning a Latin-rite parish
to one would be wrong. Three did match on the first run and are now excluded by
name and by denomination tag.

There is simply not enough data to put 56 parishes on their own doorsteps.

### Four filters that stop it writing nonsense

1. **Only `place_of_worship` counts as a church match.** "Little Mount,
   Chennai" returns a railway station, "Adyar" a river, "Porur" a lake.
2. **Syro-Malabar and Syro-Malankara are rejected** (see above).
3. **Protestant and non-Christian results are rejected**, by OSM's religion and
   denomination tags or, failing those, by name.
4. **Everything must fall inside the archdiocese's bounding box**, and nothing
   already on the record is overwritten.

Aliases are used only where a church is a checkable landmark under another name
(Santhome Basilica, Luz Church, the Velankanni shrine at Besant Nagar). An
earlier version guessed dedications to search for — "Sacred Heart Church,
Egmore" — which risks matching a real but *wrong* church; those were removed.

### Three lookup quirks worth knowing

- **`bounded=1` was a mistake.** Restricting results to the bounding box turned
  two thirds of the searches into "no results". Biasing with `viewbox` and
  filtering the answers here works far better.
- **Chennai's suburbs are often only Corporation zone boundaries.** "Adyar",
  "Royapuram" and "Tondiarpet" each return just `type: administrative` named
  "Zone 13 Adyar". Those are accepted, guarded by requiring the place name to
  appear in the boundary's own name.
- **`featureType=settlement` is what finds the towns.** A plain search for
  "Avadi, Chennai" ranks four stretches of Avadi Road above the town of Avadi,
  and "Minjur" returns its ESI hospital. That one parameter added six parishes.

OSM also names the municipal body rather than the city — a zone match returns
`city: "Chennai Corporation"`, which is nobody's idea of an address — so the
suffix is dropped.

## Sample mass timings

**`npm run timings:sample` writes invented timings, and
`npm run timings:sample clear` removes them. Run the clear command before
launch.**

The site otherwise publishes no invented mass times: a wrong one sends somebody
to a locked church, and the development seed's fabricated timings were
deliberately deleted earlier in this project for that reason. These exist
because a finder with nothing to find cannot be demonstrated or reviewed.

What makes that acceptable is that the data announces itself:

- every parish written by the script gets `timingsAreSample: true`
- the **parish page** prints a warning above the timings table, styled as a
  warning and placed above rather than below — somebody scanning for a mass
  time reads the first thing under the heading and stops
- the **finder** prints the same warning above the results, and only when a
  parish currently on screen is affected
- the **worksheet export leaves them out entirely**. Without that, the curia
  would receive a spreadsheet pre-filled with 391 invented times, reasonably
  assume they came from their own records, and confirm them
- a parish whose timings are *not* flagged as samples is never touched, so real
  timings cannot be overwritten or wiped. Verified both ways: the loader skips
  a parish with real timings, and `clear` removes 55 sample sets while leaving
  a real one intact

### The schedules vary on purpose

Identical timings at 56 parishes would make the finder look like it worked
while testing nothing — every language, day and time-of-day filter would return
the same set. Each parish takes one of five patterns (or a fuller one if it is a
shrine) chosen from a hash of its slug, so it is stable across runs and
different between parishes. The filters now discriminate:

| Filter | Parishes |
| --- | --- |
| Any | 56 |
| English mass | 26 |
| Telugu mass | 15 |
| Malayalam mass | 12 |
| Wednesday | 29 |
| Sunday evening | 41 |

## The curia worksheets

Everything still missing from this site is information only the archdiocese
has: parish dedications, addresses, coordinates, which deanery each parish
belongs to, and above all **mass timings**. None of it can be derived, scraped
or guessed — the old website never published it — and waiting will not produce
it either.

So there is a round trip:

```bash
npm run worksheet:export      # writes ./worksheet/*.csv + HOW-TO-FILL-THIS-IN.md
# ... email the folder to the curia, get it back, drop the files in ./worksheet/
npm run worksheet:import:dry  # report only
npm run worksheet:import
```

Four sheets: parish details, mass timings, four priest names that need
confirming, and one deanery per priest. Each is pre-filled with what the site
already holds and carries reference columns (`ref_*`) naming the row, so a
secretary who has never seen a CMS can work down a spreadsheet instead.
`HOW-TO-FILL-THIS-IN.md` is generated with the live parish count, the real
deanery names and the rules below, so it never goes stale.

### The design decisions that matter

**A blank cell means "no change", not "delete".** The sheets come back pre-
filled, so somebody scrolling past a row must not silently wipe it. To clear a
value deliberately they type a single dash. Getting this backwards would let
one careless save empty the database.

**`worksheet:export` refuses to overwrite an existing file.** A re-run while
the curia is halfway through typing would destroy their work.
`WORKSHEET_FORCE=1` overrides it.

**A bare `6:00` is rejected, not guessed.** It could be the morning mass or the
evening one, and sending somebody to a locked church is the worst thing this
site could do. `6:00 am`, `6 pm`, `6.30am` and `18:30` are all accepted;
anything that could mean two times is refused and reported. `npm run
check:times` asserts 23 cases — including midnight and noon, which catch a
naive 12-hour conversion — by round-tripping each one through the same
`formatTime` the parish pages render with, so the parser and the display
cannot drift apart.

**Coordinates outside Tamil Nadu are rejected.** Latitude and longitude are
easy to type into the wrong columns, and `80.2` is a valid latitude — in
Siberia. A bounding box catches the swap and says so. They are also only
accepted as a pair, since one without the other puts a parish on the equator.

**One bad cell does not block the file.** Every rejection is reported with its
filename and the row number *as the person sees it in their spreadsheet*, and
everything else still applies.

**Re-importing an untouched export is a no-op.** Each field is compared against
what is stored before being counted as a change, so the operator can tell a
real edit from the noise.

**The review flag clears only when a parish is genuinely done** — dedication,
address, and at least one service of kind `mass`. A novena with no Sunday mass
is still incomplete, so the flag stays and the admin panel keeps showing it.

### Reading the returned CSVs

`scripts/lib/csv.ts` is a real RFC 4180 reader and writer, not a comma split.
It has to be: a parish address is `41, Santhome High Road` and a mass note is
`First Friday only, except Lent`. It also writes a **UTF-8 BOM** and CRLF line
endings, because without the BOM Excel on Windows reads the file in the local
codepage, turns Tamil parish names into mojibake, and then saves them back that
way — corrupting the data permanently.

### Name matching lives in one place

`scripts/lib/names.ts` holds `nameKey` and `findNearMatch`, shared by
`appointments:apply`, `parishes:apply` and `worksheet:export`. Three scripts now
decide whether two spellings are the same priest, and if their answers ever
diverge one of them will quietly create a duplicate priest in the directory of
a real diocese.

## The newsletter and the two galleries

Three pages of the old site were migrated as prose and none of the three
worked. They are now real routes reading real collections, and all three are
reachable from a **Media** menu in the header and listed plainly in the footer
— none of them had any navigation before.

### The newsletter: 71 issues were on borrowed time

`/news-letter-2` was the wreckage of a WordPress tab plugin: eight year labels
stranded in a list, then **86 links in a row**, every one of them pointing into
the old site's `wp-content/uploads`. Seven years of *Niraivalvu* lived on a
server that is going to be switched off, and nothing on this site held a copy.

`npm run newsletter:import` reads that page, works out the month each link is
for, downloads the issues and files them in Documents with
`category: 'newsletter'` and an `issueDate`. It takes **this year and last
year** by default, which is what was asked for; `NEWSLETTER_YEARS=2024,2023`
takes any others. **15 issues (53 MB) are now held here** — five of 2026 and
ten of 2025.

Three details worth keeping:

- **The month is parsed from letters and digits separately**, not with one
  pattern. One label on the old page reads `May2 019` — a stray space inside
  the year. Taking the first run of letters as the month and every digit as the
  year reads that correctly and reads the well-formed labels the same way.
- **Every download is checked for `%PDF`.** A WordPress site that has lost a
  file often answers with a styled "not found" page and a `200`, which would
  otherwise be filed away as a newsletter and discovered by a reader clicking
  it.
- **The migrated page is unpublished, not emptied.** It is still the only
  record of the 71 issues not yet downloaded, and the new page links to it
  under "Earlier issues" — a link that dies with the old site, so those years
  must be imported before cutover.

The `issueDate` is stored as **midday UTC on the first of the month**. Midnight
would put a January issue in the previous year for any reader west of
Greenwich, and the year is what the tabs are built from.

### The video gallery: six embeds that became six naked links

Lexical has no iframe node, so the migration turned all six `<iframe>` elements
into links whose text was the embed address — `https://www.youtube.com/embed/
wjHUQfhIEWk?feature=oembed`, six times, nothing playing, and the titles gone
with the iframes' `title` attributes.

`npm run videos:import` reads the ids out of the original WordPress HTML and
asks **YouTube's oEmbed endpoint** for each one. That gives the current title
and the publishing channel, and it proves the video still exists — all six do.
The thumbnail is downloaded into Media at the same time.

Two things that came out of it and are now visible on the page:

- **Three of the six are not the archdiocese's.** They were published by
  *Arputhar Yesu TV*. The channel is stored and shown as a credit, and the
  page's own description says these are recordings of archdiocesan
  celebrations rather than claiming the archdiocese published them.
- **Three titles are camera filenames** — `VID 20200423 WA0005`. Those are the
  archdiocese's own uploads, so only they can say what the videos are; each is
  flagged `legacy.needsReview` with a note. The digits look like a date, but a
  filename is not a statement of one, so they are left undated.

**Nothing is loaded from YouTube until a visitor presses play.** The page is a
still image and a button; the click swaps in an iframe pointed at
`youtube-nocookie.com` with `autoplay=1`. The old page loaded YouTube's player
six times over before a reader had decided to watch anything, and told Google
who was reading the archdiocese's website either way.

### The photo gallery, and a problem that predates the migration

The carousel plugin's markup did not survive, leaving 47 photographs stacked at
full width down one page. `npm run albums:import` walks the page in order —
every heading starts an album, every image after it belongs to that album — and
recovers the five albums that were always there. A sixth heading, `ACADEMIC
YEAR 2022- 2023`, has no photographs under it and is reported rather than
created: it was a label over the section, not an occasion.

Alt text is repaired in the same run. WordPress had none, so the original
importer fell back to the filename and 47 photographs were described to a
screen reader as "20191223143737.0350690". The album title is substituted and
every one is flagged for replacement.

**The photographs are 150 pixels square.** Forty-four of the forty-seven; the
other three are 398. That is not something the migration did — the old site's
own "full size" link points at the same file, and the un-suffixed original
`404`s on that server. Whoever built that page uploaded WordPress thumbnails
rather than photographs, and the originals were never on the website at all.

The gallery is built to say so honestly rather than to hide it: six tiles
across on a wide screen instead of three or four, and a viewer that shows each
photograph at **its own size and never larger**. A full-size photograph
uploaded later fills the screen as you would expect. The originals have to come
from the archdiocese.

### Two bugs found in the browser, not in review

- **The Media menu opened off the side of a phone.** Aligned to the button's
  right edge, which is correct on a laptop where the navigation sits at the
  right of the header — but on a 375px screen the navigation wraps to its own
  row at the left, and 129px of the menu hung past the edge of the display,
  unreachable. It now hangs from the left below `sm`.
- **Only a strip at the edge of the photo viewer closed it.** The click that
  closes was stopped on the box holding the photograph, and that box is as tall
  as the screen — so almost all of the dark area around the photograph did
  nothing. The click is now stopped on the `img` itself.

A third thing looked like a bug and was not: the viewer's backdrop appears
barely dimmed in an automated screenshot. Setting it to an explicit
`rgba(0, 0, 0, 0.9)` looks identical, so it is the capture path failing to
composite a translucent overlay, not the page.

## Still to do on the migrated content

- **4 near-duplicate records** need a human to pick which copy to keep
  (`cbci-links-2`, `others-2`, `others-3`, `clergy/a-amal-raj-2`).
- **6 pages still need a decision** (filter on `legacy.needsReview` in the
  admin): 3 dead daily-content widgets, 1 whose old link was already broken,
  and 2 informational notes on the merged resource pages.
- **Which priests and parishes belong to which deanery.** The deaneries
  themselves are now real (below), but nothing published maps individual
  priests or parishes to them, so those fields are deliberately empty.
- **Check the 4 held-back names** listed below against the original letter, and
  verify the 58 records created from it.
- **Run `npm run timings:sample clear` before launch.** The timings currently on
  the site are invented demonstration data. They are labelled as such
  everywhere they appear, but they must not go live.
- **Parish details.** All 56 parishes exist and are linked to their priests,
  but they need their proper dedication, address and — most importantly —
  **mass timings**, none of which the archdiocese has published.
  `npm run worksheet:export` produces the sheets to ask for all of it; see
  "The curia worksheets" above.
- **Correct the parish coordinates.** 35 of the 40 located parishes are pinned
  to the centre of their locality rather than the church, and 16 are not
  located at all. See "Parish locations" above.
- **3 parishes have no priest linked** because their priest is one of the four
  held-back name variants above.
- **Decide whether clergy contact details should be public.** They were public
  on the old site but are imported hidden; tick "Show contact details" on a
  record to restore that.
- **Have the Tamil interface strings reviewed** (`src/lib/i18n.ts`).
- **Review the Tamil translation of /history-of-archdiocese**, then untick
  "This translation still needs review" on that page. Personal names are the
  most likely thing to need correcting.
- **Translate the remaining content.** Only the history page is translated so
  far; every other page falls back to English in Tamil.
- **Service notes are not localized.** The free-text note on a mass timing
  ("Vigil", "First Friday only") renders as typed in both languages. Localizing
  it means adding `localized: true` to that field inside the `services` array,
  which is a schema change — see the migration warning below.
- **3 imported parishes** need deanery, address, coordinates and mass timings.
- **Every imported event is in the past** (the newest is 27 January 2025).
  `/events` shows an empty "Upcoming" section and the homepage falls back to
  the most recent entries, saying plainly where the calendar ends. Both switch
  over on their own as soon as a future engagement is entered.
- **Write some news.** Only one post survived the review above, so the news
  section is nearly empty — accurately, but it needs real content.
- **Check the 18 seeded verses** against a printed Bible, and decide whether to
  keep the public-domain World English Bible wording or supply the
  archdiocese's own approved translation.
- **Replace the carousel slides.** Both seeded slides are real archdiocesan
  photographs, but one is the Year of Youth 2020 flag — accurate, and six years
  old. Current photographs would be better; the media library holds nothing
  else wide enough for a full-width band.
- **The 71 newsletter issues from 2019 to 2024** are still only on the old
  site. `NEWSLETTER_YEARS=2024,2023,2022,2021,2020,2019 npm run
  newsletter:import` brings them over, and it has to happen before the old
  server is switched off.
- **The original photographs.** The gallery holds 150-pixel thumbnails because
  that is all the old site ever had. Nothing can recover them but the
  archdiocese's own copies.
- **Proper titles for three videos**, which are currently camera filenames, and
  dates for the five photo albums.
- **The FCRA page** is still migrated prose, with 34 file links grouped by year
  — the same shape the newsletter had, and now with a worked example to follow.
- **A mobile menu.** The header navigation wraps onto two rows on a phone
  rather than collapsing behind a button. It works and is readable, but a
  proper menu would give the page its first 200px back.
- The old clergy list is **incomplete at source** — it runs alphabetically from
  "A. Amal Raj" to "Henry Felix A." and stops. The full roster must come from
  the curia.
