export function getText(value, maximumLength = 500) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maximumLength);
}

function getSafeHttpsUrl(value) {
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

function getSafeImageUrl(value) {
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
