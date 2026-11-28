#!/usr/bin/env python3
"""Sync all posts from https://goodadhd.blogspot.com/ into data/posts.json."""

from __future__ import annotations

import html
import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path

BLOG_FEED_BASE = "https://goodadhd.blogspot.com/feeds/posts/default"
PAGE_SIZE = 150
BODY_MAX_CHARS = 1200
SUMMARY_MAX_CHARS = 140
MIN_ARTICLE_CHARS = 120
EXCLUDED_TITLES = {"隱私權政策", "免責聲明", "版權聲明", "privacy", "about"}
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "posts.json"

SCRIPT_STYLE_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.S | re.I)
POST_BODY_RE = re.compile(
    r"<div[^>]*class=[\"'][^\"']*post-body[^\"']*[\"'][^>]*>(.*?)<div[^>]*class=[\"'][^\"']*post-footer",
    re.S | re.I,
)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
READ_MORE_RE = re.compile(r"Read more\s*»?", re.I)


def clean_html(raw: str) -> str:
    """Strip scripts/styles/HTML tags, unescape entities, and collapse whitespace."""
    if not raw:
        return ""
    text = SCRIPT_STYLE_RE.sub(" ", raw)
    text = TAG_RE.sub(" ", text)
    text = html.unescape(text)
    text = READ_MORE_RE.sub("", text)
    return WS_RE.sub(" ", text).strip()


def fetch_full_post_text(url: str, retries: int = 3) -> str:
    """Fetch the full article page and extract .post-body plain text with retries."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; ClinicChatbotSync/1.0)"},
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                page_html = resp.read().decode("utf-8", "ignore")
            match = POST_BODY_RE.search(page_html)
            if match:
                return clean_html(match.group(1))
        except Exception:
            if attempt < retries - 1:
                time.sleep(0.8 * (attempt + 1))
    return ""


def load_previous_posts() -> dict[str, dict]:
    """Load existing posts keyed by URL as fallback when full-text fetch fails transiently."""
    if not OUTPUT_PATH.exists():
        return {}
    try:
        data = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        return {
            p["url"]: p
            for p in data.get("posts", [])
            if isinstance(p, dict) and p.get("url")
        }
    except Exception:
        return {}


def fetch_feed_page(start_index: int, max_results: int) -> dict:
    """Fetch one page of Blogger JSON feed."""
    params = urllib.parse.urlencode(
        {
            "alt": "json",
            "start-index": start_index,
            "max-results": max_results,
        }
    )
    url = f"{BLOG_FEED_BASE}?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; ClinicChatbotSync/1.0)"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def extract_post(entry: dict) -> dict | None:
    """Extract normalized post fields from a Blogger feed entry."""
    title = clean_html(entry.get("title", {}).get("$t", ""))
    if not title:
        return None

    url = ""
    for link in entry.get("link", []):
        if link.get("rel") == "alternate":
            url = link.get("href", "")
            break
    if not url:
        return None

    raw_content = (
        entry.get("content", {}).get("$t")
        or entry.get("summary", {}).get("$t")
        or ""
    )
    has_read_more = bool(READ_MORE_RE.search(raw_content))
    plain_text = clean_html(raw_content)

    tags = [
        c.get("term", "").strip()
        for c in entry.get("category", [])
        if c.get("term", "").strip()
    ]

    published_raw = entry.get("published", {}).get("$t", "")
    published = published_raw[:10] if len(published_raw) >= 10 else ""

    return {
        "title": title,
        "url": url,
        "published": published,
        "tags": tags,
        "_plainText": plain_text,
        "_needsFullFetch": has_read_more or len(plain_text) < 200,
    }


def sync_all_posts() -> dict:
    """Fetch all pages from Blogger, hydrate truncated posts, and filter short/non-article posts."""
    raw_posts: list[dict] = []
    start_index = 1
    blog_title = "314風神學院"
    total_reported = 0

    while True:
        data = fetch_feed_page(start_index, PAGE_SIZE)
        feed = data.get("feed", {})
        if start_index == 1:
            blog_title = feed.get("title", {}).get("$t", blog_title)
            total_reported = int(
                feed.get("openSearch$totalResults", {}).get("$t", 0)
            )

        entries = feed.get("entry", [])
        if not entries:
            break

        for entry in entries:
            post = extract_post(entry)
            if post:
                raw_posts.append(post)

        if len(entries) < PAGE_SIZE:
            break
        start_index += len(entries)

    # Hydrate full content for posts truncated by Blogger jump breaks
    to_fetch = [p for p in raw_posts if p["_needsFullFetch"]]
    if to_fetch:
        with ThreadPoolExecutor(max_workers=4) as pool:
            future_map = {
                pool.submit(fetch_full_post_text, p["url"]): p for p in to_fetch
            }
            for future in as_completed(future_map):
                post = future_map[future]
                full_text = future.result()
                if len(full_text) > len(post["_plainText"]):
                    post["_plainText"] = full_text

    prev_by_url = load_previous_posts()
    posts: list[dict] = []
    excluded_count = 0
    preserved_count = 0
    for p in raw_posts:
        title_lower = p["title"].strip().lower()
        plain_text = p["_plainText"]
        if title_lower in EXCLUDED_TITLES:
            excluded_count += 1
            continue

        if len(plain_text) < MIN_ARTICLE_CHARS:
            prev = prev_by_url.get(p["url"])
            if p["_needsFullFetch"] and prev and len(prev.get("text", "")) >= MIN_ARTICLE_CHARS:
                preserved_count += 1
                posts.append(
                    {
                        "title": p["title"],
                        "url": p["url"],
                        "published": p["published"],
                        "tags": p["tags"],
                        "charCount": prev.get("charCount", len(prev["text"])),
                        "summary": prev.get("summary", prev["text"][:SUMMARY_MAX_CHARS]),
                        "text": prev["text"],
                    }
                )
                continue
            excluded_count += 1
            continue

        summary = plain_text[:SUMMARY_MAX_CHARS]
        if len(plain_text) > SUMMARY_MAX_CHARS:
            summary = summary.rstrip() + "…"

        posts.append(
            {
                "title": p["title"],
                "url": p["url"],
                "published": p["published"],
                "tags": p["tags"],
                "charCount": len(plain_text),
                "summary": summary,
                "text": plain_text[:BODY_MAX_CHARS],
            }
        )

    tw_tz = timezone(timedelta(hours=8))
    return {
        "blogTitle": blog_title,
        "blogUrl": "https://goodadhd.blogspot.com/",
        "updatedAt": datetime.now(tw_tz).strftime("%Y-%m-%d %H:%M:%S"),
        "total": len(posts),
        "excludedCount": excluded_count,
        "preservedCount": preserved_count,
        "totalReported": total_reported,
        "posts": posts,
    }


def main() -> None:
    payload = sync_all_posts()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT_PATH.exists():
        try:
            existing = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
            if (
                existing.get("posts") == payload["posts"]
                and existing.get("totalReported") == payload["totalReported"]
            ):
                print(
                    f"No changes across {payload['total']} posts; skipped overwriting {OUTPUT_PATH}"
                )
                return
        except Exception:
            pass
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(
        f"Synced {payload['total']} posts (excluded {payload['excludedCount']} short/non-article posts) "
        f"from {payload['blogTitle']} -> {OUTPUT_PATH} ({size_kb:.1f} KB)"
    )


if __name__ == "__main__":
    main()
