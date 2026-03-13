from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class YouTubeScrapingService:
    def __init__(self) -> None:
        self._is_yt_dlp_available = False
        self._client = None
        self._init_yt_dlp_import()
        self._init_summary_client()

    def _init_yt_dlp_import(self) -> None:
        backend_root = Path(__file__).resolve().parents[2]
        yt_dlp_root = backend_root / "youtubescrapping" / "yt-dlp"

        if str(yt_dlp_root) not in sys.path:
            sys.path.insert(0, str(yt_dlp_root))

        try:
            import yt_dlp  # noqa: F401

            self._is_yt_dlp_available = True
            logger.info("[YOUTUBE] yt-dlp integration is active")
        except Exception as exc:
            self._is_yt_dlp_available = False
            logger.warning(f"[YOUTUBE] yt-dlp unavailable: {exc}")

    def _init_summary_client(self) -> None:
        try:
            from google import genai

            self._client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        except Exception as exc:
            self._client = None
            logger.warning(f"[YOUTUBE] Summary client unavailable: {exc}")

    @staticmethod
    def _normalize_channel_input(channel: str) -> str:
        raw = (channel or "").strip()
        if raw.startswith("http://") or raw.startswith("https://"):
            return raw
        if raw.startswith("@"):
            return f"https://www.youtube.com/{raw}/videos"
        return f"https://www.youtube.com/@{raw}/videos"

    @staticmethod
    def _best_video_url(entry: dict[str, Any]) -> str:
        if entry.get("webpage_url"):
            return str(entry["webpage_url"])
        if entry.get("url") and str(entry["url"]).startswith("http"):
            return str(entry["url"])
        if entry.get("id"):
            return f"https://www.youtube.com/watch?v={entry['id']}"
        return ""

    @staticmethod
    def _fallback_summary(title: str, description: str | None) -> str:
        text = (description or "").strip().replace("\n", " ")
        if text:
            return text[:220]
        return f"Video about: {title}"[:220]

    def _summarize_video(self, title: str, description: str | None) -> str:
        if not self._client:
            return self._fallback_summary(title, description)

        prompt = (
            "Summarize this YouTube video in normal simple style, 2 to 3 sentences, "
            "clear and factual.\n\n"
            f"Title: {title}\n"
            f"Description: {description or ''}"
        )
        try:
            response = self._client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt,
            )
            text = (response.text or "").strip()
            return text or self._fallback_summary(title, description)
        except Exception:
            return self._fallback_summary(title, description)

    def _extract_channel_sync(self, channel_input: str, videos_per_channel: int) -> dict[str, Any]:
        if not self._is_yt_dlp_available:
            return {
                "channel_input": channel_input,
                "channel_title": None,
                "videos": [],
            }

        from yt_dlp import YoutubeDL

        source = self._normalize_channel_input(channel_input)
        listing_opts = {
            "quiet": True,
            "skip_download": True,
            "extract_flat": "in_playlist",
            "playlistend": videos_per_channel,
            "noplaylist": False,
        }

        try:
            with YoutubeDL(listing_opts) as ydl:
                info = ydl.extract_info(source, download=False)
        except Exception as exc:
            logger.warning(f"[YOUTUBE] Failed listing for {channel_input}: {exc}")
            return {
                "channel_input": channel_input,
                "channel_title": None,
                "videos": [],
            }

        entries = (info or {}).get("entries") or []
        channel_title = (info or {}).get("uploader") or (info or {}).get("channel")

        detail_opts = {
            "quiet": True,
            "skip_download": True,
        }

        videos: list[dict[str, Any]] = []
        for entry in entries[:videos_per_channel]:
            url = self._best_video_url(entry)
            if not url:
                continue
            title = (entry.get("title") or "Untitled").strip()
            description = (entry.get("description") or None)
            published = entry.get("upload_date")
            video_id = entry.get("id")

            # Enrich description from full video metadata when available.
            try:
                with YoutubeDL(detail_opts) as ydl:
                    detail = ydl.extract_info(url, download=False)
                description = detail.get("description") or description
                published = detail.get("upload_date") or published
                video_id = detail.get("id") or video_id
                title = (detail.get("title") or title).strip()
                channel_title = detail.get("channel") or channel_title
            except Exception:
                pass

            videos.append(
                {
                    "video_id": str(video_id) if video_id else None,
                    "video_url": url,
                    "title": title,
                    "description": description,
                    "published_at": str(published) if published else None,
                    "channel_title": channel_title,
                }
            )

        return {
            "channel_input": channel_input,
            "channel_title": channel_title,
            "videos": videos,
        }

    async def scrape_channels(
        self,
        channels: list[str],
        videos_per_channel: int = 10,
        summarize: bool = True,
    ) -> list[dict[str, Any]]:
        tasks = [
            asyncio.to_thread(self._extract_channel_sync, channel, videos_per_channel)
            for channel in channels
        ]
        channel_results = await asyncio.gather(*tasks)

        if summarize:
            for channel_result in channel_results:
                for video in channel_result.get("videos", []):
                    video["summary"] = await asyncio.to_thread(
                        self._summarize_video,
                        video.get("title", ""),
                        video.get("description"),
                    )
        else:
            for channel_result in channel_results:
                for video in channel_result.get("videos", []):
                    video["summary"] = self._fallback_summary(
                        video.get("title", ""),
                        video.get("description"),
                    )

        return channel_results


youtube_scraping_service = YouTubeScrapingService()
