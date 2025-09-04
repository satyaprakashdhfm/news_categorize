import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface NewsArticle {
  title: string;
  content: string;
  sourceUrl: string;
  publishedAt: Date;
  country: string;
}

export interface ProcessedArticle extends NewsArticle {
  category: string;
  dnaCode: string;
  summary: string;
  threadId?: string;
  parentId?: string;
}

export interface ProcessOptions {
  forceCategory?: string;
  threadKey?: string; // deterministic thread identifier, e.g., COUNTRY-topic-slug
}

export class NewsProcessor {
  private llm: ChatGoogleGenerativeAI;

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

  private async generateSummary(title: string, content: string): Promise<string> {
    console.log(`[GEMINI] Starting summary generation for: "${title.substring(0, 50)}..."`);
    console.log(`[GEMINI] Content length for summary: ${content.length} chars`);
    
    const messages = [
      { role: 'system', content: 'Create concise 2-3 sentence news summaries. Focus on key facts and main points. Keep it informative and neutral.' },
      { role: 'user', content: `Title: ${title}\n\nContent: ${content.substring(0, 2000)}` }
    ];
    
    try {
      console.log(`[GEMINI] Sending summary request to Gemini...`);
      const response = await this.llm.invoke(messages);
      const summary = response.content.toString().trim();
      console.log(`[GEMINI] Summary generated (${summary.length} chars): "${summary.substring(0, 100)}..."`);
      return summary;
    } catch (error) {
      console.error(`[GEMINI] Error in summary generation:`, error);
      console.log(`[GEMINI] Falling back to empty summary due to error`);
      return ''; // Return empty string, will be handled by fallback logic
    }
  }

  private async findThreading(title: string, content: string, category: string, existingArticles: any[]): Promise<string> {
    if (existingArticles.length === 0) {
      console.log(`[GEMINI] No existing articles to compare against - creating new thread`);
      return 'NEW_THREAD';
    }

    console.log(`[GEMINI] Starting threading analysis for: "${title.substring(0, 50)}..."`);
    console.log(`[GEMINI] Analyzing against ${existingArticles.length} existing articles`);
    
    const messages = [
      { role: 'system', content: "Decide if the NEW article should be threaded with one of the EXISTING articles. Choose the SINGLE most relevant existing article if related. Return EXACTLY the chosen article's ID string. If none are related, return 'NEW_THREAD'. Return only a bare ID or NEW_THREAD with no extra text." },
      { role: 'user', content: `New Article:\nTitle: ${title}\nContent: ${content.substring(0, 1000)}\n\nExisting Articles (ID | DNA | Title):\n${existingArticles.slice(0, 5).map(art => `${art.id} | ${art.dnaCode} | ${art.title}`).join('\n')}\n\nReturn ONLY one of: ${existingArticles.slice(0, 5).map(a => a.id).join(', ')} or NEW_THREAD.` }
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
      console.log(`[AI] Article content length: ${article.content.length} chars`);
      
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
            article.content.substring(0, 2000)
          );
        }
      } else {
        category = await this.classifyCategory(
          article.title,
          article.content.substring(0, 2000)
        );
      }
      console.log(`[AI] Category determined: ${category}`);
      
      // Step 2: Generate summary
      console.log(`[AI] Step 2: Generating summary...`);
      const summary = await this.generateSummary(
        article.title,
        article.content.substring(0, 2000)
      );
      const finalSummary = this.normalizeOrFallbackSummary(
        article.title,
        article.content,
        summary
      );
      console.log(`[AI] Summary finalized: ${finalSummary.substring(0, 100)}...`);
      
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
        threadId = options.threadKey;
        // Find the most recent article in this thread to link as parent
        const lastInThread = await prisma.article.findFirst({
          where: { threadId },
          orderBy: { scrapedAt: 'desc' },
          select: { id: true },
        });
        if (lastInThread) {
          parentId = lastInThread.id;
          console.log(`[AI] ThreadKey provided. Linking to last article in thread: ${parentId}`);
        } else {
          console.log(`[AI] ThreadKey provided but no existing thread found. Creating new thread with key: ${threadId}`);
        }
      } else {
        // Fallback to LLM-based threading by similarity/category
        const existingArticles = await this.getExistingArticles(article.country, category);
        console.log(`[AI] Found ${existingArticles.length} existing articles for threading analysis`);
        const threadingDecision = await this.findThreading(
          article.title,
          article.content.substring(0, 1000),
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
       
      console.log(`[AI] Processing complete for: ${dnaCode}`);
      return {
        ...article,
        category,
        dnaCode,
        summary: finalSummary,
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
          summary: true,
          publishedAt: true,
          dnaCode: true,
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

  private normalizeOrFallbackSummary(title: string, content: string, summaryCandidate: string | undefined): string {
    const cleaned = (summaryCandidate || '').toString().trim();
    if (cleaned.length >= 10) return cleaned;
    // Fallback: take first 2 sentences or first 300 chars from content
    const text = (content || '').toString().replace(/\s+/g, ' ').trim();
    if (!text) return title; // last resort
    const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
    const fallback = sentences && sentences.length >= 30 ? sentences : text.substring(0, 300);
    return fallback;
  }
}

export const newsProcessor = new NewsProcessor();
