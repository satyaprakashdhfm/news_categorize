'use client'

import { useState, useEffect } from 'react'
import { Clock, ExternalLink, GitBranch, ChevronRight } from 'lucide-react'
import NewsCard from './NewsCard'
import StoryThread from './StoryThread'

interface NewsFeedProps {
  country: string
  categories: string[]
}

interface Article {
  id: string
  dnaCode: string
  title: string
  summary: string | null
  imageUrl: string | null
  sourceUrl: string
  publishedAt: string
  country: string
  category: string
  threadId: string | null
  parentId: string | null
}

export default function NewsFeed({ country, categories }: NewsFeedProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'threads'>('cards')

  // Fetch articles from API
  const fetchArticles = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        country,
        limit: '20'
      })
      
      if (categories.length > 0) {
        params.set('categories', categories.join(','))
      }
      
      const response = await fetch(`/api/articles?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setArticles(data.data.articles)
      } else {
        setError('Failed to load articles')
      }
    } catch (err) {
      setError('Failed to load articles')
      console.error('Error fetching articles:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch articles when country or categories change
  useEffect(() => {
    fetchArticles()
  }, [country, categories])

  // Filter articles based on country and categories
  const filteredArticles = articles

  // Group articles by threads
  const threadGroups = filteredArticles.reduce((groups, article) => {
    const threadId = article.threadId || article.id
    if (!groups[threadId]) {
      groups[threadId] = []
    }
    groups[threadId].push(article)
    return groups
  }, {} as Record<string, Article[]>)

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    return `${Math.floor(diffInHours / 24)}d ago`
  }

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-secondary-900">
          Latest Stories from {country}
        </h2>
        <div className="flex bg-secondary-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              viewMode === 'cards' 
                ? 'bg-white text-primary-600 shadow-sm' 
                : 'text-secondary-600'
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode('threads')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              viewMode === 'threads' 
                ? 'bg-white text-primary-600 shadow-sm' 
                : 'text-secondary-600'
            }`}
          >
            Threads
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-400 mb-2">
            <Clock className="w-12 h-12 mx-auto mb-4" />
          </div>
          <h3 className="text-lg font-medium text-secondary-900 mb-2">
            Error loading articles
          </h3>
          <p className="text-secondary-500 mb-4">{error}</p>
          <button
            onClick={fetchArticles}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === 'cards' ? (
            // Card View
            filteredArticles.map((article) => (
              <NewsCard key={article.id} article={{
                ...article,
                imageUrl: article.imageUrl || undefined,
                threadId: article.threadId || undefined,
                parentId: article.parentId || undefined,
                publishedAt: new Date(article.publishedAt),
                children: [] // Will be populated by threading logic later
              }} />
            ))
          ) : (
            // Thread View
            Object.entries(threadGroups).map(([threadId, threadArticles]) => (
              <StoryThread key={threadId} articles={threadArticles.map(article => ({
                ...article,
                imageUrl: article.imageUrl || undefined,
                threadId: article.threadId || undefined,
                parentId: article.parentId || undefined,
                publishedAt: new Date(article.publishedAt),
                children: []
              }))} />
            ))
          )}
        </div>
      )}

      {filteredArticles.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-secondary-400 mb-2">
            <Clock className="w-12 h-12 mx-auto mb-4" />
          </div>
          <h3 className="text-lg font-medium text-secondary-900 mb-2">
            No stories found
          </h3>
          <p className="text-secondary-500">
            No articles have been scraped for this country yet. Try running the scraper from the admin panel.
          </p>
        </div>
      )}
    </div>
  )
}
