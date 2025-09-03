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

  async searchWorldwideNews(query: string = 'breaking news', maxResults: number = 50): Promise<any[]> {
    console.log(`[MCP] Starting worldwide news search with query: "${query}", maxResults: ${maxResults}`);
    const allResults: any[] = [];
    
    for (const source of this.newsSources) {
      try {
        console.log(`[MCP] Searching ${source.country} news sources: ${source.sites.join(', ')}`);
        const siteQuery = `${query} site:${source.sites.join(' OR site:')}`;
        console.log(`[MCP] Search query for ${source.country}: ${siteQuery}`);
        
        // Use search_engine tool and parse HTML results
        const results = await this.sendRequest('tools/call', {
          name: 'search_engine',
          arguments: {
            query: siteQuery,
            max_results: Math.min(maxResults / this.newsSources.length, 10)
          }
        });

        console.log(`[MCP] Raw results for ${source.country}:`, results);
        
        // Parse HTML search results to extract articles
        let articleResults = [];
        if (results && results.results && Array.isArray(results.results)) {
          articleResults = this.parseSearchResults(results.results, source.country);
        } else if (results && typeof results === 'string') {
          // Parse HTML content
          articleResults = this.parseHTMLResults(results, source.country);
        } else if (results && Array.isArray(results)) {
          articleResults = this.parseSearchResults(results, source.country);
        }
        
        if (articleResults.length > 0) {
          console.log(`[MCP] Extracting ${articleResults.length} articles from ${source.country} results`);
          const processedResults = articleResults.filter(result => result.url && result.title);
          console.log(`[MCP] Found ${processedResults.length} articles from ${source.country}`);
          console.log(`[MCP] Sample from ${source.country}:`, processedResults.slice(0, 2).map(r => ({ title: r.title, url: r.url })));
          allResults.push(...processedResults);
        } else {
          console.log(`[MCP] No articles extracted from ${source.country} search results`);
        }
      } catch (error) {
        console.error(`[MCP] Error searching ${source.country} news:`, error);
        // Continue with other sources
      }
    }

    console.log(`[MCP] Total articles found across all countries: ${allResults.length}`);
    console.log(`[MCP] Sample articles:`, allResults.slice(0, 3).map(a => ({ title: a.title, url: a.url, country: a.country })));
    return allResults.slice(0, maxResults);
  }

  async searchNewsByCountry(country: string, query: string = 'breaking news'): Promise<any[]> {
    const source = this.newsSources.find(s => s.country === country);
    if (!source) {
      throw new Error(`Country ${country} not supported`);
    }

    console.log(`[MCP] Searching ${country} with query: ${query}`);
    const siteQuery = `${query} site:${source.sites.join(' OR site:')}`;
    
    const results = await this.sendRequest('tools/call', {
      name: 'search_engine',
      arguments: {
        query: siteQuery,
        max_results: 20
      }
    });

    console.log(`[MCP] Raw results for ${country}:`, results);
    
    // Parse HTML search results to extract articles
    let articleResults = [];
    if (results && results.results && Array.isArray(results.results)) {
      articleResults = this.parseSearchResults(results.results, country);
    } else if (results && typeof results === 'string') {
      articleResults = this.parseHTMLResults(results, country);
    } else if (results && Array.isArray(results)) {
      articleResults = this.parseSearchResults(results, country);
    }
    
    const processedResults = articleResults.filter(result => result.url && result.title);
      
    console.log(`[MCP] Found ${processedResults.length} articles for ${country}`);
    return processedResults;
  }

  async searchNewsByCategory(category: string, query: string = ''): Promise<any[]> {
    const searchQuery = query || `${category} news`;
    const allResults: any[] = [];

    for (const source of this.newsSources) {
      if (source.categories.includes(category.toLowerCase())) {
        try {
          const siteQuery = `${searchQuery} ${category} site:${source.sites.join(' OR site:')}`;
          
          const results = await this.sendRequest('tools/call', {
            name: 'search_engine',
            arguments: {
              query: siteQuery,
              max_results: 5
            }
          });

          if (results && Array.isArray(results)) {
            allResults.push(...results.map((result: any) => ({
              ...result,
              country: source.country,
              category: category
            })));
          }
        } catch (error) {
          console.error(`Error searching ${category} news for ${source.country}:`, error);
        }
      }
    }

    return allResults;
  }

  async scrapeArticle(url: string): Promise<string> {
    try {
      console.log(`[MCP] Starting to scrape article: ${url}`);
      const result = await this.sendRequest('tools/call', {
        name: 'scrape_as_markdown',
        arguments: {
          url: url
        }
      });

      const content = result?.content || result || '';
      console.log(`[MCP] Scraped ${content.length} characters from ${url}`);
      if (content.length < 100) {
        console.log(`[MCP] WARNING: Very short content scraped from ${url}: "${content.substring(0, 200)}"`);
      }
      return content;
    } catch (error) {
      console.error(`[MCP] Error scraping article ${url}:`, error);
      throw error;
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

  async close() {
    if (this.process) {
      this.process.kill();
    }
  }

  private parseSearchResults(results: any[], country: string): any[] {
    return results.map(result => ({
      title: result.title || result.snippet || 'Untitled',
      url: result.url || result.link,
      content: result.content || result.snippet || '',
      date: result.date || new Date().toISOString(),
      country: country,
      detectedCountry: country
    }));
  }

  private parseHTMLResults(htmlContent: string, country: string): any[] {
    console.log(`[MCP] Parsing HTML content for ${country} (${htmlContent.length} chars)`);
    const articles: any[] = [];
    
    // Extract URLs from HTML using regex patterns
    const urlPatterns = [
      /https?:\/\/[^\s<>"']+/g,
      /href=["']([^"']+)["']/g
    ];
    
    const foundUrls = new Set<string>();
    
    for (const pattern of urlPatterns) {
      const matches = htmlContent.match(pattern);
      if (matches) {
        matches.forEach(match => {
          let url = match;
          if (match.startsWith('href=')) {
            url = match.match(/href=["']([^"']+)["']/)?.[1] || '';
          }
          
          // Filter for news site URLs
          const newsSource = this.newsSources.find(s => s.country === country);
          if (newsSource && newsSource.sites.some(site => url.includes(site))) {
            foundUrls.add(url);
          }
        });
      }
    }
    
    // Convert URLs to article objects
    Array.from(foundUrls).slice(0, 10).forEach((url, index) => {
      articles.push({
        title: `News Article ${index + 1}`,
        url: url,
        content: '',
        date: new Date().toISOString(),
        country: country,
        detectedCountry: country
      });
    });
    
    console.log(`[MCP] Extracted ${articles.length} URLs from HTML for ${country}`);
    return articles;
  }
}

export const brightDataMCP = new BrightDataMCP();
