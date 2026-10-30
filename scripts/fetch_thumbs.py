"""기사 대표 사진 주소 모으기 (당진시대 허락을 받고 쓰는 용도).

사진 파일은 내려받지 않고 주소만 모은다. 앱은 당진시대 서버의 사진을 그대로 띄우고
'사진: 당진시대'와 기사 링크를 함께 표시한다.

실행: python3 scripts/fetch_thumbs.py   → public/thumbs.json
  { "<기사 idxno>": { "t": 목록용 작은 사진, "p": 본문 첫 사진 } }
이미 모은 기사는 건너뛴다 (--all 이면 전부 다시).
"""
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "thumbs.json"
HEADERS = {"User-Agent": "Mozilla/5.0 (dangjin-matjip crawler)"}
ARTICLE = "https://www.djtimes.co.kr/news/articleView.html?idxno={}"


def fetch(idxno):
    for attempt in range(3):
        try:
            r = requests.get(ARTICLE.format(idxno), headers=HEADERS, timeout=20)
            r.raise_for_status()
            r.encoding = r.apparent_encoding or "utf-8"
            break
        except requests.RequestException:
            time.sleep(2 * (attempt + 1))
    else:
        return idxno, None
    soup = BeautifulSoup(r.text, "html.parser")
    og = soup.select_one('meta[property="og:image"]')
    body_img = soup.select_one("#article-view-content-div figure img, #article-view-content-div img")
    thumb = og.get("content") if og else None
    photo = body_img.get("src") if body_img else None
    # 사진 없는 기사는 사이트 기본 로고가 og:image 로 나온다
    if thumb and "/news/thumbnail/" not in thumb and "/news/photo/" not in thumb:
        thumb = None
    if photo and "/news/photo/" not in photo:
        photo = None
    if not thumb and not photo:
        return idxno, {}
    return idxno, {"t": thumb or photo, "p": photo or thumb}


def main():
    records = json.loads((ROOT / "public" / "restaurants.json").read_text())
    ids = set()
    for r in records:
        for a in [r["article"], *r.get("relatedArticles", [])]:
            m = re.search(r"idxno=(\d+)", (a or {}).get("url") or "")
            if m:
                ids.add(m.group(1))
    out = {} if "--all" in sys.argv or not OUT.exists() else json.loads(OUT.read_text())
    todo = sorted(i for i in ids if i not in out)
    print(f"기사 {len(ids)}건 중 {len(todo)}건 확인")
    with ThreadPoolExecutor(4) as ex:
        for n, (idxno, res) in enumerate(ex.map(fetch, todo), 1):
            if res is not None:
                out[idxno] = res
            if n % 100 == 0:
                print(n)
    out = {k: v for k, v in sorted(out.items(), key=lambda kv: int(kv[0])) if k in ids}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"사진 있는 기사 {sum(1 for v in out.values() if v)} / {len(out)}")


if __name__ == "__main__":
    main()
