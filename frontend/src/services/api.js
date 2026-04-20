import axios from 'axios';

const API_BASE_URL = '/api';

// Axios instance that auto-attaches JWT token
const api = axios.create({ baseURL: API_BASE_URL });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('curio_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

// ── Feed Cards ───────────────────────────────────────────────────────────────
export const feedCardsApi = {
  getGlobal: (params = {}) => api.get('/feed-cards/global', { params }).then((r) => r.data),
  getMyFeed: () => api.get('/feed-cards/my/feed').then((r) => r.data),
  getCard: (id) => api.get(`/feed-cards/${id}`).then((r) => r.data),
  create: (data) => api.post('/feed-cards', data).then((r) => r.data),
  update: (id, data) => api.patch(`/feed-cards/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/feed-cards/${id}`),
  pin: (cardId, data = {}) => api.post(`/feed-cards/my/feed/${cardId}`, data).then((r) => r.data),
  unpin: (cardId) => api.delete(`/feed-cards/my/feed/${cardId}`),
  setGlobal: (cardId, isGlobal) => api.patch(`/feed-cards/${cardId}/global`, null, { params: { is_global: isGlobal } }).then((r) => r.data),
  attachRun: (data) => api.post('/feed-cards/attach-run', data).then((r) => r.data),
  getTrending: (params = {}) => api.get('/feed-cards/trending', { params }).then((r) => r.data),
};

// ── Articles ─────────────────────────────────────────────────────────────────
export const articlesApi = {
  getArticles: (params = {}) => api.get('/articles', { params }).then((r) => r.data),
  getArticle: (id) => api.get(`/articles/${id}`).then((r) => r.data),
};

// ── Scraping ─────────────────────────────────────────────────────────────────
export const scrapingApi = {
  startScraping: (data) => api.post('/admin/scraping/start', data).then((r) => r.data),
  getProgress: () => api.get('/admin/scraping/progress').then((r) => r.data),
  getStatus: () => api.get('/admin/scraping/status').then((r) => r.data),
};

// ── Custom Agents ────────────────────────────────────────────────────────────
export const customAgentsApi = {
  listAgents: () => api.get('/custom-agents').then((r) => r.data),
  createAgent: (data) => api.post('/custom-agents', data).then((r) => r.data),
  getAgent: (id) => api.get(`/custom-agents/${id}`).then((r) => r.data),
  getLatestFeed: (id) => api.get(`/custom-agents/${id}/latest-feed`).then((r) => r.data),
  deleteAgent: (id) => api.delete(`/custom-agents/${id}`),
  searchAgent: (id, data = {}, config = {}) => api.post(`/custom-agents/${id}/search`, data, config).then((r) => r.data),
};

// ── Custom YouTube ───────────────────────────────────────────────────────────
export const customYoutubeApi = {
  scrape: (data, config = {}) => api.post('/custom-youtube/scrape', data, config).then((r) => r.data),
  getHistory: (params = {}) => api.get('/custom-youtube/history', { params }).then((r) => r.data),
};

// ── Custom Reddit ────────────────────────────────────────────────────────────
export const customRedditApi = {
  scrape: (data, config = {}) => api.post('/custom-reddit/scrape', data, config).then((r) => r.data),
  getHistory: (params = {}) => api.get('/custom-reddit/history', { params }).then((r) => r.data),
};

// ── Browser Research ─────────────────────────────────────────────────────────
export const browserResearchApi = {
  run: (data, config = {}) => api.post('/browser-research/run', data, config).then((r) => r.data),
  getHistory: (params = {}) => api.get('/browser-research/history', { params }).then((r) => r.data),
  getRun: (runId) => api.get(`/browser-research/history/${runId}`).then((r) => r.data),
};
