#!/usr/bin/env python3
"""Ingest explicitly enabled RSS/Atom feeds into a review queue; never changes geometry."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree

import yaml


def _text(element, names: tuple[str, ...]) -> str:
    for child in element.iter():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag in names and child.text:
            return " ".join(child.text.split())
    return ""


def fetch_feed(source: dict, timeout: int = 20) -> list[dict]:
    request = Request(source["feed_url"], headers={"User-Agent": "WarMap-Daily-ingest/1.0"})
    with urlopen(request, timeout=timeout) as response:
        root = ElementTree.fromstring(response.read())
    entries = [node for node in root.iter() if node.tag.rsplit("}", 1)[-1] in {"item", "entry"}]
    records = []
    for entry in entries:
        title = _text(entry, ("title",))
        published = _text(entry, ("pubDate", "published", "updated"))
        link = _text(entry, ("link",))
        if not link:
            link_element = next((node for node in entry.iter() if node.tag.rsplit("}", 1)[-1] == "link"), None)
            link = link_element.attrib.get("href", "") if link_element is not None else ""
        if not title or not link:
            continue
        digest = hashlib.sha256(f"{source['id']}|{link}".encode()).hexdigest()[:20]
        records.append({"id": f"doc-{digest}", "source_id": source["id"], "title": title, "url": link, "published_at_raw": published, "fetched_at": datetime.now(timezone.utc).isoformat(), "review_status": "unreviewed"})
    return records


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("config/sources.yml"))
    parser.add_argument("--output", type=Path, default=Path("pipeline/candidates/documents.json"))
    args = parser.parse_args()
    config = yaml.safe_load(args.config.read_text(encoding="utf-8"))
    enabled = [source for source in config.get("sources", []) if source.get("enabled") and source.get("feed_url")]
    documents: dict[str, dict] = {}
    for source in enabled:
        for document in fetch_feed(source):
            documents[document["id"]] = document
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(sorted(documents.values(), key=lambda item: item["id"]), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Collected {len(documents)} documents from {len(enabled)} enabled feeds; geometry unchanged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
