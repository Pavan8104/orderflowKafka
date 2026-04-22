/**
 * OrderFlow Core Script
 * Handles SPA navigation, Cart, and Kafka Visualization
 */

// --- Application State ---
let state = {
    user: null,
    cart: [],
    orders: [],
    view: 'auth', // auth, dashboard, shop, orders
    stats: {
        total: 0,
        processing: 0,
        success: 0
    }
};

// --- DOM Elements ---
const elements = {
    authContainer: document.getElementById('auth-container'),
    mainApp: document.getElementById('main-app'),
    loginSection: document.getElementById('login-section'),
    registerSection: document.getElementById('register-section'),
    viewTitle: document.getElementById('view-title'),
    views: document.querySelectorAll('.view'),
    navItems: document.querySelectorAll('.nav-item'),
    productGrid: document.getElementById('product-grid'),
    cartDrawer: document.getElementById('cart-drawer'),
    cartItems: document.getElementById('cart-items'),
    cartTotal: document.getElementById('cart-total'),
    kafkaStream: document.getElementById('kafka-stream'),
    orderHistory: document.getElementById('order-history-body'),
    toast: document.getElementById('kafka-toast'),
    userNameDisplay: document.getElementById('user-name-display')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initAuthListeners();
    initNavListeners();
    initCartListeners();
    renderProducts();
});

// --- Authentication Logic ---
function initAuthListeners() {
    document.getElementById('go-to-register').onclick = () => {
        elements.loginSection.classList.add('hidden');
        elements.registerSection.classList.remove('hidden');
    };

    document.getElementById('go-to-login').onclick = () => {
        elements.registerSection.classList.add('hidden');
        elements.loginSection.classList.remove('hidden');
    };

    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        loginUser(email.split('@')[0] || 'User');
    };

    document.getElementById('register-form').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        loginUser(name);
    };

    document.getElementById('logout-btn').onclick = () => {
        state.user = null;
        elements.mainApp.classList.add('hidden');
        elements.authContainer.classList.remove('hidden');
    };
}

function loginUser(name) {
    state.user = name;
    elements.userNameDisplay.innerText = name;
    elements.authContainer.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
    switchView('dashboard');
}

// --- Navigation Logic ---
function initNavListeners() {
    elements.navItems.forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            switchView(view);
        };
    });
}

function switchView(viewName) {
    state.view = viewName;
    
    // Update Nav UI
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-view') === viewName);
    });

    // Update Views
    elements.views.forEach(view => {
        view.classList.toggle('hidden', view.id !== `view-${viewName}`);
    });

    // Update Title
    const titles = { dashboard: 'Dashboard', shop: 'Shop Products', orders: 'My Orders' };
    elements.viewTitle.innerText = titles[viewName];
}

// --- Shop & Cart Logic ---
function renderProducts() {
    elements.productGrid.innerHTML = PRODUCTS.map(p => `
        <div class="product-card">
            <div class="product-img">${p.icon}</div>
            <h4>${p.name}</h4>
            <span class="price">$${p.price.toFixed(2)}</span>
            <p style="font-size: 0.8rem; color: #6b7280; margin-bottom: 1rem;">${p.description}</p>
            <button class="btn-add-cart" onclick="addToCart(${p.id})">Add to Cart</button>
        </div>
    `).join('');
}

window.addToCart = (id) => {
    const product = PRODUCTS.find(p => p.id === id);
    state.cart.push(product);
    updateCartUI();
    elements.cartDrawer.classList.remove('hidden');
};

function initCartListeners() {
    document.getElementById('close-cart').onclick = () => elements.cartDrawer.classList.add('hidden');
    document.getElementById('checkout-btn').onclick = () => processOrder();
}

function updateCartUI() {
    elements.cartItems.innerHTML = state.cart.map((item, index) => `
        <div class="cart-item" style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
            <span>${item.icon} ${item.name}</span>
            <span>$${item.price.toFixed(2)}</span>
        </div>
    `).join('');

    const total = state.cart.reduce((sum, item) => sum + item.price, 0);
    elements.cartTotal.innerText = `$${total.toFixed(2)}`;
}

// --- Kafka Simulation Engine ---
async function processOrder() {
    if (state.cart.length === 0) return;

    const currentOrderItems = [...state.cart];
    state.cart = [];
    updateCartUI();
    elements.cartDrawer.classList.add('hidden');

    // Start Kafka Viz
    showToast('Sending to Kafka...', 'Queuing your order in the cluster');
    updateStats('processing', 1);

    const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const productNames = currentOrderItems.map(i => i.name).join(', ');
    const totalAmount = currentOrderItems.reduce((sum, i) => sum + i.price, 0);

    addLog(`[PRODUCER] Initializing stream for ${orderId}`);
    await wait(1500);

    addLog(`[KAFKA] Message published to topic 'orders-inbound' (Partition 2)`);
    showToast('Kafka Processing...', 'Consumer is validating inventory and payment');
    await wait(2000);

    // Random success/fail
    const isSuccess = Math.random() > 0.1;

    if (isSuccess) {
        addLog(`[CONSUMER] Order ${orderId} validated successfully.`);
        addLog(`[DB] Record persisted in primary cluster.`);
        showToast('Completed!', 'Order processed and confirmed', 'success');
        updateStats('success', 1);
        updateStats('total', 1);
        
        addOrderToTable({
            id: orderId,
            product: productNames,
            amount: `$${totalAmount.toFixed(2)}`,
            status: 'Success',
            time: new Date().toLocaleTimeString()
        });
    } else {
        addLog(`[CONSUMER] Error processing ${orderId}: Payment Gateway Timeout`);
        addLog(`[KAFKA] Moving message to Dead Letter Queue (DLQ)`);
        showToast('Failed!', 'Kafka encountered an error. Sent to DLQ.', 'error');
        
        addOrderToTable({
            id: orderId,
            product: productNames,
            amount: `$${totalAmount.toFixed(2)}`,
            status: 'Failed',
            time: new Date().toLocaleTimeString()
        });
    }

    updateStats('processing', -1);
    setTimeout(() => elements.toast.classList.add('hidden'), 3000);
}

// --- Helpers ---
function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

function addLog(msg) {
    const entry = document.createElement('div');
    entry.className = 'stream-entry';
    entry.innerHTML = `<span style="color: #4ade80">></span> ${msg}`;
    elements.kafkaStream.prepend(entry);
    
    // Remove empty state
    const empty = elements.kafkaStream.querySelector('.empty-state');
    if (empty) empty.remove();
}

function showToast(title, msg, type = 'primary') {
    elements.toast.classList.remove('hidden');
    document.getElementById('toast-title').innerText = title;
    document.getElementById('toast-msg').innerText = msg;
    
    const spinner = elements.toast.querySelector('.spinner');
    if (type === 'success') {
        elements.toast.style.borderLeftColor = 'var(--success)';
        spinner.style.display = 'none';
    } else if (type === 'error') {
        elements.toast.style.borderLeftColor = 'var(--error)';
        spinner.style.display = 'none';
    } else {
        elements.toast.style.borderLeftColor = 'var(--primary)';
        spinner.style.display = 'block';
    }
}

function updateStats(key, val) {
    if (key === 'success') {
        state.stats.success++;
    } else if (key === 'total') {
        state.stats.total++;
    } else if (key === 'processing') {
        state.stats.processing += val;
    }

    document.getElementById('stat-total').innerText = state.stats.total;
    document.getElementById('stat-processing').innerText = state.stats.processing;
    
    const rate = state.stats.total > 0 ? Math.round((state.stats.success / state.stats.total) * 100) : 0;
    document.getElementById('stat-success').innerText = `${rate}%`;
}

function addOrderToTable(order) {
    const row = document.createElement('tr');
    const statusClass = order.status === 'Success' ? 'badge-success' : 'badge-failed';
    row.innerHTML = `
        <td>#${order.id}</td>
        <td>${order.product}</td>
        <td>${order.amount}</td>
        <td><span class="badge ${statusClass}">${order.status}</span></td>
        <td>${order.time}</td>
    `;
    elements.orderHistory.prepend(row);
}
