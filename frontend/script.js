/**
 * OrderFlow Core Script - UPGRADED
 * Real Backend Integration (Kafka + API)
 */

// --- Configuration ---
const API_BASE = ""; // Use relative paths for the API

// --- Application State ---
let state = {
    user: JSON.parse(localStorage.getItem('user')) || null,
    token: localStorage.getItem('token') || null,
    cart: [],
    orders: [],
    view: 'auth',
    stats: {
        total: 0,
        processing: 0,
        success: 0
    },
    pollingInterval: null
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

    // Check if already logged in
    if (state.token) {
        showApp();
    }
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

    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (res.ok) {
                saveAuth(data.user, data.token);
                showApp();
            } else {
                alert(data.error || 'Login failed');
            }
        } catch (err) {
            alert('Something went wrong, try again later.');
        }
    };

    document.getElementById('register-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        try {
            const res = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            
            if (res.ok) {
                saveAuth(data.user, data.token);
                showApp();
            } else {
                alert(data.error || 'Registration failed');
            }
        } catch (err) {
            alert('Something went wrong, try again later.');
        }
    };

    document.getElementById('logout-btn').onclick = () => {
        localStorage.clear();
        state.user = null;
        state.token = null;
        clearInterval(state.pollingInterval);
        elements.mainApp.classList.add('hidden');
        elements.authContainer.classList.remove('hidden');
    };
}

function saveAuth(user, token) {
    state.user = user;
    state.token = token;
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
}

function showApp() {
    elements.userNameDisplay.innerText = state.user.name;
    elements.authContainer.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
    switchView('dashboard');
    startPolling();
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
    elements.navItems.forEach(item => item.classList.toggle('active', item.getAttribute('data-view') === viewName));
    elements.views.forEach(view => view.classList.toggle('hidden', view.id !== `view-${viewName}`));
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
    elements.cartItems.innerHTML = state.cart.map(item => `
        <div class="cart-item" style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
            <span>${item.icon} ${item.name}</span>
            <span>$${item.price.toFixed(2)}</span>
        </div>
    `).join('');

    const total = state.cart.reduce((sum, item) => sum + item.price, 0);
    elements.cartTotal.innerText = `$${total.toFixed(2)}`;
}

// --- Real Order Creation & Kafka Polling ---
async function processOrder() {
    if (state.cart.length === 0) return;

    const cartData = [...state.cart];
    state.cart = [];
    updateCartUI();
    elements.cartDrawer.classList.add('hidden');

    showToast('Sending to Kafka...', 'Initializing order stream');

    try {
        const res = await fetch(`${API_BASE}/api/create-order`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ items: cartData })
        });

        if (res.ok) {
            showToast('Kafka Processing...', 'Order is in the queue', 'primary');
            addLog(`[PRODUCER] Order successfully published to Kafka topic`);
            fetchOrders(); // Initial fetch
        } else {
            showToast('Order Failed', 'Could not reach Kafka server', 'error');
            setTimeout(() => elements.toast.classList.add('hidden'), 3000);
        }
    } catch (err) {
        showToast('Network Error', 'Something went wrong, try again', 'error');
        setTimeout(() => elements.toast.classList.add('hidden'), 3000);
    }
}

function startPolling() {
    fetchOrders();
    state.pollingInterval = setInterval(fetchOrders, 3000);
}

async function fetchOrders() {
    if (!state.token) return;

    try {
        const res = await fetch(`${API_BASE}/api/my-orders`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        
        if (res.ok) {
            updateOrders(data.orders);
        }
    } catch (err) {
        console.error("Polling error:", err);
    }
}

function updateOrders(newOrders) {
    // Check for any newly completed or failed orders to show notifications
    newOrders.forEach(newOrder => {
        const oldOrder = state.orders.find(o => o.id === newOrder.id);
        
        if (oldOrder && oldOrder.status === 'pending' && newOrder.status !== 'pending') {
            if (newOrder.status === 'completed') {
                showToast('Order Completed ✅', `Order #${newOrder.id} processed!`, 'success');
                addLog(`[CONSUMER] Order #${newOrder.id} successfully processed from Kafka`);
            } else if (newOrder.status === 'failed') {
                showToast('Order Failed ❌', `Order #${newOrder.id} moved to DLQ`, 'error');
                addLog(`[KAFKA] Order #${newOrder.id} failed validation - DLQ alert`);
            }
            setTimeout(() => elements.toast.classList.add('hidden'), 4000);
        }
    });

    state.orders = newOrders;
    renderOrderTable();
    updateStats();
}

function renderOrderTable() {
    elements.orderHistory.innerHTML = state.orders.map(order => {
        const statusClass = order.status === 'completed' ? 'badge-success' : 
                           (order.status === 'failed' ? 'badge-failed' : 'badge-pending');
        const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);
        
        return `
            <tr>
                <td>#${order.id}</td>
                <td>${order.product_name}</td>
                <td>$${parseFloat(order.amount).toFixed(2)}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>${new Date(order.created_at).toLocaleTimeString()}</td>
            </tr>
        `;
    }).join('');
}

function updateStats() {
    const total = state.orders.length;
    const processing = state.orders.filter(o => o.status === 'pending').length;
    const success = state.orders.filter(o => o.status === 'completed').length;
    
    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-processing').innerText = processing;
    
    const rate = total > 0 ? Math.round((success / total) * 100) : 0;
    document.getElementById('stat-success').innerText = `${rate}%`;
}

// --- Helpers ---
function addLog(msg) {
    const entry = document.createElement('div');
    entry.className = 'stream-entry';
    entry.innerHTML = `<span style="color: #4ade80">></span> ${msg}`;
    elements.kafkaStream.prepend(entry);
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
