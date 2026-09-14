# Filling in the archdiocesan website worksheets

Thank you for doing this. These four files hold the only information the new
website is still missing. Everything else has been taken from the previous
website and from the 2026 appointments letter (ADMM/ASN/01/2026).

Please open them in Excel, Google Sheets or LibreOffice, fill in what you know,
and send them back. **Partial is fine** — whatever comes back gets published,
and the rest can follow later.

## The two rules

1. **Columns whose name starts with `ref_` are for reference only.** They tell
   you which row you are on. Changing them does nothing; deleting them breaks
   the file.

2. **A blank cell means "leave it as it is" — not "delete it".** Cells already
   containing something are showing you what the website holds today. Correct
   them if they are wrong. If something on the site is wrong and there is no
   replacement, put a single dash `-` in the cell to clear it.

Please do not add, remove or rename columns, and do not re-order them.

---

## 1-parishes.csv — one row per parish

There are 56 parishes. Each one currently shows the **place**
name from the appointments letter, because that is all the letter gives.

| Column | What to put |
| --- | --- |
| `name` | The parish's proper name, e.g. "St Antony's Church, Adyar" |
| `dedication` | Who the church is dedicated to, e.g. "St Antony" |
| `deanery` | One of the six names listed below |
| `is_shrine` | `yes` for a shrine or basilica, otherwise `no` |
| `address_line1`, `address_line2`, `city`, `district`, `pincode` | The postal address |
| `latitude`, `longitude` | See "Finding coordinates" below. **Many are already filled in from OpenStreetMap and are only approximate — the centre of the locality, not the church.** Please correct them |
| `phone`, `email` | The parish office, if it has its own |
| `established_year` | Four digits, e.g. `1904`. Leave blank if unsure |

The six deaneries, exactly as the website knows them:

  - Deanery of St Antony (seat: Guindy)
  - Deanery of St John the Baptist (seat: Nungambakkam)
  - Deanery of St Jude (seat: Minjur)
  - Deanery of St Theresa of Child Jesus (seat: Thiruvottiyur)
  - Deanery of St Thomas, the Apostle (seat: Santhome)
  - Deanery of the Sacred Heart of Jesus (seat: Egmore)

### Finding coordinates

Only needed for the map. Open <https://www.openstreetmap.org>, search for the
church, right-click the spot and choose "Show address" — the two numbers appear
in the search box, latitude first. Chennai latitudes are near `13.0` and
longitudes near `80.2`. If in doubt leave both blank; a wrong pin is worse
than no pin.

---

## 2-mass-timings.csv — the most important file

**This is the thing people come to the website for.** The site currently says
"Timings have not been published for this parish yet" on every parish, because
publishing a guessed mass time could send somebody to a church at the wrong
hour. Nothing here has been invented.

There is one blank row per parish. **Copy the row down** as many times as that
parish needs — one row per service — keeping `parish_slug` the same.

| Column | What to put |
| --- | --- |
| `kind` | `mass`, `novena`, `adoration` or `confession` |
| `day` | `sunday` … `saturday` |
| `time` | **Always include am or pm**: `6:00 am`, `6:30 pm`. See the note below |
| `language` | `tamil`, `english`, `telugu`, `hindi`, `malayalam` or `latin` |
| `note` | Anything conditional: `Vigil`, `First Friday only`, `Not during Lent` |

**About the time column.** A bare `6:00` will be **rejected**, not guessed,
because it could mean the morning or the evening mass and getting it wrong is
the worst mistake this website could make. Write `6:00 am` or `6:00 pm`.
(`18:30` is accepted, since it can only mean one thing.)

A parish with no rows filled in is left exactly as it is. A parish with at
least one filled row has its timings **replaced** by what is in this file, so
please list all of that parish's services, not just the new ones.

---

## 3-priest-name-check.csv — 4 names to confirm

The appointments letter and the old website spell these priests' names
differently. Rather than risk creating the same priest twice in the directory,
we stopped and are asking.

| Column | What to put |
| --- | --- |
| `same_person` | `yes` if the two names are one priest, `no` if they are two different priests |
| `correct_spelling` | If `yes`: how the name should be spelled. Leave blank to keep the directory's version |

---

## 4-clergy-deanery.csv — which deanery each priest serves in

104 priests, sorted by name. Fill in the `deanery` column
using the same six names as above. Nothing published anywhere maps priests to
deaneries, so this column is empty everywhere on the site today.

Leave a row blank if the priest is not attached to a deanery — the curia,
seminary staff, priests on studies and retired priests.

---

## Sending it back

Save each file in the same format (`.csv`) and send all four. If Excel offers
"CSV UTF-8", choose it — that keeps Tamil names readable.

Generated 2026-09-11.
