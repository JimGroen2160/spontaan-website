(function () {
  'use strict';

  function redirect(path) {
    window.location.replace(path);
  }

  async function safeLogout() {
    try {
      if (window.authHelpers?.logout) {
        await window.authHelpers.logout();
      }
    } catch (error) {
      console.warn('Uitloggen na geweigerde ledenportaaltoegang mislukte:', error);
    }
  }

  function setAuthStatus(message) {
    const status = document.querySelector('[data-auth-status]');
    if (status) status.textContent = message;
  }

  function activateLedenNavigation() {
    const nav = document.getElementById('nav-placeholder');
    if (!nav) return false;

    const ledenLink = Array.from(nav.querySelectorAll('.nav-menu a')).find((link) => {
      try {
        return new URL(link.href, window.location.href).pathname === '/leden/login.html';
      } catch {
        return false;
      }
    });

    if (!ledenLink) return false;

    nav.querySelectorAll('.nav-menu a').forEach((link) => {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    });

    ledenLink.classList.add('active');
    ledenLink.setAttribute('aria-current', 'page');
    return true;
  }

  function watchNavigation() {
    if (activateLedenNavigation()) return;

    const target = document.getElementById('nav-placeholder');
    if (!target) return;

    const observer = new MutationObserver(() => {
      if (activateLedenNavigation()) observer.disconnect();
    });

    observer.observe(target, { childList: true, subtree: true });
  }

  async function requireActiveMember() {
    if (!window.authHelpers) {
      setAuthStatus('De beveiligde ledenomgeving kon niet worden gestart.');
      return null;
    }

    try {
      const session = await window.authHelpers.getCurrentSession();

      if (!session) {
        redirect('login.html');
        return null;
      }

      const profile = await window.authHelpers.getCurrentProfile();

      if (!profile) {
        await safeLogout();
        redirect('login.html');
        return null;
      }

      if (profile.status === 'pending') {
        setAuthStatus('Je account wordt eerst via het dashboard geactiveerd...');
        redirect('dashboard.html');
        return null;
      }

      if (profile.status !== 'active') {
        await safeLogout();
        redirect('login.html');
        return null;
      }

      document.body.dataset.memberRole = profile.role || 'member';
      document.querySelectorAll('[data-leden-protected]').forEach((element) => {
        element.hidden = false;
      });

      setAuthStatus(`Ingelogd als ${profile.full_name || 'lid'}.`);

      return {
        session,
        profile,
        client: window.authHelpers.ensureSupabaseClient(),
      };
    } catch (error) {
      console.error('Ledenportaaltoegang controleren mislukt:', error);
      setAuthStatus('De ledenomgeving kon niet worden geladen. Log opnieuw in.');
      return null;
    }
  }

  async function loadDemoData() {
    const response = await fetch('../data/ledenportaal-demo.json', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Demo-inhoud kon niet worden geladen: ${response.status}`);
    }

    const data = await response.json();

    if (data?.mode !== 'demo' || !Array.isArray(data.songs) || !Array.isArray(data.members)) {
      throw new Error('Ongeldige ledenportaal-demo-inhoud');
    }

    return data;
  }

  function setDemoNotice(message) {
    document.querySelectorAll('[data-demo-notice]').forEach((element) => {
      element.textContent = message;
    });
  }

  function safeHttpsUrl(value) {
    if (typeof value !== 'string') return '';

    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  window.LedenPortaal = Object.freeze({
    requireActiveMember,
    loadDemoData,
    setDemoNotice,
    safeHttpsUrl,
  });

  document.addEventListener('DOMContentLoaded', watchNavigation);
})();
