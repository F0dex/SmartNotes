const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56",
    clientId: "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence().catch((err) => {
    if (err.code == 'failed-precondition') console.warn('Много вкладок: оффлайн режим ограничен');
    else if (err.code == 'unimplemented') console.warn('Браузер не поддерживает оффлайн');
});

const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let state = {
    user: null,
    notes: [],
    folders: [],
    view: 'notes',
    activeFolderId: null,
    searchQuery: '',
    currentNote: null,
    isLoading: true,
    isDrawing: false,
    accessibility: localStorage.getItem('accessibility') === 'true',
    config: { 
        lang: localStorage.getItem('lang') || 'ru',
        theme: localStorage.getItem('theme') || 'dark'
    }
};

const LANG = {
    ru: {
        slogan: "SmartNotes", login_google: "Войти через Google", all_notes: "Все записи",
        favorites: "Важное", archive: "Архив", trash: "Корзина", folders: "ПАПКИ",
        settings: "Настройки", logout: "Выйти", empty: "Здесь пока пусто",
        save: "Сохранить", sync: "Синхронизация", drawing: "Рисование",
        history: "История версий", shared: "Общие", lock: "Защитить"
    },
    en: {
        slogan: "SmartNotes", login_google: "Sign in with Google", all_notes: "All Notes",
        favorites: "Important", archive: "Archive", trash: "Trash", folders: "FOLDERS",
        settings: "Settings", logout: "Logout", empty: "Nothing here yet",
        save: "Save", sync: "Sync", drawing: "Drawing",
        history: "History", shared: "Shared", lock: "Lock"
    }
};
