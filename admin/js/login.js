const form = document.getElementById('adminLoginForm');
const button = document.getElementById('adminLoginButton');
const message = document.getElementById('adminLoginMessage');

checkAuth();

async function checkAuth() {
  try {
    const response = await fetch('/api/admin/me', {
      method: 'GET',
      credentials: 'same-origin'
    });

    if (response.ok) {
      window.location.href = '/admin/dashboard.html';
    }
  } catch (error) {
    console.error('Auth check error:', error);
  }
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  message.textContent = '';
  button.disabled = true;
  button.textContent = 'Входим...';

  const formData = new FormData(form);

  const payload = {
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || '')
  };

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Ошибка входа');
    }

    button.textContent = 'Готово';
    window.location.href = '/admin/dashboard.html';
  } catch (error) {
    message.textContent = error.message || 'Не удалось войти';
    button.disabled = false;
    button.textContent = 'Войти';
  }
});
