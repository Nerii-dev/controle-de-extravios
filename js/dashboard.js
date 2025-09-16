// js/dashboard.js
import { db, auth, ensureAuth, logoutUser, STORES, appId } from './firebase-init.js';
import { collection, onSnapshot, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let allItems = [];
let selectedStore = null;
let selectedStatus = null; 

// Variáveis para armazenar as instâncias dos gráficos
let statusChart = null;
let secondaryChart = null; // Renomeado de storeValueChart

ensureAuth(user => {
    document.getElementById('user-email-display').textContent = user.email;
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    const userId = user.uid;
    const itemsCollection = collection(db, `artifacts/${appId}/users/${userId}/lost_products`);
    
    onSnapshot(query(itemsCollection), (snapshot) => {
        allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDashboard(allItems);
    });
});

function showOrderDetails(order) {
    if(order && order.orderId) {
        window.location.href = `controle_extravios.html?orderId=${encodeURIComponent(order.orderId)}`;
    }
}

// --- Funções para criar/atualizar os gráficos ---

function createStatusChart(data) {
    const container = document.getElementById('status-chart-container');
    const ctx = document.getElementById('status-chart').getContext('2d');

    // MODIFICADO: Mensagem amigável se o container estiver vazio após o filtro
    if (data.length === 0) {
        container.innerHTML = '<canvas id="status-chart"></canvas><p class="text-center text-gray-500 py-4">Nenhum dado para exibir com os filtros atuais.</p>';
        if (statusChart) statusChart.destroy();
        return;
    } else {
        const p = container.querySelector('p');
        if (p) p.remove();
    }
    
    const statusCounts = { 'Em Análise': 0, 'Resolvido': 0, 'Contestado': 0 };
    data.forEach(item => {
        if (statusCounts[item.status] !== undefined) statusCounts[item.status]++;
    });

    if (statusChart) statusChart.destroy();

    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                label: 'Pedidos',
                data: Object.values(statusCounts),
                backgroundColor: ['#3b82f6', '#16a34a', '#f97316'],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });
}

function updateSecondaryChart(data, store) {
    const container = document.getElementById('store-value-chart-container');
    const titleElement = container.querySelector('h3');
    const ctx = document.getElementById('store-value-chart').getContext('2d');

    // MODIFICADO: Mensagem amigável se o container estiver vazio após o filtro
    if (data.length === 0) {
        container.innerHTML = '<canvas id="store-value-chart"></canvas><h3 class="text-xl font-bold mb-4">Valor Extraviado</h3><p class="text-center text-gray-500 py-4">Nenhum dado para exibir com os filtros atuais.</p>';
        if (secondaryChart) secondaryChart.destroy();
        return;
    } else {
         const p = container.querySelector('p');
        if (p) p.remove();
    }

    if (secondaryChart) secondaryChart.destroy();

    let chartData;
    let chartTitle;

    if (store && !selectedStatus) { // Modificado para não entrar em modo item se status estiver filtrado
        // --- MODO DETALHADO: Valor por Item da Loja Selecionada ---
        chartTitle = `Valor Extraviado por Item - ${store}`;
        const itemValues = new Map();

        data.forEach(order => {
            (order.items || []).forEach(item => {
                const currentTotal = itemValues.get(item.itemName) || 0;
                itemValues.set(item.itemName, currentTotal + item.value);
            });
        });
        
        const sortedItems = [...itemValues.entries()].sort((a, b) => b[1] - a[1]);

        chartData = {
            labels: sortedItems.map(item => item[0]),
            datasets: [{
                label: 'Valor Total Extraviado (R$)',
                data: sortedItems.map(item => item[1]),
                backgroundColor: '#16a34a',
                borderColor: '#15803d',
                borderWidth: 1
            }]
        };

    } else {
        // --- MODO GERAL: Valor por Loja ---
        chartTitle = selectedStatus 
            ? `Valor por Loja (Status: ${selectedStatus})`
            : 'Valor Extraviado por Loja';
        const storeValues = STORES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
        data.forEach(item => {
            if (storeValues[item.store] !== undefined) storeValues[item.store] += item.totalValue || 0;
        });

        chartData = {
            labels: Object.keys(storeValues),
            datasets: [{
                label: 'Valor Total Extraviado (R$)',
                data: Object.values(storeValues),
                backgroundColor: '#3b82f6',
                borderColor: '#2563eb',
                borderWidth: 1
            }]
        };
    }

    titleElement.textContent = chartTitle;
    secondaryChart = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });
}


// --- Função Principal que Renderiza a Dashboard ---

function updateDashboard(lostItems) {
    // --- PARTE 1: Filtros e preparação de dados ---
    const dataForStoreFilter = selectedStore
        ? lostItems.filter(item => item.store === selectedStore)
        : lostItems;
    
    // MODIFICAÇÃO: Aplica o filtro de status para os gráficos e listas
    const dataForChartsAndLists = selectedStatus
        ? dataForStoreFilter.filter(item => item.status === selectedStatus)
        : dataForStoreFilter;

    // --- PARTE 2: Renderização dos Componentes ---
    
    // Cards de Resumo (sempre refletem o filtro de loja, mas não o de status)
    const totalValue = dataForStoreFilter.reduce((acc, item) => acc + (item.totalValue || 0), 0);
    const reimbursedValue = dataForStoreFilter
        .filter(item => item.status === 'Resolvido')
        .reduce((acc, item) => acc + (item.totalValue || 0), 0);
    const balance = reimbursedValue - totalValue;

    document.getElementById('total-value').textContent = `R$ ${totalValue.toFixed(2).replace('.', ',')}`;
    document.getElementById('total-reimbursed').textContent = `R$ ${reimbursedValue.toFixed(2).replace('.', ',')}`;
    
    const balanceEl = document.getElementById('total-balance');
    balanceEl.textContent = `R$ ${balance.toFixed(2).replace('.', ',')}`;
    balanceEl.classList.toggle('text-red-600', balance < 0);
    balanceEl.classList.toggle('text-green-600', balance >= 0);

    document.getElementById('status-analysis').textContent = dataForStoreFilter.filter(item => item.status === 'Em Análise').length;
    document.getElementById('status-resolved').textContent = dataForStoreFilter.filter(item => item.status === 'Resolvido').length;
    document.getElementById('status-contested').textContent = dataForStoreFilter.filter(item => item.status === 'Contestado').length;
    
    // Gráficos (agora usam os dados com filtro de status aplicado)
    createStatusChart(dataForChartsAndLists);
    updateSecondaryChart(dataForChartsAndLists, selectedStore);

    // Filtros de Loja (a lógica de contagem não muda)
    const storeSummaryContainer = document.getElementById('store-summary');
    storeSummaryContainer.innerHTML = '';
    const storeCounts = STORES.reduce((acc, store) => ({ ...acc, [store]: 0 }), {});
    lostItems.forEach(item => { if (storeCounts[item.store] !== undefined) storeCounts[item.store]++; });
    
    for (const store in storeCounts) {
        const isSelected = store === selectedStore;
        const selectedClass = isSelected ? 'border-blue-600 border-2' : 'border-transparent';
        storeSummaryContainer.innerHTML += `
            <div class="store-card bg-gray-50 p-3 rounded-md cursor-pointer border ${selectedClass} transition-all" data-store="${store}">
                <p class="font-medium text-gray-800 pointer-events-none">${store}</p>
                <p class="text-xl font-bold text-blue-600 pointer-events-none">${storeCounts[store]}</p>
            </div>`;
    }

    document.querySelectorAll('.store-card').forEach(card => {
        card.addEventListener('click', () => {
            const store = card.dataset.store;
            selectedStore = (selectedStore === store) ? null : store;
            updateDashboard(allItems);
        });
    });
    
    // Filtros de Status (a lógica de criação não muda)
    const statuses = ['Em Análise', 'Resolvido', 'Contestado'];
    const statusFiltersContainer = document.getElementById('status-filters-container');
    statusFiltersContainer.innerHTML = `<button class="status-filter-btn px-3 py-1 text-sm rounded-full ${!selectedStatus ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}" data-status="all">Todos</button>`;
    statuses.forEach(status => {
        statusFiltersContainer.innerHTML += `<button class="status-filter-btn px-3 py-1 text-sm rounded-full ${status === selectedStatus ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}" data-status="${status}">${status}</button>`;
    });

    document.querySelectorAll('.status-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            selectedStatus = (status === 'all') ? null : status;
            updateDashboard(allItems);
        });
    });

    // --- PARTE 3: Listas Detalhadas (agora usam os dados com filtro de status aplicado) ---
    const dataForLists = dataForChartsAndLists;

    // Lista de Prazos
    const upcomingDeadlinesContainer = document.getElementById('upcoming-deadlines-list');
    upcomingDeadlinesContainer.innerHTML = '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingOrders = dataForLists
        .filter(order => order.status === 'Em Análise')
        .map(order => {
            const claimDate = new Date(order.date + 'T00:00:00');
            const diffTime = claimDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return { ...order, diffDays };
        })
        .sort((a, b) => a.diffDays - b.diffDays);

    if (upcomingOrders.length === 0) {
        upcomingDeadlinesContainer.innerHTML = `<p class="text-center text-gray-500 py-4">Nenhuma reclamação encontrada.</p>`;
    } else {
         upcomingOrders.slice(0, 5).forEach(order => {
            let urgencyColorClass = 'text-gray-700';
            let daysText = `${order.diffDays} dias`;

            if (order.diffDays < 0) {
                urgencyColorClass = 'text-red-700 font-bold';
                daysText = `Vencido há ${Math.abs(order.diffDays)} dias`;
            } else if (order.diffDays === 0) {
                urgencyColorClass = 'text-red-600 animate-pulse font-bold';
                daysText = 'Hoje';
            } else if (order.diffDays === 1) {
                urgencyColorClass = 'text-yellow-600 font-bold';
                daysText = 'Amanhã';
            } else if (order.diffDays <= 7) {
                urgencyColorClass = 'text-yellow-600';
            }

            const formattedDate = new Date(order.date + 'T00:00:00').toLocaleDateString('pt-BR');
            const orderHtml = `<div class="border-t first:border-t-0 py-3"><div class="flex justify-between items-center"><div><p class="font-semibold text-blue-600 hover:underline cursor-pointer view-details-btn-deadline" data-order-id="${order.id}">${order.orderId}</p><p class="text-sm text-gray-500">${order.store} &bull; Prazo: ${formattedDate}</p></div><div class="text-right flex-shrink-0 ml-4"><p class="text-lg ${urgencyColorClass}">${daysText}</p></div></div></div>`;
            upcomingDeadlinesContainer.innerHTML += orderHtml;
        });
    }
    
    // Lista de Reembolsos
    const reimbursementsContainer = document.getElementById('reimbursements-requested-list');
    reimbursementsContainer.innerHTML = '';
    
    const requestedOrders = dataForLists
        .filter(order => order.status === 'Resolvido' || order.status === 'Contestado')
        .sort((a, b) => new Date(b.requestDate || 0) - new Date(a.requestDate || 0));

    if (requestedOrders.length === 0) {
        reimbursementsContainer.innerHTML = `<p class="text-center text-gray-500 py-4">Nenhum reembolso encontrado.</p>`;
    } else {
        requestedOrders.slice(0, 5).forEach(order => {
            const isResolved = order.status === 'Resolvido';
            const statusClass = isResolved ? 'text-green-600 bg-green-100' : 'text-orange-600 bg-orange-100';
            const verificationDate = order.requestDate ? new Date(order.requestDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A';
            const orderHtml = `<div class="border-t first:border-t-0 py-3"><div class="flex justify-between items-center"><div><p class="font-semibold text-blue-600 hover:underline cursor-pointer view-details-btn-reimbursement" data-order-id="${order.id}">${order.orderId}</p><p class="text-sm text-gray-500">${order.store} &bull; Verificado em: ${verificationDate}</p></div><div class="text-right flex-shrink-0 ml-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${order.status}</span></div></div></div>`;
            reimbursementsContainer.innerHTML += orderHtml;
        });
    }

    document.querySelectorAll('.view-details-btn-deadline, .view-details-btn-reimbursement').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const orderId = e.target.dataset.orderId;
            const order = allItems.find(o => o.id === orderId);
            if(order) showOrderDetails(order);
        });
    });
}