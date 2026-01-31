const Auth = {
    // Вход через Google со связыванием аккаунтов
    async login() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        try {
            await auth.signInWithPopup(provider);
        } catch (e) {
            // Если аккаунт уже существует с другим методом (паролем)
            if (e.code === 'auth/account-exists-with-different-credential') {
                const pendingCred = e.credential;
                const email = e.email;
                
                const password = prompt(`Почта ${email} уже зарегистрирована. Введите пароль для связывания с Google:`);
                
                if (password) {
                    try {
                        const userCredential = await auth.signInWithEmailAndPassword(email, password);
                        await userCredential.user.linkWithCredential(pendingCred);
                        UI.showToast("Аккаунты успешно объединены!");
                    } catch (linkError) {
                        this.handleAuthError(linkError);
                    }
                }
            } else {
                this.handleAuthError(e);
            }
        }
    },

    async loginGithub() {
        const provider = new firebase.auth.GithubAuthProvider();
        try {
            await auth.signInWithPopup(provider);
        } catch (e) {
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
            UI.showToast("Регистрация успешна!");
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    // НОВАЯ ФУНКЦИЯ: Создание пароля для Google-пользователя (Регистрация после входа)
    async createPasswordForGoogleUser() {
        const user = auth.currentUser;
        if (!user) return UI.showToast("Вы не авторизованы");

        // Проверяем, есть ли уже пароль у аккаунта
        const hasPassword = user.providerData.some(p => p.providerId === 'password');
        if (hasPassword) return UI.showToast("Пароль уже установлен");

        const password = prompt("Придумайте пароль для входа по почте (мин. 6 символов):");
        if (!password || password.length < 6) return UI.showToast("Некорректный пароль");

        try {
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
            await user.linkWithCredential(credential);
            UI.showToast("Пароль успешно добавлен!");
            // Обновляем интерфейс (скрываем кнопку создания пароля)
            this.updateUIForUser(user);
        } catch (e) {
            if (e.code === 'auth/requires-recent-login') {
                UI.showToast("Нужно перезайти в аккаунт для безопасности");
                this.login();
            } else {
                this.handleAuthError(e);
            }
        }
    },

    handleAuthError(e) {
        console.error("Auth Error:", e.code);
        const errorMessages = {
            'auth/account-exists-with-different-credential': "Почта уже используется с другим способом входа",
            'auth/email-already-in-use': "Эта почта уже занята",
            'auth/wrong-password': "Неверный пароль",
            'auth/user-not-found': "Пользователь не найден",
            'auth/popup-closed-by-user': "Окно входа закрыто",
            'auth/weak-password': "Слишком слабый пароль"
        };
        UI.showToast(errorMessages[e.code] || `Ошибка: ${e.message}`);
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
            this.login();
        } catch (e) {
            window.location.reload();
        }
    },

    switchGoogleAccount() {
        this.switchAccount();
    },

    // Вспомогательная функция для обновления UI
    updateUIForUser(user) {
        const loginScreen = document.getElementById('login-screen');
        const appScreen = document.getElementById('app');
        const userPhoto = document.getElementById('user-photo');
        const userName = document.getElementById('user-name');
        const createPassBtn = document.getElementById('btn-create-pass'); // Кнопка "Создать пароль" в профиле

        if (user) {
            state.user = user;
            if (userPhoto) userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`;
            if (userName) userName.textContent = user.displayName || user.email.split('@')[0];

            // Если зашел через Google и нет пароля - показываем кнопку создания пароля
            if (createPassBtn) {
                const hasPassword = user.providerData.some(p => p.providerId === 'password');
                createPassBtn.style.display = hasPassword ? 'none' : 'block';
                createPassBtn.onclick = () => this.createPasswordForGoogleUser();
            }

            if (loginScreen) loginScreen.style.display = 'none';
            if (appScreen) {
                appScreen.style.display = 'flex';
                appScreen.style.opacity = '1';
                appScreen.classList.add('active');
            }
            if (typeof initApp === 'function') initApp();
        } else {
            state.user = null;
            if (appScreen) appScreen.style.display = 'none';
            if (loginScreen) {
                loginScreen.style.display = 'flex';
                loginScreen.style.opacity = '1';
                loginScreen.classList.add('active');
            }
        }
    }
};

// Слушатель состояния
auth.onAuthStateChanged(user => Auth.updateUIForUser(user));
