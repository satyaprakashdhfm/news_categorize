import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import CategoryFilter from '@/components/CategoryFilter';
import NewsFeed from '@/components/NewsFeed';
import { COUNTRIES, CATEGORIES } from '@/utils/helpers';
import { ArrowLeft } from 'lucide-react';

export default function CountryPage({ isDark, toggleDark }) {
  const { countryCode } = useParams();
  const [selectedCategories, setSelectedCategories] = useState([]);
  
  const country = COUNTRIES.find(c => c.code === countryCode);

  if (!country) {
    return (
      <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
        <Header isDark={isDark} toggleDark={toggleDark} />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Country Not Found</h1>
            <Link to="/" className="text-primary-600 dark:text-primary-400 hover:underline mt-4 inline-block">
              Return to Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />
      
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-6 font-medium"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Global View
        </Link>

        {/* Country Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 dark:from-gray-800 dark:to-gray-700 rounded-lg shadow-lg p-4 sm:p-6 md:p-8 mb-6 md:mb-8 text-white">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-4xl sm:text-6xl md:text-8xl flex-shrink-0">{country.flag}</div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2">{country.name}</h1>
              <p className="text-primary-100 dark:text-gray-300 text-sm sm:text-base md:text-lg">
                GDP: {country.gdp} • Code: {country.code}
              </p>
            </div>
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
          <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-6">
            {selectedCategories.length > 0 
              ? `${CATEGORIES.filter(c => selectedCategories.includes(c.id)).map(c => c.name).join(', ')} News` 
              : 'All News'}
          </h2>
          <NewsFeed country={countryCode} categories={selectedCategories} />
        </div>
      </main>
    </div>
  );
}
