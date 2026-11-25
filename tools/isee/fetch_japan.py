#!/usr/bin/env python3
"""I see u, step 1b: Japanese pictures, where the most famous sideways glances are.

Ukiyo-e woodblock prints (actors, beauties, courtesans) and Japanese paintings, public domain:
  - The Cleveland Museum of Art, Japanese Art department: prints and paintings (CC0)
  - The Metropolitan Museum of Art, Asian Art department: Japanese prints and paintings
Same format as fetch_meta.py; detect.py and the rest run on the result as they are.

    python3 tools/isee/fetch_japan.py work/meta-japan.json
"""
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from fetch_meta import get  # noqa: E402

QUERIES = ["ukiyo-e", "woodblock print", "actor", "kabuki", "beauty", "courtesan", "bijin", "portrait Japan"]


def cleveland():
    out, skip = [], 0
    while True:
        d = get("https://openaccess-api.clevelandart.org/api/artworks/", department="Japanese Art", cc0=1, has_image=1, limit=500, skip=skip)
        rows = (d or {}).get("data") or []
        for a in rows:
            if a.get("type") not in ("Print", "Painting"):
                continue
            img = a.get("images") or {}
            web, big = img.get("web"), img.get("print") or img.get("web")
            if not web:
                continue
            creators = a.get("creators") or []
            out.append({
                "src": "cma", "id": f"cma-{a['id']}", "title": a.get("title") or "Untitled",
                "artist": creators[0]["description"] if creators else "Japan",
                "date": a.get("creation_date") or "", "medium": a.get("technique") or "",
                "museum": "The Cleveland Museum of Art", "accession": a.get("accession_number") or "",
                "link": a.get("url") or "", "small": web["url"], "big": big["url"],
            })
        skip += len(rows)
        if len(rows) < 500:
            return out


def met_object(oid):
    a = get(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}")
    if not a or not a.get("isPublicDomain") or not a.get("primaryImageSmall"):
        return None
    if "japan" not in (a.get("culture") or "").lower():
        return None
    if not any(k in (a.get("classification") or "").lower() for k in ("print", "painting")):
        return None
    artist = a.get("artistDisplayName") or "Japan"
    bio = a.get("artistDisplayBio")
    return {
        "src": "met", "id": f"met-{oid}", "title": a.get("title") or "Untitled",
        "artist": f"{artist} ({bio})" if bio else artist,
        "date": a.get("objectDate") or "", "medium": a.get("medium") or "",
        "museum": "The Metropolitan Museum of Art", "accession": a.get("accessionNumber") or "",
        "link": a.get("objectURL") or "", "small": a["primaryImageSmall"],
        "big": a.get("primaryImage") or a["primaryImageSmall"],
    }


def met():
    ids = []
    for q in QUERIES:
        off = 0
        while True:
            d = get("https://collectionapi.metmuseum.org/public/collection/v1.1/search", departmentId=6, q=q, hasImages="true", isPublicDomain="true", limit=500, offset=off)
            got = (d or {}).get("objectIDs") or []
            ids += got
            off += len(got)
            if len(got) < 500:
                break
    ids = list(dict.fromkeys(ids))
    print(f"met ids {len(ids)}", file=sys.stderr, flush=True)
    with ThreadPoolExecutor(4) as ex:
        return [x for x in ex.map(met_object, ids) if x]


if __name__ == "__main__":
    rows = cleveland()
    print(f"cleveland {len(rows)}", file=sys.stderr, flush=True)
    rows += met()
    json.dump(rows, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
    print(f"{len(rows)} Japanese pictures", file=sys.stderr)
