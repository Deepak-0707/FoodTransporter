// src/services/api.js
// Centralised Axios instance — automatically attaches JWT token to every request
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: inject Bearer token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fb_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 globally (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stale session — the ProtectedRoute will redirect to /login
      localStorage.removeItem('fb_token');
      localStorage.removeItem('fb_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login',    data),
};

// ─── Events ──────────────────────────────────────────────────────────────────
export const eventsAPI = {
  getAll:      (mine = false) => api.get(`/events${mine ? '?mine=true' : ''}`),
  getById:     (id)           => api.get(`/events/${id}`),
  create:      (data)         => api.post('/events', data),
  update:      (id, data)     => api.put(`/events/${id}`, data),
  remove:      (id)           => api.delete(`/events/${id}`),
};

export default api;
