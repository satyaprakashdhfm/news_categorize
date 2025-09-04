export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { newsScrapingService } from '@/lib/news-scraping-service';
import { SUPPORTED_COUNTRIES } from '@/lib/news-scraping-service';

// GET /api/admin/scraping - Get current scraping status and stats
export async function GET() {
  try {
    const overview = await newsScrapingService.getStatsOverview();
    const history = await newsScrapingService.getScrapingHistory(20);
    
    return NextResponse.json({
      success: true,
      data: {
        overview,
        history,
        currentStatus: newsScrapingService.getCurrentStats()
      }
    });
  } catch (error) {
    console.error('Error getting scraping status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get scraping status' },
      { status: 500 }
    );
  }
}

// POST /api/admin/scraping - Start scraping process
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'start') {
      if (newsScrapingService.getIsRunning()) {
        return NextResponse.json(
          { success: false, error: 'Scraping is already running' },
          { status: 400 }
        );
      }

      // Start scraping in background
      newsScrapingService.startWorldwideNewsScraping().catch(error => {
        console.error('Scraping failed:', error);
      });

      return NextResponse.json({
        success: true,
        message: 'Scraping started successfully'
      });
    }

    if (action === 'countryTopic') {
      if (newsScrapingService.getIsRunning()) {
        return NextResponse.json(
          { success: false, error: 'Scraping is already running' },
          { status: 400 }
        );
      }

      // Validate inputs
      const rawCountries: string[] = Array.isArray(body.countries) ? body.countries : SUPPORTED_COUNTRIES.slice();
      const countries = rawCountries
        .map(c => (c || '').toString().toUpperCase())
        .filter(c => (SUPPORTED_COUNTRIES as unknown as string[]).includes(c)) as ReadonlyArray<typeof SUPPORTED_COUNTRIES[number]>;

      const defaultTopics = ['economics','politics','technology','environment','health','sports','security'];
      const topics: string[] = Array.isArray(body.topics) && body.topics.length > 0 ? body.topics : defaultTopics;

      const formatDate = (d: Date) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      };
      const date: string = (typeof body.date === 'string' && body.date.trim().length >= 8) ? body.date.trim() : formatDate(new Date());

      if (countries.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No valid countries provided' },
          { status: 400 }
        );
      }

      // Start country-topic scraping in background
      newsScrapingService.startCountryTopicScraping({ countries, topics, date }).catch(error => {
        console.error('CountryTopic scraping failed:', error);
      });

      return NextResponse.json({
        success: true,
        message: 'Country+Topic scraping started successfully',
        params: { countries, topics, date }
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error handling scraping request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
