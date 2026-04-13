import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatTimeAgo = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffInHours = Math.floor((now - past) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${Math.floor(diffInHours / 24)}d ago`;
};

export const COUNTRIES = [
  { code: 'USA', name: 'United States', flag: '🇺🇸', gdp: '$30.51T' },
  { code: 'CHINA', name: 'China', flag: '🇨🇳', gdp: '$19.23T' },
  { code: 'GERMANY', name: 'Germany', flag: '🇩��', gdp: '$4.74T' },
  { code: 'INDIA', name: 'India', flag: '🇮🇳', gdp: '$4.19T' },
  { code: 'JAPAN', name: 'Japan', flag: '🇯🇵', gdp: '$4.19T' },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', gdp: '$3.84T' },
  { code: 'FRANCE', name: 'France', flag: '🇫🇷', gdp: '$3.21T' },
  { code: 'ITALY', name: 'Italy', flag: '🇮🇹', gdp: '$2.42T' },
];

export const CATEGORIES = [
  { id: 'POL', name: 'Policy & Governance', color: 'blue', icon: '⚖️' },
  { id: 'ECO', name: 'Economy', color: 'green', icon: '📈' },
  { id: 'BUS', name: 'Business', color: 'purple', icon: '💼' },
  { id: 'TEC', name: 'Science & Technology', color: 'orange', icon: '🔬' },
];
