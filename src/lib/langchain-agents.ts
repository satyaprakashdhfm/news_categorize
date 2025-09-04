import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface NewsArticle {
  title: string;
  content?: string;
  sourceUrl: string;
  publishedAt: Date;
  country: string;
}

export interface ProcessedArticle extends NewsArticle {
  category: string;
  dnaCode: string;
  summary?: string;
  threadId?: string;
  parentId?: string;
}

export interface ProcessOptions {
  forceCategory?: string;
  threadKey?: string; // deterministic thread identifier, e.g., COUNTRY-topic-slug
}

export class NewsProcessor {
  private llm: ChatGoogleGenerativeAI;
  // Maps a deterministic threadKey (e.g., COUNTRY-topic-slug) to the actual DB StoryThread.id for this run
  private threadKeyCache: Map<string, string> = new Map();

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('[GEMINI] FATAL: GOOGLE_API_KEY is not set in the environment variables.');
      throw new Error('GOOGLE_API_KEY is not set.');
    }

    this.llm = new ChatGoogleGenerativeAI({
      apiKey,
      modelName: 'gemini-2.5-flash',
      temperature: 0.1,
    });
    console.log('[GEMINI] Gemini client initialized successfully.');
  }

  private async classifyCategory(title: string, content: string): Promise<string> {
    console.log(`[GEMINI] Starting category classification for: "${title.substring(0, 50)}..."`);
    console.log(`[GEMINI] Content length for classification: ${content.length} chars`);
    
    const messages = [
      { role: 'system', content: 'You are a news categorization expert. Classify articles into exactly one of these categories: POL (Politics), ECO (Economy), SOC (Society), TEC (Technology), ENV (Environment), HEA (Health), SPO (Sports), SEC (Security). Return ONLY the 3-letter code.' },
      { role: 'user', content: `Title: ${title}\n\nContent: ${content.substring(0, 2000)}` }
    ];

    try {
      console.log(`[GEMINI] Sending classification request to Gemini...`);
      const response = await this.llm.invoke(messages);
      const category = response.content.toString().trim().toUpperCase();
      console.log(`[GEMINI] Category classification result: ${category}`);
      
      const validCategories = ['POL', 'ECO', 'SOC', 'TEC', 'ENV', 'HEA', 'SPO', 'SEC'];
      if (!validCategories.includes(category)) {
        console.log(`[GEMINI] Invalid category "${category}", defaulting to ECO`);
        return 'ECO'; // Default fallback
      }
      
      return category;
    } catch (error) {
      console.error(`[GEMINI] Error in category classification:`, error);
      console.log(`[GEMINI] Falling back to ECO category due to error`);
      return 'ECO'; // Fallback instead of throwing
    }
  }

  private async findThreading(title: string, url: string, category: string, existingArticles: any[]): Promise<string> {
    if (existingArticles.length === 0) {
      console.log(`[GEMINI] No existing articles to compare against - creating new thread`);
      return 'NEW_THREAD';
    }

    console.log(`[GEMINI] Starting threading analysis for: "${title.substring(0, 50)}..."`);
    console.log(`[GEMINI] Analyzing against ${existingArticles.length} existing articles`);
    
    const messages = [
      { role: 'system', content: "Decide if the NEW article should be threaded with one of the EXISTING articles. Choose the SINGLE most relevant existing article if related. Return EXACTLY the chosen article's ID string. If none are related, return 'NEW_THREAD'. Return only a bare ID or NEW_THREAD with no extra text." },
      { role: 'user', content: `New Article:\nTitle: ${title}\nURL: ${url}\n\nExisting Articles (ID | Title | URL):\n${existingArticles.slice(0, 5).map(art => `${art.id} | ${art.title} | ${art.sourceUrl || 'N/A'}`).join('\n')}\n\nReturn ONLY one of: DUPLICATE, ${existingArticles.slice(0, 5).map(a => a.id).join(', ')}, or NEW_THREAD.` }
    ];
    
    try {
      console.log(`[GEMINI] Sending threading request to Gemini...`);
      const response = await this.llm.invoke(messages);
      const threadingResult = response.content.toString().trim();
      console.log(`[GEMINI] Threading analysis result: ${threadingResult}`);
      return threadingResult;
    } catch (error) {
      console.error(`[GEMINI] Error in threading analysis:`, error);
      console.log(`[GEMINI] Falling back to NEW_THREAD due to error`);
      return 'NEW_THREAD'; // Default to new thread on error
    }
  }

  async processArticle(article: NewsArticle, options?: ProcessOptions): Promise<ProcessedArticle> {
    try {
      console.log(`[AI] Starting processing for article: ${article.title}`);
      console.log(`[AI] Article content length: ${article.content?.length} chars`);
      
      // Step 1: Category selection (forced or model)
      if (options?.forceCategory) {
        console.log(`[AI] Step 1: Using forced category mode`);
      } else {
        console.log(`[AI] Step 1: Categorizing article...`);
      }
      let category: string;
      if (options?.forceCategory) {
        const forced = options.forceCategory.toUpperCase();
        const valid = ['POL', 'ECO', 'SOC', 'TEC', 'ENV', 'HEA', 'SPO', 'SEC'];
        if (valid.includes(forced)) {
          console.log(`[AI] Using forced category: ${forced}`);
          category = forced;
        } else {
          console.log(`[AI] forceCategory '${options.forceCategory}' is invalid; falling back to model classification`);
          category = await this.classifyCategory(
            article.title,
            article.content?.substring(0, 2000) || ''
          );
        }
      } else {
        category = await this.classifyCategory(
          article.title,
          article.content?.substring(0, 2000) || ''
        );
      }
      console.log(`[AI] Category determined: ${category}`);
      
      // Step 3: Generate DNA code
      console.log(`[AI] Step 3: Generating DNA code...`);
      const year = new Date().getFullYear();
      const sequenceNum = await this.getNextSequenceNumber(article.country, category, year);
      const dnaCode = `${article.country}-${category}-${year}-${sequenceNum.toString().padStart(3, '0')}`;
      console.log(`[AI] DNA code generated: ${dnaCode}`);
      
      // Step 4: Threading
      console.log(`[AI] Step 4: Threading...`);
      let parentId: string | undefined;
      let threadId: string | undefined;
      if (options?.threadKey) {
        const key = options.threadKey;
        // Resolve threadKey to an actual StoryThread.id using an in-memory cache for this scraping session
        let resolvedThreadId = this.threadKeyCache.get(key);
        if (!resolvedThreadId) {
          console.log(`[AI] ThreadKey received: ${key}. No cached thread found. Creating/fetching StoryThread...`);
          // Create a deterministic thread for this key (session-scoped). We store the key as the thread title for visibility.
          const newThread = await prisma.storyThread.create({
            data: {
              title: key.substring(0, 120),
              description: null,
              country: article.country as any,
              category: category as any,
              startDate: article.publishedAt,
              articleCount: 0,
            },
            select: { id: true },
          });
          resolvedThreadId = newThread.id;
          this.threadKeyCache.set(key, resolvedThreadId);
          console.log(`[AI] Created StoryThread for key '${key}'. DB id: ${resolvedThreadId}`);
        }
        threadId = resolvedThreadId;
        // Find the most recent article in this thread to link as parent
        const lastInThread = await prisma.article.findFirst({
          where: { threadId: resolvedThreadId },
          orderBy: { scrapedAt: 'desc' },
          select: { id: true },
        });
        if (lastInThread) {
          parentId = lastInThread.id;
          console.log(`[AI] ThreadKey mapped. Linking to last article in thread: ${parentId}`);
        } else {
          console.log(`[AI] New thread (no previous articles) for key '${key}'.`);
        }
      } else {
        // Fallback to LLM-based threading by similarity/category
        const existingArticles = await this.getExistingArticles(article.country, category);
        console.log(`[AI] Found ${existingArticles.length} existing articles for threading analysis`);
        const threadingDecision = await this.findThreading(
          article.title,
          article.sourceUrl,
          category,
          existingArticles
        );
        console.log(`[AI] Threading decision: ${threadingDecision}`);
        if (threadingDecision !== 'NEW_THREAD') {
          const cleaned = threadingDecision.replace(/[`"'\s]/g, '').trim();
          const matchById = existingArticles.find(a => a.id === cleaned);
          if (matchById) {
            parentId = matchById.id;
          } else {
            const matchByDna = existingArticles.find(a => a.dnaCode === cleaned);
            if (matchByDna) {
              parentId = matchByDna.id;
            } else {
              const dbByDna = await prisma.article.findFirst({
                where: { dnaCode: cleaned },
                select: { id: true, threadId: true }
              });
              if (dbByDna) {
                parentId = dbByDna.id;
                threadId = dbByDna.threadId || undefined;
              }
            }
          }
          if (parentId) {
            const parentArticle = await prisma.article.findUnique({ where: { id: parentId } });
            threadId = threadId || parentArticle?.threadId || undefined;
            console.log(`[AI] Linked to parent: ${parentId}, thread: ${threadId}`);
          } else {
            console.log(`[AI] Could not resolve threading decision to a valid parent; creating NEW_THREAD`);
          }
        } else {
          console.log(`[AI] Creating new thread`);
        }
      }
       
      // Ensure every saved article has a threadId
      if (!threadId) {
        const newThread = await prisma.storyThread.create({
          data: {
            title: article.title.substring(0, 120),
            description: null,
            country: article.country as any,
            category: category as any,
            startDate: article.publishedAt,
            articleCount: 0,
          },
          select: { id: true }
        });
        threadId = newThread.id;
        console.log(`[AI] Auto-created NEW_THREAD (no previous thread available): ${threadId}`);
      }
      
      console.log(`[AI] Processing complete for: ${dnaCode}`);
      return {
        ...article,
        category,
        dnaCode,
        summary: undefined,
        parentId,
        threadId,
      };
    } catch (error) {
      console.error(`[AI] Error processing article "${article.title}":`, error);
      if (error instanceof Error) {
        console.error(`[AI] Error details: ${error.message}`);
      }
      throw error;
    }
  }

  private async getNextSequenceNumber(country: string, category: string, year: number): Promise<number> {
    console.log(`[DB] Getting next sequence number for ${country}-${category}-${year}`);
    try {
      const lastArticle = await prisma.article.findFirst({
        where: {
          country: country as any,
          category: category as any,
          year,
        },
        orderBy: {
          sequenceNum: 'desc',
        },
      });

      const nextSeq = lastArticle ? lastArticle.sequenceNum + 1 : 1;
      console.log(`[DB] Next sequence number: ${nextSeq} (last was ${lastArticle?.sequenceNum || 0})`);
      return nextSeq;
    } catch (error) {
      console.error(`[DB] Error getting sequence number:`, error);
      throw error;
    }
  }

  private async getExistingArticles(country: string, category: string) {
    console.log(`[DB] Fetching existing articles for threading: ${country}-${category}`);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const articles = await prisma.article.findMany({
        where: {
          country: country as any,
          category: category as any,
          publishedAt: {
            gte: thirtyDaysAgo,
          },
        },
        select: {
          id: true,
          title: true,
          publishedAt: true,
          dnaCode: true,
          sourceUrl: true,
        },
        orderBy: {
          publishedAt: 'desc',
        },
        take: 10,
      });
      console.log(`[DB] Found ${articles.length} existing articles for threading analysis`);
      return articles;
    } catch (error) {
      console.error(`[DB] Error fetching existing articles:`, error);
      throw error;
    }
  }

  private formatExistingArticles(articles: any[]): string {
    return articles.map(article => 
      `ID: ${article.id}\nTitle: ${article.title}\nSummary: ${article.summary}\nDNA: ${article.dnaCode}\nDate: ${article.publishedAt.toISOString().split('T')[0]}\n---`
    ).join('\n');
  }
}

export const newsProcessor = new NewsProcessor();
