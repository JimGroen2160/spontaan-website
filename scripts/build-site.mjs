import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertNoMojibake, checkProjectEncoding} from './check-encoding.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'dist');
const MEDIA_TEMPLATE = resolve(ROOT, 'build/media.template.html');
const REPERTOIRE_TEMPLATE = resolve(ROOT, 'build/repertoire.template.html');
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

export const REPERTOIRE_QUERY = `{
  "page": *[_id == "repertoirePage-main" && _type == "repertoirePage"][0] {
    heroTitle, heroSubtitle, heroImageAlt,
    "heroImageUrl": heroImage.asset->url,
    "featuredItemId": featuredItem->_id,
    worldsTitle, worldsIntro,
    worlds[] {
      number, title, description,
      "itemIds": items[]->_id
    },
    processTitle, processSteps[] {title, description},
    selectionTitle, "selectionItemIds": selectionItems[]->_id,
    quote, quoteAttribution,
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
  if (/^(?:\.\/|\.\.\/|\/)[A-Za-z0-9_./?=&%-]+$/.test(candidate)) return candidate;
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

function repertoireAudioCard(item) {
  if (!item.audioUrl) return '';
  const description = item.audioDescription || `Luisterfragment van ${item.title}`;
  return `<article class="repertoire-audio-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(description)}</p><div class="media-audio-control"><button class="media-audio-control__play" type="button" data-audio-url="${escapeHtml(item.audioUrl)}" data-audio-title="${escapeHtml(item.title)}" data-state="play" aria-pressed="false" aria-label="Speel ${escapeHtml(item.title)} af"></button><span class="media-audio-control__wave" aria-hidden="true"><span class="media-audio-control__progress"></span></span><span class="media-audio-control__time">0:00 / --:--</span><span class="media-audio-control__status" role="status" aria-live="polite">Gereed</span></div></article>`;
}

export function renderRepertoirePage(template, content, source) {
  const {page} = content;
  const {byId, featured: featuredItem} = validateRepertoireContent(content);
  const worlds = page.worlds.map((world, index) => {
    const reverse = index % 2 === 1 ? ' repertoire-world--reverse' : '';
    return `<article class="repertoire-world${reverse}"><div class="repertoire-world__content"><span class="repertoire-world__number">${escapeHtml(world.number)}</span><h3>${escapeHtml(world.title)}</h3><p>${escapeHtml(world.description)}</p><ul>${world.itemIds.map((id) => `<li>${escapeHtml(byId.get(id).title)}</li>`).join('')}</ul></div>${image(world.imageUrl, world.imageAlt, 1200, 900)}</article>`;
  }).join('');
  const audioItems = [featuredItem, ...content.items.filter((item) => item.id !== featuredItem.id && item.audioUrl)].slice(0, 3);
  const processIcons = [
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c.4-4 2.3-6 5-6s4.6 2 5 6M11 20c.4-4 2.3-6 5-6s4.6 2 5 6"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  ];
  const process = page.processSteps.map((step, index) => `<li><span aria-hidden="true">${processIcons[index] || processIcons[processIcons.length - 1]}</span><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.description)}</p></li>`).join('');
  const tags = page.selectionItemIds.map((id) => `<span>${escapeHtml(byId.get(id).title)}</span>`).join('');
  const heroDecor = '<div class="repertoire-hero__decor" aria-hidden="true"><span class="repertoire-hero__note repertoire-hero__note--one">♪</span><span class="repertoire-hero__note repertoire-hero__note--two">♫</span><span class="repertoire-hero__note repertoire-hero__note--three">♪</span><span class="repertoire-hero__waveform"></span><span class="repertoire-hero__sheet"></span></div>';
  const header = `<header class="repertoire-hero">${image(page.heroImageUrl, page.heroImageAlt, 1920, 1080, 'eager', ' class="repertoire-hero__image" fetchpriority="high"')}${heroDecor}<div class="repertoire-hero__content"><p class="repertoire-breadcrumb">Home / Muziek en repertoire</p><h1>${escapeHtml(page.heroTitle)}</h1><p>${escapeHtml(page.heroSubtitle)}</p></div></header>`;
  const main = `<main class="repertoire-page">
    <section class="repertoire-feature" aria-labelledby="repertoire-feature-title"><div class="repertoire-feature__visual">${image(page.featuredImageUrl, page.featuredImageAlt, 1200, 900, 'eager')}</div><div class="repertoire-feature__content"><p class="repertoire-label">Verhaal</p><h2 id="repertoire-feature-title">Uitgelicht: muziek met een verhaal</h2><h3>${escapeHtml(featuredItem.title)}</h3><p>${escapeHtml(featuredItem.story)}</p><div class="repertoire-actions"><a class="btn" href="#muziekstuk-proces">Lees het verhaal</a><a class="btn btn--secondary" href="#onze-muziek">In ons repertoire</a></div></div></section>
    <section id="onze-muziek" class="repertoire-section" aria-labelledby="repertoire-worlds-title"><div class="repertoire-heading"><p class="repertoire-eyebrow">Van klassiek tot feestelijk</p><h2 id="repertoire-worlds-title">${escapeHtml(page.worldsTitle)}</h2><p>${escapeHtml(page.worldsIntro)}</p></div><div class="repertoire-worlds">${worlds}</div></section>
    <section id="luister-mee" class="repertoire-section" aria-labelledby="listen-title"><div class="repertoire-heading"><p class="repertoire-eyebrow">Hoor Spontaan</p><h2 id="listen-title">Luister mee</h2><p>Ontdek deze greep uit ons repertoire.</p></div><div class="repertoire-audio-grid" id="featured-audio">${audioItems.map(repertoireAudioCard).join('')}</div></section>
    <section id="muziekstuk-proces" class="repertoire-section" aria-labelledby="process-title"><div class="repertoire-heading"><p class="repertoire-eyebrow">Van eerste noot tot podium</p><h2 id="process-title">${escapeHtml(page.processTitle)}</h2><p>Van eerste noot tot uitvoering op het podium.</p></div><ol class="repertoire-process">${process}</ol></section>
    <section class="repertoire-selection" aria-labelledby="selection-title"><h2 id="selection-title">${escapeHtml(page.selectionTitle)}</h2><div class="repertoire-tags" aria-label="Repertoireselectie">${tags}</div><a class="btn btn--secondary" href="./contact.html">Bekijk het volledige repertoire</a></section>
    <figure class="repertoire-quote"><div class="repertoire-quote__content"><blockquote><p>“${escapeHtml(page.quote)}”</p></blockquote><figcaption>— ${escapeHtml(page.quoteAttribution)}</figcaption></div>${image(page.quoteImageUrl, page.quoteImageAlt, 1200, 900)}</figure>
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
  console.log(`MEDIA BUILD: ${source} -> dist/pages/media.html`);
  console.log(`REPERTOIRE BUILD: ${repertoireSource} -> dist/pages/repertoire.html`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((error) => {
    console.error(`MEDIA BUILD MISLUKT: ${error.message}`);
    process.exitCode = 1;
  });
}
