(function (global) {
  'use strict';

  function finiteNumber(value) {
    return (
      typeof value === 'number' &&
      Number.isFinite(value)
    );
  }

  function clamp(value, minimum, maximum) {
    return Math.min(
      maximum,
      Math.max(minimum, value),
    );
  }

  function clamp01(value) {
    if (!finiteNumber(value)) {
      return null;
    }

    return clamp(value, 0, 1);
  }

  function normalizeCrop(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const top = clamp01(value.top);
    const bottom = clamp01(value.bottom);
    const left = clamp01(value.left);
    const right = clamp01(value.right);

    if (
      top === null ||
      bottom === null ||
      left === null ||
      right === null
    ) {
      return null;
    }

    if (
      top + bottom >= 1 ||
      left + right >= 1
    ) {
      return null;
    }

    return {
      top,
      bottom,
      left,
      right,
    };
  }

  function normalizeHotspot(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const x = clamp01(value.x);
    const y = clamp01(value.y);
    const width = clamp01(value.width);
    const height = clamp01(value.height);

    if (
      x === null ||
      y === null ||
      width === null ||
      height === null
    ) {
      return null;
    }

    if (
      width <= 0 ||
      height <= 0
    ) {
      return null;
    }

    return {
      x,
      y,
      width,
      height,
    };
  }

  function normalizeDimensions(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const width = Number(value.width);
    const height = Number(value.height);

    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return null;
    }

    return {
      width,
      height,
    };
  }

  function safeSanityImageUrl(value) {
    if (typeof value !== 'string') {
      return null;
    }

    const candidate = value.trim();

    if (!candidate) {
      return null;
    }

    try {
      const url = new URL(candidate);

      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'cdn.sanity.io' ||
        !url.pathname.startsWith('/images/')
      ) {
        return null;
      }

      return url;
    } catch {
      return null;
    }
  }

  function cropRectInPixels(
    dimensions,
    crop,
  ) {
    if (!dimensions || !crop) {
      return null;
    }

    const left = Math.round(
      dimensions.width * crop.left,
    );

    const top = Math.round(
      dimensions.height * crop.top,
    );

    const right = Math.round(
      dimensions.width * (1 - crop.right),
    );

    const bottom = Math.round(
      dimensions.height * (1 - crop.bottom),
    );

    const width = right - left;
    const height = bottom - top;

    if (
      width <= 0 ||
      height <= 0
    ) {
      return null;
    }

    return {
      left,
      top,
      width,
      height,
    };
  }

  function hotspotPosition(
    hotspot,
    crop,
  ) {
    if (!hotspot) {
      return {
        x: 0.5,
        y: 0.5,
      };
    }

    if (!crop) {
      return {
        x: hotspot.x,
        y: hotspot.y,
      };
    }

    const cropWidth =
      1 - crop.left - crop.right;

    const cropHeight =
      1 - crop.top - crop.bottom;

    if (
      cropWidth <= 0 ||
      cropHeight <= 0
    ) {
      return {
        x: hotspot.x,
        y: hotspot.y,
      };
    }

    return {
      x: clamp(
        (hotspot.x - crop.left) /
          cropWidth,
        0,
        1,
      ),
      y: clamp(
        (hotspot.y - crop.top) /
          cropHeight,
        0,
        1,
      ),
    };
  }

  function buildSanityHeroImagePresentation({
    url,
    dimensions,
    crop,
    hotspot,
  }) {
    const parsed =
      safeSanityImageUrl(url);

    if (!parsed) {
      return Object.freeze({
        url: '',
        position: Object.freeze({
          x: 0.5,
          y: 0.5,
        }),
        hasCrop: false,
        hasHotspot: false,
      });
    }

    const sourceDimensions =
      normalizeDimensions(dimensions);

    const normalizedCrop =
      normalizeCrop(crop);

    const normalizedHotspot =
      normalizeHotspot(hotspot);

    /*
     * Een crop kan alleen veilig op de CDN-URL
     * worden toegepast wanneer de originele
     * afbeeldingsafmetingen bekend zijn.
     *
     * Zonder dimensies behandelen we de crop
     * daarom als niet toepasbaar.
     */
    const effectiveCrop =
      sourceDimensions
        ? normalizedCrop
        : null;

    const rect =
      cropRectInPixels(
        sourceDimensions,
        effectiveCrop,
      );

    if (rect) {
      parsed.searchParams.set(
        'rect',
        [
          rect.left,
          rect.top,
          rect.width,
          rect.height,
        ].join(','),
      );

      parsed.searchParams.set(
        'auto',
        'format',
      );
    }

    /*
     * De hotspot wordt NIET in een vaste
     * desktop-crop ingebakken.
     *
     * De frontend gebruikt deze relatieve positie
     * straks als background-position of
     * object-position. Daardoor blijft het
     * brandpunt ook bij responsive cover-cropping
     * leidend.
     */
    const position =
      hotspotPosition(
        normalizedHotspot,
        effectiveCrop,
      );

    return Object.freeze({
      url: parsed.href,
      position: Object.freeze({
        x: position.x,
        y: position.y,
      }),
      hasCrop: Boolean(rect),
      hasHotspot:
        Boolean(normalizedHotspot),
    });
  }

  const api = Object.freeze({
    buildSanityHeroImagePresentation,
  });

  if (
    typeof module !== 'undefined' &&
    module.exports
  ) {
    module.exports = api;
  }

  if (global) {
    global.SpontaanSanityHeroImage = api;
  }
})(
  typeof window !== 'undefined'
    ? window
    : globalThis
);