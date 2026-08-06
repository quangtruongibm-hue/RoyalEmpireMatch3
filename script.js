document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Tab Switching Logic ---
    const menuItems = document.querySelectorAll('#menu-list li');
    const sections = document.querySelectorAll('.content-section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(section => section.classList.remove('active'));
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // --- 2. Admin System Initialization ---
    // Initialize default password if not exists
    if (!localStorage.getItem('adminPassword')) {
        localStorage.setItem('adminPassword', 'admin');
    }

    // Default content IDs
    const contentKeys = [
        'company-desc', 
        'game-desc', 
        'player-policy', 
        'programs', 
        'contact-support',
        'footer-info'
    ];

    // Load content from localStorage or save default to localStorage
    contentKeys.forEach(key => {
        const domElement = document.getElementById(`content-${key}`);
        if (!domElement) return;

        const storedContent = localStorage.getItem(`siteContent_${key}`);
        if (storedContent) {
            // Apply stored content to DOM
            domElement.innerHTML = storedContent;
        } else {
            // Save initial DOM content to localStorage
            localStorage.setItem(`siteContent_${key}`, domElement.innerHTML);
        }
    });


    // --- 3. Modal Logic ---
    const loginModal = document.getElementById('login-modal');
    const adminDashboardModal = document.getElementById('admin-dashboard-modal');
    const loginBtn = document.getElementById('admin-login-btn');
    const closeLoginBtn = document.getElementById('close-login-modal');
    const closeAdminBtn = document.getElementById('close-admin-modal');

    // Open login modal
    loginBtn.addEventListener('click', () => {
        // If already logged in this session (simulate with sessionStorage)
        if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
            openAdminDashboard();
        } else {
            loginModal.style.display = 'block';
        }
    });

    // Close modals
    closeLoginBtn.addEventListener('click', () => { loginModal.style.display = 'none'; });
    closeAdminBtn.addEventListener('click', () => { adminDashboardModal.style.display = 'none'; });

    // Close when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) loginModal.style.display = 'none';
        if (e.target === adminDashboardModal) adminDashboardModal.style.display = 'none';
    });


    // --- 4. Login Logic ---
    const submitLoginBtn = document.getElementById('login-submit-btn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    submitLoginBtn.addEventListener('click', () => {
        const user = usernameInput.value;
        const pwd = passwordInput.value;
        const correctPwd = localStorage.getItem('adminPassword');

        if (user === 'admin' && pwd === correctPwd) {
            // Success
            sessionStorage.setItem('isAdminLoggedIn', 'true');
            loginModal.style.display = 'none';
            usernameInput.value = 'admin';
            passwordInput.value = '';
            loginError.textContent = '';
            openAdminDashboard();
        } else {
            loginError.textContent = 'Sai tên đăng nhập hoặc mật khẩu!';
        }
    });

    // --- 5. Admin Dashboard Logic ---
    function openAdminDashboard() {
        adminDashboardModal.style.display = 'block';
        
        // Populate textareas with current content from localStorage
        contentKeys.forEach(key => {
            const textarea = document.getElementById(`edit-${key}`);
            if (textarea) {
                // Trim to remove extra whitespaces from HTML string
                textarea.value = (localStorage.getItem(`siteContent_${key}`) || '').trim();
            }
        });
    }

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.removeItem('isAdminLoggedIn');
        adminDashboardModal.style.display = 'none';
        alert('Đã đăng xuất thành công!');
    });

    // Change Password
    document.getElementById('change-pwd-btn').addEventListener('click', () => {
        const newPwd = document.getElementById('new-password').value;
        const msg = document.getElementById('pwd-msg');
        
        if (newPwd.trim().length === 0) {
            msg.style.color = '#ef4444';
            msg.textContent = 'Mật khẩu không được để trống!';
            return;
        }

        localStorage.setItem('adminPassword', newPwd);
        document.getElementById('new-password').value = '';
        msg.style.color = '#10b981';
        msg.textContent = 'Cập nhật mật khẩu thành công!';
        setTimeout(() => msg.textContent = '', 3000);
    });

    // Save Content
    document.getElementById('save-content-btn').addEventListener('click', () => {
        const msg = document.getElementById('save-msg');
        
        contentKeys.forEach(key => {
            const textarea = document.getElementById(`edit-${key}`);
            if (textarea) {
                const newContent = textarea.value;
                // Save to localStorage
                localStorage.setItem(`siteContent_${key}`, newContent);
                
                // Update DOM immediately
                const domElement = document.getElementById(`content-${key}`);
                if (domElement) {
                    domElement.innerHTML = newContent;
                }
            }
        });

        msg.style.color = '#10b981';
        msg.textContent = 'Lưu nội dung thành công! Giao diện đã được cập nhật.';
        setTimeout(() => msg.textContent = '', 3000);
    });
});
