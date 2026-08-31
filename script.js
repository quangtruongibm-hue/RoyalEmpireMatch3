document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);

  // Firebase is initialized in index.html before this file is loaded.
  const contentKeys = ['company-desc', 'player-policy', 'programs', 'contact-support', 'footer-info'];
  const contentDoc = db.collection('siteContent').doc('site');
  const gamesCollection = db.collection('games');

  let gamesCache = [];
  let selectedGameId = '';
  let firebaseAppearance = null;

  const loginModal = $('login-modal');
  const adminModal = $('admin-dashboard-modal');

  function setMsg(id, text, ok = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.style.color = ok ? '#10b981' : '#ef4444';
  }

  function clean(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function isExternalUrl(value) {
    return /^(https?:|data:|blob:|\/)/i.test(clean(value));
  }

  function githubBlobToRaw(value) {
    try {
      const u = new URL(value);
      if (u.hostname.toLowerCase() === 'github.com' && u.pathname.includes('/blob/')) {
        const parts = u.pathname.split('/').filter(Boolean);
        const blobIndex = parts.indexOf('blob');
        if (blobIndex >= 2 && parts.length > blobIndex + 2) {
          const owner = parts[0];
          const repo = parts[1];
          const branch = parts[blobIndex + 1];
          const filePath = parts.slice(blobIndex + 2).join('/');
          return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
        }
      }
    } catch (_) {}
    return value;
  }

  // Accepts a GitHub filename, images/file.jpg, /images/file.jpg, or a full URL.
  function normalizeAsset(value, folder) {
    let v = clean(value);
    if (!v) return '';
    v = githubBlobToRaw(v);
    if (isExternalUrl(v)) return v;
    if (v.startsWith(`${folder}/`)) return v;
    if (v.startsWith(`./${folder}/`)) return v.slice(2);
    return `${folder}/${v.replace(/^\/+/, '')}`;
  }

  function updateAppearancePreview(rawAppearance) {
    const previewBar = $('appearance-preview-bar');
    if (!previewBar) return;

    const a = normalizeAppearance(rawAppearance);
    const imageUrl = normalizeAsset(a.bannerUrl, 'images');
    const overlay = Math.min(80, Math.max(0, Number(a.overlayOpacity) || 0)) / 100;
    const brightness = Math.min(140, Math.max(20, Number(a.bannerBrightness) || 70)) / 100;

    // Clear any previous state first so an invalid/new URL cannot leave the old image visible.
    previewBar.classList.remove('preview-loading', 'preview-error-state');
    previewBar.removeAttribute('data-preview-url');
    previewBar.style.backgroundImage = '';
    previewBar.style.filter = `brightness(${brightness})`;

    if (!imageUrl) {
      previewBar.classList.add('preview-error-state');
      previewBar.textContent = 'Chưa có ảnh banner';
      return;
    }

    previewBar.textContent = '';
    previewBar.classList.add('preview-loading');
    previewBar.style.setProperty('--preview-overlay-opacity', String(overlay));

    const loader = new Image();
    loader.onload = () => {
      // Ignore an older request if the user has already typed another URL.
      if ($('edit-banner-url') && normalizeAsset($('edit-banner-url').value, 'images') !== imageUrl) return;
      previewBar.classList.remove('preview-loading', 'preview-error-state');
      previewBar.style.backgroundImage = `linear-gradient(rgba(15,23,42,${overlay}), rgba(15,23,42,${overlay})), url("${imageUrl.replace(/\"/g, '%22')}")`;
      previewBar.setAttribute('data-preview-url', imageUrl);
    };
    loader.onerror = () => {
      if ($('edit-banner-url') && normalizeAsset($('edit-banner-url').value, 'images') !== imageUrl) return;
      previewBar.classList.remove('preview-loading');
      previewBar.classList.add('preview-error-state');
      previewBar.textContent = 'Không tải được ảnh banner. Hãy kiểm tra URL hoặc file ảnh.';
    };
    loader.src = imageUrl;
  }

  function youtubeEmbed(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
        const id = u.pathname.split('/').filter(Boolean)[0];
        return id ? `https://www.youtube.com/embed/${id}` : '';
      }
      if (host.includes('youtube.com')) {
        const id = u.searchParams.get('v');
        if (id) return `https://www.youtube.com/embed/${id}`;
        if (u.pathname.startsWith('/embed/')) return url;
        if (u.pathname.startsWith('/shorts/')) {
          const id2 = u.pathname.split('/')[2];
          return id2 ? `https://www.youtube.com/embed/${id2}` : '';
        }
      }
    } catch (_) {}
    return '';
  }

  function clearPreview(id) {
    const el = $(id);
    if (el) el.innerHTML = '';
  }

  function previewImage(inputId, previewId) {
    const input = $(inputId);
    const preview = $(previewId);
    if (!input || !preview) return;

    const raw = clean(input.value);
    preview.innerHTML = '';
    if (!raw) return;

    const img = document.createElement('img');
    img.src = normalizeAsset(raw, 'images');
    img.alt = 'Xem trước ảnh';
    img.loading = 'lazy';
    img.onerror = () => {
      preview.innerHTML = '<span class="preview-error">Không tải được ảnh. Kiểm tra tên file hoặc URL.</span>';
    };
    preview.appendChild(img);
  }

  function previewVideo(inputId, previewId) {
    const input = $(inputId);
    const preview = $(previewId);
    if (!input || !preview) return;

    const raw = clean(input.value);
    preview.innerHTML = '';
    if (!raw) return;

    const url = normalizeAsset(raw, 'videos');
    const embed = youtubeEmbed(url);

    if (embed) {
      const iframe = document.createElement('iframe');
      iframe.src = embed;
      iframe.title = 'Xem trước video';
      iframe.loading = 'lazy';
      iframe.allowFullscreen = true;
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      preview.appendChild(iframe);
      return;
    }

    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.preload = 'metadata';
    video.onerror = () => {
      preview.innerHTML = '<span class="preview-error">Không phát được video. Kiểm tra URL hoặc định dạng MP4/WebM.</span>';
    };
    preview.appendChild(video);
  }

  function bindAssetPreviews() {
    [1, 2, 3].forEach((n) => {
      const imageInput = $(`edit-game-image${n}`);
      const videoInput = $(`edit-game-video${n}`);
      if (imageInput) imageInput.addEventListener('input', () => previewImage(`edit-game-image${n}`, `image-preview-${n}`));
      if (videoInput) videoInput.addEventListener('input', () => previewVideo(`edit-game-video${n}`, `video-preview-${n}`));
    });
  }

  // ---------- Admin sidebar navigation ----------
  document.querySelectorAll('.admin-nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach((i) => i.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.remove('active'));
      item.classList.add('active');
      const target = $(item.getAttribute('data-admin-target'));
      if (target) target.classList.add('active');
    });
  });

  // ---------- Tabs ----------
  document.querySelectorAll('#menu-list li').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('#menu-list li').forEach((i) => i.classList.remove('active'));
      document.querySelectorAll('.content-section').forEach((s) => s.classList.remove('active'));
      item.classList.add('active');
      const target = $(item.getAttribute('data-target'));
      if (target) target.classList.add('active');
    });
  });

  // ---------- Common website content ----------
  async function loadSiteContent() {
    try {
      const snapshot = await contentDoc.get();
      if (!snapshot.exists) return;
      const data = snapshot.data() || {};
      contentKeys.forEach((key) => {
        const el = $(`content-${key}`);
        if (el && data[key] != null) el.innerHTML = data[key];
      });
      applyAppearance(data.appearance);
    } catch (error) {
      console.error('Lỗi tải nội dung website:', error);
      const hero = document.querySelector('.hero-section');
      if (hero) hero.classList.remove('banner-pending');
      applyAppearance(defaultAppearance);
    }
  }

  async function fillCommonAdmin() {
    const snapshot = await contentDoc.get();
    if (!snapshot.exists) return;
    const data = snapshot.data() || {};
    contentKeys.forEach((key) => {
      const el = $(`edit-${key}`);
      if (el) el.value = data[key] || '';
    });
  }

  // ---------- Website appearance ----------
  // KHÔNG dùng bất kỳ banner mặc định/cũ nào. Banner chỉ lấy từ Firebase.
  // Nếu Firebase còn chứa một URL banner cũ đã biết, coi như chưa có banner.
  const defaultAppearance = {
    bannerUrl: '',
    bannerBrightness: 70,
    overlayOpacity: 35,
    bgColor: '#0f172a',
    cardColor: '#1e293b',
    accentColor: '#3b82f6',
    textColor: '#f8fafc',
    secondaryTextColor: '#94a3b8',
    borderColor: '#334155'
  };

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function normalizeAppearance(data) {
    const a = data && typeof data === 'object' ? data : {};
    return {
      bannerUrl: clean(a.bannerUrl),
      bannerBrightness: clampNumber(a.bannerBrightness, 20, 140, defaultAppearance.bannerBrightness),
      overlayOpacity: clampNumber(a.overlayOpacity, 0, 80, defaultAppearance.overlayOpacity),
      bgColor: /^#[0-9a-f]{6}$/i.test(a.bgColor || '') ? a.bgColor : defaultAppearance.bgColor,
      cardColor: /^#[0-9a-f]{6}$/i.test(a.cardColor || '') ? a.cardColor : defaultAppearance.cardColor,
      accentColor: /^#[0-9a-f]{6}$/i.test(a.accentColor || '') ? a.accentColor : defaultAppearance.accentColor,
      textColor: /^#[0-9a-f]{6}$/i.test(a.textColor || '') ? a.textColor : defaultAppearance.textColor,
      secondaryTextColor: /^#[0-9a-f]{6}$/i.test(a.secondaryTextColor || '') ? a.secondaryTextColor : defaultAppearance.secondaryTextColor,
      borderColor: /^#[0-9a-f]{6}$/i.test(a.borderColor || '') ? a.borderColor : defaultAppearance.borderColor
    };
  }

  function applyAppearance(rawAppearance) {
    const a = normalizeAppearance(rawAppearance);
    const root = document.documentElement;
    root.style.setProperty('--bg-main', a.bgColor);
    root.style.setProperty('--bg-card', a.cardColor);
    root.style.setProperty('--accent-color', a.accentColor);
    root.style.setProperty('--accent-hover', a.accentColor);
    root.style.setProperty('--text-primary', a.textColor);
    root.style.setProperty('--text-secondary', a.secondaryTextColor);
    root.style.setProperty('--border-color', a.borderColor);
    root.style.setProperty('--hero-brightness', String(a.bannerBrightness / 100));
    root.style.setProperty('--hero-overlay-opacity', String(a.overlayOpacity / 100));
    const heroUrl = normalizeAsset(a.bannerUrl, 'images');
    root.style.setProperty('--hero-image', heroUrl ? `url("${heroUrl.replace(/\"/g, '%22')}")` : 'none');
    const hero = document.querySelector('.hero-section');
    if (hero) hero.classList.remove('banner-pending');
    updateAppearancePreview(a);
  }

  function fillAppearanceForm(rawAppearance) {
    const a = normalizeAppearance(rawAppearance);
    if ($('edit-banner-url')) $('edit-banner-url').value = a.bannerUrl;
    if ($('edit-banner-brightness')) $('edit-banner-brightness').value = a.bannerBrightness;
    if ($('edit-overlay-opacity')) $('edit-overlay-opacity').value = a.overlayOpacity;
    if ($('edit-bg-color')) $('edit-bg-color').value = a.bgColor;
    if ($('edit-card-color')) $('edit-card-color').value = a.cardColor;
    if ($('edit-accent-color')) $('edit-accent-color').value = a.accentColor;
    if ($('edit-text-color')) $('edit-text-color').value = a.textColor;
    if ($('edit-secondary-text-color')) $('edit-secondary-text-color').value = a.secondaryTextColor;
    if ($('edit-border-color')) $('edit-border-color').value = a.borderColor;
    if ($('banner-brightness-value')) $('banner-brightness-value').textContent = a.bannerBrightness;
    if ($('overlay-opacity-value')) $('overlay-opacity-value').textContent = a.overlayOpacity;
    applyAppearance(a);
  }

  function getAppearanceFromForm() {
    const saved = firebaseAppearance || defaultAppearance;
    const bannerInput = clean($('edit-banner-url')?.value);

    return normalizeAppearance({
      // Ô trống = xóa banner hiện tại, tuyệt đối không quay về banner cũ.
      bannerUrl: bannerInput,
      bannerBrightness: $('edit-banner-brightness')?.value || saved.bannerBrightness,
      overlayOpacity: $('edit-overlay-opacity')?.value || saved.overlayOpacity,
      bgColor: $('edit-bg-color')?.value || saved.bgColor,
      cardColor: $('edit-card-color')?.value || saved.cardColor,
      accentColor: $('edit-accent-color')?.value || saved.accentColor,
      textColor: $('edit-text-color')?.value || saved.textColor,
      secondaryTextColor: $('edit-secondary-text-color')?.value || saved.secondaryTextColor,
      borderColor: $('edit-border-color')?.value || saved.borderColor
    });
  }

  async function loadAppearance() {
    const snapshot = await contentDoc.get();
    const data = snapshot.exists ? (snapshot.data() || {}) : {};
    // Chỉ đọc banner hiện tại từ Firebase; không có fallback banner cũ.
    firebaseAppearance = normalizeAppearance(data.appearance);
    applyAppearance(firebaseAppearance);
    return firebaseAppearance;
  }

  async function fillAppearanceAdmin() {
    const snapshot = await contentDoc.get();
    const data = snapshot.exists ? (snapshot.data() || {}) : {};
    firebaseAppearance = normalizeAppearance(data.appearance);
    fillAppearanceForm(firebaseAppearance);
  }

  // ---------- Game data compatibility ----------
  // Reads both the current field names and common older field names.
  function firstString(data, keys) {
    for (const key of keys) {
      const value = data?.[key];
      if (typeof value === 'string' && clean(value)) return clean(value);
    }
    return '';
  }

  function readAssetArray(data, type) {
    const field = type === 'image' ? 'images' : 'videos';
    const prefix = type === 'image' ? 'image' : 'video';
    const result = [];

    if (Array.isArray(data?.[field])) {
      data[field].forEach((v) => {
        if (typeof v === 'string' && clean(v)) result.push(clean(v));
      });
    }

    for (let i = 1; i <= 3; i++) {
      const value = firstString(data, [
        `${prefix}${i}`,
        `${prefix}_${i}`,
        `${prefix}-${i}`,
        `${field}${i}`,
        `${field}_${i}`
      ]);
      if (value && !result.includes(value)) result.push(value);
    }

    return result.slice(0, 3);
  }

  function normalizeGame(doc) {
    const data = doc.data() || {};
    return {
      id: doc.id,
      ...data,
      name: firstString(data, ['name', 'title', 'gameName']),
      description: firstString(data, ['description', 'gameDescription', 'desc', 'content']),
      playStoreUrl: firstString(data, ['playStoreUrl', 'playStoreLink', 'playStore', 'downloadUrl', 'downloadLink', 'googlePlayUrl']),
      images: readAssetArray(data, 'image'),
      videos: readAssetArray(data, 'video')
    };
  }

  async function getGameFresh(gameId) {
    if (!gameId) return null;
    const snapshot = await gamesCollection.doc(gameId).get();
    if (!snapshot.exists) return null;
    return normalizeGame(snapshot);
  }

  function gameToFormValues(game) {
    const images = game.images || [];
    const videos = game.videos || [];
    return {
      name: game.name || '',
      description: game.description || '',
      playStoreUrl: game.playStoreUrl || '',
      image1: images[0] || '',
      image2: images[1] || '',
      image3: images[2] || '',
      video1: videos[0] || '',
      video2: videos[1] || '',
      video3: videos[2] || ''
    };
  }

  // ---------- Public games ----------
  function renderPublicGameSelect(selectedId = '') {
    const select = $('public-game-select');
    if (!select) return;
    select.innerHTML = '';

    if (!gamesCache.length) {
      select.innerHTML = '<option value="">-- Chưa có game --</option>';
      return;
    }

    gamesCache.forEach((game) => {
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.name || '(Game chưa có tên)';
      select.appendChild(option);
    });

    const exists = gamesCache.some((g) => g.id === selectedId);
    select.value = exists ? selectedId : gamesCache[0].id;
  }

  function appendPublicImage(gallery, game, value, index) {
    const raw = clean(value);
    if (!raw) return;
    const img = document.createElement('img');
    img.src = normalizeAsset(raw, 'images');
    img.alt = `${game.name} - Ảnh ${index + 1}`;
    img.loading = 'lazy';
    img.onerror = () => img.remove();
    gallery.appendChild(img);
  }

  function appendPublicVideo(videosBox, game, value, index) {
    const raw = clean(value);
    if (!raw) return;

    const url = normalizeAsset(raw, 'videos');
    const wrap = document.createElement('div');
    wrap.className = 'video-wrapper';

    const embed = youtubeEmbed(url);
    if (embed) {
      const iframe = document.createElement('iframe');
      iframe.src = embed;
      iframe.title = `${game.name} - Video ${index + 1}`;
      iframe.loading = 'lazy';
      iframe.allowFullscreen = true;
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      wrap.appendChild(iframe);
    } else {
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.preload = 'metadata';
      wrap.appendChild(video);
    }
    videosBox.appendChild(wrap);
  }

  function renderPublicGame(game) {
    const empty = $('game-public-empty');
    const content = $('game-public-content');
    if (!game) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }

    empty.hidden = true;
    content.hidden = false;
    $('public-game-name').textContent = game.name || '';
    $('public-game-desc').innerHTML = game.description || '<p>Chưa có giới thiệu.</p>';

    const play = $('public-game-playstore');
    if (game.playStoreUrl) {
      play.href = game.playStoreUrl;
      play.style.display = 'inline-block';
    } else {
      play.removeAttribute('href');
      play.style.display = 'none';
    }

    const gallery = $('public-game-gallery');
    gallery.innerHTML = '';
    (game.images || []).slice(0, 3).forEach((value, i) => appendPublicImage(gallery, game, value, i));

    const videos = $('public-game-videos');
    videos.innerHTML = '';
    (game.videos || []).slice(0, 3).forEach((value, i) => appendPublicVideo(videos, game, value, i));

    // Hide headings when there is no media for that section.
    const galleryHeading = gallery.previousElementSibling;
    const videosHeading = videos.previousElementSibling;
    if (galleryHeading) galleryHeading.style.display = gallery.children.length ? '' : 'none';
    if (videosHeading) videosHeading.style.display = videos.children.length ? '' : 'none';
  }

  async function loadGamesPublic(keepSelected = true) {
    try {
      const oldPublicId = keepSelected ? $('public-game-select')?.value : '';
      const snapshot = await gamesCollection.get();
      gamesCache = snapshot.docs
        .map(normalizeGame)
        .filter((g) => g.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

      renderAdminGameSelect();
      renderPublicGameSelect(oldPublicId);

      if (!gamesCache.length) {
        renderPublicGame(null);
        return;
      }

      const id = gamesCache.some((g) => g.id === oldPublicId) ? oldPublicId : gamesCache[0].id;
      $('public-game-select').value = id;

      // Always fetch the selected game again so recently edited Firebase data is shown.
      const fresh = await getGameFresh(id);
      if (fresh) {
        gamesCache = gamesCache.map((g) => g.id === id ? fresh : g);
        renderPublicGame(fresh);
      } else {
        renderPublicGame(gamesCache.find((g) => g.id === id));
      }
    } catch (error) {
      console.error('Lỗi tải games:', error);
      if ($('public-game-select')) $('public-game-select').innerHTML = '<option value="">Không tải được danh sách game</option>';
      setMsg('game-msg', 'Không tải được danh sách game: ' + error.message);
    }
  }

  $('public-game-select').addEventListener('change', async (e) => {
    try {
      const fresh = await getGameFresh(e.target.value);
      if (!fresh) return renderPublicGame(null);
      gamesCache = gamesCache.map((g) => g.id === fresh.id ? fresh : g);
      renderPublicGame(fresh);
    } catch (error) {
      console.error(error);
      setMsg('game-msg', 'Không tải được dữ liệu game: ' + error.message);
    }
  });

  // ---------- Login ----------
  $('admin-login-btn').addEventListener('click', () => {
    if (auth.currentUser) openAdminDashboard();
    else loginModal.style.display = 'block';
  });

  $('close-login-modal').addEventListener('click', () => loginModal.style.display = 'none');
  $('close-admin-modal').addEventListener('click', () => adminModal.style.display = 'none');
  window.addEventListener('click', (e) => {
    if (e.target === loginModal) loginModal.style.display = 'none';
    if (e.target === adminModal) adminModal.style.display = 'none';
  });

  $('login-submit-btn').addEventListener('click', async () => {
    const email = $('username').value.trim();
    const password = $('password').value;
    if (!email || !password) return setMsg('login-error', 'Vui lòng nhập email và mật khẩu.');

    try {
      await auth.signInWithEmailAndPassword(email, password);
      $('password').value = '';
      $('login-error').textContent = '';
      loginModal.style.display = 'none';
      await openAdminDashboard();
    } catch (error) {
      console.error(error);
      setMsg('login-error', 'Email hoặc mật khẩu không đúng.');
    }
  });

  // ---------- Admin game editor ----------
  function renderAdminGameSelect() {
    const select = $('admin-game-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Thêm trò chơi mới --</option>';
    gamesCache.forEach((game) => {
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.name;
      select.appendChild(option);
    });
    if (selectedGameId && gamesCache.some((g) => g.id === selectedGameId)) select.value = selectedGameId;
  }

  function clearGameForm() {
    selectedGameId = '';
    if ($('admin-game-select')) $('admin-game-select').value = '';
    [
      'edit-game-name', 'edit-game-desc', 'edit-game-playstore',
      'edit-game-image1', 'edit-game-image2', 'edit-game-image3',
      'edit-game-video1', 'edit-game-video2', 'edit-game-video3'
    ].forEach((id) => { if ($(id)) $(id).value = ''; });
    [1, 2, 3].forEach((n) => {
      clearPreview(`image-preview-${n}`);
      clearPreview(`video-preview-${n}`);
    });
    setMsg('game-msg', 'Đang tạo game mới.', true);
  }

  async function fillGameForm(gameOrId) {
    let game = gameOrId;
    if (typeof gameOrId === 'string') game = await getGameFresh(gameOrId);
    if (!game) {
      clearGameForm();
      return;
    }

    selectedGameId = game.id;
    $('admin-game-select').value = game.id;

    const values = gameToFormValues(game);
    $('edit-game-name').value = values.name;
    $('edit-game-desc').value = values.description;
    $('edit-game-playstore').value = values.playStoreUrl;
    $('edit-game-image1').value = values.image1;
    $('edit-game-image2').value = values.image2;
    $('edit-game-image3').value = values.image3;
    $('edit-game-video1').value = values.video1;
    $('edit-game-video2').value = values.video2;
    $('edit-game-video3').value = values.video3;

    [1, 2, 3].forEach((n) => {
      previewImage(`edit-game-image${n}`, `image-preview-${n}`);
      previewVideo(`edit-game-video${n}`, `video-preview-${n}`);
    });

    $('game-msg').textContent = `Đã tải đầy đủ dữ liệu của "${game.name}" từ Firebase.`;
    $('game-msg').style.color = '#10b981';
  }

  $('admin-game-select').addEventListener('change', async (e) => {
    if (!e.target.value) return clearGameForm();
    await fillGameForm(e.target.value);
  });

  $('new-game-btn').addEventListener('click', clearGameForm);

  $('reload-games-btn').addEventListener('click', async () => {
    const keepId = selectedGameId;
    await loadGamesPublic(true);
    if (keepId) {
      const fresh = await getGameFresh(keepId);
      if (fresh) await fillGameForm(fresh);
    }
    setMsg('game-msg', 'Đã tải lại toàn bộ game từ Firebase.', true);
  });

  $('save-game-btn').addEventListener('click', async () => {
    if (!auth.currentUser) return setMsg('game-msg', 'Bạn cần đăng nhập Admin.');
    const name = clean($('edit-game-name').value);
    if (!name) return setMsg('game-msg', 'Vui lòng nhập tên game.');

    const images = [1, 2, 3].map((n) => clean($(`edit-game-image${n}`).value)).filter(Boolean);
    const videos = [1, 2, 3].map((n) => clean($(`edit-game-video${n}`).value)).filter(Boolean);

    const data = {
      name,
      description: $('edit-game-desc').value,
      playStoreUrl: clean($('edit-game-playstore').value),
      images,
      videos,
      // Keep individual fields too, so old/new versions of the website remain compatible.
      image1: images[0] || '', image2: images[1] || '', image3: images[2] || '',
      video1: videos[0] || '', video2: videos[1] || '', video3: videos[2] || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      let ref;
      if (selectedGameId) {
        ref = gamesCollection.doc(selectedGameId);
        await ref.set(data, { merge: true });
      } else {
        ref = gamesCollection.doc();
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await ref.set(data);
        selectedGameId = ref.id;
      }

      const fresh = await getGameFresh(selectedGameId);
      if (fresh) {
        gamesCache = gamesCache.some((g) => g.id === fresh.id)
          ? gamesCache.map((g) => g.id === fresh.id ? fresh : g)
          : [...gamesCache, fresh];
        gamesCache.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        renderAdminGameSelect();
        renderPublicGameSelect($('public-game-select').value);
        await fillGameForm(fresh);
        renderPublicGame(fresh);
      }
      setMsg('game-msg', 'Đã lưu game và toàn bộ Link/Ảnh/Video lên Firebase.', true);
    } catch (error) {
      console.error(error);
      setMsg('game-msg', 'Lỗi khi lưu game: ' + error.message);
    }
  });

  $('delete-game-btn').addEventListener('click', async () => {
    if (!auth.currentUser) return setMsg('game-msg', 'Bạn cần đăng nhập Admin.');
    if (!selectedGameId) return setMsg('game-msg', 'Hãy chọn game cần xóa.');
    const game = gamesCache.find((g) => g.id === selectedGameId);
    if (!confirm(`Bạn chắc chắn muốn xóa game "${game?.name || ''}" khỏi Firebase?`)) return;

    try {
      await gamesCollection.doc(selectedGameId).delete();
      selectedGameId = '';
      await loadGamesPublic(false);
      clearGameForm();
      setMsg('game-msg', 'Đã xóa game khỏi Firebase.', true);
    } catch (error) {
      console.error(error);
      setMsg('game-msg', 'Lỗi khi xóa game: ' + error.message);
    }
  });

  // ---------- Appearance controls ----------
  function previewAppearanceForm() {
    const a = getAppearanceFromForm();
    if ($('banner-brightness-value')) $('banner-brightness-value').textContent = a.bannerBrightness;
    if ($('overlay-opacity-value')) $('overlay-opacity-value').textContent = a.overlayOpacity;
    applyAppearance(a);
  }

  ['edit-banner-url', 'edit-banner-brightness', 'edit-overlay-opacity', 'edit-bg-color', 'edit-card-color',
   'edit-accent-color', 'edit-text-color', 'edit-secondary-text-color', 'edit-border-color'].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener('input', previewAppearanceForm);
  });

  $('appearance-dark-btn').addEventListener('click', () => {
    const values = { bg:'#0f172a', card:'#1e293b', accent:'#3b82f6', text:'#f8fafc', secondary:'#94a3b8', border:'#334155' };
    $('edit-bg-color').value=values.bg; $('edit-card-color').value=values.card; $('edit-accent-color').value=values.accent;
    $('edit-text-color').value=values.text; $('edit-secondary-text-color').value=values.secondary; $('edit-border-color').value=values.border;
    previewAppearanceForm();
  });

  $('appearance-light-btn').addEventListener('click', () => {
    const values = { bg:'#f1f5f9', card:'#ffffff', accent:'#2563eb', text:'#0f172a', secondary:'#475569', border:'#cbd5e1' };
    $('edit-bg-color').value=values.bg; $('edit-card-color').value=values.card; $('edit-accent-color').value=values.accent;
    $('edit-text-color').value=values.text; $('edit-secondary-text-color').value=values.secondary; $('edit-border-color').value=values.border;
    previewAppearanceForm();
  });

  $('reload-appearance-btn').addEventListener('click', async () => {
    try { await fillAppearanceAdmin(); setMsg('appearance-msg', 'Đã tải lại giao diện từ Firebase.', true); }
    catch (error) { setMsg('appearance-msg', 'Không thể tải giao diện: ' + error.message); }
  });

  $('save-appearance-btn').addEventListener('click', async () => {
    if (!auth.currentUser) return setMsg('appearance-msg', 'Bạn cần đăng nhập Admin.');
    const appearance = getAppearanceFromForm();
    try {
      await contentDoc.set({ appearance }, { merge: true });
      // Cập nhật giao diện hiện tại sau khi lưu.
      firebaseAppearance = appearance;
      applyAppearance(appearance);
      setMsg('appearance-msg', 'Đã lưu giao diện lên Firebase. Các thiết bị khác sẽ lấy thiết lập này khi tải website.', true);
    } catch (error) {
      console.error(error);
      setMsg('appearance-msg', 'Lỗi khi lưu giao diện: ' + error.message);
    }
  });

  // ---------- Common content ----------
  $('reload-content-btn').addEventListener('click', async () => {
    try {
      await fillCommonAdmin();
      await loadSiteContent();
      setMsg('save-msg', 'Đã tải lại nội dung chung từ Firebase.', true);
    } catch (error) {
      console.error(error);
      setMsg('save-msg', 'Không thể tải nội dung: ' + error.message);
    }
  });

  $('save-content-btn').addEventListener('click', async () => {
    if (!auth.currentUser) return setMsg('save-msg', 'Bạn cần đăng nhập Admin.');
    const data = {};
    contentKeys.forEach((key) => {
      const el = $(`edit-${key}`);
      if (el) data[key] = el.value;
    });

    try {
      await contentDoc.set(data, { merge: true });
      await loadSiteContent();
      setMsg('save-msg', 'Đã lưu nội dung chung lên Firebase.', true);
    } catch (error) {
      console.error(error);
      setMsg('save-msg', 'Lỗi khi lưu Firebase: ' + error.message);
    }
  });

  // ---------- Admin dashboard ----------
  async function openAdminDashboard() {
    if (!auth.currentUser) {
      loginModal.style.display = 'block';
      return;
    }
    adminModal.style.display = 'block';
    try {
      await Promise.all([fillCommonAdmin(), fillAppearanceAdmin(), loadGamesPublic(true)]);
      if (selectedGameId) await fillGameForm(selectedGameId);
    } catch (error) {
      console.error(error);
      setMsg('game-msg', 'Không thể tải dữ liệu Admin: ' + error.message);
    }
  }

  $('logout-btn').addEventListener('click', async () => {
    try {
      await auth.signOut();
      adminModal.style.display = 'none';
      alert('Đã đăng xuất thành công!');
    } catch (error) {
      console.error(error);
    }
  });

  $('change-pwd-btn').addEventListener('click', async () => {
    const newPwd = $('new-password').value;
    const user = auth.currentUser;
    if (!user) return setMsg('pwd-msg', 'Bạn chưa đăng nhập Admin.');
    if (!newPwd || newPwd.length < 6) return setMsg('pwd-msg', 'Mật khẩu phải có ít nhất 6 ký tự!');

    try {
      await user.updatePassword(newPwd);
      $('new-password').value = '';
      setMsg('pwd-msg', 'Đổi mật khẩu thành công!', true);
    } catch (error) {
      console.error(error);
      setMsg('pwd-msg', error.code === 'auth/requires-recent-login'
        ? 'Hãy đăng xuất, đăng nhập lại rồi đổi mật khẩu.'
        : 'Không thể đổi mật khẩu: ' + error.message);
    }
  });

  bindAssetPreviews();
  auth.onAuthStateChanged((user) => console.log(user ? `Admin: ${user.email}` : 'Chưa đăng nhập Admin'));

  await loadSiteContent();
  await loadGamesPublic(false);

  // =========================================================
  // PLAYER DATA + FCM ADMIN TOOLS
  // =========================================================
  const playersCollection = db.collection('players');
  const fcmCampaignsCollection = db.collection('fcm_campaigns');
  const FCM_BACKEND_BASE = 'https://us-central1-royal-empire-match-3.cloudfunctions.net';
  const FCM_BACKEND_URL = `${FCM_BACKEND_BASE}/sendFcmNotification`;

  async function adminBackendPost(functionName, payload = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('Bạn cần đăng nhập Admin.');
    const idToken = await user.getIdToken(true);
    const response = await fetch(`${FCM_BACKEND_BASE}/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Backend HTTP ${response.status}`);
    return result;
  }
  let playersCache = [];
  let filteredPlayersCache = [];
  let playersLoaded = false;

  function playerNumber(data, keys) {
    for (const key of keys) {
      const n = Number(data?.[key]);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  function playerString(data, keys) {
    for (const key of keys) {
      const v = data?.[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return '';
  }

  function playerTimestamp(data, keys) {
    for (const key of keys) {
      const v = data?.[key];
      if (!v) continue;
      if (typeof v.toDate === 'function') return v.toDate();
      if (v instanceof Date) return v;
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }

  function normalizePlayer(doc) {
    const data = doc.data() || {};
    return {
      uid: doc.id,
      raw: data,
      level: playerNumber(data, ['current_level', 'unlock_level', 'level']),
      gold: playerNumber(data, ['gold', 'GoldIten']),
      time: playerNumber(data, ['time', 'TimeIten']),
      move: playerNumber(data, ['move', 'MoveIten']),
      bomb: playerNumber(data, ['bomb', 'BombIten']),
      ads: playerNumber(data, ['total_watch_ads', 'reward_ad_count', 'TotalWatchAds']),
      buy1000: playerNumber(data, ['total_buy_gold_1000', 'TotalBuygold1000']),
      buy5000: playerNumber(data, ['total_buy_gold_5000', 'TotalBuygold5000']),
      noAds: playerNumber(data, ['no_ads', 'NoAdsIten']),
      lastLogin: playerTimestamp(data, ['last_login', 'lastLogin']),
      lastLoginDate: playerString(data, ['last_login_date', 'LastLoginDate']),
      fcmToken: playerString(data, ['fcm_token', 'fcmToken'])
    };
  }

  function localDateKey(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function daysSince(date) {
    if (!date) return Infinity;
    const today = new Date();
    const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.max(0, Math.floor((a - b) / 86400000));
  }

  function formatPlayerDate(date, fallback = '') {
    if (date) return date.toLocaleString('vi-VN');
    return fallback || '—';
  }

  function hasPurchased(p) {
    return p.buy1000 > 0 || p.buy5000 > 0 || p.noAds > 0;
  }

  function renderPlayers() {
    const tbody = $('players-table')?.querySelector('tbody');
    if (!tbody) return;
    const search = clean($('player-search')?.value).toLowerCase();
    const minLevel = $('player-level-min')?.value === '' ? null : Number($('player-level-min')?.value);
    const maxLevel = $('player-level-max')?.value === '' ? null : Number($('player-level-max')?.value);
    const maxAds = $('player-ads-max')?.value === '' ? null : Number($('player-ads-max')?.value);
    const loginFilter = $('player-login-filter')?.value || 'all';
    const purchaseFilter = $('player-purchase-filter')?.value || 'all';

    filteredPlayersCache = playersCache.filter((p) => {
      if (search && !p.uid.toLowerCase().includes(search)) return false;
      if (minLevel !== null && p.level < minLevel) return false;
      if (maxLevel !== null && p.level > maxLevel) return false;
      if (maxAds !== null && p.ads > maxAds) return false;
      if (loginFilter === 'today' && localDateKey(p.lastLogin) !== localDateKey(new Date())) return false;
      if (/^\d+$/.test(loginFilter) && daysSince(p.lastLogin) < Number(loginFilter)) return false;
      if (purchaseFilter === 'never' && hasPurchased(p)) return false;
      if (purchaseFilter === 'gold' && p.buy1000 + p.buy5000 <= 0) return false;
      if (purchaseFilter === 'remove_ads' && p.noAds <= 0) return false;
      return true;
    });

    tbody.innerHTML = '';
    if (!filteredPlayersCache.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td'); td.colSpan = 12; td.className = 'empty-table'; td.textContent = 'Không có người chơi phù hợp.';
      tr.appendChild(td); tbody.appendChild(tr);
    } else {
      const frag = document.createDocumentFragment();
      filteredPlayersCache.forEach((p) => {
        const tr = document.createElement('tr');
        const values = [p.uid, p.level, p.gold, p.time, p.move, p.bomb, p.ads, p.buy1000, p.buy5000, p.noAds ? 'Có' : 'Không', formatPlayerDate(p.lastLogin, p.lastLoginDate), p.fcmToken ? 'Có' : 'Không'];
        values.forEach((value) => { const td = document.createElement('td'); td.textContent = value; tr.appendChild(td); });
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
    }

    const withToken = filteredPlayersCache.filter((p) => p.fcmToken).length;
    if ($('players-summary')) $('players-summary').textContent = `Hiển thị ${filteredPlayersCache.length.toLocaleString('vi-VN')} / ${playersCache.length.toLocaleString('vi-VN')} người chơi · Có FCM: ${withToken.toLocaleString('vi-VN')}`;
  }

  async function loadPlayers() {
    if (!auth.currentUser) return setMsg('players-status', 'Bạn cần đăng nhập Admin.');
    const status = $('players-status');
    if (status) status.textContent = 'Đang tải...';
    try {
      const result = await adminBackendPost('getAdminPlayers');
      playersCache = (result.players || []).map((obj) => ({
        uid: obj.uid, raw: obj, level: playerNumber(obj, ['current_level','unlock_level','level']),
        gold: playerNumber(obj, ['gold','GoldIten']), time: playerNumber(obj, ['time','TimeIten']),
        move: playerNumber(obj, ['move','MoveIten']), bomb: playerNumber(obj, ['bomb','BombIten']),
        ads: playerNumber(obj, ['total_watch_ads','reward_ad_count','TotalWatchAds']),
        buy1000: playerNumber(obj, ['total_buy_gold_1000','TotalBuygold1000']),
        buy5000: playerNumber(obj, ['total_buy_gold_5000','TotalBuygold5000']),
        noAds: playerNumber(obj, ['no_ads','NoAdsIten']), lastLogin: playerTimestamp(obj, ['last_login','lastLogin']),
        lastLoginDate: playerString(obj, ['last_login_date','LastLoginDate']), fcmToken: playerString(obj, ['fcm_token','fcmToken'])
      }));
      playersLoaded = true;
      if (status) status.textContent = `Đã tải ${playersCache.length.toLocaleString('vi-VN')} người chơi`;
      renderPlayers();
      updateFcmTargetSummary();
    } catch (error) {
      console.error(error);
      if (status) status.textContent = 'Lỗi tải dữ liệu';
      setMsg('players-status', 'Không thể tải players: ' + error.message);
    }
  }

  function exportPlayersExcel() {
    if (!playersLoaded) return setMsg('players-status', 'Hãy tải dữ liệu người chơi trước.');
    const rows = filteredPlayersCache.map((p) => ({
      'Player UID': p.uid, 'Level': p.level, 'Gold': p.gold, 'Time': p.time, 'Move': p.move, 'Bomb': p.bomb,
      'Total Watch Ads': p.ads, 'Total Buy Gold 1000': p.buy1000, 'Total Buy Gold 5000': p.buy5000,
      'Remove Ads': p.noAds ? 'Có' : 'Không', 'Last Login': formatPlayerDate(p.lastLogin, p.lastLoginDate), 'FCM Token': p.fcmToken || ''
    }));
    if (!rows.length) return setMsg('players-status', 'Không có dữ liệu để xuất.');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Players');
    XLSX.writeFile(wb, `players_${localDateKey(new Date())}.xlsx`);
  }

  function getFcmCriteria() {
    return {
      all: $('fcm-all')?.checked,
      inactiveToday: $('fcm-inactive-today')?.checked,
      inactive2Days: $('fcm-inactive-2days')?.checked,
      level50: $('fcm-level-50')?.checked,
      level100: $('fcm-level-100')?.checked,
      ads10: $('fcm-ads-10')?.checked,
      neverBuy: $('fcm-never-buy')?.checked
    };
  }

  function getFcmTargets() {
    if (!playersLoaded) return [];
    const c = getFcmCriteria();
    const specific = c.inactiveToday || c.inactive2Days || c.level50 || c.level100 || c.ads10 || c.neverBuy;
    if (c.all || !specific) return playersCache.slice();
    return playersCache.filter((p) => {
      if (c.inactiveToday && daysSince(p.lastLogin) < 1) return false;
      if (c.inactive2Days && daysSince(p.lastLogin) < 2) return false;
      if (c.level50 && p.level >= 50) return false;
      if (c.level100 && p.level >= 100) return false;
      if (c.ads10 && p.ads >= 10) return false;
      if (c.neverBuy && hasPurchased(p)) return false;
      return true;
    });
  }

  function fcmAudienceLabel() {
    const c = getFcmCriteria();
    if (c.all) return 'Tất cả người chơi';
    const labels = [];
    if (c.inactiveToday) labels.push('Chưa đăng nhập hôm nay');
    if (c.inactive2Days) labels.push('Đã 2 ngày chưa đăng nhập');
    if (c.level50) labels.push('Level < 50');
    if (c.level100) labels.push('Level < 100');
    if (c.ads10) labels.push('Ads < 10');
    if (c.neverBuy) labels.push('Chưa từng mua');
    return labels.join(' + ') || 'Tất cả người chơi';
  }

  function updateFcmTargetSummary() {
    const targets = getFcmTargets();
    const withToken = targets.filter((p) => p.fcmToken);
    if ($('fcm-player-count')) $('fcm-player-count').textContent = targets.length.toLocaleString('vi-VN');
    if ($('fcm-token-count')) $('fcm-token-count').textContent = withToken.length.toLocaleString('vi-VN');
    if ($('fcm-no-token-count')) $('fcm-no-token-count').textContent = (targets.length - withToken.length).toLocaleString('vi-VN');
    return targets;
  }

  function bindFcmCriteria() {
    const all = $('fcm-all');
    const others = ['fcm-inactive-today','fcm-inactive-2days','fcm-level-50','fcm-level-100','fcm-ads-10','fcm-never-buy'];
    if (all) all.addEventListener('change', () => { if (all.checked) others.forEach((id) => { if ($(id)) $(id).checked = false; }); updateFcmTargetSummary(); });
    others.forEach((id) => { const el = $(id); if (el) el.addEventListener('change', () => { if (el.checked && all) all.checked = false; if (!others.some((x) => $(x)?.checked) && all) all.checked = true; updateFcmTargetSummary(); }); });
  }

  function parseFcmData() {
    const text = clean($('fcm-data')?.value);
    if (!text) return {};
    try { const obj = JSON.parse(text); if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Data phải là JSON object.'); return obj; }
    catch (e) { throw new Error('Data JSON không hợp lệ: ' + e.message); }
  }

  async function callFcmBackend(tokens, testOnly = false) {
    const user = auth.currentUser;
    if (!user) throw new Error('Chưa đăng nhập Admin.');
    if (!tokens.length) throw new Error('Nhóm người chơi này chưa có FCM Token.');
    const title = clean($('fcm-title')?.value);
    const body = clean($('fcm-body')?.value);
    if (!title || !body) throw new Error('Vui lòng nhập tiêu đề và nội dung.');
    const idToken = await user.getIdToken(true);
    const response = await fetch(FCM_BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ title, body, data: parseFcmData(), tokens: testOnly ? tokens.slice(0, 1) : tokens, testOnly, audience: fcmAudienceLabel() })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Backend HTTP ${response.status}`);
    return result;
  }

  async function sendFcm(testOnly) {
    try {
      const targets = updateFcmTargetSummary();
      const tokens = targets.filter((p) => p.fcmToken).map((p) => p.fcmToken);
      if (!tokens.length) return setMsg('fcm-msg', 'Không có FCM Token trong nhóm này.');
      const title = clean($('fcm-title')?.value);
      if (!title) return setMsg('fcm-msg', 'Vui lòng nhập tiêu đề.');
      if (!testOnly && !confirm(`Gửi thông báo đến ${tokens.length.toLocaleString('vi-VN')} thiết bị?\n\nĐối tượng: ${fcmAudienceLabel()}`)) return;
      setMsg('fcm-msg', testOnly ? 'Đang gửi thử...' : 'Đang gửi...');
      const result = await callFcmBackend(tokens, testOnly);
      const prefix = testOnly ? 'Gửi thử thành công.' : 'Gửi FCM thành công.';
      setMsg('fcm-msg', `${prefix} Thành công: ${result.successCount || 0}, thất bại: ${result.failureCount || 0}.`, true);
      if (!testOnly) await loadFcmHistory();
    } catch (error) {
      console.error(error);
      setMsg('fcm-msg', error.message || 'Không thể gửi FCM.');
    }
  }

  async function loadFcmHistory() {
    const tbody = $('fcm-history-table')?.querySelector('tbody');
    if (!tbody) return;
    try {
      const result = await adminBackendPost('getFcmHistory');
      const campaigns = result.campaigns || [];
      tbody.innerHTML = '';
      if (!campaigns.length) { const tr=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=6; td.className='empty-table'; td.textContent='Chưa có chiến dịch.'; tr.appendChild(td); tbody.appendChild(tr); return; }
      campaigns.forEach((d) => {
        const tr = document.createElement('tr');
        [formatPlayerDate(playerTimestamp(d, ['createdAt'])), d.title || '', d.audience || '', d.tokenCount || 0, d.successCount || 0, d.failureCount || 0].forEach((v) => { const td=document.createElement('td'); td.textContent=v; tr.appendChild(td); });
        tbody.appendChild(tr);
      });
      setMsg('fcm-history-msg', `Đã tải ${campaigns.length} chiến dịch gần nhất.`, true);
    } catch (error) { console.error(error); setMsg('fcm-history-msg', 'Không thể tải lịch sử: ' + error.message); }
  }

  $('load-players-btn')?.addEventListener('click', loadPlayers);
  $('export-players-btn')?.addEventListener('click', exportPlayersExcel);
  ['player-search','player-level-min','player-level-max','player-ads-max','player-login-filter','player-purchase-filter'].forEach((id) => $(id)?.addEventListener('input', renderPlayers));
  ['player-login-filter','player-purchase-filter'].forEach((id) => $(id)?.addEventListener('change', renderPlayers));
  $('clear-player-filters-btn')?.addEventListener('click', () => {
    ['player-search','player-level-min','player-level-max','player-ads-max'].forEach((id) => { if ($(id)) $(id).value=''; });
    if ($('player-login-filter')) $('player-login-filter').value='all';
    if ($('player-purchase-filter')) $('player-purchase-filter').value='all';
    renderPlayers();
  });
  $('refresh-fcm-targets-btn')?.addEventListener('click', async () => { if (!playersLoaded) await loadPlayers(); updateFcmTargetSummary(); });
  $('send-fcm-test-btn')?.addEventListener('click', () => sendFcm(true));
  $('send-fcm-btn')?.addEventListener('click', () => sendFcm(false));
  $('load-fcm-history-btn')?.addEventListener('click', loadFcmHistory);
  bindFcmCriteria();

});
