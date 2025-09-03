'use client'

import { Filter } from 'lucide-react'

interface Category {
  code: string
  name: string
  color: string
}

interface CategoryFilterProps {
  categories: Category[]
  selectedCategories: string[]
  onCategoryChange: (categories: string[]) => void
}

export default function CategoryFilter({ 
  categories, 
  selectedCategories, 
  onCategoryChange 
}: CategoryFilterProps) {
  const toggleCategory = (categoryCode: string) => {
    if (selectedCategories.includes(categoryCode)) {
      onCategoryChange(selectedCategories.filter(c => c !== categoryCode))
    } else {
      onCategoryChange([...selectedCategories, categoryCode])
    }
  }

  const clearAll = () => {
    onCategoryChange([])
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <Filter className="w-4 h-4 text-secondary-500" />
        <span className="text-sm font-medium text-secondary-700">Filter by Category:</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.code}
            onClick={() => toggleCategory(category.code)}
            className={`category-filter ${
              selectedCategories.includes(category.code) ? 'active' : 'inactive'
            }`}
          >
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${category.color.split(' ')[0]}`} />
            {category.name}
          </button>
        ))}
      </div>
      
      {selectedCategories.length > 0 && (
        <button
          onClick={clearAll}
          className="text-xs text-secondary-500 hover:text-secondary-700 underline"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
