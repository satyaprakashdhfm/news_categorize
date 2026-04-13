import React from 'react';
import { Routes, Route } from 'react-router-dom';
import BrowserScrapePage from './pages/BrowserScrapePage';
import { useDarkMode } from './hooks/useDarkMode';

function App() {
  const [isDark, setIsDark] = useDarkMode();

  const toggleDark = () => setIsDark(prev => !prev);

  return (
    <Routes>
      <Route path="/" element={<BrowserScrapePage isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="*" element={<BrowserScrapePage isDark={isDark} toggleDark={toggleDark} />} />
    </Routes>
  );
}

export default App;
