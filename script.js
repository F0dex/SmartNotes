// --- КОНФИГУРАЦИЯ GOOGLE ТАБЛИЦ ---
// ВСТАВЬТЕ СЮДА ВАШ URL, ПОЛУЧЕННЫЙ ПОСЛЕ ДЕПЛОЯ В GOOGLE APPS SCRIPT
const GOOGLE_SHEET_APP_URL = "https://script.google.com/macros/s/AKfycbzSHLYYv7VVwBy1uPQnUHA_Rim9ac1Sz2BOfy5cW9wfm5L56ih19dk5VN9vFkCAgL8/exec";

// --- КОНФИГУРАЦИЯ FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// --- ЛОКАЛИЗАЦИЯ (i18n) ---
const i18n = {
    ru: {
        app_title: "Smart Notes",
        settings_title: "Настройки",
        tab_general: "Общие",
        tab_appearance: "Стиль",
        lang_label: "Язык интерфейса",
        target_label: "Что красим?",
        target_accent: "Акцент",
        target_bg: "Фон",
        target_text: "Текст",
        spectrum_label: "Выбери цвет",
        btn_reset: "Сброс",
        btn_apply: "ОК",
        search_ph: "Поиск заметок...",
        sort_newest: "Сначала новые",
        sort_priority: "По важности",
        sort_title: "По названию",
        view_active: "Заметки",
        view_archive: "Архив",
        save_btn: "СОХРАНИТЬ",
        update_btn: "ОБНОВИТЬ",
        editor_title_ph: "Заголовок",
        editor_text_ph: "Начните писать...",
        tag_ph: "теги через пробел",
        label_time: "Время",
        p_low: "Низкий",
        p_norm: "Средний",
        p_high: "Высокий 🔥",
        confirm_del: "Удалить заметку?",
        stat_notes: "записей",
        login: "ВОЙТИ ЧЕРЕЗ GOOGLE",
        menu_settings: "Настройки",
        menu_language: "Язык",
        menu_folders: "Папки",
        menu_create_folder: "Создать",
        menu_all_notes: "Все заметки",
        perm_error: "Не хватает прав для этой операции. Проверьте правила безопасности Firestore."
    },
    en: {
        app_title: "Smart Notes",
        settings_title: "Settings",
        tab_general: "General",
        tab_appearance: "Style",
        lang_label: "Language",
        target_label: "Target Element",
        target_accent: "Accent",
        target_bg: "Background",
        target_text: "Text",
        spectrum_label: "Pick Color",
        btn_reset: "Reset",
        btn_apply: "OK",
        search_ph: "Search notes...",
        sort_newest: "Newest first",
        sort_priority: "By Priority",
        sort_title: "By Title",
        view_active: "Notes",
        view_archive: "Archive",
        save_btn: "SAVE",
        update_btn: "UPDATE",
        editor_title_ph: "Title",
        editor_text_ph: "Start writing...",
        tag_ph: "tags by space",
        label_time: "Time",
        p_low: "Low",
        p_norm: "Medium",
        p_high: "High 🔥",
        confirm_del: "Delete note?",
        stat_notes: "records",
        login: "LOGIN WITH GOOGLE",
        menu_settings: "Settings",
        menu_language: "Language",
        menu_folders: "Folders",
        menu_create_folder: "Create",
        menu_all_notes: "All notes",
        perm_error: "Missing or insufficient permissions. Check Firestore security rules."
    }
};

// --- СОСТОЯНИЕ ПРИЛОЖЕНИЯ ---
let state = {
    user: null,
    notes: [],
    folders: [],
    view: 'active',
    selectedFolderId: null,
    editingId: null,
    editorPinned: false,
    colorTarget: 'accent',
    tempConfig: {},
    config: {
        lang: localStorage.getItem('sn_lang') || 'ru',
        accent: localStorage.getItem('sn_accent') || '#00ffcc',
        bg: localStorage.getItem('sn_bg') || '#000000',
        text: localStorage.getItem('sn_text') || '#ffffff'
    }
};

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', async () => {
    state.tempConfig = { ...state.config };
    applyTheme(state.config);
    updateInterfaceText();

    try {
        await auth.getRedirectResult();
    } catch (e) {
        console.warn("Redirect result error:", e);
    }

    auth.onAuthStateChanged(user => {
        state.user = user;
        const loginScreen = document.getElementById('login-screen');
        const appContent = document.getElementById('app-content');

        if (user) {
            if (loginScreen) loginScreen.style.display = 'none';
            if (appContent) appContent.classList.remove('hidden');
            subscribeNotes(user.uid);
            subscribeFolders(user.uid);
            updateProfileUI(user);
        } else {
            if (loginScreen) loginScreen.style.display = 'flex';
            if (appContent) appContent.classList.add('hidden');
            state.notes = [];
            state.folders = [];
            renderNotes();
            renderFolders();
        }
    });

    registerGlobals();
});

// --- ФУНКЦИЯ ОТПРАВКИ В GOOGLE ТАБЛИЦЫ ---
async function sendToGoogleSheet(data) {
    if (!GOOGLE_SHEET_APP_URL || GOOGLE_SHEET_APP_URL.includes("ВАШ_URL")) return;

    try {
        await fetch(GOOGLE_SHEET_APP_URL, {
            method: 'POST',
            mode: 'no-cors', // Важно для Google Apps Script
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: data.title,
                text: data.text,
                folder: data.folderName || 'Нет папки',
                priority: data.priority,
                user: state.user ? state.user.email : 'Anonymous'
            })
        });
        console.log("✅ Данные отправлены в Google Таблицу");
    } catch (e) {
        console.error("❌ Ошибка отправки в Google Таблицу:", e);
    }
}

// --- АВТОРИЗАЦИЯ ---
const login = async () => {
    try {
        await auth.signInWithPopup(provider);
    } catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
            await auth.signInWithRedirect(provider);
        } else {
            console.error("Login error:", e);
        }
    }
};
const logout = () => auth.signOut();

const switchAccount = async () => {
    await auth.signOut();
    login();
};

function updateProfileUI(user) {
    const pic = document.getElementById('user-pic');
    const modalPic = document.getElementById('modal-user-pic');
    const name = document.getElementById('user-name');
    if (pic) pic.src = user.photoURL || '';
    if (modalPic) modalPic.src = user.photoURL || '';
    if (name) name.textContent = user.displayName || 'User';
}

// --- Firestore подписки ---
function subscribeNotes(uid) {
    db.collection("notes")
      .where("uid", "==", uid)
      .onSnapshot(snap => {
          state.notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderNotes();
          updateStats();
      }, err => console.error(err));
}

function subscribeFolders(uid) {
    db.collection("folders")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(snap => {
          state.folders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderFolders();
          populateEditorFolderSelect();
      }, err => console.error(err));
}

// --- РЕДАКТОР И СОХРАНЕНИЕ ---
const saveNote = async () => {
    const title = document.getElementById('note-title').value.trim();
    const text = document.getElementById('note-text').value.trim();
    if (!title && !text) return closeEditor();

    const folderId = document.getElementById('note-folder-select')?.value || null;
    const folderName = state.folders.find(f => f.id === folderId)?.name || '';

    const data = {
        title, text,
        tags: document.getElementById('note-tags').value.split(' ').filter(t => t.trim()),
        priority: document.getElementById('priority-label').dataset.priority || 'normal',
        showTimestamp: document.getElementById('show-time').checked,
        isPinned: state.editorPinned,
        updatedAt: Date.now(),
        folderId: folderId
    };

    try {
        if (state.editingId) {
            await db.collection("notes").doc(state.editingId).update(data);
        } else {
            if (!state.user) { alert("Требуется авторизация"); return; }
            data.uid = state.user.uid;
            data.createdAt = Date.now();
            data.isArchived = false;
            await db.collection("notes").add(data);
        }

        // --- ДУБЛИРОВАНИЕ В GOOGLE ТАБЛИЦЫ ---
        // Отправляем данные в таблицу после успешного сохранения в Firebase
        sendToGoogleSheet({ ...data, folderName });

        closeEditor();
    } catch (e) {
        console.error("Ошибка сохранения:", e);
        alert("Ошибка: " + e.message);
    }
};

// --- ОСТАЛЬНЫЕ ФУНКЦИИ (РЕНДЕР, ТЕМЫ И Т.Д.) ---
// (Оставляем без изменений для корректной работы интерфейса)

async function createFolder() {
    const input = document.getElementById('new-folder-name');
    const colorInput = document.getElementById('new-folder-color');
    const name = (input?.value || '').trim();
    const color = (colorInput?.value || '#00ffcc').trim();
    if (!name || !state.user) return;
    try {
        await db.collection("folders").add({ uid: state.user.uid, name, color, createdAt: Date.now() });
        input.value = '';
    } catch (e) { console.error(e); }
}

async function deleteFolder(folderId) {
    if (!folderId || !confirm("Удалить папку?")) return;
    try {
        await db.collection("folders").doc(folderId).delete();
        const notesSnapshot = await db.collection("notes").where("folderId", "==", folderId).get();
        const batch = db.batch();
        notesSnapshot.forEach(d => batch.update(d.ref, { folderId: null }));
        await batch.commit();
    } catch (e) { console.error(e); }
}

function renderFolders() {
    const list = document.getElementById('folders-list');
    if (!list) return;
    list.innerHTML = '';
    state.folders.forEach(f => {
        const el = document.createElement('div');
        el.className = 'folder-item' + (state.selectedFolderId === f.id ? ' active' : '');
        el.innerHTML = `<div class="folder-name"><span class="folder-color-dot" style="background:${escapeHtml(f.color)};"></span><span>${escapeHtml(f.name)}</span></div>
            <div class="folder-actions"><button onclick="event.stopPropagation(); deleteFolder('${f.id}')">🗑️</button></div>`;
        el.onclick = () => selectFolder(f.id);
        list.appendChild(el);
    });
}

function selectFolder(id) {
    state.selectedFolderId = (state.selectedFolderId === id) ? null : id;
    renderFolders();
    renderNotes();
}

function populateEditorFolderSelect() {
    const sel = document.getElementById('note-folder-select');
    if (!sel) return;
    sel.innerHTML = `<option value="">Без папки</option>`;
    state.folders.forEach(f => {
        const o = document.createElement('option');
        o.value = f.id; o.textContent = f.name;
        sel.appendChild(o);
    });
}

const renderNotes = () => {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;
    const searchTerm = (document.getElementById('search-input')?.value || '').toLowerCase();
    const sortBy = document.getElementById('sort-select')?.value || 'newest';

    let filtered = state.notes.filter(n => {
        const isCorrectView = state.view === 'archive' ? n.isArchived : !n.isArchived;
        const matchesFolder = state.selectedFolderId ? (n.folderId === state.selectedFolderId) : true;
        const matchesSearch = (n.title || '').toLowerCase().includes(searchTerm) || (n.text || '').toLowerCase().includes(searchTerm);
        return isCorrectView && matchesFolder && matchesSearch;
    });

    filtered.sort((a, b) => {
        if (state.view === 'active') {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
        }
        if (sortBy === 'priority') {
            const w = { high: 3, normal: 2, low: 1 };
            return (w[b.priority] || 2) - (w[a.priority] || 2);
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    grid.innerHTML = '';
    filtered.forEach(n => {
        const card = document.createElement('div');
        card.className = `note-card ${n.isPinned ? 'pinned' : ''}`;
        card.style.borderColor = n.priority === 'high' ? '#ff4444' : (n.priority === 'low' ? '#888' : 'transparent');
        card.onclick = () => openEditor(n.id);
        card.innerHTML = `
            <div class="note-card__title">${escapeHtml(n.title || '')}</div>
            <div class="note-card__text">${escapeHtml(n.text || '')}</div>
        `;
        grid.appendChild(card);
    });
};

const openEditor = (id = null) => {
    state.editingId = id;
    const modal = document.getElementById('editor-modal');
    if (id) {
        const note = state.notes.find(n => n.id === id);
        if (note) {
            document.getElementById('note-title').value = note.title || '';
            document.getElementById('note-text').value = note.text || '';
            document.getElementById('note-folder-select').value = note.folderId || '';
            updatePriorityUI(note.priority || 'normal');
        }
    } else {
        document.getElementById('note-title').value = '';
        document.getElementById('note-text').value = '';
        updatePriorityUI('normal');
    }
    if (modal) modal.classList.add('active');
};

const closeEditor = () => document.getElementById('editor-modal')?.classList.remove('active');

function escapeHtml(t) { 
    const d = document.createElement('div'); d.textContent = t; return d.innerHTML; 
}

function applyTheme(cfg) {
    const r = document.documentElement;
    r.style.setProperty('--accent', cfg.accent);
    r.style.setProperty('--bg', cfg.bg);
    r.style.setProperty('--text', cfg.text);
}

const updateInterfaceText = () => {
    const dict = i18n[state.config.lang];
    document.querySelectorAll('[id^="lang-"]').forEach(el => {
        const key = el.id.replace('lang-', '').replace(/-/g, '_');
        if (dict[key]) el.textContent = dict[key];
    });
};

function updateStats() {
    const el = document.getElementById('note-count');
    if (el) el.textContent = state.notes.length;
}

function registerGlobals() {
    window.login = login;
    window.logout = logout;
    window.saveNote = saveNote;
    window.openEditor = openEditor;
    window.closeEditor = closeEditor;
    window.createFolder = createFolder;
    window.deleteFolder = deleteFolder;
    window.selectFolder = selectFolder;
}
