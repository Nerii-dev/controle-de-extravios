// js/historico.js
import { db, ensureAuth, logoutUser, appId, showToast } from './firebase-init.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- ELEMENTOS DO DOM ---
const dateListContainer = document.getElementById('date-list-container');
const reportsPlaceholder = document.getElementById('reports-placeholder');
const reportsContent = document.getElementById('reports-content');
const exportExcelBtn = document.getElementById('export-excel-btn');

// --- VARIÁVEIS DE ESTADO ---
let userId;
let selectedHistoryDate = null;

// --- CONFIGURAÇÕES (copiadas de faturamento.js para consistência) ---
const timeSlots = { flex: [ { id: "0800", label: "08:00" }, { id: "1000", label: "10:00" }, { id: "1200", label: "12:00" }, { id: "1700", label: "Último Horário" } ], coleta: [ { id: "0800", label: "08:00" }, { id: "1000", label: "10:00" }, { id: "1200", label: "12:00" }, { id: "1700", label: "Último Horário" } ] };
const storeConfig = { 
    lljoy: { name: "LL JOY" }, goro_nova: { name: "GORO NOVA" }, yumi: { name: "YUMI" }, 
    imperio: { name: "IMPERIO" }, gomez: { name: "GOMEZ" }, goro_antiga:{ name: "GORO ANTIGA" }, 
    '7788': { name: "7788" }, la: { name: "LA" }, flexboys: { name: "FlexBoys" }, 
    frenet: { name: "Frenet" }, retirada: { name: "Retirada" }
};
const contagemConfig = [
    { id: 'contagem_flex', name: 'CONTAGEM FLEX', items: ['GORO NOVA', 'LL JOY', 'GORO ANTIGA', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO'] },
    { id: 'primeira_contagem', name: 'PRIMEIRA CONTAGEM', items: ['GORO NOVA', 'LL JOY', 'GORO ANTIGA', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO', 'RETIRADA', 'SHOPEE'] },
    { id: 'segunda_contagem_flex', name: 'SEGUNDA CONTAGEM FLEX', items: ['GORO NOVA', 'LL JOY', 'GORO ANTIGA', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO'] },
    { id: 'contagem_final', name: 'CONTAGEM FINAL', items: ['GORO NOVA', 'LL JOY', 'GORO ANTIGA', '7788', 'LA', 'GOMEZ', 'YUMI', 'IMPERIO', 'RETIRADA', 'SHOPEE'] }
];

// --- INICIALIZAÇÃO ---
ensureAuth(user => {
    userId = user.uid;
    document.getElementById('user-email-display').textContent = user.email;
    document.getElementById('logout-btn').addEventListener('click', logoutUser);
    exportExcelBtn.addEventListener('click', exportReportsToExcel);
    loadDateList();
});

// --- LÓGICA PRINCIPAL ---
async function loadDateList() {
    const historyCol = collection(db, `artifacts/${appId}/users/${userId}/daily_invoicing`);
    try {
        const snapshot = await getDocs(historyCol);
        const dates = snapshot.docs.map(doc => doc.id);

        if (dates.length === 0) {
            dateListContainer.innerHTML = '<p class="text-center text-gray-500">Nenhum histórico encontrado.</p>';
            return;
        }

        dates.sort((a, b) => b.localeCompare(a));

        let html = '';
        dates.forEach(dateStr => {
            const date = new Date(dateStr + 'T12:00:00');
            const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            html += `<div class="date-list-item p-3 rounded-md hover:bg-gray-100" data-date="${dateStr}">
                ${formattedDate}
            </div>`;
        });
        dateListContainer.innerHTML = html;

        document.querySelectorAll('.date-list-item').forEach(item => {
            item.addEventListener('click', handleDateClick);
        });

    } catch (error) {
        console.error("Erro ao carregar lista de datas:", error);
        dateListContainer.innerHTML = '<p class="text-center text-red-500">Erro ao carregar.</p>';
    }
}

async function handleDateClick(e) {
    const target = e.currentTarget;
    selectedHistoryDate = target.dataset.date;

    document.querySelectorAll('.date-list-item').forEach(item => item.classList.remove('active'));
    target.classList.add('active');

    reportsPlaceholder.style.display = 'none';
    reportsContent.innerHTML = '<div class="flex justify-center items-center py-20"><div class="loader"></div></div>';
    reportsContent.style.display = 'block';
    exportExcelBtn.style.display = 'block';

    await displayReportsForDate(selectedHistoryDate);
}

async function displayReportsForDate(dateString) {
    const basePath = `artifacts/${appId}/users/${userId}`;
    
    try {
        const lancamentoSnap = await getDoc(doc(db, `${basePath}/daily_invoicing`, dateString));
        const contagemSnap = await getDoc(doc(db, `${basePath}/daily_counts`, dateString));
        const mlFullSnap = await getDoc(doc(db, `${basePath}/daily_ml_full`, dateString));
        
        const lancamentoDataRaw = lancamentoSnap.exists() ? lancamentoSnap.data().counts : {};
        const contagemDataRaw = contagemSnap.exists() ? contagemSnap.data().counts : {};
        const mlFullDataRaw = mlFullSnap.exists() ? mlFullSnap.data().counts : {};

        reportsContent.innerHTML = generateReportsHtml(lancamentoDataRaw, contagemDataRaw, mlFullDataRaw);
    } catch (error) {
        console.error("Erro ao buscar dados do histórico:", error);
        reportsContent.innerHTML = '<p class="text-center text-red-500">Não foi possível carregar os dados para esta data.</p>';
    }
}

function generateReportsHtml(lancamentoDataRaw, contagemDataRaw, mlFullDataRaw) {
    // --- Cálculos ---
    // A. Lançamento
    const lancamentoTotals = {};
    let footerTotalsLancamento = { flex: 0, coleta: 0, total: 0 };
    for (const storeKey in storeConfig) {
        let flex = 0, coleta = 0;
        timeSlots.flex.forEach(t => flex += lancamentoDataRaw[`${storeKey}_flex_${t.id}`] || 0);
        timeSlots.coleta.forEach(t => coleta += lancamentoDataRaw[`${storeKey}_coleta_${t.id}`] || 0);
        lancamentoTotals[storeKey] = { flex, coleta, total: flex + coleta };
        footerTotalsLancamento.flex += flex;
        footerTotalsLancamento.coleta += coleta;
        footerTotalsLancamento.total += flex + coleta;
    }

    // B. Contagem
    const allContagemItems = [...new Set(contagemConfig.flatMap(card => card.items))];
    const footerTotalsContagem = {};
    contagemConfig.forEach(card => footerTotalsContagem[card.id] = 0);
    allContagemItems.forEach(item => {
        const itemKey = item.replace(/\s+/g, '_').toLowerCase();
        contagemConfig.forEach(card => {
            footerTotalsContagem[card.id] += contagemDataRaw[`${card.id}_${itemKey}`] || 0;
        });
    });

    // C. ML FULL
    let mlFullTotal = 0;
    for (const key in mlFullDataRaw) { mlFullTotal += mlFullDataRaw[key] || 0; }

    // D. Total Faturados
    const totalGeralFaturado = footerTotalsLancamento.total + mlFullTotal;

    // --- Template HTML ---
    return `
    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Relatório de Lançamentos</h2>
        <table id="table-lancamento" class="min-w-full border-collapse border">
            <thead class="bg-gray-100">
                <tr><th class="px-4 py-3 text-left border">Loja</th><th class="px-4 py-3 text-center border">Flex</th><th class="px-4 py-3 text-center border">Coleta</th><th class="px-4 py-3 text-center border">Total</th></tr>
            </thead>
            <tbody>
                ${Object.keys(storeConfig).map(key => `
                    <tr class="text-center"><td class="px-4 py-3 text-left border font-medium">${storeConfig[key].name}</td><td class="px-4 py-3 border">${lancamentoTotals[key].flex}</td><td class="px-4 py-3 border">${lancamentoTotals[key].coleta}</td><td class="px-4 py-3 border font-bold">${lancamentoTotals[key].total}</td></tr>
                `).join('')}
            </tbody>
            <tfoot class="bg-gray-200 font-bold">
                <tr class="text-center"><td class="px-4 py-3 text-right uppercase border">Total Geral</td><td class="px-4 py-3 border">${footerTotalsLancamento.flex}</td><td class="px-4 py-3 border">${footerTotalsLancamento.coleta}</td><td class="px-4 py-3 border">${footerTotalsLancamento.total}</td></tr>
            </tfoot>
        </table>

        <h3 class="text-xl font-bold text-gray-800 mb-4 mt-8">Resumo por Loja e Método</h3>
        <table id="table-resumo" class="min-w-full border-collapse border max-w-lg">
             <thead class="bg-gray-100">
                <tr><th class="px-4 py-3 text-left border">Loja</th><th class="px-4 py-3 text-center border">Flex</th><th class="px-4 py-3 text-center border">Coleta</th></tr>
            </thead>
            <tbody>
                ${Object.keys(storeConfig).map(key => `
                    <tr class="text-center"><td class="px-4 py-3 text-left font-medium">${storeConfig[key].name}</td><td class="px-4 py-3 border text-lg font-semibold">${lancamentoTotals[key].flex}</td><td class="px-4 py-3 border text-lg font-semibold">${lancamentoTotals[key].coleta}</td></tr>
                `).join('')}
            </tbody>
            <tfoot class="bg-gray-200 font-bold">
                <tr class="text-center"><td class="px-4 py-3 text-right uppercase border">Total Geral</td><td class="px-4 py-3 border">${footerTotalsLancamento.flex}</td><td class="px-4 py-3 border">${footerTotalsLancamento.coleta}</td></tr>
            </tfoot>
        </table>
        
        <h2 class="text-2xl font-bold text-gray-800 mb-4 mt-12">Total de Faturados</h2>
        <table id="table-faturado" class="min-w-full border-collapse border">
            <thead class="bg-gray-100">
                <tr class="text-center"><th class="px-4 py-3 border">Total Lançamento</th><th class="px-4 py-3 border">Total ML FULL</th><th class="px-4 py-3 border">Total Geral Faturado</th></tr>
            </thead>
            <tbody class="text-center text-2xl font-bold">
                <tr><td class="px-4 py-4 border">${footerTotalsLancamento.total}</td><td class="px-4 py-4 border">${mlFullTotal}</td><td class="px-4 py-4 border text-green-600">${totalGeralFaturado}</td></tr>
            </tbody>
        </table>
    </div>

    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Relatório de Contagens</h2>
        <table id="table-contagem" class="min-w-full border-collapse border">
            <thead class="bg-gray-100">
                <tr>
                    <th class="px-4 py-3 text-left border">Loja/Item</th>
                    ${contagemConfig.map(c => `<th class="px-4 py-3 text-center border">${c.name}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${allContagemItems.map(item => {
                    const itemKey = item.replace(/\s+/g, '_').toLowerCase();
                    return `
                        <tr class="text-center">
                            <td class="px-4 py-3 text-left font-medium border">${item}</td>
                            ${contagemConfig.map(card => `<td class="px-4 py-3 border">${contagemDataRaw[`${card.id}_${itemKey}`] || 0}</td>`).join('')}
                        </tr>
                    `;
                }).join('')}
            </tbody>
            <tfoot class="bg-gray-200 font-bold">
                <tr class="text-center">
                    <td class="px-4 py-3 text-right uppercase border">Total Geral</td>
                    ${contagemConfig.map(c => `<td class="px-4 py-3 border">${footerTotalsContagem[c.id]}</td>`).join('')}
                </tr>
            </tfoot>
        </table>
    </div>

    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Relatório por Horários</h2>
        <table id="table-horarios" class="min-w-full border-collapse border">
            <thead class="bg-gray-100">
                <tr><th rowspan="2" class="px-4 py-3 text-left align-middle border">Loja</th><th colspan="${timeSlots.flex.length}" class="px-4 py-3 text-center border">Flex</th><th colspan="${timeSlots.coleta.length}" class="px-4 py-3 text-center border">Coleta</th><th rowspan="2" class="px-4 py-3 text-center align-middle border">Total</th></tr>
                <tr>${timeSlots.flex.map(t => `<th class="px-2 py-3 text-center border">${t.label}</th>`).join('')}${timeSlots.coleta.map(t => `<th class="px-2 py-3 text-center border">${t.label}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${Object.keys(storeConfig).map(key => `
                    <tr class="text-center">
                        <td class="px-4 py-3 text-left font-medium border">${storeConfig[key].name}</td>
                        ${timeSlots.flex.map(t => `<td class="px-2 py-2 border">${lancamentoDataRaw[`${key}_flex_${t.id}`] || 0}</td>`).join('')}
                        ${timeSlots.coleta.map(t => `<td class="px-2 py-2 border">${lancamentoDataRaw[`${key}_coleta_${t.id}`] || 0}</td>`).join('')}
                        <td class="px-4 py-3 border font-bold">${lancamentoTotals[key].total}</td>
                    </tr>
                `).join('')}
            </tbody>
             <tfoot class="bg-gray-200 font-bold">
                 <tr class="text-center">
                    <td class="px-4 py-3 text-right uppercase border">Total Geral</td>
                    ${timeSlots.flex.map(t => `<td class="px-2 py-4 border">${Object.keys(storeConfig).reduce((acc, key) => acc + (lancamentoDataRaw[`${key}_flex_${t.id}`] || 0), 0)}</td>`).join('')}
                    ${timeSlots.coleta.map(t => `<td class="px-2 py-4 border">${Object.keys(storeConfig).reduce((acc, key) => acc + (lancamentoDataRaw[`${key}_coleta_${t.id}`] || 0), 0)}</td>`).join('')}
                    <td class="px-4 py-3 border">${footerTotalsLancamento.total}</td>
                </tr>
            </tfoot>
        </table>
    </div>
    `;
}

function exportReportsToExcel() {
    if (!selectedHistoryDate) {
        showToast("Por favor, selecione uma data primeiro.", "error");
        return;
    }

    const tblLancamento = document.getElementById('table-lancamento');
    const tblResumo = document.getElementById('table-resumo');
    const tblFaturado = document.getElementById('table-faturado');
    const tblContagem = document.getElementById('table-contagem');
    const tblHorarios = document.getElementById('table-horarios');

    const wb = XLSX.utils.book_new();

    if (tblLancamento) XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(tblLancamento), "Lançamentos");
    if (tblResumo) XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(tblResumo), "Resumo");
    if (tblFaturado) XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(tblFaturado), "Total Faturado");
    if (tblContagem) XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(tblContagem), "Contagem");
    if (tblHorarios) XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(tblHorarios), "Por Horários");

    XLSX.writeFile(wb, `Relatorios_${selectedHistoryDate}.xlsx`);
}