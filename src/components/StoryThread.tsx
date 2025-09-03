'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, GitBranch, Clock } from 'lucide-react'
import NewsCard from './NewsCard'

interface Article {
  id: string
  dnaCode: string
  title: string
  summary: string | null
  content?: string
  imageUrl?: string
  sourceUrl: string
  publishedAt: Date
  country: string
  category: string
  threadId?: string
  parentId?: string
  children?: string[]
}

interface StoryThreadProps {
  articles: Article[]
}

export default function StoryThread({ articles }: StoryThreadProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Sort articles chronologically
  const sortedArticles = [...articles].sort((a, b) => 
    new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  )
  
  const mainArticle = sortedArticles[0]
  const followUpArticles = sortedArticles.slice(1)
  
  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    return `${Math.floor(diffInHours / 24)}d ago`
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-secondary-200 overflow-hidden">
      {/* Thread Header */}
      <div className="bg-primary-50 border-b border-primary-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <GitBranch className="w-5 h-5 text-primary-600" />
            <div>
              <h3 className="font-semibold text-primary-900">Story Thread</h3>
              <p className="text-sm text-primary-600">
                {articles.length} article{articles.length !== 1 ? 's' : ''} • 
                Started {formatTimeAgo(new Date(mainArticle.publishedAt))}
              </p>
            </div>
          </div>
          
          {followUpArticles.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              <span>{isExpanded ? 'Collapse' : 'Expand'} Thread</span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Article */}
      <div className="p-6">
        <NewsCard article={mainArticle} />
      </div>

      {/* Follow-up Articles */}
      {followUpArticles.length > 0 && (
        <div className={`border-t border-secondary-200 ${isExpanded ? 'block' : 'hidden'}`}>
          <div className="px-6 py-4">
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary-200"></div>
              
              <div className="space-y-6">
                {followUpArticles.map((article, index) => (
                  <div key={article.id} className="relative pl-10">
                    {/* Timeline Dot */}
                    <div className="absolute left-3 top-6 w-2 h-2 bg-primary-500 rounded-full"></div>
                    
                    {/* Article Content */}
                    <div className="bg-secondary-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-primary-600">
                          Update {index + 1}
                        </span>
                        <div className="flex items-center space-x-1 text-xs text-secondary-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(article.publishedAt)}</span>
                        </div>
                      </div>
                      
                      <h4 className="font-semibold text-secondary-900 mb-2">
                        {article.title}
                      </h4>
                      
                      <p className="text-sm text-secondary-600 mb-3">
                        {article.summary || 'No summary available'}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono bg-secondary-200 text-secondary-700 px-2 py-1 rounded">
                          {article.dnaCode}
                        </span>
                        <a
                          href={article.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Read More →
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Preview */}
      {followUpArticles.length > 0 && !isExpanded && (
        <div className="border-t border-secondary-200 px-6 py-3 bg-secondary-50">
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-sm text-secondary-600">
              {followUpArticles.length} more update{followUpArticles.length !== 1 ? 's' : ''} in this thread
            </span>
            <ChevronDown className="w-4 h-4 text-secondary-400" />
          </button>
        </div>
      )}
    </div>
  )
}
