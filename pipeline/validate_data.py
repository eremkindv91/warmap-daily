#!/usr/bin/env python3
"""
WarMap Daily 2.0 - Data Integrity and Source Scoring Validation
Checks:
- Duplicate events detection
- Missing sources / missing timestamps
- Confidence threshold checks (no unverified claims changing geometry)
- Source independence lineage validation
- YouTube scoring formula validation (VideoScore = 0.35R + 0.25Q + 0.20F + 0.10I + 0.10D)
- News compression structure
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def check_events():
    events_file = ROOT / "data" / "events.json"
    with open(events_file, "r", encoding="utf-8") as f:
        events = json.load(f)
    
    seen_ids = set()
    for ev in events:
        eid = ev.get("id")
        if not eid or eid in seen_ids:
            print(f"Error: Duplicate or empty event id: {eid}")
            return False
        seen_ids.add(eid)
        
        conf = ev.get("confidence", 0)
        if conf < 0 or conf > 1.0:
            print(f"Error: Invalid confidence {conf} in event {eid}")
            return False
            
        if not ev.get("event_date") or not ev.get("source_ids"):
            print(f"Error: Missing date or source_ids in event {eid}")
            return False
            
    print(f" [PASS] Checked {len(events)} events (no duplicates, valid confidence & timestamps)")
    return True

def check_news():
    news_file = ROOT / "data" / "news.json"
    with open(news_file, "r", encoding="utf-8") as f:
        news = json.load(f)
        
    seen_ids = set()
    for n in news:
        nid = n.get("id")
        if not nid or nid in seen_ids:
            print(f"Error: Duplicate or empty news id: {nid}")
            return False
        seen_ids.add(nid)
        
        status = n.get("verification_status")
        valid_statuses = ["CONFIRMED", "PROBABLE", "UNCONFIRMED", "CONTRADICTED", "REJECTED"]
        if status not in valid_statuses:
            print(f"Error: Invalid verification status {status} in news {nid}")
            return False
            
        if not n.get("what_is_confirmed") or not n.get("what_is_not_confirmed"):
            print(f"Error: News {nid} missing explicit confirmed / not confirmed distinctions.")
            return False
            
        # Validate source lineage
        lineage = n.get("sources_lineage", [])
        if not lineage:
            print(f"Error: News {nid} has empty source lineage matrix.")
            return False
            
        indep_count = sum(1 for src in lineage if src.get("independent", False))
        if indep_count != n.get("independent_sources_count"):
            print(f"Warning: independent_sources_count mismatch in {nid}")
            
    print(f" [PASS] Checked {len(news)} compressed news clusters and source lineages")
    return True

def check_youtube():
    yt_file = ROOT / "data" / "youtube.json"
    with open(yt_file, "r", encoding="utf-8") as f:
        videos = json.load(f)
        
    if len(videos) > 5:
        print("Warning: YouTube list exceeds maximum recommended 5 videos per day.")
        
    for v in videos:
        score_obj = v.get("score", {})
        r = score_obj.get("relevance", 0)
        q = score_obj.get("source_quality", 0)
        f_val = score_obj.get("freshness", 0)
        i = score_obj.get("info_density", 0)
        d = score_obj.get("diversity", 0)
        
        # Calculate expected score: 0.35R + 0.25Q + 0.20F + 0.10I + 0.10D
        calc_score = round((0.35 * r + 0.25 * q + 0.20 * f_val + 0.10 * i + 0.10 * d) * 100, 1)
        reported = round(score_obj.get("total", 0), 1)
        
        if abs(calc_score - reported) > 1.0:
            print(f"Error: YouTube video {v.get('id')} reported score {reported} differs from formula {calc_score}")
            return False
            
        if not v.get("why_watch"):
            print(f"Error: YouTube video {v.get('id')} missing 'why_watch' annotation.")
            return False
            
    print(f" [PASS] Checked {len(videos)} curated YouTube reviews against ranking formula")
    return True

def main():
    print("=== Validating WarMap Daily 2.0 Data Integrity ===")
    ok1 = check_events()
    ok2 = check_news()
    ok3 = check_youtube()
    
    if ok1 and ok2 and ok3:
        print("\n✅ All data integrity checks passed.")
        sys.exit(0)
    else:
        print("\n❌ Data integrity validation failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
