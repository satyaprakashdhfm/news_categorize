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

// ── Hierarchical interest tree (mirrors backend interests_config.py) ────────
export const INTEREST_TREE = [
  {
    code: 'TEC', label: 'Technology', icon: '🔬', color: 'var(--domain-tech)',
    subdomains: [
      { code: 'SAI',  label: 'Software & AI' },
      { code: 'LLM',  label: 'LLMs & Generative AI' },
      { code: 'AGT',  label: 'AI Agents & MCP' },
      { code: 'WEB',  label: 'Web Development' },
      { code: 'MOB',  label: 'Mobile Development' },
      { code: 'CLD',  label: 'Cloud & DevOps' },
      { code: 'SEC',  label: 'Cybersecurity' },
      { code: 'DAT',  label: 'Data Science & Analytics' },
      { code: 'OSS',  label: 'Open Source' },
      { code: 'ROB',  label: 'Robotics & Automation' },
      { code: 'BLK',  label: 'Blockchain & Crypto' },
      { code: 'HRD',  label: 'Hardware & Chips' },
      { code: 'SPC',  label: 'Space' },
      { code: 'PHY',  label: 'Physics & Quantum' },
      { code: 'BIO',  label: 'Biotech & Genomics' },
      { code: 'DEF',  label: 'Defence Technology' },
      { code: 'NMI',  label: 'Nano & Materials' },
    ],
  },
  {
    code: 'BUS', label: 'Business & Finance', icon: '💼', color: 'var(--domain-biz)',
    subdomains: [
      { code: 'SCA', label: 'Startups & Venture Capital' },
      { code: 'MID', label: 'Markets & Industry' },
      { code: 'FIN', label: 'FinTech & Payments' },
      { code: 'INV', label: 'Investing & Markets' },
      { code: 'MON', label: 'Monetary Policy' },
      { code: 'TRD', label: 'Trade & Global Economy' },
    ],
  },
  {
    code: 'POL', label: 'Politics & World', icon: '⚖️', color: 'var(--domain-policy)',
    subdomains: [
      { code: 'GEO', label: 'Geopolitics' },
      { code: 'EXE', label: 'Government & Executive' },
      { code: 'LEG', label: 'Legislature & Policy' },
      { code: 'JUD', label: 'Judiciary & Law' },
      { code: 'DIP', label: 'Diplomacy & Security' },
    ],
  },
  {
    code: 'ECO', label: 'Economy', icon: '📈', color: 'var(--domain-econ)',
    subdomains: [
      { code: 'MAC', label: 'Macroeconomics' },
      { code: 'MIC', label: 'Microeconomics' },
      { code: 'ENE', label: 'Energy & Resources' },
      { code: 'CLM', label: 'Climate & Environment' },
    ],
  },
  {
    code: 'OTH', label: 'Science & Society', icon: '🔭', color: 'var(--domain-others)',
    subdomains: [
      { code: 'SCI', label: 'General Science' },
      { code: 'HEA', label: 'Health & Medicine' },
      { code: 'EDU', label: 'Education & Research' },
      { code: 'GAM', label: 'Gaming & Interactive Media' },
    ],
  },
];

// Flat subdomain label map (code → label) — includes both domains and subdomains
export const SUBCATEGORY_LABELS = Object.fromEntries([
  ...INTEREST_TREE.map(d => [d.code, d.label]),
  ...INTEREST_TREE.flatMap(d => d.subdomains.map(s => [s.code, s.label])),
]);

// Legacy flat maps (kept for backward compatibility with existing components)
export const SUBCATEGORY_CODES = Object.fromEntries(
  INTEREST_TREE.map(d => [d.code, d.subdomains.map(s => s.code)])
);
