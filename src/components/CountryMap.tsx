'use client'

import { useState } from 'react'
import { MapPin, Globe } from 'lucide-react'

interface CountryMapProps {
  selectedCountry: string
  onCountrySelect: (country: string) => void
}

const COUNTRIES = [
  { 
    code: 'USA', 
    name: 'United States', 
    flag: '🇺🇸',
    position: { x: 20, y: 40 },
    stats: { articles: 89, threads: 34 }
  },
  { 
    code: 'RUSSIA', 
    name: 'Russia', 
    flag: '🇷🇺',
    position: { x: 65, y: 25 },
    stats: { articles: 67, threads: 28 }
  },
  { 
    code: 'INDIA', 
    name: 'India', 
    flag: '🇮🇳',
    position: { x: 70, y: 50 },
    stats: { articles: 78, threads: 31 }
  },
  { 
    code: 'CHINA', 
    name: 'China', 
    flag: '🇨🇳',
    position: { x: 75, y: 35 },
    stats: { articles: 92, threads: 37 }
  },
  { 
    code: 'JAPAN', 
    name: 'Japan', 
    flag: '🇯🇵',
    position: { x: 85, y: 40 },
    stats: { articles: 56, threads: 23 }
  },
]

export default function CountryMap({ selectedCountry, onCountrySelect }: CountryMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <Globe className="w-6 h-6 text-primary-600" />
        <h2 className="text-2xl font-bold text-secondary-900">Global News Map</h2>
      </div>

      {/* Interactive World Map */}
      <div className="relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-8 min-h-[400px] overflow-hidden">
        {/* World Map Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg
            viewBox="0 0 1000 500"
            className="w-full h-full"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Simplified world map outline */}
            <path d="M150,200 Q200,180 250,200 L300,190 Q350,200 400,210 L450,200 Q500,190 550,200 L600,210 Q650,200 700,190 L750,200 Q800,210 850,200" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  fill="none" />
            <path d="M100,250 Q200,240 300,250 L400,260 Q500,250 600,240 L700,250 Q800,260 900,250" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  fill="none" />
          </svg>
        </div>

        {/* Country Markers */}
        {COUNTRIES.map((country) => {
          const isSelected = selectedCountry === country.code
          const isHovered = hoveredCountry === country.code

          return (
            <button
              key={country.code}
              onClick={() => onCountrySelect(country.code)}
              onMouseEnter={() => setHoveredCountry(country.code)}
              onMouseLeave={() => setHoveredCountry(null)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
                isSelected ? 'scale-125 z-20' : isHovered ? 'scale-110 z-10' : 'z-0'
              }`}
              style={{
                left: `${country.position.x}%`,
                top: `${country.position.y}%`,
              }}
            >
              <div className={`relative ${isSelected ? 'animate-pulse' : ''}`}>
                {/* Country Pin */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 transition-all duration-200 ${
                  isSelected 
                    ? 'bg-primary-600 border-primary-700 text-white' 
                    : 'bg-white border-secondary-300 hover:border-primary-400'
                }`}>
                  <span className="text-xl">{country.flag}</span>
                </div>

                {/* Country Label */}
                <div className={`absolute top-full mt-2 left-1/2 transform -translate-x-1/2 transition-all duration-200 ${
                  isSelected || isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                }`}>
                  <div className="bg-white rounded-lg shadow-lg border border-secondary-200 px-3 py-2 min-w-max">
                    <div className="text-sm font-semibold text-secondary-900">
                      {country.name}
                    </div>
                    <div className="text-xs text-secondary-600">
                      {country.stats.articles} articles • {country.stats.threads} threads
                    </div>
                  </div>
                </div>

                {/* Selection Ring */}
                {isSelected && (
                  <div className="absolute inset-0 rounded-full border-4 border-primary-300 animate-ping"></div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Country Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {COUNTRIES.map((country) => (
          <button
            key={country.code}
            onClick={() => onCountrySelect(country.code)}
            className={`p-4 rounded-lg border transition-all duration-200 text-left ${
              selectedCountry === country.code
                ? 'bg-primary-50 border-primary-300 shadow-sm'
                : 'bg-white border-secondary-200 hover:border-secondary-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center space-x-3 mb-3">
              <span className="text-2xl">{country.flag}</span>
              <div>
                <div className="font-semibold text-secondary-900">{country.name}</div>
                <div className="text-xs text-secondary-500">{country.code}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-secondary-600">Articles Today</span>
                <span className="font-medium text-secondary-900">{country.stats.articles}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary-600">Active Threads</span>
                <span className="font-medium text-secondary-900">{country.stats.threads}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
