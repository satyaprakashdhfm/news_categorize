import React from 'react';
import { Clock, ExternalLink, GitBranch } from 'lucide-react';
import { formatTimeAgo, CATEGORIES } from '@/utils/helpers';
import { cn } from '@/utils/helpers';

export default function NewsCard({ article }) {
  const category = CATEGORIES.find(c => c.code === article.category);
  
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden">
      {article.image_url && (
        <img
          src={article.image_url}
          alt={article.title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', category?.color)}>
            {category?.name || article.category}
          </span>
          <span className="text-xs text-secondary-500 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {formatTimeAgo(article.published_at)}
          </span>
        </div>
        
        <h3 className="text-xl font-bold text-secondary-900 mb-2 line-clamp-2">
          {article.title}
        </h3>
        
        {article.summary && (
          <p className="text-secondary-600 text-sm mb-4 line-clamp-3">
            {article.summary}
          </p>
        )}
        
        <div className="flex items-center justify-between text-xs text-secondary-500">
          <span className="font-mono bg-secondary-100 px-2 py-1 rounded">
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
          className="mt-4 inline-flex items-center text-primary-600 hover:text-primary-800 text-sm font-medium"
        >
          Read full article
          <ExternalLink className="h-4 w-4 ml-1" />
        </a>
      </div>
    </div>
  );
}
