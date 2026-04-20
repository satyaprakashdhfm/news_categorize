import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useDarkMode } from './hooks/useDarkMode';

import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CustomPage from './pages/CustomPage';
import CustomFeedPage from './pages/CustomFeedPage';
import CustomYouTubePage from './pages/CustomYouTubePage';
import CustomRedditPage from './pages/CustomRedditPage';
import BrowserResearchMainPage from './pages/BrowserResearchMainPage';
import FeedCardDetailPage from './pages/FeedCardDetailPage';
import LLMUsageDashboardPage from './pages/LLMUsageDashboardPage';
import CountryPage from './pages/CountryPage';
import HelpPage from './pages/HelpPage';

function App() {
  const [isDark, setIsDark] = useDarkMode();
  const toggleDark = () => setIsDark((prev) => !prev);

  const props = { isDark, toggleDark };

  return (
    <AuthProvider>
      <Routes>
        <Route path="/"              element={<HomePage {...props} />} />
        <Route path="/admin"         element={<AdminPage {...props} />} />
        <Route path="/login"         element={<LoginPage {...props} />} />
        <Route path="/register"      element={<RegisterPage {...props} />} />
        <Route path="/custom"        element={<CustomPage {...props} />} />
        <Route path="/custom/browser" element={<BrowserResearchMainPage {...props} />} />
        <Route path="/feed/:cardId"   element={<FeedCardDetailPage {...props} />} />
        <Route path="/custom/youtube" element={<CustomYouTubePage {...props} />} />
        <Route path="/custom/reddit"  element={<CustomRedditPage {...props} />} />
        <Route path="/custom/:agentId" element={<CustomFeedPage {...props} />} />
        <Route path="/llm-usage"     element={<LLMUsageDashboardPage {...props} />} />
        <Route path="/country/:countryCode" element={<CountryPage {...props} />} />
        <Route path="/help"          element={<HelpPage {...props} />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
