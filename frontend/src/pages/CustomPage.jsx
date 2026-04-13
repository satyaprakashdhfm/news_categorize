import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { PlusCircle, Youtube, MessageSquare, Globe } from 'lucide-react';

export default function CustomPage({ isDark, toggleDark }) {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setError('');
    navigate(`/custom/browser?q=${encodeURIComponent(prompt.trim())}&autorun=1`);
  };

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
              Custom Prompt Cards (Browser Integrated)
            </h1>
            <p className="text-secondary-600 dark:text-gray-400">
              Prompt-based custom cards now run on Browser Research. One flow for prompt + Reddit + YouTube + News.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/custom/browser')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                <Globe className="h-5 w-5" />
                Open Integrated Browser Cards
              </button>

              <button
                onClick={() => navigate('/custom/youtube')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                <Youtube className="h-5 w-5" />
                Open YouTube Scraper (Backup)
              </button>

              <button
                onClick={() => navigate('/custom/reddit')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold"
              >
                <MessageSquare className="h-5 w-5" />
                Open Reddit Scraper (Backup)
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8 border border-transparent dark:border-gray-700">
            <label className="block text-sm font-semibold text-secondary-800 dark:text-gray-200 mb-2">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: I want top US AI news about investments, open-source models, startups, and product launches."
              rows={4}
              className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-secondary-900 dark:text-white placeholder-secondary-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              onClick={handleCreate}
              className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold"
            >
              <PlusCircle className="h-5 w-5" />
              Open Browser Card For This Prompt
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-secondary-200 dark:border-gray-700 p-6 text-secondary-700 dark:text-gray-300">
            Browser Research now stores run history cards with time, and each card contains Reddit + YouTube + News together.
            Use Open Integrated Browser Cards to view or reopen any run.
          </div>
        </div>
      </main>
    </div>
  );
}
