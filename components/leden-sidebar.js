(async function () {
  const placeholder = document.getElementById('leden-sidebar-placeholder');
  if (!placeholder) return;

  const response = await fetch('/components/leden-sidebar.html');
  if (!response.ok) return;

  placeholder.innerHTML = await response.text();

  const page = document.body.dataset.ledenPage;
  const active = placeholder.querySelector(`[data-leden-nav="${page}"]`);

  if (active) {
    active.classList.add('is-active');
    active.setAttribute('aria-current', 'page');
  }

  const sidebar = placeholder.querySelector('.leden-sidebar');
  const menuToggle = placeholder.querySelector('[data-leden-menu-toggle]');
  const collapsible = placeholder.querySelector('#leden-sidebar-menu');

  if (sidebar && menuToggle && collapsible) {
    sidebar.classList.add('has-mobile-menu');

    const closeMenu = () => {
      collapsible.classList.remove('is-open');
      menuToggle.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Menu openen');
    };

    menuToggle.addEventListener('click', () => {
      const isOpen = collapsible.classList.toggle('is-open');

      menuToggle.classList.toggle('is-open', isOpen);
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.setAttribute(
        'aria-label',
        isOpen ? 'Menu sluiten' : 'Menu openen',
      );
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && collapsible.classList.contains('is-open')) {
        closeMenu();
        menuToggle.focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (
        collapsible.classList.contains('is-open') &&
        !sidebar.contains(event.target)
      ) {
        closeMenu();
      }
    });
  }

  try {
    const profile = await window.authHelpers?.getCurrentProfile();

    if (
      profile?.status === 'active' &&
      ['admin', 'contentmanager'].includes(profile.role)
    ) {
      const beheer = placeholder.querySelector('[data-leden-beheer]');
      if (beheer) beheer.hidden = false;
    }
  } catch {}

  const logout = placeholder.querySelector('[data-leden-logout]');
  logout?.addEventListener('click', async () => {
    await window.authHelpers?.logout();
    window.location.href = '/leden/login.html';
  });
})();