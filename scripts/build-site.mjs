import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'dist');
const TEMPLATE = resolve(ROOT, 'build/media.template.html');
const FALLBACK = resolve(ROOT, 'data/media-fallback.json');
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
  html = replaceRequired(html, /(<div class="media-photo-grid" data-media-photo-grid>)[\s\S]*?(<\/div>\s*<button\s+class="media-photo-carousel__next")/, `$1${photoTiles(content.photoAlbums)}$2`, 'fotogrid');
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

async function copyPublicSite() {
  await rm(OUTPUT, {recursive: true, force: true});
  await mkdir(OUTPUT, {recursive: true});
  for (const directory of PUBLIC_DIRECTORIES) await cp(resolve(ROOT, directory), resolve(OUTPUT, directory), {recursive: true});
  for (const file of PUBLIC_FILES) await cp(resolve(ROOT, file), resolve(OUTPUT, file));
}

export async function build() {
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
  await copyPublicSite();
  const [template, navigation, footer] = await Promise.all([
    readFile(TEMPLATE, 'utf8'),
    readFile(NAVIGATION, 'utf8'),
    readFile(FOOTER, 'utf8'),
  ]);
  const outputFile = resolve(OUTPUT, 'pages/media.html');
  await mkdir(dirname(outputFile), {recursive: true});
  const page = renderMediaPage(template, content, source);
  await writeFile(
    outputFile,
    embedSharedComponents(page, navigation, footer),
    'utf8',
  );
  console.log(`MEDIA BUILD: ${source} -> dist/pages/media.html`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((error) => {
    console.error(`MEDIA BUILD MISLUKT: ${error.message}`);
    process.exitCode = 1;
  });
}
