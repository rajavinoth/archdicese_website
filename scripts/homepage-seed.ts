/**
 * Seeds the verse-of-the-day pool and the homepage carousel.
 *
 * Both are starting points, not finished content, and both are flagged for
 * review. Run once; it upserts, so re-running is safe.
 *
 * About the scripture text
 * ------------------------
 * The verses are given in the **World English Bible**, which is in the public
 * domain. That matters: the translations a Catholic diocese would normally
 * reach for — the NRSV, the NABRE, the RSV-CE, the Jerusalem Bible — are all
 * under copyright, and reproducing them on a website needs a licence the
 * archdiocese would have to hold.
 *
 * Every verse is nonetheless flagged `needsReview`, because a website that
 * misquotes scripture is worse than one with no verse at all. Somebody at the
 * archdiocese should check each wording against a printed copy, and may prefer
 * to replace the set with its own approved translation — the `translation`
 * field on each record exists for exactly that.
 *
 * The verses are chosen to be usable any day of the year: no Advent, Lent or
 * Easter texts, because the rotation is by date and has no idea what season it
 * is. Nothing here claims to be the lectionary reading for the day.
 *
 * About the carousel images
 * -------------------------
 * Only genuinely archdiocesan photographs already in the media library are
 * used. The old theme shipped `banner1.jpg`, `home1bg.jpg` and
 * `church-3481187_1920.jpg` — that last one is a Pixabay stock photo, its
 * filename still carrying the stock ID — and putting those on the front page
 * would repeat the mistake that left six demo blog posts on the old site for
 * six years.
 *
 * Run with:  npm run homepage:seed
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const REVIEW_NOTE =
  'Scripture text from the World English Bible (public domain). Please check the wording against a printed copy, and replace it with the archdiocese’s approved translation if preferred.'

const TRANSLATION = 'World English Bible'

/** reference -> verse text. Kept short enough to read on a phone. */
const VERSES: Record<string, string> = {
  'John 13:34':
    'A new commandment I give to you, that you love one another. Just as I have loved you, you also love one another.',
  'John 14:6':
    'Jesus said to him, “I am the way, the truth, and the life. No one comes to the Father, except through me.”',
  'Matthew 5:16':
    'Even so, let your light shine before men, that they may see your good works and glorify your Father who is in heaven.',
  'Matthew 6:33':
    'But seek first God’s Kingdom and his righteousness; and all these things will be given to you as well.',
  'Matthew 11:28': 'Come to me, all you who labor and are heavily burdened, and I will give you rest.',
  'Matthew 22:37-39':
    'You shall love the Lord your God with all your heart, with all your soul, and with all your mind. A second likewise is this: You shall love your neighbor as yourself.',
  'Mark 10:45':
    'For the Son of Man also came not to be served, but to serve, and to give his life as a ransom for many.',
  'Luke 6:36': 'Therefore be merciful, even as your Father is also merciful.',
  'Psalm 23:1': 'Yahweh is my shepherd; I shall lack nothing.',
  'Psalm 46:1': 'God is our refuge and strength, a very present help in trouble.',
  'Psalm 118:24':
    'This is the day that Yahweh has made. We will rejoice and be glad in it!',
  'Isaiah 40:31':
    'But those who wait for Yahweh will renew their strength. They will mount up with wings like eagles. They will run and not be weary. They will walk and not faint.',
  'Proverbs 3:5':
    'Trust in Yahweh with all your heart, and don’t lean on your own understanding.',
  'Romans 12:12': 'Rejoicing in hope; enduring in troubles; continuing steadfastly in prayer.',
  '1 Corinthians 13:13':
    'But now faith, hope, and love remain—these three. The greatest of these is love.',
  'Philippians 4:6':
    'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.',
  '1 John 4:19': 'We love him, because he first loved us.',
  'James 2:17': 'Even so faith, if it has no works, is dead in itself.',
}

/**
 * Minimum width for a full-width slide. The carousel band is about 1100px
 * wide on a laptop and crops to 21:9, so a 640px photo is upscaled to nearly
 * twice its size and loses two thirds of its height — it looked visibly soft
 * and badly cropped. Anything narrower than this is skipped and reported.
 */
const MIN_SLIDE_WIDTH = 1000

/**
 * Carousel slides, identified by the media filename already in the library.
 * Captions describe only what can be verified from where the image came from
 * on the old site — no names are attached to faces.
 */
const SLIDES: { filename: string; headline: string; caption: string; link: string }[] = [
  {
    filename: 'bishop-speak-scaled.jpg',
    headline: 'The Archbishop speaks',
    caption: 'Addresses and pastoral letters',
    link: '/archbishop-speaks',
  },
  {
    filename: 'YOY-Flag.jpeg',
    headline: 'Year of Youth 2020',
    caption: 'The archdiocesan flag for the Year of Youth',
    link: '/tnbc-year-of-youth-2020',
  },
]

const main = async () => {
  const payload = await getPayload({ config })

  // ---- Verses -----------------------------------------------------------
  let created = 0
  let skipped = 0

  for (const [reference, text] of Object.entries(VERSES)) {
    const existing = await payload.find({
      collection: 'verses',
      where: { reference: { equals: reference } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      skipped++
      continue
    }

    await payload.create({
      collection: 'verses',
      data: {
        reference,
        text,
        translation: TRANSLATION,
        active: true,
        _status: 'published',
        legacy: {
          wpId: null,
          url: null,
          needsReview: true,
          reviewNote: REVIEW_NOTE,
        },
      } as never,
      context: { disableRevalidate: true },
    })
    created++
  }

  console.log(`Verses: ${created} created, ${skipped} already present`)

  // ---- Carousel ---------------------------------------------------------
  const media = await payload.find({
    collection: 'media',
    limit: 1000,
    depth: 0,
    pagination: false,
  })
  const byFilename = new Map(media.docs.map((doc) => [doc.filename, doc]))

  const slides: { image: number | string; headline: string; caption: string; link: string }[] = []
  const missing: string[] = []
  const tooSmall: string[] = []

  for (const slide of SLIDES) {
    const image = byFilename.get(slide.filename)
    if (!image) {
      missing.push(slide.filename)
      continue
    }
    if ((image.width ?? 0) < MIN_SLIDE_WIDTH) {
      tooSmall.push(`${slide.filename} (${image.width}px wide)`)
      continue
    }
    slides.push({
      image: image.id,
      headline: slide.headline,
      caption: slide.caption,
      link: slide.link,
    })
  }

  if (missing.length) {
    console.log(`  images not in the media library, skipped: ${missing.join(', ')}`)
  }
  if (tooSmall.length) {
    console.log(
      `  too small for a full-width slide (want ${MIN_SLIDE_WIDTH}px+), skipped: ${tooSmall.join(', ')}`,
    )
  }

  const current = await payload.findGlobal({ slug: 'homepage', depth: 0 })

  const force = process.env.HOMEPAGE_FORCE === '1'

  if (!force && (current.slides?.length ?? 0) > 0) {
    console.log(
      `Carousel: left alone — it already has ${current.slides?.length} slide(s). Edit it in the admin under Settings → Homepage, or HOMEPAGE_FORCE=1 to replace.`,
    )
  } else {
    await payload.updateGlobal({
      slug: 'homepage',
      data: {
        carouselEnabled: true,
        slidesToShow: slides.length,
        slidesPerView: '1',
        autoplaySeconds: 6,
        verseEnabled: true,
        slides,
      } as never,
      context: { disableRevalidate: true },
    })
    console.log(`Carousel: ${slides.length} slides set from real archdiocesan photographs`)
  }

  console.log(
    `\nBoth are starting points. The verses are flagged for review — the wording\nshould be checked, and the archdiocese may prefer its own translation.`,
  )

  process.exit(0)
}

await main()
