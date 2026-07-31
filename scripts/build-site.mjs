import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertNoMojibake, checkProjectEncoding} from './check-encoding.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'dist');
const MEDIA_TEMPLATE = resolve(ROOT, 'build/media.template.html');
const REPERTOIRE_TEMPLATE = resolve(ROOT, 'build/repertoire.template.html');
const FRIENDS_TEMPLATE = resolve(ROOT, 'build/friends.template.html');
const ABOUT_TEMPLATE = resolve(ROOT, 'build/about.template.html');
const CONTACT_TEMPLATE = resolve(ROOT, 'build/contact.template.html');
const HOME_TEMPLATE = resolve(ROOT, 'build/home.template.html');
const FRIENDS_FALLBACK = resolve(ROOT, 'data/friends-fallback.json');
const ABOUT_FALLBACK = resolve(ROOT, 'data/about-fallback.json');
const CONTACT_FALLBACK = resolve(ROOT, 'data/contact-fallback.json');
const HOME_FALLBACK = resolve(ROOT, 'data/home-fallback.json');
const FALLBACK = resolve(ROOT, 'data/media-fallback.json');
const REPERTOIRE_FALLBACK = resolve(ROOT, 'data/repertoire-fallback.json');
const NAVIGATION = resolve(ROOT, 'components/nav.html');
const FOOTER = resolve(ROOT, 'components/footer.html');
const PUBLIC_DIRECTORIES = ['admin', 'components', 'css', 'data', 'images', 'js', 'leden', 'pages'];
const PUBLIC_FILES = ['index.html', '_redirects'];
const REQUEST_TIMEOUT_MS = 8000;

const ALLOWED_SANITY_DATASETS = new Set(['development', 'production']);

export function resolveSanityDataset(environment = process.env) {
  const configuredDataset = environment.SANITY_DATASET?.trim();
  const dataset =
    configuredDataset ||
    (environment.VERCEL_ENV === 'production' ? 'production' : 'development');

  if (!ALLOWED_SANITY_DATASETS.has(dataset)) {
    throw new Error(`Ongeldige Sanity-dataset: ${dataset}`);
  }

  return dataset;
}

export const MEDIA_QUERY = `{
  "page": *[_id == "mediaPage-main" && _type == "mediaPage"][0] {
    heroTitle, heroSubtitle, heroImageAlt,
    "heroImageUrl": heroImage.asset->url,
    introTitle, introText, ctaEyebrow, ctaTitle, ctaText,
    primaryButtonLabel, primaryButtonLink,
    secondaryButtonLabel, secondaryButtonLink
  },
  "photoAlbums": *[_type == "photoAlbum" && isVisible == true] | order(eventDate desc) {
    _id, title, eventDate, summary, isFeatured, coverImageAlt,
    "coverImageUrl": coverImage.asset->url,
    photos[] {alt, caption, "imageUrl": image.asset->url}
  },
  "audioItems": *[_type == "audioItem" && isVisible == true] | order(recordedAt desc) {
    _id, title, recordedAt, summary, isFeatured,
    "audioUrl": audioFile.asset->url
  },
  "videoItems": *[_type == "videoItem" && isVisible == true] | order(recordedAt desc) {
    _id, title, recordedAt, summary, isFeatured, youtubeUrl, thumbnailAlt,
    "thumbnailUrl": thumbnail.asset->url
  }
}`;

export const FRIENDS_QUERY = `{
  "page": *[_id == "friendsPage-main" && _type == "friendsPage"][0] {
    heroTitle, heroText, heroImageAlt,
    "heroImageUrl": heroImage.asset->url,
    heroPrimaryButtonLabel, heroPrimaryButtonLink,
    heroSecondaryButtonLabel, heroSecondaryButtonLink,
    supportTitle, supportIntro,
    supportItems[] {title, text},
    friendsTitle, friendsIntro,
    ctaTitle, ctaText, ctaBenefits,
    ctaImageAlt,
    "ctaImageUrl": ctaImage.asset->url,
    ctaPrimaryButtonLabel, ctaPrimaryButtonLink,
    ctaSecondaryButtonLabel, ctaSecondaryButtonLink
  },
  "friends": *[_type == "friendItem" && isVisible == true] | order(sortOrder asc, publicName asc) {
    _id, publicName, friendType, imageDisplay, imageAlt,
    description, website, isFeatured, sortOrder,
    publishFrom, publishUntil,
    "imageUrl": image.asset->url
  }
}`;

export const ABOUT_QUERY = `*[_id == "aboutPage-main" && _type == "aboutPage"][0] {
  seoTitle, seoDescription,
  heroTitle, heroSubtitle, heroImageAlt, "heroImageUrl": heroImage.asset->url,
  introEyebrow, introTitle, introText,
  introImageAlt, "introImageUrl": introImage.asset->url,
  timelineEyebrow, timelineTitle, timelineIntro, timelineItems[] {title, text},
  valuesEyebrow, valuesTitle, valuesItems[] {title, text},
  atmosphereEyebrow, atmosphereTitle, atmosphereText,
  atmosphereImageAlt, "atmosphereImageUrl": atmosphereImage.asset->url,
  quote, quoteAttribution,
  ctaEyebrow, ctaTitle, ctaText,
  primaryButtonLabel, primaryButtonLink,
  secondaryButtonLabel, secondaryButtonLink
}`;

export const CONTACT_QUERY = `*[_id == "contactPage-main" && _type == "contactPage"][0] {
  seoTitle, seoDescription,
  heroEyebrow, heroTitle, heroIntro, heroImageAlt,
  "heroImageUrl": heroImage.asset->url,
  emailCtaLabel, phoneCtaLabel,
  contactTopics[] {title, text, icon, linkLabel, linkTarget},
  welcomeTitle, welcomeText, welcomeImageAlt,
  "welcomeImageUrl": welcomeImage.asset->url,
  welcomePoints,
  directContactTitle, directContactText,
  emailAddress, phoneNumber,
  availabilityText, rehearsalInvitation,
  practicalTitle, rehearsalEvening, rehearsalTimes,
  rehearsalLocation, address,
  agendaLinkLabel, agendaLink,
  aboutLinkLabel, aboutLink,
  faqTitle, faqQuestion, faqAnswer, closingCtaText
}`;

export const REPERTOIRE_QUERY = `{
  "page": *[_id == "repertoirePage-main" && _type == "repertoirePage"][0] {
    heroTitle, heroSubtitle, heroImageAlt,
    "heroImageUrl": heroImage.asset->url,
    "featuredItemId": featuredItem->_id,
    worldsTitle, worldsIntro,
    worlds[] {
      number, title, description, imageAlt,
      "imageUrl": image.asset->url,
      "itemIds": items[]->_id
    },
    processTitle, processSteps[] {title, description},
    selectionTitle, "selectionItemIds": selectionItems[]->_id,
    quote, quoteAttribution, quoteImageAlt,
    "quoteImageUrl": quoteImage.asset->url,
    featuredImageAlt,
    "featuredImageUrl": featuredImage.asset->url,
    ctaEyebrow, ctaTitle, ctaText,
    primaryButtonLabel, primaryButtonLink,
    secondaryButtonLabel, secondaryButtonLink
  },
  "items": *[_type == "repertoireItem" && isVisible == true] | order(title asc) {
    "id": _id, title, summary, story, audioDescription,
    "audioUrl": audioFile.asset->url
  }
}`;

function text(value, maximum = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function safeUrl(value, kinds) {
  const candidate = text(value, 2048);
  if (!candidate) return '';

  if (candidate.startsWith('../') || candidate.startsWith('./') || candidate.startsWith('/')) {
    return kinds.includes('local') ? candidate : '';
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return '';
    if (kinds.includes('image') && url.hostname === 'cdn.sanity.io' && url.pathname.startsWith('/images/')) return url.href;
    if (kinds.includes('audio') && url.hostname === 'cdn.sanity.io' && url.pathname.startsWith('/files/')) return url.href;
    if (kinds.includes('link')) return url.href;
  } catch {
    return '';
  }

  return '';
}

function safeLink(value) {
  const candidate = text(value, 512);

  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(candidate)) {
    return candidate;
  }

  if (
    /^(?:\.\/|\.\.\/|\/)[A-Za-z0-9_./?=&%-]+(?:#[A-Za-z][A-Za-z0-9_-]*)?$/.test(
      candidate,
    )
  ) {
    return candidate;
  }

  return safeUrl(candidate, ['link']);
}
function youtubeId(value) {
  const candidate = text(value, 512);
  try {
    const url = new URL(candidate);
    if (url.hostname === 'youtu.be') return /^[\w-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : '';
    if (['www.youtube.com', 'youtube.com'].includes(url.hostname)) {
      const id = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).at(-1) || '';
      return /^[\w-]{11}$/.test(id) ? id : '';
    }
  } catch {
    return '';
  }
  return '';
}

function normalizePage(value = {}) {
  return {
    heroTitle: text(value.heroTitle, 96),
    heroSubtitle: text(value.heroSubtitle, 180),
    heroImageUrl: safeUrl(value.heroImageUrl, ['image', 'local']),
    heroImageAlt: text(value.heroImageAlt, 160),
    introTitle: text(value.introTitle, 120),
    introText: text(value.introText, 500),
    ctaEyebrow: text(value.ctaEyebrow, 80),
    ctaTitle: text(value.ctaTitle, 120),
    ctaText: text(value.ctaText, 280),
    primaryButtonLabel: text(value.primaryButtonLabel, 48),
    primaryButtonLink: safeLink(value.primaryButtonLink),
    secondaryButtonLabel: text(value.secondaryButtonLabel, 48),
    secondaryButtonLink: safeLink(value.secondaryButtonLink),
  };
}

function normalizePhoto(value) {
  const imageUrl = safeUrl(value?.imageUrl, ['image', 'local']);
  if (!imageUrl) return null;
  return {imageUrl, alt: text(value.alt, 160), caption: text(value.caption, 240)};
}

function normalizeAlbum(value) {
  const id = text(value?._id ?? value?.id, 120);
  const title = text(value?.title, 96);
  const coverImageUrl = safeUrl(value?.coverImageUrl, ['image', 'local']);
  if (!id || !title || !coverImageUrl) return null;
  return {
    id,
    type: 'photo',
    title,
    summary: text(value.summary, 280),
    date: /^\d{4}-\d{2}-\d{2}/.test(value.eventDate ?? value.date ?? '') ? String(value.eventDate ?? value.date).slice(0, 10) : '',
    isFeatured: value.isFeatured === true,
    coverImageUrl,
    coverImageAlt: text(value.coverImageAlt, 160),
    photos: Array.isArray(value.photos) ? value.photos.map(normalizePhoto).filter(Boolean) : [],
  };
}

function normalizeAudio(value) {
  const id = text(value?._id ?? value?.id, 120);
  const title = text(value?.title, 96);
  const audioUrl = safeUrl(value?.audioUrl, ['audio', 'local']);
  if (!id || !title || !audioUrl) return null;
  return {id, type: 'audio', title, summary: text(value.summary, 280), date: text(value.recordedAt ?? value.date, 10), isFeatured: value.isFeatured === true, audioUrl};
}

function normalizeVideo(value) {
  const id = text(value?._id ?? value?.id, 120);
  const title = text(value?.title, 96);
  const thumbnailUrl = safeUrl(value?.thumbnailUrl, ['image', 'local']);
  const idFromUrl = text(value?.youtubeId, 11) || youtubeId(value?.youtubeUrl);
  if (!id || !title || !thumbnailUrl || !/^[\w-]{11}$/.test(idFromUrl)) return null;
  return {id, type: 'video', title, summary: text(value.summary, 280), date: text(value.recordedAt ?? value.date, 10), isFeatured: value.isFeatured === true, youtubeId: idFromUrl, thumbnailUrl, thumbnailAlt: text(value.thumbnailAlt, 160)};
}

export function normalizeContent(value = {}) {
  return {
    page: normalizePage(value.page),
    photoAlbums: Array.isArray(value.photoAlbums) ? value.photoAlbums.map(normalizeAlbum).filter(Boolean) : [],
    audioItems: Array.isArray(value.audioItems) ? value.audioItems.map(normalizeAudio).filter(Boolean) : [],
    videoItems: Array.isArray(value.videoItems) ? value.videoItems.map(normalizeVideo).filter(Boolean) : [],
  };
}

function normalizeSupportItem(value) {
  return {
    title: text(value?.title, 80),
    text: text(value?.text, 260),
  };
}

function normalizeFriendItem(value, now) {
  const id = text(value?._id ?? value?.id, 120);
  const publicName = text(value?.publicName, 120);
  const imageUrl = safeUrl(value?.imageUrl, ['image', 'local']);
  const imageAlt = text(value?.imageAlt, 160);

  if (!id || !publicName || !imageUrl || !imageAlt) return null;

  const allowedFriendTypes = new Set([
    'bedrijf',
    'organisatie',
    'particulier',
    'overig',
  ]);
  const allowedImageDisplays = new Set(['logo', 'foto']);

  const friendType = allowedFriendTypes.has(value?.friendType)
    ? value.friendType
    : 'overig';
  const imageDisplay = allowedImageDisplays.has(value?.imageDisplay)
    ? value.imageDisplay
    : 'logo';

  const publishFrom = text(value?.publishFrom, 40);
  const publishUntil = text(value?.publishUntil, 40);
  const publishFromTime = publishFrom ? Date.parse(publishFrom) : null;
  const publishUntilTime = publishUntil ? Date.parse(publishUntil) : null;

  if (publishFrom && !Number.isFinite(publishFromTime)) return null;
  if (publishUntil && !Number.isFinite(publishUntilTime)) return null;
  if (
    publishFromTime !== null &&
    publishUntilTime !== null &&
    publishUntilTime <= publishFromTime
  ) {
    return null;
  }
  if (publishFromTime !== null && now < publishFromTime) return null;
  if (publishUntilTime !== null && now >= publishUntilTime) return null;

  return {
    id,
    publicName,
    friendType,
    imageDisplay,
    imageUrl,
    imageAlt,
    description: text(value?.description, 320),
    website: safeLink(value?.website),
    isFeatured: value?.isFeatured === true,
    sortOrder:
      Number.isInteger(value?.sortOrder) &&
      value.sortOrder >= 0 &&
      value.sortOrder <= 9999
        ? value.sortOrder
        : 100,
    publishFrom,
    publishUntil,
  };
}

export function normalizeFriendsContent(
  value = {},
  now = Date.now(),
) {
  const page = value.page ?? {};

  const friends = Array.isArray(value.friends)
    ? value.friends
        .map((item) => normalizeFriendItem(item, now))
        .filter(Boolean)
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.publicName.localeCompare(
              right.publicName,
              'nl',
              {sensitivity: 'base'},
            ),
        )
    : [];

  return {
    page: {
      heroTitle: text(page.heroTitle, 96),
      heroText: text(page.heroText, 280),
      heroImageUrl: safeUrl(page.heroImageUrl, ['image', 'local']),
      heroImageAlt: text(page.heroImageAlt, 160),
      heroPrimaryButtonLabel: text(
        page.heroPrimaryButtonLabel,
        48,
      ),
      heroPrimaryButtonLink: safeLink(
        page.heroPrimaryButtonLink,
      ),
      heroSecondaryButtonLabel: text(
        page.heroSecondaryButtonLabel,
        48,
      ),
      heroSecondaryButtonLink: safeLink(
        page.heroSecondaryButtonLink,
      ),
      supportTitle: text(page.supportTitle, 120),
      supportIntro: text(page.supportIntro, 360),
      supportItems: Array.isArray(page.supportItems)
        ? page.supportItems.map(normalizeSupportItem)
        : [],
      friendsTitle: text(page.friendsTitle, 120),
      friendsIntro: text(page.friendsIntro, 360),
      ctaTitle: text(page.ctaTitle, 120),
      ctaText: text(page.ctaText, 360),
      ctaBenefits: Array.isArray(page.ctaBenefits)
        ? page.ctaBenefits
            .map((benefit) => text(benefit, 160))
            .filter(Boolean)
            .slice(0, 5)
        : [],
      ctaImageUrl: safeUrl(
        page.ctaImageUrl,
        ['image', 'local'],
      ),
      ctaImageAlt: text(page.ctaImageAlt, 160),
      ctaPrimaryButtonLabel: text(
        page.ctaPrimaryButtonLabel,
        48,
      ),
      ctaPrimaryButtonLink: safeLink(
        page.ctaPrimaryButtonLink,
      ),
      ctaSecondaryButtonLabel: text(
        page.ctaSecondaryButtonLabel,
        48,
      ),
      ctaSecondaryButtonLink: safeLink(
        page.ctaSecondaryButtonLink,
      ),
    },
    friends,
  };
}

export function validateFriendsContent(content) {
  const {page, friends} = content;

  const requiredPageValues = [
    page.heroTitle,
    page.heroText,
    page.heroImageUrl,
    page.heroImageAlt,
    page.heroPrimaryButtonLabel,
    page.heroPrimaryButtonLink,
    page.heroSecondaryButtonLabel,
    page.heroSecondaryButtonLink,
    page.supportTitle,
    page.supportIntro,
    page.friendsTitle,
    page.ctaTitle,
    page.ctaText,
    page.ctaImageUrl,
    page.ctaImageAlt,
    page.ctaPrimaryButtonLabel,
    page.ctaPrimaryButtonLink,
    page.ctaSecondaryButtonLabel,
    page.ctaSecondaryButtonLink,
  ];

  if (requiredPageValues.some((value) => !value)) {
    throw new Error(
      'Verplichte vrienden-paginavelden ontbreken',
    );
  }

  if (page.supportItems.length !== 4) {
    throw new Error(
      'De vriendenpagina vereist exact vier ondersteuningsonderdelen',
    );
  }

  if (
    page.supportItems.some(
      (item) => !item.title || !item.text,
    )
  ) {
    throw new Error(
      'Een ondersteuningsonderdeel is onvolledig',
    );
  }

  if (
    page.ctaBenefits.length < 1 ||
    page.ctaBenefits.length > 5
  ) {
    throw new Error(
      'De vriendenpagina vereist één tot vijf CTA-voordelen',
    );
  }

  const duplicateIds = new Set();
  const observedIds = new Set();

  for (const friend of friends) {
    if (observedIds.has(friend.id)) {
      duplicateIds.add(friend.id);
    }
    observedIds.add(friend.id);
  }

  if (duplicateIds.size) {
    throw new Error(
      `Dubbele vriendenrecords: ${[...duplicateIds].join(', ')}`,
    );
  }

  return content;
}

function normalizeParagraphs(value) {
  return Array.isArray(value)
    ? value.map((paragraph) => text(paragraph, 500)).filter(Boolean).slice(0, 3)
    : [];
}

function normalizeAboutItems(value) {
  return Array.isArray(value)
    ? value.map((item) => ({
        title: text(item?.title, 80),
        text: text(item?.text, 300),
      }))
    : [];
}

export function normalizeAboutContent(value = {}) {
  return {
    seoTitle: text(value.seoTitle, 70),
    seoDescription: text(value.seoDescription, 170),
    heroTitle: text(value.heroTitle, 96),
    heroSubtitle: text(value.heroSubtitle, 240),
    heroImageUrl: safeUrl(value.heroImageUrl, ['image', 'local']),
    heroImageAlt: text(value.heroImageAlt, 160),
    introEyebrow: text(value.introEyebrow, 80),
    introTitle: text(value.introTitle, 120),
    introText: normalizeParagraphs(value.introText),
    introImageUrl: safeUrl(value.introImageUrl, ['image', 'local']),
    introImageAlt: text(value.introImageAlt, 160),
    timelineEyebrow: text(value.timelineEyebrow, 80),
    timelineTitle: text(value.timelineTitle, 120),
    timelineIntro: text(value.timelineIntro, 300),
    timelineItems: normalizeAboutItems(value.timelineItems),
    valuesEyebrow: text(value.valuesEyebrow, 80),
    valuesTitle: text(value.valuesTitle, 120),
    valuesItems: normalizeAboutItems(value.valuesItems),
    atmosphereEyebrow: text(value.atmosphereEyebrow, 80),
    atmosphereTitle: text(value.atmosphereTitle, 120),
    atmosphereText: normalizeParagraphs(value.atmosphereText),
    atmosphereImageUrl: safeUrl(value.atmosphereImageUrl, ['image', 'local']),
    atmosphereImageAlt: text(value.atmosphereImageAlt, 160),
    quote: text(value.quote, 280),
    quoteAttribution: text(value.quoteAttribution, 100),
    ctaEyebrow: text(value.ctaEyebrow, 80),
    ctaTitle: text(value.ctaTitle, 120),
    ctaText: text(value.ctaText, 300),
    primaryButtonLabel: text(value.primaryButtonLabel, 48),
    primaryButtonLink: safeLink(value.primaryButtonLink),
    secondaryButtonLabel: text(value.secondaryButtonLabel, 48),
    secondaryButtonLink: safeLink(value.secondaryButtonLink),
  };
}

export function validateAboutContent(content) {
  const required = [
    content.seoTitle, content.seoDescription,
    content.heroTitle, content.heroSubtitle, content.heroImageUrl, content.heroImageAlt,
    content.introEyebrow, content.introTitle, content.introImageUrl, content.introImageAlt,
    content.timelineEyebrow, content.timelineTitle,
    content.valuesEyebrow, content.valuesTitle,
    content.atmosphereEyebrow, content.atmosphereTitle,
    content.atmosphereImageUrl, content.atmosphereImageAlt,
    content.quote, content.ctaEyebrow, content.ctaTitle, content.ctaText,
    content.primaryButtonLabel, content.primaryButtonLink,
    content.secondaryButtonLabel, content.secondaryButtonLink,
  ];
  if (required.some((value) => !value)) throw new Error('Verplichte Over-paginavelden ontbreken');
  if (!content.introText.length || !content.atmosphereText.length) throw new Error('Over-pagina vereist introductie- en sfeerparagrafen');
  if (content.timelineItems.length !== 4 || content.timelineItems.some((item) => !item.title || !item.text)) {
    throw new Error('Over-pagina vereist exact vier volledige tijdlijnonderdelen');
  }
  if (content.valuesItems.length !== 4 || content.valuesItems.some((item) => !item.title || !item.text)) {
    throw new Error('Over-pagina vereist exact vier volledige waarden');
  }
}

const CONTACT_TOPIC_ICONS = new Set(['question', 'calendar', 'people', 'music']);

function normalizeEmail(value) {
  const candidate = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : '';
}

function normalizePhone(value) {
  const candidate = text(value, 40);
  const marker = candidate.match(/^\[(?:TEST|DEMO)\]\s*/i)?.[0] ?? '';
  const number = candidate.slice(marker.length);
  if (!number || !/^\+?[0-9][0-9\s().-]{5,38}$/.test(number)) return '';
  const digits = number.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? candidate : '';
}

function telephoneLink(phoneNumber) {
  if (!phoneNumber) return '';
  const compact = phoneNumber.replace(/^\[(?:TEST|DEMO)\]\s*/i, '').replace(/[^\d+]/g, '');
  return /^(\+|00)?\d{7,15}$/.test(compact) ? `tel:${compact}` : '';
}

function contactLink(value) {
  const candidate = text(value, 512);
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(candidate)) return candidate;
  if (/^tel:(?:\+|00)?\d{7,15}$/.test(candidate)) return candidate;
  return safeLink(candidate);
}

function normalizeContactTopics(value) {
  return Array.isArray(value)
    ? value.map((item) => ({
        title: text(item?.title, 80),
        text: text(item?.text, 280),
        icon: CONTACT_TOPIC_ICONS.has(item?.icon) ? item.icon : '',
        linkLabel: text(item?.linkLabel, 48),
        linkTarget: contactLink(item?.linkTarget),
      }))
    : [];
}

export function normalizeContactContent(value = {}) {
  return {
    seoTitle: text(value.seoTitle, 70),
    seoDescription: text(value.seoDescription, 170),
    heroEyebrow: text(value.heroEyebrow, 80),
    heroTitle: text(value.heroTitle, 96),
    heroIntro: text(value.heroIntro, 300),
    heroImageUrl: safeUrl(value.heroImageUrl, ['image', 'local']),
    heroImageAlt: text(value.heroImageAlt, 160),
    emailCtaLabel: text(value.emailCtaLabel, 48),
    phoneCtaLabel: text(value.phoneCtaLabel, 48),
    contactTopics: normalizeContactTopics(value.contactTopics),
    welcomeTitle: text(value.welcomeTitle, 120),
    welcomeText: text(value.welcomeText, 500),
    welcomeImageUrl: safeUrl(value.welcomeImageUrl, ['image', 'local']),
    welcomeImageAlt: text(value.welcomeImageAlt, 160),
    welcomePoints: Array.isArray(value.welcomePoints)
      ? value.welcomePoints.map((item) => text(item, 160)).filter(Boolean).slice(0, 6)
      : [],
    directContactTitle: text(value.directContactTitle, 120),
    directContactText: text(value.directContactText, 360),
    emailAddress: normalizeEmail(value.emailAddress),
    phoneNumber: normalizePhone(value.phoneNumber),
    availabilityText: text(value.availabilityText, 240),
    rehearsalInvitation: text(value.rehearsalInvitation, 280),
    practicalTitle: text(value.practicalTitle, 120),
    rehearsalEvening: text(value.rehearsalEvening, 80),
    rehearsalTimes: text(value.rehearsalTimes, 120),
    rehearsalLocation: text(value.rehearsalLocation, 160),
    address: text(value.address, 200),
    agendaLinkLabel: text(value.agendaLinkLabel, 48),
    agendaLink: contactLink(value.agendaLink),
    aboutLinkLabel: text(value.aboutLinkLabel, 48),
    aboutLink: contactLink(value.aboutLink),
    faqTitle: text(value.faqTitle, 120),
    faqQuestion: text(value.faqQuestion, 180),
    faqAnswer: text(value.faqAnswer, 600),
    closingCtaText: text(value.closingCtaText, 280),
  };
}

export function validateContactContent(content) {
  const required = [
    content.seoTitle, content.seoDescription,
    content.heroTitle, content.heroIntro,
    content.heroImageUrl, content.heroImageAlt,
    content.emailCtaLabel, content.phoneCtaLabel,
    content.welcomeTitle, content.welcomeText,
    content.welcomeImageUrl, content.welcomeImageAlt,
    content.directContactTitle, content.directContactText,
    content.practicalTitle, content.rehearsalEvening,
    content.faqTitle, content.faqQuestion, content.faqAnswer,
  ];
  if (required.some((value) => !value)) {
    throw new Error('Verplichte Contact-paginavelden ontbreken');
  }
  if (
    content.contactTopics.length !== 4 ||
    content.contactTopics.some((item) =>
      !item.title || !item.text || !item.icon)
  ) {
    throw new Error('Contactpagina vereist exact vier volledige contactonderwerpen');
  }
  if (!content.welcomePoints.length) {
    throw new Error('Contactpagina vereist minimaal één welkomstkernpunt');
  }
}

const REPERTOIRE_IMAGE_DEFAULTS = {
  featuredImageUrl: '../images/repertoire/repertoire-uitgelicht.jpg',
  featuredImageAlt: 'Zangers van Spontaan tijdens een warm en betrokken lied',
  quoteImageUrl: '../images/repertoire/repertoire-dirigent.jpg',
  quoteImageAlt: 'De dirigent van Zanggroep Spontaan leidt het mannenkoor',
  worlds: [
    {
      imageUrl: '../images/repertoire/repertoire-klassiek.jpg',
      imageAlt: 'Zanggroep Spontaan zingt klassieke koormuziek in een kerk',
    },
    {
      imageUrl: '../images/repertoire/repertoire-nederlandstalig.jpg',
      imageAlt: 'Zanggroep Spontaan zingt in een warme en herkenbare sfeer',
    },
    {
      imageUrl: '../images/repertoire/repertoire-feestelijk.jpg',
      imageAlt: 'Zanggroep Spontaan tijdens een energiek en feestelijk optreden',
    },
  ],
};
function normalizeRepertoireItem(value) {
  const id = text(value?.id ?? value?._id, 120);
  const title = text(value?.title, 120);
  if (!id || !title) return null;
  return {
    id,
    title,
    summary: text(value.summary, 240),
    story: text(value.story, 800),
    audioUrl: safeUrl(value.audioUrl, ['audio', 'local']),
    audioDescription: text(value.audioDescription, 160),
  };
}

function normalizeRepertoireWorld(value, index) {
  const defaults =
    REPERTOIRE_IMAGE_DEFAULTS.worlds[index] ??
    REPERTOIRE_IMAGE_DEFAULTS.worlds[0];

  return {
    number: text(value?.number, 3),
    title: text(value?.title, 80),
    description: text(value?.description, 220),
    imageUrl:
      safeUrl(value?.imageUrl, ['image', 'local']) ||
      defaults.imageUrl,
    imageAlt:
      text(value?.imageAlt, 160) ||
      defaults.imageAlt,
    itemIds: Array.isArray(value?.itemIds)
      ? value.itemIds.map((id) => text(id, 120)).filter(Boolean)
      : [],
  };
}

function normalizeProcessStep(value) {
  return {title: text(value?.title, 60), description: text(value?.description, 220)};
}

export function normalizeRepertoireContent(value = {}) {
  const page = value.page ?? {};
  return {
    page: {
      heroTitle: text(page.heroTitle, 96),
      heroSubtitle: text(page.heroSubtitle, 220),
      heroImageUrl: safeUrl(page.heroImageUrl, ['image', 'local']),
      heroImageAlt: text(page.heroImageAlt, 160),
      featuredItemId: text(page.featuredItemId, 120),
      featuredImageUrl:
        safeUrl(page.featuredImageUrl, ['image', 'local']) ||
        REPERTOIRE_IMAGE_DEFAULTS.featuredImageUrl,
      featuredImageAlt:
        text(page.featuredImageAlt, 160) ||
        REPERTOIRE_IMAGE_DEFAULTS.featuredImageAlt,
      worldsTitle: text(page.worldsTitle, 120),
      worldsIntro: text(page.worldsIntro, 300),
      worlds: Array.isArray(page.worlds) ? page.worlds.map(normalizeRepertoireWorld) : [],
      processTitle: text(page.processTitle, 120),
      processSteps: Array.isArray(page.processSteps) ? page.processSteps.map(normalizeProcessStep) : [],
      selectionTitle: text(page.selectionTitle, 120),
      selectionItemIds: Array.isArray(page.selectionItemIds) ? page.selectionItemIds.map((id) => text(id, 120)).filter(Boolean) : [],
      quote: text(page.quote, 280),
      quoteAttribution: text(page.quoteAttribution, 100),
      quoteImageUrl:
        safeUrl(page.quoteImageUrl, ['image', 'local']) ||
        REPERTOIRE_IMAGE_DEFAULTS.quoteImageUrl,
      quoteImageAlt:
        text(page.quoteImageAlt, 160) ||
        REPERTOIRE_IMAGE_DEFAULTS.quoteImageAlt,
      ctaEyebrow: text(page.ctaEyebrow, 80),
      ctaTitle: text(page.ctaTitle, 120),
      ctaText: text(page.ctaText, 280),
      primaryButtonLabel: text(page.primaryButtonLabel, 48),
      primaryButtonLink: safeLink(page.primaryButtonLink),
      secondaryButtonLabel: text(page.secondaryButtonLabel, 48),
      secondaryButtonLink: safeLink(page.secondaryButtonLink),
    },
    items: Array.isArray(value.items) ? value.items.map(normalizeRepertoireItem).filter(Boolean) : [],
  };
}

export function validateRepertoireContent(content) {
  const {page, items} = content;
  const requiredText = [
    page.heroTitle, page.heroSubtitle, page.heroImageUrl, page.featuredItemId,
    page.worldsTitle, page.worldsIntro, page.processTitle, page.selectionTitle,
    page.quote, page.quoteAttribution, page.ctaTitle, page.ctaText,
    page.primaryButtonLabel, page.primaryButtonLink,
    page.secondaryButtonLabel, page.secondaryButtonLink,
  ];
  if (requiredText.some((value) => !value)) throw new Error('Verplichte repertoire-paginavelden ontbreken');
  if (page.worlds.length !== 3) throw new Error('Repertoire vereist exact drie muzikale werelden');
  if (page.processSteps.length !== 4) throw new Error('Repertoire vereist exact vier processtappen');
  const byId = new Map(items.map((item) => [item.id, item]));
  const featured = byId.get(page.featuredItemId);
  if (!featured) throw new Error(`Uitgelicht repertoire-item ontbreekt: ${page.featuredItemId}`);
  if (!featured.story || !featured.audioUrl) throw new Error('Uitgelicht repertoire-item vereist één gekoppeld verhaal en audiofragment');
  for (const world of page.worlds) {
    if (!world.number || !world.title || !world.description || !world.imageUrl || !world.imageAlt || !world.itemIds.length) throw new Error('Muzikale wereld is onvolledig');
    if (world.itemIds.some((id) => !byId.has(id))) throw new Error(`Muzikale wereld verwijst naar onbekend repertoire-item: ${world.title}`);
  }
  if (!page.selectionItemIds.length || page.selectionItemIds.some((id) => !byId.has(id))) {
    throw new Error('Repertoireselectie bevat een ontbrekend item');
  }
  return {byId, featured};
}

const HOME_QUERY = `*[_id == "homePage-main" && _type == "homePage"][0] {
  heroTitle,
  heroSubtitle,
  "heroImageUrl": heroImage.asset->url,
  ctaLabel,
  ctaLink,
  quickLinksTitle,
  quickLinksIntro,
  quickLinks[] {
    title,
    text,
    "imageUrl": image.asset->url,
    buttonLabel,
    buttonLink
  },
  welcomeTitle,
  welcomeText,
  welcomeButtonLabel,
  welcomeButtonLink,
  visitTitle,
  visitText,
  visitPrimaryButtonLabel,
  visitPrimaryButtonLink,
  visitSecondaryButtonLabel,
  visitSecondaryButtonLink
}`;

function homeProjectPath(value, kind) {
  const candidate = text(value, 2048);

  if (!candidate) {
    return '';
  }

  const throughSharedHelper =
    kind === 'image'
      ? safeUrl(candidate, ['image', 'local'])
      : safeLink(candidate);

  if (throughSharedHelper) {
    return throughSharedHelper;
  }

  if (
    candidate.includes('\\') ||
    candidate.includes(':') ||
    candidate.startsWith('//') ||
    candidate.split('/').includes('..')
  ) {
    return '';
  }

  const pattern =
    kind === 'image'
      ? /^[A-Za-z0-9_][A-Za-z0-9_./%-]*\.(?:avif|gif|jpe?g|png|svg|webp)$/i
      : /^[A-Za-z0-9_][A-Za-z0-9_./?=&%-]*(?:#[A-Za-z][A-Za-z0-9_-]*)?$/;

  return pattern.test(candidate) ? candidate : '';
}

function normalizeHomeQuickLinks(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 3)
    .map((item) => ({
      title: text(item?.title, 80),
      text: text(item?.text, 240),
      imageUrl: homeProjectPath(item?.imageUrl, 'image'),
      mediaClass: text(item?.mediaClass, 40)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, ''),
      buttonLabel: text(item?.buttonLabel, 80),
      buttonLink: homeProjectPath(item?.buttonLink, 'link'),
    }));
}

export function normalizeHomeContent(value) {
  const source =
    value && typeof value === 'object'
      ? value
      : {};

  return {
    heroTitle: text(source.heroTitle, 100),
    heroSubtitle: text(source.heroSubtitle, 180),
    heroImageUrl: homeProjectPath(
      source.heroImageUrl,
      'image',
    ),
    ctaLabel: text(source.ctaLabel, 80),
    ctaLink: homeProjectPath(source.ctaLink, 'link'),
    quickLinksTitle: text(source.quickLinksTitle, 100),
    quickLinksIntro: text(source.quickLinksIntro, 300),
    quickLinks: normalizeHomeQuickLinks(
      source.quickLinks,
    ),
    welcomeTitle: text(source.welcomeTitle, 120),
    welcomeText: text(source.welcomeText, 600),
    welcomeButtonLabel: text(
      source.welcomeButtonLabel,
      80,
    ),
    welcomeButtonLink: homeProjectPath(
      source.welcomeButtonLink,
      'link',
    ),
    visitTitle: text(source.visitTitle, 120),
    visitText: text(source.visitText, 600),
    visitPrimaryButtonLabel: text(
      source.visitPrimaryButtonLabel,
      80,
    ),
    visitPrimaryButtonLink: homeProjectPath(
      source.visitPrimaryButtonLink,
      'link',
    ),
    visitSecondaryButtonLabel: text(
      source.visitSecondaryButtonLabel,
      80,
    ),
    visitSecondaryButtonLink: homeProjectPath(
      source.visitSecondaryButtonLink,
      'link',
    ),
  };
}

export function validateHomeContent(content) {
  const required = [
    content.heroTitle,
    content.heroSubtitle,
    content.quickLinksTitle,
    content.quickLinksIntro,
    content.welcomeTitle,
    content.welcomeText,
    content.welcomeButtonLabel,
    content.welcomeButtonLink,
    content.visitTitle,
    content.visitText,
    content.visitPrimaryButtonLabel,
    content.visitPrimaryButtonLink,
    content.visitSecondaryButtonLabel,
    content.visitSecondaryButtonLink,
  ];

  if (required.some((value) => !value)) {
    throw new Error(
      'Verplichte Homepage-velden ontbreken',
    );
  }

  if (
    content.quickLinks.length !== 3 ||
    content.quickLinks.some(
      (item) =>
        !item.title ||
        !item.text ||
        !item.buttonLabel ||
        !item.buttonLink,
    )
  ) {
    throw new Error(
      'De Homepage vereist exact drie volledige snelkoppelingen',
    );
  }
}

function renderHomeButton(
  label,
  link,
  secondary = false,
) {
  if (!label || !link) {
    return '';
  }

  const className = secondary
    ? 'btn btn--secondary'
    : 'btn';

  return (
    `<a class="${className}" ` +
    `href="${escapeHtml(link)}">` +
    `${escapeHtml(label)}</a>`
  );
}

function renderHomeQuickLinks(items) {
  return items
    .map((item) => {
      const mediaModifier =
        item.mediaClass ||
        item.title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

      const imageStyle = item.imageUrl
        ? (
            ' style="background-image: ' +
            'linear-gradient(135deg, ' +
            'rgba(79, 23, 127, 0.72), ' +
            'rgba(217, 13, 135, 0.5)), ' +
            `url(&quot;${escapeHtml(item.imageUrl)}&quot;)"`
          )
        : '';

      return (
        '<article class="homepage-card">' +
        `<div class="homepage-card__media ` +
        `homepage-card__media--${escapeHtml(mediaModifier)}"` +
        `${imageStyle} aria-hidden="true"></div>` +
        '<div class="homepage-card__content">' +
        `<h3>${escapeHtml(item.title)}</h3>` +
        `<p>${escapeHtml(item.text)}</p>` +
        renderHomeButton(
          item.buttonLabel,
          item.buttonLink,
        ) +
        '</div>' +
        '</article>'
      );
    })
    .join('');
}

function replaceHomeText(
  html,
  attribute,
  value,
  description,
) {
  return replaceRequired(
    html,
    new RegExp(
      `(<[^>]+${attribute}[^>]*>)[\\s\\S]*?(</[^>]+>)`,
    ),
    `$1${escapeHtml(value)}$2`,
    description,
  );
}

export function renderHomePage(
  template,
  content,
  source,
) {
  validateHomeContent(content);

  let html = template;

  html = replaceRequired(
    html,
    /<html lang="nl" data-home-source="fallback">/,
    `<html lang="nl" data-home-source="${escapeHtml(source)}">`,
    'Homepage contentbron',
  );

  html = replaceHomeText(
    html,
    'data-homepage-hero-title',
    content.heroTitle,
    'Homepage herotitel',
  );

  html = replaceHomeText(
    html,
    'data-homepage-hero-subtitle',
    content.heroSubtitle,
    'Homepage herosubtitel',
  );

  html = replaceHomeText(
    html,
    'data-homepage-quicklinks-title',
    content.quickLinksTitle,
    'Homepage snelkoppelingstitel',
  );

  html = replaceHomeText(
    html,
    'data-homepage-quicklinks-intro',
    content.quickLinksIntro,
    'Homepage snelkoppelingenintro',
  );

  html = replaceHomeText(
    html,
    'data-homepage-welcome-title',
    content.welcomeTitle,
    'Homepage welkomsttitel',
  );

  html = replaceHomeText(
    html,
    'data-homepage-welcome-text',
    content.welcomeText,
    'Homepage welkomsttekst',
  );

  html = replaceHomeText(
    html,
    'data-homepage-visit-title',
    content.visitTitle,
    'Homepage bezoektitel',
  );

  html = replaceHomeText(
    html,
    'data-homepage-visit-text',
    content.visitText,
    'Homepage bezoektekst',
  );

  const heroStyle = content.heroImageUrl
    ? (
        ' style="background-image: ' +
        'linear-gradient(135deg, ' +
        'rgba(79, 23, 127, 0.78), ' +
        'rgba(217, 13, 135, 0.57)), ' +
        `url(&quot;${escapeHtml(content.heroImageUrl)}&quot;)"`
      )
    : '';

  html = replaceRequired(
    html,
    /<header class="hero">/,
    `<header class="hero"${heroStyle}>`,
    'Homepage hero-afbeelding',
  );

  const heroButton = renderHomeButton(
    content.ctaLabel,
    content.ctaLink,
  );

  html = replaceRequired(
    html,
    /<p class="hero-actions" data-homepage-cta-container hidden><\/p>/,
    heroButton
      ? (
          '<p class="hero-actions" ' +
          'data-homepage-cta-container>' +
          heroButton +
          '</p>'
        )
      : (
          '<p class="hero-actions" ' +
          'data-homepage-cta-container hidden></p>'
        ),
    'Homepage hero-CTA',
  );

  html = replaceRequired(
    html,
    /(<div class="homepage-card-grid" data-homepage-quicklinks>)[\s\S]*?(<\/div>\s*<\/section>)/,
    `$1${renderHomeQuickLinks(content.quickLinks)}$2`,
    'Homepage snelkoppelingen',
  );

  html = replaceRequired(
    html,
    /<p class="homepage-actions" data-homepage-welcome-cta>[\s\S]*?<\/p>/,
    (
      '<p class="homepage-actions" ' +
      'data-homepage-welcome-cta>' +
      renderHomeButton(
        content.welcomeButtonLabel,
        content.welcomeButtonLink,
      ) +
      '</p>'
    ),
    'Homepage welkomst-CTA',
  );

  html = replaceRequired(
    html,
    /<p class="homepage-actions" data-homepage-visit-cta>[\s\S]*?<\/p>/,
    (
      '<p class="homepage-actions" ' +
      'data-homepage-visit-cta>' +
      renderHomeButton(
        content.visitPrimaryButtonLabel,
        content.visitPrimaryButtonLink,
      ) +
      renderHomeButton(
        content.visitSecondaryButtonLabel,
        content.visitSecondaryButtonLink,
        true,
      ) +
      '</p>'
    ),
    'Homepage bezoek-CTA’s',
  );

  assertNoMojibake(
    html,
    `gerenderde Homepage (${source})`,
  );

  return html;
}

export async function fetchHomeCmsContent() {
  const fixturePath =
    process.env.HOME_BUILD_FIXTURE?.trim();

  if (fixturePath) {
    const fixture = JSON.parse(
      await readFile(resolve(ROOT, fixturePath), 'utf8'),
    );

    if (fixture.error) {
      throw new Error(String(fixture.error));
    }

    return fixture.result ?? null;
  }

  const dataset = resolveSanityDataset();
  const projectId =
    process.env.SANITY_PROJECT_ID?.trim() ||
    'u66p1mxm';
  const apiVersion =
    process.env.SANITY_API_VERSION?.trim() ||
    '2025-02-19';

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const url =
      `https://${projectId}.api.sanity.io/` +
      `v${apiVersion}/data/query/${dataset}` +
      `?query=${encodeURIComponent(HOME_QUERY)}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Sanity Homepage-request mislukt met status ` +
        `${response.status}`,
      );
    }

    const payload = await response.json();

    if (payload.error) {
      throw new Error(
        payload.error.description ||
        payload.error.message ||
        'Onbekende Sanity-fout',
      );
    }

    return payload.result ?? null;
  } finally {
    clearTimeout(timeout);
  }
}
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
const escapeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

function image(src, alt, width, height, loading = 'lazy', extra = '') {
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="${width}" height="${height}" loading="${loading}"${extra}>`;
}

function featured(item) {
  if (!item) return '<p class="media-empty-state">Er is momenteel geen uitgelicht item beschikbaar.</p>';
  const source = item.type === 'photo' ? item.coverImageUrl : item.thumbnailUrl;
  const alt = item.type === 'photo' ? item.coverImageAlt : item.thumbnailAlt;
  const visual = source ? image(source, alt || item.title, 480, 260, 'eager') : '<span class="media-featured__audio-icon" aria-hidden="true"></span>';
  const action = item.type === 'photo'
    ? `<button class="media-highlight-card__link" type="button" data-media-album-button data-media-album-id="${escapeHtml(item.id)}">Bekijk foto&#39;s &rarr;</button>`
    : item.type === 'audio'
      ? `<button class="media-highlight-card__link" type="button" data-audio-url="${escapeHtml(item.audioUrl)}" aria-pressed="false" aria-label="Speel ${escapeHtml(item.title)} af">Beluister opname &rarr;</button>`
      : `<button class="media-highlight-card__link" type="button" data-youtube-id="${escapeHtml(item.youtubeId)}" aria-label="Speel ${escapeHtml(item.title)} af">Bekijk video &rarr;</button>`;
  return `<div class="media-highlight-card__image">${visual}</div><div class="media-highlight-card__content"><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary || 'Bekijk of beluister dit uitgelichte item.')}</p>${action}</div>`;
}

function photoTiles(items) {
  if (!items.length) return '<p class="media-empty-state">Er zijn momenteel geen fotoalbums beschikbaar.</p>';
  return items.slice(0, 4).map((album) => `<article class="media-photo-tile">${image(album.coverImageUrl, album.coverImageAlt || album.title, 360, 240)}<div class="media-photo-tile__content"><h3>${escapeHtml(album.title)}</h3><p>${album.photos.length} foto${album.photos.length === 1 ? '' : 's'}</p></div><button class="media-photo-tile__button" type="button" data-media-album-button data-media-album-id="${escapeHtml(album.id)}" aria-label="Bekijk fotoalbum ${escapeHtml(album.title)}"></button></article>`).join('');
}

function audioTiles(items) {
  if (!items.length) return '<p class="media-empty-state">Er zijn momenteel geen audio-opnamen beschikbaar.</p>';
  return items.slice(0, 2).map((item) => `<article class="media-audio-tile"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || 'Audio-opname van Zanggroep Spontaan')}</p><div class="media-audio-control"><button class="media-audio-control__play" type="button" data-audio-url="${escapeHtml(item.audioUrl)}" data-state="play" aria-pressed="false" aria-label="Speel ${escapeHtml(item.title)} af"></button><span class="media-audio-control__wave" aria-hidden="true"><span class="media-audio-control__progress"></span></span><span class="media-audio-control__time">0:00 / --:--</span><span class="media-audio-control__status" role="status" aria-live="polite">Gereed</span></div></article>`).join('');
}

function videoTiles(items) {
  if (!items.length) return '<p class="media-empty-state">Er zijn momenteel geen video-opnamen beschikbaar.</p>';
  return items.slice(0, 2).map((item) => `<article class="media-video-tile"><button class="media-video-tile__preview" type="button" data-youtube-id="${escapeHtml(item.youtubeId)}" aria-label="Speel ${escapeHtml(item.title)} af">${image(item.thumbnailUrl, item.thumbnailAlt || item.title, 640, 360)}<span class="media-video-tile__play-icon" aria-hidden="true"></span></button><div class="media-video-tile__meta"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.date || 'Video')}</p></div></article>`).join('');
}

const REPERTOIRE_WIREFRAME_PRESENTATION = {
  heroTitle: 'Muziek en repertoire',
  heroSubtitle: 'Verhalen die we samen tot leven zingen.',
  worldsTitle: 'Onze muzikale wereld',
  worldsIntro: 'Diverse stijlen, één doel: samen verhalen tot leven brengen.',
  processTitle: 'Hoe een muziekstuk gaat leven',
  selectionTitle: 'Een greep uit ons repertoire',
  quote: 'Een lied krijgt pas betekenis wanneer we het samen vertellen.',
  quoteAttribution: 'Onze muzikale leider',
  ctaTitle: 'Nieuwsgierig naar onze muziek?',
  ctaText: 'Kom luisteren tijdens een repetitie.',
};

function stripTestPrefix(value) {
  return String(value ?? '').replace(/^\[TEST\]\s*/i, '').trim();
}

function wireframePresentation(content) {
  const isTestContent = content.page.heroTitle.startsWith('[TEST]');
  if (!isTestContent) return content;

  const existing = new Map(content.items.map((item) => [stripTestPrefix(item.title), item]));
  const audioSource = content.items.filter((item) => item.audioUrl);
  const titleSpecs = [
    ['The Rose', audioSource[0]], ['The Sound of Silence — arr. Carl Goff / Roger Emerson'],
    ['Nunc dimittis — Ola Gjeilo'], ['Avond', audioSource[1]], ['Toen de dagen komen'],
    ['Als de dag van toen'], ['Joy to the Lord — M. Schröder'], ['Shine — L. Larson'],
    ['Hallelujah', audioSource[2]], ['Het Dorp'], ['Vamos a Cantar'],
  ];
  const items = titleSpecs.map(([title, source], index) => {
    const found = existing.get(title) || source;
    return {
      id: `wireframe-item-${index + 1}`,
      title: `[TEST] ${title}`,
      summary: found?.summary || '',
      story: found?.story || (
        title === 'The Rose'
          ? 'Een ode aan liefde, hoop en herinnering: ontdek de muzikale reis die dit lied binnen onze samenzang aflegt.'
          : ''
      ),
      audioUrl: found?.audioUrl || '',
      audioDescription: found?.audioDescription || `Luisterfragment van ${title}`,
    };
  });

  return {
    page: {
      ...content.page,
      ...REPERTOIRE_WIREFRAME_PRESENTATION,
      featuredItemId: items[0].id,
      worlds: [
        {number:'01', title:'Krachtig en klassiek', description:'Van monumentaal tot intiem en verstild. Bijvoorbeeld deze stukken:', imageUrl:'../images/repertoire/repertoire-klassiek.jpg', imageAlt:'Zanggroep Spontaan zingt klassieke koormuziek', itemIds:[items[0].id,items[1].id,items[2].id]},
        {number:'02', title:'Warm en Nederlandstalig', description:'Dichtbij en herkenbaar – liederen die ons raken en verbinden.', imageUrl:'../images/repertoire/repertoire-nederlandstalig.jpg', imageAlt:'Zanggroep Spontaan zingt Nederlandstalige muziek', itemIds:[items[3].id,items[4].id,items[5].id]},
        {number:'03', title:'Swingend en feestelijk', description:'Opzwepende klanken vol energie om mee te vieren en genieten.', imageUrl:'../images/repertoire/repertoire-feestelijk.jpg', imageAlt:'Zanggroep Spontaan tijdens een feestelijk optreden', itemIds:[items[6].id,items[7].id,items[8].id]},
      ],
      processSteps: [
        {title:'Kiezen', description:'We selecteren muziek die leeft bij ons en ons publiek.'},
        {title:'Instuderen', description:'We werken aan ritme, klank, uitspraak en muzikale interpretatie.'},
        {title:'Samenklank', description:'We groeien als koor, met oog voor detail en voor elkaar.'},
        {title:'Optreden', description:'We delen onze muziek en ons verhaal op het podium.'},
      ],
      selectionItemIds:[items[0].id,items[3].id,items[9].id,items[1].id,items[7].id,items[2].id],
      primaryButtonLabel:'Kom kennismaken', primaryButtonLink:'./contact.html',
      secondaryButtonLabel:'Bekijk Beeld en Geluid', secondaryButtonLink:'./media.html',
    },
    items,
  };
}

function repertoireAudioCard(item) {
  if (!item.audioUrl) return '';
  const description = item.audioDescription || `Luisterfragment van ${item.title}`;
  return `<article class="repertoire-audio-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(description)}</p><div class="media-audio-control"><button class="media-audio-control__play" type="button" data-audio-url="${escapeHtml(item.audioUrl)}" data-audio-title="${escapeHtml(item.title)}" data-state="play" aria-pressed="false" aria-label="Speel ${escapeHtml(item.title)} af"></button><span class="media-audio-control__wave" aria-hidden="true"><span class="media-audio-control__progress"></span></span><span class="media-audio-control__time">0:00 / --:--</span><span class="media-audio-control__status" role="status" aria-live="polite">Gereed</span></div><a class="repertoire-audio-card__link" href="#muziekstuk-proces">Bekijk transcriptie</a></article>`;
}

export function renderRepertoirePage(template, originalContent, source) {
  const content = wireframePresentation(originalContent);
  const {page} = content;
  const {byId, featured: featuredItem} = validateRepertoireContent(content);
  const worlds = page.worlds.map((world, index) => {
    const reverse = index % 2 === 1 ? ' repertoire-world--reverse' : '';
    return `<article class="repertoire-world${reverse}"><div class="repertoire-world__content"><span class="repertoire-world__number">${escapeHtml(world.number)}</span><h3>${escapeHtml(world.title)}</h3><p>${escapeHtml(world.description)}</p><ul>${world.itemIds.map((id) => `<li>${escapeHtml(byId.get(id).title)}</li>`).join('')}</ul></div>${image(world.imageUrl, world.imageAlt, 1200, 900)}</article>`;
  }).join('');
  const audioItems = content.items.filter((item) => item.audioUrl).slice(0, 3);
  const processIcons = [
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c.4-4 2.3-6 5-6s4.6 2 5 6M11 20c.4-4 2.3-6 5-6s4.6 2 5 6"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  ];
  const process = page.processSteps.map((step, index) => `<li><span aria-hidden="true">${processIcons[index]}</span><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.description)}</p></li>`).join('');
  const tags = page.selectionItemIds.map((id) => `<span>${escapeHtml(byId.get(id).title)}</span>`).join('');
  const heroDecor = '<div class="repertoire-hero__decor" aria-hidden="true"><span class="repertoire-hero__note repertoire-hero__note--one">♪</span><span class="repertoire-hero__note repertoire-hero__note--two">♫</span><span class="repertoire-hero__note repertoire-hero__note--three">♪</span><span class="repertoire-hero__waveform"></span><span class="repertoire-hero__sheet"></span></div>';
  const header = `<header class="repertoire-hero">${image(page.heroImageUrl, page.heroImageAlt, 1920, 1080, 'eager', ' class="repertoire-hero__image" fetchpriority="high"')}${heroDecor}<div class="repertoire-hero__content"><p class="repertoire-breadcrumb">Home / Muziek en repertoire</p><h1>${escapeHtml(page.heroTitle)}</h1><p>${escapeHtml(page.heroSubtitle)}</p></div></header>`;
  const main = `<main class="repertoire-page">
    <section class="repertoire-feature" aria-labelledby="repertoire-feature-title"><div class="repertoire-feature__visual">${image(page.featuredImageUrl, page.featuredImageAlt, 1200, 900, 'eager')}</div><div class="repertoire-feature__content"><p class="repertoire-label">Verhaal</p><h2 id="repertoire-feature-title">Uitgelicht: muziek met een verhaal</h2><h3>${escapeHtml(featuredItem.title)}</h3><p>${escapeHtml(featuredItem.story)}</p><div class="repertoire-actions"><a class="btn" href="#muziekstuk-proces">Lees het verhaal</a><a class="btn btn--secondary" href="#onze-muziek">In ons repertoire</a></div></div></section>
    <section id="onze-muziek" class="repertoire-section" aria-labelledby="repertoire-worlds-title"><div class="repertoire-heading"><h2 id="repertoire-worlds-title">${escapeHtml(page.worldsTitle)}</h2><p>${escapeHtml(page.worldsIntro)}</p></div><div class="repertoire-worlds">${worlds}</div></section>
    <section id="luister-mee" class="repertoire-section" aria-labelledby="listen-title"><div class="repertoire-heading"><h2 id="listen-title">Luister mee</h2><p>Ontdek deze greep uit ons repertoire.</p></div><div class="repertoire-audio-grid" id="featured-audio">${audioItems.map(repertoireAudioCard).join('')}</div></section>
    <section id="muziekstuk-proces" class="repertoire-section" aria-labelledby="process-title"><div class="repertoire-heading"><h2 id="process-title">${escapeHtml(page.processTitle)}</h2><p>Van eerste noot tot uitvoering op het podium.</p></div><ol class="repertoire-process">${process}</ol></section>
    <section class="repertoire-selection" aria-labelledby="selection-title"><h2 id="selection-title">${escapeHtml(page.selectionTitle)}</h2><div class="repertoire-tags" aria-label="Repertoireselectie">${tags}</div><a class="btn btn--secondary" href="./contact.html">Bekijk het volledige repertoire</a></section>
    <figure class="repertoire-quote"><div class="repertoire-quote__content"><blockquote><p>${escapeHtml(page.quote)}</p></blockquote><figcaption>— ${escapeHtml(page.quoteAttribution)}</figcaption></div>${image(page.quoteImageUrl, page.quoteImageAlt, 1200, 900)}</figure>
    <section class="repertoire-cta" aria-labelledby="repertoire-cta-title"><div class="repertoire-cta__notes" aria-hidden="true"><span>♪</span><span>♫</span></div><div><h2 id="repertoire-cta-title">${escapeHtml(page.ctaTitle)}</h2><p>${escapeHtml(page.ctaText)}</p></div><div class="repertoire-actions"><a class="btn" href="${escapeHtml(page.primaryButtonLink)}">${escapeHtml(page.primaryButtonLabel)}</a><a class="btn btn--secondary" href="${escapeHtml(page.secondaryButtonLink)}">${escapeHtml(page.secondaryButtonLabel)}</a></div></section>
  </main>`;
  let html = replaceRequired(template, /<header class="repertoire-hero">[\s\S]*?<\/header>/, header, 'repertoirehero');
  html = replaceRequired(html, /<main class="repertoire-page">[\s\S]*?<\/main>/, main, 'repertoire-inhoud');
  return replaceRequired(html, /<script type="module" src="\.\.\/js\/repertoire\.js"><\/script>/, `<script>document.documentElement.dataset.repertoireSource=${JSON.stringify(source)};</script>\n  <script type="module" src="../js/repertoire.js"></script>`, 'repertoirescript');
}

function replaceRequired(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`Templateonderdeel ontbreekt: ${label}`);
  return html.replace(pattern, replacement);
}

function replaceLink(html, attribute, href, label, description) {
  const pattern = new RegExp(
    `(<a(?=[^>]*${attribute})[^>]*>)[\\s\\S]*?(<\\/a>)`,
  );

  if (!pattern.test(html)) {
    throw new Error(`Templateonderdeel ontbreekt: ${description}`);
  }

  return html.replace(pattern, (match, opening, closing) => {
    const safeHref = escapeHtml(href);
    const updatedOpening = /href="[^"]*"/.test(opening)
      ? opening.replace(/href="[^"]*"/, `href="${safeHref}"`)
      : opening.replace(/>$/, ` href="${safeHref}">`);

    return `${updatedOpening}${escapeHtml(label)}${closing}`;
  });
}

const FRIENDS_SUPPORT_ICONS = [
  '<svg viewBox="0 0 48 48" role="img" aria-label="Muziek maken"><path d="M17 34a6 6 0 1 1-4-5.65V13l22-4v20a6 6 0 1 1-4-5.65V15.2l-14 2.55V34Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  '<svg viewBox="0 0 48 48" role="img" aria-label="Groei en ontwikkeling"><circle cx="18" cy="16" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="31" cy="18" r="4" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M8 36c1-7 5-11 10-11s9 4 10 11M26 36c.5-5 3-8 7-8s7 3 7 8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 48 48" role="img" aria-label="Verbinden"><circle cx="15" cy="17" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="33" cy="17" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M6 36c1-7 4-11 9-11s8 4 9 11M24 36c1-7 4-11 9-11s8 4 9 11M19 23h10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 48 48" role="img" aria-label="Cultuur in de regio"><path d="M19 34a6 6 0 1 1-4-5.65V12l20-4v20a6 6 0 1 1-4-5.65V14.2l-12 2.2V34Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
];

function renderFriendsSupportItems(items) {
  return items.map((item, index) => `
    <article class="friends-support-card">
      <div class="friends-support-card__icon">
        ${FRIENDS_SUPPORT_ICONS[index] ?? FRIENDS_SUPPORT_ICONS[0]}
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text)}</p>
    </article>
  `).join('');
}

function renderFriendCards(items) {
  if (!items.length) {
    return '<p class="friends-empty-state">Er zijn momenteel geen vrienden of sponsors gepubliceerd.</p>';
  }

  return items.map((friend) => {
    const image = `
      <img
        src="${escapeHtml(friend.imageUrl)}"
        alt="${escapeHtml(friend.imageAlt)}"
        width="320"
        height="180"
        loading="lazy"
      >
    `;

    const content = `
      <article
        class="friends-partner-card friends-partner-card--${escapeHtml(friend.imageDisplay)}"
        data-friend-id="${escapeHtml(friend.id)}"
      >
        <div class="friends-partner-card__visual">
          ${image}
        </div>
        <h3>${escapeHtml(friend.publicName)}</h3>
        ${friend.description
          ? `<p>${escapeHtml(friend.description)}</p>`
          : ''}
      </article>
    `;

    if (!friend.website) return content;

    const external = /^https:\/\//.test(friend.website);

    return `
      <a
        class="friends-partner-link"
        href="${escapeHtml(friend.website)}"
        ${external ? 'rel="noopener noreferrer"' : ''}
        aria-label="Bezoek de website van ${escapeHtml(friend.publicName)}"
      >
        ${content}
      </a>
    `;
  }).join('');
}

function renderFriendsBenefits(items) {
  return items.map((item) => `
    <li>
      <span aria-hidden="true">✓</span>
      ${escapeHtml(item)}
    </li>
  `).join('');
}

export function renderFriendsPage(template, content, source) {
  validateFriendsContent(content);

  const {page, friends} = content;
  let html = template;

  html = replaceRequired(
    html,
    /<img(?=[^>]*\bclass="friends-hero__image")(?=[^>]*\bdata-friends-hero-image\b)[^>]*>/,
    image(
      page.heroImageUrl,
      page.heroImageAlt,
      1620,
      720,
      'eager',
      ' class="friends-hero__image" data-friends-hero-image fetchpriority="high"',
    ),
    'vrienden-hero-afbeelding',
  );

  const textFields = [
    ['hero-title', page.heroTitle],
    ['hero-text', page.heroText],
    ['support-title', page.supportTitle],
    ['support-intro', page.supportIntro],
    ['title', page.friendsTitle],
    ['intro', page.friendsIntro],
    ['cta-title', page.ctaTitle],
    ['cta-text', page.ctaText],
  ];

  for (const [name, value] of textFields) {
    html = replaceRequired(
      html,
      new RegExp(
        `(<[^>]+data-friends-${name}[^>]*>)[\\s\\S]*?(</[^>]+>)`,
      ),
      `$1${escapeHtml(value)}$2`,
      `vrienden-${name}`,
    );
  }

  html = replaceLink(
    html,
    'data-friends-hero-primary-button',
    page.heroPrimaryButtonLink,
    page.heroPrimaryButtonLabel,
    'primaire hero-knop vrienden',
  );

  html = replaceLink(
    html,
    'data-friends-hero-secondary-button',
    page.heroSecondaryButtonLink,
    page.heroSecondaryButtonLabel,
    'secundaire hero-knop vrienden',
  );

  html = replaceLink(
    html,
    'data-friends-cta-primary-button',
    page.ctaPrimaryButtonLink,
    page.ctaPrimaryButtonLabel,
    'primaire CTA-knop vrienden',
  );

  html = replaceLink(
    html,
    'data-friends-cta-secondary-button',
    page.ctaSecondaryButtonLink,
    page.ctaSecondaryButtonLabel,
    'secundaire CTA-knop vrienden',
  );

  html = replaceRequired(
    html,
    /(<div(?=[^>]*\bclass="friends-support__grid")(?=[^>]*\bdata-friends-support-items\b)[^>]*>)[\s\S]*?(<\/div>)/,
    `$1${renderFriendsSupportItems(page.supportItems)}$2`,
    'ondersteuningsonderdelen vrienden',
  );

  html = replaceRequired(
    html,
    /(<div(?=[^>]*\bclass="friends-partners__viewport")(?=[^>]*\bdata-friends-list\b)[^>]*>)[\s\S]*?(<\/div>)/,
    `$1${renderFriendCards(friends)}$2`,
    'vrienden- en sponsoritems',
  );

  html = replaceRequired(
    html,
    /(<ul(?=[^>]*\bclass="friends-cta__benefits")(?=[^>]*\bdata-friends-cta-benefits\b)[^>]*>)[\s\S]*?(<\/ul>)/,
    `$1${renderFriendsBenefits(page.ctaBenefits)}$2`,
    'CTA-voordelen vrienden',
  );

  html = replaceRequired(
    html,
    /<img(?=[^>]*\bdata-friends-cta-image\b)[^>]*>/,
    image(
      page.ctaImageUrl,
      page.ctaImageAlt,
      720,
      480,
      'lazy',
      ' data-friends-cta-image',
    ),
    'CTA-afbeelding vrienden',
  );

  return replaceRequired(
    html,
    /<script data-friends-source-marker><\/script>/,
    `<script>document.documentElement.dataset.friendsSource=${JSON.stringify(source)};</script>`,
    'vrienden-bronmarkering',
  );
}

export function renderMediaPage(template, content, source) {
  const page = content.page;
  const all = [...content.photoAlbums, ...content.audioItems, ...content.videoItems];
  const selected = all.find((item) => item.isFeatured) || content.photoAlbums[0] || content.audioItems[0] || content.videoItems[0] || null;
  let html = template;
  html = replaceRequired(html, /<img\s+class="media-hero__image"[\s\S]*?data-media-page-hero-image[\s\S]*?>/, image(page.heroImageUrl, page.heroImageAlt, 1620, 367, 'eager', ' class="media-hero__image" data-media-page-hero-image fetchpriority="high"'), 'hero-afbeelding');
  const textFields = [['hero-title', page.heroTitle], ['hero-subtitle', page.heroSubtitle], ['intro-title', page.introTitle], ['intro-text', page.introText], ['cta-eyebrow', page.ctaEyebrow], ['cta-title', page.ctaTitle], ['cta-text', page.ctaText]];
  for (const [name, value] of textFields) html = replaceRequired(html, new RegExp(`(<[^>]+data-media-page-${name}[^>]*>)[\\s\\S]*?(</[^>]+>)`), `$1${escapeHtml(value)}$2`, name);
  html = replaceLink(html, 'data-media-page-primary-button', page.primaryButtonLink, page.primaryButtonLabel, 'primaire CTA');
  html = replaceLink(html, 'data-media-page-secondary-button', page.secondaryButtonLink, page.secondaryButtonLabel, 'secundaire CTA');
  html = replaceRequired(html, /(<article\s+class="media-highlight-card"\s+data-media-featured[^>]*>)[\s\S]*?(<\/article>)/, `$1${featured(selected)}$2`, 'uitgelicht');
  html = replaceRequired(html, /(<div class="media-photo-grid" data-media-photo-grid>)[\s\S]*?(<\/div>\s*)(?=<\/div>\s*<\/section>)/, `$1${photoTiles(content.photoAlbums)}$2`, 'fotogrid');
  html = replaceRequired(html, /(<div class="media-audio-grid" data-media-audio-list>)[\s\S]*?(<\/div>\s*<\/section>\s*<section\s+class="media-strip media-strip--videos")/, `$1${audioTiles(content.audioItems)}$2`, 'audiolijst');
  html = replaceRequired(html, /(<div class="media-video-grid" data-media-video-grid>)[\s\S]*?(<\/div>\s*<\/section>\s*<section\s+class="media-wireframe-cta")/, `$1${videoTiles(content.videoItems)}$2`, 'videogrid');
  const embedded = `<script type="application/json" data-media-albums>${escapeJson(content.photoAlbums)}</script>\n<script>document.documentElement.dataset.mediaSource=${JSON.stringify(source)};</script>`;
  return replaceRequired(html, /<script type="module" src="\.\.\/js\/media\.js"><\/script>/, `${embedded}\n<script type="module" src="../js/media.js"></script>`, 'mediascript');
}

const ABOUT_TIMELINE_ICONS = ['♬', '↗', '♫', '♡'];
const ABOUT_VALUE_ICONS = ['☺', '☆', '◎', '◇'];

function renderAboutParagraphs(items) {
  return items.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n');
}

function renderAboutCards(items, type) {
  const timeline = type === 'timeline';
  const icons = timeline ? ABOUT_TIMELINE_ICONS : ABOUT_VALUE_ICONS;
  return items.map((item, index) => timeline
    ? `<li class="about-timeline__item"><span class="about-timeline__icon" aria-hidden="true">${icons[index]}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></li>`
    : `<article class="about-value-card"><span class="about-value-card__icon" aria-hidden="true">${icons[index]}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`
  ).join('\n');
}

export function renderAboutPage(template, content, source) {
  validateAboutContent(content);
  let html = template;
  html = replaceRequired(html, /(<title data-about-seo-title>)[\s\S]*?(<\/title>)/, `$1${escapeHtml(content.seoTitle)}$2`, 'Over SEO-titel');
  html = replaceRequired(html, /<meta(?=[^>]*name="description")(?=[^>]*data-about-seo-description)[^>]*>/, `<meta name="description" content="${escapeHtml(content.seoDescription)}" data-about-seo-description>`, 'Over SEO-beschrijving');
  html = replaceRequired(
    html,
    /<header class="about-hero" data-about-hero>/,
    `<header class="about-hero" data-about-hero style="--about-hero-image: url(&quot;${escapeHtml(content.heroImageUrl)}&quot;)" aria-label="${escapeHtml(content.heroImageAlt)}">`,
    'Over hero-afbeelding',
  );
  const textFields = [
    ['hero-title', content.heroTitle], ['hero-subtitle', content.heroSubtitle],
    ['intro-eyebrow', content.introEyebrow], ['intro-title', content.introTitle],
    ['timeline-eyebrow', content.timelineEyebrow], ['timeline-title', content.timelineTitle],
    ['values-eyebrow', content.valuesEyebrow], ['values-title', content.valuesTitle],
    ['atmosphere-eyebrow', content.atmosphereEyebrow], ['atmosphere-title', content.atmosphereTitle],
    ['quote', content.quote], ['cta-eyebrow', content.ctaEyebrow],
    ['cta-title', content.ctaTitle], ['cta-text', content.ctaText],
  ];
  for (const [name, value] of textFields) {
    html = replaceRequired(html, new RegExp(`(<[^>]+data-about-${name}[^>]*>)[\\s\\S]*?(</[^>]+>)`), `$1${escapeHtml(value)}$2`, `Over ${name}`);
  }
  const timelineIntro = content.timelineIntro
    ? `<p data-about-timeline-intro>${escapeHtml(content.timelineIntro)}</p>`
    : '<p data-about-timeline-intro hidden></p>';
  html = replaceRequired(html, /<p data-about-timeline-intro(?: hidden)?><\/p>/, timelineIntro, 'Over tijdlijnintro');
  html = replaceRequired(html, /<div data-about-intro-text><\/div>/, renderAboutParagraphs(content.introText), 'Over introductietekst');
  html = replaceRequired(html, /<div data-about-atmosphere-text><\/div>/, renderAboutParagraphs(content.atmosphereText), 'Over sfeertext');
  html = replaceRequired(html, /<ol class="about-timeline" data-about-timeline-items><\/ol>/, `<ol class="about-timeline" data-about-timeline-items>${renderAboutCards(content.timelineItems, 'timeline')}</ol>`, 'Over tijdlijn');
  html = replaceRequired(html, /<div class="about-values__grid" data-about-values-items><\/div>/, `<div class="about-values__grid" data-about-values-items>${renderAboutCards(content.valuesItems, 'values')}</div>`, 'Over waarden');
  html = replaceRequired(html, /<img(?=[^>]*data-about-intro-image)[^>]*>/, image(content.introImageUrl, content.introImageAlt, 1672, 941, 'lazy', ' decoding="async" data-about-intro-image'), 'Over intro-afbeelding');
  html = replaceRequired(html, /<img(?=[^>]*data-about-atmosphere-image)[^>]*>/, image(content.atmosphereImageUrl, content.atmosphereImageAlt, 1672, 941, 'lazy', ' decoding="async" data-about-atmosphere-image'), 'Over sfeerafbeelding');
  const attribution = content.quoteAttribution
    ? `<figcaption data-about-quote-attribution>${escapeHtml(content.quoteAttribution)}</figcaption>`
    : '<figcaption data-about-quote-attribution hidden></figcaption>';
  html = replaceRequired(html, /<figcaption data-about-quote-attribution hidden><\/figcaption>/, attribution, 'Over citaatbron');
  html = replaceLink(html, 'data-about-primary-button', content.primaryButtonLink, content.primaryButtonLabel, 'primaire Over-CTA');
  html = replaceLink(html, 'data-about-secondary-button', content.secondaryButtonLink, content.secondaryButtonLabel, 'secundaire Over-CTA');
  html = replaceRequired(html, /<main class="about-page">/, `<main class="about-page" data-content-source="${source}">`, 'Over contentbron');
  return replaceRequired(html, /<script data-about-source-marker><\/script>/, `<script>document.documentElement.dataset.aboutSource=${JSON.stringify(source)};</script>`, 'Over bronmarkering');
}

const CONTACT_TOPIC_ICON_LABELS = {
  question: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.4 8.8a2.8 2.8 0 1 1 4.1 2.5c-1 .5-1.5 1.1-1.5 2.2v.2M12 17.5h.01"/><circle cx="12" cy="12" r="9"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="m9 14 2 2 4-4"/></svg>',
  people: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19M15 5.2a3 3 0 0 1 0 5.6M16.5 13.3a4.5 4.5 0 0 1 4 4.5V19"/></svg>',
  music: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 18V6l10-2v12M9 9l10-2"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
};

function renderContactTopics(items) {
  return items.map((item) => {
    const link = item.linkLabel && item.linkTarget
      ? `<a class="contact-topic-card__link" href="${escapeHtml(item.linkTarget)}"><span class="contact-topic-card__link-label">${escapeHtml(item.linkLabel)}</span><span aria-hidden="true">→</span></a>`
      : '';
    return `<article class="contact-topic-card">` +
      `<span class="contact-topic-card__icon" data-icon="${item.icon}" aria-hidden="true">${CONTACT_TOPIC_ICON_LABELS[item.icon]}</span>` +
      `<h3>${escapeHtml(item.title)}</h3>` +
      `<p>${escapeHtml(item.text)}</p>` +
      link +
    `</article>`;
  }).join('\n');
}

function renderContactPoints(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n');
}

export function renderContactPage(template, content, source) {
  validateContactContent(content);
  let html = template;
  html = replaceRequired(html, /<html lang="nl" data-contact-source="fallback">/, `<html lang="nl" data-contact-source="${source}">`, 'Contact contentbron');
  html = replaceRequired(html, /(<title data-contact-seo-title>)[\s\S]*?(<\/title>)/, `$1${escapeHtml(content.seoTitle)}$2`, 'Contact SEO-titel');
  html = replaceRequired(html, /<meta(?=[^>]*name="description")(?=[^>]*data-contact-seo-description)[^>]*>/, `<meta name="description" content="${escapeHtml(content.seoDescription)}" data-contact-seo-description>`, 'Contact SEO-beschrijving');
  html = replaceRequired(
    html,
    /<img(?=[^>]*data-contact-hero-image)[^>]*>/,
    image(content.heroImageUrl, content.heroImageAlt, 1672, 941, 'eager', ' class="contact-hero__image" fetchpriority="high" decoding="async" data-contact-hero-image'),
    'Contact hero-afbeelding',
  );
  html = replaceRequired(
    html,
    /<img(?=[^>]*data-contact-welcome-image)[^>]*>/,
    image(content.welcomeImageUrl, content.welcomeImageAlt, 1672, 941, 'lazy', ' decoding="async" data-contact-welcome-image'),
    'Contact welkomstafbeelding',
  );
  const textFields = [
    ['hero-title', content.heroTitle],
    ['hero-intro', content.heroIntro],
    ['welcome-title', content.welcomeTitle],
    ['welcome-text', content.welcomeText],
    ['direct-title', content.directContactTitle],
    ['practical-title', content.practicalTitle],
    ['faq-title', content.faqTitle],
    ['faq-question', content.faqQuestion],
    ['faq-answer', content.faqAnswer],
  ];
  for (const [name, value] of textFields) {
    html = replaceRequired(
      html,
      new RegExp(`(<[^>]+data-contact-${name}[^>]*>)[\\s\\S]*?(</[^>]+>)`),
      `$1${escapeHtml(value)}$2`,
      `Contact ${name}`,
    );
  }
  const optionalTextFields = [
    ['hero-eyebrow', content.heroEyebrow],
    ['direct-text', content.directContactText],
    ['availability', content.availabilityText],
    ['rehearsal-invitation', content.rehearsalInvitation],
    ['closing-cta', content.closingCtaText],
  ];
  for (const [name, value] of optionalTextFields) {
    html = replaceRequired(
      html,
      new RegExp(`<p([^>]*data-contact-${name}[^>]*)>[\\s\\S]*?</p>`),
      value ? `<p$1>${escapeHtml(value)}</p>` : '',
      `optionele Contact ${name}`,
    );
  }
  const emailLink = `mailto:${content.emailAddress}`;
  const phoneHref = telephoneLink(content.phoneNumber);
  const heroActions = [
    content.emailAddress && content.emailCtaLabel
      ? `<a class="btn" href="${escapeHtml(emailLink)}">${escapeHtml(content.emailCtaLabel)}</a>`
      : '',
    phoneHref && content.phoneCtaLabel
      ? `<a class="btn btn--secondary" href="${escapeHtml(phoneHref)}">${escapeHtml(content.phoneCtaLabel)}</a>`
      : '',
  ].filter(Boolean).join('');
  html = replaceRequired(
    html,
    /<div class="contact-actions" data-contact-hero-actions><\/div>/,
    heroActions ? `<div class="contact-actions" data-contact-hero-actions>${heroActions}</div>` : '',
    'Contact hero-CTA’s',
  );
  html = replaceRequired(html, /<div class="contact-topic-grid" data-contact-topics><\/div>/, `<div class="contact-topic-grid" data-contact-topics>${renderContactTopics(content.contactTopics)}</div>`, 'Contactonderwerpen');
  html = replaceRequired(html, /<ul class="contact-points" data-contact-welcome-points><\/ul>/, `<ul class="contact-points" data-contact-welcome-points>${renderContactPoints(content.welcomePoints)}</ul>`, 'Contact welkomstkernpunten');
  const directOptions = [
    content.emailAddress
      ? `<article class="contact-direct-card contact-direct-card--email"><span class="contact-direct-card__icon" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg></span><div><h3>E-mail</h3><p><a href="${escapeHtml(emailLink)}">${escapeHtml(content.emailAddress)}</a></p></div></article>`
      : '',
    phoneHref
      ? `<article class="contact-direct-card contact-direct-card--phone"><span class="contact-direct-card__icon" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.2 3.5 4.8 5.1c-1 .7-1.3 2-.8 3.1 2.3 5.1 6.5 9.3 11.6 11.6 1.1.5 2.4.2 3.1-.8l1.7-2.4-4.7-3.1-1.5 1.7c-2.3-1.2-4.2-3.1-5.4-5.4l1.7-1.5-3.3-4.8Z"/></svg></span><div><h3>Telefoon</h3><p><a href="${escapeHtml(phoneHref)}">${escapeHtml(content.phoneNumber)}</a></p></div></article>`
      : '',
  ].filter(Boolean).join('');
  html = replaceRequired(
    html,
    /<div class="contact-direct__options" data-contact-direct-options><\/div>/,
    directOptions ? `<div class="contact-direct__options" data-contact-direct-options>${directOptions}</div>` : '',
    'Contact directe opties',
  );
  const practicalIcons = {
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>',
    location: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    music: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 18V6l10-2v12M9 9l10-2"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
    people: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19M15 5.2a3 3 0 0 1 0 5.6M16.5 13.3a4.5 4.5 0 0 1 4 4.5V19"/></svg>',
  };
  const practicalItems = [
    (content.rehearsalEvening || content.rehearsalTimes || (content.agendaLink && content.agendaLinkLabel))
      ? {
          icon: 'calendar',
          label: 'Repetitieavond',
          lines: [content.rehearsalEvening, content.rehearsalTimes],
          linkLabel: content.agendaLinkLabel,
          link: content.agendaLink,
        }
      : null,
    (content.rehearsalLocation || content.address)
      ? {
          icon: 'location',
          label: 'Locatie repetitie',
          lines: [content.rehearsalLocation, content.address],
        }
      : null,
    {
      icon: 'music',
      label: 'Over ons repertoire',
      lines: ['Van klassiek tot modern, van ingetogen tot uitbundig.'],
      linkLabel: 'Muziek en repertoire',
      link: './repertoire.html',
    },
    (content.aboutLink && content.aboutLinkLabel)
      ? {
          icon: 'people',
          label: 'Meer weten?',
          lines: ['Lees meer over ons koor, onze geschiedenis en wie we zijn.'],
          linkLabel: content.aboutLinkLabel,
          link: content.aboutLink,
        }
      : null,
  ].filter(Boolean).map((item) => {
    const lines = item.lines.filter(Boolean).map((line) => `<span>${escapeHtml(line)}</span>`).join('');
    const link = item.link && item.linkLabel
      ? `<a href="${escapeHtml(item.link)}">${escapeHtml(item.linkLabel)}</a>`
      : '';
    return `<article class="contact-practical__item"><span class="contact-practical__icon" aria-hidden="true">${practicalIcons[item.icon]}</span><div><h3>${escapeHtml(item.label)}</h3><p>${lines}${link}</p></div></article>`;
  }).join('\n');
  html = replaceRequired(html, /<div class="contact-practical__list" data-contact-practical-list><\/div>/, `<div class="contact-practical__list" data-contact-practical-list>${practicalItems}</div>`, 'Contact praktische informatie');
  html = replaceRequired(html, /<div class="contact-actions" data-contact-practical-links><\/div>/, '', 'Contact praktische links');
  return replaceRequired(
    html,
    /<\/body>/,
    `<script>document.documentElement.dataset.contactSource=${JSON.stringify(source)};</script>\n</body>`,
    'Contact bronmarkering',
  );
}

export function embedSharedComponents(html, navigation, footer) {
  let output = replaceRequired(
    html,
    /<div id="nav-placeholder"><\/div>/,
    `<div id="nav-placeholder">\n${navigation.trim()}\n</div>`,
    'navigatieplaceholder',
  );

  output = replaceRequired(
    output,
    /<div id="footer-placeholder"><\/div>/,
    `<div id="footer-placeholder">\n${footer.trim()}\n</div>`,
    'footerplaceholder',
  );

  return output;
}

async function fetchCmsContent() {
  if (process.env.MEDIA_BUILD_FIXTURE) {
    const fixture = JSON.parse(await readFile(resolve(ROOT, process.env.MEDIA_BUILD_FIXTURE), 'utf8'));
    if (fixture.error) throw new Error(fixture.error);
    return fixture.result ?? fixture;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const dataset = resolveSanityDataset();
  const url = `https://u66p1mxm.api.sanity.io/v2026-07-06/data/query/${dataset}?query=${encodeURIComponent(MEDIA_QUERY)}`;
  try {
    const response = await fetch(url, {headers: {Accept: 'application/json'}, signal: controller.signal});
    if (!response.ok) throw new Error(`Sanity-verzoek mislukt (${response.status})`);
    const payload = await response.json();
    return payload.result ?? {};
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRepertoireCmsContent() {
  if (process.env.REPERTOIRE_BUILD_FIXTURE) {
    const fixture = JSON.parse(await readFile(resolve(ROOT, process.env.REPERTOIRE_BUILD_FIXTURE), 'utf8'));
    if (fixture.error) throw new Error(fixture.error);
    return fixture.result ?? fixture;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const dataset = resolveSanityDataset();
  const url = `https://u66p1mxm.api.sanity.io/v2026-07-06/data/query/${dataset}?query=${encodeURIComponent(REPERTOIRE_QUERY)}`;
  try {
    const response = await fetch(url, {headers: {Accept: 'application/json'}, signal: controller.signal});
    if (!response.ok) throw new Error(`Sanity-repertoireverzoek mislukt (${response.status})`);
    const payload = await response.json();
    return payload.result ?? {};
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchFriendsCmsContent() {
  if (process.env.FRIENDS_BUILD_FIXTURE) {
    const fixture = JSON.parse(
      await readFile(
        resolve(ROOT, process.env.FRIENDS_BUILD_FIXTURE),
        'utf8',
      ),
    );

    if (fixture.error) throw new Error(fixture.error);
    return fixture.result ?? fixture;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  const dataset = resolveSanityDataset();
  const url =
    `https://u66p1mxm.api.sanity.io/v2026-07-06/data/query/` +
    `${dataset}?query=${encodeURIComponent(FRIENDS_QUERY)}`;

  try {
    const response = await fetch(url, {
      headers: {Accept: 'application/json'},
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Sanity-vriendenverzoek mislukt (${response.status})`,
      );
    }

    const payload = await response.json();
    return payload.result ?? {};
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAboutCmsContent() {
  if (process.env.ABOUT_BUILD_FIXTURE) {
    const fixture = JSON.parse(await readFile(resolve(ROOT, process.env.ABOUT_BUILD_FIXTURE), 'utf8'));
    if (fixture.error) throw new Error(fixture.error);
    return fixture.result ?? fixture;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const dataset = resolveSanityDataset();
  const url = `https://u66p1mxm.api.sanity.io/v2026-07-06/data/query/${dataset}?query=${encodeURIComponent(ABOUT_QUERY)}`;
  try {
    const response = await fetch(url, {headers: {Accept: 'application/json'}, signal: controller.signal});
    if (!response.ok) throw new Error(`Sanity-Over-verzoek mislukt (${response.status})`);
    const payload = await response.json();
    return payload.result ?? {};
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchContactCmsContent() {
  if (process.env.CONTACT_BUILD_FIXTURE) {
    const fixture = JSON.parse(await readFile(resolve(ROOT, process.env.CONTACT_BUILD_FIXTURE), 'utf8'));
    if (fixture.error) throw new Error(fixture.error);
    return fixture.result ?? fixture;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const dataset = resolveSanityDataset();
  const url = `https://u66p1mxm.api.sanity.io/v2026-07-06/data/query/${dataset}?query=${encodeURIComponent(CONTACT_QUERY)}`;
  try {
    const response = await fetch(url, {headers: {Accept: 'application/json'}, signal: controller.signal});
    if (!response.ok) throw new Error(`Sanity-Contactverzoek mislukt (${response.status})`);
    const payload = await response.json();
    return payload.result ?? {};
  } finally {
    clearTimeout(timeout);
  }
}

async function copyPublicSite() {
  await rm(OUTPUT, {recursive: true, force: true});
  await mkdir(OUTPUT, {recursive: true});
  for (const directory of PUBLIC_DIRECTORIES) await cp(resolve(ROOT, directory), resolve(OUTPUT, directory), {recursive: true});
  for (const file of PUBLIC_FILES) await cp(resolve(ROOT, file), resolve(OUTPUT, file));
}

export async function build() {
  await checkProjectEncoding(ROOT);
  const fallback = normalizeContent(JSON.parse(await readFile(FALLBACK, 'utf8')));
  let content = fallback;
  let source = 'fallback';
  try {
    const cms = normalizeContent(await fetchCmsContent());
    if (!cms.page.heroTitle || !cms.page.heroImageUrl) throw new Error('Verplichte CMS-paginavelden ontbreken');
    content = cms;
    source = 'cms';
  } catch (error) {
    console.warn(`MEDIA BUILD: fallback gebruikt (${error.message})`);
  }
  assertNoMojibake(content, `genormaliseerde media-inhoud (${source})`);
  await copyPublicSite();
  const [template, navigation, footer] = await Promise.all([
    readFile(MEDIA_TEMPLATE, 'utf8'),
    readFile(NAVIGATION, 'utf8'),
    readFile(FOOTER, 'utf8'),
  ]);
  const outputFile = resolve(OUTPUT, 'pages/media.html');
  await mkdir(dirname(outputFile), {recursive: true});
  const page = renderMediaPage(template, content, source);
  const output = embedSharedComponents(page, navigation, footer);
  assertNoMojibake(output, 'gebouwde mediapagina');
  await writeFile(
    outputFile,
    output,
    'utf8',
  );
  const repertoireFile = resolve(OUTPUT, 'pages/repertoire.html');
  const repertoireFallback = normalizeRepertoireContent(JSON.parse(await readFile(REPERTOIRE_FALLBACK, 'utf8')));
  validateRepertoireContent(repertoireFallback);
  let repertoireContent = repertoireFallback;
  let repertoireSource = 'fallback';
  let fetchedRepertoire = null;
  try {
    fetchedRepertoire = await fetchRepertoireCmsContent();
  } catch (error) {
    console.warn(`REPERTOIRE BUILD: fallback gebruikt (${error.message})`);
  }
  if (fetchedRepertoire) {
    const normalizedRepertoire = normalizeRepertoireContent(fetchedRepertoire);
    if (normalizedRepertoire.page.heroTitle) {
      validateRepertoireContent(normalizedRepertoire);
      repertoireContent = normalizedRepertoire;
      repertoireSource = 'cms';
    } else {
      console.warn('REPERTOIRE BUILD: fallback gebruikt (CMS-paginadocument ontbreekt)');
    }
  }
  assertNoMojibake(repertoireContent, `genormaliseerde repertoire-inhoud (${repertoireSource})`);
  const repertoirePage = embedSharedComponents(
    renderRepertoirePage(
      await readFile(REPERTOIRE_TEMPLATE, 'utf8'),
      repertoireContent,
      repertoireSource,
    ),
    navigation,
    footer,
  );
  assertNoMojibake(repertoirePage, 'gebouwde repertoirepagina');
  await writeFile(repertoireFile, repertoirePage, 'utf8');
  const friendsFile = resolve(OUTPUT, 'pages/vrienden.html');
  const friendsFallback = normalizeFriendsContent(
    JSON.parse(
      await readFile(FRIENDS_FALLBACK, 'utf8'),
    ),
  );

  validateFriendsContent(friendsFallback);

  let friendsContent = friendsFallback;
  let friendsSource = 'fallback';
  let fetchedFriends = null;

  try {
    fetchedFriends = await fetchFriendsCmsContent();
  } catch (error) {
    console.warn(
      `FRIENDS BUILD: fallback gebruikt (${error.message})`,
    );
  }

  if (fetchedFriends) {
    const normalizedFriends =
      normalizeFriendsContent(fetchedFriends);

    if (normalizedFriends.page.heroTitle) {
      validateFriendsContent(normalizedFriends);
      friendsContent = normalizedFriends;
      friendsSource = 'cms';
    } else {
      console.warn(
        'FRIENDS BUILD: fallback gebruikt ' +
        '(CMS-paginadocument ontbreekt)',
      );
    }
  }

  assertNoMojibake(
    friendsContent,
    `genormaliseerde vrienden-inhoud (${friendsSource})`,
  );

  const friendsPage = embedSharedComponents(
    renderFriendsPage(
      await readFile(FRIENDS_TEMPLATE, 'utf8'),
      friendsContent,
      friendsSource,
    ),
    navigation,
    footer,
  );

  assertNoMojibake(
    friendsPage,
    'gebouwde vriendenpagina',
  );

  await writeFile(
    friendsFile,
    friendsPage,
    'utf8',
  );

  const aboutFile = resolve(OUTPUT, 'pages/over.html');
  const aboutFallback = normalizeAboutContent(JSON.parse(await readFile(ABOUT_FALLBACK, 'utf8')));
  validateAboutContent(aboutFallback);
  let aboutContent = aboutFallback;
  let aboutSource = 'fallback';
  try {
    const fetchedAbout = await fetchAboutCmsContent();
    if (fetchedAbout?.heroTitle) {
      const normalizedAbout = normalizeAboutContent(fetchedAbout);
      validateAboutContent(normalizedAbout);
      aboutContent = normalizedAbout;
      aboutSource = 'cms';
    } else {
      console.warn('ABOUT BUILD: fallback gebruikt (CMS-paginadocument ontbreekt)');
    }
  } catch (error) {
    console.warn(`ABOUT BUILD: fallback gebruikt (${error.message})`);
  }
  assertNoMojibake(aboutContent, `genormaliseerde Over-inhoud (${aboutSource})`);
  const aboutPage = embedSharedComponents(
    renderAboutPage(await readFile(ABOUT_TEMPLATE, 'utf8'), aboutContent, aboutSource),
    navigation,
    footer,
  );
  assertNoMojibake(aboutPage, 'gebouwde Over-pagina');
  await writeFile(aboutFile, aboutPage, 'utf8');

  const contactFile = resolve(OUTPUT, 'pages/contact.html');
  const contactFallback = normalizeContactContent(JSON.parse(await readFile(CONTACT_FALLBACK, 'utf8')));
  validateContactContent(contactFallback);
  let contactContent = contactFallback;
  let contactSource = 'fallback';
  try {
    const fetchedContact = await fetchContactCmsContent();
    if (fetchedContact?.heroTitle) {
      const normalizedContact = normalizeContactContent(fetchedContact);
      validateContactContent(normalizedContact);
      contactContent = normalizedContact;
      contactSource = 'cms';
    } else {
      console.warn('CONTACT BUILD: fallback gebruikt (CMS-paginadocument ontbreekt)');
    }
  } catch (error) {
    console.warn(`CONTACT BUILD: fallback gebruikt (${error.message})`);
  }
  assertNoMojibake(contactContent, `genormaliseerde Contact-inhoud (${contactSource})`);
  const contactPage = embedSharedComponents(
    renderContactPage(await readFile(CONTACT_TEMPLATE, 'utf8'), contactContent, contactSource),
    navigation,
    footer,
  );
  assertNoMojibake(contactPage, 'gebouwde Contactpagina');
  await writeFile(contactFile, contactPage, 'utf8');
  const homeFile = resolve(OUTPUT, 'index.html');
  const homeFallback = normalizeHomeContent(
    JSON.parse(
      await readFile(HOME_FALLBACK, 'utf8'),
    ),
  );

  validateHomeContent(homeFallback);

  let homeContent = homeFallback;
  let homeSource = 'fallback';

  try {
    const fetchedHome = await fetchHomeCmsContent();

    if (fetchedHome?.heroTitle) {
      const normalizedHome =
        normalizeHomeContent(fetchedHome);

      validateHomeContent(normalizedHome);
      homeContent = normalizedHome;
      homeSource = 'cms';
    } else {
      console.warn(
        'HOME BUILD: fallback gebruikt ' +
        '(CMS-paginadocument ontbreekt)',
      );
    }
  } catch (error) {
    console.warn(
      `HOME BUILD: fallback gebruikt (${error.message})`,
    );
  }

  assertNoMojibake(
    homeContent,
    `genormaliseerde Homepage-inhoud (${homeSource})`,
  );

  const homePage = embedSharedComponents(
    renderHomePage(
      await readFile(HOME_TEMPLATE, 'utf8'),
      homeContent,
      homeSource,
    ),
    navigation,
    footer,
  );

  assertNoMojibake(
    homePage,
    'gebouwde Homepage',
  );

  await writeFile(
    homeFile,
    homePage,
    'utf8',
  );

  console.log(`MEDIA BUILD: ${source} -> dist/pages/media.html`);
  console.log(`REPERTOIRE BUILD: ${repertoireSource} -> dist/pages/repertoire.html`);
  console.log(`FRIENDS BUILD: ${friendsSource} -> dist/pages/vrienden.html`);
  console.log(`ABOUT BUILD: ${aboutSource} -> dist/pages/over.html`);
  console.log(`CONTACT BUILD: ${contactSource} -> dist/pages/contact.html`);
  console.log(`HOME BUILD: ${homeSource} -> dist/index.html`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((error) => {
    console.error(`MEDIA BUILD MISLUKT: ${error.message}`);
    process.exitCode = 1;
  });
}
