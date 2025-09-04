import { spawn } from 'child_process';
import { EventEmitter } from 'events';

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: any;
}

interface NewsSource {
  country: string;
  sites: string[];
  categories: string[];
}

interface ArticleURL {
  url: string;
  title: string;
  snippet?: string;
  source: string;
  country: string;
}

interface ArticleContent {
  url: string;
  title: string;
  content: string;
  publishedDate?: string;
  author?: string;
  source: string;
  country: string;
  category?: string;
}

export class BrightDataMCP extends EventEmitter {
  private process: any;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  
  // Comprehensive worldwide news sources
  private newsSources: NewsSource[] = [
    {
      country: 'USA',
      sites: ['cnn.com', 'reuters.com', 'apnews.com', 'wsj.com', 'nytimes.com', 'washingtonpost.com', 'usatoday.com', 'nbcnews.com'],
      categories: ['politics', 'business', 'technology', 'health', 'sports', 'entertainment']
    },
    {
      country: 'RUSSIA',
      sites: ['rt.com', 'tass.ru', 'interfax.ru', 'ria.ru', 'sputniknews.com'],
      categories: ['politics', 'economy', 'society', 'technology', 'sports']
    },
    {
      country: 'INDIA',
      sites: ['timesofindia.com', 'hindustantimes.com', 'thehindu.com', 'indianexpress.com', 'ndtv.com', 'firstpost.com'],
      categories: ['politics', 'business', 'technology', 'health', 'sports', 'entertainment']
    },
    {
      country: 'CHINA',
      sites: ['xinhuanet.com', 'chinadaily.com.cn', 'globaltimes.cn', 'scmp.com', 'cctv.com'],
      categories: ['politics', 'economy', 'technology', 'society', 'sports']
    },
    {
      country: 'JAPAN',
      sites: ['japantimes.co.jp', 'mainichi.jp', 'asahi.com', 'nikkei.com', 'kyodonews.net'],
      categories: ['politics', 'business', 'technology', 'society', 'sports', 'entertainment']
    },
    {
      country: 'UK',
      sites: ['bbc.com', 'theguardian.com', 'reuters.com', 'sky.com', 'independent.co.uk', 'telegraph.co.uk'],
      categories: ['politics', 'business', 'technology', 'health', 'sports', 'entertainment']
    },
    {
      country: 'GERMANY',
      sites: ['dw.com', 'spiegel.de', 'zeit.de', 'bild.de', 'welt.de'],
      categories: ['politics', 'economy', 'technology', 'society', 'sports']
    },
    {
      country: 'FRANCE',
      sites: ['lemonde.fr', 'lefigaro.fr', 'france24.com', 'rfi.fr'],
      categories: ['politics', 'economy', 'technology', 'society', 'sports']
    },
    {
      country: 'BRAZIL',
      sites: ['folha.uol.com.br', 'globo.com', 'uol.com.br', 'estadao.com.br'],
      categories: ['politics', 'economy', 'technology', 'society', 'sports']
    },
    {
      country: 'AUSTRALIA',
      sites: ['abc.net.au', 'smh.com.au', 'theaustralian.com.au', 'news.com.au'],
      categories: ['politics', 'business', 'technology', 'health', 'sports']
    }
  ];

  constructor() {
    super();
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      try {
        // Try to spawn the MCP process
        if (process.platform === 'win32') {
          // Use cmd.exe to avoid EINVAL when spawning .cmd directly
          const cmd = process.env.comspec || 'cmd.exe';
          const command = 'npx -y @brightdata/mcp';
          this.process = spawn(cmd, ['/d', '/s', '/c', command], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
              ...process.env,
              API_TOKEN: process.env.BRIGHT_DATA_API_KEY,
              PRO_MODE: 'false'
            },
            shell: false,
            windowsHide: true,
          });
        } else {
          this.process = spawn('npx', ['-y', '@brightdata/mcp'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
              ...process.env,
              API_TOKEN: process.env.BRIGHT_DATA_API_KEY,
              PRO_MODE: 'false'
            },
            shell: false,
          });
        }

        this.process.stdout.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(line => line.trim());
          lines.forEach(line => {
            try {
              const response: MCPResponse = JSON.parse(line);
              this.handleResponse(response);
            } catch (e) {
              console.log('MCP Output:', line); // Regular output, not error
            }
          });
        });

        this.process.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          // Bright Data MCP often writes normal logs to stderr; don’t flag all as errors
          if (/\berror\b/i.test(text) && !/\[search_engine\]/i.test(text)) {
            console.error('MCP Error:', text.trim());
          } else {
            console.log('MCP Log:', text.trim());
          }
        });

        this.process.on('error', (error: Error) => {
          console.error('Failed to start MCP process:', error.message);
          if (error.message.includes('ENOENT')) {
            reject(new Error('Bright Data MCP package not found. Please install with: npm install @brightdata/mcp'));
          } else {
            reject(error);
          }
        });

        this.process.on('spawn', () => {
          console.log('Bright Data MCP process started successfully');
        });
        
        // Wait a moment for the process to initialize
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            console.log('Bright Data MCP initialized successfully');
            resolve(true);
          } else {
            reject(new Error('MCP process failed to start'));
          }
        }, 3000);

      } catch (error) {
        console.error('Error initializing Bright Data MCP:', error);
        reject(error);
      }
    });
  }

  private handleResponse(response: MCPResponse) {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.process) {
      throw new Error('MCP not initialized. Call initialize() first.');
    }

    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      // Add timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 60000); // Increased to 60s for slower international searches

      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Step 1: Discovery - Find article URLs using search_engine
   * Returns clean URLs without fetching content
   */
  async discoverArticleURLs(query: string = 'breaking news', maxResults: number = 50): Promise<ArticleURL[]> {
    console.log(`[MCP] Discovering article URLs with query: "${query}", maxResults: ${maxResults}`);
    const allURLs: ArticleURL[] = [];
    
    for (const source of this.newsSources) {
      try {
        console.log(`[MCP] Discovering URLs from ${source.country} news sources`);
        const siteQuery = `${query} site:${source.sites.join(' OR site:')}`;
        
        const results = await this.sendRequest('tools/call', {
          name: 'search_engine',
          arguments: {
            query: siteQuery,
            max_results: Math.min(maxResults / this.newsSources.length, 10)
          }
        });

        if (results && results.results && Array.isArray(results.results)) {
          const urls = this.extractURLsFromSearchResults(results.results, source.country);
          allURLs.push(...urls);
          console.log(`[MCP] Found ${urls.length} URLs from ${source.country}`);
        }
      } catch (error) {
        console.error(`[MCP] Error discovering URLs from ${source.country}:`, error);
      }
    }

    console.log(`[MCP] Total URLs discovered: ${allURLs.length}`);
    return allURLs.slice(0, maxResults);
  }

  /**
   * Step 2: Content Retrieval - Fetch full article content using scrape_as_markdown
   * For static pages
   */
  async fetchArticleContent(url: string): Promise<ArticleContent | null> {
    try {
      console.log(`[MCP] Fetching article content from: ${url}`);
      
      const result = await this.sendRequest('tools/call', {
        name: 'scrape_as_markdown',
        arguments: {
          url: url
        }
      });

      if (!result || !result.content) {
        console.warn(`[MCP] No content retrieved from ${url}`);
        return null;
      }

      const content = result.content;
      console.log(`[MCP] Retrieved ${content.length} characters from ${url}`);

      // Parse title and other metadata from markdown content
      const title = this.extractTitleFromMarkdown(content) || 'Untitled Article';
      const source = this.getSourceFromURL(url);
      const country = this.getCountryFromURL(url);

      return {
        url,
        title,
        content,
        publishedDate: result.publishedDate || new Date().toISOString(),
        author: result.author,
        source,
        country
      };
    } catch (error) {
      console.error(`[MCP] Error fetching content from ${url}:`, error);
      return null;
    }
  }

  /**
   * Step 2 Alternative: Content Retrieval for dynamic pages using browser automation
   */
  async fetchDynamicArticleContent(url: string): Promise<ArticleContent | null> {
    try {
      console.log(`[MCP] Fetching dynamic article content from: ${url}`);
      
      // Navigate to the URL
      await this.sendRequest('tools/call', {
        name: 'scraping_browser_navigate',
        arguments: {
          url: url
        }
      });

      // Wait for article content to load
      await this.sendRequest('tools/call', {
        name: 'scraping_browser_wait_for',
        arguments: {
          selector: 'article, .article-body, .content, main, [role="main"]',
          timeout: 10000
        }
      });

      // Get the rendered content
      const result = await this.sendRequest('tools/call', {
        name: 'scraping_browser_get_text',
        arguments: {
          selector: 'article, .article-body, .content, main'
        }
      });

      if (!result || !result.text) {
        // Fallback to getting all page text
        const fallbackResult = await this.sendRequest('tools/call', {
          name: 'scraping_browser_get_text',
          arguments: {}
        });
        
        if (!fallbackResult || !fallbackResult.text) {
          console.warn(`[MCP] No content retrieved from dynamic page ${url}`);
          return null;
        }
        
        result.text = fallbackResult.text;
      }

      const content = result.text;
      console.log(`[MCP] Retrieved ${content.length} characters from dynamic page ${url}`);

      // Get title
      const titleResult = await this.sendRequest('tools/call', {
        name: 'scraping_browser_get_text',
        arguments: {
          selector: 'h1, title, .headline, .article-title'
        }
      });

      const title = titleResult?.text || 'Untitled Article';
      const source = this.getSourceFromURL(url);
      const country = this.getCountryFromURL(url);

      return {
        url,
        title,
        content,
        publishedDate: new Date().toISOString(),
        source,
        country
      };
    } catch (error) {
      console.error(`[MCP] Error fetching dynamic content from ${url}:`, error);
      return null;
    }
  }

  /**
   * Step 3: Complete pipeline - Discovery + Content Retrieval
   */
  async getCompleteArticles(query: string = 'breaking news', maxResults: number = 20): Promise<ArticleContent[]> {
    console.log(`[MCP] Starting complete article pipeline for query: "${query}"`);
    
    // Step 1: Discover URLs
    const urls = await this.discoverArticleURLs(query, maxResults * 2); // Get more URLs than needed
    
    // Step 2: Fetch content for each URL
    const articles: ArticleContent[] = [];
    const maxConcurrent = 5; // Limit concurrent requests
    
    for (let i = 0; i < urls.length && articles.length < maxResults; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      const promises = batch.map(async (urlInfo) => {
        try {
          const content = await this.fetchArticleContent(urlInfo.url);
          return content;
        } catch (error) {
          console.error(`[MCP] Error processing ${urlInfo.url}:`, error);
          return null;
        }
      });
      
      const results = await Promise.allSettled(promises);
      const successfulResults = results
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => (result as PromiseFulfilledResult<ArticleContent>).value);
      
      articles.push(...successfulResults);
      console.log(`[MCP] Processed batch ${Math.floor(i/maxConcurrent) + 1}, total articles: ${articles.length}`);
    }

    console.log(`[MCP] Complete pipeline finished with ${articles.length} articles`);
    return articles;
  }

  /**
   * Session monitoring - Track API usage
   */
  async getSessionStats(): Promise<any> {
    try {
      const stats = await this.sendRequest('tools/call', {
        name: 'session_stats',
        arguments: {}
      });
      
      console.log('[MCP] Session stats:', stats);
      return stats;
    } catch (error) {
      console.error('[MCP] Error getting session stats:', error);
      return null;
    }
  }

  // Legacy methods updated to use new architecture
  async searchWorldwideNews(query: string = 'breaking news', maxResults: number = 50): Promise<any[]> {
    const articles = await this.getCompleteArticles(query, maxResults);
    return articles.map(article => ({
      title: article.title,
      url: article.url,
      content: article.content.substring(0, 500) + '...', // Truncate for compatibility
      date: article.publishedDate,
      country: article.country,
      detectedCountry: article.country
    }));
  }

  async searchNewsByCountry(country: string, query: string = 'breaking news'): Promise<any[]> {
    const source = this.newsSources.find(s => s.country === country);
    if (!source) {
      throw new Error(`Country ${country} not supported`);
    }

    console.log(`[MCP] Searching ${country} with query: ${query}`);
    const siteQuery = `${query} site:${source.sites.join(' OR site:')}`;
    
    // Step 1: Discover URLs
    const results = await this.sendRequest('tools/call', {
      name: 'search_engine',
      arguments: {
        query: siteQuery,
        max_results: 20
      }
    });

    if (!results || !results.results || !Array.isArray(results.results)) {
      return [];
    }

    const urls = this.extractURLsFromSearchResults(results.results, country);
    
    // Step 2: Fetch content for a subset
    const articles: any[] = [];
    for (const urlInfo of urls.slice(0, 10)) {
      try {
        const content = await this.fetchArticleContent(urlInfo.url);
        if (content) {
          articles.push({
            title: content.title,
            url: content.url,
            content: content.content.substring(0, 500) + '...',
            date: content.publishedDate,
            country: content.country,
            detectedCountry: content.country
          });
        }
      } catch (error) {
        console.error(`[MCP] Error processing ${urlInfo.url}:`, error);
      }
    }
    
    console.log(`[MCP] Found ${articles.length} complete articles for ${country}`);
    return articles;
  }

  async searchNewsByCategory(category: string, query: string = 'breaking news'): Promise<any[]> {
    const supported = this.getSupportedCategories();
    if (!supported.includes(category)) {
      throw new Error(`Category ${category} not supported`);
    }

    // Collect all sites that publish this category across countries
    const matchedSources = this.newsSources.filter(s => s.categories.includes(category));
    const sites = matchedSources.flatMap(s => s.sites);
    if (sites.length === 0) {
      return [];
    }

    console.log(`[MCP] Searching category ${category} with query: ${query}`);
    const siteQuery = `${query} ${category} site:${sites.join(' OR site:')}`;

    // Step 1: Discover URLs
    const results = await this.sendRequest('tools/call', {
      name: 'search_engine',
      arguments: {
        query: siteQuery,
        max_results: 20
      }
    });

    if (!results || !results.results || !Array.isArray(results.results)) {
      return [];
    }

    const urls = this.extractURLsFromSearchResults(results.results, 'GLOBAL');

    // Step 2: Fetch content for a subset
    const articles: any[] = [];
    for (const urlInfo of urls.slice(0, 10)) {
      try {
        const content = await this.fetchArticleContent(urlInfo.url);
        if (content) {
          articles.push({
            title: content.title,
            url: content.url,
            content: content.content.substring(0, 500) + '...',
            date: content.publishedDate,
            country: content.country,
            detectedCountry: content.country,
            category
          });
        }
      } catch (error) {
        console.error(`[MCP] Error processing ${urlInfo.url}:`, error);
      }
    }

    console.log(`[MCP] Found ${articles.length} complete articles for category ${category}`);
    return articles;
  }

  // Helper methods for new architecture
  private extractURLsFromSearchResults(results: any[], country: string): ArticleURL[] {
    const urls: ArticleURL[] = [];
    
    for (const result of results) {
      if (result.url || result.link) {
        const url = result.url || result.link;
        const source = this.getSourceFromURL(url);
        
        urls.push({
          url,
          title: result.title || result.snippet || 'Untitled',
          snippet: result.snippet || result.description,
          source,
          country
        });
      }
    }
    
    return urls;
  }

  private extractTitleFromMarkdown(content: string): string | null {
    // Look for markdown h1 headers or HTML title tags
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }
    
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
    
    // Look for first line that looks like a title
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length > 10 && firstLine.length < 200) {
        return firstLine;
      }
    }
    
    return null;
  }

  private getSourceFromURL(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  private getCountryFromURL(url: string): string {
    const source = this.getSourceFromURL(url);
    
    for (const newsSource of this.newsSources) {
      if (newsSource.sites.some(site => source.includes(site))) {
        return newsSource.country;
      }
    }
    
    return 'UNKNOWN';
  }

  async close() {
    if (this.process) {
      this.process.kill();
    }
  }

  getSupportedCountries(): string[] {
    return this.newsSources.map(source => source.country);
  }

  getSupportedCategories(): string[] {
    const categories = new Set<string>();
    this.newsSources.forEach(source => {
      source.categories.forEach(cat => categories.add(cat));
    });
    return Array.from(categories);
  }
}

export const brightDataMCP = new BrightDataMCP();
