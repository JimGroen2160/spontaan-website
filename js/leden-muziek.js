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

  async function downloadSongPdf(
    song,
    client,
    button,
  ) {
    if (
      !song.pdf_path ||
      !client
    ) {
      return;
    }

    button.disabled = true;

    try {
      const signedUrl =
        await window.LedenPortaal
          .signedSongSheetUrl(
            client,
            song.pdf_path,
          );

      if (!signedUrl) {
        throw new Error(
          'Geen beveiligde PDF-URL beschikbaar.',
        );
      }

      const link =
        document.createElement('a');

      link.href = signedUrl;
      link.download = '';
      link.rel = 'noopener';

      document.body.append(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error(
        'Liedblad downloaden mislukt:',
        error,
      );

      const status =
        document.querySelector(
          '[data-auth-status]',
        );

      if (status) {
        status.textContent =
          'Het liedblad kon niet worden gedownload.';

        const container =
          status.closest(
            '.member-auth-status',
          );

        if (container) {
          container.hidden = false;
        }
      }
    } finally {
      button.disabled =
        !song.pdf_path;
    }
  }
  function renderSong(song, client) {
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

    const resources =
      createElement(
        'div',
        'song-card__resources',
      );

    const details =
      createElement(
        'details',
        'song-card__lyrics song-card__resource',
      );

    const summary =
      createElement(
        'summary',
        '',
        'Tekst bekijken',
      );

    summary.setAttribute(
      'data-visible-label',
      'Tekst',
    );

    details.append(summary);

    details.append(
      createElement(
        'pre',
        '',
        song.lyrics ||
          'Geen liedtekst beschikbaar.',
      ),
    );

    resources.append(details);

    if (
      Array.isArray(song.links) &&
      song.links.length > 0
    ) {
      song.links.forEach((item) => {
        const href =
          window.LedenPortaal.safeHttpsUrl(
            item.url,
          );

        if (!href) {
          return;
        }

        const typeLabel =
          item.type === 'audio'
            ? 'Audio'
            : item.type === 'video'
              ? 'Video'
              : 'Link';

        const link =
          createElement(
            'a',
            'song-card__resource song-card__link',
            `${typeLabel}: ${item.label || 'Openen'}`,
          );

        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        resources.append(link);
      });
    }

    body.append(resources);

    const actions =
      createElement(
        'div',
        'song-card__actions',
      );

    const pdfButton =
      createElement(
        'button',
        'song-action-button song-action-button--pdf',
        'PDF',
      );

    pdfButton.type = 'button';

    pdfButton.disabled =
      !song.pdf_path;

    pdfButton.title =
      song.pdf_path
        ? 'Liedblad downloaden'
        : 'Geen PDF-liedblad beschikbaar';

    pdfButton.setAttribute(
      'aria-label',
      'Download liedblad (PDF)',
    );

    pdfButton.addEventListener(
      'click',
      () =>
        downloadSongPdf(
          song,
          client,
          pdfButton,
        ),
    );

    const printButton =
      createElement(
        'button',
        'song-action-button song-action-button--print',
        'Print',
      );

    printButton.type = 'button';
    printButton.setAttribute(
      'aria-label',
      'Print liedblad',
    );

    printButton.addEventListener(
      'click',
      () => printSong(song),
    );

    actions.append(
      pdfButton,
      printButton,
    );

    article.append(
      icon,
      body,
      actions,
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
            ...filtered.map(
              (song) =>
                renderSong(
                  song,
                  access.client,
                ),
            ),
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
// B4.1e APPROVED WIREFRAME FIDELITY
