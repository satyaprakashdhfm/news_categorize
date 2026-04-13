import React from 'react';
import { Clock, ExternalLink, GitBranch } from 'lucide-react';
import { formatTimeAgo, CATEGORIES } from '@/utils/helpers';
import { cn } from '@/utils/helpers';

export default function NewsCard({ article }) {
  const category = CATEGORIES.find(c => c.id === article.category);

  const categoryColorMap = {
    POL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    ECO: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    BUS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    TEC: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden border border-transparent dark:border-gray-700">
      {article.image_url && (
        <img
          src={article.image_url}
          alt={article.title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', categoryColorMap[article.category] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300')}>
            {category?.icon} {category?.name || article.category}
          </span>
          <span className="text-xs text-secondary-500 dark:text-gray-400 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {formatTimeAgo(article.published_at)}
          </span>
        </div>

        <h3 className="text-xl font-bold text-secondary-900 dark:text-white mb-2 line-clamp-2">
          {article.title}
        </h3>

        {article.summary && (
          <p className="text-secondary-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">
            {article.summary}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-secondary-500 dark:text-gray-500">
          <span className="font-mono bg-secondary-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded">
            {article.dna_code}
          </span>
          {article.thread_id && (
            <span className="flex items-center">
              <GitBranch className="h-3 w-3 mr-1" />
              Threaded
            </span>
          )}
        </div>

        <a
          href={article.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 text-sm font-medium"
        >
          Read full article
          <ExternalLink className="h-4 w-4 ml-1" />
        </a>
      </div>
    </div>
  );
}
