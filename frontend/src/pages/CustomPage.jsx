import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { PlusCircle, Sparkles, Trash2, Youtube, MessageSquare } from 'lucide-react';
import { customAgentsApi } from '@/services/api';

export default function CustomPage({ isDark, toggleDark }) {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await customAgentsApi.listAgents();
      setAgents(data?.agents || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load custom cards.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleCreate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to create a custom feed card.');
      return;
    }

    try {
      const created = await customAgentsApi.createAgent({ prompt });
      setPrompt('');
      setError('');
      await loadAgents();
      navigate(`/custom/${created.id}`);
    } catch (err) {
      console.error(err);
      setError('Unable to create custom card.');
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await customAgentsApi.deleteAgent(id);
      await loadAgents();
    } catch (err) {
      console.error(err);
      setError('Unable to delete custom card.');
    }
  };

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
              Custom News Agents
            </h1>
            <p className="text-secondary-600 dark:text-gray-400">
              Create a custom research card with your own prompt, then open its dedicated feed.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/custom/youtube')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                <Youtube className="h-5 w-5" />
                Open Custom YouTube Scraper
              </button>

              <button
                onClick={() => navigate('/custom/reddit')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold"
              >
                <MessageSquare className="h-5 w-5" />
                Open Custom Reddit Scraper
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
              placeholder="Example: I want top US AI news about investments, open-source repos, tools, software, and models."
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
              Create Custom Card
            </button>
          </div>

          <div>
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
              Created Cards
            </h2>

            {!loading && !agents.length && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-secondary-300 dark:border-gray-700 p-10 text-center text-secondary-500 dark:text-gray-400">
                No custom cards yet. Create one using your prompt.
              </div>
            )}

            {loading && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-secondary-200 dark:border-gray-700 p-10 text-center text-secondary-500 dark:text-gray-400">
                Loading custom cards...
              </div>
            )}

            {agents.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => navigate(`/custom/${agent.id}`)}
                    className="text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md border border-transparent dark:border-gray-700 p-5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                        <h3 className="font-semibold text-secondary-900 dark:text-white">
                          {agent.title}
                        </h3>
                      </div>

                      <button
                        onClick={(e) => handleDelete(e, agent.id)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-secondary-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                        aria-label="Delete custom card"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="mt-3 text-sm text-secondary-600 dark:text-gray-400 line-clamp-3">
                      {agent.prompt}
                    </p>

                    <p className="mt-4 text-xs text-secondary-500 dark:text-gray-500">
                      Created: {new Date(agent.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
