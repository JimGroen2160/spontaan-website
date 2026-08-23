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