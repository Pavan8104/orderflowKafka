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
    } else if (result) {
        errorDiv.innerText = result.error;
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
