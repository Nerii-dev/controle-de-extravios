// js/dashboard.js
import { db, auth, ensureAuth, logoutUser, STORES, appId } from './firebase-init.js';
import { collection, onSnapshot, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let allItems = [];

ensureAuth(user => {
    // Exibe o email do usuário logado
    document.getElementById('user-email-display').textContent = user.email; 
    // Adiciona o listener para o botão de logout
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    const userId = user.uid;
    const itemsCollection = collection(db, `artifacts/${appId}/users/${userId}/lost_products`);
    
    // Ouve as atualizações em tempo real
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

function updateDashboard(lostItems) {
    const totalValue = lostItems.reduce((acc, item) => acc + (item.totalValue || 0), 0);
    const statusAnalysis = lostItems.filter(item => item.status === 'Em Análise').length;
    const statusResolved = lostItems.filter(item => item.status === 'Resolvido').length;
    const statusContested = lostItems.filter(item => item.status === 'Contestado').length;

    document.getElementById('total-value').textContent = `R$ ${totalValue.toFixed(2).replace('.', ',')}`;
    document.getElementById('status-analysis').textContent = statusAnalysis;
    document.getElementById('status-resolved').textContent = statusResolved;
    document.getElementById('status-contested').textContent = statusContested;


    const storeSummaryContainer = document.getElementById('store-summary');
    storeSummaryContainer.innerHTML = '';
    const storeCounts = STORES.reduce((acc, store) => ({ ...acc, [store]: 0 }), {});
    lostItems.forEach(item => { if (storeCounts[item.store] !== undefined) storeCounts[item.store]++; });
    
    for (const store in storeCounts) {
        storeSummaryContainer.innerHTML += `
            <div class="bg-gray-50 p-3 rounded-md">
                <p class="font-medium text-gray-800">${store}</p>
                <p class="text-xl font-bold text-blue-600">${storeCounts[store]}</p>
            </div>`;
    }

    const upcomingDeadlinesContainer = document.getElementById('upcoming-deadlines-list');
    upcomingDeadlinesContainer.innerHTML = '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingOrders = lostItems
        .filter(order => order.status === 'Em Análise')
        .map(order => {
            const claimDate = new Date(order.date + 'T00:00:00');
            if (claimDate < today) return null;
            const diffTime = claimDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return { ...order, diffDays };
        })
        .filter(order => order !== null)
        .sort((a, b) => a.diffDays - b.diffDays);

    if (upcomingOrders.length === 0) {
        upcomingDeadlinesContainer.innerHTML = `<p class="text-center text-gray-500 py-4">Nenhuma reclamação pendente.</p>`;
    } else {
         upcomingOrders.slice(0, 5).forEach(order => {
            let urgencyColorClass = 'text-gray-700';
            let daysText = `${order.diffDays} dias`;

            if (order.diffDays <= 7) urgencyColorClass = 'text-red-600 animate-pulse';
            else if (order.diffDays <= 15) urgencyColorClass = 'text-yellow-600';
            
            if (order.diffDays === 0) daysText = 'Hoje';
            if (order.diffDays === 1) daysText = 'Amanhã';

            const formattedDate = new Date(order.date + 'T00:00:00').toLocaleDateString('pt-BR');
            const orderHtml = `
                <div class="border-t first:border-t-0 py-3">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="font-semibold text-blue-600 hover:underline cursor-pointer view-details-btn-deadline" data-order-id="${order.id}">${order.orderId}</p>
                            <p class="text-sm text-gray-500">${order.store} &bull; Prazo em: ${formattedDate}</p>
                        </div>
                        <div class="text-right flex-shrink-0 ml-4">
                            <p class="font-bold text-xl ${urgencyColorClass}">${daysText}</p>
                            <p class="text-xs text-gray-500 -mt-1">${order.diffDays > 1 ? 'restantes' : ''}</p>
                        </div>
                    </div>
                </div>`;
            upcomingDeadlinesContainer.innerHTML += orderHtml;
        });
    }
    
    const reimbursementsContainer = document.getElementById('reimbursements-requested-list');
    reimbursementsContainer.innerHTML = '';
    
    const requestedOrders = lostItems
        .filter(order => order.status === 'Resolvido' || order.status === 'Contestado')
        .sort((a, b) => new Date(b.requestDate || 0) - new Date(a.requestDate || 0));

    if (requestedOrders.length === 0) {
        reimbursementsContainer.innerHTML = `<p class="text-center text-gray-500 py-4">Nenhum reembolso finalizado.</p>`;
    } else {
        requestedOrders.slice(0, 5).forEach(order => {
            const isResolved = order.status === 'Resolvido';
            const statusClass = isResolved ? 'text-green-600 bg-green-100' : 'text-orange-600 bg-orange-100';
            const verificationDate = order.requestDate ? new Date(order.requestDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A';

            const orderHtml = `
                <div class="border-t first:border-t-0 py-3">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="font-semibold text-blue-600 hover:underline cursor-pointer view-details-btn-reimbursement" data-order-id="${order.id}">${order.orderId}</p>
                            <p class="text-sm text-gray-500">${order.store} &bull; Verificado em: ${verificationDate}</p>
                        </div>
                        <div class="text-right flex-shrink-0 ml-4">
                            <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${order.status}</span>
                        </div>
                    </div>
                </div>`;
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