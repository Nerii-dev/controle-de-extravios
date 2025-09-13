// js/controle.js
import { db, ensureAuth, logoutUser, showToast, formatCurrency, parseCurrency, STORES, appId } from './firebase-init.js';
import { collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- ELEMENTOS DO DOM ---
const controlView = document.getElementById('control-view');
const orderDetailsView = document.getElementById('order-details-view');
const addItemForm = document.getElementById('add-item-form');
const itemsTableBody = document.getElementById('items-table-body');
const itemsTableFooter = document.getElementById('items-table-footer');
const filterStore = document.getElementById('filter-store');
const filterOrder = document.getElementById('filter-order');
const storeSelect = document.getElementById('store-select');
const loader = document.getElementById('loader-container');
const tableContainer = document.getElementById('table-container');

// Modais
const editModal = document.getElementById('edit-modal');
const editItemForm = document.getElementById('edit-item-form');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const editStoreSelect = document.getElementById('edit-store-select');
const confirmModal = document.getElementById('confirm-modal');
const cancelConfirmBtn = document.getElementById('cancel-confirm-btn');
const confirmActionBtn = document.getElementById('confirm-action-btn');

// Detalhes do Pedido
const backToListBtn = document.getElementById('back-to-list-btn');
const filterItemSku = document.getElementById('filter-item-sku');
const filterItemName = document.getElementById('filter-item-name');

// --- VARIÁVEIS DE ESTADO ---
let lostItems = [];
let currentOrder = null;
let itemsCollection;
let userId;

// --- INICIALIZAÇÃO ---
ensureAuth(user => {
    userId = user.uid;
    document.getElementById('user-email-display').textContent = user.email;
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    itemsCollection = collection(db, `artifacts/${appId}/users/${userId}/lost_products`);
    
    populateStoreSelects();
    setupEventListeners();
    createItemInputRow(document.getElementById('items-container')); 
    setupRealtimeListener();
});

function populateStoreSelects() {
    const optionsHtml = STORES.map(store => `<option value="${store}">${store}</option>`).join('');
    storeSelect.innerHTML = optionsHtml;
    editStoreSelect.innerHTML = optionsHtml;
    filterStore.innerHTML = `<option value="all">Todas as Lojas</option>${optionsHtml}`;
}

function setupEventListeners() {
    addItemForm.addEventListener('submit', handleAddItem);
    editItemForm.addEventListener('submit', handleEditItem);
    cancelEditBtn.addEventListener('click', closeEditModal);
    
    document.getElementById('add-item-btn').addEventListener('click', () => createItemInputRow(document.getElementById('items-container')));
    document.getElementById('edit-add-item-btn').addEventListener('click', () => createItemInputRow(document.getElementById('edit-items-container')));

    cancelConfirmBtn.addEventListener('click', closeConfirmModal);
    filterStore.addEventListener('change', renderFilteredItems);
    filterOrder.addEventListener('input', renderFilteredItems);
    
    backToListBtn.addEventListener('click', () => navigateTo('control'));
    filterItemSku.addEventListener('input', renderOrderDetails);
    filterItemName.addEventListener('input', renderOrderDetails);
}


// --- LÓGICA DE NAVEGAÇÃO INTERNA DA PÁGINA ---
function navigateTo(viewName) {
    if (viewName === 'control') {
        orderDetailsView.style.display = 'none';
        controlView.style.display = 'block';
        window.history.pushState({}, document.title, window.location.pathname);
    } else if (viewName === 'order-details') {
        controlView.style.display = 'none';
        orderDetailsView.style.display = 'block';
        renderOrderDetails();
    }
}

function showOrderDetails(order) {
    currentOrder = order;
    navigateTo('order-details');
}


// --- LÓGICA DE DADOS (FIRESTORE) ---
async function handleAddItem(e) {
    e.preventDefault();
    const itemRows = document.querySelectorAll('#items-container .item-row');
    if (itemRows.length === 0) { return showToast("Adicione pelo menos um item ao pedido.", "error"); }
    const items = [];
    let totalValue = 0;
    for (const row of itemRows) {
        const sku = row.querySelector('.item-sku-input').value;
        const itemName = row.querySelector('.item-name-input').value;
        const itemValue = parseCurrency(row.querySelector('.item-value-input').value);
        if (sku && itemName && itemValue > 0) {
            items.push({ sku, itemName, value: itemValue });
            totalValue += itemValue;
        }
    }
    if (items.length === 0) { return showToast("Preencha as informações dos itens corretamente (SKU, Nome e Valor).", "error"); }
    
    const formData = new FormData(addItemForm);
    const newOrder = {
        store: formData.get('store'),
        orderId: formData.get('orderId'),
        date: formData.get('date'),
        requestDate: formData.get('requestDate'),
        status: formData.get('status'),
        items, totalValue, createdAt: new Date()
    };
    try {
        await addDoc(itemsCollection, newOrder);
        showToast("Pedido adicionado com sucesso!");
        addItemForm.reset();
        const container = document.getElementById('items-container');
        container.innerHTML = '';
        createItemInputRow(container);
    } catch (error) {
        console.error("Erro ao adicionar pedido: ", error);
        showToast("Erro ao salvar o pedido.", "error");
    }
}

async function handleEditItem(e) {
    e.preventDefault();
    const id = document.getElementById('edit-item-id').value;
    const itemRows = document.querySelectorAll('#edit-items-container .item-row');
    if (itemRows.length === 0) { return showToast("O pedido deve ter pelo menos um item.", "error"); }
    
    const items = [];
    let totalValue = 0;
    for(const row of itemRows) {
        const sku = row.querySelector('.item-sku-input').value;
        const itemName = row.querySelector('.item-name-input').value;
        const itemValue = parseCurrency(row.querySelector('.item-value-input').value);
        if (sku && itemName && itemValue >= 0) {
            items.push({ sku, itemName, value: itemValue });
            totalValue += itemValue;
        }
    }
    if (items.length === 0) { return showToast("Preencha as informações dos itens corretamente.", "error"); }

    const updatedData = {
        store: document.getElementById('edit-store-select').value,
        orderId: document.getElementById('edit-order-id').value,
        date: document.getElementById('edit-loss-date').value,
        requestDate: document.getElementById('edit-request-date').value,
        items, totalValue
    };

    // MODIFICAÇÃO: Adicionando o modal de confirmação antes de salvar
    showConfirmModal(
        'Confirmar Alterações',
        'Você tem certeza que deseja salvar as alterações neste pedido?',
        async () => { // A lógica de salvar agora está dentro do callback de confirmação
            try {
                await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/lost_products`, id), updatedData);
                showToast("Pedido atualizado com sucesso!");
                closeEditModal();
            } catch (error) {
                console.error("Erro ao atualizar pedido:", error);
                showToast("Erro ao atualizar o pedido.", "error");
            }
        }
    );
}

function setupRealtimeListener() {
    onSnapshot(query(itemsCollection), (snapshot) => {
        lostItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        lostItems.sort((a, b) => new Date(b.date) - new Date(a.date));
        loader.style.display = 'none';
        tableContainer.style.display = 'block';
        renderFilteredItems();

        const urlParams = new URLSearchParams(window.location.search);
        const orderIdFromUrl = urlParams.get('orderId');
        if (orderIdFromUrl) {
            const orderToShow = lostItems.find(o => o.orderId === orderIdFromUrl);
            if (orderToShow) {
                showOrderDetails(orderToShow);
            }
        }
    }, (error) => {
        console.error("Erro ao ouvir atualizações: ", error);
        showToast("Erro de conexão em tempo real.", "error");
    });
}

async function deleteItem(id) {
    showConfirmModal('Excluir Pedido', 'Tem certeza que deseja excluir este pedido e todos os seus itens?', async () => {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/lost_products`, id));
            showToast("Pedido excluído com sucesso!");
        } catch (error) {
            console.error("Erro ao deletar pedido:", error);
            showToast("Não foi possível excluir o pedido.", "error");
        }
    });
}

async function updateStatus(id, newStatus) {
     try {
        await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/lost_products`, id), { status: newStatus });
        showToast("Status atualizado.");
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        showToast("Erro ao mudar o status.", "error");
    }
}


// --- LÓGICA DE UI E MODAIS ---
function openEditModal(order) {
    document.getElementById('edit-item-id').value = order.id;
    document.getElementById('edit-order-id').value = order.orderId;
    document.getElementById('edit-loss-date').value = order.date;
    document.getElementById('edit-request-date').value = order.requestDate || '';
    editStoreSelect.value = order.store;
    
    const container = document.getElementById('edit-items-container');
    container.innerHTML = '';
    (order.items || []).forEach(item => createItemInputRow(container, item));
    
    editModal.classList.add('visible');
}

function closeEditModal() { editModal.classList.remove('visible'); }

function showConfirmModal(title, text, onConfirm) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-text').textContent = text;
    confirmActionBtn.onclick = () => { onConfirm(); closeConfirmModal(); };
    confirmModal.classList.add('visible');
}

function closeConfirmModal() { confirmModal.classList.remove('visible'); }

function createItemInputRow(container, item = { sku: '', itemName: '', value: 0 }) {
    const itemRow = document.createElement('div');
    itemRow.className = 'grid grid-cols-1 sm:grid-cols-12 gap-3 items-center item-row';
    const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value || 0);

    itemRow.innerHTML = `
        <div class="sm:col-span-3">
            <label class="text-xs text-gray-600 hidden sm:block">SKU</label>
            <input type="text" class="item-sku-input mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required value="${item.sku}" placeholder="SKU do Produto">
        </div>
        <div class="sm:col-span-5">
            <label class="text-xs text-gray-600 hidden sm:block">Nome do Item</label>
            <input type="text" class="item-name-input mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required value="${item.itemName}" placeholder="Nome do Item">
        </div>
        <div class="sm:col-span-3">
            <label class="text-xs text-gray-600 hidden sm:block">Valor</label>
            <input type="text" inputmode="decimal" class="item-value-input mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required value="${formattedValue}" placeholder="R$ 0,00">
        </div>
        <div class="sm:col-span-1 flex items-end h-full">
            <button type="button" class="remove-item-btn w-full h-10 bg-red-100 text-red-600 rounded-md flex items-center justify-center hover:bg-red-200 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>`;
    container.appendChild(itemRow);
    itemRow.querySelector('.item-value-input').addEventListener('input', formatCurrency);
    itemRow.querySelector('.remove-item-btn').addEventListener('click', () => itemRow.remove());
}


// --- LÓGICA DE RENDERIZAÇÃO ---
function renderFilteredItems() {
    const storeFilter = filterStore.value;
    const orderFilter = filterOrder.value.toLowerCase();
    const filtered = lostItems.filter(order => 
        (storeFilter === 'all' || order.store === storeFilter) &&
        (!orderFilter || order.orderId.toLowerCase().includes(orderFilter))
    );
    renderTable(filtered);
}

function renderTable(orders) {
    itemsTableBody.innerHTML = '';
    if (orders.length === 0) {
        itemsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">Nenhum pedido encontrado.</td></tr>`;
        itemsTableFooter.innerHTML = '';
        return;
    }

    orders.forEach(order => {
        const tr = document.createElement('tr');
        tr.className = "order-row";
        const detailsTr = document.createElement('tr');
        detailsTr.className = "details-row hidden";
        detailsTr.innerHTML = `<td colspan="7" class="p-0 bg-gray-50/70"></td>`;
        
        tr.innerHTML = `
            <td class="pl-4 pr-2 py-4 whitespace-nowrap cursor-pointer">
                <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${order.store}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:underline cursor-pointer font-semibold view-details-btn">${order.orderId}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-semibold">R$ ${(order.totalValue || 0).toFixed(2).replace('.', ',')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(order.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <select data-id="${order.id}" class="status-dropdown rounded-md border-gray-300 shadow-sm focus:ring-0 focus:border-gray-400">
                    <option value="Em Análise" ${order.status === 'Em Análise' ? 'selected' : ''}>Em Análise</option>
                    <option value="Resolvido" ${order.status === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
                    <option value="Contestado" ${order.status === 'Contestado' ? 'selected' : ''}>Contestado</option>
                </select>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="edit-btn text-blue-600 hover:text-blue-900 font-semibold">Editar</button>
                <button class="delete-btn text-red-600 hover:text-red-900 ml-4 font-semibold">Excluir</button>
            </td>`;
        
        const detailsContainer = detailsTr.querySelector('td');
        let itemsHtml = `<div class="p-4"><h4 class="font-semibold text-gray-700 mb-2">Itens do Pedido:</h4><ul class="list-disc pl-6 space-y-1 text-sm">`;
        (order.items || []).forEach(item => {
            itemsHtml += `<li class="flex justify-between text-gray-600">
                <span><span class="font-semibold text-gray-800">${item.sku}</span> - ${item.itemName}</span>
                <span class="font-medium text-gray-800">R$ ${(item.value || 0).toFixed(2).replace('.', ',')}</span>
            </li>`;
        });
        itemsHtml += '</ul></div>';
        detailsContainer.innerHTML = itemsHtml;
        
        itemsTableBody.appendChild(tr);
        itemsTableBody.appendChild(detailsTr);
        
        const toggleDetails = () => {
            detailsTr.classList.toggle('hidden');
            tr.querySelector('svg').classList.toggle('rotate-90');
        };
        
        tr.querySelector('td:first-child').addEventListener('click', toggleDetails);
        tr.querySelector('.view-details-btn').addEventListener('click', () => showOrderDetails(order));
        tr.querySelector('.edit-btn').addEventListener('click', () => openEditModal(order));
        tr.querySelector('.delete-btn').addEventListener('click', () => deleteItem(order.id));
        tr.querySelector('.status-dropdown').addEventListener('change', (e) => updateStatus(order.id, e.target.value));
    });
    
    const filteredTotal = orders.reduce((sum, order) => sum + (order.totalValue || 0), 0);
    itemsTableFooter.innerHTML = `
        <tr>
            <td class="px-6 py-4" colspan="3">Total na Consulta:</td>
            <td class="px-6 py-4 font-semibold">R$ ${filteredTotal.toFixed(2).replace('.', ',')}</td>
            <td class="px-6 py-4" colspan="3"></td>
        </tr>`;
}

function renderOrderDetails() {
    if (!currentOrder) return;
    
    document.getElementById('details-order-id').textContent = currentOrder.orderId;
    const infoContainer = document.getElementById('details-order-info');
    infoContainer.innerHTML = `
        <div><h4 class="text-sm text-gray-500">Loja</h4><p class="font-semibold text-base">${currentOrder.store}</p></div>
        <div><h4 class="text-sm text-gray-500">Data para Abrir Reclamação</h4><p class="font-semibold text-base">${new Date(currentOrder.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p></div>
        <div><h4 class="text-sm text-gray-500">Data da Verificação</h4><p class="font-semibold text-base">${currentOrder.requestDate ? new Date(currentOrder.requestDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</p></div>
        <div><h4 class="text-sm text-gray-500">Status</h4><p class="font-semibold text-base">${currentOrder.status}</p></div>
        <div><h4 class="text-sm text-gray-500">Valor Total</h4><p class="font-semibold text-base">R$ ${(currentOrder.totalValue || 0).toFixed(2).replace('.', ',')}</p></div>
    `;
    
    const skuFilter = filterItemSku.value.toLowerCase();
    const nameFilter = filterItemName.value.toLowerCase();
    
    const filteredItems = (currentOrder.items || []).filter(item => 
        (!skuFilter || item.sku.toLowerCase().includes(skuFilter)) &&
        (!nameFilter || item.itemName.toLowerCase().includes(nameFilter))
    );
    
    const tableBody = document.getElementById('order-details-table-body');
    tableBody.innerHTML = '';
    if (filteredItems.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-500">Nenhum item encontrado com os filtros aplicados.</td></tr>`;
        return;
    }
    filteredItems.forEach(item => {
        tableBody.innerHTML += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.sku}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${item.itemName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">R$ ${(item.value || 0).toFixed(2).replace('.', ',')}</td>
            </tr>
        `;
    });
}