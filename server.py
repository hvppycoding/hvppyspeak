# server.py
# FastAPI server that serves a mobile-optimized PWA for English practice.
# Usage:
#   1) Put your CSV at data/cards.csv (headers: en,ko), or set CSV_PATH env var.
#   2) python3 -m pip install fastapi uvicorn
#   3) python3 server.py
#   4) Visit http://<Mac-mini-IP>:8000 on your phone.

import csv
import io
import os
import hashlib
from typing import List, Dict

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI(title="English Trainer")

CARDS: List[Dict[str, str]] = []
CSV_PATH = os.environ.get("CSV_PATH", "data/cards.csv")
ETAG = ""

def _parse_csv_text(text: str) -> List[Dict[str, str]]:
    # Try to parse with headers first.
    out = []
    sio = io.StringIO(text)
    reader = csv.DictReader(sio)
    # Accept flexible header names
    header_map = None
    if reader.fieldnames:
        lowered = [h.strip().lower() for h in reader.fieldnames]
        # Determine likely columns
        en_key = None
        ko_key = None
        for idx, name in enumerate(lowered):
            if name in ("en", "english", "sentence_en", "eng"):
                en_key = reader.fieldnames[idx]
            if name in ("ko", "korean", "sentence_ko", "kor"):
                ko_key = reader.fieldnames[idx]
        if en_key and ko_key:
            for row in reader:
                en = (row.get(en_key) or "").strip()
                ko = (row.get(ko_key) or "").strip()
                if en and ko:
                    out.append({"en": en, "ko": ko})
            if out:
                return out

    # Fallback: assume two columns without headers, EN first, KO second
    sio.seek(0)
    reader2 = csv.reader(sio)
    for i, row in enumerate(reader2):
        if i == 0 and len(row) == 2 and ("en" in row[0].lower() or "ko" in row[1].lower()):
            # It was probably a header; skip (already tried DictReader above)
            continue
        if len(row) >= 2:
            en = row[0].strip()
            ko = row[1].strip()
            if en and ko:
                out.append({"en": en, "ko": ko})
    return out

def load_cards(path: str):
    global ETAG
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(["en", "ko"])
            w.writerow(["I drive to work", "저는 차를 타고 출근합니다"])
            w.writerow(["She likes coffee", "그녀는 커피를 좋아합니다"])
            w.writerow(["What time is it?", "지금 몇 시예요?"])
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    ETAG = hashlib.sha1(text.encode("utf-8")).hexdigest()
    cards = _parse_csv_text(text)
    return cards

@app.on_event("startup")
def startup():
    global CARDS, CSV_PATH, ETAG
    CARDS = load_cards(CSV_PATH)

@app.get("/api/cards")
def get_cards():
    # Return all cards with a simple ETag for caching.
    resp = JSONResponse({"cards": CARDS, "count": len(CARDS), "etag": ETAG})
    resp.headers["ETag"] = ETAG
    return resp

# Serve static SPA & PWA
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
