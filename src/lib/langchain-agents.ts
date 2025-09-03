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

export class NewsProcessor {
  private llm: ChatGoogleGenerativeAI;

  constructor() {
    this.llm = new ChatGoogleGenerativeAI({
      modelName: 'gemini-1.5-flash',
      temperature: 0.1,
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }

  private async classifyCategory(title: string, content: string): Promise<string> {
    console.log(`[GEMINI] Starting category classification for: "${title.substring(0, 50)}..."`);
    console.log(`[GEMINI] Content length for classification: ${content.length} chars`);
    
    const prompt = `
      Analyze the following news article and classify it into ONE of these 8 categories:
      
      Categories:
      - POL (Politics & Governance): Government, elections, policy, diplomacy
      - ECO (Economy & Business): Markets, trade, finance, companies
      - SOC (Society & Culture): Social issues, culture, education, lifestyle
      - TEC (Technology & Science): Tech innovations, research, digital trends
      - ENV (Environment & Climate): Climate change, sustainability, nature
      - HEA (Health & Medicine): Healthcare, medical research, public health
      - SPO (Sports & Entertainment): Sports, movies, music, celebrities
      - SEC (Security & Conflict): Military, terrorism, conflicts, crime
      
      Article Title: ${title}
      Article Content: ${content}
      
      Return ONLY the 3-letter category code (POL, ECO, SOC, TEC, ENV, HEA, SPO, or SEC).
    `;

    try {
      console.log(`[GEMINI] Sending classification request to Gemini...`);
      const response = await this.llm.invoke(prompt);
      const category = response.content.toString().trim().toUpperCase();
      console.log(`[GEMINI] Category classification result: ${category}`);
      return category;
    } catch (error) {
      console.error(`[GEMINI] Error in category classification:`, error);
      throw error;
    }
  }

  private async generateSummary(title: string, content: string): Promise<string> {
    console.log(`[GEMINI] Starting summary generation for: "${title.substring(0, 50)}..."`);
    console.log(`[GEMINI] Content length for summary: ${content.length} chars`);
    
    const prompt = `
      Create a concise 2-3 sentence summary of this news article:
      
      Title: ${title}
      Content: ${content}
      
      Focus on the key facts and main points. Keep it informative and neutral.
    `;

    try {
      console.log(`[GEMINI] Sending summary request to Gemini...`);
      const response = await this.llm.invoke(prompt);
      const summary = response.content.toString().trim();
      console.log(`[GEMINI] Summary generated (${summary.length} chars): "${summary.substring(0, 100)}..."`);
      return summary;
    } catch (error) {
      console.error(`[GEMINI] Error in summary generation:`, error);
      throw error;
    }
  }

  private async findThreading(title: string, content: string, category: string, country: string, existingArticles: string): Promise<string> {
    console.log(`[GEMINI] Starting threading analysis for: "${title.substring(0, 50)}..."`);
    console.log(`[GEMINI] Analyzing against ${existingArticles.split('---').length - 1} existing articles`);
    
    const prompt = `
      Analyze if this news article is related to any existing story threads.
      
      New Article:
      Title: ${title}
      Content: ${content}
      Category: ${category}
      Country: ${country}
      
      Existing Articles in Same Category and Country:
      ${existingArticles}
      
      If this article continues or relates to an existing story, return the ID of the most relevant article.
      If this is a new story, return "NEW_THREAD".
      
      Consider these factors:
      - Same main topic or event
      - Chronological progression
      - Same key people or organizations involved
      - Geographic relevance
      
      Return format: Either an article ID or "NEW_THREAD"
    `;

    try {
      console.log(`[GEMINI] Sending threading request to Gemini...`);
      const response = await this.llm.invoke(prompt);
      const threadingResult = response.content.toString().trim();
      console.log(`[GEMINI] Threading analysis result: ${threadingResult}`);
      return threadingResult;
    } catch (error) {
      console.error(`[GEMINI] Error in threading analysis:`, error);
      throw error;
    }
  }

  async processArticle(article: NewsArticle): Promise<ProcessedArticle> {
    try {
      console.log(`[AI] Starting processing for article: ${article.title}`);
      console.log(`[AI] Article content length: ${article.content.length} chars`);
      
      // Step 1: Categorize the article
      console.log(`[AI] Step 1: Categorizing article...`);
      const category = await this.classifyCategory(
        article.title,
        article.content.substring(0, 2000)
      );
      console.log(`[AI] Category determined: ${category}`);
      
      // Step 2: Generate summary
      console.log(`[AI] Step 2: Generating summary...`);
      const summary = await this.generateSummary(
        article.title,
        article.content.substring(0, 2000)
      );
      console.log(`[AI] Summary generated: ${summary.substring(0, 100)}...`);
      
      // Step 3: Generate DNA code
      console.log(`[AI] Step 3: Generating DNA code...`);
      const year = new Date().getFullYear();
      const sequenceNum = await this.getNextSequenceNumber(article.country, category, year);
      const dnaCode = `${article.country}-${category}-${year}-${sequenceNum.toString().padStart(3, '0')}`;
      console.log(`[AI] DNA code generated: ${dnaCode}`);
      
      // Step 4: Find story threading
      console.log(`[AI] Step 4: Finding story threading...`);
      const existingArticles = await this.getExistingArticles(article.country, category);
      console.log(`[AI] Found ${existingArticles.length} existing articles for threading analysis`);
      const threadingDecision = await this.findThreading(
        article.title,
        article.content.substring(0, 1000),
        category,
        article.country,
        this.formatExistingArticles(existingArticles)
      );
      console.log(`[AI] Threading decision: ${threadingDecision}`);
      
      let parentId: string | undefined;
      let threadId: string | undefined;
      
      if (threadingDecision !== 'NEW_THREAD') {
        parentId = threadingDecision;
        // Get the thread ID from the parent article
        const parentArticle = await prisma.article.findUnique({
          where: { id: parentId }
        });
        threadId = parentArticle?.threadId || undefined;
        console.log(`[AI] Linked to parent: ${parentId}, thread: ${threadId}`);
      } else {
        console.log(`[AI] Creating new thread`);
      }
      
      console.log(`[AI] Processing complete for: ${dnaCode}`);
      return {
        ...article,
        category,
        dnaCode,
        summary,
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
}

export const newsProcessor = new NewsProcessor();
