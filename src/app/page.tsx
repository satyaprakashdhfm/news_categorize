'use client'

import { useState, useEffect } from 'react'
import { Globe, Filter, Clock, TrendingUp } from 'lucide-react'
import CountryMap from '@/components/CountryMap'
import NewsFeed from '@/components/NewsFeed'
import CategoryFilter from '@/components/CategoryFilter'
import Header from '@/components/Header'

const COUNTRIES = [
  { code: 'USA', name: 'United States', flag: '🇺🇸' },
  { code: 'RUSSIA', name: 'Russia', flag: '🇷🇺' },
  { code: 'INDIA', name: 'India', flag: '🇮🇳' },
  { code: 'CHINA', name: 'China', flag: '🇨🇳' },
  { code: 'JAPAN', name: 'Japan', flag: '🇯🇵' },
]

const CATEGORIES = [
  { code: 'POL', name: 'Politics & Governance', color: 'bg-red-100 text-red-700' },
  { code: 'ECO', name: 'Economy & Business', color: 'bg-green-100 text-green-700' },
  { code: 'SOC', name: 'Society & Culture', color: 'bg-purple-100 text-purple-700' },
  { code: 'TEC', name: 'Technology & Science', color: 'bg-blue-100 text-blue-700' },
  { code: 'ENV', name: 'Environment & Climate', color: 'bg-emerald-100 text-emerald-700' },
  { code: 'HEA', name: 'Health & Medicine', color: 'bg-pink-100 text-pink-700' },
  { code: 'SPO', name: 'Sports & Entertainment', color: 'bg-orange-100 text-orange-700' },
  { code: 'SEC', name: 'Security & Conflict', color: 'bg-gray-100 text-gray-700' },
]

interface Stats {
  totalArticles: number
  recentArticles: number
  activeThreads: number
  countryCounts: Array<{ country: string; _count: { country: number } }>
  categoryCounts: Array<{ category: string; _count: { category: number } }>
}

export default function HomePage() {
  const [selectedCountry, setSelectedCountry] = useState('USA')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'feed' | 'map'>('feed')
  const [stats, setStats] = useState<Stats | null>(null)

  // Fetch stats from API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/articles?stats=true&limit=1')
        const data = await response.json()
        if (data.success && data.data.stats) {
          setStats(data.data.stats)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      }
    }
    
    fetchStats()
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen">
      <Header />
      
      {/* Country Navigation */}
      <div className="bg-white border-b border-secondary-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Globe className="w-5 h-5 text-primary-600" />
              <div className="flex space-x-2">
                {COUNTRIES.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => setSelectedCountry(country.code)}
                    className={`country-tab ${
                      selectedCountry === country.code ? 'active' : 'inactive'
                    }`}
                  >
                    <span className="mr-2">{country.flag}</span>
                    {country.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex bg-secondary-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('feed')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === 'feed' 
                      ? 'bg-white text-primary-600 shadow-sm' 
                      : 'text-secondary-600'
                  }`}
                >
                  Feed
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === 'map' 
                      ? 'bg-white text-primary-600 shadow-sm' 
                      : 'text-secondary-600'
                  }`}
                >
                  Map
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filters */}
      <div className="bg-secondary-50 border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <CategoryFilter
            categories={CATEGORIES}
            selectedCategories={selectedCategories}
            onCategoryChange={setSelectedCategories}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {viewMode === 'map' ? (
          <div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6">
            <CountryMap 
              selectedCountry={selectedCountry}
              onCountrySelect={setSelectedCountry}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* News Feed */}
            <div className="lg:col-span-3">
              <NewsFeed 
                country={selectedCountry}
                categories={selectedCategories}
              />
            </div>
            
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="space-y-6">
                {/* Stats Card */}
                <div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6">
                  <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                    Today's Stories
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-secondary-600">Total Articles</span>
                      <span className="font-semibold text-secondary-900">
                        {stats?.totalArticles?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary-600">Recent (24h)</span>
                      <span className="font-semibold text-secondary-900">
                        {stats?.recentArticles || '0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-secondary-600">Active Threads</span>
                      <span className="font-semibold text-secondary-900">
                        {stats?.activeThreads || '0'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Top Categories */}
                <div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6">
                  <div className="flex items-center mb-4">
                    <TrendingUp className="w-5 h-5 text-primary-600 mr-2" />
                    <h3 className="text-lg font-semibold text-secondary-900">
                      Top Categories
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {stats?.categoryCounts?.slice(0, 3).map((cat, index) => {
                      const category = CATEGORIES.find(c => c.code === cat.category)
                      return (
                        <div key={cat.category} className="flex items-center justify-between">
                          <span className="text-sm text-secondary-600">
                            {category?.name || cat.category}
                          </span>
                          <span className="text-xs text-primary-600 font-medium">
                            {cat._count.category}
                          </span>
                        </div>
                      )
                    }) || (
                      <div className="text-sm text-secondary-500">
                        No data available yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
