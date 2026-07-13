(() => {
  const itemsPerPage = 6;

  const config = {
    projectId: 'u66p1mxm',
    dataset: 'development',
    apiVersion: '2026-07-06',
  };

  const query = `*[
    _type == "newsItem" &&
    isVisible == true &&
    defined(slug.current)
  ] | order(publishedAt desc) {
    title,
    "slug": slug.current,
    publishedAt,
    category,
    summary,
    mainImageAlt,
    "imageUrl": mainImage.asset->url
  }`;

  const categoryLabels = {
    optredens: 'Optredens',
    vereniging: 'Vereniging',
    media: 'Media',
    overig: 'Overig',
  };

  const state = {
    searchTerm: '',
    category: 'alles',
    sortOrder: 'newest',
    currentPage: 1,
  };

  const normalizeText = (value) =>
    String(value || '')
      .trim()
      .toLocaleLowerCase('nl-NL');

  const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  function getCategoryLabel(value) {
    const key = normalizeText(value);
    return Object.hasOwn(categoryLabels, key)
      ? categoryLabels[key]
      : categoryLabels.overig;
  }

  function getCategoryClass(value) {
    const key = normalizeText(value);

    if (key === 'vereniging') {
      return 'news-card__category--pink';
    }

    if (key === 'media') {
      return 'news-card__category--blue';
    }

    return '';
  }

  function getSafeImageUrl(value) {
    const imageUrl = typeof value === 'string' ? value.trim() : '';

    if (!imageUrl) {
      return '';
    }

    try {
      const parsedUrl = new URL(imageUrl);

      if (parsedUrl.protocol !== 'https:') {
        return '';
      }

      return parsedUrl.href;
    } catch {
      return '';
    }
  }

  function getValidDate(value) {
    const dateValue = typeof value === 'string' ? value.trim() : '';
    const date = new Date(dateValue);

    if (!dateValue || Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function normalizeNewsItem(item) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const title =
      typeof item.title === 'string' ? item.title.trim() : '';
    const slug =
      typeof item.slug === 'string' ? item.slug.trim() : '';
    const summary =
      typeof item.summary === 'string' ? item.summary.trim() : '';
    const imageAlt =
      typeof item.mainImageAlt === 'string'
        ? item.mainImageAlt.trim()
        : '';
    const imageUrl = getSafeImageUrl(item.imageUrl);
    const publishedDate = getValidDate(item.publishedAt);
    const category = getCategoryLabel(item.category);

    if (
      !title ||
      !slug ||
      !summary ||
      !imageAlt ||
      !imageUrl ||
      !publishedDate
    ) {
      return null;
    }

    return {
      title,
      slug,
      summary,
      imageAlt,
      imageUrl,
      category,
      categoryClass: getCategoryClass(item.category),
      publishedAt: publishedDate.toISOString(),
      publishedDate,
    };
  }

  function createNewsCard(item) {
    const article = document.createElement('article');
    article.className = 'news-card';

    const media = document.createElement('div');
    media.className = 'news-card__image';

    const image = document.createElement('img');
    image.src = item.imageUrl;
    image.alt = item.imageAlt;
    image.width = 1200;
    image.height = 675;
    image.loading = 'lazy';
    image.decoding = 'async';

    const category = document.createElement('span');
    category.className = item.categoryClass
      ? `news-card__category ${item.categoryClass}`
      : 'news-card__category';
    category.textContent = item.category;

    media.append(image, category);

    const cardContent = document.createElement('div');
    cardContent.className = 'news-card__content';

    const dateParagraph = document.createElement('p');
    dateParagraph.className = 'news-card__date';

    const time = document.createElement('time');
    time.dateTime = item.publishedAt;
    time.textContent = dateFormatter.format(item.publishedDate);
    dateParagraph.appendChild(time);

    const title = document.createElement('h2');
    title.textContent = item.title;

    const summary = document.createElement('p');
    summary.textContent = item.summary;

    const link = document.createElement('a');
    link.href = `./nieuwsbericht.html?slug=${encodeURIComponent(item.slug)}`;
    link.setAttribute(
      'aria-label',
      `Lees meer over ${item.title.toLocaleLowerCase('nl-NL')}`
    );
    link.textContent = 'Lees meer';

    cardContent.append(dateParagraph, title, summary, link);
    article.append(media, cardContent);

    return article;
  }

  async function fetchNewsItems() {
    const encodedQuery = encodeURIComponent(query);
    const url =
      `https://${config.projectId}.apicdn.sanity.io/` +
      `v${config.apiVersion}/data/query/${config.dataset}` +
      `?query=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Sanity request failed with status ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data.result)) {
      return [];
    }

    return data.result
      .map(normalizeNewsItem)
      .filter((item) => item !== null);
  }

  function getCardData(card, originalIndex) {
    const title = card.querySelector('h2')?.textContent?.trim() || '';
    const summary =
      card.querySelector('.news-card__content > p:not(.news-card__date)')
        ?.textContent?.trim() || '';
    const category =
      card.querySelector('.news-card__category')?.textContent?.trim() || 'Overig';
    const dateValue =
      card.querySelector('time')?.getAttribute('datetime') || '1970-01-01';

    return {
      card,
      originalIndex,
      title,
      summary,
      category,
      normalizedTitle: normalizeText(title),
      normalizedSummary: normalizeText(summary),
      normalizedCategory: normalizeText(category),
      timestamp: Date.parse(dateValue) || 0,
    };
  }

  function setActiveCategory(buttons, activeButton) {
    buttons.forEach((button) => {
      const isActive = button === activeButton;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function filterItems(items) {
    return items.filter((item) => {
      const matchesSearch =
        !state.searchTerm ||
        item.normalizedTitle.includes(state.searchTerm) ||
        item.normalizedSummary.includes(state.searchTerm) ||
        item.normalizedCategory.includes(state.searchTerm);

      const matchesCategory =
        state.category === 'alles' ||
        item.normalizedCategory === state.category;

      return matchesSearch && matchesCategory;
    });
  }

  function sortItems(items) {
    return [...items].sort((left, right) => {
      if (state.sortOrder === 'oldest') {
        return (
          left.timestamp - right.timestamp ||
          left.originalIndex - right.originalIndex
        );
      }

      return (
        right.timestamp - left.timestamp ||
        left.originalIndex - right.originalIndex
      );
    });
  }

  function createPaginationButton(label, options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;

    if (options.label) {
      button.setAttribute('aria-label', options.label);
    }

    if (options.disabled) {
      button.disabled = true;
    }

    if (options.current) {
      button.classList.add('active');
      button.setAttribute('aria-current', 'page');
    }

    if (typeof options.onClick === 'function') {
      button.addEventListener('click', options.onClick);
    }

    return button;
  }

  function renderPagination(container, totalPages, render) {
    container.textContent = '';

    if (totalPages <= 1) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    container.appendChild(
      createPaginationButton('Vorige', {
        label: 'Vorige nieuwspagina',
        disabled: state.currentPage === 1,
        onClick: () => {
          state.currentPage -= 1;
          render();
        },
      })
    );

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      container.appendChild(
        createPaginationButton(String(pageNumber), {
          current: pageNumber === state.currentPage,
          label: `Nieuwspagina ${pageNumber}`,
          onClick: () => {
            state.currentPage = pageNumber;
            render();
          },
        })
      );
    }

    container.appendChild(
      createPaginationButton('Volgende', {
        label: 'Volgende nieuwspagina',
        disabled: state.currentPage === totalPages,
        onClick: () => {
          state.currentPage += 1;
          render();
        },
      })
    );
  }

  async function initNewsOverview() {
    const grid = document.querySelector('.news-grid');
    const searchInput = document.querySelector('#news-search-input');
    const sortSelect = document.querySelector('#news-sort-select');
    const categoryButtons = [
      ...document.querySelectorAll('.news-category-button'),
    ];
    const resultSummary = document.querySelector('.news-result-summary p');
    const pagination = document.querySelector('.news-pagination');

    if (
      !grid ||
      !searchInput ||
      !sortSelect ||
      !resultSummary ||
      !pagination
    ) {
      return;
    }

    try {
      const sanityItems = await fetchNewsItems();

      if (sanityItems.length > 0) {
        const fragment = document.createDocumentFragment();

        sanityItems.forEach((item) => {
          fragment.appendChild(createNewsCard(item));
        });

        grid.textContent = '';
        grid.appendChild(fragment);
      }
    } catch (error) {
      console.info(
        'Sanity-nieuws niet geladen; statische nieuwsfallback blijft zichtbaar.',
        error
      );
    }

    const items = [...grid.querySelectorAll('.news-card')].map(getCardData);

    function render() {
      const filteredItems = sortItems(filterItems(items));
      const totalPages = Math.max(
        1,
        Math.ceil(filteredItems.length / itemsPerPage)
      );

      if (state.currentPage > totalPages) {
        state.currentPage = totalPages;
      }

      const startIndex = (state.currentPage - 1) * itemsPerPage;
      const visibleItems = filteredItems.slice(
        startIndex,
        startIndex + itemsPerPage
      );
      const visibleCards = new Set(visibleItems.map((item) => item.card));

      items.forEach((item) => {
        item.card.hidden = !visibleCards.has(item.card);
      });

      visibleItems.forEach((item) => {
        grid.appendChild(item.card);
      });

      const count = filteredItems.length;
      resultSummary.textContent =
        count === 1
          ? '1 nieuwsbericht gevonden'
          : `${count} nieuwsberichten gevonden`;

      renderPagination(pagination, totalPages, render);
    }

    searchInput.addEventListener('input', () => {
      state.searchTerm = normalizeText(searchInput.value);
      state.currentPage = 1;
      render();
    });

    sortSelect.addEventListener('change', () => {
      state.sortOrder = sortSelect.value === 'oldest' ? 'oldest' : 'newest';
      state.currentPage = 1;
      render();
    });

    categoryButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.category = normalizeText(button.textContent);
        state.currentPage = 1;
        setActiveCategory(categoryButtons, button);
        render();
      });
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewsOverview, {
      once: true,
    });
  } else {
    initNewsOverview();
  }
})();