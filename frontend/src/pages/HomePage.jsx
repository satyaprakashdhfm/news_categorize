import React, { useEffect, useRef, useState } from 'react';
import Header from '@/components/Header';
import CategoryFilter from '@/components/CategoryFilter';
import NewsFeed from '@/components/NewsFeed';
import { COUNTRIES, CATEGORIES } from '@/utils/helpers';
import { Play, Square, Loader2, CheckCircle2, XCircle, Filter, CalendarDays, Clock3 } from 'lucide-react';

export default function HomePage({ isDark, toggleDark }) {
  const [selectedCountry, setSelectedCountry] = useState('INDIA');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState(['USA']);
  const [selectedTopics, setSelectedTopics] = useState(['policy']);
  const [domainFilter, setDomainFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [windowFilter, setWindowFilter] = useState('24');
  const [isRunning, setIsRunning] = useState(false);
  const [scrapeStats, setScrapeStats] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const API_BASE_URL = '/api';

  const topics = [
    { id: 'policy', name: 'Policy & Governance' },
    { id: 'economy', name: 'Economy' },
    { id: 'business', name: 'Business' },
    { id: 'technology', name: 'Science & Technology' },
  ];

  const toggleCountry = (code) => {
    setSelectedCountries((prev) => (
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    ));
  };

  const toggleTopic = (id) => {
    setSelectedTopics((prev) => (
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    ));
  };

  useEffect(() => {
    return () => {
      clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = () => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/scraping/progress`);
        const data = await res.json();
        setScrapeStats(data.stats);
        if (data.status !== 'running') {
          clearInterval(pollRef.current);
          setIsRunning(false);
        }
      } catch {
        clearInterval(pollRef.current);
        setIsRunning(false);
      }
    }, 1200);
  };

  const handleStart = async () => {
    if (!selectedCountries.length || !selectedTopics.length) {
      setError('Select at least one country and one topic.');
      return;
    }
    setError('');
    setIsRunning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/scraping/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countries: selectedCountries,
          topics: selectedTopics,
          date: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      startPolling();
    } catch (err) {
      setError(err.message || 'Failed to start research.');
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    try {
      await fetch(`${API_BASE_URL}/admin/scraping/stop`, { method: 'POST' });
    } catch {
      // best effort
    }
    clearInterval(pollRef.current);
    setIsRunning(false);
  };

  const total = scrapeStats?.total_to_process || 0;
  const done = (scrapeStats?.articles_processed || 0) + (scrapeStats?.articles_skipped || 0) + (scrapeStats?.errors || 0);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  const countryName = COUNTRIES.find((c) => c.code === selectedCountry)?.name || selectedCountry;

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />
      
      <main className="container mx-auto px-4 py-8">
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-secondary-100 dark:border-gray-700 p-6 md:p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400 font-semibold">Control Center</p>
              <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 dark:text-white mt-2">Global Research & Coverage</h1>
              <p className="text-secondary-600 dark:text-gray-300 mt-2">Admin controls are merged here. Start research and use filters below to explore country-specific coverage.</p>
            </div>

            {isRunning ? (
              <button
                onClick={handleStop}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow"
              >
                <Square className="h-4 w-4" />
                Stop Research
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold shadow"
              >
                <Play className="h-4 w-4" />
                Start Research
              </button>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-secondary-500 dark:text-gray-400 mb-2">Countries</p>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => !isRunning && toggleCountry(country.code)}
                    disabled={isRunning}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedCountries.includes(country.code)
                      ? 'bg-primary-600 text-white'
                      : 'bg-secondary-100 dark:bg-gray-700 text-secondary-700 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600'} ${isRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {country.flag} {country.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-secondary-500 dark:text-gray-400 mb-2">Topics</p>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => !isRunning && toggleTopic(topic.id)}
                    disabled={isRunning}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedTopics.includes(topic.id)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-secondary-100 dark:bg-gray-700 text-secondary-700 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600'} ${isRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {topic.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" /> {error}
            </div>
          ) : null}

          {scrapeStats ? (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-secondary-500 dark:text-gray-400 mb-1">
                <span>{done} / {total} processed</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary-100 dark:bg-gray-700 overflow-hidden">
                <div className="h-full bg-primary-600 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>

              <div className="mt-3 text-sm text-secondary-700 dark:text-gray-300 flex items-center gap-2">
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin text-primary-600 dark:text-primary-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                {isRunning ? 'Research is running...' : 'Research is idle'}
              </div>
            </div>
          ) : null}
        </section>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-transparent dark:border-gray-700 mb-6">
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Country Filter</h3>
          <p className="text-sm text-secondary-600 dark:text-gray-300 mt-1">Selected Country: {countryName}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {COUNTRIES.map((country) => (
              <button
                key={country.code}
                onClick={() => setSelectedCountry(country.code)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedCountry === country.code
                  ? 'bg-primary-600 text-white'
                  : 'bg-secondary-100 dark:bg-gray-700 text-secondary-700 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600'}`}
              >
                {country.flag} {country.name}
              </button>
            ))}
          </div>
        </div>

        <CategoryFilter
          selectedCategories={selectedCategories}
          onChange={setSelectedCategories}
          categories={CATEGORIES}
        />

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-transparent dark:border-gray-700 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">Feed Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-secondary-600 dark:text-gray-300 mb-1">Domain</label>
              <input
                type="text"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                placeholder="reuters.com, bbc, nytimes..."
                className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-secondary-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary-600 dark:text-gray-300 mb-1">Day</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-secondary-400" />
                <input
                  type="date"
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                  className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-9 pr-3 py-2 text-sm text-secondary-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary-600 dark:text-gray-300 mb-1">Time Window</label>
              <div className="relative">
                <Clock3 className="absolute left-3 top-2.5 h-4 w-4 text-secondary-400" />
                <select
                  value={windowFilter}
                  onChange={(e) => setWindowFilter(e.target.value)}
                  disabled={!!dayFilter}
                  className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-9 pr-3 py-2 text-sm text-secondary-900 dark:text-white disabled:opacity-60"
                >
                  <option value="2">Last 2 hours</option>
                  <option value="6">Last 6 hours</option>
                  <option value="12">Last 12 hours</option>
                  <option value="24">Last 24 hours</option>
                  <option value="48">Last 48 hours</option>
                  <option value="72">Last 72 hours</option>
                  <option value="today">Today</option>
                  <option value="all">All time</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => {
                setDomainFilter('');
                setDayFilter('');
                setWindowFilter('24');
              }}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-secondary-100 dark:bg-gray-700 text-secondary-700 dark:text-gray-200"
            >
              Reset Feed Filters
            </button>
            <span className="text-xs text-secondary-500 dark:text-gray-400">Tip: Day overrides Time Window.</span>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl sm:text-2xl font-bold text-secondary-900 dark:text-white mb-4 sm:mb-6">
            Latest Stories from {countryName}
          </h2>
          <NewsFeed
            country={selectedCountry}
            categories={selectedCategories}
            domainFilter={domainFilter}
            dayFilter={dayFilter}
            windowFilter={windowFilter}
          />
        </div>
      </main>
    </div>
  );
}
