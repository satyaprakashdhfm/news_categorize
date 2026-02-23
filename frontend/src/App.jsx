import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import CountryPage from './pages/CountryPage';
import { useDarkMode } from './hooks/useDarkMode';

function App() {
  const [isDark, setIsDark] = useDarkMode();

  const toggleDark = () => setIsDark(prev => !prev);

  return (
    <Routes>
      <Route path="/"       element={<HomePage    isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/admin"  element={<AdminPage   isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/country/:countryCode" element={<CountryPage isDark={isDark} toggleDark={toggleDark} />} />
    </Routes>
  );
}

export default App;
