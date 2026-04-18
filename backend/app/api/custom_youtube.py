from datetime import date, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import CustomYouTubeVideo
from app.schemas import (
    YouTubeHistoryResponse,
    YouTubeScrapeRequest,
    YouTubeScrapeResponse,
)
from app.services.youtube_scraping_service import youtube_scraping_service


router = APIRouter(prefix="/api/custom-youtube", tags=["custom-youtube"])


@router.post("/scrape", response_model=YouTubeScrapeResponse)
async def scrape_custom_youtube(request: YouTubeScrapeRequest, db: Session = Depends(get_db)):
    run_id = str(uuid4())
    created_at = datetime.now()

    channel_results = await youtube_scraping_service.scrape_channels(
        channels=request.channels,
        videos_per_channel=request.videos_per_channel,
        summarize=request.summarize,
    )

    total = 0
    response_channels = []

    for channel_result in channel_results:
        videos = channel_result.get("videos", [])
        for idx, video in enumerate(videos):
            db.add(
                CustomYouTubeVideo(
                    id=str(uuid4()),
                    run_id=run_id,
                    channel_input=channel_result.get("channel_input") or "",
                    channel_title=channel_result.get("channel_title"),
                    video_id=video.get("video_id"),
                    video_url=(video.get("video_url") or "")[:1000],
                    title=(video.get("title") or "Untitled")[:500],
                    description=video.get("description"),
                    summary=video.get("summary"),
                    published_at=video.get("published_at"),
                    position=idx,
                    score=0,
                )
            )

        total += len(videos)
        response_channels.append(
            {
                "channel_input": channel_result.get("channel_input"),
                "channel_title": channel_result.get("channel_title"),
                "videos_found": len(videos),
                "videos": videos,
            }
        )

    db.commit()

    return YouTubeScrapeResponse(
        run_id=run_id,
        total_videos=total,
        created_at=created_at,
        channels=response_channels,
    )


@router.get("/history", response_model=YouTubeHistoryResponse)
async def get_youtube_history(
    channel: str | None = Query(None),
    topic: str | None = Query(None),
    day: str | None = Query(None),
    hours_back: int | None = Query(None, ge=1, le=240),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(CustomYouTubeVideo)
    runs_query = db.query(CustomYouTubeVideo.run_id)

    day_value: date | None = None
    if day:
        try:
            day_value = datetime.strptime(day, "%Y-%m-%d").date()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="day must be YYYY-MM-DD") from exc

    if channel:
        like = f"%{channel.strip()}%"
        query = query.filter(
            or_(
                CustomYouTubeVideo.channel_input.ilike(like),
                CustomYouTubeVideo.channel_title.ilike(like),
            )
        )
        runs_query = runs_query.filter(
            or_(
                CustomYouTubeVideo.channel_input.ilike(like),
                CustomYouTubeVideo.channel_title.ilike(like),
            )
        )

    if topic:
        like = f"%{topic.strip()}%"
        query = query.filter(
            or_(
                CustomYouTubeVideo.title.ilike(like),
                CustomYouTubeVideo.summary.ilike(like),
                CustomYouTubeVideo.description.ilike(like),
            )
        )
        runs_query = runs_query.filter(
            or_(
                CustomYouTubeVideo.title.ilike(like),
                CustomYouTubeVideo.summary.ilike(like),
                CustomYouTubeVideo.description.ilike(like),
            )
        )

    if day_value:
        query = query.filter(func.date(CustomYouTubeVideo.scraped_at) == day_value)
        runs_query = runs_query.filter(func.date(CustomYouTubeVideo.scraped_at) == day_value)
    elif hours_back:
        since = datetime.now() - timedelta(hours=int(hours_back))
        query = query.filter(CustomYouTubeVideo.scraped_at >= since)
        runs_query = runs_query.filter(CustomYouTubeVideo.scraped_at >= since)

    rows = query.order_by(desc(CustomYouTubeVideo.scraped_at)).limit(limit).all()

    total_runs = runs_query.distinct().count()
    runs_today = (
        db.query(CustomYouTubeVideo.run_id)
        .filter(func.date(CustomYouTubeVideo.scraped_at) == datetime.now().date())
        .distinct()
        .count()
    )

    videos = [
        {
            "run_id": row.run_id,
            "video_id": row.video_id,
            "channel_input": row.channel_input,
            "video_url": row.video_url,
            "title": row.title,
            "description": row.description,
            "summary": row.summary,
            "published_at": row.published_at,
            "channel_title": row.channel_title,
            "scraped_at": row.scraped_at,
        }
        for row in rows
    ]

    return YouTubeHistoryResponse(
        total_videos=len(videos),
        total_runs=total_runs,
        runs_today=runs_today,
        videos=videos,
    )
