import React, { useState, useEffect } from 'react';
import NewsCard from './NewsCard';
import { articlesApi } from '@/services/api';

export default function NewsFeed({ country, categories }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchArticles();
  }, [country, categories]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        country,
        limit: 20
      };
      
      if (categories.length > 0) {
        params.categories = categories.join(',');
      }
      
      const data = await articlesApi.getArticles(params);
      setArticles(data.articles || []);
    } catch (err) {
      setError('Failed to load articles');
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-12 text-secondary-500 dark:text-gray-500">
        No articles found. Try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {articles.map((article) => (
        <NewsCard key={article.id} article={article} />
      ))}
    </div>
  );
}
