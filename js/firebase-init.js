// Importações do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIGURAÇÃO ---
// ‼️‼️ SUBSTITUA COM SUA CONFIGURAÇÃO REAL DO FIREBASE AQUI ‼️‼️
const firebaseConfig = {
    apiKey: "AIzaSyBPy9J2RJ4kNslWT7SwCQEFua-NZrbHDzk",
    authDomain: "extravio-84679.firebaseapp.com",
    projectId: "extravio-84679",
    storageBucket: "extravio-84679.firebasestorage.app",
    messagingSenderId: "541000898123",
    appId: "1:541000898123:web:973c1a656f6d2245201fce",
    measurementId: "G-83X73YY3KC"
};

// --- CONSTANTES E VARIÁVEIS GLOBAIS ---
const STORES = Array.from({ length: 8 }, (_, i) => `Loja ${String.fromCharCode(65 + i)}`);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- FUNÇÕES DE AUTENTICAÇÃO E UTILITÁRIAS ---

// Garante que o usuário está autenticado antes de executar o código da página
function ensureAuth(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            callback(user);
        } else {
             try {
                // Tenta autenticar, priorizando token customizado se existir
                const userCredential = await (initialAuthToken ? signInWithCustomToken(auth, initialAuthToken) : signInAnonymously(auth));
                if (userCredential.user) {
                    callback(userCredential.user);
                }
            } catch (error) {
                console.error("Erro na autenticação anônima:", error);
                document.body.innerHTML = "<h1>Erro de autenticação. Verifique o console.</h1>";
            }
        }
    });
}

// Mostra uma notificação (toast) na tela
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Formata um valor para moeda brasileira (BRL)
function formatCurrency(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value === '') { e.target.value = ''; return; }
    const numericValue = parseFloat(value) / 100;
    e.target.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue);
}

// Converte uma string de moeda para um número
function parseCurrency(value) {
    if (!value) return 0;
    const numericString = value.replace(/[R$\s.]/g, '').replace(',', '.');
    return parseFloat(numericString) || 0;
}


// Exporta tudo que será usado nos outros scripts
export { db, auth, ensureAuth, showToast, formatCurrency, parseCurrency, STORES, appId };