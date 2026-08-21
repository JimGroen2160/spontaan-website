(function () {
  'use strict';

  const CATEGORY_LABELS = {
    current: 'Huidig repertoire',
    concept: 'Concept',
    archive: 'Archief',
  };

  function createElement(
    tag,
    className,
    text,
  ) {
    const element =
      document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function printSong(song) {
    const sheet =
      document.getElementById(
        'song-print-sheet',
      );

    const title =
      document.getElementById(
        'print-song-title',
      );

    const lyrics =
      document.getElementById(
        'print-song-lyrics',
      );

    if (
      !sheet ||
      !title ||
      !lyrics
    ) {
      return;
    }

    title.textContent = song.title;

    lyrics.textContent =
      song.lyrics ||
      'Geen liedtekst beschikbaar.';

    sheet.hidden = false;

    sheet.setAttribute(
      'aria-hidden',
      'false',
    );

    document.body.classList.add(
      'is-printing-song',
    );

    window.print();
  }

  window.addEventListener(
    'afterprint',
    () => {
      const sheet =
        document.getElementById(
          'song-print-sheet',
        );

      if (sheet) {
        sheet.hidden = true;

        sheet.setAttribute(
          'aria-hidden',
          'true',
        );
      }

      document.body.classList.remove(
        'is-printing-song',
      );
    },
  );

  function renderSong(song) {
    const article =
      createElement(
        'article',
        'song-card',
      );

    const icon =
      createElement(
        'div',
        'song-card__icon',
        '\u266b',
      );

    icon.setAttribute(
      'aria-hidden',
      'true',
    );

    const body =
      createElement(
        'div',
        'song-card__body',
      );

    body.append(
      createElement(
        'h3',
        '',
        song.title,
      ),
    );

    body.append(
      createElement(
        'p',
        'song-card__description',
        song.description || '',
      ),
    );

    if (
      Array.isArray(song.links) &&
      song.links.length > 0
    ) {
      const links =
        createElement(
          'div',
          'song-card__links',
        );

      song.links.forEach((item) => {
        const href =
          window.LedenPortaal.safeHttpsUrl(
            item.url,
          );

        if (!href) {
          return;
        }

        const link =
          createElement(
            'a',
            'song-card__link',
            item.label || 'Link',
          );

        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        links.append(link);
      });

      if (links.childElementCount > 0) {
        body.append(links);
      }
    }

    const details =
      createElement(
        'details',
        'song-card__lyrics',
      );

    details.append(
      createElement(
        'summary',
        '',
        'Tekst bekijken',
      ),
    );

    details.append(
      createElement(
        'pre',
        '',
        song.lyrics ||
          'Geen liedtekst beschikbaar.',
      ),
    );

    body.append(details);

    const actions =
      createElement(
        'div',
        'song-card__actions',
      );

    const printButton =
      createElement(
        'button',
        'song-action-button',
        'Print liedblad',
      );

    printButton.type = 'button';

    printButton.addEventListener(
      'click',
      () => printSong(song),
    );

    const pdfButton =
      createElement(
        'button',
        'song-action-button song-action-button--secondary',
        'Download liedblad (PDF)',
      );

    pdfButton.type = 'button';
    pdfButton.disabled = true;
    pdfButton.title =
      'PDF-download is nog niet beschikbaar';

    actions.append(
      printButton,
      pdfButton,
    );

    body.append(actions);

    article.append(
      icon,
      body,
    );

    return article;
  }

  document.addEventListener(
    'DOMContentLoaded',
    async () => {
      const access =
        await window.LedenPortaal
          .requireActiveMember();

      if (!access) {
        return;
      }

      const list =
        document.getElementById(
          'song-list',
        );

      const search =
        document.getElementById(
          'song-search',
        );

      const resultCount =
        document.getElementById(
          'song-result-count',
        );

      const title =
        document.getElementById(
          'music-list-title',
        );

      const tabs = Array.from(
        document.querySelectorAll(
          '[data-category]',
        ),
      );

      if (
        !list ||
        !search ||
        !resultCount ||
        !title ||
        tabs.length !== 3
      ) {
        return;
      }

      try {
        const songs =
          await window.LedenPortaal
            .loadSongs(access.client);

        let category = 'current';

        function render() {
          const query =
            search.value
              .trim()
              .toLowerCase();

          const filtered =
            songs.filter((song) => {
              const haystack =
                `${song.title} ${song.description}`
                  .toLowerCase();

              return (
                song.category === category &&
                (
                  !query ||
                  haystack.includes(query)
                )
              );
            });

          title.textContent =
            CATEGORY_LABELS[category];

          resultCount.textContent =
            `${filtered.length} lied${
              filtered.length === 1
                ? ''
                : 'jes'
            } gevonden.`;

          list.replaceChildren(
            ...filtered.map(renderSong),
          );

          if (filtered.length === 0) {
            list.append(
              createElement(
                'p',
                'member-empty-state',
                'Geen liedjes gevonden voor deze selectie.',
              ),
            );
          }
        }

        tabs.forEach((tab) => {
          tab.addEventListener(
            'click',
            () => {
              category =
                tab.dataset.category;

              tabs.forEach(
                (candidate) => {
                  const active =
                    candidate === tab;

                  candidate.classList.toggle(
                    'is-active',
                    active,
                  );

                  candidate.setAttribute(
                    'aria-pressed',
                    String(active),
                  );
                },
              );

              render();
            },
          );
        });

        search.addEventListener(
          'input',
          render,
        );

        render();
      } catch (error) {
        console.error(
          'Muziekinhoud laden mislukt:',
          error,
        );

        list.textContent =
          'De muziekinhoud kon niet worden geladen.';
      }
    },
  );
})();