// js/index.js
import { ensureAuth, logoutUser } from './firebase-init.js';

ensureAuth(user => {
    document.getElementById('user-email-display').textContent = user.email;
    document.getElementById('logout-btn').addEventListener('click', logoutUser);
});