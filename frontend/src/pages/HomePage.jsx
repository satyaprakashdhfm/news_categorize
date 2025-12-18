import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import CategoryFilter from '@/components/CategoryFilter';
import NewsFeed from '@/components/NewsFeed';
import { COUNTRIES, CATEGORIES } from '@/utils/helpers';
import { TrendingUp } from 'lucide-react';
import { articlesApi } from '@/services/api';

export default function HomePage() {
  const [selectedCountry, setSelectedCountry] = useState('USA');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await articlesApi.getArticles({ stats: true, limit: 1 });
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-secondary-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Stats Section */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary-500">Total Articles</p>
                  <p className="text-2xl font-bold text-secondary-900">
                    {stats.total_articles}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary-500">Recent (24h)</p>
                  <p className="text-2xl font-bold text-secondary-900">
                    {stats.recent_articles}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary-500">Active Threads</p>
                  <p className="text-2xl font-bold text-secondary-900">
                    {stats.active_threads}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary-500">Countries</p>
                  <p className="text-2xl font-bold text-secondary-900">
                    {stats.country_counts?.length || 0}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </div>
        )}

        {/* Country Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">
            Select Country
          </h3>
          <div className="flex flex-wrap gap-3">
            {COUNTRIES.map((country) => (
              <button
                key={country.code}
                onClick={() => setSelectedCountry(country.code)}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  selectedCountry === country.code
                    ? 'bg-primary-600 text-white shadow-lg scale-105'
                    : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                }`}
              >
                <span className="mr-2">{country.flag}</span>
                {country.name}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <CategoryFilter
          selectedCategories={selectedCategories}
          onChange={setSelectedCategories}
          categories={CATEGORIES}
        />

        {/* News Feed */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-secondary-900 mb-6">
            Latest Stories from {COUNTRIES.find(c => c.code === selectedCountry)?.name}
          </h2>
          <NewsFeed country={selectedCountry} categories={selectedCategories} />
        </div>
      </main>
    </div>
  );
}
