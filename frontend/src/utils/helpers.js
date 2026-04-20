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
  { id: 'OTH', name: 'Others', color: 'gray', icon: '📌' },
];

export const DOMAIN_COLORS = {
  POL: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  ECO: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  BUS: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  TEC: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  OTH: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-600' },
};

export const SUBCATEGORY_CODES = {
  POL: ['EXE', 'LEG', 'JUD', 'GEO'],
  ECO: ['MAC', 'MIC', 'INV', 'MON', 'TRD'],
  BUS: ['SCA', 'MID'],
  TEC: ['SAI', 'PHY', 'BIO', 'ROB', 'DEF', 'SPC', 'NMI', 'EHW'],
  OTH: ['OTH'],
};

export const SUBCATEGORY_LABELS = {
  EXE: 'Executive',
  LEG: 'Legislative',
  JUD: 'Judiciary',
  GEO: 'Geopolitics',
  MAC: 'Macroeconomics',
  MIC: 'Microeconomics',
  INV: 'Investments',
  MON: 'Monetary Policy',
  TRD: 'Trade & Global Economy',
  SCA: 'Startups & Corporate Activity',
  MID: 'Markets & Industry Dynamics',
  SAI: 'Software & AI',
  PHY: 'Science – Physics',
  BIO: 'Biotechnology',
  ROB: 'Robotics',
  DEF: 'Defence & Weapon Technologies',
  SPC: 'Space',
  NMI: 'Nano & Material Innovation',
  EHW: 'Electronics & Hardware',
  OTH: 'Others',
};
