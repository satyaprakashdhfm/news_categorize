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
  { code: 'USA', name: 'United States', flag: '🇺🇸' },
  { code: 'RUSSIA', name: 'Russia', flag: '🇷🇺' },
  { code: 'INDIA', name: 'India', flag: '🇮🇳' },
  { code: 'CHINA', name: 'China', flag: '🇨🇳' },
  { code: 'JAPAN', name: 'Japan', flag: '🇯🇵' },
];

export const CATEGORIES = [
  { code: 'POL', name: 'Politics & Governance', color: 'bg-red-100 text-red-700' },
  { code: 'ECO', name: 'Economy & Business', color: 'bg-green-100 text-green-700' },
  { code: 'SOC', name: 'Society & Culture', color: 'bg-purple-100 text-purple-700' },
  { code: 'TEC', name: 'Technology & Science', color: 'bg-blue-100 text-blue-700' },
  { code: 'ENV', name: 'Environment & Climate', color: 'bg-emerald-100 text-emerald-700' },
  { code: 'HEA', name: 'Health & Medicine', color: 'bg-pink-100 text-pink-700' },
  { code: 'SPO', name: 'Sports & Entertainment', color: 'bg-orange-100 text-orange-700' },
  { code: 'SEC', name: 'Security & Conflict', color: 'bg-gray-100 text-gray-700' },
];
