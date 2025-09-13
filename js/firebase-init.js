// js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIGURAÇÃO ---
// ‼️‼️ COLE A SUA CONFIGURAÇÃO DO FIREBASE AQUI ‼️‼️
const firebaseConfig = {
    apiKey: "AIzaSyBPy9J2RJ4kNslWT7SwCQEFua-NZrbHDzk",
    authDomain: "extravio-84679.firebaseapp.com",
    projectId: "extravio-84679",
    storageBucket: "extravio-84679.firebasestorage.app",
    messagingSenderId: "541000898123",
    appId: "1:541000898123:web:973c1a656f6d2245201fce",
    measurementId: "G-83X73YY3KC"
};


// --- CONSTANTES ---
const STORES = Array.from({ length: 8 }, (_, i) => `Loja ${String.fromCharCode(65 + i)}`);
const appId = 'default-app-id'; // Usado para a estrutura do Firestore

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- FUNÇÕES GLOBAIS ---

// Gatekeeper: Garante que o usuário está logado para acessar páginas protegidas
function ensureAuth(callback) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuário está logado, executa o código da página
            callback(user);
        } else {
            // Usuário não está logado, redireciona para a página de login
            const currentPath = window.location.pathname;
            if (!currentPath.includes('login.html')) {
                 window.location.href = 'login.html';
            }
        }
    });
}

// Função de Logout
function logoutUser() {
    signOut(auth).then(() => {
        window.location.href = 'login.html'; // Redireciona para o login após sair
    }).catch(error => {
        console.error('Erro no logout:', error);
        showToast('Erro ao sair.', 'error');
    });
}

// Funções Utilitárias (Toast, Formatação de Moeda, etc.)
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

function formatCurrency(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value === '') { e.target.value = ''; return; }
    const numericValue = parseFloat(value) / 100;
    e.target.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue);
}

function parseCurrency(value) {
    if (!value) return 0;
    const numericString = value.replace(/[R$\s.]/g, '').replace(',', '.');
    return parseFloat(numericString) || 0;
}

// Exporta tudo que será usado nos outros scripts
export { db, auth, ensureAuth, logoutUser, showToast, formatCurrency, parseCurrency, STORES, appId };