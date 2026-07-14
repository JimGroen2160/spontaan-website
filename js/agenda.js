(() => {
  const config = {
    projectId: 'u66p1mxm',
    dataset: 'development',
    apiVersion: '2026-07-06',
  };

  const query = `*[
    _type == "eventItem" &&
    isVisible == true &&
    isPublic == true &&
    eventType != "besloten" &&
    defined(startAt) &&
    startAt >= now()
  ] | order(startAt asc) {
    title,
    startAt,
    endAt,
    eventType,
    locationName,
    city,
    address,
    mapUrl,
    summary,
    buttonLabel,
    buttonLink,
    isFree,
    isFeatured,
    mainImageAlt,
    "imageUrl": mainImage.asset->url
  }`;

  const eventTypeLabels = {
    optreden: 'Optreden',
    concert: 'Concert',
    repetitie: 'Repetitie',
    overig: 'Overig',
  };

  const state = {
    type: 'alles',
    location: 'alles',
    month: 'alles',
    selectedDate: '',
    calendarDate: new Date(),
  };

  const isDemoMode =
    new URLSearchParams(window.location.search).get('demo') === '1';

  const demoEventItems = [
    {
      title: 'Zomeravondconcert',
      startAt: '2026-08-22T19:30:00+02:00',
      endAt: '2026-08-22T21:30:00+02:00',
      eventType: 'concert',
      locationName: 'Dorpshuis',
      city: 'Angerlo',
      address: '',
      mapUrl: '',
      summary: 'Een sfeervolle muzikale avond met bekende en verrassende nummers.',
      buttonLabel: 'Meer informatie',
      buttonLink: './contact.html',
      isFree: false,
      isFeatured: true,
      mainImageAlt: '',
      imageUrl: '',
    },
    {
      title: 'Open repetitieavond',
      startAt: '2026-09-07T20:00:00+02:00',
      endAt: '2026-09-07T22:00:00+02:00',
      eventType: 'repetitie',
      locationName: 'Repetitieruimte Spontaan',
      city: 'Angerlo',
      address: '',
      mapUrl: '',
      summary: 'Kom vrijblijvend luisteren en maak kennis met de zanggroep.',
      buttonLabel: 'Neem contact op',
      buttonLink: './contact.html',
      isFree: true,
      isFeatured: false,
      mainImageAlt: '',
      imageUrl: '',
    },
    {
      title: 'Optreden tijdens dorpsfeest',
      startAt: '2026-09-20T14:30:00+02:00',
      endAt: '2026-09-20T15:30:00+02:00',
      eventType: 'optreden',
      locationName: 'Dorpsplein',
      city: 'Angerlo',
      address: '',
      mapUrl: '',
      summary: 'Een toegankelijk optreden tijdens een gezellige middag in het dorp.',
      buttonLabel: 'Meer informatie',
      buttonLink: './contact.html',
      isFree: true,
      isFeatured: false,
      mainImageAlt: '',
      imageUrl: '',
    },
    {
      title: 'Muzikale middag',
      startAt: '2026-10-11T14:00:00+02:00',
      endAt: '2026-10-11T16:00:00+02:00',
      eventType: 'optreden',
      locationName: 'Ontmoetingscentrum',
      city: 'Doetinchem',
      address: '',
      mapUrl: '',
      summary: 'Spontaan verzorgt een gevarieerd programma voor bezoekers en bewoners.',
      buttonLabel: 'Meer informatie',
      buttonLink: './contact.html',
      isFree: true,
      isFeatured: false,
      mainImageAlt: '',
      imageUrl: '',
    },
    {
      title: 'Najaarsconcert',
      startAt: '2026-11-14T20:00:00+01:00',
      endAt: '2026-11-14T22:15:00+01:00',
      eventType: 'concert',
      locationName: 'Kerkzaal',
      city: 'Zevenaar',
      address: '',
      mapUrl: '',
      summary: 'Een avondvullend programma met samenzang, sfeer en muzikale afwisseling.',
      buttonLabel: 'Meer informatie',
      buttonLink: './contact.html',
      isFree: false,
      isFeatured: true,
      mainImageAlt: '',
      imageUrl: '',
    },
  ];

  const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const timeFormatter = new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const monthFormatter = new Intl.DateTimeFormat('nl-NL', {
    month: 'long',
    year: 'numeric',
  });

  const shortMonthFormatter = new Intl.DateTimeFormat('nl-NL', {
    month: 'short',
  });

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLocaleLowerCase('nl-NL');
  }

  function getValidDate(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    const date = new Date(text);

    if (!text || Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function getSafeUrl(value, allowRelative = false) {
    const text = typeof value === 'string' ? value.trim() : '';

    if (!text) {
      return '';
    }

    if (allowRelative && /^(\/|\.\/|\.\.\/)/.test(text)) {
      return text;
    }

    try {
      const url = new URL(text);

      if (!['https:', 'http:'].includes(url.protocol)) {
        return '';
      }

      return url.href;
    } catch {
      return '';
    }
  }

  function getSafeImageUrl(value) {
    const url = getSafeUrl(value);

    return url.startsWith('https://') ? url : '';
  }

  function getEventType(value) {
    const key = normalizeText(value);

    return Object.hasOwn(eventTypeLabels, key)
      ? key
      : 'overig';
  }

  function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function toMonthKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
  }

  function normalizeEventItem(item) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const title =
      typeof item.title === 'string' ? item.title.trim() : '';
    const summary =
      typeof item.summary === 'string' ? item.summary.trim() : '';
    const locationName =
      typeof item.locationName === 'string'
        ? item.locationName.trim()
        : '';
    const city =
      typeof item.city === 'string' ? item.city.trim() : '';
    const address =
      typeof item.address === 'string' ? item.address.trim() : '';
    const buttonLabel =
      typeof item.buttonLabel === 'string'
        ? item.buttonLabel.trim()
        : '';
    const imageAlt =
      typeof item.mainImageAlt === 'string'
        ? item.mainImageAlt.trim()
        : '';

    const startDate = getValidDate(item.startAt);
    const endDate = getValidDate(item.endAt);
    const eventType = getEventType(item.eventType);
    const mapUrl = getSafeUrl(item.mapUrl);
    const buttonLink = getSafeUrl(item.buttonLink, true);
    const imageUrl = getSafeImageUrl(item.imageUrl);

    if (
      !title ||
      !summary ||
      !locationName ||
      !city ||
      !startDate ||
      !endDate ||
      endDate <= startDate
    ) {
      return null;
    }

    if (imageUrl && !imageAlt) {
      return null;
    }

    return {
      title,
      summary,
      locationName,
      city,
      address,
      startDate,
      endDate,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      dateKey: toDateKey(startDate),
      monthKey: toMonthKey(startDate),
      eventType,
      eventTypeLabel: eventTypeLabels[eventType],
      mapUrl,
      buttonLabel,
      buttonLink,
      imageUrl,
      imageAlt,
      isFree: item.isFree === true,
      isFeatured: item.isFeatured === true,
    };
  }

  async function fetchEventItems() {
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
      .map(normalizeEventItem)
      .filter(Boolean);
  }

  function createMetaItem(text) {
    const span = document.createElement('span');
    span.textContent = text;

    return span;
  }

  function createEventCard(item) {
    const article = document.createElement('article');
    article.className = 'agenda-event-card';
    article.dataset.eventType = item.eventType;
    article.dataset.location = normalizeText(item.city);
    article.dataset.month = item.monthKey;
    article.dataset.date = item.dateKey;

    const dateBlock = document.createElement('div');
    dateBlock.className = 'agenda-event-card__date';

    const day = document.createElement('span');
    day.className = 'agenda-event-card__day';
    day.textContent = String(item.startDate.getDate());

    const month = document.createElement('span');
    month.className = 'agenda-event-card__month';
    month.textContent = shortMonthFormatter.format(item.startDate);

    dateBlock.append(day, month);

    const content = document.createElement('div');
    content.className = 'agenda-event-card__content';

    const meta = document.createElement('p');
    meta.className = 'agenda-event-card__meta';

    const timeText =
      `${timeFormatter.format(item.startDate)}–` +
      `${timeFormatter.format(item.endDate)}`;

    meta.append(
      createMetaItem(item.eventTypeLabel),
      createMetaItem(timeText),
      createMetaItem(`${item.locationName}, ${item.city}`)
    );

    if (item.isFree) {
      meta.append(createMetaItem('Toegang vrij'));
    }

    const title = document.createElement('h3');
    title.textContent = item.title;

    const summary = document.createElement('p');
    summary.textContent = item.summary;

    content.append(meta, title, summary);

    const actions = document.createElement('div');
    actions.className = 'agenda-event-card__actions';

    if (item.buttonLabel && item.buttonLink) {
      const actionLink = document.createElement('a');
      actionLink.className = 'btn';
      actionLink.href = item.buttonLink;
      actionLink.textContent = item.buttonLabel;

      if (/^https?:\/\//.test(item.buttonLink)) {
        actionLink.target = '_blank';
        actionLink.rel = 'noopener noreferrer';
      }

      actions.appendChild(actionLink);
    }

    if (item.mapUrl) {
      const mapLink = document.createElement('a');
      mapLink.className = 'btn btn--secondary';
      mapLink.href = item.mapUrl;
      mapLink.target = '_blank';
      mapLink.rel = 'noopener noreferrer';
      mapLink.textContent = 'Bekijk locatie';

      actions.appendChild(mapLink);
    }

    if (actions.childElementCount > 0) {
      content.appendChild(actions);
    }

    article.append(dateBlock, content);

    return article;
  }

  function renderEventCards(container, items) {
    container.textContent = '';

    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      fragment.appendChild(createEventCard(item));
    });

    container.appendChild(fragment);
  }

  function getFilteredItems(items) {
    return items.filter((item) => {
      const matchesType =
        state.type === 'alles' ||
        item.eventType === state.type;

      const matchesLocation =
        state.location === 'alles' ||
        normalizeText(item.city) === state.location;

      const matchesMonth =
        state.month === 'alles' ||
        item.monthKey === state.month;

      const matchesDate =
        !state.selectedDate ||
        item.dateKey === state.selectedDate;

      return (
        matchesType &&
        matchesLocation &&
        matchesMonth &&
        matchesDate
      );
    });
  }

  function addSelectOption(select, value, label) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function populateLocationFilter(select, items) {
    const locations = [
      ...new Set(
        items
          .map((item) => item.city.trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, 'nl-NL'));

    locations.forEach((location) => {
      addSelectOption(
        select,
        normalizeText(location),
        location
      );
    });
  }

  function populateMonthFilter(select, items) {
    const months = new Map();

    items.forEach((item) => {
      if (!months.has(item.monthKey)) {
        months.set(
          item.monthKey,
          monthFormatter.format(item.startDate)
        );
      }
    });

    [...months.entries()]
      .sort(([monthA], [monthB]) =>
        monthA.localeCompare(monthB)
      )
      .forEach(([value, label]) => {
        addSelectOption(select, value, label);
      });
  }

  function createEmptyState(hasItems) {
    const wrapper = document.createElement('div');
    wrapper.className = 'agenda-empty-state';
    wrapper.dataset.agendaEmptyState = '';

    const icon = document.createElement('span');
    icon.className = 'agenda-empty-state__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '♫';

    const title = document.createElement('h3');
    title.textContent = hasItems
      ? 'Geen activiteiten gevonden'
      : 'Er staan momenteel geen openbare optredens gepland';

    const text = document.createElement('p');
    text.textContent = hasItems
      ? 'Pas de filters aan of wis de dagselectie om andere activiteiten te bekijken.'
      : 'Nieuwe activiteiten worden hier gepubliceerd zodra de data bekend zijn.';

    wrapper.append(icon, title, text);

    if (!hasItems) {
      const link = document.createElement('a');
      link.className = 'btn';
      link.href = './contact.html';
      link.textContent = 'Neem contact op';
      wrapper.appendChild(link);
    }

    return wrapper;
  }

  function renderFilteredEvents(container, items) {
    const filteredItems = getFilteredItems(items);

    container.textContent = '';

    if (filteredItems.length === 0) {
      container.appendChild(
        createEmptyState(items.length > 0)
      );

      return filteredItems;
    }

    const fragment = document.createDocumentFragment();

    filteredItems.forEach((item) => {
      fragment.appendChild(createEventCard(item));
    });

    container.appendChild(fragment);

    return filteredItems;
  }

  function updateResultSummary(
    element,
    count,
    hasAgendaItems
  ) {
    element.textContent =
      count === 0
        ? hasAgendaItems
          ? 'Geen activiteiten gevonden'
          : 'Er staan momenteel geen openbare activiteiten gepland.'
        : count === 1
          ? '1 activiteit gevonden'
          : `${count} activiteiten gevonden`;
  }

  function resetFilters(
    typeFilter,
    locationFilter,
    monthFilter,
    clearDateButton
  ) {
    state.type = 'alles';
    state.location = 'alles';
    state.month = 'alles';
    state.selectedDate = '';

    typeFilter.value = 'alles';
    locationFilter.value = 'alles';
    monthFilter.value = 'alles';
    clearDateButton.hidden = true;
  }

  function getCalendarDays(displayDate) {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalCells = Math.ceil(
      (startOffset + lastDay.getDate()) / 7
    ) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - startOffset + 1;

      return new Date(year, month, dayNumber);
    });
  }

  function hasEventOnDate(items, dateKey) {
    return items.some((item) => item.dateKey === dateKey);
  }

  function createCalendarDay(
    date,
    displayDate,
    items,
    onSelect
  ) {
    const dateKey = toDateKey(date);
    const isOutsideMonth =
      date.getMonth() !== displayDate.getMonth();
    const isEventDate = hasEventOnDate(items, dateKey);
    const isSelected = state.selectedDate === dateKey;
    const isToday = dateKey === toDateKey(new Date());

    const element = isEventDate
      ? document.createElement('button')
      : document.createElement('span');

    element.className = 'agenda-calendar__day';
    element.textContent = String(date.getDate());
    element.dataset.date = dateKey;

    if (isOutsideMonth) {
      element.classList.add(
        'agenda-calendar__day--outside'
      );
    }

    if (isEventDate) {
      element.type = 'button';
      element.classList.add(
        'agenda-calendar__day--event'
      );
      element.setAttribute(
        'aria-label',
        `Bekijk activiteiten op ${dateFormatter.format(date)}`
      );

      element.addEventListener('click', () => {
        onSelect(dateKey);
      });
    }

    if (isSelected) {
      element.classList.add(
        'agenda-calendar__day--selected'
      );

      if (isEventDate) {
        element.setAttribute('aria-pressed', 'true');
      }
    } else if (isEventDate) {
      element.setAttribute('aria-pressed', 'false');
    }

    if (isToday) {
      element.classList.add(
        'agenda-calendar__day--today'
      );
      element.setAttribute('aria-current', 'date');
    }

    return element;
  }

  function renderCalendar(
    container,
    title,
    items,
    clearDateButton,
    onSelect
  ) {
    title.textContent =
      monthFormatter.format(state.calendarDate);

    container.textContent = '';

    const fragment = document.createDocumentFragment();
    const calendarDays = getCalendarDays(
      state.calendarDate
    );

    calendarDays.forEach((date) => {
      fragment.appendChild(
        createCalendarDay(
          date,
          state.calendarDate,
          items,
          onSelect
        )
      );
    });

    container.appendChild(fragment);
    clearDateButton.hidden = !state.selectedDate;
  }

  function moveCalendarMonth(offset) {
    state.calendarDate = new Date(
      state.calendarDate.getFullYear(),
      state.calendarDate.getMonth() + offset,
      1
    );
  }

  function setInitialCalendarDate(items) {
    if (items.length > 0) {
      state.calendarDate = new Date(
        items[0].startDate.getFullYear(),
        items[0].startDate.getMonth(),
        1
      );

      return;
    }

    const today = new Date();

    state.calendarDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
  }

  function showStatus(element, message) {
    element.textContent = message;
    element.hidden = false;
  }

  function hideStatus(element) {
    element.textContent = '';
    element.hidden = true;
  }

  async function initAgenda() {
    const eventsContainer = document.querySelector(
      '[data-agenda-events]'
    );
    const resultSummary = document.querySelector(
      '[data-agenda-result-summary]'
    );
    const status = document.querySelector(
      '[data-agenda-status]'
    );

    const typeFilter = document.querySelector(
      '[data-agenda-type-filter]'
    );
    const locationFilter = document.querySelector(
      '[data-agenda-location-filter]'
    );
    const monthFilter = document.querySelector(
      '[data-agenda-month-filter]'
    );
    const resetButton = document.querySelector(
      '[data-agenda-reset-filters]'
    );

    const calendar = document.querySelector(
      '[data-agenda-calendar]'
    );
    const calendarTitle = document.querySelector(
      '[data-agenda-calendar-title]'
    );
    const previousMonthButton = document.querySelector(
      '[data-agenda-previous-month]'
    );
    const nextMonthButton = document.querySelector(
      '[data-agenda-next-month]'
    );
    const clearDateButton = document.querySelector(
      '[data-agenda-clear-date]'
    );

    if (
      !eventsContainer ||
      !resultSummary ||
      !status ||
      !typeFilter ||
      !locationFilter ||
      !monthFilter ||
      !resetButton ||
      !calendar ||
      !calendarTitle ||
      !previousMonthButton ||
      !nextMonthButton ||
      !clearDateButton
    ) {
      return;
    }

    let items = [];

    if (isDemoMode) {
      items = demoEventItems
        .map(normalizeEventItem)
        .filter(Boolean);

      hideStatus(status);
    } else try {
      items = await fetchEventItems();

      hideStatus(status);

      if (items.length > 0) {
        renderEventCards(eventsContainer, items);
      } else {
        eventsContainer.textContent = '';
        eventsContainer.appendChild(
          createEmptyState(false)
        );
      }
    } catch (error) {
      console.info(
        'Sanity-agenda niet geladen; lege statische fallback blijft zichtbaar.',
        error
      );

      showStatus(
        status,
        'De actuele agenda kon niet worden geladen. Probeer het later opnieuw of neem contact met ons op.'
      );

      items = [];
      eventsContainer.textContent = '';
      eventsContainer.appendChild(
        createEmptyState(false)
      );
    }

    items.sort(
      (itemA, itemB) =>
        itemA.startDate.getTime() -
        itemB.startDate.getTime()
    );

    populateLocationFilter(
      locationFilter,
      items
    );
    populateMonthFilter(
      monthFilter,
      items
    );
    setInitialCalendarDate(items);

    function render() {
      const filteredItems = renderFilteredEvents(
        eventsContainer,
        items
      );

      updateResultSummary(
        resultSummary,
        filteredItems.length,
        items.length > 0
      );

      renderCalendar(
        calendar,
        calendarTitle,
        items,
        clearDateButton,
        (dateKey) => {
          state.selectedDate =
            state.selectedDate === dateKey
              ? ''
              : dateKey;

          render();
        }
      );
    }

    typeFilter.addEventListener('change', () => {
      state.type = getEventType(
        typeFilter.value
      );

      if (typeFilter.value === 'alles') {
        state.type = 'alles';
      }

      render();
    });

    locationFilter.addEventListener(
      'change',
      () => {
        state.location =
          locationFilter.value || 'alles';

        render();
      }
    );

    monthFilter.addEventListener('change', () => {
      state.month =
        monthFilter.value || 'alles';

      if (state.month !== 'alles') {
        const [year, month] = state.month
          .split('-')
          .map(Number);

        state.calendarDate = new Date(
          year,
          month - 1,
          1
        );
      }

      render();
    });

    resetButton.addEventListener('click', () => {
      resetFilters(
        typeFilter,
        locationFilter,
        monthFilter,
        clearDateButton
      );

      setInitialCalendarDate(items);
      render();
    });

    previousMonthButton.addEventListener(
      'click',
      () => {
        moveCalendarMonth(-1);
        render();
      }
    );

    nextMonthButton.addEventListener(
      'click',
      () => {
        moveCalendarMonth(1);
        render();
      }
    );

    clearDateButton.addEventListener(
      'click',
      () => {
        state.selectedDate = '';
        render();
      }
    );

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initAgenda,
      {
        once: true,
      }
    );
  } else {
    initAgenda();
  }
})();
