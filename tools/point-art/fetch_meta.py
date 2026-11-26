#!/usr/bin/env python3
"""Point-art, step 1: list every open-access painting the museums give away.

Sources (both public domain / CC0, images free to reuse):
  - The Cleveland Museum of Art Open Access API (openaccess-api.clevelandart.org)
  - The Metropolitan Museum of Art Collection API (collectionapi.metmuseum.org),
    European Paintings (department 11) and the American Wing (department 1, paintings only)

Writes one JSON list of candidates: what the painting is, where it hangs, a small image for
face detection and a large one for the site.

    python3 tools/point-art/fetch_meta.py work/meta.json
"""
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import requests

S = requests.Session()
S.headers["User-Agent"] = "point-art-archive/1.0 (portfolio art project)"


def get(url, **params):
    for i in range(5):
        try:
            r = S.get(url, params=params, timeout=60)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
            # 403 / 429: the museum is throttling us, wait and try again
        except requests.RequestException:
            pass
        time.sleep(2 * (i + 1))
    return None


def cleveland():
    out, skip = [], 0
    while True:
        d = get(
            "https://openaccess-api.clevelandart.org/api/artworks/",
            type="Painting", cc0=1, has_image=1, limit=500, skip=skip,
        )
        rows = (d or {}).get("data") or []
        for a in rows:
            img = (a.get("images") or {})
            web, big = img.get("web"), img.get("print") or img.get("web")
            if not web or not big:
                continue
            creators = a.get("creators") or []
            out.append({
                "src": "cma",
                "id": f"cma-{a['id']}",
                "title": a.get("title") or "Untitled",
                "artist": creators[0]["description"] if creators else (", ".join(a.get("culture") or []) or "Unknown artist"),
                "date": a.get("creation_date") or "",
                "medium": a.get("technique") or "",
                "museum": "The Cleveland Museum of Art",
                "accession": a.get("accession_number") or "",
                "link": a.get("url") or "",
                "small": web["url"],
                "big": big["url"],
            })
        skip += len(rows)
        print(f"cleveland {skip}", file=sys.stderr)
        if len(rows) < 500:
            return out


def met_object(oid):
    a = get(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}")
    if not a or not a.get("isPublicDomain") or not a.get("primaryImageSmall"):
        return None
    if "paint" not in (a.get("classification") or "").lower() and "oil" not in (a.get("medium") or "").lower():
        return None
    artist = a.get("artistDisplayName") or a.get("culture") or "Unknown artist"
    bio = a.get("artistDisplayBio")
    return {
        "src": "met",
        "id": f"met-{oid}",
        "title": a.get("title") or "Untitled",
        "artist": f"{artist} ({bio})" if bio else artist,
        "date": a.get("objectDate") or "",
        "medium": a.get("medium") or "",
        "museum": "The Metropolitan Museum of Art",
        "accession": a.get("accessionNumber") or "",
        "link": a.get("objectURL") or "",
        "small": a["primaryImageSmall"],
        "big": a.get("primaryImage") or a["primaryImageSmall"],
    }


def met():
    ids = []
    for dep, q in ((11, "*"), (1, "painting")):
        off = 0
        while True:
            d = get(
                "https://collectionapi.metmuseum.org/public/collection/v1.1/search",
                departmentId=dep, q=q, hasImages="true", isPublicDomain="true", limit=500, offset=off,
            )
            got = (d or {}).get("objectIDs") or []
            ids += got
            off += len(got)
            if len(got) < 500:
                break
    ids = list(dict.fromkeys(ids))
    print(f"met ids {len(ids)}", file=sys.stderr)
    with ThreadPoolExecutor(4) as ex:
        return [x for x in ex.map(met_object, ids) if x]


if __name__ == "__main__":
    rows = cleveland() + met()
    json.dump(rows, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
    print(f"{len(rows)} paintings", file=sys.stderr)
