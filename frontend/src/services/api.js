const API_BASE_URL = 'http://localhost:3000/api';
export const TOKEN_STORAGE_KEY = 'mock_interview_auth';

class ApiService {
  static getToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  static setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  static clearToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    const isFormData = options.body instanceof FormData;
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (response.status === 401) {
        // Automatically clear stale token on 401 unauthorized
        this.clearToken();
      }

      if (!response.ok) {
        throw new Error(data.message || 'An error occurred during request execution');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  // Auth endpoints
  static async register(name, email, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
  }

  static async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  static async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  static async getMe() {
    return this.request('/auth/me', { method: 'GET' });
  }

  // Profile endpoints
  static async getProfile() {
    return this.request('/profile', { method: 'GET' });
  }

  static async updateProfile(profileData) {
    return this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }
}

export default ApiService;
