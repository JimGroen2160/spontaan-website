(function () {
  'use strict';

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function initials(name) {
    return String(name || '')
      .replace('[DEMO]', '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'L';
  }

  function safePhotoUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';

    if (/^(?:\.\.\/|\.\/|\/)[A-Za-z0-9_./%-]+$/.test(value.trim())) {
      return value.trim();
    }

    return '';
  }

  function renderMember(member) {
    const article = createElement('article', 'member-directory-card');
    const media = createElement('div', 'member-directory-card__media');
    const photoUrl = safePhotoUrl(member.photoUrl);

    if (photoUrl) {
      const image = document.createElement('img');
      image.src = photoUrl;
      image.alt = `Foto van ${member.fullName}`;
      image.loading = 'lazy';
      media.append(image);
    } else {
      const placeholder = createElement('div', 'member-directory-card__placeholder', initials(member.fullName));
      placeholder.setAttribute('aria-label', `Nog geen foto voor ${member.fullName}`);
      media.append(placeholder);
    }

    article.append(media);
    article.append(createElement('h3', '', member.fullName));
    article.append(createElement('p', 'member-directory-card__memo', member.memo || 'Nog geen memo ingevuld.'));
    return article;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const access = await window.LedenPortaal.requireActiveMember();
    if (!access) return;

    const grid = document.getElementById('member-grid');
    const search = document.getElementById('member-search');
    const resultCount = document.getElementById('member-result-count');

    if (!grid || !search || !resultCount) return;

    try {
      const data = await window.LedenPortaal.loadDemoData();
      window.LedenPortaal.setDemoNotice(data.notice);
      const members = data.members;

      function render() {
        const query = search.value.trim().toLowerCase();
        const filtered = members.filter((member) => {
          const haystack = `${member.fullName} ${member.memo}`.toLowerCase();
          return !query || haystack.includes(query);
        });

        resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'lid' : 'leden'} gevonden.`;
        grid.replaceChildren(...filtered.map(renderMember));

        if (filtered.length === 0) {
          grid.append(createElement('p', 'member-empty-state', 'Geen leden gevonden voor deze zoekopdracht.'));
        }
      }

      search.addEventListener('input', render);
      render();
    } catch (error) {
      console.error('Smoelenboek-demo-inhoud laden mislukt:', error);
      grid.textContent = 'Het smoelenboek kon niet worden geladen.';
    }
  });
})();
