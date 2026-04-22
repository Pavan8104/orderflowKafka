const API_URL = '';
let cart = [];

// --- UI Helpers ---

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    if (type === 'error') toast.style.background = '#dc3545';
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function getStatusBadge(status) {
    const s = status.toLowerCase();
    if (s === 'processed' || s === 'completed') return '<span class="badge badge-success">🟢 Completed</span>';
    if (s === 'failed') return '<span class="badge badge-failed">🔴 Failed</span>';
    return '<span class="badge badge-pending">🟡 Processing</span>';
}

function updateUserGreeting() {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            document.getElementById('userGreeting').innerText = `Welcome back, ${payload.username}!`;
        } catch (e) { /* silent fail */ }
    }
}

// --- API Wrapper ---

async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    try {
        const res = await fetch(`${API_URL}${endpoint}`, options);
        if (res.status === 401 && !endpoint.includes('/login')) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            return null;
        }
        return await res.json();
    } catch (e) {
        showToast('Connection lost. Is the server running?', 'error');
        return null;
    }
}

// --- Dashboard Logic ---

function renderProducts() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = PRODUCTS.map(p => `
        <div class="product-item" onclick="addToCart(${p.id})">
            <span class="product-icon">${p.icon}</span>
            <div class="product-name">${p.name}</div>
            <div class="product-price">$${p.price.toFixed(2)}</div>
        </div>
    `).join('');
}

function addToCart(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    cart.push(product);
    updateCartUI();
    showToast(`Added ${product.name} to cart 🛒`);
}

function updateCartUI() {
    const itemsList = document.getElementById('cartItems');
    const totalDiv = document.getElementById('cartTotal');
    const totalSpan = document.getElementById('totalAmount');

    if (cart.length === 0) {
        itemsList.innerHTML = '<p class="empty-state">Select items to start</p>';
        totalDiv.style.display = 'none';
        return;
    }

    itemsList.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <span>${item.name}</span>
            <strong>$${item.price.toFixed(2)}</strong>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    totalSpan.innerText = `$${total.toFixed(2)}`;
    totalDiv.style.display = 'block';
}

async function checkout() {
    const btn = document.getElementById('placeOrderBtn');
    const originalText = btn.innerText;
    
    btn.disabled = true;
    btn.innerText = 'Processing Order...';

    // In this app, we process one consolidated order for simplicity
    const payload = {
        item: cart.length === 1 ? cart[0].name : `${cart.length} items (Bulk Order)`,
        amount: cart.reduce((sum, item) => sum + item.price, 0)
    };

    const result = await apiCall('/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    btn.disabled = false;
    btn.innerText = originalText;

    if (result && result.success) {
        showToast('Order placed successfully! 🚀');
        cart = [];
        updateCartUI();
        loadMyOrders();
    } else if (result) {
        showToast(result.error || 'Checkout failed', 'error');
    }
}

async function loadMyOrders() {
    const ordersList = document.getElementById('ordersList');
    const result = await apiCall('/my-orders');

    if (result && result.success) {
        if (result.data.orders.length === 0) {
            ordersList.innerHTML = '<div class="empty-state">No orders yet. Start by adding products.</div>';
            return;
        }

        let html = '<table>';
        html += '<thead><tr><th>Date</th><th>Description</th><th>Total</th><th>Status</th></tr></thead><tbody>';
        
        result.data.orders.forEach(order => {
            const date = new Date(order.created_at).toLocaleDateString();
            html += `<tr>
                <td style="color: #636e72; font-size: 0.8rem;">${date}</td>
                <td style="font-weight: 600;">${order.item}</td>
                <td>$${order.amount.toFixed(2)}</td>
                <td>${getStatusBadge(order.status)}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        ordersList.innerHTML = html;
    }
}

async function loadFailedOrders() {
    const failedOrdersList = document.getElementById('failedOrdersList');
    const result = await apiCall('/failed-orders');

    if (result && result.success) {
        if (result.data.failed_orders.length === 0) {
            failedOrdersList.innerHTML = '<div class="empty-state">System healthy. No failures detected.</div>';
            return;
        }

        let html = '<table><thead><tr><th>Description</th><th>Reason</th></tr></thead><tbody>';
        result.data.failed_orders.forEach(order => {
            html += `<tr>
                <td style="font-weight: 600;">${order.item}</td>
                <td style="color: #dc3545;">${order.error}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        failedOrdersList.innerHTML = html;
    }
}

// --- Auth ---

async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');
    const btn = document.querySelector('button');

    btn.disabled = true;
    btn.innerText = 'Verifying...';

    const result = await apiCall('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    btn.disabled = false;
    btn.innerText = 'Login';

    if (result && result.success) {
        localStorage.setItem('token', result.data.token);
        window.location.href = '/dashboard.html';
    } else if (result) {
        errorDiv.innerText = result.error;
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}
