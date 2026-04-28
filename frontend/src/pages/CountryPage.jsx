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
      <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
        <Header isDark={isDark} toggleDark={toggleDark} />
        <main className="container mx-auto px-4 py-8">
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--t-h1)', fontWeight: 700, color: 'var(--fg-1)' }}>Country Not Found</h1>
            <Link to="/" style={{ color: 'var(--accent)', marginTop: 16, display: 'inline-block' }}>
              Return to Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link
          to="/"
          className="back mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Global View
        </Link>

        {/* Country Header */}
        <div
          className="panel mb-6 md:mb-8"
          style={{
            background: 'linear-gradient(135deg, var(--bg-2), var(--bg-1))',
            border: '1px solid var(--line-2)',
            padding: '24px',
          }}
        >
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-4xl sm:text-6xl md:text-8xl flex-shrink-0">{country.flag}</div>
            <div>
              <h1 style={{ fontSize: 'var(--t-h1)', fontWeight: 700, color: 'var(--fg-1)', margin: '0 0 4px' }}>{country.name}</h1>
              <p style={{ color: 'var(--fg-2)', fontSize: 'var(--t-body)' }}>
                GDP: {country.gdp} &bull; Code: {country.code}
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
          <h2 style={{ fontSize: 'var(--t-h2)', fontWeight: 700, color: 'var(--fg-1)', marginBottom: 24 }}>
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
