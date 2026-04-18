import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Youtube, MessageSquare, Globe } from 'lucide-react';

export default function CustomPage({ isDark, toggleDark }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
              Custom Cards (Browser Integrated)
            </h1>
            <p className="text-secondary-600 dark:text-gray-400">
              One integrated flow for Reddit + YouTube + News via Browser Research.
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

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-secondary-200 dark:border-gray-700 p-6 text-secondary-700 dark:text-gray-300">
            Browser Research now stores run history cards with time, and each card contains Reddit + YouTube + News together.
            Use Open Integrated Browser Cards to view or reopen any run.
          </div>
        </div>
      </main>
    </div>
  );
}
