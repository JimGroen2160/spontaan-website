(() => {
  const root = document.querySelector(
    '[data-friends-carousel]',
  );

  if (!(root instanceof HTMLElement)) {
    return;
  }

  const viewport = root.querySelector(
    '[data-friends-list]',
  );

  const previousButton = root.querySelector(
    '[data-friends-carousel-previous]',
  );

  const nextButton = root.querySelector(
    '[data-friends-carousel-next]',
  );

  const pagination = document.querySelector(
    '[data-friends-carousel-pagination]',
  );

  if (
    !(viewport instanceof HTMLElement) ||
    !(previousButton instanceof HTMLButtonElement) ||
    !(nextButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );

  let pageCount = 1;
  let currentPage = 0;
  let resizeTimer = 0;

  function getStep() {
    const firstItem = viewport.firstElementChild;

    if (!(firstItem instanceof HTMLElement)) {
      return viewport.clientWidth;
    }

    const style = window.getComputedStyle(viewport);
    const gap = Number.parseFloat(style.columnGap) || 0;

    return firstItem.getBoundingClientRect().width + gap;
  }

  function getVisibleItemCount() {
    const step = getStep();

    if (!step) {
      return 1;
    }

    return Math.max(
      1,
      Math.floor(
        (viewport.clientWidth + 1) / step,
      ),
    );
  }

  function getItemCount() {
    return viewport.children.length;
  }

  function calculatePageCount() {
    const itemCount = getItemCount();
    const visibleCount = getVisibleItemCount();

    return Math.max(
      1,
      Math.ceil(itemCount / visibleCount),
    );
  }

  function renderPagination() {
    if (!(pagination instanceof HTMLElement)) {
      return;
    }

    pagination.replaceChildren();

    if (pageCount <= 1) {
      pagination.hidden = true;
      return;
    }

    pagination.hidden = false;

    for (let index = 0; index < pageCount; index += 1) {
      const dot = document.createElement('span');

      dot.className = 'friends-carousel__dot';
      dot.setAttribute('aria-hidden', 'true');

      if (index === currentPage) {
        dot.classList.add('is-active');
      }

      pagination.append(dot);
    }
  }

  function updateControls() {
    const maximumScroll =
      viewport.scrollWidth - viewport.clientWidth;

    const edgeTolerance = Math.max(
      4,
      Math.min(12, viewport.clientWidth * 0.01),
    );

    previousButton.disabled =
      viewport.scrollLeft <= edgeTolerance;

    nextButton.disabled =
      viewport.scrollLeft >=
      maximumScroll - edgeTolerance;

    const pageWidth =
      viewport.clientWidth || 1;

    currentPage = Math.min(
      pageCount - 1,
      Math.max(
        0,
        Math.round(viewport.scrollLeft / pageWidth),
      ),
    );

    renderPagination();
  }

  function refresh() {
    pageCount = calculatePageCount();
    currentPage = Math.min(
      currentPage,
      pageCount - 1,
    );

    updateControls();

    const hasOverflow =
      viewport.scrollWidth > viewport.clientWidth + 2;

    previousButton.hidden = !hasOverflow;
    nextButton.hidden = !hasOverflow;
  }

  function scroll(direction) {
    const maximumScroll = Math.max(
      0,
      viewport.scrollWidth - viewport.clientWidth,
    );

    const requestedPosition =
      viewport.scrollLeft +
      viewport.clientWidth * direction;

    const targetPosition = Math.min(
      maximumScroll,
      Math.max(0, requestedPosition),
    );

    viewport.scrollTo({
      left: targetPosition,
      behavior: reducedMotion.matches
        ? 'auto'
        : 'smooth',
    });
  }

  previousButton.addEventListener(
    'click',
    () => scroll(-1),
  );

  nextButton.addEventListener(
    'click',
    () => scroll(1),
  );

  viewport.addEventListener(
    'scroll',
    updateControls,
    {passive: true},
  );

  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(resizeTimer);

      resizeTimer = window.setTimeout(
        refresh,
        100,
      );
    },
  );

  function initializeAtStart() {
    viewport.scrollLeft = 0;
    refresh();
  }

  initializeAtStart();

  window.requestAnimationFrame(() => {
    initializeAtStart();

    window.requestAnimationFrame(() => {
      initializeAtStart();
    });
  });

  window.addEventListener(
    'load',
    initializeAtStart,
    {once: true},
  );
})();
