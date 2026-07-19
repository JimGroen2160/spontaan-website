import {
  getSafeAudioUrl,
  getText,
} from './media-utils.js';

const SELECTORS = Object.freeze({
  audioButton: '[data-audio-url]',
  audioProgress: '.media-audio-control__progress',
  audioStatus: '.media-audio-control__status',
  audioTime: '.media-audio-control__time',
  videoButton: '[data-youtube-id]',
  videoCloseButton: '[data-video-close]',
});

let activeVideo = null;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '--:--';
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;

  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function getAudioControls(audio) {
  const container = audio.parentElement;

  return {
    button: container?.querySelector(SELECTORS.audioButton),
    progress: container?.querySelector(SELECTORS.audioProgress),
    status: container?.querySelector(SELECTORS.audioStatus),
    time: container?.querySelector(SELECTORS.audioTime),
  };
}

function getAudioTitle(button) {
  return (
    getText(button?.dataset.audioTitle, 160) ||
    'audio-opname'
  );
}

function updateAudioProgress(audio) {
  const {progress, time} = getAudioControls(audio);
  const duration = audio.duration;
  const currentTime = audio.currentTime;

  if (progress instanceof HTMLElement) {
    const percentage =
      Number.isFinite(duration) && duration > 0
        ? Math.min(
            100,
            Math.max(0, (currentTime / duration) * 100)
          )
        : 0;

    progress.style.width = `${percentage}%`;
  }

  if (time instanceof HTMLElement) {
    time.textContent =
      `${formatTime(currentTime)} / ${formatTime(duration)}`;
  }
}

function setAudioState(audio, state) {
  const {button, status} = getAudioControls(audio);

  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const title = getAudioTitle(button);

  const states = {
    ready: {
      icon: 'play',
      pressed: 'false',
      label: `Speel ${title} af`,
      status: 'Gereed',
    },
    playing: {
      icon: 'pause',
      pressed: 'true',
      label: `Pauzeer ${title}`,
      status: 'Afspelen',
    },
    paused: {
      icon: 'play',
      pressed: 'false',
      label: `Hervat ${title}`,
      status: 'Gepauzeerd',
    },
    ended: {
      icon: 'play',
      pressed: 'false',
      label: `Speel ${title} opnieuw af`,
      status: 'Afgelopen',
    },
    error: {
      icon: 'play',
      pressed: 'false',
      label: `${title} is niet beschikbaar`,
      status: 'Niet beschikbaar',
    },
  };

  const selectedState = states[state] || states.ready;

  button.textContent = '';
  button.dataset.state = selectedState.icon;
  button.setAttribute('aria-pressed', selectedState.pressed);
  button.setAttribute('aria-label', selectedState.label);

  if (status instanceof HTMLElement) {
    status.textContent = selectedState.status;
    status.dataset.state = state;
  }
}

function pauseOtherAudio(activeAudio, root) {
  root.querySelectorAll('audio').forEach((audio) => {
    if (
      audio instanceof HTMLAudioElement &&
      audio !== activeAudio &&
      !audio.paused
    ) {
      audio.pause();
    }
  });
}

function initializeAudioEvents(audio, root) {
  audio.addEventListener('loadedmetadata', () => {
    updateAudioProgress(audio);
  });

  audio.addEventListener('durationchange', () => {
    updateAudioProgress(audio);
  });

  audio.addEventListener('timeupdate', () => {
    updateAudioProgress(audio);
  });

  audio.addEventListener('play', () => {
    pauseOtherAudio(audio, root);
    setAudioState(audio, 'playing');
  });

  audio.addEventListener('pause', () => {
    if (!audio.ended) {
      setAudioState(
        audio,
        audio.currentTime > 0 ? 'paused' : 'ready'
      );
    }
  });

  audio.addEventListener('ended', () => {
    updateAudioProgress(audio);
    setAudioState(audio, 'ended');
  });

  audio.addEventListener('error', () => {
    setAudioState(audio, 'error');
  });
}

function createAudioElement(url, title, root) {
  const audio = document.createElement('audio');

  audio.src = url;
  audio.preload = 'metadata';
  audio.setAttribute('aria-label', title || 'Audio-opname');

  initializeAudioEvents(audio, root);

  return audio;
}

function createYouTubeFrame(videoId, title) {
  const iframe = document.createElement('iframe');

  iframe.src =
    `https://www.youtube-nocookie.com/embed/${videoId}` +
    '?autoplay=1&rel=0';

  iframe.title = title || 'Video van Zanggroep Spontaan';
  iframe.allow =
    'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allowFullscreen = true;

  return iframe;
}

function closeActiveVideo({restoreFocus = true} = {}) {
  if (!activeVideo) {
    return;
  }

  const {
    container,
    originalButton,
  } = activeVideo;

  container.replaceWith(originalButton);
  activeVideo = null;

  if (restoreFocus) {
    originalButton.focus();
  }
}

function openVideo(videoButton, videoId) {
  closeActiveVideo({restoreFocus: false});

  const originalButton = videoButton.cloneNode(true);
  const title =
    videoButton.getAttribute('aria-label') ||
    'Video van Zanggroep Spontaan';

  const container = document.createElement('div');
  container.className = 'media-video-player';

  const iframe = createYouTubeFrame(videoId, title);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'media-video-player__close';
  closeButton.dataset.videoClose = '';
  closeButton.textContent = 'Video sluiten';
  closeButton.setAttribute(
    'aria-label',
    `Sluit ${title.replace(/^Speel\s+/i, '')}`
  );

  container.append(iframe, closeButton);
  videoButton.replaceWith(container);

  activeVideo = {
    container,
    originalButton,
  };

  closeButton.focus();
}

export function initializeMediaPlayers(root = document) {
  root.addEventListener('click', async (event) => {
    const closeButton =
      event.target.closest(SELECTORS.videoCloseButton);

    if (closeButton instanceof HTMLButtonElement) {
      closeActiveVideo();
      return;
    }

    const audioButton =
      event.target.closest(SELECTORS.audioButton);

    if (audioButton instanceof HTMLButtonElement) {
      const url = getSafeAudioUrl(
        audioButton.dataset.audioUrl
      );

      if (!url) {
        return;
      }

      let audio =
        audioButton.parentElement?.querySelector('audio');

      if (!(audio instanceof HTMLAudioElement)) {
        audio = createAudioElement(
          url,
          getAudioTitle(audioButton),
          root
        );

        audioButton.parentElement?.append(audio);
      }

      if (audio.paused) {
        try {
          await audio.play();
        } catch {
          setAudioState(audio, 'error');
        }
      } else {
        audio.pause();
      }

      return;
    }

    const videoButton =
      event.target.closest(SELECTORS.videoButton);

    if (!(videoButton instanceof HTMLButtonElement)) {
      return;
    }

    const videoId = getText(
      videoButton.dataset.youtubeId,
      20
    );

    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return;
    }

    openVideo(videoButton, videoId);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeVideo) {
      event.preventDefault();
      closeActiveVideo();
    }
  });
}
