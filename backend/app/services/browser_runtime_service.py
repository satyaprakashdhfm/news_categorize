import json
import subprocess
from pathlib import Path
from typing import Any


def scrape_url_with_browser_runtime(
    url: str,
    mode: str = "browser",
    fmt: str = "text",
    timeout_ms: int = 30000,
    max_chars: int = 20000,
) -> dict[str, Any]:
    """Run the integrated browser runtime CLI and return parsed JSON output."""
    runtime_root = Path(__file__).resolve().parents[2] / "browser_runtime"
    cli_path = runtime_root / "src" / "cli.mjs"

    cmd = [
        "node",
        str(cli_path),
        "--url",
        url,
        "--mode",
        mode,
        "--format",
        fmt,
        "--timeoutMs",
        str(timeout_ms),
        "--maxChars",
        str(max_chars),
    ]

    completed = subprocess.run(
        cmd,
        cwd=str(runtime_root),
        capture_output=True,
        text=True,
        check=False,
    )

    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip()
        raise RuntimeError(stderr or "browser runtime failed")

    stdout = (completed.stdout or "").strip()
    if not stdout:
        raise RuntimeError("browser runtime returned empty output")

    return json.loads(stdout)
