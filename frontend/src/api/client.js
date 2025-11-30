const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const TOKEN_KEY = 'auth_token';

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (res.status === 401) {
    const err = new Error('Unauthorized');
    err.code = 401;
    throw err;
  }

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Request failed: ${res.status}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  login(payload) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  createPair(payload = {}) {
    return request('/api/remote/pair', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getDevices() {
    return request('/api/devices');
  },
  createDevice(payload) {
    return request('/api/devices', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getScripts() {
    return request('/api/scripts');
  },
  createScript(payload) {
    return request('/api/scripts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getTasks() {
    return request('/api/tasks');
  },
  createTask(payload) {
    return request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  retryTask(taskId) {
    return request(`/api/tasks/${taskId}/retry`, { method: 'POST' });
  }
};
