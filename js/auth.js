const Auth = {
    async login() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        try {
            await auth.signInWithPopup(provider);
        } catch (e) {
            // === НАЧАЛО ИЗМЕНЕНИЙ: ЛОГИКА СВЯЗЫВАНИЯ АККАУНТОВ ===
            if (e.code === 'auth/account-exists-with-different-credential') {
                try {
                    // 1. Сохраняем данные от Google, которые мы только что получили
                    const pendingCred = e.credential;
                    const email = e.email;

                    // 2. Просим пользователя подтвердить, что это он, введя пароль
                    // (В идеале здесь должно быть красивое модальное окно, но для простоты используем prompt)
                    const password = prompt(`Почта ${email} уже зарегистрирована. Введите ваш пароль, чтобы привязать вход через Google:`);

                    if (password) {
                        // 3. Входим по старому методу (Email + Пароль)
                        const userCredential = await auth.signInWithEmailAndPassword(email, password);
                        
                        // 4. ПРИВЯЗЫВАЕМ (Link) Google аккаунт к этому пользователю
                        await userCredential.user.linkWithCredential(pendingCred);
                        
                        UI.showToast("Google аккаунт успешно привязан!");
                        return; // Успех
                    } else {
                        UI.showToast("Привязка отменена пользователем");
                    }
                } catch (linkError) {
                    // Если пароль неверный или другая ошибка при связывании
                    this.handleAuthError(linkError);
                }
            } else {
                // Если это любая другая ошибка - обрабатываем как обычно
                this.handleAuthError(e);
            }
            // === КОНЕЦ ИЗМЕНЕНИЙ ===
        }
    },

    async loginGithub() {
        const provider = new firebase.auth.GithubAuthProvider();
        try {
            await auth.signInWithPopup(provider);
        } catch (e) {
            // Тут можно добавить такую же логику для GitHub, если нужно
            this.handleAuthError(e);
        }
    },

    async loginEmail() {
        const email = document.getElementById('auth-email')?.value.trim();
        const pass = document.getElementById('auth-pass')?.value;
        if (!email || !pass) return UI.showToast("Заполните все поля");
        try {
            await auth.signInWithEmailAndPassword(email, pass);
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    async registerEmail() {
        const email = document.getElementById('auth-email')?.value.trim();
        const pass = document.getElementById('auth-pass')?.value;
        if (!email || !pass) return UI.showToast("Заполните все поля");
        if (pass.length < 6) return UI.showToast("Пароль от 6 символов");
        try {
            await auth.createUserWithEmailAndPassword(email, pass);
            // При регистрации сразу можно обновить имя, если нужно
            UI.showToast("Регистрация успешна!");
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    handleAuthError(e) {
        console.error("Auth System Error:", e.code, e.message);
        const errorMessages = {
            'auth/account-exists-with-different-credential': "Требуется подтверждение паролем для связывания",
            'auth/email-already-in-use': "Эта почта уже занята",
            'auth/wrong-password': "Неверный пароль",
            'auth/user-not-found': "Пользователь не найден",
            'auth/popup-closed-by-user': "Окно входа было закрыто",
            'auth/invalid-email': "Некорректный формат почты",
            'auth/network-request-failed': "Проблема с интернетом",
            'auth/credential-already-in-use': "Этот Google аккаунт уже привязан к другому пользователю"
        };
        UI.showToast(errorMessages[e.code] || `Ошибка: ${e.code}`);
    },

    async logout() {
        try {
            await auth.signOut();
            window.location.reload();
        } catch (e) {
            UI.showToast("Ошибка при выходе");
        }
    },

    async switchAccount() {
        try {
            await auth.signOut();
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await auth.signInWithPopup(provider);
        } catch (e) {
            window.location.reload(); // Перезагрузка при ошибке
        }
    },

    switchGoogleAccount() {
        this.switchAccount();
    }
};

// Слушатель состояния (без изменений)
auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    if (user) {
        state.user = user;
        
        if (userPhoto) {
            userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=random&color=fff`;
        }
        if (userName) {
            userName.textContent = user.displayName || user.email.split('@')[0];
        }

        if (loginScreen) {
            loginScreen.style.display = 'none';
            loginScreen.classList.remove('active');
        }
        if (appScreen) {
            appScreen.style.display = 'flex';
            appScreen.classList.add('active');
            appScreen.style.opacity = '1';
        }
        
        if (typeof initApp === 'function') initApp(); 
    } else {
        state.user = null;
        if (appScreen) {
            appScreen.style.display = 'none';
            appScreen.classList.remove('active');
        }
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            loginScreen.classList.add('active');
            loginScreen.style.opacity = '1';
        }
    }
});
