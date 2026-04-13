from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any


class BrowserScrapeService:
    def __init__(self) -> None:
        backend_dir = Path(__file__).resolve().parents[2]
        self._satya_dir = backend_dir.parent / "satya"
        self._cli_path = self._satya_dir / "src" / "cli.mjs"

    async def scrape_url(self, url: str, output_format: str = "text", max_chars: int = 20000) -> dict[str, Any]:
        if output_format not in {"text", "markdown"}:
            raise ValueError("format must be 'text' or 'markdown'")

        if not self._cli_path.exists():
            raise RuntimeError(f"Satya CLI not found at {self._cli_path}")

        cmd = [
            "node",
            str(self._cli_path),
            "--url",
            url,
            "--mode",
            "browser",
            "--format",
            output_format,
            "--maxChars",
            str(max_chars),
            "--includeHtml",
            "false",
            "--headless",
            "true",
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(self._satya_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            message = stderr.decode("utf-8", errors="ignore").strip() or "unknown scraper error"
            raise RuntimeError(f"Browser scrape failed: {message}")

        payload = self._extract_json_payload(stdout.decode("utf-8", errors="ignore"))
        if not isinstance(payload, dict):
            raise RuntimeError("Invalid scraper output payload")

        return payload

    @staticmethod
    def _extract_json_payload(raw_output: str) -> dict[str, Any]:
        text = (raw_output or "").strip()
        if not text:
            return {}

        if text.startswith("{"):
            return json.loads(text)

        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])

        raise RuntimeError("No JSON output from scraper")


browser_scrape_service = BrowserScrapeService()
