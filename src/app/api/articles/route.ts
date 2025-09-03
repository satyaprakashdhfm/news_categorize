export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/articles - Fetch articles with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const categories = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeStats = searchParams.get('stats') === 'true';

    // Build where clause for filtering
    const where: any = {};
    if (country) {
      where.country = country;
    }
    if (categories.length > 0) {
      where.category = { in: categories };
    }

    // Fetch articles
    const articles = await prisma.article.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        dnaCode: true,
        title: true,
        summary: true,
        imageUrl: true,
        sourceUrl: true,
        publishedAt: true,
        country: true,
        category: true,
        threadId: true,
        parentId: true,
      }
    });

    let stats = null;
    if (includeStats) {
      const [totalArticles, recentArticles, countryCounts, categoryCounts] = await Promise.all([
        prisma.article.count(),
        prisma.article.count({
          where: {
            scrapedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        }),
        prisma.article.groupBy({
          by: ['country'],
          _count: { country: true },
          orderBy: { _count: { country: 'desc' } }
        }),
        prisma.article.groupBy({
          by: ['category'],
          _count: { category: true },
          orderBy: { _count: { category: 'desc' } }
        })
      ]);

      const activeThreads = await prisma.article.findMany({
        where: { threadId: { not: null } },
        distinct: ['threadId'],
        select: { threadId: true }
      });

      stats = {
        totalArticles,
        recentArticles,
        activeThreads: activeThreads.length,
        countryCounts,
        categoryCounts
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        articles,
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}
