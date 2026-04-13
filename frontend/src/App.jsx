import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import CountryPage from './pages/CountryPage';
import CustomPage from './pages/CustomPage';
import CustomFeedPage from './pages/CustomFeedPage';
import CustomYouTubePage from './pages/CustomYouTubePage';
import CustomRedditPage from './pages/CustomRedditPage';
import BrowserResearchMainPage from './pages/BrowserResearchMainPage';
import { useDarkMode } from './hooks/useDarkMode';

function App() {
  const [isDark, setIsDark] = useDarkMode();

  const toggleDark = () => setIsDark(prev => !prev);

  return (
    <Routes>
      <Route path="/"       element={<HomePage    isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/admin"  element={<AdminPage   isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/custom" element={<CustomPage  isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/custom/browser" element={<BrowserResearchMainPage isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/custom/youtube" element={<CustomYouTubePage isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/custom/reddit" element={<CustomRedditPage isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/custom/:agentId" element={<CustomFeedPage isDark={isDark} toggleDark={toggleDark} />} />
      <Route path="/country/:countryCode" element={<CountryPage isDark={isDark} toggleDark={toggleDark} />} />
    </Routes>
  );
}

export default App;
