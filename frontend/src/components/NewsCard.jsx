import React from 'react';
import { Clock, ExternalLink, GitBranch } from 'lucide-react';
import { formatTimeAgo, CATEGORIES, SUBCATEGORY_LABELS, DOMAIN_COLORS } from '@/utils/helpers';
import { cn } from '@/utils/helpers';

export default function NewsCard({ article }) {
  const category = CATEGORIES.find((c) => c.id === article.category);
  const colors = DOMAIN_COLORS[article.category] || DOMAIN_COLORS.OTH;
  const subcategoryLabel = SUBCATEGORY_LABELS[article.subcategory] || article.subcategory;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-secondary-100 dark:border-gray-700 flex flex-col">
      {article.image_url && (
        <img
          src={article.image_url}
          alt={article.title}
          className="w-full h-36 object-cover"
        />
      )}
      <div className="p-4 flex flex-col flex-1">
        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', colors.bg, colors.text)}>
            {category?.icon} {category?.name || article.category}
          </span>
          {article.subcategory && article.subcategory !== 'OTH' && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary-100 dark:bg-gray-700 text-secondary-600 dark:text-gray-300">
              {subcategoryLabel}
            </span>
          )}
          {article.country && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary-50 dark:bg-gray-700/60 text-secondary-500 dark:text-gray-400">
              {article.country}
            </span>
          )}
          <span className="ml-auto text-xs text-secondary-400 dark:text-gray-500 flex items-center gap-0.5 whitespace-nowrap">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(article.published_at)}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-secondary-900 dark:text-white leading-snug line-clamp-2 flex-1">
          {article.title}
        </h3>

        {article.summary && (
          <p className="mt-2 text-xs text-secondary-600 dark:text-gray-400 line-clamp-2">
            {article.summary}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-xs bg-secondary-100 dark:bg-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded truncate max-w-[130px]">
            {article.dna_code}
          </span>
          <div className="flex items-center gap-2">
            {article.thread_id && (
              <span className="flex items-center text-xs text-secondary-400 dark:text-gray-500">
                <GitBranch className="h-3 w-3 mr-0.5" />
                Thread
              </span>
            )}
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              Source <ExternalLink className="h-3 w-3 ml-0.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
