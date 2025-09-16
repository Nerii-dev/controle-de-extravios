// js/automations.js
import { db, ensureAuth, logoutUser, showToast, formatCurrency, parseCurrency, STORES, appId } from './firebase-init.js';
import { collection, addDoc, onSnapshot, query, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- ELEMENTOS DO DOM ---
const addOrderForm = document.getElementById('add-order-form');
const itemsTableBody = document.getElementById('items-table-body');
const itemsTableFooter = document.getElementById('items-table-footer');
const storeSelect = document.getElementById('store-select');
const loader = document.getElementById('loader-container');
const tableContainer = document.getElementById('table-container');

// Filtros
const filterStore = document.getElementById('filter-store');
const filterOrder = document.getElementById('filter-order');
const filterStatus = document.getElementById('filter-status');

// Modal de Confirmação
const confirmModal = document.getElementById('confirm-modal');
const cancelConfirmBtn = document.getElementById('cancel-confirm-btn');
const confirmActionBtn = document.getElementById('confirm-action-btn');

// --- VARIÁVEIS DE ESTADO ---
let allOrders = [];
let ordersCollection;
let userId;

// --- INICIALIZAÇÃO ---
ensureAuth(user => {
    userId = user.uid;
    document.getElementById('user-email-display').textContent = user.email;
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    ordersCollection = collection(db, `artifacts/${appId}/users/${userId}/automated_orders`);
    
    populateStoreSelects();
    setupEventListeners();
    createItemInputRow(document.getElementById('items-container')); 
    setupRealtimeListener();
});

function populateStoreSelects() {
    const optionsHtml = STORES.map(store => `<option value="${store}">${store}</option>`).join('');
    storeSelect.innerHTML = `<option value="">Selecione a Loja</option>${optionsHtml}`;
    filterStore.innerHTML = `<option value="all">Todas as Lojas</option>${optionsHtml}`;
}

function setupEventListeners() {
    addOrderForm.addEventListener('submit', handleAddOrder);
    document.getElementById('add-item-btn').addEventListener('click', () => createItemInputRow(document.getElementById('items-container')));
    
    filterStore.addEventListener('change', renderFilteredItems);
    filterOrder.addEventListener('input', renderFilteredItems);
    filterStatus.addEventListener('change', renderFilteredItems);

    cancelConfirmBtn.addEventListener('click', () => confirmModal.classList.remove('visible'));
}

// --- LÓGICA DE DADOS (FIRESTORE) ---
async function handleAddOrder(e) {
    e.preventDefault();
    const formData = new FormData(addOrderForm);
    const itemRows = document.querySelectorAll('#items-container .item-row');
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
    if (items.length === 0) { return showToast("Adicione pelo menos um item válido ao pedido.", "error"); }

    const newOrder = {
        store: formData.get('store'),
        orderId: formData.get('orderId'),
        status: formData.get('status'),
        shippingDate: formData.get('shippingDate'),
        items, totalValue, createdAt: new Date()
    };

    try {
        await addDoc(ordersCollection, newOrder);
        showToast("Pedido adicionado com sucesso!");
        addOrderForm.reset();
        const container = document.getElementById('items-container');
        container.innerHTML = '';
        createItemInputRow(container);
    } catch (error) {
        console.error("Erro ao adicionar pedido: ", error);
        showToast("Erro ao salvar o pedido.", "error");
    }
}

function setupRealtimeListener() {
    onSnapshot(query(ordersCollection), (snapshot) => {
        allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allOrders.sort((a, b) => new Date(b.shippingDate) - new Date(a.shippingDate));
        
        // CORREÇÃO: A população do filtro de status foi movida para fora do loop em tempo real.
        // A função abaixo agora apenas atualiza a lista de status, se necessário.
        updateStatusFilterIfNeeded(allOrders); 
        
        renderFilteredItems();

        loader.style.display = 'none';
        tableContainer.style.display = 'block';
    }, (error) => {
        console.error("Erro ao ouvir atualizações: ", error);
        loader.style.display = 'none';
        showToast("Erro de conexão em tempo real.", "error");
    });
}

function deleteOrder(id) {
    document.getElementById('confirm-modal-title').textContent = 'Excluir Pedido';
    document.getElementById('confirm-modal-text').textContent = 'Tem certeza que deseja excluir este pedido e todos os seus itens? Esta ação não pode ser desfeita.';
    confirmActionBtn.onclick = async () => {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/automated_orders`, id));
            showToast("Pedido excluído com sucesso!");
        } catch (error) {
            console.error("Erro ao deletar pedido:", error);
            showToast("Não foi possível excluir o pedido.", "error");
        }
        confirmModal.classList.remove('visible');
    };
    confirmModal.classList.add('visible');
}

// --- LÓGICA DE UI E RENDERIZAÇÃO ---
function createItemInputRow(container) {
    const itemRow = document.createElement('div');
    itemRow.className = 'grid grid-cols-1 sm:grid-cols-11 gap-3 items-center item-row';
    itemRow.innerHTML = `
        <input type="text" class="sm:col-span-3 item-sku-input border p-2 rounded" placeholder="SKU do Produto" required>
        <input type="text" class="sm:col-span-4 item-name-input border p-2 rounded" placeholder="Nome do Item" required>
        <input type="text" inputmode="decimal" class="sm:col-span-3 item-value-input border p-2 rounded" placeholder="Valor (R$)" required>
        <button type="button" class="sm:col-span-1 remove-item-btn h-10 bg-red-100 text-red-600 rounded flex items-center justify-center hover:bg-red-200">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>`;
    container.appendChild(itemRow);
    itemRow.querySelector('.item-value-input').addEventListener('input', formatCurrency);
    itemRow.querySelector('.remove-item-btn').addEventListener('click', () => itemRow.remove());
}

// MELHORIA: Esta função agora verifica se precisa atualizar o filtro
// antes de reconstruí-lo, evitando o loop de renderização.
function updateStatusFilterIfNeeded(orders) {
    const currentOptions = Array.from(filterStatus.options).map(opt => opt.value);
    const newStatuses = [...new Set(orders.map(o => o.status))];
    
    // Compara se os status existentes são os mesmos que os novos
    const statusesChanged = currentOptions.length - 1 !== newStatuses.length || newStatuses.some(s => !currentOptions.includes(s));

    if (statusesChanged) {
        const currentValue = filterStatus.value;
        filterStatus.innerHTML = `<option value="all">Todos os Status</option>` + newStatuses.map(s => `<option value="${s}">${s}</option>`).join('');
        filterStatus.value = currentValue; // Mantém o filtro selecionado se ainda existir
    }
}


function renderFilteredItems() {
    const storeF = filterStore.value;
    const orderF = filterOrder.value.toLowerCase();
    const statusF = filterStatus.value;
    const filtered = allOrders.filter(order => 
        (storeF === 'all' || order.store === storeF) &&
        (statusF === 'all' || order.status === statusF) &&
        (!orderF || order.orderId.toLowerCase().includes(orderF))
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
            <td class="px-6 py-4 font-medium text-gray-900">${order.orderId}</td>
            <td class="px-6 py-4">${order.store}</td>
            <td class="px-6 py-4 font-semibold">R$ ${(order.totalValue || 0).toFixed(2).replace('.', ',')}</td>
            <td class="px-6 py-4">${order.status}</td>
            <td class="px-6 py-4 text-gray-500">${new Date(order.shippingDate + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td class="px-6 py-4 text-right">
                <button data-id="${order.id}" class="delete-btn text-red-600 hover:text-red-900 font-semibold">Excluir</button>
            </td>`;
        
        const detailsContainer = detailsTr.querySelector('td');
        let itemsHtml = `<div class="p-4"><h4 class="font-semibold text-gray-700 mb-2">Itens do Pedido:</h4><ul class="list-disc pl-6 space-y-1 text-sm">`;
        (order.items || []).forEach(item => {
            itemsHtml += `<li><span class="font-semibold">${item.sku}</span> - ${item.itemName} (R$ ${(item.value || 0).toFixed(2).replace('.', ',')})</li>`;
        });
        itemsHtml += '</ul></div>';
        detailsContainer.innerHTML = itemsHtml;
        
        itemsTableBody.appendChild(tr);
        itemsTableBody.appendChild(detailsTr);
        
        tr.querySelector('td:first-child').addEventListener('click', () => {
            detailsTr.classList.toggle('hidden');
            tr.querySelector('svg').classList.toggle('rotate-90');
        });
        tr.querySelector('.delete-btn').addEventListener('click', (e) => deleteOrder(e.target.dataset.id));
    });
    
    const filteredTotal = orders.reduce((sum, order) => sum + (order.totalValue || 0), 0);
    itemsTableFooter.innerHTML = `
        <tr>
            <td class="px-6 py-4" colspan="3">Total na Consulta:</td>
            <td class="px-6 py-4 font-semibold">R$ ${filteredTotal.toFixed(2).replace('.', ',')}</td>
            <td class="px-6 py-4" colspan="3"></td>
        </tr>`;
}