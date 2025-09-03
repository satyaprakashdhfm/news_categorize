'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Square, Activity, Globe, TrendingUp, Clock, Database } from 'lucide-react';

interface ScrapingStats {
  totalArticlesFound: number;
  articlesProcessed: number;
  articlesSkipped: number;
  errors: number;
  countriesProcessed: string[];
  categoriesFound: string[];
  startTime: Date;
  endTime?: Date;
  status: 'idle' | 'running' | 'completed' | 'error';
}

interface ScrapingProgress {
  stage: 'initializing' | 'searching' | 'scraping' | 'processing' | 'saving' | 'completed';
  progress: number;
  message: string;
  stats: ScrapingStats;
}

interface AdminOverview {
  totalArticles: number;
  countryCounts: Array<{ country: string; _count: { _all: number } }>;
  categoryCounts: Array<{ category: string; _count: { _all: number } }>;
  recentArticles: number;
  isRunning: boolean;
  currentStats: ScrapingStats;
}

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [currentProgress, setCurrentProgress] = useState<ScrapingProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial data
  const fetchAdminData = async () => {
    try {
      const response = await fetch('/api/admin/scraping');
      const data = await response.json();
      if (data.success) {
        setOverview(data.data.overview);
        setHistory(data.data.history);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  // Setup SSE connection for real-time updates
  const connectToProgress = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/admin/scraping/progress');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      addLog('Connected to real-time updates');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            addLog('Real-time connection established');
            break;
          case 'progress':
            setCurrentProgress(data);
            addLog(`${data.stage}: ${data.message}`);
            break;
          case 'status':
            if (data.stats) {
              setOverview(prev => prev ? { ...prev, currentStats: data.stats } : null);
            }
            break;
          case 'error':
            addLog(`Error: ${data.message}`, 'error');
            break;
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      addLog('Connection lost, attempting to reconnect...', 'error');
    };

    return eventSource;
  };

  const addLog = (message: string, type: 'info' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-50), `[${timestamp}] ${message}`]);
  };

  // Start scraping
  const startScraping = async () => {
    try {
      const response = await fetch('/api/admin/scraping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      
      const data = await response.json();
      if (data.success) {
        addLog('Scraping started successfully');
        setTimeout(fetchAdminData, 1000); // Refresh data after starting
      } else {
        addLog(`Failed to start scraping: ${data.error}`, 'error');
      }
    } catch (error) {
      addLog('Error starting scraping', 'error');
    }
  };

  useEffect(() => {
    fetchAdminData();
    const eventSource = connectToProgress();

    // Refresh data periodically
    const interval = setInterval(fetchAdminData, 30000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'initializing': return <Activity className="w-4 h-4" />;
      case 'searching': return <Globe className="w-4 h-4" />;
      case 'scraping': return <TrendingUp className="w-4 h-4" />;
      case 'processing': return <Database className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">News Scraping Admin</h1>
          <p className="text-gray-600">Monitor and control worldwide news collection with Bright Data MCP & Gemini AI</p>
        </div>

        {/* Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Control Panel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={startScraping} 
                  disabled={overview?.isRunning}
                  className="w-full"
                  size="lg"
                >
                  {overview?.isRunning ? (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      Scraping Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Worldwide Scraping
                    </>
                  )}
                </Button>
                
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-sm text-gray-600">
                    {isConnected ? 'Real-time connected' : 'Connection lost'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Database Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Articles</span>
                  <span className="font-semibold">{overview?.totalArticles?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Recent (24h)</span>
                  <span className="font-semibold">{overview?.recentArticles || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Countries</span>
                  <span className="font-semibold">{overview?.countryCounts?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Categories</span>
                  <span className="font-semibold">{overview?.categoryCounts?.length || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Session</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Badge className={getStatusColor(overview?.currentStats?.status || 'idle')}>
                  {overview?.currentStats?.status?.toUpperCase() || 'IDLE'}
                </Badge>
                
                {overview?.currentStats && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Found</span>
                      <span className="font-semibold">{overview.currentStats.totalArticlesFound}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Processed</span>
                      <span className="font-semibold">{overview.currentStats.articlesProcessed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Errors</span>
                      <span className="font-semibold text-red-600">{overview.currentStats.errors}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Section */}
        {currentProgress && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getStageIcon(currentProgress.stage)}
                Real-time Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">
                    {currentProgress.stage.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-gray-600">{currentProgress.message}</span>
                </div>
                
                <Progress value={currentProgress.progress} className="w-full" />
                
                <div className="text-sm text-gray-500">
                  {currentProgress.progress.toFixed(1)}% Complete
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Articles */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Articles</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {history.map((article, index) => (
                    <div key={index} className="border-b pb-3 last:border-b-0">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-1">
                          {article.country}
                        </Badge>
                        <Badge variant="secondary" className="mt-1">
                          {article.category}
                        </Badge>
                      </div>
                      <p className="font-medium mt-2 text-sm leading-5">
                        {article.title}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">{article.dnaCode}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(article.scrapedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Activity Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className={`text-xs font-mono p-2 rounded ${
                      log.includes('Error:') ? 'bg-red-50 text-red-800' : 'bg-gray-50'
                    }`}>
                      {log}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
