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
