import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fb_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fb_token');
      localStorage.removeItem('fb_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login',    data),
};

// ─── Events ──────────────────────────────────────────────────
export const eventsAPI = {
  getAll:    (mine = false) => api.get(`/events${mine ? '?mine=true' : ''}`),
  getById:   (id)           => api.get(`/events/${id}`),
  getNearby: (lat, lng, radius = 10) =>
    api.get(`/events/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
  create:    (data)         => api.post('/events', data),
  update:    (id, data)     => api.put(`/events/${id}`, data),
  remove:    (id)           => api.delete(`/events/${id}`),
  getBookings: (id)         => api.get(`/events/${id}/bookings`),
};

// ─── Bookings ────────────────────────────────────────────────
export const bookingsAPI = {
  create:  (data) => api.post('/bookings', data),
  getMine: ()     => api.get('/bookings/my'),
};

export default api;
