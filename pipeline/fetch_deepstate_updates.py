#!/usr/bin/env python3
"""Publish delayed, geolocated DeepState map updates as point events.

The public Telegram posts link to DeepStateMAP with an explicit latitude and
longitude.  Those coordinates are published as point updates only: the script
does not access the DeepState API, copy control polygons, or infer territory.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen


FEED_URL = "https://t.me/s/DeepStateUA"
SOURCE_ID = "deepstate-map"
POST_RE = re.compile(r'data-post="DeepStateUA/(?P<post_id>\d+)"', re.IGNORECASE)
DATE_RE = re.compile(r'<time datetime="(?P<date>[^"]+)"', re.IGNORECASE)
COORD_RE = re.compile(
    r'<a href="https?://deepstatemap\.live/(?:en/)?#(?P<zoom>[\d.]+)/(?P<lat>-?[\d.]+)/(?P<lon>-?[\d.]+)"[^>]*>(?P<label>.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
TAG_RE = re.compile(r"<[^>]+>")
KNOWN_LOCATIONS = {
    (48.462732, 37.739539): {"name_uk": "Іванопілля", "name_ru": "Иванополье", "name_en": "Ivanopillia", "admin1": "Донецька область"},
    (48.424085, 37.229447): {"name_uk": "Дорожнє", "name_ru": "Дорожное", "name_en": "Dorozhnie", "admin1": "Донецька область"},
}


def _plain(value: str) -> str:
    value = html.unescape(TAG_RE.sub(" ", value))
    return " ".join(value.replace("\xa0", " ").split())


def _summary(chunk: str) -> str:
    text = _plain(chunk)
    marker = "Мапу оновлено"
    if marker in text:
        text = text.split(marker, 1)[1]
    for stop in ("💬", "У випадку неточностей", "deepstatemap.live", "Мапа 🛑"):
        if stop in text:
            text = text.split(stop, 1)[0]
    text = text.strip(" .·⚔️🗺🔄")
    return text or "DeepStateMAP опубликовал геолокированное обновление карты."


def parse_updates(document: str, now: datetime, delay_hours: int = 24) -> list[dict]:
    cutoff = now.astimezone(timezone.utc) - timedelta(hours=delay_hours)
    chunks = re.split(r'<div class="tgme_widget_message_wrap', document, flags=re.IGNORECASE)[1:]
    updates: list[dict] = []
    for chunk in chunks:
        if "Мапу оновлено" not in chunk:
            continue
        post_match = POST_RE.search(chunk)
        date_match = DATE_RE.search(chunk)
        if not post_match or not date_match:
            continue
        published_at = datetime.fromisoformat(date_match.group("date"))
        if published_at > cutoff:
            continue
        post_id = post_match.group("post_id")
        post_url = f"https://t.me/DeepStateUA/{post_id}"
        summary = _summary(chunk)
        for index, match in enumerate(COORD_RE.finditer(chunk), start=1):
            label = _plain(match.group("label")) or "Участок обновления"
            digest = hashlib.sha256(f"{post_id}|{match.group('lat')}|{match.group('lon')}".encode()).hexdigest()[:16]
            updates.append(
                {
                    "id": f"deepstate-{digest}",
                    "post_id": post_id,
                    "post_url": post_url,
                    "published_at": published_at.astimezone(timezone.utc).isoformat(),
                    "event_date": published_at.date().isoformat(),
                    "label": label,
                    "summary": summary,
                    "lat": float(match.group("lat")),
                    "lon": float(match.group("lon")),
                    "sequence": index,
                }
            )
    return sorted(updates, key=lambda item: item["published_at"], reverse=True)


def fetch_document(timeout: int = 30) -> str:
    request = Request(
        FEED_URL,
        headers={"User-Agent": "WarMap-Daily/1.1 (+https://github.com/eremkindv91/warmap-daily)"},
    )
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def _read(path: Path, fallback):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else fallback


def _write(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def publish(updates: list[dict], data_dir: Path, now: datetime) -> int:
    events = [item for item in _read(data_dir / "events.json", []) if SOURCE_ID not in item.get("source_ids", [])]
    evidence = [item for item in _read(data_dir / "evidence.json", []) if item.get("source_id") != SOURCE_ID]

    for update in updates:
        evidence_id = f"ev-{update['id']}"
        settlement_id = f"settlement-{update['id']}"
        known = KNOWN_LOCATIONS.get((round(update["lat"], 6), round(update["lon"], 6)), {})
        display_label = known.get("name_uk", update["label"])
        summary_ru = f"По оценке DeepStateMAP, российские силы продвинулись в районе {known.get('name_ru', display_label)}."
        summary_en = f"DeepStateMAP assesses that Russian forces advanced near {known.get('name_en', display_label)}."
        events.append(
            {
                "id": update["id"],
                "title": f"Геолокированное обновление: {known.get('name_ru', display_label)}",
                "title_uk": f"Геолоковане оновлення: {display_label}",
                "title_en": f"Geolocated map update: {known.get('name_en', display_label)}",
                "summary": summary_ru,
                "summary_uk": update["summary"],
                "summary_en": summary_en,
                "event_date": update["event_date"],
                "published_at": update["published_at"],
                "verification_status": "probable",
                "event_kind": "territorial_update",
                "source_ids": [SOURCE_ID],
                "evidence_ids": [evidence_id],
                "location": {"lat": update["lat"], "lon": update["lon"]},
                "location_label": display_label,
                "settlement_id": settlement_id,
                "publication_note": "Точка взята из прямой ссылки DeepStateMAP. Контур территории не публикуется и не выводится из точки.",
            }
        )
        evidence.append(
            {
                "id": evidence_id,
                "source_id": SOURCE_ID,
                "published_at": update["published_at"],
                "url": update["post_url"],
                "evidence_type": "licensed_map",
                "independence_group": "deepstate",
                "verification_note": "Публичный пост DeepStateUA содержит прямую ссылку на DeepStateMAP с координатами. Опубликована только точка сообщения, без копирования полигонов или API-данных.",
            }
        )

    events.sort(key=lambda item: (item.get("published_at", item.get("event_date", "")), item["id"]), reverse=True)
    evidence.sort(key=lambda item: (item.get("published_at", ""), item["id"]), reverse=True)
    _write(data_dir / "events.json", events)
    _write(data_dir / "evidence.json", evidence)

    features = []
    for event in events:
        location = event.get("location") or {}
        if event.get("event_kind") != "territorial_update" or not isinstance(location.get("lat"), (int, float)) or not isinstance(location.get("lon"), (int, float)):
            continue
        features.append(
            {
                "type": "Feature",
                "id": event["id"],
                "geometry": {"type": "Point", "coordinates": [location["lon"], location["lat"]]},
                "properties": {key: event[key] for key in ("id", "title", "title_uk", "title_en", "summary", "summary_uk", "summary_en", "event_date", "published_at", "verification_status", "source_ids", "evidence_ids", "location_label") if key in event},
            }
        )
    _write(data_dir / "updates.geojson", {"type": "FeatureCollection", "features": features})

    other_settlements = [item for item in _read(data_dir / "settlements.json", []) if item.get("source_id") != SOURCE_ID]
    point_settlements = []
    for update in updates:
        known = KNOWN_LOCATIONS.get((round(update["lat"], 6), round(update["lon"], 6)), {})
        label = known.get("name_uk", update["label"])
        point_settlements.append(
            {
                "id": f"settlement-{update['id']}",
                "name": known.get("name_ru", label),
                "name_uk": label,
                "name_ru": known.get("name_ru", label),
                "name_en": known.get("name_en", label),
                "aliases": sorted({update["label"], label, known.get("name_ru", ""), known.get("name_en", "")} - {""}),
                "admin1": known.get("admin1", "Україна"),
                "lat": update["lat"],
                "lon": update["lon"],
                "status": "unknown",
                "source_id": SOURCE_ID,
            }
        )
    settlements_by_id = {item["id"]: item for item in other_settlements + point_settlements}
    settlements = sorted(settlements_by_id.values(), key=lambda item: item.get("name", ""))
    _write(data_dir / "settlements.json", settlements)
    _write(data_dir / "settlements-index.json", settlements)

    status = _read(data_dir / "status.json", {})
    latest = events[0] if events else None
    status.update(
        {
            "state": "point_updates_live" if latest else status.get("state", "awaiting_first_snapshot"),
            "point_feed_date": latest.get("event_date") if latest else None,
            "point_feed_published_at": latest.get("published_at") if latest else None,
            "point_feed_updated_at": now.astimezone(timezone.utc).isoformat(),
            "point_update_count": len(features),
            "new_settlements": len({feature["properties"].get("location_label") for feature in features}),
        }
    )
    _write(data_dir / "status.json", status)
    return len(features)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--input", type=Path, help="Use saved Telegram HTML instead of the network")
    parser.add_argument("--delay-hours", type=int, default=24)
    parser.add_argument("--timeout", type=int, default=30)
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    document = args.input.read_text(encoding="utf-8") if args.input else fetch_document(args.timeout)
    updates = parse_updates(document, now=now, delay_hours=args.delay_hours)
    count = publish(updates, args.data_dir, now)
    print(f"Published {count} delayed DeepState point updates; polygon geometry unchanged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
