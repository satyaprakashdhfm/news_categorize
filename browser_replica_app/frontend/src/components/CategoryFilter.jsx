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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-transparent dark:border-gray-700">
      <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
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
                ? 'bg-primary-600 text-white ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-800'
                : 'bg-secondary-100 dark:bg-gray-700 text-secondary-600 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600'
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
          className="mt-4 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
