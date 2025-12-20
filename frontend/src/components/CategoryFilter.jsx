import React from 'react';
import { cn } from '@/utils/helpers';

export default function CategoryFilter({ selectedCategories, onChange, categories }) {
  const toggleCategory = (categoryId) => {
    if (selectedCategories.includes(categoryId)) {
      onChange(selectedCategories.filter(c => c !== categoryId));
    } else {
      onChange([...selectedCategories, categoryId]);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-secondary-900 mb-4">
        Filter by Category
      </h3>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => toggleCategory(category.id)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all',
              selectedCategories.includes(category.id)
                ? 'bg-primary-600 text-white ring-2 ring-offset-2 ring-primary-500'
                : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
            )}
          >
            <span className="mr-1">{category.icon}</span>
            {category.name}
          </button>
        ))}
      </div>
      {selectedCategories.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="mt-4 text-sm text-primary-600 hover:text-primary-800 font-medium"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
