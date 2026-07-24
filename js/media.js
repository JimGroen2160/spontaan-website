import {createGalleryController} from './media-gallery.js';
import {initializeMediaPlayers} from './media-players.js';

const ALBUM_DATA_SELECTOR = '[data-media-albums]';

function readAlbums(root = document) {
  const data = root.querySelector(ALBUM_DATA_SELECTOR);

  if (!(data instanceof HTMLScriptElement)) {
    return [];
  }

  try {
    const albums = JSON.parse(data.textContent || '[]');
    return Array.isArray(albums) ? albums : [];
  } catch (error) {
    console.error('Fotoalbumgegevens zijn ongeldig.', error);
    return [];
  }
}

function initializeSectionActions(root = document) {
  root.addEventListener('click', (event) => {
    const actionButton = event.target.closest(
      '[data-media-section-action]'
    );

    if (!(actionButton instanceof HTMLButtonElement)) {
      return;
    }

    const targets = {
      photos: '[data-media-album-button]',
      videos: '[data-youtube-id]',
    };

    const targetSelector =
      targets[actionButton.dataset.mediaSectionAction];

    if (!targetSelector) {
      return;
    }

    const target = root.querySelector(targetSelector);

    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    target.focus({
      preventScroll: true,
    });

    if (
      actionButton.dataset.mediaSectionAction === 'photos' &&
      target instanceof HTMLButtonElement
    ) {
      target.click();
    }
  });
}

function initializeMediaPage() {
  const gallery = createGalleryController(document);

  gallery.setAlbums(readAlbums(document));
  gallery.bind();
  initializeMediaPlayers(document);
  initializeSectionActions(document);
}

initializeMediaPage();
