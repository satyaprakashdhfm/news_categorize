import React, { useState } from 'react';
import Header from '@/components/Header';
import { COUNTRIES, CATEGORIES } from '@/utils/helpers';
import { Play, Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function AdminPage() {
  const [selectedCountries, setSelectedCountries] = useState(['USA']);
  const [selectedTopics, setSelectedTopics] = useState(['politics']);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const topics = [
    { id: 'politics', name: 'Politics' },
    { id: 'economy', name: 'Economy' },
    { id: 'technology', name: 'Technology' },
    { id: 'health', name: 'Health' },
    { id: 'environment', name: 'Environment' },
    { id: 'sports', name: 'Sports' },
  ];

  const toggleCountry = (countryCode) => {
    setSelectedCountries(prev => 
      prev.includes(countryCode)
        ? prev.filter(c => c !== countryCode)
        : [...prev, countryCode]
    );
  };

  const toggleTopic = (topicId) => {
    setSelectedTopics(prev => 
      prev.includes(topicId)
        ? prev.filter(t => t !== topicId)
        : [...prev, topicId]
    );
  };

  const pollProgress = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/admin/scraping/progress');
      if (response.ok) {
        const data = await response.json();
        
        // Update result with current stats
        setResult(data.stats);
        
        // If still running, poll again
        if (data.status === 'running') {
          setTimeout(pollProgress, 1000); // Poll every second
        } else {
          setIsRunning(false);
        }
      }
    } catch (err) {
      console.error('Error polling progress:', err);
    }
  };

  const handleStartResearch = async () => {
    if (selectedCountries.length === 0 || selectedTopics.length === 0) {
      setError('Please select at least one country and one topic');
      return;
    }

    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('http://localhost:8000/api/admin/scraping/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          countries: selectedCountries,
          topics: selectedTopics,
          date: new Date().toISOString().split('T')[0],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Start polling for progress
      setTimeout(pollProgress, 500);
    } catch (err) {
      setError(err.message || 'Failed to start scraping');
      console.error('Scraping error:', err);
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-secondary-900 mb-2">
              News Research Admin
            </h1>
            <p className="text-secondary-600 mb-8">
              Scrape and analyze news articles using AI-powered categorization
            </p>

            {/* Country Selection */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-secondary-900 mb-4">
                Select Countries
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {COUNTRIES.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => toggleCountry(country.code)}
                    disabled={isRunning}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      selectedCountries.includes(country.code)
                        ? 'bg-primary-600 text-white shadow-lg'
                        : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="mr-2">{country.flag}</span>
                    {country.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic Selection */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-secondary-900 mb-4">
                Select Topics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => toggleTopic(topic.id)}
                    disabled={isRunning}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      selectedTopics.includes(topic.id)
                        ? 'bg-green-600 text-white shadow-lg'
                        : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {topic.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <div className="mb-8">
              <button
                onClick={handleStartResearch}
                disabled={isRunning}
                className={`w-full py-4 rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-3 ${
                  isRunning
                    ? 'bg-secondary-400 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Researching...
                  </>
                ) : (
                  <>
                    <Play className="h-6 w-6" />
                    Start Research
                  </>
                )}
              </button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900">Error</h3>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Result Display */}
            {result && (
              <div className={`p-6 border rounded-lg ${
                result.status === 'running' 
                  ? 'bg-blue-50 border-blue-200' 
                  : result.status === 'completed'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-start gap-3 mb-4">
                  {result.status === 'running' ? (
                    <Loader2 className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0 animate-spin" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-green-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <h3 className={`font-semibold text-lg ${
                      result.status === 'running' ? 'text-blue-900' : 'text-green-900'
                    }`}>
                      {result.status === 'running' ? 'Research in Progress...' : 'Research Completed!'}
                    </h3>
                    <p className={result.status === 'running' ? 'text-blue-700' : 'text-green-700'}>
                      Status: {result.status}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-secondary-600">Articles Found</p>
                    <p className="text-2xl font-bold text-secondary-900">
                      {result.total_articles_found || 0}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-secondary-600">Processed</p>
                    <p className="text-2xl font-bold text-green-600">
                      {result.articles_processed || 0}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-secondary-600">Skipped</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {result.articles_skipped || 0}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-secondary-600">Errors</p>
                    <p className="text-2xl font-bold text-red-600">
                      {result.errors || 0}
                    </p>
                  </div>
                </div>

                {result.countries_processed && result.countries_processed.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-secondary-600 mb-2">Countries Processed:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.countries_processed.map(code => (
                        <span key={code} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {COUNTRIES.find(c => c.code === code)?.name || code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.categories_found && result.categories_found.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-secondary-600 mb-2">Categories Found:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.categories_found.map(cat => (
                        <span key={cat} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                          {CATEGORIES.find(c => c.id === cat)?.name || cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
