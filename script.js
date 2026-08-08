document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const contentKeys = ['company-desc', 'player-policy', 'programs', 'contact-support', 'footer-info'];
  const contentDoc = db.collection('siteContent').doc('site');
  const gamesCollection = db.collection('games');

  let gamesCache = [];
  let selectedGameId = '';

  const loginModal = $('login-modal');
  const adminModal = $('admin-dashboard-modal');

  function setMsg(id, text, ok = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.style.color = ok ? '#10b981' : '#ef4444';
  }

  function isExternalUrl(value) {
    return /^(https?:|data:|blob:|\/)/i.test((value || '').trim());
  }

  // Allows: royal.jpg, images/royal.jpg, /images/royal.jpg, or any full URL.
  function normalizeAsset(value, folder) {
    let v = (value || '').trim();
    if (!v) return '';

    // GitHub "blob" URLs are converted to the raw file URL.
    v = githubBlobToRaw(v);

    if (isExternalUrl(v)) return v;
    if (v.startsWith(`${folder}/`)) return v;
    if (v.startsWith(`./${folder}/`)) return v.slice(2);
    return `${folder}/${v.replace(/^\/+/, '')}`;
  }

  function githubBlobToRaw(value) {
    try {
      const u = new URL(value);
      if (u.hostname === 'github.com' && u.pathname.includes('/blob/')) {
        const parts = u.pathname.split('/').filter(Boolean);
        const blobIndex = parts.indexOf('blob');
        if (parts.length > blobIndex + 2) {
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

  function clearPreview(containerId) {
    const box = $(containerId);
    if (box) box.innerHTML = '';
  }

  function previewImage(inputId, previewId) {
    const input = $(inputId);
    const preview = $(previewId);
    if (!input || !preview) return;
    const url = normalizeAsset(input.value, 'images');
    preview.innerHTML = '';
    if (!url) return;

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Xem trước ảnh';
    img.loading = 'lazy';
    img.onerror = () => {
      preview.innerHTML = '<span class="preview-error">Không tải được ảnh. Kiểm tra URL hoặc tên file.</span>';
    };
    preview.appendChild(img);
  }

  function previewVideo(inputId, previewId) {
    const input = $(inputId);
    const preview = $(previewId);
    if (!input || !preview) return;
    const url = normalizeAsset(input.value, 'videos');
    preview.innerHTML = '';
    if (!url) return;

    const embed = youtubeEmbed(url);
    if (embed) {
      const iframe = document.createElement('iframe');
      iframe.src = embed;
      iframe.title = 'Xem trước video';
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
      preview.innerHTML = '<span class="preview-error">Không phát được video. Hãy kiểm tra URL hoặc định dạng MP4/WebM.</span>';
    };
    preview.appendChild(video);
  }

  function bindAssetPreviews() {
    [1, 2, 3].forEach((n) => {
      const imageInput = $(`edit-game-image${n}`);
      const videoInput = $(`edit-game-video${n}`);
      if (imageInput) {
        imageInput.addEventListener('input', () => previewImage(`edit-game-image${n}`, `image-preview-${n}`));
      }
      if (videoInput) {
        videoInput.addEventListener('input', () => previewVideo(`edit-game-video${n}`, `video-preview-${n}`));
      }
    });
  }

  // ---------- Tabs ----------
  const menuItems = document.querySelectorAll('#menu-list li');
  const sections = document.querySelectorAll('.content-section');
  menuItems.forEach((item) => {
    item.addEventListener('click', () => {
      menuItems.forEach((i) => i.classList.remove('active'));
      item.classList.add('active');
      sections.forEach((s) => s.classList.remove('active'));
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
    } catch (error) {
      console.error('Lỗi tải nội dung website:', error);
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

  // ---------- Public games ----------
  function renderPublicGameSelect() {
    const select = $('public-game-select');
    select.innerHTML = '';
    if (!gamesCache.length) {
      select.innerHTML = '<option value="">-- Chưa có game --</option>';
      return;
    }
    gamesCache.forEach((game) => {
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.name;
      select.appendChild(option);
    });
  }

  function renderPublicGame(gameId) {
    const game = gamesCache.find((g) => g.id === gameId);
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
    [game.image1, game.image2, game.image3].forEach((src, index) => {
      const url = normalizeAsset(src, 'images');
      if (!url) return;
      const img = document.createElement('img');
      img.src = url;
      img.alt = `${game.name} - Ảnh ${index + 1}`;
      img.loading = 'lazy';
      img.onerror = () => img.remove();
      gallery.appendChild(img);
    });

    const videos = $('public-game-videos');
    videos.innerHTML = '';
    [game.video1, game.video2, game.video3].forEach((src, index) => {
      const url = normalizeAsset(src, 'videos');
      if (!url) return;
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
      videos.appendChild(wrap);
    });
  }

  async function loadGamesPublic(keepSelected = true) {
    try {
      const snapshot = await gamesCollection.get();
      gamesCache = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((g) => g.name)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));

      renderPublicGameSelect();
      renderAdminGameSelect();

      if (!gamesCache.length) {
        $('game-public-empty').hidden = false;
        $('game-public-content').hidden = true;
        return;
      }

      let current = keepSelected ? $('public-game-select').value : '';
      if (!gamesCache.some((g) => g.id === current)) current = gamesCache[0].id;
      $('public-game-select').value = current;
      renderPublicGame(current);
    } catch (error) {
      console.error('Lỗi tải games:', error);
      $('public-game-select').innerHTML = '<option value="">Không tải được danh sách game</option>';
      setMsg('game-msg', 'Không tải được danh sách game: ' + error.message);
    }
  }

  $('public-game-select').addEventListener('change', (e) => renderPublicGame(e.target.value));

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
    select.innerHTML = '<option value="">-- Thêm trò chơi mới --</option>';
    gamesCache.forEach((game) => {
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.name;
      select.appendChild(option);
    });
    if (selectedGameId && gamesCache.some((g) => g.id === selectedGameId)) {
      select.value = selectedGameId;
    }
  }

  function clearGameForm() {
    selectedGameId = '';
    $('admin-game-select').value = '';
    [
      'edit-game-name', 'edit-game-desc', 'edit-game-playstore',
      'edit-game-image1', 'edit-game-image2', 'edit-game-image3',
      'edit-game-video1', 'edit-game-video2', 'edit-game-video3'
    ].forEach((id) => { if ($(id)) $(id).value = ''; });
    [1, 2, 3].forEach((n) => { clearPreview(`image-preview-${n}`); clearPreview(`video-preview-${n}`); });
    setMsg('game-msg', 'Đang tạo game mới.', true);
  }

  function fillGameForm(game) {
    selectedGameId = game.id;
    $('admin-game-select').value = game.id;
    $('edit-game-name').value = game.name || '';
    $('edit-game-desc').value = game.description || '';
    $('edit-game-playstore').value = game.playStoreUrl || '';
    $('edit-game-image1').value = game.image1 || '';
    $('edit-game-image2').value = game.image2 || '';
    $('edit-game-image3').value = game.image3 || '';
    $('edit-game-video1').value = game.video1 || '';
    $('edit-game-video2').value = game.video2 || '';
    $('edit-game-video3').value = game.video3 || '';

    [1, 2, 3].forEach((n) => {
      previewImage(`edit-game-image${n}`, `image-preview-${n}`);
      previewVideo(`edit-game-video${n}`, `video-preview-${n}`);
    });
    $('game-msg').textContent = '';
  }

  $('admin-game-select').addEventListener('change', (e) => {
    const game = gamesCache.find((g) => g.id === e.target.value);
    if (game) fillGameForm(game);
    else clearGameForm();
  });

  $('new-game-btn').addEventListener('click', clearGameForm);

  $('reload-games-btn').addEventListener('click', async () => {
    await loadGamesPublic(true);
    if (selectedGameId) {
      const game = gamesCache.find((g) => g.id === selectedGameId);
      if (game) fillGameForm(game);
    }
    setMsg('game-msg', 'Đã tải lại danh sách game từ Firebase.', true);
  });

  $('save-game-btn').addEventListener('click', async () => {
    if (!auth.currentUser) return setMsg('game-msg', 'Bạn cần đăng nhập Admin.');
    const name = $('edit-game-name').value.trim();
    if (!name) return setMsg('game-msg', 'Vui lòng nhập tên game.');

    const data = {
      name,
      description: $('edit-game-desc').value,
      playStoreUrl: $('edit-game-playstore').value.trim(),
      image1: normalizeAsset($('edit-game-image1').value, 'images'),
      image2: normalizeAsset($('edit-game-image2').value, 'images'),
      image3: normalizeAsset($('edit-game-image3').value, 'images'),
      video1: normalizeAsset($('edit-game-video1').value, 'videos'),
      video2: normalizeAsset($('edit-game-video2').value, 'videos'),
      video3: normalizeAsset($('edit-game-video3').value, 'videos'),
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

      await loadGamesPublic(true);
      $('admin-game-select').value = selectedGameId;
      const game = gamesCache.find((g) => g.id === selectedGameId);
      if (game) fillGameForm(game);
      setMsg('game-msg', 'Đã lưu game lên Firebase thành công.', true);
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
      clearGameForm();
      await loadGamesPublic(false);
      setMsg('game-msg', 'Đã xóa game khỏi Firebase.', true);
    } catch (error) {
      console.error(error);
      setMsg('game-msg', 'Lỗi khi xóa game: ' + error.message);
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
      await Promise.all([fillCommonAdmin(), loadGamesPublic(true)]);
      if (selectedGameId) {
        const game = gamesCache.find((g) => g.id === selectedGameId);
        if (game) fillGameForm(game);
      }
    } catch (error) {
      console.error(error);
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
      setMsg(
        'pwd-msg',
        error.code === 'auth/requires-recent-login'
          ? 'Hãy đăng xuất, đăng nhập lại rồi đổi mật khẩu.'
          : 'Không thể đổi mật khẩu: ' + error.message
      );
    }
  });

  bindAssetPreviews();
  auth.onAuthStateChanged((user) => console.log(user ? `Admin: ${user.email}` : 'Chưa đăng nhập Admin'));

  await loadSiteContent();
  await loadGamesPublic(false);
});
