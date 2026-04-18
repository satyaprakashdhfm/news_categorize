from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from app.core.config import settings
from app.core.observability import get_langfuse

logger = logging.getLogger(__name__)


class YouTubeScrapingService:
    def __init__(self) -> None:
        self._is_yt_dlp_available = False
        self._client = None
        self._init_yt_dlp_import()
        self._init_summary_client()

    def _init_yt_dlp_import(self) -> None:
        try:
            import yt_dlp  # noqa: F401

            self._is_yt_dlp_available = True
            logger.info("[YOUTUBE] yt-dlp package integration is active")
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
            return text[:1800]
        return f"Video about: {title}"[:400]

    @staticmethod
    def _word_count(text: str | None) -> int:
        if not text:
            return 0
        return len([w for w in text.strip().split() if w])

    @staticmethod
    def _extract_response_text(response) -> str:
        texts: list[str] = []
        for candidate in (getattr(response, "candidates", None) or []):
            content = getattr(candidate, "content", None)
            for part in (getattr(content, "parts", None) or []):
                value = getattr(part, "text", None)
                if isinstance(value, str) and value.strip():
                    texts.append(value.strip())
        return "\n".join(texts).strip()

    @staticmethod
    def _usage_from_response(response) -> dict[str, int]:
        usage = getattr(response, "usage_metadata", None)
        prompt = int(getattr(usage, "prompt_token_count", 0) or 0)
        output = int(getattr(usage, "candidates_token_count", 0) or 0)
        total = int(getattr(usage, "total_token_count", 0) or (prompt + output))
        return {
            "calls": 1,
            "prompt_tokens": max(prompt, 0),
            "output_tokens": max(output, 0),
            "total_tokens": max(total, 0),
        }

    @staticmethod
    def _empty_usage() -> dict[str, int]:
        return {
            "calls": 0,
            "prompt_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
        }

    @staticmethod
    def _merge_usage(target: dict[str, int], delta: dict[str, int] | None) -> None:
        if not delta:
            return
        target["calls"] += int(delta.get("calls", 0) or 0)
        target["prompt_tokens"] += int(delta.get("prompt_tokens", 0) or 0)
        target["output_tokens"] += int(delta.get("output_tokens", 0) or 0)
        target["total_tokens"] += int(delta.get("total_tokens", 0) or 0)

    def _summarize_video(
        self,
        title: str,
        description: str | None,
        channel_title: str | None = None,
        published_at: str | None = None,
        duration_seconds: int | None = None,
        view_count: int | None = None,
        tags: list[str] | None = None,
        categories: list[str] | None = None,
        trace_id: str = None,
    ) -> tuple[str, dict[str, int]]:
        if not self._client:
            return self._fallback_summary(title, description), self._empty_usage()

        duration_min = round((duration_seconds or 0) / 60, 2) if duration_seconds else None
        tags_text = ", ".join((tags or [])[:12])
        categories_text = ", ".join((categories or [])[:8])
        prompt = (
            "Create a complete, high-accuracy knowledge brief for this YouTube video in 12 to 18 sentences. "
            "Minimum length: 220 words. "
            "Use only provided metadata and description. Do not invent facts. "
            "Cover the core idea, concrete points/examples, important names or numbers, practical takeaways, "
            "and what a reader should remember. Keep it plain and readable as one continuous paragraph.\n\n"
            f"Channel: {channel_title or ''}\n"
            f"Title: {title}\n"
            f"Published: {published_at or ''}\n"
            f"Duration (minutes): {duration_min or ''}\n"
            f"Views: {view_count or ''}\n"
            f"Categories: {categories_text}\n"
            f"Tags: {tags_text}\n"
            f"Description: {description or ''}"
        )
        try:
            t0 = time.time()
            response = self._client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            latency_ms = int((time.time() - t0) * 1000)
            text = self._extract_response_text(response)
            usage_counts = self._usage_from_response(response)

            if self._word_count(text) < 180:
                expand_prompt = (
                    "Expand and deepen this video analysis to at least 230 words. "
                    "Preserve factual accuracy and use only provided source details. "
                    "Add missing context, implications, and concrete takeaways without repetition.\n\n"
                    f"Source metadata:\n{prompt}\n\n"
                    f"Draft summary:\n{text}"
                )
                expand_response = self._client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=expand_prompt,
                )
                expanded_text = self._extract_response_text(expand_response)
                self._merge_usage(usage_counts, self._usage_from_response(expand_response))
                if expanded_text:
                    text = expanded_text
            
            # --- Langfuse ---
            lf = get_langfuse()
            if lf:
                usage = getattr(response, "usage_metadata", None)
                lf.generation(
                    name="summarize_youtube_video",
                    model=settings.GEMINI_MODEL,
                    input=prompt,
                    output=text,
                    trace_id=trace_id,
                    usage={
                        "input": getattr(usage, "prompt_token_count", 0),
                        "output": getattr(usage, "candidates_token_count", 0),
                        "total": getattr(usage, "total_token_count", 0),
                        "unit": "TOKENS",
                    },
                    latency=latency_ms,
                )
                
            return text or self._fallback_summary(title, description), usage_counts
        except Exception:
            return self._fallback_summary(title, description), self._empty_usage()

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
            "no_warnings": True,
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
            "no_warnings": True,
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
            detail: dict[str, Any] = {}

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
                    "duration_seconds": int(detail.get("duration") or 0) if detail else None,
                    "view_count": int(detail.get("view_count") or 0) if detail else None,
                    "tags": detail.get("tags") if detail else None,
                    "categories": detail.get("categories") if detail else None,
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
        trace_id: str = None,
        return_usage: bool = False,
    ) -> list[dict[str, Any]] | dict[str, Any]:
        tasks = [
            asyncio.to_thread(self._extract_channel_sync, channel, videos_per_channel)
            for channel in channels
        ]
        channel_results = await asyncio.gather(*tasks)

        usage_totals = self._empty_usage()

        if summarize:
            for channel_result in channel_results:
                for video in channel_result.get("videos", []):
                    summary_text, usage_counts = await asyncio.to_thread(
                        self._summarize_video,
                        video.get("title", ""),
                        video.get("description"),
                        video.get("channel_title"),
                        video.get("published_at"),
                        video.get("duration_seconds"),
                        video.get("view_count"),
                        video.get("tags"),
                        video.get("categories"),
                        trace_id,
                    )
                    video["summary"] = summary_text
                    self._merge_usage(usage_totals, usage_counts)
        else:
            for channel_result in channel_results:
                for video in channel_result.get("videos", []):
                    video["summary"] = self._fallback_summary(
                        video.get("title", ""),
                        video.get("description"),
                    )

        if return_usage:
            return {
                "channel_results": channel_results,
                "usage": usage_totals,
            }

        return channel_results


youtube_scraping_service = YouTubeScrapingService()
