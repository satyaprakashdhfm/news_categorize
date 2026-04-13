import React from 'react';
import { useNavigate } from 'react-router-dom';
import { COUNTRIES } from '@/utils/helpers';

export default function GlobalMap({ stats }) {
  const navigate = useNavigate();

  const countryStats = stats?.country_counts || [];
  
  const getCountryArticleCount = (code) => {
    const countryStat = countryStats.find(c => c.country === code);
    return countryStat?.count || 0;
  };

  const getCountryColor = (code) => {
    const count = getCountryArticleCount(code);
    if (count === 0) return 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300';
    if (count < 10) return 'bg-blue-200 dark:bg-blue-900/50 hover:bg-blue-300 dark:hover:bg-blue-800 text-blue-900 dark:text-blue-200';
    if (count < 50) return 'bg-blue-400 dark:bg-blue-700 hover:bg-blue-500 dark:hover:bg-blue-600 text-white';
    return 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-transparent dark:border-gray-700">
      <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-6 flex items-center gap-2">
        🌍 Global News Coverage
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COUNTRIES.map((country) => {
          const articleCount = getCountryArticleCount(country.code);
          const colorClass = getCountryColor(country.code);
          
          return (
            <button
              key={country.code}
              onClick={() => navigate(`/country/${country.code}`)}
              className={`${colorClass} rounded-lg p-6 transition-all transform hover:scale-105 shadow-md`}
            >
              <div className="text-5xl mb-3">{country.flag}</div>
              <h3 className="font-bold text-lg mb-1">{country.name}</h3>
              <p className="text-sm opacity-80 mb-2">GDP: {country.gdp}</p>
              <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10">
                <p className="text-2xl font-bold">{articleCount}</p>
                <p className="text-xs opacity-80">Articles</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-4 text-sm text-secondary-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <span>No data</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-200 dark:bg-blue-900/50 rounded"></div>
          <span>&lt;10 articles</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-400 dark:bg-blue-700 rounded"></div>
          <span>10-50 articles</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-600 dark:bg-blue-500 rounded"></div>
          <span>50+ articles</span>
        </div>
      </div>
    </div>
  );
}
