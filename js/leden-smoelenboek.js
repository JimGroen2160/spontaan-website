(function () {
  'use strict';

  const PAGE_SIZE = 10;

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

  function initials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase() || '',
      )
      .join('') || 'L';
  }

  function renderMember(member) {
    const article =
      createElement(
        'article',
        'member-directory-card',
      );

    const media =
      createElement(
        'div',
        'member-directory-card__media',
      );

    const photoUrl =
      window.LedenPortaal.safeHttpsUrl(
        member.photoUrl,
      );

    if (photoUrl) {
      const image =
        document.createElement('img');

      image.src = photoUrl;
      image.alt =
        `Foto van ${member.fullName}`;
      image.loading = 'lazy';

      media.append(image);
    } else {
      const placeholder =
        createElement(
          'div',
          'member-directory-card__placeholder',
          initials(member.fullName),
        );

      placeholder.setAttribute(
        'aria-label',
        `Nog geen foto voor ${member.fullName}`,
      );

      media.append(placeholder);
    }

    article.append(media);

    article.append(
      createElement(
        'h3',
        '',
        member.fullName,
      ),
    );

    article.append(
      createElement(
        'p',
        'member-directory-card__memo',
        member.memo ||
          'Nog geen memo ingevuld.',
      ),
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

      const grid =
        document.getElementById(
          'member-grid',
        );

      const search =
        document.getElementById(
          'member-search',
        );

      const resultCount =
        document.getElementById(
          'member-result-count',
        );

      const loadMore =
        document.getElementById(
          'member-load-more',
        );

      if (
        !grid ||
        !search ||
        !resultCount ||
        !loadMore
      ) {
        return;
      }

      try {
        const members =
          await window.LedenPortaal
            .loadMemberDirectory(
              access.client,
            );

        let visibleLimit = PAGE_SIZE;

        function render() {
          const query =
            search.value
              .trim()
              .toLowerCase();

          const filtered =
            members.filter((member) => {
              const haystack =
                `${member.fullName} ${member.memo}`
                  .toLowerCase();

              return (
                !query ||
                haystack.includes(query)
              );
            });

          resultCount.textContent =
            `${filtered.length} ${
              filtered.length === 1
                ? 'lid'
                : 'leden'
            } gevonden.`;

          const visibleMembers =
            filtered.slice(
              0,
              visibleLimit,
            );

          grid.replaceChildren(
            ...visibleMembers.map(
              renderMember,
            ),
          );

          loadMore.hidden =
            filtered.length <=
            visibleLimit;

          if (filtered.length === 0) {
            grid.append(
              createElement(
                'p',
                'member-empty-state',
                'Geen leden gevonden voor deze zoekopdracht.',
              ),
            );
          }
        }

        loadMore.addEventListener(
          'click',
          () => {
            visibleLimit +=
              PAGE_SIZE;

            render();
          },
        );

        search.addEventListener(
          'input',
          () => {
            visibleLimit =
              PAGE_SIZE;

            render();
          },
        );

        render();
      } catch (error) {
        console.error(
          'Smoelenboek laden mislukt:',
          error,
        );

        grid.textContent =
          'Het smoelenboek kon niet worden geladen.';
      }
    },
  );
})();
// B4.1e APPROVED WIREFRAME FIDELITY
