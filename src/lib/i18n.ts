/**
 * English / Tamil UI strings and locale helpers.
 *
 * IMPORTANT: the Tamil strings below are a first pass and **must be reviewed by
 * a Tamil-speaking member of the archdiocese before launch**. Liturgical
 * vocabulary in particular has settled conventions that a translator will know
 * and this file may not have got right.
 *
 * URL shape: English lives at the root (`/clergy`) and Tamil under a prefix
 * (`/ta/clergy`). English is not prefixed because every one of the ~270
 * redirects carried over from the old site points at a root path, and moving
 * them would throw away the search rankings those URLs carry.
 */

export const LOCALES = ['en', 'ta'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value)

export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  ta: 'தமிழ்',
}

/** `html lang` attribute value. */
export const HTML_LANG: Record<Locale, string> = {
  en: 'en-IN',
  ta: 'ta-IN',
}

/**
 * Prefix a path for a locale. English returns the path unchanged.
 *   localePath('/clergy', 'ta') -> '/ta/clergy'
 *   localePath('/clergy', 'en') -> '/clergy'
 */
export const localePath = (path: string, locale: Locale): string => {
  const clean = path.startsWith('/') ? path : `/${path}`
  if (locale === DEFAULT_LOCALE) return clean
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`
}

type Dictionary = {
  siteName: string
  siteTagline: string
  nav: Record<'home' | 'parishes' | 'clergy' | 'events' | 'news' | 'contact', string>
  common: {
    search: string
    mainMenu: string
    footerMenu: string
    anyLanguage: string
    anyDay: string
    anyTime: string
    allDeaneries: string
    /** Template with {shown}/{total}/{noun}. A plain string, because
     *  functions cannot cross the server/client component boundary. */
    showing: string
    noResults: string
    readMore: string
    switchLanguage: string
    devPreview: string
  }
  home: {
    eyebrow: string
    heading: string
    intro: string
    findParish: string
    clergyDirectory: string
    statParishes: string
    statPriests: string
    statDeaneries: string
    help: string
    cards: Record<
      'parish' | 'clergy' | 'certificate' | 'forms' | 'archbishop' | 'history',
      { title: string; body: string }
    >
    latestNews: string
    allNews: string
    noNews: string
    calendar: string
    upcoming: string
    noUpcoming: string
    recentEntries: string
    /** Template with {date}. */
    calendarEnds: string
    /** Template with {count}. */
    allEvents: string
    verseTitle: string
    verseNote: string
    carouselRegion: string
    carouselPrevious: string
    carouselNext: string
    /** Template with {n} and {total}. */
    carouselGoTo: string
  }
  search: {
    title: string
    intro: string
    placeholder: string
    submit: string
    /** Template with {q}. */
    resultsFor: string
    /** Template with {count}. */
    count: string
    /** Template with {q}. */
    none: string
    noneHint: string
    empty: string
    contentNote: string
    groups: Record<'parishes' | 'clergy' | 'pages' | 'news' | 'events', string>
    /** Template with {count} and {group}. */
    more: string
  }
  parishes: {
    title: string
    intro: string
    massLanguage: string
    day: string
    time: string
    findNearMe: string
    locating: string
    locationSet: string
    shrinesOnly: string
    showMap: string
    hideMap: string
    shrine: string
    timings: string
    noTimings: string
    history: string
    address: string
    contact: string
    clergy: string
    parishPriest: string
    assistant: string
    gettingThere: string
    viewOnMap: string
    searchPlaceholder: string
    noneMatch: string
    sampleTimingsTitle: string
    sampleTimingsBody: string
    /** Template with {place}. */
    approximateLocation: string
  }
  clergy: {
    title: string
    intro: string
    searchLabel: string
    searchPlaceholder: string
    deanery: string
    status: string
    anyStatus: string
    active: string
    retired: string
    away: string
    onLeave: string
    deceased: string
    biography: string
    previousAssignments: string
    parish: string
    ordained: string
    languages: string
    email: string
    phone: string
    addressLabel: string
    present: string
  }
  events: {
    title: string
    intro: string
    upcoming: string
    past: string
    none: string
    carriedOver: string
    when: string
    where: string
    noDescription: string
  }
  news: {
    title: string
    intro: string
    none: string
    noContent: string
  }
  contact: {
    title: string
    intro: string
    sendMessage: string
    requiredNote: string
    name: string
    email: string
    phone: string
    optional: string
    topic: string
    subject: string
    message: string
    send: string
    sending: string
    thanks: string
    thanksBody: string
    privacyNote: string
    lookingForParish: string
    lookingForParishBody: string
    telephone: string
    findOnMap: string
    topics: Record<'general' | 'certificate' | 'mass' | 'parish' | 'website', string>
    errors: Record<'name' | 'email' | 'emailInvalid' | 'subject' | 'message' | 'tooFast' | 'failed', string>
    /** Shown in place of the form on the static preview, which cannot send. */
    previewNotice: string
  }
  archbishop: {
    title: string
    intro: string
    history: string
    tabProfile: string
    tabMadras: string
    tabMylapore: string
    tabPrelates: string
    tabConference: string
    tabsLabel: string
    conferenceTabsLabel: string
  }
  /** The newsletter archive and the two galleries, which share a nav menu. */
  media: {
    menu: string
    newsletterTitle: string
    newsletterIntro: string
    newsletterYears: string
    newsletterEmpty: string
    earlierHeading: string
    /** Template with {years}, e.g. "2019 to 2024". */
    earlierBody: string
    earlierCta: string
    photosTitle: string
    photosIntro: string
    photosEmpty: string
    /** Template with {count}. */
    photoCount: string
    albumTabsLabel: string
    openPhoto: string
    closePhoto: string
    previousPhoto: string
    nextPhoto: string
    /** Template with {index} and {total}. */
    photoPosition: string
    videosTitle: string
    videosIntro: string
    videosEmpty: string
    play: string
    /** Template with {channel}. */
    publishedBy: string
    videoNotice: string
    watchOnYouTube: string
  }
  page: {
    notRebuilt: string
    notRebuiltBody: string
    originalAt: string
    externalHeading: string
    /** Template with {host}. */
    externalBody: string
    externalCta: string
    documentsHeading: string
    contents: string
    translationReviewTitle: string
    translationReviewBody: string
    download: string
    /** Template with {type} and {size}, e.g. "PDF · 152 KB". */
    fileMeta: string
    inTamil: string
    inEnglish: string
  }
}

const en: Dictionary = {
  siteName: 'Archdiocese of Madras-Mylapore',
  siteTagline: 'Roman Catholic Archdiocese, Chennai',
  nav: {
    home: 'Home',
    parishes: 'Parishes',
    clergy: 'Clergy',
    events: 'Events',
    news: 'News',
    contact: 'Contact',
  },
  common: {
    search: 'Search',
    mainMenu: 'Main menu',
    // Distinct from the header's, so the two nav landmarks are told apart.
    footerMenu: 'Footer menu',
    anyLanguage: 'Any language',
    anyDay: 'Any day',
    anyTime: 'Any time',
    allDeaneries: 'All deaneries',
    showing: 'Showing {shown} of {total} {noun}',
    noResults: 'Nothing matches those filters.',
    readMore: 'Read more',
    switchLanguage: 'Language',
    devPreview: 'Work in progress — this is a development preview.',
  },
  home: {
    eyebrow: 'Roman Catholic Archdiocese',
    heading: 'Archdiocese of Madras-Mylapore',
    intro:
      'Serving the Catholic faithful of Chennai. Find a parish and its mass timings, look up a priest, or follow the Archbishop’s engagements.',
    findParish: 'Find a parish',
    clergyDirectory: 'Clergy directory',
    statParishes: 'Parishes & shrines',
    statPriests: 'Priests',
    statDeaneries: 'Deaneries',
    help: 'How can we help?',
    cards: {
      parish: {
        title: 'Find a parish',
        body: 'Every parish and shrine of the archdiocese, with its clergy and contact details.',
      },
      clergy: {
        title: 'Look up a priest',
        body: 'The clergy directory, with each priest’s current assignment.',
      },
      certificate: {
        title: 'Baptism & marriage certificates',
        body: 'Your parish holds the register. Write to the archdiocesan office if you are not sure which parish that is.',
      },
      forms: {
        title: 'Forms & documents',
        body: 'Baptism and marriage forms, and the annual FCRA report.',
      },
      archbishop: {
        title: 'The Archbishop',
        body: 'His profile, pastoral letters and addresses.',
      },
      history: {
        title: 'History of the archdiocese',
        body: 'From the Portuguese mission at São Tomé to the archdiocese today.',
      },
    },
    latestNews: 'Latest news',
    allNews: 'All news',
    noNews: 'No news has been published yet.',
    calendar: 'Diocesan calendar',
    upcoming: 'Coming up',
    noUpcoming: 'No future engagements have been published yet.',
    recentEntries: 'Most recent entries',
    calendarEnds:
      'The calendar carried over from the previous website ends on {date}.',
    allEvents: 'All {count} entries',
    verseTitle: 'Verse of the day',
    verseNote: 'A verse for each day. It is not the lectionary reading for today’s Mass.',
    carouselRegion: 'Pictures from the archdiocese',
    carouselPrevious: 'Previous picture',
    carouselNext: 'Next picture',
    carouselGoTo: 'Go to picture {n} of {total}',
  },
  search: {
    title: 'Search',
    intro: 'Search parishes, priests, pages, news and the diocesan calendar.',
    placeholder: 'Search the site',
    submit: 'Search',
    resultsFor: 'Results for “{q}”',
    count: '{count} results',
    none: 'Nothing matched “{q}”.',
    noneHint:
      'Try fewer words — a priest’s surname, or the area a parish is in.',
    empty: 'Type something to search for.',
    contentNote:
      'Searches titles, names, assignments and locations. The body text of long pages is not searched yet.',
    groups: {
      parishes: 'Parishes',
      clergy: 'Clergy',
      pages: 'Pages',
      news: 'News',
      events: 'Diocesan calendar',
    },
    more: 'All {count} in {group}',
  },
  parishes: {
    title: 'Find a Parish',
    intro:
      'Search the parishes and shrines of the archdiocese, or filter by the day, time and language of mass.',
    massLanguage: 'Mass language',
    day: 'Day',
    time: 'Time',
    findNearMe: 'Find mass near me',
    locating: 'Finding you…',
    locationSet: 'Location set — sorted by distance',
    shrinesOnly: 'Shrines & basilicas only',
    showMap: 'Show map',
    hideMap: 'Hide map',
    shrine: 'Shrine',
    timings: 'Mass & service timings',
    noTimings: 'Timings have not been published for this parish yet.',
    history: 'History',
    address: 'Address',
    contact: 'Contact',
    clergy: 'Clergy',
    parishPriest: 'Parish Priest',
    assistant: 'Assistant',
    gettingThere: 'Getting there',
    viewOnMap: 'View on map',
    searchPlaceholder: 'Parish, patron, or area',
    noneMatch: 'No parishes match those filters. Try widening the day or language.',
    sampleTimingsTitle: 'Sample timings — do not rely on these',
    sampleTimingsBody:
      'The archdiocese has not published its mass schedule. The times shown are invented, so that this page can be tried out before the real ones arrive. Please telephone the parish to confirm any mass.',
    approximateLocation:
      'Approximate location: the centre of {place}, not the church itself. From OpenStreetMap, pending the parish’s own address.',
  },
  clergy: {
    title: 'Clergy Directory',
    intro:
      'Priests serving the Archdiocese of Madras-Mylapore. Search by name, or narrow the list to a single deanery.',
    searchLabel: 'Search by name or assignment',
    searchPlaceholder: 'e.g. Arul, or Chancellor',
    deanery: 'Deanery',
    status: 'Status',
    anyStatus: 'Any status',
    active: 'In active ministry',
    retired: 'Retired',
    away: 'On studies / outside the archdiocese',
    onLeave: 'On leave',
    deceased: 'Deceased',
    biography: 'Biography',
    previousAssignments: 'Previous assignments',
    parish: 'Parish',
    ordained: 'Ordained',
    languages: 'Languages',
    email: 'Email',
    phone: 'Phone',
    addressLabel: 'Address',
    present: 'present',
  },
  events: {
    title: 'Events',
    intro: 'The diocesan calendar and the Archbishop’s engagements.',
    upcoming: 'Upcoming',
    past: 'Past events',
    none: 'No upcoming events have been published yet.',
    carriedOver: '{count} entries carried over from the previous website.',
    when: 'When',
    where: 'Where',
    noDescription: 'No further details were published for this event.',
  },
  news: {
    title: 'News',
    intro: 'Announcements and news from across the archdiocese.',
    none: 'No news articles yet.',
    noContent: 'This article has no content yet.',
  },
  contact: {
    title: 'Contact Us',
    intro:
      'The archdiocesan office is the first point of contact for enquiries. For baptism and marriage records, or anything to do with a particular church, your parish is usually quicker.',
    sendMessage: 'Send a message',
    requiredNote: 'Fields marked * are required.',
    name: 'Your name',
    email: 'Email',
    phone: 'Telephone',
    optional: '(optional)',
    topic: 'What is this about?',
    subject: 'Subject',
    message: 'Message',
    send: 'Send message',
    sending: 'Sending…',
    thanks: 'Thank you — your message has been received.',
    thanksBody:
      'The archdiocesan office will be in touch. For anything urgent, please telephone',
    privacyNote: 'Please do not send confidential or financial details through this form.',
    lookingForParish: 'Looking for a parish?',
    lookingForParishBody:
      'Parish telephone numbers and mass timings are on the individual parish pages.',
    telephone: 'Telephone',
    findOnMap: 'Find on a map',
    topics: {
      general: 'General enquiry',
      certificate: 'Sacrament certificate (baptism, marriage)',
      mass: 'Mass intention or booking',
      parish: 'Parish matter',
      website: 'Website correction',
    },
    errors: {
      name: 'Please give your name.',
      email: 'Please give an email address.',
      emailInvalid: 'That does not look like an email address.',
      subject: 'Please give a subject.',
      message: 'Please write a message.',
      tooFast: 'That was submitted very quickly. Please try again.',
      failed:
        'Sorry — the message could not be saved. Please email abpmmsec@gmail.com directly.',
    },
    previewNotice:
      'This is a preview of the website’s design, and the contact form is not connected on it — a message sent here would reach nobody. Please use the telephone number or the address on this page.',
  },
  archbishop: {
    title: 'The Archbishop',
    intro:
      'Most Rev. George Antonysamy, sixth Archbishop of Madras-Mylapore, and the prelates who went before him.',
    history: 'History',
    tabProfile: 'Profile',
    tabMadras: 'Former Prelates of Madras',
    tabMylapore: 'Former Prelates of Mylapore',
    tabPrelates: 'Archbishops of Madras–Mylapore',
    tabConference: 'Conferences',
    tabsLabel: 'Archbishop page sections',
    conferenceTabsLabel: 'Episcopal conferences',
  },
  media: {
    menu: 'Media',
    newsletterTitle: 'Newsletter',
    newsletterIntro:
      'Niraivalvu, the newsletter of the Archdiocese of Madras-Mylapore, published monthly.',
    newsletterYears: 'Newsletter years',
    newsletterEmpty: 'No issues have been added yet.',
    earlierHeading: 'Earlier issues',
    earlierBody:
      'Issues from {years} have not been moved to this site yet. They are still on the previous website.',
    earlierCta: 'Open the earlier issues',
    photosTitle: 'Photo gallery',
    photosIntro: 'Photographs from celebrations and events across the archdiocese.',
    photosEmpty: 'No albums have been added yet.',
    photoCount: '{count} photographs',
    albumTabsLabel: 'Albums',
    openPhoto: 'Open photograph',
    closePhoto: 'Close',
    previousPhoto: 'Previous photograph',
    nextPhoto: 'Next photograph',
    photoPosition: '{index} of {total}',
    videosTitle: 'Video gallery',
    videosIntro: 'Recordings of archdiocesan celebrations. Each one is hosted on YouTube.',
    videosEmpty: 'No videos have been added yet.',
    play: 'Play',
    publishedBy: 'Published by {channel}',
    videoNotice:
      'These videos are hosted on YouTube. Nothing is loaded from YouTube, and no cookie is set, until you press play.',
    watchOnYouTube: 'Watch on YouTube',
  },
  page: {
    notRebuilt: 'This page has not been rebuilt yet.',
    notRebuiltBody:
      'It was built with Elementor on the previous website, whose layout is not available through the WordPress API, so the content has to be re-entered.',
    originalAt: 'The original is still visible at',
    externalHeading: 'Published on another website',
    externalBody:
      'This resource is hosted by {host}. The archdiocese links to it rather than reproducing it.',
    externalCta: 'Open the resource',
    documentsHeading: 'Downloads',
    contents: 'On this page',
    translationReviewTitle: 'Translation awaiting review',
    translationReviewBody:
      'This page was translated by machine and has not yet been checked by a Tamil speaker. The English version is the authoritative one.',
    download: 'Download',
    fileMeta: '{type} · {size}',
    inTamil: 'Tamil',
    inEnglish: 'English',
  },
}

const ta: Dictionary = {
  siteName: 'சென்னை–மயிலை உயர் மறைமாவட்டம்',
  siteTagline: 'ரோமன் கத்தோலிக்க உயர் மறைமாவட்டம், சென்னை',
  nav: {
    home: 'முகப்பு',
    parishes: 'பங்குகள்',
    clergy: 'குருக்கள்',
    events: 'நிகழ்வுகள்',
    news: 'செய்திகள்',
    contact: 'தொடர்பு',
  },
  common: {
    search: 'தேடுக',
    mainMenu: 'முதன்மைப் பட்டி',
    footerMenu: 'அடிப்பகுதி பட்டி',
    anyLanguage: 'எந்த மொழியும்',
    anyDay: 'எந்த நாளும்',
    anyTime: 'எந்த நேரமும்',
    allDeaneries: 'அனைத்து மறைவட்டங்கள்',
    showing: '{total} இல் {shown} {noun} காட்டப்படுகிறது',
    noResults: 'இந்த வடிகட்டிகளுக்கு எதுவும் பொருந்தவில்லை.',
    readMore: 'மேலும் படிக்க',
    switchLanguage: 'மொழி',
    devPreview: 'பணி நடைபெறுகிறது — இது ஒரு முன்னோட்டப் பதிப்பு.',
  },
  home: {
    eyebrow: 'ரோமன் கத்தோலிக்க உயர் மறைமாவட்டம்',
    heading: 'சென்னை–மயிலை உயர் மறைமாவட்டம்',
    intro:
      'சென்னை கத்தோலிக்க விசுவாசிகளுக்குப் பணி செய்கிறது. பங்கு மற்றும் திருப்பலி நேரங்களைக் கண்டறியவும், குருவைத் தேடவும், பேராயரின் நிகழ்வுகளை அறியவும்.',
    findParish: 'பங்கைக் கண்டறிக',
    clergyDirectory: 'குருக்கள் பட்டியல்',
    statParishes: 'பங்குகள் & திருத்தலங்கள்',
    statPriests: 'குருக்கள்',
    statDeaneries: 'மறைவட்டங்கள்',
    help: 'நாங்கள் எவ்வாறு உதவ முடியும்?',
    cards: {
      parish: {
        title: 'பங்கைக் கண்டறிக',
        body: 'உயர் மறைமாவட்டத்தின் அனைத்துப் பங்குகள் மற்றும் திருத்தலங்கள், அவற்றின் குருக்கள் மற்றும் தொடர்பு விவரங்களுடன்.',
      },
      clergy: {
        title: 'குருவைத் தேடுக',
        body: 'ஒவ்வொரு குருவின் தற்போதைய பணியுடன் கூடிய குருக்கள் பட்டியல்.',
      },
      certificate: {
        title: 'திருமுழுக்கு & திருமணச் சான்றிதழ்கள்',
        body: 'பதிவேடு உங்கள் பங்கிலேயே உள்ளது. எந்தப் பங்கு என்று தெரியாவிட்டால் மறைமாவட்ட அலுவலகத்தை எழுதுங்கள்.',
      },
      forms: {
        title: 'படிவங்கள் & ஆவணங்கள்',
        body: 'திருமுழுக்கு மற்றும் திருமணப் படிவங்கள், ஆண்டு FCRA அறிக்கை.',
      },
      archbishop: {
        title: 'பேராயர்',
        body: 'அவரது வாழ்க்கைக் குறிப்பு, மறைபோதனை மடல்கள் மற்றும் உரைகள்.',
      },
      history: {
        title: 'உயர் மறைமாவட்ட வரலாறு',
        body: 'சாந்தோமில் தொடங்கிய போர்த்துகீசிய பணியிலிருந்து இன்றைய உயர் மறைமாவட்டம் வரை.',
      },
    },
    latestNews: 'சமீபத்திய செய்திகள்',
    allNews: 'அனைத்துச் செய்திகள்',
    noNews: 'இன்னும் செய்திகள் வெளியிடப்படவில்லை.',
    calendar: 'மறைமாவட்ட நாட்காட்டி',
    upcoming: 'வரவிருப்பவை',
    noUpcoming: 'வருங்கால நிகழ்வுகள் இன்னும் வெளியிடப்படவில்லை.',
    recentEntries: 'சமீபத்திய பதிவுகள்',
    calendarEnds:
      'முன்னைய இணையதளத்திலிருந்து வந்த நாட்காட்டி {date} அன்று முடிவடைகிறது.',
    allEvents: 'அனைத்து {count} பதிவுகள்',
    verseTitle: 'இன்றைய வசனம்',
    verseNote:
      'ஒவ்வொரு நாளுக்கும் ஒரு வசனம். இது இன்றைய திருப்பலியின் வாசகம் அல்ல.',
    carouselRegion: 'உயர் மறைமாவட்டப் படங்கள்',
    carouselPrevious: 'முந்தைய படம்',
    carouselNext: 'அடுத்த படம்',
    carouselGoTo: '{total} இல் {n} ஆம் படத்திற்குச் செல்க',
  },
  search: {
    title: 'தேடல்',
    intro:
      'பங்குகள், குருக்கள், பக்கங்கள், செய்திகள் மற்றும் மறைமாவட்ட நாட்காட்டியில் தேடுங்கள்.',
    placeholder: 'இணையதளத்தில் தேடுக',
    submit: 'தேடுக',
    resultsFor: '“{q}” க்கான முடிவுகள்',
    count: '{count} முடிவுகள்',
    none: '“{q}” க்கு எதுவும் பொருந்தவில்லை.',
    noneHint:
      'சொற்களைக் குறைத்துப் பாருங்கள் — குருவின் பெயர், அல்லது பங்கு உள்ள பகுதி.',
    empty: 'தேடுவதற்கு ஏதாவது தட்டச்சு செய்யுங்கள்.',
    contentNote:
      'தலைப்புகள், பெயர்கள், பணிகள் மற்றும் இடங்கள் தேடப்படுகின்றன. நீண்ட பக்கங்களின் உள்ளடக்கம் இன்னும் தேடப்படவில்லை.',
    groups: {
      parishes: 'பங்குகள்',
      clergy: 'குருக்கள்',
      pages: 'பக்கங்கள்',
      news: 'செய்திகள்',
      events: 'மறைமாவட்ட நாட்காட்டி',
    },
    more: '{group} இல் அனைத்து {count}',
  },
  parishes: {
    title: 'பங்கைக் கண்டறிக',
    intro:
      'உயர் மறைமாவட்டத்தின் பங்குகள் மற்றும் திருத்தலங்களைத் தேடுங்கள், அல்லது திருப்பலியின் நாள், நேரம், மொழி வாரியாக வடிகட்டுங்கள்.',
    massLanguage: 'திருப்பலி மொழி',
    day: 'நாள்',
    time: 'நேரம்',
    findNearMe: 'அருகிலுள்ள திருப்பலியைக் கண்டறிக',
    locating: 'இடத்தைக் கண்டறிகிறது…',
    locationSet: 'இடம் அமைக்கப்பட்டது — தூரப்படி வரிசைப்படுத்தப்பட்டது',
    shrinesOnly: 'திருத்தலங்கள் மட்டும்',
    showMap: 'வரைபடத்தைக் காட்டு',
    hideMap: 'வரைபடத்தை மறை',
    shrine: 'திருத்தலம்',
    timings: 'திருப்பலி மற்றும் திருப்பணி நேரங்கள்',
    noTimings: 'இந்தப் பங்குக்கான நேரங்கள் இன்னும் வெளியிடப்படவில்லை.',
    history: 'வரலாறு',
    address: 'முகவரி',
    contact: 'தொடர்பு',
    clergy: 'குருக்கள்',
    parishPriest: 'பங்குத் தந்தை',
    assistant: 'உதவிப் பங்குத் தந்தை',
    gettingThere: 'அங்கு செல்வது',
    viewOnMap: 'வரைபடத்தில் காண்க',
    searchPlaceholder: 'பங்கு, பாதுகாவலர் அல்லது பகுதி',
    noneMatch:
      'இந்த வடிகட்டிகளுக்கு எந்தப் பங்கும் பொருந்தவில்லை. நாள் அல்லது மொழியை விரிவுபடுத்திப் பாருங்கள்.',
    sampleTimingsTitle: 'மாதிரி நேரங்கள் — இவற்றை நம்ப வேண்டாம்',
    sampleTimingsBody:
      'உயர் மறைமாவட்டம் தனது திருப்பலி நேரங்களை இன்னும் வெளியிடவில்லை. இங்கு காட்டப்படும் நேரங்கள் இந்தப் பக்கத்தைச் சோதிப்பதற்காக உருவாக்கப்பட்டவை. எந்தத் திருப்பலிக்கும் பங்கைத் தொலைபேசியில் உறுதிப்படுத்திக் கொள்ளுங்கள்.',
    approximateLocation:
      'தோராயமான இடம்: {place} இன் மையம், ஆலயம் அல்ல. OpenStreetMap இலிருந்து; பங்கின் சொந்த முகவரி வரும் வரை.',
  },
  clergy: {
    title: 'குருக்கள் பட்டியல்',
    intro:
      'சென்னை–மயிலை உயர் மறைமாவட்டத்தில் பணி செய்யும் குருக்கள். பெயரால் தேடுங்கள் அல்லது ஒரு மறைவட்டத்திற்குச் சுருக்குங்கள்.',
    searchLabel: 'பெயர் அல்லது பணி வாரியாகத் தேடுக',
    searchPlaceholder: 'எ.கா. அருள்',
    deanery: 'மறைவட்டம்',
    status: 'நிலை',
    anyStatus: 'எந்த நிலையும்',
    active: 'பணியில் உள்ளவர்',
    retired: 'பணி நிறைவு பெற்றவர்',
    away: 'மேற்படிப்பு / மறைமாவட்டத்திற்கு வெளியே',
    onLeave: 'விடுப்பில்',
    deceased: 'இறையடி சேர்ந்தவர்',
    biography: 'வாழ்க்கைக் குறிப்பு',
    previousAssignments: 'முன்னைய பணிகள்',
    parish: 'பங்கு',
    ordained: 'திருநிலைப்பாடு',
    languages: 'மொழிகள்',
    email: 'மின்னஞ்சல்',
    phone: 'தொலைபேசி',
    addressLabel: 'முகவரி',
    present: 'இன்று வரை',
  },
  events: {
    title: 'நிகழ்வுகள்',
    intro: 'மறைமாவட்ட நாட்காட்டி மற்றும் பேராயரின் நிகழ்வுகள்.',
    upcoming: 'வரவிருக்கும் நிகழ்வுகள்',
    past: 'கடந்த நிகழ்வுகள்',
    none: 'வரவிருக்கும் நிகழ்வுகள் இன்னும் வெளியிடப்படவில்லை.',
    carriedOver: 'முன்னைய இணையதளத்திலிருந்து {count} பதிவுகள்.',
    when: 'எப்போது',
    where: 'எங்கே',
    noDescription: 'இந்த நிகழ்வுக்கு மேற்கொண்டு விவரங்கள் வெளியிடப்படவில்லை.',
  },
  news: {
    title: 'செய்திகள்',
    intro: 'உயர் மறைமாவட்டத்தின் அறிவிப்புகள் மற்றும் செய்திகள்.',
    none: 'இன்னும் செய்திகள் இல்லை.',
    noContent: 'இந்தச் செய்திக்கு இன்னும் உள்ளடக்கம் இல்லை.',
  },
  contact: {
    title: 'எங்களைத் தொடர்பு கொள்ளுங்கள்',
    intro:
      'விசாரணைகளுக்கு மறைமாவட்ட அலுவலகமே முதல் தொடர்பு. திருமுழுக்கு மற்றும் திருமண ஆவணங்களுக்கு, அல்லது ஒரு குறிப்பிட்ட ஆலயம் தொடர்பான விஷயங்களுக்கு, உங்கள் பங்கைத் தொடர்பு கொள்வது விரைவானது.',
    sendMessage: 'செய்தி அனுப்புக',
    requiredNote: '* குறியிட்ட புலங்கள் அவசியம்.',
    name: 'உங்கள் பெயர்',
    email: 'மின்னஞ்சல்',
    phone: 'தொலைபேசி',
    optional: '(விரும்பினால்)',
    topic: 'இது எதைப் பற்றியது?',
    subject: 'தலைப்பு',
    message: 'செய்தி',
    send: 'செய்தியை அனுப்புக',
    sending: 'அனுப்புகிறது…',
    thanks: 'நன்றி — உங்கள் செய்தி பெறப்பட்டது.',
    thanksBody:
      'மறைமாவட்ட அலுவலகம் உங்களைத் தொடர்பு கொள்ளும். அவசரமான தேவைகளுக்கு தொலைபேசியில் அழையுங்கள்',
    privacyNote: 'இந்தப் படிவத்தில் இரகசிய அல்லது நிதி விவரங்களை அனுப்ப வேண்டாம்.',
    lookingForParish: 'பங்கைத் தேடுகிறீர்களா?',
    lookingForParishBody:
      'பங்கின் தொலைபேசி எண்கள் மற்றும் திருப்பலி நேரங்கள் அந்தப் பங்கின் பக்கத்தில் உள்ளன.',
    telephone: 'தொலைபேசி',
    findOnMap: 'வரைபடத்தில் கண்டறிக',
    topics: {
      general: 'பொது விசாரணை',
      certificate: 'அருளடையாள சான்றிதழ் (திருமுழுக்கு, திருமணம்)',
      mass: 'திருப்பலி நோக்கம் அல்லது முன்பதிவு',
      parish: 'பங்கு தொடர்பான விஷயம்',
      website: 'இணையதள திருத்தம்',
    },
    errors: {
      name: 'உங்கள் பெயரைத் தருக.',
      email: 'மின்னஞ்சல் முகவரியைத் தருக.',
      emailInvalid: 'இது மின்னஞ்சல் முகவரி போல் தெரியவில்லை.',
      subject: 'தலைப்பைத் தருக.',
      message: 'செய்தியை எழுதுக.',
      tooFast: 'மிக விரைவாக அனுப்பப்பட்டது. மீண்டும் முயற்சிக்கவும்.',
      failed:
        'மன்னிக்கவும் — செய்தியைச் சேமிக்க முடியவில்லை. abpmmsec@gmail.com க்கு நேரடியாக மின்னஞ்சல் அனுப்புங்கள்.',
    },
    previewNotice:
      'இது இணையதளத்தின் வடிவமைப்பு முன்னோட்டம்; இதில் தொடர்புப் படிவம் இணைக்கப்படவில்லை — இங்கு அனுப்பும் செய்தி யாரையும் சென்றடையாது. இப்பக்கத்தில் உள்ள தொலைபேசி எண்ணையோ முகவரியையோ பயன்படுத்துங்கள்.',
  },
  archbishop: {
    title: 'பேராயர்',
    intro:
      'சென்னை–மயிலையின் ஆறாவது பேராயர் மேதகு ஜார்ஜ் அந்தோணிசாமி அவர்களும், அவருக்கு முந்தைய ஆயர்களும்.',
    history: 'வரலாறு',
    tabProfile: 'வாழ்க்கைக் குறிப்பு',
    tabMadras: 'சென்னையின் முன்னாள் ஆயர்கள்',
    tabMylapore: 'மயிலையின் முன்னாள் ஆயர்கள்',
    tabPrelates: 'சென்னை–மயிலை பேராயர்கள்',
    tabConference: 'மன்றங்கள்',
    tabsLabel: 'பேராயர் பக்கப் பிரிவுகள்',
    conferenceTabsLabel: 'ஆயர் மன்றங்கள்',
  },
  media: {
    menu: 'ஊடகம்',
    newsletterTitle: 'செய்திமடல்',
    newsletterIntro:
      'நிறைவாழ்வு — சென்னை–மயிலை உயர் மறைமாவட்டத்தின் மாதாந்திர செய்திமடல்.',
    newsletterYears: 'செய்திமடல் ஆண்டுகள்',
    newsletterEmpty: 'இதுவரை எந்த இதழும் சேர்க்கப்படவில்லை.',
    earlierHeading: 'முந்தைய இதழ்கள்',
    earlierBody:
      '{years} ஆண்டுகளின் இதழ்கள் இன்னும் இந்தத் தளத்திற்கு மாற்றப்படவில்லை. அவை பழைய இணையதளத்தில் உள்ளன.',
    earlierCta: 'முந்தைய இதழ்களைத் திறக்க',
    photosTitle: 'புகைப்படத் தொகுப்பு',
    photosIntro: 'உயர் மறைமாவட்டத்தின் கொண்டாட்டங்கள் மற்றும் நிகழ்வுகளின் புகைப்படங்கள்.',
    photosEmpty: 'இதுவரை எந்தத் தொகுப்பும் சேர்க்கப்படவில்லை.',
    photoCount: '{count} புகைப்படங்கள்',
    albumTabsLabel: 'தொகுப்புகள்',
    openPhoto: 'புகைப்படத்தைத் திறக்க',
    closePhoto: 'மூடு',
    previousPhoto: 'முந்தைய புகைப்படம்',
    nextPhoto: 'அடுத்த புகைப்படம்',
    photoPosition: '{total}-ல் {index}',
    videosTitle: 'காணொளித் தொகுப்பு',
    videosIntro:
      'உயர் மறைமாவட்டக் கொண்டாட்டங்களின் காணொளிப் பதிவுகள். ஒவ்வொன்றும் YouTube-ல் உள்ளது.',
    videosEmpty: 'இதுவரை எந்தக் காணொளியும் சேர்க்கப்படவில்லை.',
    play: 'இயக்கு',
    publishedBy: '{channel} வெளியிட்டது',
    videoNotice:
      'இந்தக் காணொளிகள் YouTube-ல் உள்ளன. நீங்கள் இயக்கும் வரை YouTube-லிருந்து எதுவும் ஏற்றப்படாது, குக்கீயும் சேமிக்கப்படாது.',
    watchOnYouTube: 'YouTube-ல் பார்க்க',
  },
  page: {
    notRebuilt: 'இந்தப் பக்கம் இன்னும் மீண்டும் உருவாக்கப்படவில்லை.',
    notRebuiltBody:
      'இது முன்னைய இணையதளத்தில் Elementor மூலம் உருவாக்கப்பட்டது; அதன் உள்ளடக்கம் WordPress API வழியாகக் கிடைக்காததால் மீண்டும் உள்ளிடப்பட வேண்டும்.',
    originalAt: 'மூலப் பக்கம் இன்னும் இங்கே காணப்படுகிறது:',
    externalHeading: 'வேறு இணையதளத்தில் வெளியிடப்பட்டுள்ளது',
    externalBody:
      'இந்த ஆதாரம் {host} இணையதளத்தில் உள்ளது. உயர் மறைமாவட்டம் அதை நகலெடுக்காமல் இணைப்பு வழங்குகிறது.',
    externalCta: 'ஆதாரத்தைத் திறக்க',
    documentsHeading: 'பதிவிறக்கங்கள்',
    contents: 'இந்தப் பக்கத்தில்',
    translationReviewTitle: 'மொழிபெயர்ப்பு சரிபார்ப்புக்குக் காத்திருக்கிறது',
    translationReviewBody:
      'இந்தப் பக்கம் இயந்திர மொழிபெயர்ப்பால் உருவாக்கப்பட்டது; தமிழ் அறிந்த ஒருவரால் இன்னும் சரிபார்க்கப்படவில்லை. ஆங்கிலப் பதிப்பே அதிகாரப்பூர்வமானது.',
    download: 'பதிவிறக்குக',
    fileMeta: '{type} · {size}',
    inTamil: 'தமிழ்',
    inEnglish: 'ஆங்கிலம்',
  },
}

const DICTIONARIES: Record<Locale, Dictionary> = { en, ta }

export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale]
export type { Dictionary }

/** Fill {placeholders} in a dictionary string. */
export const fill = (
  template: string,
  values: Record<string, string | number>,
): string =>
  Object.entries(values).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  )

/**
 * `alternates` for a page's metadata.
 *
 * Must be set per page, not in the layout: the layout has no access to the
 * current path, so a canonical declared there ends up saying every page is a
 * duplicate of the homepage -- which is exactly what it told Google before
 * this helper existed.
 *
 * @param path language-neutral path, e.g. '/clergy' or '/clergy/alexander-a'
 */
/**
 * When the site is served from a subdirectory rather than from the root of a
 * domain — which is how GitHub Pages serves a project repository — every path
 * below needs that prefix. Next.js adds it to links and assets on its own, but
 * these go into `<link rel="canonical">` and the hreflang tags, which it does
 * not touch: the canonical would point at the wrong site entirely.
 *
 * Empty on the real deployment, where the site is at the root of its domain.
 */
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '')

export const alternatesFor = (path: string, locale: Locale) => ({
  canonical: `${BASE}${localePath(path, locale)}`,
  languages: {
    'en-IN': `${BASE}${localePath(path, 'en')}`,
    'ta-IN': `${BASE}${localePath(path, 'ta')}`,
  },
})
