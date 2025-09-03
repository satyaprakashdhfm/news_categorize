export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { newsScrapingService } from '@/lib/news-scraping-service';

// GET /api/admin/scraping/progress - SSE endpoint for real-time progress
export async function GET(request: NextRequest) {
  // Create readable stream for SSE
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = `data: ${JSON.stringify({ type: 'connected', message: 'Connection established' })}\n\n`;
      controller.enqueue(encoder.encode(data));

      // Listen for progress events
      const progressHandler = (progress: any) => {
        const data = `data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // Listen for errors
      const errorHandler = (error: any) => {
        const data = `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // Add event listeners
      newsScrapingService.on('progress', progressHandler);
      newsScrapingService.on('error', errorHandler);

      // Send current status immediately
      const currentStats = newsScrapingService.getCurrentStats();
      const statusData = `data: ${JSON.stringify({ type: 'status', stats: currentStats })}\n\n`;
      controller.enqueue(encoder.encode(statusData));

      // Keep connection alive with periodic heartbeat
      const heartbeat = setInterval(() => {
        const heartbeatData = `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(heartbeatData));
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        newsScrapingService.off('progress', progressHandler);
        newsScrapingService.off('error', errorHandler);
        clearInterval(heartbeat);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}
