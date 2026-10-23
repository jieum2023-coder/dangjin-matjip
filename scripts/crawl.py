"""당진시대 '신설상가' 코너 기사 수집기.

코너 목록(POST)을 끝까지 돌며 기사 링크를 모으고, 제목의 [신설상가]/[맛집] 표시 여부를
title_tagged로 기록한 뒤 본문 텍스트를 scripts/raw/<idxno>.json 으로 저장한다.
(식당 정보 추출과 restaurants.json 작성은 이 원문을 바탕으로 따로 진행)

실행: python3 scripts/crawl.py
"""
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE = "https://www.djtimes.co.kr"
# 이 사이트는 GET 쿼리를 무시하고 전체기사를 돌려주는 경우가 있어 목록은 POST로 요청한다.
LIST_URL = BASE + "/news/articleList.html"
LIST_PARAMS = {"sc_sub_section_code": "S2N26", "view_type": "tm"}
TITLE_OK = re.compile(r"^\s*\[(당진\s*)?(신설상가|맛집)\]")
OUT = Path(__file__).parent / "raw"
HEADERS = {"User-Agent": "Mozilla/5.0 (dangjin-matjip crawler)"}


def get(url, data=None):
    for attempt in range(3):
        try:
            if data:
                r = requests.post(url, data=data, headers=HEADERS, timeout=20)
            else:
                r = requests.get(url, headers=HEADERS, timeout=20)
            r.raise_for_status()
            r.encoding = r.apparent_encoding or "utf-8"
            return r.text
        except requests.RequestException as e:
            print(f"  ! {url} 실패({attempt + 1}/3): {e}", file=sys.stderr)
            time.sleep(2 * (attempt + 1))
    return None


def list_page(page):
    html = get(LIST_URL, {**LIST_PARAMS, "page": page})
    if html is None:
        return page, None, None
    soup = BeautifulSoup(html, "html.parser")
    total = soup.find(string=re.compile(r"[\d,]+건"))
    links = []
    for a in soup.select('#section-list h4.titles a[href*="articleView.html?idxno="]'):
        idx = re.search(r"idxno=(\d+)", a["href"]).group(1)
        links.append((idx, re.sub(r"\s+", " ", a.get_text(" ", strip=True))))
    return page, links, total


def list_articles():
    _, first, total = list_page(1)
    n_total = int(re.sub(r"\D", "", total))
    last = -(-n_total // len(first))
    print(f"코너 전체 {n_total}건, 약 {last}페이지", flush=True)
    # 마지막 페이지 계산이 어긋날 수 있어 2페이지 더 확인한다.
    with ThreadPoolExecutor(max_workers=4) as pool:
        pages = [(1, first, total)] + list(pool.map(list_page, range(2, last + 3)))
    seen, articles, failed_pages = set(), [], []
    for page, links, _ in pages:
        if links is None:
            failed_pages.append(page)
            continue
        for idx, title in links:
            if not title or idx in seen:
                continue
            seen.add(idx)
            # 오래된 기사는 제목에 [신설상가] 표시가 없는 경우가 많아 일단 모두 받고 표시 여부만 기록한다.
            articles.append({
                "idxno": idx, "title": title,
                "url": f"{BASE}/news/articleView.html?idxno={idx}",
                "title_tagged": bool(TITLE_OK.match(title)),
            })
    print(f"목록 수집 {len(articles)}건, 실패한 목록 페이지 {failed_pages}", flush=True)
    return articles, failed_pages


def fetch_article(item):
    html = get(item["url"])
    if html is None:
        return None
    soup = BeautifulSoup(html, "html.parser")
    body = soup.select_one("#article-view-content-div") or soup.select_one("article")
    date = None
    for li in soup.select(".infomation li, .info-group li, .article-info li"):
        m = re.search(r"\d{4}\.\d{2}\.\d{2}", li.get_text())
        if m and "입력" in li.get_text():
            date = m.group(0).replace(".", "-")
            break
    if date is None:
        meta = soup.select_one('meta[property="article:published_time"]')
        if meta:
            date = meta["content"][:10]
    headline = soup.select_one("h3.heading")
    info = [li.get_text(" ", strip=True) for li in soup.select(".infomation li")]
    return {
        **item,
        "headline": headline.get_text(" ", strip=True) if headline else item["title"],
        "date": date,
        "section": info[0] if info else None,
        "text": body.get_text("\n", strip=True) if body else None,
    }


def main():
    OUT.mkdir(exist_ok=True)
    index_path = OUT / "_index.json"
    if index_path.exists():
        summary = json.loads(index_path.read_text(encoding="utf-8"))
    else:
        articles, failed_pages = list_articles()
        summary = {"articles": articles, "failed_pages": failed_pages}
        index_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    articles = summary["articles"]
    print(f"\n대상 기사 {len(articles)}건", flush=True)

    def work(item):
        path = OUT / f"{item['idxno']}.json"
        if path.exists():
            return None
        data = fetch_article(item)
        if not data or not data["text"]:
            return item
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"기사 {item['idxno']} {item['title'][:40]}", flush=True)
        return None

    # 서버 응답이 느려 동시에 4건씩만 요청한다.
    with ThreadPoolExecutor(max_workers=4) as pool:
        failed = [r for r in pool.map(work, articles) if r]
    summary["failed"] = failed
    index_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"완료. 본문 저장 실패 {len(failed)}건")
    for f in failed:
        print("  -", f["title"], f["url"])


if __name__ == "__main__":
    main()
