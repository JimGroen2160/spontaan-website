(function () {
  'use strict';

  const PHOTO_BUCKET = 'member-photos';
  const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
  const PHOTO_SIGNED_TTL_SECONDS = 300;
  const PHOTO_TYPES = Object.freeze({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  });

  const SONG_SHEET_BUCKET =
    'member-song-sheets';

  const SONG_SHEET_MAX_BYTES =
    5 * 1024 * 1024;

  const state = {
    client: null,
    profile: null,
    songs: [],
    links: [],
    members: [],
    songCategory: 'current',
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function safeHttpsUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function safeStoragePath(value) {
    const candidate = text(value);
    if (!candidate || candidate.startsWith('/') || candidate.includes('\\')) return '';
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(candidate)) return '';
    const parts = candidate.split('/');
    return parts.some((part) => !part || part === '.' || part === '..') ? '' : candidate;
  }

  function setToast(message, type = 'info') {
    const toast = byId('portal-beheer-toast');
    const messageElement = byId('portal-beheer-toast-message');
    if (!toast || !messageElement) return;

    messageElement.textContent = message;
    toast.className = `portal-beheer-toast ${type} visible`;
    toast.hidden = false;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  }

  function closeToast() {
    const toast = byId('portal-beheer-toast');
    if (!toast) return;
    toast.hidden = true;
    toast.classList.remove('visible');
  }

  function createElement(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  }

  async function requireManager() {
    const session = await window.authHelpers.getCurrentSession();
    if (!session) {
      window.location.replace('../leden/login.html');
      return null;
    }

    const profile = await window.authHelpers.getCurrentProfile();
    const allowed = profile && profile.status === 'active' && ['admin', 'contentmanager'].includes(profile.role);

    if (!allowed) {
      window.location.replace('../leden/login.html');
      return null;
    }

    state.client = window.authHelpers.ensureSupabaseClient();
    state.profile = profile;
    return profile;
  }

  function bindTabs() {
    const tabs = Array.from(document.querySelectorAll('[data-beheer-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-beheer-panel]'));

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.beheerTab;
        tabs.forEach((candidate) => {
          const active = candidate === tab;
          candidate.classList.toggle('is-active', active);
          candidate.setAttribute('aria-pressed', String(active));
        });
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.beheerPanel !== target;
        });
      });
    });
  }

  function bindSongCategoryTabs() {
    const tabs = Array.from(document.querySelectorAll('[data-song-category]'));

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const category = tab.dataset.songCategory;
        if (!['current', 'concept', 'archive'].includes(category)) return;

        state.songCategory = category;

        tabs.forEach((candidate) => {
          const active = candidate === tab;
          candidate.classList.toggle('is-active', active);
          candidate.setAttribute('aria-pressed', String(active));
        });

        renderSongs();
      });
    });
  }

  async function loadSongs() {
    const { data: songs, error: songError } = await state.client
      .from('member_songs')
      .select('id,title,category,description,lyrics,pdf_path,is_visible,sort_order')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true });

    if (songError) throw songError;

    const { data: links, error: linkError } = await state.client
      .from('member_song_links')
      .select('id,song_id,label,link_type,url,sort_order')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (linkError) throw linkError;

    state.songs = Array.isArray(songs) ? songs : [];
    state.links = Array.isArray(links) ? links : [];
    renderSongs();
  }

  function categoryLabel(category) {
    return ({ current: 'Huidig', concept: 'Concept', archive: 'Archief' })[category] || category;
  }

  function linksForSong(songId) {
    return state.links.filter((item) => item.song_id === songId);
  }

  function renderSongs() {
    const list = byId('song-admin-list');
    const count = byId('song-admin-count');
    if (!list || !count) return;

    const query = text(byId('song-admin-search')?.value).toLowerCase();
    const category = state.songCategory;

    const filtered = state.songs.filter((song) => {
      const haystack = `${song.title || ''} ${song.description || ''}`.toLowerCase();
      return song.category === category && (!query || haystack.includes(query));
    });

    count.textContent = `${filtered.length} ${filtered.length === 1 ? 'lied' : 'liedjes'} in beheer.`;
    list.replaceChildren();

    if (filtered.length === 0) {
      list.append(createElement('p', 'portal-beheer-empty', 'Geen liedjes gevonden voor deze selectie.'));
      return;
    }

    filtered.forEach((song) => {
      const card = createElement('article', 'portal-beheer-song-card');
      const icon = createElement('div', 'portal-beheer-song-card__icon', '\u266b');
      icon.setAttribute('aria-hidden', 'true');

      const body = createElement('div', 'portal-beheer-song-card__body');
      const meta = createElement('div', 'portal-beheer-song-card__meta');
      meta.append(
        createElement('span', 'portal-beheer-chip', categoryLabel(song.category)),
        createElement('span', song.is_visible ? 'portal-beheer-chip portal-beheer-chip--visible' : 'portal-beheer-chip portal-beheer-chip--hidden', song.is_visible ? 'Zichtbaar' : 'Verborgen'),
      );

      body.append(meta, createElement('h3', '', song.title || 'Zonder titel'));
      body.append(createElement('p', 'portal-beheer-song-card__description', song.description || 'Geen omschrijving.'));

      const resources = createElement('div', 'portal-beheer-song-card__resources');
      const songLinks = linksForSong(song.id);

      if (text(song.lyrics)) {
        resources.append(createElement('span', 'portal-beheer-resource-chip', 'Tekst'));
      }

      if (safeStoragePath(song.pdf_path)) {
        resources.append(
          createElement(
            'span',
            'portal-beheer-resource-chip',
            'PDF',
          ),
        );
      }

      songLinks.forEach((link) => {
        const typeLabel = ({ audio: 'Audio', video: 'Video', other: 'Link' })[link.link_type] || 'Link';
        resources.append(createElement('span', 'portal-beheer-resource-chip', `${typeLabel}: ${link.label || 'Oefenlink'}`));
      });

      if (!resources.childElementCount) {
        resources.append(createElement('span', 'portal-beheer-resource-chip portal-beheer-resource-chip--empty', 'Geen tekst of oefenlinks'));
      }

      body.append(resources);

      const actions = createElement('div', 'portal-beheer-song-card__actions');
      const edit = createElement('button', 'portal-beheer-secondary', 'Bewerken');
      edit.type = 'button';
      edit.addEventListener('click', () => openSongModal(song));

      const remove = createElement('button', 'portal-beheer-danger', 'Verwijderen');
      remove.type = 'button';
      remove.addEventListener('click', () => deleteSong(song));

      actions.append(edit, remove);
      card.append(icon, body, actions);
      list.append(card);
    });
  }

  function addLinkRow(link = {}) {
    const container = byId('song-link-list');
    if (!container) return;

    const row = createElement('div', 'portal-beheer-link-row');
    row.dataset.linkId = link.id || '';

    const label = document.createElement('input');
    label.type = 'text';
    label.placeholder = 'Label, bijvoorbeeld Oefenopname';
    label.value = link.label || '';
    label.dataset.linkField = 'label';
    label.setAttribute('aria-label', 'Linklabel');

    const type = document.createElement('select');
    type.dataset.linkField = 'type';
    type.setAttribute('aria-label', 'Linktype');
    ['audio', 'video', 'other'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = ({ audio: 'Audio', video: 'Video', other: 'Overig' })[value];
      option.selected = (link.link_type || 'audio') === value;
      type.append(option);
    });

    const url = document.createElement('input');
    url.type = 'url';
    url.placeholder = 'https://...';
    url.value = link.url || '';
    url.dataset.linkField = 'url';
    url.setAttribute('aria-label', 'Link-URL');

    const remove = createElement('button', 'portal-beheer-link-remove', 'Verwijder link');
    remove.type = 'button';
    remove.addEventListener('click', () => row.remove());

    row.append(label, type, url, remove);
    container.append(row);
  }

  function updateSongPdfControls(song) {
    const status =
      byId('song-pdf-status');

    const upload =
      byId('song-pdf-upload');

    const remove =
      byId('song-pdf-remove');

    const fileInput =
      byId('song-pdf-file');

    const hasSong =
      Boolean(song?.id);

    const pdfPath =
      safeStoragePath(
        song?.pdf_path,
      );

    if (fileInput) {
      fileInput.value = '';
      fileInput.disabled = !hasSong;
    }

    if (upload) {
      upload.disabled = !hasSong;
    }

    if (remove) {
      remove.hidden = !pdfPath;
      remove.disabled = !hasSong;
    }

    if (status) {
      status.textContent =
        !hasSong
          ? 'Sla het nieuwe lied eerst op voordat u een PDF toevoegt.'
          : pdfPath
            ? 'Er is een beveiligd PDF-liedblad gekoppeld.'
            : 'Geen PDF-liedblad gekoppeld.';
    }
  }

  function validatedSongPdf(file) {
    if (!file) {
      throw new Error(
        'Kies eerst een PDF-bestand.',
      );
    }

    if (
      file.type !== 'application/pdf' ||
      !file.name
        .toLowerCase()
        .endsWith('.pdf')
    ) {
      throw new Error(
        'Gebruik alleen een PDF-bestand.',
      );
    }

    if (
      file.size <= 0 ||
      file.size > SONG_SHEET_MAX_BYTES
    ) {
      throw new Error(
        'Het PDF-bestand mag maximaal 5 MiB groot zijn.',
      );
    }

    return file;
  }

  async function uploadSongPdf(
    song,
    fileInput,
  ) {
    if (!song?.id) {
      setToast(
        'Sla het lied eerst op voordat u een PDF toevoegt.',
        'error',
      );
      return;
    }

    try {
      const file =
        validatedSongPdf(
          fileInput?.files?.[0],
        );

      const token =
        typeof crypto?.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()
              .toString(16)
              .slice(2)}`;

      const newPath =
        `songs/${song.id}/${token}.pdf`;

      const storage =
        state.client.storage.from(
          SONG_SHEET_BUCKET,
        );

      const {
        error: uploadError,
      } =
        await storage.upload(
          newPath,
          file,
          {
            cacheControl: '3600',
            contentType:
              'application/pdf',
            upsert: false,
          },
        );

      if (uploadError) {
        throw uploadError;
      }

      try {
        const {
          error: metadataError,
        } =
          await state.client
            .from('member_songs')
            .update({
              pdf_path: newPath,
            })
            .eq(
              'id',
              song.id,
            );

        if (metadataError) {
          throw metadataError;
        }
      } catch (metadataError) {
        await storage.remove([
          newPath,
        ]);

        throw metadataError;
      }

      const oldPath =
        safeStoragePath(
          song.pdf_path,
        );

      song.pdf_path = newPath;

      if (
        oldPath &&
        oldPath !== newPath
      ) {
        const {
          error: cleanupError,
        } =
          await storage.remove([
            oldPath,
          ]);

        if (cleanupError) {
          console.warn(
            'Oud PDF-liedblad kon niet worden opgeruimd:',
            cleanupError,
          );
        }
      }

      await loadSongs();

      updateSongPdfControls(
        song,
      );

      setToast(
        `PDF-liedblad voor ${song.title} is opgeslagen.`,
        'success',
      );
    } catch (error) {
      console.error(
        'PDF-liedblad uploaden mislukt:',
        error,
      );

      setToast(
        error?.message ||
          'PDF-liedblad uploaden is mislukt.',
        'error',
      );
    }
  }

  async function removeSongPdf(song) {
    const oldPath =
      safeStoragePath(
        song?.pdf_path,
      );

    if (!song?.id || !oldPath) {
      return;
    }

    if (
      !window.confirm(
        `PDF-liedblad van "${song.title}" verwijderen?`,
      )
    ) {
      return;
    }

    try {
      const {
        error: metadataError,
      } =
        await state.client
          .from('member_songs')
          .update({
            pdf_path: null,
          })
          .eq(
            'id',
            song.id,
          );

      if (metadataError) {
        throw metadataError;
      }

      song.pdf_path = null;

      const storage =
        state.client.storage.from(
          SONG_SHEET_BUCKET,
        );

      const {
        error: removeError,
      } =
        await storage.remove([
          oldPath,
        ]);

      await loadSongs();

      updateSongPdfControls(
        song,
      );

      if (removeError) {
        console.warn(
          'PDF is losgekoppeld, maar het oude private bestand kon niet worden opgeruimd:',
          removeError,
        );

        setToast(
          'PDF is verwijderd uit het lied; technisch beheer moet het oude opslagbestand nog opruimen.',
          'error',
        );

        return;
      }

      setToast(
        `PDF-liedblad van ${song.title} is verwijderd.`,
        'success',
      );
    } catch (error) {
      console.error(
        'PDF-liedblad verwijderen mislukt:',
        error,
      );

      setToast(
        'PDF-liedblad verwijderen is mislukt.',
        'error',
      );
    }
  }
  function resetSongForm() {
    byId('song-form')?.reset();
    if (byId('song-id')) byId('song-id').value = '';
    if (byId('song-sort-order')) byId('song-sort-order').value = '0';
    if (byId('song-visible')) byId('song-visible').checked = true;
    byId('song-link-list')?.replaceChildren();
    if (byId('song-form-error')) byId('song-form-error').textContent = '';
    updateSongPdfControls(null);
  }

  function openSongModal(song = null) {
    resetSongForm();
    const modal = byId('song-modal');
    if (!modal) return;

    byId('song-modal-title').textContent = song ? 'Lied bewerken' : 'Lied toevoegen';

    if (song) {
      byId('song-id').value = song.id;
      byId('song-title').value = song.title || '';
      byId('song-category').value = song.category || 'current';
      byId('song-sort-order').value = String(song.sort_order ?? 0);
      byId('song-description').value = song.description || '';
      byId('song-lyrics').value = song.lyrics || '';
      byId('song-visible').checked = song.is_visible === true;
      linksForSong(song.id).forEach(addLinkRow);
    }

    updateSongPdfControls(song);

    const pdfFile =
      byId('song-pdf-file');

    const pdfUpload =
      byId('song-pdf-upload');

    const pdfRemove =
      byId('song-pdf-remove');

    if (pdfUpload) {
      pdfUpload.onclick =
        () =>
          uploadSongPdf(
            song,
            pdfFile,
          );
    }

    if (pdfRemove) {
      pdfRemove.onclick =
        () =>
          removeSongPdf(song);
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    byId('song-title')?.focus();
  }

  function closeSongModal() {
    const modal = byId('song-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    resetSongForm();
  }

  function collectSongForm() {
    const title = text(byId('song-title')?.value);
    const category = byId('song-category')?.value;
    const description = text(byId('song-description')?.value);
    const lyrics = text(byId('song-lyrics')?.value);
    const sortOrder = Number.parseInt(byId('song-sort-order')?.value || '0', 10);
    const isVisible = byId('song-visible')?.checked === true;

    if (!title) throw new Error('Titel is verplicht.');
    if (!['current', 'concept', 'archive'].includes(category)) throw new Error('Kies een geldige categorie.');
    if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new Error('Sortering moet een geheel getal van 0 of hoger zijn.');

    const linkRows = Array.from(document.querySelectorAll('.portal-beheer-link-row'));
    const links = linkRows.map((row, index) => {
      const label = text(row.querySelector('[data-link-field="label"]')?.value);
      const type = row.querySelector('[data-link-field="type"]')?.value;
      const url = text(row.querySelector('[data-link-field="url"]')?.value);

      if (!label || !url) throw new Error('Elke oefenlink heeft een label en URL nodig.');
      if (!['audio', 'video', 'other'].includes(type)) throw new Error('Ongeldig linktype.');
      const safeUrl = safeHttpsUrl(url);
      if (!safeUrl) throw new Error('Oefenlinks moeten geldige HTTPS-links zijn.');

      return {
        id: row.dataset.linkId || '',
        label,
        link_type: type,
        url: safeUrl,
        sort_order: index,
      };
    });

    return {
      id: byId('song-id')?.value || '',
      song: {
        title,
        category,
        description,
        lyrics,
        is_visible: isVisible,
        sort_order: sortOrder,
      },
      links,
    };
  }

  async function syncSongLinks(songId, formLinks) {
    const existing = state.links.filter((item) => item.song_id === songId);
    const existingIds = new Set(existing.map((item) => item.id));
    const keptIds = new Set();

    for (const link of formLinks) {
      const payload = {
        song_id: songId,
        label: link.label,
        link_type: link.link_type,
        url: link.url,
        sort_order: link.sort_order,
      };

      if (link.id && existingIds.has(link.id)) {
        const { error } = await state.client.from('member_song_links').update(payload).eq('id', link.id);
        if (error) throw error;
        keptIds.add(link.id);
      } else {
        const { error } = await state.client.from('member_song_links').insert(payload);
        if (error) throw error;
      }
    }

    const removedIds = existing.map((item) => item.id).filter((id) => !keptIds.has(id));
    if (removedIds.length > 0) {
      const { error } = await state.client.from('member_song_links').delete().in('id', removedIds);
      if (error) throw error;
    }
  }

  async function saveSong(event) {
    event.preventDefault();
    const errorElement = byId('song-form-error');

    try {
      const form = collectSongForm();
      let songId = form.id;

      if (songId) {
        const { error } = await state.client.from('member_songs').update(form.song).eq('id', songId);
        if (error) throw error;
      } else {
        const { data, error } = await state.client.from('member_songs').insert(form.song).select('id').single();
        if (error || !data?.id) throw error || new Error('Nieuw lied kreeg geen ID terug.');
        songId = data.id;
      }

      await syncSongLinks(songId, form.links);
      await loadSongs();
      closeSongModal();
      setToast('Lied en oefenlinks zijn opgeslagen.', 'success');
    } catch (error) {
      console.error('Lied opslaan mislukt:', error);
      if (errorElement) errorElement.textContent = error?.message || 'Lied opslaan mislukt.';
    }
  }

  async function deleteSong(song) {
    if (!window.confirm(`Lied "${song.title}" verwijderen?`)) return;

    try {
      const pdfPath =
        safeStoragePath(
          song.pdf_path,
        );

      const { error } = await state.client.from('member_songs').delete().eq('id', song.id);
      if (error) throw error;

      let pdfCleanupError = null;

      if (pdfPath) {
        const result =
          await state.client.storage
            .from(SONG_SHEET_BUCKET)
            .remove([
              pdfPath,
            ]);

        pdfCleanupError =
          result.error || null;
      }

      await loadSongs();

      if (pdfCleanupError) {
        console.warn(
          'Lied is verwijderd, maar het private PDF-bestand kon niet worden opgeruimd:',
          pdfCleanupError,
        );

        setToast(
          'Lied is verwijderd; technisch beheer moet het oude PDF-bestand nog opruimen.',
          'error',
        );

        return;
      }

      setToast('Lied is verwijderd.', 'success');
    } catch (error) {
      console.error('Lied verwijderen mislukt:', error);
      setToast('Lied verwijderen is mislukt.', 'error');
    }
  }

  async function signedPhotoUrl(path) {
    const safePath = safeStoragePath(path);
    if (!safePath) return '';

    const { data, error } = await state.client.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(safePath, PHOTO_SIGNED_TTL_SECONDS);

    if (error) return '';
    return safeHttpsUrl(data?.signedUrl);
  }

  async function loadDirectory() {
    const { data: profiles, error: profilesError } = await state.client
      .from('profiles')
      .select('id,full_name,role,status')
      .eq('status', 'active')
      .order('full_name', { ascending: true });

    if (profilesError) throw profilesError;

    const { data: directory, error: directoryError } = await state.client
      .from('member_directory')
      .select('profile_id,memo,photo_path');

    if (directoryError) throw directoryError;

    const metadata = new Map((directory || []).map((item) => [item.profile_id, item]));

    state.members = await Promise.all((profiles || []).map(async (profile) => {
      const item = metadata.get(profile.id) || {};
      return {
        profile_id: profile.id,
        full_name: profile.full_name || 'Lid',
        role: profile.role,
        memo: item.memo || '',
        photo_path: item.photo_path || null,
        photo_url: await signedPhotoUrl(item.photo_path),
      };
    }));

    renderDirectory();
  }

  function initials(name) {
    return text(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'L';
  }

  function renderDirectory() {
    const grid = byId('directory-admin-grid');
    const count = byId('directory-admin-count');
    if (!grid || !count) return;

    const query = text(byId('directory-admin-search')?.value).toLowerCase();
    const filtered = state.members.filter((member) => !query || member.full_name.toLowerCase().includes(query));

    count.textContent = `${filtered.length} ${filtered.length === 1 ? 'actief lid' : 'actieve leden'} in beheer.`;
    grid.replaceChildren();

    if (filtered.length === 0) {
      grid.append(createElement('p', 'portal-beheer-empty', 'Geen actieve leden gevonden.'));
      return;
    }

    filtered.forEach((member) => {
      const card = createElement('article', 'portal-beheer-member-card');
      card.dataset.profileId = member.profile_id;

      const media = createElement('div', 'portal-beheer-member-card__media');
      if (member.photo_url) {
        const image = document.createElement('img');
        image.src = member.photo_url;
        image.alt = `Foto van ${member.full_name}`;
        media.append(image);
      } else {
        const placeholder = createElement('div', 'portal-beheer-member-card__placeholder', initials(member.full_name));
        placeholder.setAttribute('aria-label', `Nog geen foto voor ${member.full_name}`);
        media.append(placeholder);
      }

      const title = createElement('h3', '', member.full_name);
      const role = createElement('p', 'portal-beheer-member-card__role', member.role === 'contentmanager' ? 'Contentmanager' : member.role === 'admin' ? 'Administrator' : 'Lid');
      const memoPreview = createElement('p', 'portal-beheer-member-card__memo-preview', member.memo || 'Nog geen memo.');

      const manage = document.createElement('details');
      manage.className = 'portal-beheer-member-card__manage';
      manage.append(createElement('summary', '', 'Memo en foto beheren'));

      const memoLabel = createElement('label', 'portal-beheer-member-card__memo');
      memoLabel.append(createElement('span', '', 'Memo'));
      const memo = document.createElement('textarea');
      memo.rows = 4;
      memo.maxLength = 500;
      memo.value = member.memo;
      memo.dataset.memberMemo = member.profile_id;
      memoLabel.append(memo);

      const memoSave = createElement('button', 'portal-beheer-secondary', 'Memo opslaan');
      memoSave.type = 'button';
      memoSave.addEventListener('click', () => saveMemo(member, memo.value));

      const photoLabel = createElement('label', 'portal-beheer-member-card__upload');
      photoLabel.append(createElement('span', '', 'Nieuwe foto (JPEG, PNG of WebP, max. 5 MiB)'));
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/jpeg,image/png,image/webp';
      fileInput.dataset.memberPhoto = member.profile_id;
      photoLabel.append(fileInput);

      const photoActions = createElement('div', 'portal-beheer-member-card__actions');
      const upload = createElement('button', 'portal-beheer-primary', member.photo_path ? 'Foto vervangen' : 'Foto uploaden');
      upload.type = 'button';
      upload.addEventListener('click', () => uploadPhoto(member, fileInput));
      photoActions.append(upload);

      if (member.photo_path) {
        const remove = createElement('button', 'portal-beheer-danger', 'Foto verwijderen');
        remove.type = 'button';
        remove.addEventListener('click', () => removePhoto(member));
        photoActions.append(remove);
      }

      manage.append(memoLabel, memoSave, photoLabel, photoActions);
      card.append(media, title, role, memoPreview, manage);
      grid.append(card);
    });
  }

  async function upsertDirectory(member, memo, photoPath) {
    const payload = {
      profile_id: member.profile_id,
      memo: text(memo),
      photo_path: photoPath || null,
    };

    const { error } = await state.client.from('member_directory').upsert(payload, { onConflict: 'profile_id' });
    if (error) throw error;
  }

  async function saveMemo(member, memo) {
    try {
      await upsertDirectory(member, memo, member.photo_path);
      member.memo = text(memo);
      renderDirectory();
      setToast(`Memo voor ${member.full_name} is opgeslagen.`, 'success');
    } catch (error) {
      console.error('Memo opslaan mislukt:', error);
      setToast('Memo opslaan is mislukt.', 'error');
    }
  }

  function validatedPhoto(file) {
    if (!file) throw new Error('Kies eerst een foto.');
    const extension = PHOTO_TYPES[file.type];
    if (!extension) throw new Error('Gebruik alleen JPEG, PNG of WebP.');
    if (file.size <= 0 || file.size > PHOTO_MAX_BYTES) throw new Error('De foto mag maximaal 5 MiB groot zijn.');
    return extension;
  }

  async function uploadPhoto(member, fileInput) {
    try {
      const file = fileInput.files?.[0];
      const extension = validatedPhoto(file);
      const token = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newPath = `${member.profile_id}/${token}.${extension}`;

      const storage = state.client.storage.from(PHOTO_BUCKET);
      const { error: uploadError } = await storage.upload(newPath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) throw uploadError;

      try {
        await upsertDirectory(member, member.memo, newPath);
      } catch (metadataError) {
        await storage.remove([newPath]);
        throw metadataError;
      }

      const oldPath = safeStoragePath(member.photo_path);
      if (oldPath && oldPath !== newPath) {
        const { error: cleanupError } = await storage.remove([oldPath]);
        if (cleanupError) console.warn('Oude ledenfoto kon niet worden opgeruimd:', cleanupError);
      }

      await loadDirectory();
      setToast(`Foto voor ${member.full_name} is opgeslagen.`, 'success');
    } catch (error) {
      console.error('Foto uploaden mislukt:', error);
      setToast(error?.message || 'Foto uploaden is mislukt.', 'error');
    }
  }

  async function removePhoto(member) {
    const oldPath = safeStoragePath(member.photo_path);
    if (!oldPath) return;
    if (!window.confirm(`Foto van ${member.full_name} verwijderen?`)) return;

    const storage = state.client.storage.from(PHOTO_BUCKET);

    try {
      await upsertDirectory(member, member.memo, null);
      const { error: removeError } = await storage.remove([oldPath]);
      await loadDirectory();

      if (removeError) {
        console.warn('Foto is uit het smoelenboek verwijderd, maar het oude private opslagbestand kon niet worden opgeruimd:', removeError);
        setToast('Foto is uit het smoelenboek verwijderd; technisch beheer moet het oude private opslagbestand nog opruimen.', 'error');
        return;
      }

      setToast(`Foto van ${member.full_name} is verwijderd.`, 'success');
    } catch (error) {
      console.error('Foto verwijderen mislukt:', error);
      setToast('Foto verwijderen is mislukt.', 'error');
    }
  }

  async function init() {
    try {
      const profile = await requireManager();
      if (!profile) return;

      byId('portal-beheer-content').hidden = false;
      byId('portal-beheer-auth-status').textContent = `Beheerrechten actief voor ${profile.full_name || 'beheerder'}.`;

      bindTabs();
      bindSongCategoryTabs();
      byId('portal-beheer-toast-close')?.addEventListener('click', closeToast);
      byId('song-new')?.addEventListener('click', () => openSongModal());
      byId('song-modal-close')?.addEventListener('click', closeSongModal);
      byId('song-cancel')?.addEventListener('click', closeSongModal);
      byId('song-link-add')?.addEventListener('click', () => addLinkRow());
      byId('song-form')?.addEventListener('submit', saveSong);
      byId('song-admin-search')?.addEventListener('input', renderSongs);
      byId('directory-admin-search')?.addEventListener('input', renderDirectory);

      await Promise.all([loadSongs(), loadDirectory()]);
    } catch (error) {
      console.error('Ledenportaalbeheer starten mislukt:', error);
      byId('portal-beheer-content').hidden = false;
      byId('portal-beheer-auth-status').textContent = 'Het ledenportaalbeheer kon niet worden geladen.';
      setToast('Ledenportaalbeheer kon niet worden geladen.', 'error');
    }
  }

  window.ledenportaalBeheer = Object.freeze({ init });
  document.addEventListener('DOMContentLoaded', init);
})();