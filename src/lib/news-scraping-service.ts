import { tavily } from '@tavily/core';
import { newsProcessor, NewsArticle, ProcessedArticle } from './langchain-agents';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();
const tvly = tavily({ apiKey: process.env.TVLY_API_KEY as string });

export interface ScrapingStats {
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

export interface ScrapingProgress {
  stage: 'initializing' | 'searching' | 'scraping' | 'processing' | 'saving' | 'completed';
  currentCountry?: string;
  currentArticle?: string;
  progress: number; // 0-100
  message: string;
  stats: ScrapingStats;
}

export type SupportedCountry = 'USA' | 'RUSSIA' | 'INDIA' | 'CHINA' | 'JAPAN';
export const SUPPORTED_COUNTRIES: readonly SupportedCountry[] = ['USA', 'RUSSIA', 'INDIA', 'CHINA', 'JAPAN'];

export class NewsScrapingService extends EventEmitter {
  private isRunning = false;
  private stats: ScrapingStats = {
    totalArticlesFound: 0,
    articlesProcessed: 0,
    articlesSkipped: 0,
    errors: 0,
    countriesProcessed: [],
    categoriesFound: [],
    startTime: new Date(),
    status: 'idle'
  };

  constructor() {
    super();
    // Patch console.log to suppress [DB] logs unless explicitly enabled via env var
    const originalLog = console.log.bind(console);
    console.log = (...args: any[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith('[DB]')) {
        if (process.env.SHOW_DB_LOGS === 'true') {
          originalLog(...args);
        }
      } else {
        originalLog(...args);
      }
    };
  }

  async startWorldwideNewsScraping(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Scraping is already running');
    }

    this.isRunning = true;
    this.resetStats();
    
    try {
      await this.initializeScraping();
      await this.performWorldwideScraping();
      this.completeScraping();
    } catch (error) {
      this.handleScrapingError(error);
    } finally {
      this.isRunning = false;
    }
  }

  private resetStats() {
    this.stats = {
      totalArticlesFound: 0,
      articlesProcessed: 0,
      articlesSkipped: 0,
      errors: 0,
      countriesProcessed: [],
      categoriesFound: [],
      startTime: new Date(),
      status: 'running'
    };
  }

  private async initializeScraping() {
    this.emitProgress('initializing', 0, 'Initializing Tavily client...');
    // Tavily SDK uses API key; no explicit init needed
    this.emitProgress('initializing', 10, 'Tavily client ready');
  }

  private async performWorldwideScraping() {
    console.log(`[SCRAPER] Starting worldwide scraping using Tavily`);
    this.emitProgress('searching', 15, `Searching latest news with Tavily...`);

    // Simple search like user's example
    const response = await tvly.search('India latest news', {
      maxResults: 10
    });

    const articles = (response?.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      country: this.detectCountryFromUrl(r.url) || 'INDIA'
    }));

    this.stats.totalArticlesFound = articles.length;
    console.log(`[SCRAPER] Found ${articles.length} articles`);
    
    if (articles.length === 0) {
      console.log(`[SCRAPER] No articles found`);
      return;
    }

    this.emitProgress('processing', 50, `Processing ${articles.length} articles...`);

    // Process each article
    for (const article of articles) {
      try {
        console.log(`Processing: ${article.title}`);
        
        // Check if exists
        const existing = await prisma.article.findFirst({
          where: { sourceUrl: article.url }
        });
        
        if (existing) {
          console.log(`Skipping existing: ${article.url}`);
          this.stats.articlesSkipped++;
          continue;
        }

        // Get full content
        const fullContent = await this.extractContent(article.url);
        if (!fullContent || fullContent.length < 100) {
          console.log(`Content too short: ${article.url}`);
          this.stats.articlesSkipped++;
          continue;
        }

        // Process with Gemini
        const newsArticle: NewsArticle = {
          title: article.title,
          content: fullContent,
          sourceUrl: article.url,
          publishedAt: new Date(),
          country: this.normalizeCountry(article.country)
        };

        const processed = await newsProcessor.processArticle(newsArticle);
        await this.saveProcessedArticle(processed);
        
        this.stats.articlesProcessed++;
        this.updateStatsFromArticle(processed);
        
        console.log(`✅ Saved: ${processed.dnaCode}`);
        
      } catch (error) {
        console.error(`Error processing ${article.url}:`, error);
        this.stats.errors++;
      }
    }
  }

  async startCountryTopicScraping(params: {
    countries: ReadonlyArray<SupportedCountry>;
    topics: ReadonlyArray<string>;
    date: string; // e.g., 03-09-2025
  }): Promise<void> {
    if (this.isRunning) {
      throw new Error('Scraping is already running');
    }

    this.isRunning = true;
    this.resetStats();

    try {
      await this.initializeScraping();
      console.log(`[SCRAPER] Starting country-topic scraping using Tavily`);
      const { countries, topics, date } = params;

      // Mapping topic keywords to category codes
      const topicToCategory = (topic: string): string => {
        const t = topic.toLowerCase();
        if (t.includes('polit')) return 'POL';
        if (t.includes('econom') || t.includes('finance') || t.includes('business')) return 'ECO';
        if (t.includes('societ') || t.includes('culture')) return 'SOC';
        if (t.includes('tech') || t.includes('ai')) return 'TEC';
        if (t.includes('env') || t.includes('climate')) return 'ENV';
        if (t.includes('health') || t.includes('covid') || t.includes('medical')) return 'HEA';
        if (t.includes('sport') || t.includes('cricket') || t.includes('football')) return 'SPO';
        if (t.includes('secur') || t.includes('defence') || t.includes('defense') || t.includes('milit')) return 'SEC';
        return 'ECO';
      };

      const countryName = (code: string): string => {
        switch (code) {
          case 'USA': return 'United States';
          case 'RUSSIA': return 'Russia';
          case 'INDIA': return 'India';
          case 'CHINA': return 'China';
          case 'JAPAN': return 'Japan';
          default: return code;
        }
      };

      const combos: Array<{ country: string; topic: string; category: string; query: string }> = [];
      for (const c of countries) {
        for (const topic of topics) {
          const category = topicToCategory(topic);
          const query = `${countryName(c)} ${topic} trending topics on ${date}`;
          combos.push({ country: c, topic, category, query });
        }
      }

      this.emitProgress('searching', 20, `Searching ${combos.length} country-topic queries...`);

      for (const combo of combos) {
        try {
          console.log(`[SCRAPER] Query: ${combo.query}`);
          const response = await tvly.search(combo.query, { maxResults: 5 });
          const results = (response?.results || []).slice(0, 5);
          this.stats.totalArticlesFound += results.length;

          const articles = results.map((r: any) => ({
            title: r.title,
            url: r.url,
            content: r.content,
            country: combo.country,
          }));

          // limit to 2 new articles per combo
          let processedForCombo = 0;
          for (const article of articles) {
            if (processedForCombo >= 2) break;

            try {
              // Skip if exists
              const existing = await prisma.article.findFirst({ where: { sourceUrl: article.url } });
              if (existing) {
                console.log(`Skipping existing: ${article.url}`);
                this.stats.articlesSkipped++;
                continue;
              }

              const fullContent = await this.extractContent(article.url);
              if (!fullContent || fullContent.length < 100) {
                console.log(`Content too short: ${article.url}`);
                this.stats.articlesSkipped++;
                continue;
              }

              const newsArticle: NewsArticle = {
                title: article.title,
                content: fullContent,
                sourceUrl: article.url,
                publishedAt: new Date(),
                country: this.normalizeCountry(article.country),
              };

              // Deterministic thread key per country-topic (no date) for similarity-based topic threading
              const topicSlug = combo.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              const threadKey = `${combo.country}-${topicSlug}`;
              const processed = await newsProcessor.processArticle(newsArticle, { forceCategory: combo.category, threadKey });
              await this.saveProcessedArticle(processed);
              this.stats.articlesProcessed++;
              this.updateStatsFromArticle(processed);
              processedForCombo++;
              console.log(`✅ Saved: ${processed.dnaCode}`);
            } catch (err) {
              console.error(`Error processing ${article.url}:`, err);
              this.stats.errors++;
            }
          }
        } catch (err) {
          console.error(`[SCRAPER] Error for query '${combo.query}':`, err);
          this.stats.errors++;
        }
      }

      this.completeScraping();
    } catch (error) {
      this.handleScrapingError(error);
    } finally {
      this.isRunning = false;
    }
  }

  private async saveProcessedArticle(article: ProcessedArticle) {
    this.emitProgress('saving', null, `Saving: ${article.title.substring(0, 50)}...`);

    console.log(`[DB] Attempting to save article to database:`);
    console.log(`[DB] - Title: ${article.title}`);
    console.log(`[DB] - DNA Code: ${article.dnaCode}`);
    console.log(`[DB] - Country: ${article.country}`);
    console.log(`[DB] - Category: ${article.category}`);
    console.log(`[DB] - Content length: ${article.content.length} chars`);
    console.log(`[DB] - Summary length: ${article.summary?.length || 0} chars`);
    console.log(`[DB] - Source URL: ${article.sourceUrl}`);
    console.log(`[DB] - Thread ID: ${article.threadId || 'none'}`);
    console.log(`[DB] - Parent ID: ${article.parentId || 'none'}`);

    // Validate required fields before saving
    if (!article.title || !article.content || !article.dnaCode || !article.summary) {
      throw new Error(`Missing required fields: title=${!!article.title}, content=${!!article.content}, dnaCode=${!!article.dnaCode}, summary=${!!article.summary}`);
    }

    // Retry logic for database operations
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[DB] Save attempt ${attempt}/${maxRetries} for: ${article.dnaCode}`);
        
        const savedArticle = await prisma.article.create({
          data: {
            title: article.title.trim(),
            content: article.content.trim(),
            summary: article.summary.trim(),
            sourceUrl: article.sourceUrl,
            publishedAt: article.publishedAt,
            country: article.country as any,
            category: article.category as any,
            dnaCode: article.dnaCode,
            threadId: article.threadId,
            parentId: article.parentId,
            year: new Date().getFullYear(),
            sequenceNum: parseInt(article.dnaCode.split('-')[3]) || 1
          }
        });
        
        console.log(`[DB] ✅ Successfully saved article: ${article.dnaCode} (ID: ${savedArticle.id})`);
        return savedArticle;
        
      } catch (dbError) {
        lastError = dbError as Error;
        console.error(`[DB] ❌ Save attempt ${attempt}/${maxRetries} failed for ${article.dnaCode}:`, dbError);
        
        if (dbError instanceof Error) {
          console.error(`[DB] Error message: ${dbError.message}`);
          
          // Check for specific error types
          if (dbError.message.includes('Unique constraint')) {
            console.log(`[DB] Duplicate article detected: ${article.dnaCode} - skipping`);
            return null; // Don't retry for duplicates
          }
          
          if (dbError.message.includes('Connection')) {
            console.log(`[DB] Connection error - will retry in ${attempt * 1000}ms`);
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
              continue;
            }
          }
        }
        
        if (attempt === maxRetries) {
          console.error(`[DB] All ${maxRetries} save attempts failed for ${article.dnaCode}`);
          throw lastError;
        }
      }
    }
  }

  private updateStatsFromArticle(article: ProcessedArticle) {
    if (!this.stats.countriesProcessed.includes(article.country)) {
      this.stats.countriesProcessed.push(article.country);
    }
    
    if (!this.stats.categoriesFound.includes(article.category)) {
      this.stats.categoriesFound.push(article.category);
    }
  }

  private detectCountryFromUrl(url: string): string {
    const u = new URL(url);
    const domain = u.hostname.toLowerCase();
    // Google News / Google domains with regional signals
    if (domain.includes('news.google') || domain.includes('google.')) {
      // Try query params first
      const gl = (u.searchParams.get('gl') || '').toUpperCase();
      const ceid = (u.searchParams.get('ceid') || '').toUpperCase(); // e.g., IN:en
      const region = gl || (ceid.split(':')[0] || '');
      const tld = domain.split('.').pop(); // e.g., 'in'
      const code = region || (tld === 'in' ? 'IN' : '');
      const map: Record<string, string> = { US: 'USA', IN: 'INDIA', GB: 'UK', AU: 'AUSTRALIA', BR: 'BRAZIL', CN: 'CHINA', JP: 'JAPAN', DE: 'GERMANY', FR: 'FRANCE', RU: 'RUSSIA' };
      if (code && map[code]) return map[code];
    }
     
    if (domain.includes('cnn.com') || domain.includes('nytimes.com') || domain.includes('wsj.com')) return 'USA';
    if (domain.includes('bbc.com') || domain.includes('theguardian.com')) return 'UK';
    if (domain.includes('rt.com') || domain.includes('tass.ru')) return 'RUSSIA';
    if (
      domain.includes('timesofindia.com') ||
      domain.includes('economictimes.com') ||
      domain.includes('hindustantimes.com') ||
      domain.includes('thehindu.com') ||
      domain.includes('indianexpress.com') ||
      domain.includes('livemint.com') ||
      domain.includes('business-standard.com') ||
      domain.includes('ndtv.com') ||
      domain.includes('news18.com') ||
      domain.includes('hindubusinessline.com')
    ) return 'INDIA';
    if (domain.includes('xinhua') || domain.includes('chinadaily.com')) return 'CHINA';
    if (domain.includes('japantimes.co.jp') || domain.includes('asahi.com')) return 'JAPAN';
    if (domain.includes('dw.com') || domain.includes('spiegel.de')) return 'GERMANY';
    if (domain.includes('lemonde.fr') || domain.includes('france24.com')) return 'FRANCE';
    if (domain.includes('globo.com') || domain.includes('folha.')) return 'BRAZIL';
    if (domain.includes('abc.net.au') || domain.includes('smh.com.au')) return 'AUSTRALIA';
    
    return 'UNKNOWN';
  }

  private normalizeCountry(country: string | undefined | null): any {
    // Ensure returned value matches Prisma enum Country
    const normalized = (country || '').toString().toUpperCase();
    const allowed = new Set(['USA','RUSSIA','INDIA','CHINA','JAPAN','UK','GERMANY','FRANCE','BRAZIL','AUSTRALIA']);
    if (allowed.has(normalized)) return normalized as any;
    // Default for India-focused scraping session
    return 'INDIA' as any;
  }

  private async extractContent(url: string): Promise<string | null> {
    try {
      const resp = await tvly.extract(
        [url],
        {
          extractDepth: 'basic',
          format: 'text',
          includeImages: false,
          timeout: 60,
        }
      );
      const item = resp?.results?.[0];
      const content: string | undefined = typeof item?.rawContent === 'string' ? item.rawContent : undefined;
      if (!content || content.length < 1) {
        return null;
      }
      return content;
    } catch (e) {
      console.error(`[TAVILY] Extract failed for ${url}:`, e);
      return null;
    }
  }

  private completeScraping() {
    this.stats.status = 'completed';
    this.stats.endTime = new Date();
    
    console.log(`[SCRAPER] 🎉 Scraping session completed!`);
    console.log(`[SCRAPER] Total time: ${((this.stats.endTime.getTime() - this.stats.startTime.getTime()) / 1000).toFixed(1)}s`);
    console.log(`[SCRAPER] Final results: ${this.stats.articlesProcessed} articles saved to database`);
    console.log(`[SCRAPER] Countries processed: ${this.stats.countriesProcessed.join(', ')}`);
    console.log(`[SCRAPER] Categories found: ${this.stats.categoriesFound.join(', ')}`);
    
    this.emitProgress('completed', 100, 
      `Scraping completed! Processed ${this.stats.articlesProcessed} articles from ${this.stats.countriesProcessed.length} countries`);
  }

  private handleScrapingError(error: any) {
    this.stats.status = 'error';
    this.stats.endTime = new Date();
    
    console.error(`[SCRAPER] ❌ Scraping session failed:`, error);
    if (error instanceof Error) {
      console.error(`[SCRAPER] Error message: ${error.message}`);
      console.error(`[SCRAPER] Error stack: ${error.stack}`);
    }
    console.log(`[SCRAPER] Stats at failure: ${this.stats.articlesProcessed} processed, ${this.stats.articlesSkipped} skipped, ${this.stats.errors} errors`);
    
    this.emit('error', error);
    this.emitProgress('completed', 100, `Scraping failed: ${error.message}`);
  }

  private emitProgress(stage: ScrapingProgress['stage'], progress: number | null, message: string) {
    const currentProgress = progress !== null ? progress : this.calculateProgress();
    
    const progressData: ScrapingProgress = {
      stage,
      progress: currentProgress,
      message,
      stats: { ...this.stats }
    };

    this.emit('progress', progressData);
  }

  private calculateProgress(): number {
    if (this.stats.totalArticlesFound === 0) return 0;
    return Math.round((this.stats.articlesProcessed / this.stats.totalArticlesFound) * 100);
  }

  async getScrapingHistory(limit: number = 10) {
    return await prisma.article.findMany({
      orderBy: { scrapedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        dnaCode: true,
        country: true,
        category: true,
        scrapedAt: true,
        summary: true
      }
    });
  }

  async getStatsOverview() {
    if (!this.isRunning) {
      console.log(`[DB] Fetching stats overview...`);
    }
    try {
    const totalArticles = await prisma.article.count();
    if (!this.isRunning) {
      console.log(`[DB] Total articles in database: ${totalArticles}`);
    }
    
    const countryCounts = await prisma.article.groupBy({
      by: ['country'],
      _count: {
        country: true
      },
      orderBy: {
        _count: {
          country: 'desc'
        }
      }
    });
    if (!this.isRunning) {
      console.log(`[DB] Articles by country:`, countryCounts);
    }

    const categoryCounts = await prisma.article.groupBy({
      by: ['category'],
      _count: {
        category: true
      },
      orderBy: {
        _count: {
          category: 'desc'
        }
      }
    });
    if (!this.isRunning) {
      console.log(`[DB] Articles by category:`, categoryCounts);
    }

    const recentArticles = await prisma.article.count({
      where: {
        scrapedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });
    if (!this.isRunning) {
      console.log(`[DB] Recent articles (24h): ${recentArticles}`);
    }

    return {
      totalArticles,
      countryCounts,
      categoryCounts,
      recentArticles,
      isRunning: this.isRunning,
      currentStats: this.stats
    };
    } catch (dbError) {
      console.error(`[DB] Error fetching stats:`, dbError);
      throw dbError;
    }
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getCurrentStats(): ScrapingStats {
    return { ...this.stats };
  }
}

export const newsScrapingService = new NewsScrapingService();
