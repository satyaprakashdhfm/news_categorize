import { brightDataMCP } from './brightdata-mcp';
import { newsProcessor, NewsArticle, ProcessedArticle } from './langchain-agents';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

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
    this.emitProgress('initializing', 0, 'Initializing Bright Data MCP connection...');
    
    await brightDataMCP.initialize();
    
    this.emitProgress('initializing', 10, 'MCP connection established');
  }

  private async performWorldwideScraping() {
    const supportedCountries = brightDataMCP.getSupportedCountries();
    const totalCountries = supportedCountries.length;

    console.log(`[SCRAPER] Starting worldwide scraping across ${totalCountries} countries`);
    console.log(`[SCRAPER] Supported countries: ${supportedCountries.join(', ')}`);
    this.emitProgress('searching', 15, `Starting search across ${totalCountries} countries...`);

    // Search for news across all countries
    console.log(`[SCRAPER] Calling MCP searchWorldwideNews...`);
    const allNews = await brightDataMCP.searchWorldwideNews('breaking news latest', 100);
    this.stats.totalArticlesFound = allNews.length;

    console.log(`[SCRAPER] MCP returned ${allNews.length} total articles`);
    console.log(`[SCRAPER] Sample articles from MCP:`, allNews.slice(0, 2).map(n => ({ 
      title: n.title, 
      url: n.url, 
      country: n.detectedCountry || n.country 
    })));
    this.emitProgress('searching', 30, `Found ${allNews.length} articles worldwide`);

    if (allNews.length === 0) {
      console.log(`[SCRAPER] ❌ No articles found by MCP! Scraping will complete with 0 results.`);
      return;
    }

    // Process articles in batches
    const batchSize = 5;
    const totalBatches = Math.ceil(allNews.length / batchSize);

    console.log(`[SCRAPER] Processing ${allNews.length} articles in ${totalBatches} batches of ${batchSize}`);
    
    for (let i = 0; i < allNews.length; i += batchSize) {
      const batch = allNews.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;
      
      console.log(`[SCRAPER] Processing batch ${currentBatch}/${totalBatches} with ${batch.length} articles`);
      this.emitProgress('scraping', 30 + (currentBatch / totalBatches) * 40, 
        `Processing batch ${currentBatch}/${totalBatches}...`);

      await this.processBatch(batch);
      console.log(`[SCRAPER] Completed batch ${currentBatch}/${totalBatches}. Stats: processed=${this.stats.articlesProcessed}, skipped=${this.stats.articlesSkipped}, errors=${this.stats.errors}`);
    }
    
    console.log(`[SCRAPER] ✅ Worldwide scraping complete!`);
    console.log(`[SCRAPER] Final stats: ${this.stats.articlesProcessed} processed, ${this.stats.articlesSkipped} skipped, ${this.stats.errors} errors`);
  }

  private async processBatch(newsItems: any[]) {
    const promises = newsItems.map(async (newsItem) => {
      try {
        console.log(`Processing article: ${newsItem.title || 'Untitled'} from ${newsItem.url}`);
        
        // Check if article already exists
        const existingArticle = await prisma.article.findFirst({
          where: { sourceUrl: newsItem.url }
        });

        if (existingArticle) {
          console.log(`Skipping existing article: ${newsItem.url}`);
          this.stats.articlesSkipped++;
          return;
        }

        // Scrape full article content
        this.emitProgress('scraping', null, `Scraping: ${newsItem.title?.substring(0, 50)}...`);
        console.log(`Scraping content from: ${newsItem.url}`);
        const content = await brightDataMCP.scrapeArticle(newsItem.url);

        if (!content || content.length < 100) {
          console.log(`Content too short or empty for ${newsItem.url}: ${content?.length || 0} chars`);
          this.stats.articlesSkipped++;
          return;
        }

        console.log(`Scraped ${content.length} characters from ${newsItem.url}`);
        
        // Create NewsArticle object
        const article: NewsArticle = {
          title: newsItem.title || 'Untitled',
          content: content,
          sourceUrl: newsItem.url,
          publishedAt: new Date(newsItem.date || Date.now()),
          country: newsItem.detectedCountry || this.detectCountryFromUrl(newsItem.url)
        };

        // Process with AI
        this.emitProgress('processing', null, `AI processing: ${article.title.substring(0, 50)}...`);
        console.log(`Starting AI processing for: ${article.title}`);
        const processedArticle = await newsProcessor.processArticle(article);
        console.log(`AI processing complete. Category: ${processedArticle.category}, DNA: ${processedArticle.dnaCode}`);

        // Save to database
        console.log(`Saving to database: ${processedArticle.dnaCode}`);
        await this.saveProcessedArticle(processedArticle);
        console.log(`Successfully saved: ${processedArticle.dnaCode}`);

        this.stats.articlesProcessed++;
        this.updateStatsFromArticle(processedArticle);

      } catch (error) {
        console.error(`Error processing article ${newsItem.url}:`, error);
        if (error instanceof Error) {
          console.error(`Error details: ${error.message}`);
          console.error(`Stack trace: ${error.stack}`);
        }
        this.stats.errors++;
      }
    });

    await Promise.all(promises);
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

    try {
    await prisma.article.create({
      data: {
        title: article.title,
        content: article.content,
        summary: article.summary,
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
    console.log(`[DB] Successfully saved article: ${article.dnaCode}`);
    } catch (dbError) {
      console.error(`[DB] Failed to save article ${article.dnaCode}:`, dbError);
      if (dbError instanceof Error) {
        console.error(`[DB] Error message: ${dbError.message}`);
        console.error(`[DB] Error stack: ${dbError.stack}`);
      }
      throw dbError;
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
    const domain = new URL(url).hostname.toLowerCase();
    
    if (domain.includes('cnn.com') || domain.includes('nytimes.com') || domain.includes('wsj.com')) return 'USA';
    if (domain.includes('bbc.com') || domain.includes('theguardian.com')) return 'UK';
    if (domain.includes('rt.com') || domain.includes('tass.ru')) return 'RUSSIA';
    if (domain.includes('timesofindia.com') || domain.includes('hindustantimes.com')) return 'INDIA';
    if (domain.includes('xinhua') || domain.includes('chinadaily.com')) return 'CHINA';
    if (domain.includes('japantimes.co.jp') || domain.includes('asahi.com')) return 'JAPAN';
    if (domain.includes('dw.com') || domain.includes('spiegel.de')) return 'GERMANY';
    if (domain.includes('lemonde.fr') || domain.includes('france24.com')) return 'FRANCE';
    if (domain.includes('globo.com') || domain.includes('folha.')) return 'BRAZIL';
    if (domain.includes('abc.net.au') || domain.includes('smh.com.au')) return 'AUSTRALIA';
    
    return 'UNKNOWN';
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
    console.log(`[DB] Fetching stats overview...`);
    try {
    const totalArticles = await prisma.article.count();
    console.log(`[DB] Total articles in database: ${totalArticles}`);
    
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
    console.log(`[DB] Articles by country:`, countryCounts);

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
    console.log(`[DB] Articles by category:`, categoryCounts);

    const recentArticles = await prisma.article.count({
      where: {
        scrapedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });
    console.log(`[DB] Recent articles (24h): ${recentArticles}`);

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
