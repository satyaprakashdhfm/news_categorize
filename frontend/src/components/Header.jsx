import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Globe, Home, Sun, Moon, Sparkles, BarChart3, Menu, X, HelpCircle } from 'lucide-react';

export default function Header({ isDark, toggleDark }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isHome = location.pathname === '/';
  const isCustom = location.pathname.startsWith('/custom');
  const isUsage = location.pathname.startsWith('/llm-usage');
  const isHelp = location.pathname.startsWith('/help');

  const navLink = (to, isActive, icon, label) => (
    <Link
      to={to}
      onClick={() => setMenuOpen(false)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${
        isActive
          ? 'bg-white text-primary-700 shadow font-semibold'
          : 'bg-white/10 hover:bg-white/20 text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );

  return (
    <header className="bg-gradient-to-r from-primary-600 to-primary-800 dark:from-gray-900 dark:to-gray-800 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Globe className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight">Curio</h1>
              <p className="text-primary-100 dark:text-gray-400 text-xs sm:text-sm hidden sm:block">
                Global News Intelligence Platform
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            >
              {isDark ? <Sun className="h-5 w-5 text-yellow-300" /> : <Moon className="h-5 w-5 text-white" />}
            </button>
            {navLink('/', isHome, <Home className="h-4 w-4" />, 'Home')}
            {navLink('/custom', isCustom, <Sparkles className="h-4 w-4" />, 'Custom')}
            {navLink('/llm-usage', isUsage, <BarChart3 className="h-4 w-4" />, 'LLM Usage')}
            {navLink('/help', isHelp, <HelpCircle className="h-4 w-4" />, 'Help')}
          </div>

          {/* Mobile: dark toggle + hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            >
              {isDark ? <Sun className="h-5 w-5 text-yellow-300" /> : <Moon className="h-5 w-5 text-white" />}
            </button>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden mt-3 flex flex-col gap-2 pb-2">
            {navLink('/', isHome, <Home className="h-4 w-4" />, 'Home')}
            {navLink('/custom', isCustom, <Sparkles className="h-4 w-4" />, 'Custom')}
            {navLink('/llm-usage', isUsage, <BarChart3 className="h-4 w-4" />, 'LLM Usage')}
            {navLink('/help', isHelp, <HelpCircle className="h-4 w-4" />, 'Help')}
          </div>
        )}
      </div>
    </header>
  );
}
