import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export const articlesApi = {
  getArticles: async (params = {}) => {
    const response = await axios.get(`${API_BASE_URL}/articles`, { params });
    return response.data;
  },
  
  getArticle: async (id) => {
    const response = await axios.get(`${API_BASE_URL}/articles/${id}`);
    return response.data;
  },
};

export const scrapingApi = {
  startScraping: async (data) => {
    const response = await axios.post(`${API_BASE_URL}/admin/scraping/start`, data);
    return response.data;
  },
  
  getProgress: async () => {
    const response = await axios.get(`${API_BASE_URL}/admin/scraping/progress`);
    return response.data;
  },
  
  getStatus: async () => {
    const response = await axios.get(`${API_BASE_URL}/admin/scraping/status`);
    return response.data;
  },
};

export const customAgentsApi = {
  listAgents: async () => {
    const response = await axios.get(`${API_BASE_URL}/custom-agents`);
    return response.data;
  },

  createAgent: async (data) => {
    const response = await axios.post(`${API_BASE_URL}/custom-agents`, data);
    return response.data;
  },

  getAgent: async (agentId) => {
    const response = await axios.get(`${API_BASE_URL}/custom-agents/${agentId}`);
    return response.data;
  },

  getLatestFeed: async (agentId) => {
    const response = await axios.get(`${API_BASE_URL}/custom-agents/${agentId}/latest-feed`);
    return response.data;
  },

  deleteAgent: async (agentId) => {
    const response = await axios.delete(`${API_BASE_URL}/custom-agents/${agentId}`);
    return response.data;
  },

  searchAgent: async (agentId, data = {}, config = {}) => {
    const response = await axios.post(`${API_BASE_URL}/custom-agents/${agentId}/search`, data, config);
    return response.data;
  },
};

export const customYoutubeApi = {
  scrape: async (data, config = {}) => {
    const response = await axios.post(`${API_BASE_URL}/custom-youtube/scrape`, data, config);
    return response.data;
  },

  getHistory: async (params = {}) => {
    const response = await axios.get(`${API_BASE_URL}/custom-youtube/history`, { params });
    return response.data;
  },
};

export const customRedditApi = {
  scrape: async (data, config = {}) => {
    const response = await axios.post(`${API_BASE_URL}/custom-reddit/scrape`, data, config);
    return response.data;
  },

  getHistory: async (params = {}) => {
    const response = await axios.get(`${API_BASE_URL}/custom-reddit/history`, { params });
    return response.data;
  },
};
