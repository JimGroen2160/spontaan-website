(function () {
  'use strict';

  const PHOTO_BUCKET = 'member-photos';
  const PHOTO_URL_TTL_SECONDS = 300;

  function redirect(path) {
    window.location.replace(path);
  }

  async function safeLogout() {
    try {
      if (window.authHelpers?.logout) {
        await window.authHelpers.logout();
      }
    } catch (error) {
      console.warn(
        'Uitloggen na geweigerde ledenportaaltoegang mislukte:',
        error,
      );
    }
  }

  function setAuthStatus(message) {
    const status = document.querySelector('[data-auth-status]');
    if (!status) {
      return;
    }

    status.textContent = message;

    const container =
      status.closest('.member-auth-status');

    if (container) {
      container.hidden = message === '';
    }
  }

  function activateLedenNavigation() {
    const nav = document.getElementById('nav-placeholder');
    if (!nav) return false;

    const ledenLink = Array.from(
      nav.querySelectorAll('.nav-menu a'),
    ).find((link) => {
      try {
        return new URL(
          link.href,
          window.location.href,
        ).pathname === '/leden/login.html';
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
      if (activateLedenNavigation()) {
        observer.disconnect();
      }
    });

    observer.observe(
      target,
      {
        childList: true,
        subtree: true,
      },
    );
  }

  async function requireActiveMember() {
    if (!window.authHelpers) {
      setAuthStatus(
        'De beveiligde ledenomgeving kon niet worden gestart.',
      );
      return null;
    }

    try {
      const session =
        await window.authHelpers.getCurrentSession();

      if (!session) {
        redirect('login.html');
        return null;
      }

      const profile =
        await window.authHelpers.getCurrentProfile();

      if (!profile) {
        await safeLogout();
        redirect('login.html');
        return null;
      }

      if (profile.status === 'pending') {
        setAuthStatus(
          'Je account wordt eerst via het dashboard geactiveerd...',
        );
        redirect('dashboard.html');
        return null;
      }

      if (profile.status !== 'active') {
        await safeLogout();
        redirect('login.html');
        return null;
      }

      document.body.dataset.memberRole =
        profile.role || 'member';

      document
        .querySelectorAll('[data-leden-protected]')
        .forEach((element) => {
          element.hidden = false;
        });

      setAuthStatus('');

      return {
        session,
        profile,
        client:
          window.authHelpers.ensureSupabaseClient(),
      };
    } catch (error) {
      console.error(
        'Ledenportaaltoegang controleren mislukt:',
        error,
      );

      setAuthStatus(
        'De ledenomgeving kon niet worden geladen. Log opnieuw in.',
      );

      return null;
    }
  }

  function safeHttpsUrl(value) {
    if (typeof value !== 'string') return '';

    try {
      const url = new URL(value);

      return url.protocol === 'https:'
        ? url.href
        : '';
    } catch {
      return '';
    }
  }

  function safeStoragePath(value) {
    if (typeof value !== 'string') return '';

    const path = value.trim();

    if (!path) return '';
    if (path.startsWith('/')) return '';
    if (path.includes('\\')) return '';
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) return '';

    const parts = path.split('/');

    if (
      parts.some(
        (part) =>
          !part ||
          part === '.' ||
          part === '..'
      )
    ) {
      return '';
    }

    return path;
  }

  async function loadSongs(client) {
    const {
      data: songRows,
      error: songError,
    } = await client
      .from('member_songs')
      .select(
        'id,title,category,description,lyrics,pdf_path,is_visible,sort_order',
      )
      .eq('is_visible', true)
      .order(
        'sort_order',
        { ascending: true },
      )
      .order(
        'title',
        { ascending: true },
      );

    if (songError) {
      throw new Error(
        `Liedjes laden mislukt: ${songError.message || 'onbekende fout'}`,
      );
    }

    const songs = Array.isArray(songRows)
      ? songRows
      : [];

    if (songs.length === 0) {
      return [];
    }

    const songIds = songs
      .map((song) => song.id)
      .filter(Boolean);

    const {
      data: linkRows,
      error: linkError,
    } = await client
      .from('member_song_links')
      .select(
        'id,song_id,label,link_type,url,sort_order',
      )
      .in(
        'song_id',
        songIds,
      )
      .order(
        'sort_order',
        { ascending: true },
      )
      .order(
        'label',
        { ascending: true },
      );

    if (linkError) {
      throw new Error(
        `Oefenlinks laden mislukt: ${linkError.message || 'onbekende fout'}`,
      );
    }

    const links = Array.isArray(linkRows)
      ? linkRows
      : [];

    const linksBySong = new Map();

    links.forEach((link) => {
      const existing =
        linksBySong.get(link.song_id) || [];

      existing.push({
        id: link.id,
        label: link.label || 'Link',
        type: link.link_type || 'other',
        url: link.url || '',
      });

      linksBySong.set(
        link.song_id,
        existing,
      );
    });

    return songs.map((song) => ({
      id: song.id,
      title: song.title || '',
      category: song.category || 'current',
      description: song.description || '',
      lyrics: song.lyrics || '',
      pdf_path: song.pdf_path || '',
      links: linksBySong.get(song.id) || [],
    }));
  }

  const SONG_SHEET_BUCKET =
    'member-song-sheets';

  const SONG_SHEET_URL_TTL_SECONDS =
    300;

  async function signedSongSheetUrl(
    client,
    pathValue,
  ) {
    const pdfPath =
      safeStoragePath(pathValue);

    if (
      !pdfPath ||
      !pdfPath.toLowerCase().endsWith('.pdf')
    ) {
      return '';
    }

    try {
      const {
        data,
        error,
      } = await client
        .storage
        .from(SONG_SHEET_BUCKET)
        .createSignedUrl(
          pdfPath,
          SONG_SHEET_URL_TTL_SECONDS,
          {
            download: true,
          },
        );

      if (error) {
        throw error;
      }

      return safeHttpsUrl(
        data?.signedUrl,
      );
    } catch (error) {
      console.warn(
        'Beveiligd liedblad kon niet worden geladen.',
        error,
      );

      return '';
    }
  }
  async function signedMemberPhotoUrl(
    client,
    photoPathValue,
  ) {
    const photoPath =
      safeStoragePath(photoPathValue);

    if (!photoPath) {
      return '';
    }

    try {
      const {
        data,
        error,
      } = await client
        .storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(
          photoPath,
          PHOTO_URL_TTL_SECONDS,
        );

      if (error) {
        throw error;
      }

      return safeHttpsUrl(
        data?.signedUrl,
      );
    } catch (error) {
      console.warn(
        'Beveiligde ledenfoto kon niet worden geladen.',
        error,
      );

      return '';
    }
  }

  async function loadMemberDirectory(client) {
    const {
      data,
      error,
    } = await client.rpc(
      'get_member_directory',
    );

    if (error) {
      throw new Error(
        `Smoelenboek laden mislukt: ${error.message || 'onbekende fout'}`,
      );
    }

    const rows = Array.isArray(data)
      ? data
      : [];

    return Promise.all(
      rows.map(async (row) => ({
        profileId: row.profile_id,
        fullName: row.full_name || 'Lid',
        memo: row.memo || '',
        photoUrl:
          await signedMemberPhotoUrl(
            client,
            row.photo_path,
          ),
      })),
    );
  }

  window.LedenPortaal = Object.freeze({
    requireActiveMember,
    loadSongs,
    signedSongSheetUrl,
    loadMemberDirectory,
    safeHttpsUrl,
  });

  document.addEventListener(
    'DOMContentLoaded',
    watchNavigation,
  );
})();