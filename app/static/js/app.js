const API_URL = '';

async function handleRegister() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');

    const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const result = await res.json();
    if (result.success) {
        alert('Registration successful! Please login.');
        window.location.href = '/login.html';
    } else {
        errorDiv.innerText = result.error;
    }
}

async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');

    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const result = await res.json();
    if (result.success) {
        localStorage.setItem('token', result.data.token);
        window.location.href = '/dashboard.html';
    } else {
        errorDiv.innerText = result.error;
    }
}

async function createOrder() {
    const item = document.getElementById('item').value;
    const amount = document.getElementById('amount').value;
    const errorDiv = document.getElementById('orderError');
    const token = localStorage.getItem('token');

    const res = await fetch(`${API_URL}/create-order`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ item, amount })
    });

    const result = await res.json();
    if (result.success) {
        alert(`Order placed! Order ID: ${result.data.order_id}`);
        document.getElementById('orderId').value = result.data.order_id;
    } else {
        errorDiv.innerText = result.error;
    }
}

async function checkStatus() {
    const orderId = document.getElementById('orderId').value;
    const statusResult = document.getElementById('statusResult');
    const token = localStorage.getItem('token');

    if (!orderId) return alert('Enter Order ID');

    const res = await fetch(`${API_URL}/order-status/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await res.json();
    statusResult.style.display = 'block';
    if (result.success) {
        statusResult.innerHTML = `<strong>Status:</strong> ${result.data.status}<br><strong>Item:</strong> ${result.data.item}`;
        statusResult.style.color = '#333';
    } else {
        statusResult.innerText = result.error;
        statusResult.style.color = '#dc3545';
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}
