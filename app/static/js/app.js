const API_URL = '';

// Helper for API calls to handle auth redirection
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    const res = await fetch(`${API_URL}${endpoint}`, options);
    
    // If token expired or invalid, redirect to login
    if (res.status === 401 && !endpoint.includes('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
        return null;
    }
    
    return res.json();
}

async function handleRegister() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');
    const btn = document.querySelector('button');

    btn.disabled = true;
    btn.innerText = 'Registering...';

    const result = await apiCall('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    btn.disabled = false;
    btn.innerText = 'Register';

    if (result && result.success) {
        alert('Registration successful! Please login.');
        window.location.href = '/login.html';
    } else if (result) {
        errorDiv.innerText = result.error;
    }
}

async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');
    const btn = document.querySelector('button');

    btn.disabled = true;
    btn.innerText = 'Logging in...';

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

async function createOrder() {
    const item = document.getElementById('item').value;
    const amount = document.getElementById('amount').value;
    const errorDiv = document.getElementById('orderError');
    const btn = document.querySelector('.order-form button');

    if (!item || !amount) return alert('Please fill in all fields');

    btn.disabled = true;
    btn.innerText = 'Placing Order...';

    const result = await apiCall('/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, amount })
    });

    btn.disabled = false;
    btn.innerText = 'Place Order';

    if (result && result.success) {
        alert(`Order placed! Order ID: ${result.data.order_id}`);
        document.getElementById('orderId').value = result.data.order_id;
        document.getElementById('item').value = '';
        document.getElementById('amount').value = '';
        loadMyOrders(); // Refresh history
    } else if (result) {
        errorDiv.innerText = result.error;
    }
}

async function loadMyOrders() {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = '<p>Loading orders...</p>';
    const result = await apiCall('/my-orders');

    if (result && result.success) {
        if (result.data.orders.length === 0) {
            ordersList.innerHTML = '<p>No orders yet.</p>';
        } else {
            let html = '<table style="width:100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9rem;">';
            html += '<tr style="background: #f8f9fa;"><th style="border: 1px solid #ddd; padding: 8px;">Date</th><th style="border: 1px solid #ddd; padding: 8px;">Item</th><th style="border: 1px solid #ddd; padding: 8px;">Amount</th><th style="border: 1px solid #ddd; padding: 8px;">Status</th></tr>';

            result.data.orders.forEach(order => {
                const date = new Date(order.created_at).toLocaleString();
                html += `<tr>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #666; font-size: 0.8rem;">${date}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${order.item}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">$${order.amount}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>${order.status}</strong></td>
                </tr>`;
            });
            html += '</table>';

            ordersList.innerHTML = html;
        }
        loadFailedOrders(); // Also load failed orders
    }
}

async function loadFailedOrders() {
    const failedOrdersList = document.getElementById('failedOrdersList');
    failedOrdersList.innerHTML = '<p>Loading failed orders...</p>';
    const result = await apiCall('/failed-orders');

    if (result && result.success) {
        if (result.data.failed_orders.length === 0) {
            failedOrdersList.innerHTML = '<p>No failed orders.</p>';
            return;
        }

        let html = '<table style="width:100%; border-collapse: collapse; margin-top: 10px; font-size: 0.85rem;">';
        html += '<tr style="background: #fff5f5;"><th style="border: 1px solid #ddd; padding: 8px;">Item</th><th style="border: 1px solid #ddd; padding: 8px;">Error</th></tr>';
        
        result.data.failed_orders.forEach(order => {
            html += `<tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${order.item}</td>
                <td style="border: 1px solid #ddd; padding: 8px; color: #dc3545;">${order.error}</td>
            </tr>`;
        });
        html += '</table>';
        failedOrdersList.innerHTML = html;
    }
}

async function checkStatus() {
    const orderId = document.getElementById('orderId').value;
    const statusResult = document.getElementById('statusResult');
    const btn = document.querySelector('.order-status button');

    if (!orderId) return alert('Enter Order ID');

    btn.disabled = true;
    btn.innerText = 'Checking...';

    const result = await apiCall(`/order-status/${orderId}`);

    btn.disabled = false;
    btn.innerText = 'Check Status';

    if (result) {
        statusResult.style.display = 'block';
        if (result.success) {
            statusResult.innerHTML = `<strong>Status:</strong> ${result.data.status}<br><strong>Item:</strong> ${result.data.item}`;
            statusResult.style.color = '#333';
        } else {
            statusResult.innerText = result.error;
            statusResult.style.color = '#dc3545';
        }
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}
