const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function getText(value, maximumLength = 500) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maximumLength);
}

export function getValidDate(value) {
  const dateValue = getText(value, 40);

  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? dateFormatter.format(date)
    : '';
}

export function getSafeHttpsUrl(value) {
  const rawUrl = getText(value, 2048);

  if (!rawUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(rawUrl);

    return parsedUrl.protocol === 'https:' ? parsedUrl.href : '';
  } catch {
    return '';
  }
}

export function getSafeLinkUrl(value) {
  const rawUrl = getText(value, 2048);

  if (!rawUrl || rawUrl.startsWith('//')) {
    return '';
  }

  if (
    rawUrl.startsWith('./') ||
    rawUrl.startsWith('../') ||
    rawUrl.startsWith('/') ||
    rawUrl.startsWith('#')
  ) {
    return rawUrl;
  }

  return getSafeHttpsUrl(rawUrl);
}
export function getSafeImageUrl(value) {
  const url = getSafeHttpsUrl(value);

  if (!url) {
    return '';
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();

    return hostname === 'cdn.sanity.io' ||
      hostname.endsWith('.sanity.io')
      ? url
      : '';
  } catch {
    return '';
  }
}

export function getSafeAudioUrl(value) {
  const rawUrl = getText(value, 2048);

  if (/^(?:\.\.\/|\.\/|\/)[A-Za-z0-9_./%-]+\.(?:mp3|wav|ogg|m4a)$/i.test(rawUrl)) {
    return rawUrl;
  }

  return getSafeImageUrl(rawUrl);
}

export function getYouTubeId(value) {
  const rawUrl = getText(value, 2048);

  if (!rawUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const hostname = parsedUrl.hostname
      .toLowerCase()
      .replace(/^www\./, '');

    let videoId = '';

    if (hostname === 'youtu.be') {
      videoId =
        parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
    } else if (
      hostname === 'youtube.com' ||
      hostname === 'm.youtube.com'
    ) {
      if (parsedUrl.pathname === '/watch') {
        videoId = parsedUrl.searchParams.get('v') || '';
      } else {
        const parts = parsedUrl.pathname
          .split('/')
          .filter(Boolean);

        if (
          ['embed', 'shorts', 'live'].includes(parts[0]) &&
          parts[1]
        ) {
          videoId = parts[1];
        }
      }
    }

    return /^[A-Za-z0-9_-]{11}$/.test(videoId)
      ? videoId
      : '';
  } catch {
    return '';
  }
}

export function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text) {
    element.textContent = options.text;
  }

  return element;
}

export function replaceChildrenWithItems(
  container,
  items,
  createItem
) {
  if (!container || !Array.isArray(items)) {
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const element = createItem(item);

    if (element) {
      fragment.append(element);
    }
  });

  container.replaceChildren(fragment);
}

export function showStatus(element, message) {
  if (!element) {
    return;
  }

  const safeMessage = getText(message, 300);

  element.textContent = safeMessage;
  element.hidden = !safeMessage;
}

export function hideStatus(element) {
  if (!element) {
    return;
  }

  element.textContent = '';
  element.hidden = true;
}
