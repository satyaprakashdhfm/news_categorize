import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Globe, Settings, Home, Sun, Moon } from 'lucide-react';

export default function Header({ isDark, toggleDark }) {
  const location = useLocation();
  const isAdmin = location.pathname === '/admin';

  return (
    <header className="bg-gradient-to-r from-primary-600 to-primary-800 dark:from-gray-900 dark:to-gray-800 text-white shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
            <Globe className="h-10 w-10" />
            <div>
              <h1 className="text-3xl font-bold">Curio</h1>
              <p className="text-primary-100 dark:text-gray-400 text-sm">
                Global News Intelligence Platform
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            >
              {isDark
                ? <Sun  className="h-5 w-5 text-yellow-300" />
                : <Moon className="h-5 w-5 text-white" />}
            </button>

            <Link
              to={isAdmin ? "/" : "/admin"}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
            >
              {isAdmin ? (
                <>
                  <Home className="h-5 w-5" />
                  <span>Home</span>
                </>
              ) : (
                <>
                  <Settings className="h-5 w-5" />
                  <span>Admin</span>
                </>
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
