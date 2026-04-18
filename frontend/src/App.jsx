import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CountryPage from './pages/CountryPage';
import CustomPage from './pages/CustomPage';
import CustomFeedPage from './pages/CustomFeedPage';
import CustomYouTubePage from './pages/CustomYouTubePage';
import CustomRedditPage from './pages/CustomRedditPage';
import BrowserResearchMainPage from './pages/BrowserResearchMainPage';
import LLMUsageDashboardPage from './pages/LLMUsageDashboardPage';
import { useDarkMode } from './hooks/useDarkMode';

function App() {
  const [isDark, setIsDark] = useDarkMode();

  const toggleDark = () => setIsDark(prev => !prev);

  return (
    <Routes>
      <Route path="/"       element={<HomePage    isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/admin"  element={<Navigate to="/" replace />} />
      <Route path="/custom" element={<CustomPage  isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/custom/browser" element={<BrowserResearchMainPage isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/llm-usage" element={<LLMUsageDashboardPage isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/custom/youtube" element={<CustomYouTubePage isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/custom/reddit" element={<CustomRedditPage isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/custom/:agentId" element={<CustomFeedPage isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/country/:countryCode" element={<CountryPage isDark={isDark} toggleDark={toggleDark} />} />
    </Routes>
  );
}

export default App;
