'use client'

import { Clock, ExternalLink, GitBranch, ChevronRight } from 'lucide-react'
import Image from 'next/image'

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

interface NewsCardProps {
  article: Article
}

const getCategoryColor = (category: string) => {
  const colors = {
    'POL': 'bg-red-100 text-red-700',
    'ECO': 'bg-green-100 text-green-700',
    'SOC': 'bg-purple-100 text-purple-700',
    'TEC': 'bg-blue-100 text-blue-700',
    'ENV': 'bg-emerald-100 text-emerald-700',
    'HEA': 'bg-pink-100 text-pink-700',
    'SPO': 'bg-orange-100 text-orange-700',
    'SEC': 'bg-gray-100 text-gray-700',
  }
  return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-700'
}

const getCategoryName = (category: string) => {
  const names = {
    'POL': 'Politics & Governance',
    'ECO': 'Economy & Business',
    'SOC': 'Society & Culture',
    'TEC': 'Technology & Science',
    'ENV': 'Environment & Climate',
    'HEA': 'Health & Medicine',
    'SPO': 'Sports & Entertainment',
    'SEC': 'Security & Conflict',
  }
  return names[category as keyof typeof names] || category
}

const formatTimeAgo = (date: Date) => {
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
  
  if (diffInHours < 1) return 'Just now'
  if (diffInHours < 24) return `${diffInHours}h ago`
  return `${Math.floor(diffInHours / 24)}d ago`
}

export default function NewsCard({ article }: NewsCardProps) {
  const hasThread = article.threadId && (article.parentId || (article.children && article.children.length > 0))

  return (
    <div className="news-card p-6">
      <div className="flex items-start space-x-4">
        {/* Thread Indicator */}
        {hasThread && (
          <div className="flex-shrink-0 pt-1">
            <div className="flex items-center space-x-1">
              <GitBranch className="w-4 h-4 text-primary-500" />
              <span className="text-xs text-primary-600 font-medium">Thread</span>
            </div>
          </div>
        )}

        {/* Article Image */}
        {article.imageUrl && (
          <div className="flex-shrink-0">
            <div className="w-24 h-24 bg-secondary-100 rounded-lg overflow-hidden">
              <Image
                src={article.imageUrl}
                alt={article.title}
                width={96}
                height={96}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          </div>
        )}

        {/* Article Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className={`dna-code ${getCategoryColor(article.category)}`}>
                {article.dnaCode}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(article.category)}`}>
                {getCategoryName(article.category)}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-secondary-500">
              <Clock className="w-3 h-3" />
              <span>{formatTimeAgo(article.publishedAt)}</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-secondary-900 mb-2 line-clamp-2">
            {article.title}
          </h3>

          {/* Summary */}
          <p className="text-secondary-600 text-sm mb-3 line-clamp-2">
            {article.summary || 'No summary available'}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Read Full Story</span>
              </a>
            </div>

            {hasThread && (
              <button className="flex items-center space-x-1 text-primary-600 hover:text-primary-700 text-sm font-medium">
                <span>View Thread</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
