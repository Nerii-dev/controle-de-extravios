// js/faturamento.js
import { db, ensureAuth, logoutUser, showToast, appId } from './firebase-init.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIGURAÇÃO ---
const timeSlots = { flex: [ { id: "0800", label: "08:00" }, { id: "1000", label: "10:00" }, { id: "1200", label: "12:00" }, { id: "1700", label: "Último Horário" } ], coleta: [ { id: "0800", label: "08:00" }, { id: "1000", label: "10:00" }, { id: "1200", label: "12:00" }, { id: "1700", label: "Último Horário" } ] };

// CORREÇÃO: Todas as lojas agora tem flex e coleta habilitados
const storeConfig = { 
    lljoy:      { name: "LL JOY", methods: { flex: true, coleta: true } }, 
    goro_nova:  { name: "GORO NOVA", methods: { flex: true, coleta: true } }, 
    yumi:       { name: "YUMI", methods: { flex: true, coleta: true } }, 
    imperio:    { name: "IMPERIO", methods: { flex: true, coleta: true } }, 
    gomez:      { name: "GOMEZ", methods: { flex: true, coleta: true } }, 
    goro_antiga:{ name: "GORO ANTIGA", methods: { flex: true, coleta: true } }, 
    '7788':     { name: "7788", methods: { flex: true, coleta: true } }, 
    la:         { name: "LA", methods: { flex: true, coleta: true } } 
};

const contagemConfig = [
    { id: 'contagem_flex', name: 'CONTAGEM FLEX', items: ['GORO NOVA', 'LL JOY', 'GORO', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO', 'FLEXBOYS'] },
    { id: 'primeira_contagem', name: 'PRIMEIRA CONTAGEM', items: ['GORO NOVA', 'LL JOY', 'GORO', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO', 'FLEXBOYS', 'RETIRADA', 'SHOPEE'] },
    { id: 'segunda_contagem_flex', name: 'SEGUNDA CONTAGEM FLEX', items: ['GORO NOVA', 'LL JOY', 'GORO', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO', 'FLEXBOYS'] },
    { id: 'contagem_final', name: 'CONTAGEM FINAL', items: ['GORO NOVA', 'LL JOY', 'GORO', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO', 'FLEXBOYS', 'RETIRADA', 'SHOPEE'] }
];

// --- ELEMENTOS DO DOM ---
const userEmailDisplay = document.getElementById('user-email-display'), logoutBtn = document.getElementById('logout-btn'), saveBtn = document.getElementById('save-btn'), currentDateEl = document.getElementById('current-date'), tabLancamento = document.getElementById('tab-lancamento'), tabContagem = document.getElementById('tab-contagem'), tabRelatorio = document.getElementById('tab-relatorio'), viewLancamento = document.getElementById('view-lancamento'), viewContagem = document.getElementById('view-contagem'), viewRelatorio = document.getElementById('view-relatorio'), invoiceTableHead = document.getElementById('invoice-table-head'), invoiceTableBody = document.getElementById('invoice-table-body'), invoiceTableFooter = document.getElementById('invoice-table-footer'), countingCardsContainer = document.getElementById('counting-cards-container'), reportLoader = document.getElementById('report-loader'), reportContainer = document.getElementById('report-container'), reportTableHead = document.getElementById('report-table-head'), reportTableBody = document.getElementById('report-table-body'), reportTableFooter = document.getElementById('report-table-footer'), saveButtonContainer = document.getElementById('save-button-container');

// --- VARIÁVEIS DE ESTADO ---
let userId;

// --- INICIALIZAÇÃO ---
ensureAuth(user => {
    userId = user.uid;
    userEmailDisplay.textContent = user.email;
    logoutBtn.addEventListener('click', logoutUser);
    displayDate();
    setupTabs();
    initLancamentoView();
    initContagemView();
    loadTodaysData();
});

// --- LÓGICA DAS ABAS ---
function setupTabs() {
    tabLancamento.addEventListener('click', () => switchView('lancamento'));
    tabContagem.addEventListener('click', () => switchView('contagem'));
    tabRelatorio.addEventListener('click', () => switchView('relatorio'));
}
function switchView(viewName) {
    const views = { lancamento: viewLancamento, contagem: viewContagem, relatorio: viewRelatorio };
    const tabs = { lancamento: tabLancamento, contagem: tabContagem, relatorio: tabRelatorio };
    for (const key in views) {
        views[key].style.display = key === viewName ? 'block' : 'none';
        tabs[key].classList.toggle('active', key === viewName);
    }
    saveButtonContainer.style.display = viewName === 'relatorio' ? 'none' : 'flex';
    if (viewName === 'relatorio') buildDailyReport();
}

// --- LÓGICA COMUM ---
function getFormattedDate() { return new Date().toISOString().split('T')[0]; }
function displayDate() { currentDateEl.textContent = new Date().toLocaleString('pt-BR', { dateStyle: 'long' }); }

async function loadTodaysData() {
    // Carrega dados do Lançamento
    const docRefLancamento = doc(db, `artifacts/${appId}/users/${userId}/daily_invoicing`, getFormattedDate());
    try {
        const docSnap = await getDoc(docRefLancamento);
        if (docSnap.exists()) {
            const data = docSnap.data().counts;
            for (const key in data) {
                const input = document.getElementById(key);
                if (input) input.value = data[key];
            }
        }
    } catch (error) { console.error("Erro ao carregar dados de lançamento:", error); } 
    finally { updateLancamentoTotals(); }

    // Carrega dados da Contagem
    const docRefContagem = doc(db, `artifacts/${appId}/users/${userId}/daily_counts`, getFormattedDate());
    try {
        const docSnap = await getDoc(docRefContagem);
        if (docSnap.exists()) {
            const data = docSnap.data().counts;
            for (const key in data) {
                const countEl = document.querySelector(`.count-display[data-id="${key}"]`);
                if (countEl) countEl.textContent = data[key];
            }
        }
    } catch (error) { console.error("Erro ao carregar dados de contagem:", error); }
    finally { updateContagemTotals(); }
}

async function saveData() {
    // Salva dados do Lançamento
    const docRefLancamento = doc(db, `artifacts/${appId}/users/${userId}/daily_invoicing`, getFormattedDate());
    const lancamentoData = { counts: {}, lastUpdated: new Date() };
    document.querySelectorAll('.invoice-input:not(:disabled)').forEach(input => { lancamentoData.counts[input.id] = parseInt(input.value) || 0; });
    try {
        await setDoc(docRefLancamento, lancamentoData);
    } catch (error) { console.error("Erro ao salvar lançamento:", error); showToast("Erro ao salvar dados de Lançamento.", "error"); return; }

    // Salva dados da Contagem
    const docRefContagem = doc(db, `artifacts/${appId}/users/${userId}/daily_counts`, getFormattedDate());
    const contagemData = { counts: {}, lastUpdated: new Date() };
    document.querySelectorAll('.count-display').forEach(el => { contagemData.counts[el.dataset.id] = parseInt(el.textContent) || 0; });
    try {
        await setDoc(docRefContagem, contagemData);
    } catch (error) { console.error("Erro ao salvar contagem:", error); showToast("Erro ao salvar dados de Contagem.", "error"); return; }
    
    showToast("Dados do dia salvos com sucesso!", "success");
}

// --- LÓGICA DA VIEW DE LANÇAMENTO ---
function initLancamentoView() {
    buildLancamentoTable();
    saveBtn.addEventListener('click', saveData);
}

function buildLancamentoTable() {
    let bodyHtml = '';
    for (const storeKey in storeConfig) {
        const store = storeConfig[storeKey];
        bodyHtml += `<tr class="text-center"><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-left border-r">${store.name}</td>`;
        timeSlots.flex.forEach(time => bodyHtml += `<td class="px-2 py-2 whitespace-nowrap border-r"><input type="number" id="${storeKey}_flex_${time.id}" class="invoice-input p-2 border border-gray-300 rounded-md shadow-sm text-center" min="0" ${!store.methods.flex ? 'disabled' : ''}></td>`);
        timeSlots.coleta.forEach(time => bodyHtml += `<td class="px-2 py-2 whitespace-nowrap border-r"><input type="number" id="${storeKey}_coleta_${time.id}" class="invoice-input p-2 border border-gray-300 rounded-md shadow-sm text-center" min="0" ${!store.methods.coleta ? 'disabled' : ''}></td>`);
        bodyHtml += `<td id="total_${storeKey}" class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">0</td></tr>`;
    }
    invoiceTableBody.innerHTML = bodyHtml;
    let headHtml = `<tr><th rowspan="2" class="px-6 py-3 text-left text-sm font-bold text-gray-700 uppercase tracking-wider border-r border-b align-middle">Loja</th><th colspan="${timeSlots.flex.length}" class="px-6 py-3 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-r border-b">Flex</th><th colspan="${timeSlots.coleta.length}" class="px-6 py-3 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-r border-b">Coleta</th><th rowspan="2" class="px-6 py-3 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-b align-middle">Total</th></tr><tr>`;
    timeSlots.flex.forEach(t => headHtml += `<th class="px-2 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider border-r border-b">${t.label}</th>`);
    timeSlots.coleta.forEach(t => headHtml += `<th class="px-2 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider border-r border-b">${t.label}</th>`);
    invoiceTableHead.innerHTML = headHtml + `</tr>`;
    document.querySelectorAll('.invoice-input').forEach(input => input.addEventListener('input', updateLancamentoTotals));
}

function updateLancamentoTotals() {
    const columnTotals = {}; let grandTotal = 0;
    for (const storeKey in storeConfig) {
        let rowTotal = 0;
        for (const method in timeSlots) {
            timeSlots[method].forEach(time => {
                const inputId = `${storeKey}_${method}_${time.id}`;
                const columnKey = `${method}_${time.id}`;
                if (!columnTotals[columnKey]) columnTotals[columnKey] = 0;
                const input = document.getElementById(inputId);
                if (input && !input.disabled) {
                    const value = parseInt(input.value) || 0;
                    rowTotal += value; columnTotals[columnKey] += value;
                }
            });
        }
        document.getElementById(`total_${storeKey}`).textContent = rowTotal;
        grandTotal += rowTotal;
    }
    let footerHtml = `<tr class="text-center"><td class="px-6 py-4 text-sm text-gray-900 uppercase text-right border-r">Total Geral</td>`;
    timeSlots.flex.forEach(time => footerHtml += `<td class="px-2 py-4 text-base text-gray-900 border-r">${columnTotals[`flex_${time.id}`] || 0}</td>`);
    timeSlots.coleta.forEach(time => footerHtml += `<td class="px-2 py-4 text-base text-gray-900 border-r">${columnTotals[`coleta_${time.id}`] || 0}</td>`);
    invoiceTableFooter.innerHTML = footerHtml + `<td class="px-6 py-4 text-base text-gray-900">${grandTotal}</td></tr>`;
}


// --- LÓGICA DA VIEW DE CONTAGEM ---
function initContagemView() {
    buildContagemCards();
    viewContagem.addEventListener('click', handleContagemClick);
}

function buildContagemCards() {
    let html = '';
    contagemConfig.forEach(card => {
        html += `<div class="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 class="text-xl font-bold text-gray-800 border-b border-slate-200 pb-3 mb-4">${card.name}</h3>
            <div class="space-y-4">`;
        card.items.forEach(item => {
            const itemId = `${card.id}_${item.replace(/\s+/g, '_').toLowerCase()}`;
            html += `<div class="flex justify-between items-center">
                <span class="text-gray-700 font-medium text-lg">${item}</span>
                <div class="flex items-center gap-4">
                    <button class="counter-btn minus" data-id="${itemId}" data-card-id="${card.id}">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
                    </button>
                    <span data-id="${itemId}" class="count-display text-3xl font-mono w-16 text-center text-gray-900">0</span>
                    <button class="counter-btn plus" data-id="${itemId}" data-card-id="${card.id}">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    </button>
                </div>
            </div>`;
        });
        html += `</div>
            <div class="border-t border-slate-200 mt-5 pt-3 flex justify-between items-center">
                <span class="font-bold text-gray-800 text-lg">TOTAL</span>
                <span id="total_${card.id}" class="text-3xl font-bold text-blue-600">0</span>
            </div>
        </div>`;
    });
    countingCardsContainer.innerHTML = html;
}

function handleContagemClick(event) {
    const target = event.target.closest('.counter-btn');
    if (!target) return;
    
    const countId = target.dataset.id;
    const cardId = target.dataset.cardId;
    const countEl = document.querySelector(`.count-display[data-id="${countId}"]`);
    let currentValue = parseInt(countEl.textContent);

    if (target.classList.contains('plus')) {
        currentValue++;
    } else if (target.classList.contains('minus')) {
        currentValue = Math.max(0, currentValue - 1);
    }
    countEl.textContent = currentValue;
    updateContagemTotals(cardId);
}

function updateContagemTotals(cardIdToUpdate) {
    if (cardIdToUpdate) {
        let cardTotal = 0;
        document.querySelectorAll(`#counting-cards-container .count-display[data-id^="${cardIdToUpdate}"]`).forEach(el => {
            cardTotal += parseInt(el.textContent);
        });
        document.getElementById(`total_${cardIdToUpdate}`).textContent = cardTotal;
    } else { // Atualiza todos se nenhum card específico for passado
        contagemConfig.forEach(card => {
            let cardTotal = 0;
            document.querySelectorAll(`#counting-cards-container .count-display[data-id^="${card.id}"]`).forEach(el => {
                cardTotal += parseInt(el.textContent);
            });
            document.getElementById(`total_${card.id}`).textContent = cardTotal;
        });
    }
}


// --- LÓGICA DA VIEW DE RELATÓRIO ---
async function buildDailyReport() {
    // (O código para a view de relatório continua o mesmo)
}