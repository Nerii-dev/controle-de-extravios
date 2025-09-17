// js/faturamento.js
import { db, ensureAuth, logoutUser, showToast, appId } from './firebase-init.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIGURAÇÃO ---
const timeSlots = { flex: [ { id: "0800", label: "08:00" }, { id: "1000", label: "10:00" }, { id: "1200", label: "12:00" }, { id: "1700", label: "Último Horário" } ], coleta: [ { id: "0800", label: "08:00" }, { id: "1000", label: "10:00" }, { id: "1200", label: "12:00" }, { id: "1700", label: "Último Horário" } ] };

const storeConfig = { 
    lljoy:      { name: "LL JOY", methods: { flex: true, coleta: true } }, 
    goro_nova:  { name: "GORO NOVA", methods: { flex: true, coleta: true } }, 
    yumi:       { name: "YUMI", methods: { flex: true, coleta: true } }, 
    imperio:    { name: "IMPERIO", methods: { flex: true, coleta: true } }, 
    gomez:      { name: "GOMEZ", methods: { flex: true, coleta: true } }, 
    goro_antiga:{ name: "GORO ANTIGA", methods: { flex: true, coleta: true } }, 
    '7788':     { name: "7788", methods: { flex: true, coleta: true } }, 
    la:         { name: "LA", methods: { flex: true, coleta: true } },
    flexboys:   { name: "FlexBoys", methods: { flex: true, coleta: true } },
    frenet:     { name: "Frenet", methods: { flex: true, coleta: true } },
    retirada:   { name: "Retirada", methods: { flex: true, coleta: true } }
};

const contagemConfig = [
    { id: 'contagem_flex', name: 'CONTAGEM FLEX', items: ['GORO NOVA', 'LL JOY', 'GORO ANTIGA', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO'] },
    { id: 'primeira_contagem', name: 'PRIMEIRA CONTAGEM', items: ['GORO NOVA', 'LL JOY', 'GORO ANTIGA', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO', 'RETIRADA', 'SHOPEE'] },
    { id: 'segunda_contagem_flex', name: 'SEGUNDA CONTAGEM FLEX', items: ['GORO NOVA', 'LL JOY', 'GORO ANTIGA', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO'] },
    { id: 'contagem_final', name: 'CONTAGEM FINAL', items: ['GORO NOVA', 'LL JOY', 'GORO ANTIGA', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO', 'RETIRADA', 'SHOPEE'] }
];

// --- ELEMENTOS DO DOM ---
const userEmailDisplay = document.getElementById('user-email-display'), 
      logoutBtn = document.getElementById('logout-btn'), 
      saveBtn = document.getElementById('save-btn'), 
      exportExcelBtn = document.getElementById('export-excel-btn'),
      currentDateEl = document.getElementById('current-date'), 
      tabLancamento = document.getElementById('tab-lancamento'), 
      tabMlFull = document.getElementById('tab-ml-full'),
      tabContagem = document.getElementById('tab-contagem'), 
      tabRelatorio = document.getElementById('tab-relatorio'), 
      viewLancamento = document.getElementById('view-lancamento'), 
      viewMlFull = document.getElementById('view-ml-full'),
      viewContagem = document.getElementById('view-contagem'), 
      viewRelatorio = document.getElementById('view-relatorio'), 
      invoiceTableHead = document.getElementById('invoice-table-head'), 
      invoiceTableBody = document.getElementById('invoice-table-body'), 
      invoiceTableFooter = document.getElementById('invoice-table-footer'), 
      countingCardsContainer = document.getElementById('counting-cards-container'), 
      reportLoader = document.getElementById('report-loader'), 
      reportContainer = document.getElementById('report-container'), 
      saveButtonContainer = document.getElementById('save-button-container');

// --- VARIÁVEIS DE ESTADO ---
let userId;

// --- INICIALIZAÇÃO ---
ensureAuth(user => {
    userId = user.uid;
    userEmailDisplay.textContent = user.email;
    logoutBtn.addEventListener('click', logoutUser);

    displayDate();
    setupTabs();
    setupReportSubTabs();
    initLancamentoView();
    initContagemView();
    initMlFullView();
    loadTodaysData();
});

// --- LÓGICA DAS ABAS ---
function setupTabs() {
    tabLancamento.addEventListener('click', () => switchView('lancamento'));
    tabMlFull.addEventListener('click', () => switchView('ml-full'));
    tabContagem.addEventListener('click', () => switchView('contagem'));
    tabRelatorio.addEventListener('click', () => switchView('relatorio'));
}

function switchView(viewName) {
    const views = { lancamento: viewLancamento, 'ml-full': viewMlFull, contagem: viewContagem, relatorio: viewRelatorio };
    const tabs = { lancamento: tabLancamento, 'ml-full': tabMlFull, contagem: tabContagem, relatorio: tabRelatorio };
    for (const key in views) {
        views[key].style.display = key === viewName ? 'block' : 'none';
        tabs[key].classList.toggle('active', key === viewName);
    }
    
    saveButtonContainer.style.display = viewName === 'relatorio' ? 'none' : 'flex';
    exportExcelBtn.style.display = viewName === 'relatorio' ? 'block' : 'none';

    if (viewName === 'relatorio') {
        buildDailyReport();
        buildReportByTime();
    }
}

function setupReportSubTabs() {
    const subTabs = document.querySelectorAll('.report-sub-tab-btn');
    const subViews = document.querySelectorAll('.report-sub-view');

    subTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetViewId = tab.dataset.target;

            subTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            subViews.forEach(view => {
                if (view.id === targetViewId) {
                    view.style.display = 'block';
                } else {
                    view.style.display = 'none';
                }
            });
        });
    });
}

// --- LÓGICA COMUM ---
function getFormattedDate() { return new Date().toISOString().split('T')[0]; }
function displayDate() { currentDateEl.textContent = new Date().toLocaleString('pt-BR', { dateStyle: 'long' }); }

async function loadTodaysData() {
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

    const docRefMlFull = doc(db, `artifacts/${appId}/users/${userId}/daily_ml_full`, getFormattedDate());
    try {
        const docSnap = await getDoc(docRefMlFull);
        if (docSnap.exists()) {
            const data = docSnap.data().counts;
            for (const key in data) {
                const input = document.getElementById(key);
                if (input) input.value = data[key];
            }
        }
    } catch (error) { console.error("Erro ao carregar dados de ML FULL:", error); }
    finally { updateMlFullTotal(); }
}

async function saveData() {
    const docRefLancamento = doc(db, `artifacts/${appId}/users/${userId}/daily_invoicing`, getFormattedDate());
    const lancamentoData = { counts: {}, lastUpdated: new Date() };
    document.querySelectorAll('.invoice-input:not(:disabled)').forEach(input => { lancamentoData.counts[input.id] = parseInt(input.value) || 0; });
    try {
        await setDoc(docRefLancamento, lancamentoData);
    } catch (error) { console.error("Erro ao salvar lançamento:", error); showToast("Erro ao salvar dados de Lançamento.", "error"); return; }

    const docRefContagem = doc(db, `artifacts/${appId}/users/${userId}/daily_counts`, getFormattedDate());
    const contagemData = { counts: {}, lastUpdated: new Date() };
    document.querySelectorAll('.count-display').forEach(el => { contagemData.counts[el.dataset.id] = parseInt(el.textContent) || 0; });
    try {
        await setDoc(docRefContagem, contagemData);
    } catch (error) { console.error("Erro ao salvar contagem:", error); showToast("Erro ao salvar dados de Contagem.", "error"); return; }

    const docRefMlFull = doc(db, `artifacts/${appId}/users/${userId}/daily_ml_full`, getFormattedDate());
    const mlFullData = { counts: {}, lastUpdated: new Date() };
    document.querySelectorAll('.ml-full-input').forEach(input => {
        mlFullData.counts[input.id] = parseInt(input.value) || 0;
    });
    try {
        await setDoc(docRefMlFull, mlFullData);
    } catch (error) {
        console.error("Erro ao salvar ML FULL:", error);
        showToast("Erro ao salvar dados de ML FULL.", "error");
        return;
    }
    
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
        timeSlots.flex.forEach(time => bodyHtml += `<td class="px-2 py-2 whitespace-nowrap border-r"><input type="number" id="${storeKey}_flex_${time.id}" class="invoice-input p-2 border border-gray-300 rounded-md shadow-sm text-center" min="0" value="0" ${!store.methods.flex ? 'disabled' : ''}></td>`);
        timeSlots.coleta.forEach(time => bodyHtml += `<td class="px-2 py-2 whitespace-nowrap border-r"><input type="number" id="${storeKey}_coleta_${time.id}" class="invoice-input p-2 border border-gray-300 rounded-md shadow-sm text-center" min="0" value="0" ${!store.methods.coleta ? 'disabled' : ''}></td>`);
        bodyHtml += `<td id="total_${storeKey}" class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">0</td></tr>`;
    }
    invoiceTableBody.innerHTML = bodyHtml;
    let headHtml = `<tr><th rowspan="2" class="px-6 py-3 text-left text-sm font-bold text-gray-700 uppercase tracking-wider border-r border-b align-middle">Loja</th><th colspan="${timeSlots.flex.length}" class="px-6 py-3 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-r border-b">Flex</th><th colspan="${timeSlots.coleta.length}" class="px-6 py-3 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-r border-b">Coleta</th><th rowspan="2" class="px-6 py-3 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-b align-middle">Total</th></tr><tr>`;
    timeSlots.flex.forEach(t => headHtml += `<th class="px-2 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider border-r border-b">${t.label}</th>`);
    timeSlots.coleta.forEach(t => headHtml += `<th class="px-2 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider border-r border-b">${t.label}</th>`);
    invoiceTableHead.innerHTML = headHtml + `</tr>`;
    document.querySelectorAll('.invoice-input').forEach(input => input.addEventListener('input', updateLancamentoTotals));
    updateLancamentoTotals();
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

// --- LÓGICA DA VIEW ML FULL ---
function initMlFullView() {
    const container = viewMlFull.querySelector('.grid');
    let html = '';
    for (const storeKey in storeConfig) {
        const store = storeConfig[storeKey];
        html += `
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <label for="ml-full_${storeKey}" class="block text-lg font-bold text-gray-800 mb-2">${store.name}</label>
                <input type="number" id="ml-full_${storeKey}" class="ml-full-input w-full p-2 border border-gray-300 rounded-md shadow-sm text-center text-2xl" min="0" value="0">
            </div>
        `;
    }
    container.innerHTML = html;
    viewMlFull.querySelectorAll('.ml-full-input').forEach(input => {
        input.addEventListener('input', updateMlFullTotal);
    });
}

function updateMlFullTotal() {
    let total = 0;
    document.querySelectorAll('.ml-full-input').forEach(input => {
        total += parseInt(input.value) || 0;
    });
    document.getElementById('total-ml-full').textContent = total;
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
            const adjustedItemName = item === 'GORO' ? 'GORO ANTIGA' : item;
            const itemId = `${card.id}_${adjustedItemName.replace(/\s+/g, '_').toLowerCase()}`;
            html += `<div class="flex justify-between items-center">
                <span class="text-gray-700 font-medium text-lg">${adjustedItemName}</span>
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
    } else { 
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
function buildDailyReport() {
    reportLoader.style.display = 'flex';
    if(reportContainer) reportContainer.style.display = 'none';

    buildLancamentoReport();
    buildContagemReport();
    
    reportLoader.style.display = 'none';
}

function buildLancamentoReport() {
    const lancamentoData = {};
    let footerTotals = { lancamento_flex: 0, lancamento_coleta: 0, lancamento_total: 0 };
    
    for (const storeKey in storeConfig) {
        let flexTotal = 0;
        let coletaTotal = 0;
        timeSlots.flex.forEach(time => {
            const input = document.getElementById(`${storeKey}_flex_${time.id}`);
            if (input) flexTotal += parseInt(input.value) || 0;
        });
        timeSlots.coleta.forEach(time => {
            const input = document.getElementById(`${storeKey}_coleta_${time.id}`);
            if (input) coletaTotal += parseInt(input.value) || 0;
        });
        lancamentoData[storeKey] = { flex: flexTotal, coleta: coletaTotal, total: flexTotal + coletaTotal };
        
        footerTotals.lancamento_flex += flexTotal;
        footerTotals.lancamento_coleta += coletaTotal;
        footerTotals.lancamento_total += flexTotal + coletaTotal;
    }

    const reportTableBodyLancamento = document.getElementById('report-table-body');
    const reportTableFooterLancamento = document.getElementById('report-table-footer');
    if (!reportTableBodyLancamento || !reportTableFooterLancamento) return;

    let bodyHtml = '';
    for (const storeKey in storeConfig) {
        bodyHtml += `<tr class="text-center">
            <td class="px-4 py-3 text-left border-r font-medium">${storeConfig[storeKey].name}</td>
            <td class="px-4 py-3 border-r">${lancamentoData[storeKey].flex}</td>
            <td class="px-4 py-3 border-r">${lancamentoData[storeKey].coleta}</td>
            <td class="px-4 py-3 border-r font-bold">${lancamentoData[storeKey].total}</td>
        </tr>`;
    }
    reportTableBodyLancamento.innerHTML = bodyHtml;
    reportTableFooterLancamento.innerHTML = `<tr class="text-center font-bold">
        <td class="px-4 py-3 text-right uppercase">Total Geral</td>
        <td class="px-4 py-3">${footerTotals.lancamento_flex}</td>
        <td class="px-4 py-3">${footerTotals.lancamento_coleta}</td>
        <td class="px-4 py-3">${footerTotals.lancamento_total}</td>
    </tr>`;

    const summaryBody = document.getElementById('lancamento-summary-body');
    const summaryFooter = document.getElementById('lancamento-summary-footer');
    if (summaryBody && summaryFooter) {
        let summaryBodyHtml = '';
        for (const storeKey in storeConfig) {
            summaryBodyHtml += `
                <tr class="text-center">
                    <td class="px-4 py-3 text-left font-medium">${storeConfig[storeKey].name}</td>
                    <td class="px-4 py-3 text-lg font-semibold">${lancamentoData[storeKey].flex}</td>
                    <td class="px-4 py-3 text-lg font-semibold">${lancamentoData[storeKey].coleta}</td>
                </tr>
            `;
        }
        summaryBody.innerHTML = summaryBodyHtml;

        summaryFooter.innerHTML = `
            <tr class="text-center">
                <td class="px-4 py-3 text-right uppercase">Total Geral</td>
                <td class="px-4 py-3">${footerTotals.lancamento_flex}</td>
                <td class="px-4 py-3">${footerTotals.lancamento_coleta}</td>
            </tr>
        `;
    }

    const totalLancamento = footerTotals.lancamento_total || 0;
    let totalMlFull = 0;
    document.querySelectorAll('.ml-full-input').forEach(input => {
        totalMlFull += parseInt(input.value) || 0;
    });
    const totalGeralFaturado = totalLancamento + totalMlFull;
    const faturadosBody = document.getElementById('total-faturados-body');
    if (faturadosBody) {
        faturadosBody.innerHTML = `
            <tr>
                <td class="px-4 py-4 border-r">${totalLancamento}</td>
                <td class="px-4 py-4 border-r">${totalMlFull}</td>
                <td class="px-4 py-4 text-green-600">${totalGeralFaturado}</td>
            </tr>
        `;
    }
}

function buildContagemReport() {
    const contagemData = {};
    const allContagemItems = [...new Set(contagemConfig.flatMap(card => card.items))];
    
    allContagemItems.forEach(item => {
        const itemKey = item.replace(/\s+/g, '_').toLowerCase();
        contagemData[itemKey] = {};
        contagemConfig.forEach(card => {
            const itemId = `${card.id}_${itemKey}`;
            const countEl = document.querySelector(`.count-display[data-id="${itemId}"]`);
            contagemData[itemKey][card.id] = countEl ? parseInt(countEl.textContent) : 0;
        });
    });

    const headContagem = document.getElementById('report-contagem-head');
    const bodyContagem = document.getElementById('report-contagem-body');
    const footerContagem = document.getElementById('report-contagem-footer');
    if (!headContagem || !bodyContagem || !footerContagem) return;

    let headHtml = `<tr><th class="px-4 py-3 text-left">Loja/Item</th>`;
    contagemConfig.forEach(card => {
        headHtml += `<th class="px-4 py-3 text-center">${card.name}</th>`;
    });
    headHtml += `</tr>`;
    headContagem.innerHTML = headHtml;

    let bodyHtml = '';
    const footerTotals = {};
    contagemConfig.forEach(card => footerTotals[card.id] = 0);

    allContagemItems.forEach(item => {
        const itemKey = item.replace(/\s+/g, '_').toLowerCase();
        bodyHtml += `<tr class="text-center">
            <td class="px-4 py-3 text-left font-medium">${item}</td>`;
        contagemConfig.forEach(card => {
            const count = (contagemData[itemKey] && contagemData[itemKey][card.id]) ? contagemData[itemKey][card.id] : 0;
            bodyHtml += `<td class="px-4 py-3 border-l">${count}</td>`;
            footerTotals[card.id] += count;
        });
        bodyHtml += `</tr>`;
    });
    bodyContagem.innerHTML = bodyHtml;

    let footerHtml = `<tr class="text-center font-bold">
        <td class="px-4 py-3 text-right uppercase">Total Geral</td>`;
    contagemConfig.forEach(card => {
        footerHtml += `<td class="px-4 py-3 border-l">${footerTotals[card.id]}</td>`;
    });
    footerHtml += `</tr>`;
    footerContagem.innerHTML = footerHtml;
}

function buildReportByTime() {
    const headContainer = document.getElementById('report-by-time-head');
    const bodyContainer = document.getElementById('report-by-time-body');
    const footerContainer = document.getElementById('report-by-time-footer');
    if (!headContainer || !bodyContainer || !footerContainer) return;

    let headHtml = `<tr><th rowspan="2" class="px-6 py-3 text-left text-sm font-bold text-gray-700 uppercase tracking-wider border-r border-b align-middle">Loja</th><th colspan="${timeSlots.flex.length}" class="px-6 py-3 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-r border-b">Flex</th><th colspan="${timeSlots.coleta.length}" class="px-6 py-3 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-r border-b">Coleta</th><th rowspan="2" class="px-6 py-3 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-b align-middle">Total</th></tr><tr>`;
    timeSlots.flex.forEach(t => headHtml += `<th class="px-2 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider border-r border-b">${t.label}</th>`);
    timeSlots.coleta.forEach(t => headHtml += `<th class="px-2 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider border-r border-b">${t.label}</th>`);
    headContainer.innerHTML = headHtml + `</tr>`;

    let bodyHtml = '';
    const columnTotals = {};
    let grandTotal = 0;

    for (const storeKey in storeConfig) {
        const store = storeConfig[storeKey];
        let rowTotal = 0;
        bodyHtml += `<tr class="text-center"><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-left border-r">${store.name}</td>`;

        timeSlots.flex.forEach(time => {
            const inputId = `${storeKey}_flex_${time.id}`;
            const columnKey = `flex_${time.id}`;
            if (!columnTotals[columnKey]) columnTotals[columnKey] = 0;
            const input = document.getElementById(inputId);
            const value = (input && !input.disabled) ? parseInt(input.value) || 0 : 0;
            bodyHtml += `<td class="px-2 py-2 whitespace-nowrap border-r">${value}</td>`;
            rowTotal += value;
            columnTotals[columnKey] += value;
        });

        timeSlots.coleta.forEach(time => {
            const inputId = `${storeKey}_coleta_${time.id}`;
            const columnKey = `coleta_${time.id}`;
            if (!columnTotals[columnKey]) columnTotals[columnKey] = 0;
            const input = document.getElementById(inputId);
            const value = (input && !input.disabled) ? parseInt(input.value) || 0 : 0;
            bodyHtml += `<td class="px-2 py-2 whitespace-nowrap border-r">${value}</td>`;
            rowTotal += value;
            columnTotals[columnKey] += value;
        });

        bodyHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">${rowTotal}</td></tr>`;
        grandTotal += rowTotal;
    }
    bodyContainer.innerHTML = bodyHtml;

    let footerHtml = `<tr class="text-center font-bold"><td class="px-6 py-4 text-sm text-gray-900 uppercase text-right border-r">Total Geral</td>`;
    timeSlots.flex.forEach(time => footerHtml += `<td class="px-2 py-4 text-base text-gray-900 border-r">${columnTotals[`flex_${time.id}`] || 0}</td>`);
    timeSlots.coleta.forEach(time => footerHtml += `<td class="px-2 py-4 text-base text-gray-900 border-r">${columnTotals[`coleta_${time.id}`] || 0}</td>`);
    footerContainer.innerHTML = footerHtml + `<td class="px-6 py-4 text-base text-gray-900">${grandTotal}</td></tr>`;
}

// --- LÓGICA DE EXPORTAÇÃO ---
function exportReportsToExcel() {
    const tblLancamento = document.querySelector('#report-container table');
    const tblContagem = document.querySelector('#subview-relatorio-contagem table');
    const tblHorarios = document.querySelector('#report-by-time-container table');

    const wb = XLSX.utils.book_new();

    const wsLancamento = XLSX.utils.table_to_sheet(tblLancamento);
    XLSX.utils.book_append_sheet(wb, wsLancamento, "Relatório Diário");

    const wsContagem = XLSX.utils.table_to_sheet(tblContagem);
    XLSX.utils.book_append_sheet(wb, wsContagem, "Relatório Contagem");

    const wsHorarios = XLSX.utils.table_to_sheet(tblHorarios);
    XLSX.utils.book_append_sheet(wb, wsHorarios, "Relatório por Horários");

    const today = getFormattedDate();
    XLSX.writeFile(wb, `Relatorios_${today}.xlsx`);
}

exportExcelBtn.addEventListener('click', exportReportsToExcel);