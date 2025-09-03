export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { newsScrapingService } from '@/lib/news-scraping-service';

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
