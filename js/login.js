// js/login.js
import { auth } from './firebase-init.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const errorMessage = document.getElementById('error-message');

loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    errorMessage.textContent = ''; // Limpa mensagens de erro anteriores

    signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
        .then(() => {
            // Login bem-sucedido, redireciona para a nova página inicial (index.html)
            window.location.href = 'index.html'; 
        })
        .catch((error) => {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessage.textContent = "Email ou senha inválidos.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage.textContent = "Formato de email inválido.";
            } else {
                errorMessage.textContent = "Erro ao fazer login. Tente novamente.";
            }
            console.error("Erro de login:", error.code, error.message);
        });
});