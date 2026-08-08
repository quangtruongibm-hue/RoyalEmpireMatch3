document.addEventListener('DOMContentLoaded', async () => {

    // =========================================================
    // 1. TAB SWITCHING
    // =========================================================

    const menuItems = document.querySelectorAll('#menu-list li');
    const sections = document.querySelectorAll('.content-section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {

            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(section => section.classList.remove('active'));

            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });


    // =========================================================
    // 2. FIREBASE
    // =========================================================

    // firebaseConfig + auth + db đã được khai báo trong index.html
    // trước khi script.js được chạy.

    if (typeof firebase === 'undefined') {
        console.error('Firebase chưa được tải.');
        return;
    }

    if (typeof auth === 'undefined' || typeof db === 'undefined') {
        console.error('Firebase Auth hoặc Firestore chưa được khởi tạo.');
        return;
    }


    // =========================================================
    // 3. FIRESTORE CONTENT CONFIG
    // =========================================================

    const contentKeys = [
        'company-desc',
        'game-desc',
        'player-policy',
        'programs',
        'contact-support',
        'footer-info'
    ];

    // Firestore:
    //
    // siteContent
    //    └── site
    //         ├── company-desc
    //         ├── game-desc
    //         ├── player-policy
    //         ├── programs
    //         ├── contact-support
    //         └── footer-info
    //
    const contentDoc = db.collection('siteContent').doc('site');


    // =========================================================
    // 4. LOAD WEBSITE CONTENT FROM FIRESTORE
    // =========================================================

    async function loadSiteContent() {

        try {

            const snapshot = await contentDoc.get();

            if (snapshot.exists) {

                const data = snapshot.data();

                contentKeys.forEach(key => {

                    const domElement =
                        document.getElementById(`content-${key}`);

                    if (!domElement) return;

                    if (
                        data[key] !== undefined &&
                        data[key] !== null
                    ) {
                        domElement.innerHTML = data[key];
                    }

                });

                console.log('Nội dung website đã tải từ Firestore.');

            } else {

                console.log(
                    'Chưa có dữ liệu Firestore. Đang tạo dữ liệu ban đầu...'
                );

                const initialData = {};

                contentKeys.forEach(key => {

                    const domElement =
                        document.getElementById(`content-${key}`);

                    if (!domElement) return;

                    initialData[key] = domElement.innerHTML;

                });

                await contentDoc.set(initialData);

                console.log(
                    'Đã tạo dữ liệu website ban đầu trong Firestore.'
                );
            }

        } catch (error) {

            console.error(
                'Lỗi khi tải nội dung Firestore:',
                error
            );

        }
    }


    // Tải nội dung ngay khi website mở
    await loadSiteContent();


    // =========================================================
    // 5. MODAL
    // =========================================================

    const loginModal =
        document.getElementById('login-modal');

    const adminDashboardModal =
        document.getElementById('admin-dashboard-modal');

    const loginBtn =
        document.getElementById('admin-login-btn');

    const closeLoginBtn =
        document.getElementById('close-login-modal');

    const closeAdminBtn =
        document.getElementById('close-admin-modal');


    // =========================================================
    // 6. OPEN ADMIN LOGIN
    // =========================================================

    if (loginBtn) {

        loginBtn.addEventListener('click', () => {

            if (auth.currentUser) {

                openAdminDashboard();

            } else {

                loginModal.style.display = 'block';

            }

        });

    }


    // =========================================================
    // 7. CLOSE MODALS
    // =========================================================

    if (closeLoginBtn) {

        closeLoginBtn.addEventListener('click', () => {

            loginModal.style.display = 'none';

        });

    }


    if (closeAdminBtn) {

        closeAdminBtn.addEventListener('click', () => {

            adminDashboardModal.style.display = 'none';

        });

    }


    window.addEventListener('click', (e) => {

        if (e.target === loginModal) {

            loginModal.style.display = 'none';

        }

        if (e.target === adminDashboardModal) {

            adminDashboardModal.style.display = 'none';

        }

    });


    // =========================================================
    // 8. LOGIN WITH FIREBASE AUTHENTICATION
    // =========================================================

    const submitLoginBtn =
        document.getElementById('login-submit-btn');

    const usernameInput =
        document.getElementById('username');

    const passwordInput =
        document.getElementById('password');

    const loginError =
        document.getElementById('login-error');


    if (submitLoginBtn) {

        submitLoginBtn.addEventListener('click', async () => {

            const email =
                usernameInput.value.trim();

            const password =
                passwordInput.value;

            if (!email || !password) {

                loginError.textContent =
                    'Vui lòng nhập email và mật khẩu.';

                return;

            }


            try {

                await auth.signInWithEmailAndPassword(
                    email,
                    password
                );


                // Login thành công

                loginError.textContent = '';

                usernameInput.value = '';

                passwordInput.value = '';

                loginModal.style.display = 'none';

                openAdminDashboard();


            } catch (error) {

                console.error(
                    'Firebase Login Error:',
                    error
                );

                loginError.textContent =
                    'Email hoặc mật khẩu không đúng.';

            }

        });

    }


    // =========================================================
    // 9. OPEN ADMIN DASHBOARD
    // =========================================================

    function openAdminDashboard() {

        if (!auth.currentUser) {

            loginModal.style.display = 'block';

            return;

        }


        adminDashboardModal.style.display = 'block';


        // Lấy nội dung mới nhất từ Firestore

        contentDoc.get()
            .then(snapshot => {

                if (!snapshot.exists()) return;

                const data = snapshot.data();


                contentKeys.forEach(key => {

                    const textarea =
                        document.getElementById(`edit-${key}`);

                    if (!textarea) return;


                    textarea.value =
                        data[key] !== undefined
                            ? data[key]
                            : '';

                });

            })
            .catch(error => {

                console.error(
                    'Không thể tải nội dung Admin:',
                    error
                );

            });

    }


    // =========================================================
    // 10. LOGOUT
    // =========================================================

    const logoutBtn =
        document.getElementById('logout-btn');


    if (logoutBtn) {

        logoutBtn.addEventListener('click', async () => {

            try {

                await auth.signOut();

                adminDashboardModal.style.display =
                    'none';

                alert('Đã đăng xuất thành công!');

            } catch (error) {

                console.error(
                    'Logout Error:',
                    error
                );

            }

        });

    }


    // =========================================================
    // 11. CHANGE PASSWORD
    // =========================================================

    const changePwdBtn =
        document.getElementById('change-pwd-btn');


    if (changePwdBtn) {

        changePwdBtn.addEventListener('click', async () => {

            const newPwd =
                document.getElementById(
                    'new-password'
                ).value;

            const msg =
                document.getElementById('pwd-msg');


            if (!newPwd || newPwd.trim().length < 6) {

                msg.style.color = '#ef4444';

                msg.textContent =
                    'Mật khẩu phải có ít nhất 6 ký tự!';

                return;

            }


            const user = auth.currentUser;


            if (!user) {

                msg.style.color = '#ef4444';

                msg.textContent =
                    'Bạn chưa đăng nhập Admin.';

                return;

            }


            try {

                await user.updatePassword(newPwd);


                document.getElementById(
                    'new-password'
                ).value = '';


                msg.style.color = '#10b981';

                msg.textContent =
                    'Đổi mật khẩu thành công!';


                setTimeout(() => {

                    msg.textContent = '';

                }, 3000);


            } catch (error) {

                console.error(
                    'Change Password Error:',
                    error
                );


                msg.style.color = '#ef4444';

                if (
                    error.code ===
                    'auth/requires-recent-login'
                ) {

                    msg.textContent =
                        'Vì lý do bảo mật, hãy đăng xuất và đăng nhập lại rồi đổi mật khẩu.';

                } else {

                    msg.textContent =
                        'Không thể đổi mật khẩu.';

                }

            }

        });

    }


    // =========================================================
    // 12. SAVE WEBSITE CONTENT TO FIRESTORE
    // =========================================================

    const saveContentBtn =
        document.getElementById('save-content-btn');


    if (saveContentBtn) {

        saveContentBtn.addEventListener(
            'click',
            async () => {

                const msg =
                    document.getElementById('save-msg');


                // Kiểm tra đăng nhập

                if (!auth.currentUser) {

                    msg.style.color = '#ef4444';

                    msg.textContent =
                        'Bạn cần đăng nhập Admin trước!';

                    return;

                }


                try {

                    const updatedData = {};


                    // Lấy dữ liệu từ các textarea

                    contentKeys.forEach(key => {

                        const textarea =
                            document.getElementById(
                                `edit-${key}`
                            );

                        if (!textarea) return;

                        updatedData[key] =
                            textarea.value;

                    });


                    // Lưu toàn bộ nội dung lên Firestore

                    await contentDoc.set(
                        updatedData,
                        {
                            merge: true
                        }
                    );


                    // Cập nhật ngay giao diện hiện tại

                    contentKeys.forEach(key => {

                        const textarea =
                            document.getElementById(
                                `edit-${key}`
                            );

                        const domElement =
                            document.getElementById(
                                `content-${key}`
                            );


                        if (
                            textarea &&
                            domElement
                        ) {

                            domElement.innerHTML =
                                textarea.value;

                        }

                    });


                    msg.style.color = '#10b981';

                    msg.textContent =
                        'Đã lưu thành công lên Firebase! Các thiết bị khác sẽ nhận nội dung mới.';


                    setTimeout(() => {

                        msg.textContent = '';

                    }, 4000);


                    console.log(
                        'Website content saved to Firestore.'
                    );


                } catch (error) {

                    console.error(
                        'Firestore Save Error:',
                        error
                    );


                    msg.style.color = '#ef4444';

                    msg.textContent =
                        'Lỗi khi lưu Firebase: ' +
                        error.message;

                }

            }
        );

    }


    // =========================================================
    // 13. FIREBASE AUTH STATE
    // =========================================================

    auth.onAuthStateChanged(user => {

        if (user) {

            console.log(
                'Admin đang đăng nhập:',
                user.email
            );

        } else {

            console.log(
                'Không có Admin đăng nhập.'
            );

        }

    });

});
