document.addEventListener('DOMContentLoaded', async () => {
    const menuItems = document.querySelectorAll('#menu-list li');
    const sections = document.querySelectorAll('.content-section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(section => section.classList.remove('active'));
            const target = document.getElementById(item.dataset.target);
            if (target) target.classList.add('active');
        });
    });

    if (typeof firebase === 'undefined' || typeof auth === 'undefined' || typeof db === 'undefined') {
        console.error('Firebase chưa được khởi tạo.');
        return;
    }

    // Nội dung chung: không còn game-desc vì game đã tách thành collection games.
    const contentKeys = ['company-desc', 'player-policy', 'programs', 'contact-support', 'footer-info'];
    const contentDoc = db.collection('siteContent').doc('site');
    const gamesCollection = db.collection('games');
    let games = [];
    let selectedAdminGameId = '';

    // ==================== NỘI DUNG CHUNG ====================
    async function loadSiteContent() {
        try {
            const snapshot = await contentDoc.get();
            if (snapshot.exists) {
                const data = snapshot.data();
                contentKeys.forEach(key => {
                    const el = document.getElementById(`content-${key}`);
                    if (el && data[key] != null) el.innerHTML = data[key];
                });
            } else {
                const initialData = {};
                contentKeys.forEach(key => {
                    const el = document.getElementById(`content-${key}`);
                    if (el) initialData[key] = el.innerHTML;
                });
                await contentDoc.set(initialData);
            }
        } catch (error) {
            console.error('Lỗi tải nội dung:', error);
        }
    }

    // ==================== GAME PUBLIC ====================
    async function loadGames() {
        try {
            const snapshot = await gamesCollection.get();
            games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            games.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
            renderGameSelector();
        } catch (error) {
            console.error('Lỗi tải danh sách game:', error);
            document.getElementById('game-empty').textContent = 'Không thể tải danh sách trò chơi.';
        }
    }

    function renderGameSelector() {
        const select = document.getElementById('game-selector');
        const empty = document.getElementById('game-empty');
        const detail = document.getElementById('game-detail');
        select.innerHTML = '';

        if (!games.length) {
            select.innerHTML = '<option value="">Chưa có game</option>';
            empty.style.display = 'block';
            detail.style.display = 'none';
            return;
        }

        empty.style.display = 'none';
        games.forEach((game, index) => {
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.name || `Game ${index + 1}`;
            select.appendChild(option);
        });

        select.value = games[0].id;
        renderGameDetail(games[0]);
    }

    document.getElementById('game-selector').addEventListener('change', e => {
        const game = games.find(g => g.id === e.target.value);
        if (game) renderGameDetail(game);
    });

    function renderGameDetail(game) {
        document.getElementById('game-detail').style.display = 'block';
        document.getElementById('game-title').textContent = game.name || 'Trò chơi';
        document.getElementById('game-description').innerHTML = game.description || '<p>Chưa có giới thiệu.</p>';

        const download = document.getElementById('game-download');
        if (game.playUrl) {
            download.href = game.playUrl;
            download.style.display = 'inline-block';
        } else {
            download.style.display = 'none';
        }

        const gallery = document.getElementById('game-gallery');
        gallery.innerHTML = '';
        (game.images || []).slice(0, 3).forEach((url, i) => {
            if (!url) return;
            const img = document.createElement('img');
            img.src = url;
            img.alt = `${game.name || 'Game'} - Screenshot ${i + 1}`;
            img.loading = 'lazy';
            gallery.appendChild(img);
        });

        const videos = document.getElementById('game-videos');
        videos.innerHTML = '';
        (game.videos || []).slice(0, 3).forEach(url => {
            if (!url) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.title = `${game.name || 'Game'} video`;
            iframe.loading = 'lazy';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            wrapper.appendChild(iframe);
            videos.appendChild(wrapper);
        });
    }

    // ==================== ADMIN MODAL ====================
    const loginModal = document.getElementById('login-modal');
    const adminModal = document.getElementById('admin-dashboard-modal');

    document.getElementById('admin-login-btn').addEventListener('click', () => {
        if (auth.currentUser) openAdminDashboard();
        else loginModal.style.display = 'block';
    });

    document.getElementById('close-login-modal').addEventListener('click', () => loginModal.style.display = 'none');
    document.getElementById('close-admin-modal').addEventListener('click', () => adminModal.style.display = 'none');
    window.addEventListener('click', e => {
        if (e.target === loginModal) loginModal.style.display = 'none';
        if (e.target === adminModal) adminModal.style.display = 'none';
    });

    document.getElementById('login-submit-btn').addEventListener('click', async () => {
        const email = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');
        if (!email || !password) {
            errorEl.textContent = 'Vui lòng nhập email và mật khẩu.';
            return;
        }
        try {
            await auth.signInWithEmailAndPassword(email, password);
            errorEl.textContent = '';
            document.getElementById('password').value = '';
            loginModal.style.display = 'none';
            openAdminDashboard();
        } catch (error) {
            console.error(error);
            errorEl.textContent = 'Email hoặc mật khẩu không đúng.';
        }
    });

    async function openAdminDashboard() {
        if (!auth.currentUser) {
            loginModal.style.display = 'block';
            return;
        }
        adminModal.style.display = 'block';
        await loadAdminContent();
        await loadAdminGames();
        clearGameForm();
    }

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await auth.signOut();
        adminModal.style.display = 'none';
        alert('Đã đăng xuất thành công!');
    });

    // ==================== ĐỔI MẬT KHẨU ====================
    document.getElementById('change-pwd-btn').addEventListener('click', async () => {
        const input = document.getElementById('new-password');
        const msg = document.getElementById('pwd-msg');
        const newPwd = input.value;
        if (!newPwd || newPwd.trim().length < 6) {
            msg.style.color = '#ef4444';
            msg.textContent = 'Mật khẩu phải có ít nhất 6 ký tự!';
            return;
        }
        if (!auth.currentUser) {
            msg.style.color = '#ef4444';
            msg.textContent = 'Bạn chưa đăng nhập Admin.';
            return;
        }
        try {
            await auth.currentUser.updatePassword(newPwd);
            input.value = '';
            msg.style.color = '#10b981';
            msg.textContent = 'Đổi mật khẩu thành công!';
            setTimeout(() => msg.textContent = '', 3000);
        } catch (error) {
            msg.style.color = '#ef4444';
            msg.textContent = error.code === 'auth/requires-recent-login'
                ? 'Hãy đăng xuất, đăng nhập lại rồi đổi mật khẩu.'
                : 'Không thể đổi mật khẩu.';
        }
    });

    // ==================== ADMIN GAME FORM ====================
    async function loadAdminGames() {
        const select = document.getElementById('admin-game-selector');
        select.innerHTML = '<option value="">-- Thêm trò chơi mới --</option>';
        games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.name || game.id;
            select.appendChild(option);
        });
        select.value = selectedAdminGameId || '';
    }

    function clearGameForm() {
        selectedAdminGameId = '';
        document.getElementById('admin-game-selector').value = '';
        document.getElementById('game-name').value = '';
        document.getElementById('game-desc').value = '';
        document.getElementById('game-play-url').value = '';
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`game-image-${i}`).value = '';
            document.getElementById(`game-video-${i}`).value = '';
        }
        document.getElementById('delete-game-btn').style.display = 'none';
        document.getElementById('game-msg').textContent = '';
    }

    function fillGameForm(game) {
        selectedAdminGameId = game.id;
        document.getElementById('game-name').value = game.name || '';
        document.getElementById('game-desc').value = game.description || '';
        document.getElementById('game-play-url').value = game.playUrl || '';
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`game-image-${i}`).value = (game.images || [])[i - 1] || '';
            document.getElementById(`game-video-${i}`).value = (game.videos || [])[i - 1] || '';
        }
        document.getElementById('delete-game-btn').style.display = 'inline-block';
    }

    document.getElementById('admin-game-selector').addEventListener('change', e => {
        const game = games.find(g => g.id === e.target.value);
        if (game) fillGameForm(game);
        else clearGameForm();
    });

    document.getElementById('new-game-btn').addEventListener('click', clearGameForm);

    document.getElementById('save-game-btn').addEventListener('click', async () => {
        const msg = document.getElementById('game-msg');
        if (!auth.currentUser) {
            msg.style.color = '#ef4444';
            msg.textContent = 'Bạn cần đăng nhập Admin.';
            return;
        }

        const name = document.getElementById('game-name').value.trim();
        if (!name) {
            msg.style.color = '#ef4444';
            msg.textContent = 'Vui lòng nhập tên trò chơi.';
            return;
        }

        const gameData = {
            name,
            description: document.getElementById('game-desc').value,
            playUrl: document.getElementById('game-play-url').value.trim(),
            images: [1, 2, 3].map(i => document.getElementById(`game-image-${i}`).value.trim()),
            videos: [1, 2, 3].map(i => document.getElementById(`game-video-${i}`).value.trim()),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (selectedAdminGameId) {
                await gamesCollection.doc(selectedAdminGameId).set(gameData, { merge: true });
                msg.textContent = 'Đã cập nhật trò chơi lên Firebase.';
            } else {
                gameData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                const ref = await gamesCollection.add(gameData);
                selectedAdminGameId = ref.id;
                msg.textContent = 'Đã thêm trò chơi mới lên Firebase.';
            }
            msg.style.color = '#10b981';
            await loadGames();
            await loadAdminGames();
            document.getElementById('admin-game-selector').value = selectedAdminGameId;
            const game = games.find(g => g.id === selectedAdminGameId);
            if (game) fillGameForm(game);
            setTimeout(() => msg.textContent = '', 4000);
        } catch (error) {
            console.error('Save game error:', error);
            msg.style.color = '#ef4444';
            msg.textContent = 'Lỗi lưu game: ' + error.message;
        }
    });

    document.getElementById('delete-game-btn').addEventListener('click', async () => {
        if (!selectedAdminGameId || !auth.currentUser) return;
        const game = games.find(g => g.id === selectedAdminGameId);
        if (!confirm(`Bạn có chắc muốn xóa game "${game?.name || ''}" không?`)) return;
        const msg = document.getElementById('game-msg');
        try {
            await gamesCollection.doc(selectedAdminGameId).delete();
            msg.style.color = '#10b981';
            msg.textContent = 'Đã xóa trò chơi.';
            await loadGames();
            await loadAdminGames();
            clearGameForm();
        } catch (error) {
            msg.style.color = '#ef4444';
            msg.textContent = 'Lỗi xóa game: ' + error.message;
        }
    });

    // ==================== NỘI DUNG CHUNG ADMIN ====================
    async function loadAdminContent() {
        const snapshot = await contentDoc.get();
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        contentKeys.forEach(key => {
            const textarea = document.getElementById(`edit-${key}`);
            if (textarea) textarea.value = data[key] || '';
        });
    }

    document.getElementById('save-content-btn').addEventListener('click', async () => {
        const msg = document.getElementById('save-msg');
        if (!auth.currentUser) {
            msg.style.color = '#ef4444';
            msg.textContent = 'Bạn cần đăng nhập Admin trước!';
            return;
        }
        try {
            const data = {};
            contentKeys.forEach(key => {
                const textarea = document.getElementById(`edit-${key}`);
                if (textarea) data[key] = textarea.value;
            });
            await contentDoc.set(data, { merge: true });
            contentKeys.forEach(key => {
                const textarea = document.getElementById(`edit-${key}`);
                const dom = document.getElementById(`content-${key}`);
                if (textarea && dom) dom.innerHTML = textarea.value;
            });
            msg.style.color = '#10b981';
            msg.textContent = 'Đã lưu nội dung chung lên Firebase!';
            setTimeout(() => msg.textContent = '', 4000);
        } catch (error) {
            msg.style.color = '#ef4444';
            msg.textContent = 'Lỗi lưu Firebase: ' + error.message;
        }
    });

    await loadSiteContent();
    await loadGames();
});
