import {getText} from './media-utils.js';

const SELECTORS = Object.freeze({
  dialog: '[data-media-gallery]',
  title: '[data-media-gallery-title]',
  image: '[data-media-gallery-image]',
  caption: '[data-media-gallery-caption]',
  counter: '[data-media-gallery-counter]',
  close: '[data-media-gallery-close]',
  previous: '[data-media-gallery-previous]',
  next: '[data-media-gallery-next]',
  albumButton: '[data-media-album-button]',
});

export function createGalleryController(root = document) {
  const dialog = root.querySelector(SELECTORS.dialog);

  if (!(dialog instanceof HTMLDialogElement)) {
    return {
      setAlbums() {},
      bind() {},
    };
  }

  const elements = {
    title: dialog.querySelector(SELECTORS.title),
    image: dialog.querySelector(SELECTORS.image),
    caption: dialog.querySelector(SELECTORS.caption),
    counter: dialog.querySelector(SELECTORS.counter),
    close: dialog.querySelector(SELECTORS.close),
    previous: dialog.querySelector(SELECTORS.previous),
    next: dialog.querySelector(SELECTORS.next),
  };

  const state = {
    albums: new Map(),
    activeAlbum: null,
    activeIndex: 0,
    lastTrigger: null,
    bound: false,
  };

  function render() {
    const album = state.activeAlbum;
    const photo = album?.photos?.[state.activeIndex];

    if (!album || !photo || !elements.image) {
      close();
      return;
    }

    elements.title.textContent = album.title;
    elements.image.src = photo.imageUrl;
    elements.image.alt = photo.alt || album.title;

    if (elements.caption) {
      elements.caption.textContent = photo.caption;
      elements.caption.hidden = !photo.caption;
    }

    if (elements.counter) {
      elements.counter.textContent =
        `${state.activeIndex + 1} van ${album.photos.length}`;
    }

    const hasMultiplePhotos = album.photos.length > 1;

    if (elements.previous) {
      elements.previous.hidden = !hasMultiplePhotos;
    }

    if (elements.next) {
      elements.next.hidden = !hasMultiplePhotos;
    }
  }

  function open(albumId, trigger) {
    const album = state.albums.get(getText(albumId, 120));

    if (!album || !Array.isArray(album.photos) || album.photos.length === 0) {
      return;
    }

    state.activeAlbum = album;
    state.activeIndex = 0;
    state.lastTrigger = trigger instanceof HTMLElement ? trigger : null;

    render();

    if (!dialog.open) {
      dialog.showModal();
    }

    elements.close?.focus();
  }

  function close() {
    if (dialog.open) {
      dialog.close();
    }

    state.lastTrigger?.focus();

    state.activeAlbum = null;
    state.activeIndex = 0;
    state.lastTrigger = null;
  }

  function move(direction) {
    const photos = state.activeAlbum?.photos;

    if (!Array.isArray(photos) || photos.length < 2) {
      return;
    }

    state.activeIndex =
      (state.activeIndex + direction + photos.length) %
      photos.length;

    render();
  }

  function handleRootClick(event) {
    const button = event.target.closest(SELECTORS.albumButton);

    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    open(button.dataset.mediaAlbumId, button);
  }

  function handleDialogClick(event) {
    if (event.target === dialog) {
      close();
    }
  }

  function handleKeydown(event) {
    if (!dialog.open) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    }
  }

  function setAlbums(albums) {
    state.albums = new Map(
      (Array.isArray(albums) ? albums : [])
        .filter((album) => album?.id)
        .map((album) => [album.id, album])
    );
  }

  function bind() {
    if (state.bound) {
      return;
    }

    root.addEventListener('click', handleRootClick);
    dialog.addEventListener('click', handleDialogClick);
    document.addEventListener('keydown', handleKeydown);

    elements.close?.addEventListener('click', close);
    elements.previous?.addEventListener('click', () => move(-1));
    elements.next?.addEventListener('click', () => move(1));

    state.bound = true;
  }

  return {
    setAlbums,
    bind,
  };
}
