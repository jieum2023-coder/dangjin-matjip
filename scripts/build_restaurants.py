"""검토 결과를 합쳐 restaurants.json 과 확인용 보고서를 만든다.

입력
- scripts/raw/            : crawl.py 가 받은 기사 원문
- scripts/extracted.json  : extract.py 가 뽑은 사실 정보
- scripts/review/classify_*.txt : 음식점 여부 판정 (F/R/N/?, 파일 번호가 클수록 우선)
- scripts/review/f_*.tsv   : 상호·대표자·음식종류·한줄소개 검토 (나중 파일이 우선, '=' 는 앞선 값 유지)
- scripts/review/splits.json : 한 기사에 여러 식당이 나온 경우

출력
- public/restaurants.json
- scripts/review/report.md, scripts/review/restaurants_review.csv

실행: python3 scripts/build_restaurants.py
"""
import csv
import glob
import json
import re
import statistics
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent
PROJECT = ROOT.parent
REVIEW = ROOT / "review"

CUISINE = {"한": "한식", "중": "중식", "양": "양식", "분": "분식", "일": "일식", "카": "카페·디저트",
           "외": "외국음식", "기": "기타", "타": "식당외"}
# 이 날짜 이전 기사는 넣지 않는다 (폐업 가능성이 높아 제외하기로 함)
MIN_DATE = "2014-01-01"
EXCLUDE = {"X": "음식점 아님", "R": "식품 판매점(식사 불가)", "D": "같은 기사 중복 게재", "S": "여러 식당으로 분리"}

EUP_MYEON = ["합덕읍", "송악읍", "고대면", "석문면", "대호지면", "정미면", "면천면", "순성면", "우강면", "신평면", "송산면"]
DONG = ["읍내동", "채운동", "우두동", "원당동", "시곡동", "수청동", "대덕동", "행정동", "용연동", "사기소동",
        "구룡동", "정미동", "무수동", "계성리"]
# 2012년 시 승격 전 '당진읍 ○○리' 와 '송악면' 표기
OLD_NAMES = {f"당진읍 {d[:-1]}리": d for d in DONG if d.endswith("동")}
OLD_NAMES.update({"송악면": "송악읍", "무수동": "읍내동", "계성리": "읍내동"})

MENTIONS = {
    "놀이방": r"놀이방|키즈\s?존|키즈룸|놀이\s?공간",
    "룸/단체석": r"룸|단체석|단체 예약|단체예약|연회|별실|방이 마련",
    "주차": r"주차",
    "아기의자": r"아기\s?의자|유아\s?의자|하이체어",
    "좌식": r"좌식",
    "입식": r"입식",
    "혼밥": r"혼자|1인분도|혼밥|1인 메뉴",
    "회식·모임": r"회식|모임",
}


def load_classify():
    cls = {}
    for f in sorted(REVIEW.glob("classify_*.txt")):
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.startswith("#") or not line.strip():
                continue
            p = line.split()
            for i in p[1:]:
                cls[i] = p[0]
    return cls


def load_reviews():
    """f_*.tsv 를 순서대로 합친다. 컬럼: idxno, 상호, 대표자, 음식종류, 한줄소개, [지역]"""
    rev = {}
    for f in sorted(REVIEW.glob("f_*.tsv")):
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.startswith("#") or not line.strip():
                continue
            p = line.split("\t")
            p += [""] * (6 - len(p))
            idx, vals = p[0], p[1:6]
            prev = rev.get(idx)
            if prev:
                vals = [pv if v == "=" else v for v, pv in zip(vals, prev)]
            rev[idx] = vals
    return rev


def pick(v, fallback):
    if v == "=":
        return fallback
    if v in ("-", "", "?"):
        return None
    return v


def norm_region(*texts):
    for t in texts:
        if not t:
            continue
        for old, new in OLD_NAMES.items():
            if old in t:
                return new
        for name in EUP_MYEON + DONG:
            if name in t:
                return OLD_NAMES.get(name, name)
    return None


def norm_address(addr):
    if not addr:
        return None
    a = re.split(r"[☎☏]|\bTEL\b", addr)[0]
    a = re.sub(r"\s+", " ", a).strip(" ,/")
    # 도로명/지번이 없는 설명형 위치(예: '○○ 맞은편')는 그대로 두되 표시만 다르게 한다
    if not re.search(r"\d", a):
        return a
    a = re.sub(r"^(충남|충청남도)\s*", "", a).replace("당진 중앙", "당진중앙")
    if a.startswith("당진시"):
        a = a[3:].strip()
    elif a.startswith("당진군"):
        a = a[3:].strip()
    return "충남 당진시 " + a


PRICE_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*만\s*(\d{1,4})?\s*(천)?|(\d{1,3}(?:,\d{3})+|\d{3,6})\s*원|(\d+)\s*천\s*(\d)?")


def parse_won(s):
    """'1만4000원', '2만2천원', '13,000원', '6천5백원', '9000원' → 정수"""
    s = s.replace(" ", "")
    m = re.match(r"(\d+)만(?:(\d+)천|(\d{1,4}))?", s)
    if m:
        v = int(m.group(1)) * 10000
        if m.group(2):
            v += int(m.group(2)) * 1000
        elif m.group(3):
            v += int(m.group(3))
        return v
    m = re.match(r"(\d+)천(?:(\d)백)?", s)
    if m:
        return int(m.group(1)) * 1000 + (int(m.group(2)) * 100 if m.group(2) else 0)
    m = re.match(r"(\d{1,3}(?:,\d{3})+|\d+)원?", s)
    if m:
        return int(m.group(1).replace(",", ""))
    return None


def parse_menu(prices):
    """가격 문자열 → [{'name','price'}] (가격은 원문 표기 그대로)"""
    if not prices or re.fullmatch(r"[\d\-\s]+", prices):
        return []
    items = []
    text = re.sub(r"[△▲■◼▪•]", ",", prices)
    for chunk in re.split(r",|/|\s{2,}|;", text):
        chunk = chunk.strip(" .·()")
        if not chunk:
            continue
        m = re.search(r"((?:\d[\d,.]*\s*만\s*\d*\s*천?\s*\d*\s*원?|\d[\d,]*\s*천\s*\d?\s*백?\s*원?|\d[\d,]{2,}\s*원))", chunk)
        if m:
            name = chunk[:m.start()].strip(" :()（")
            # 가격 뒤에 붙은 '(중)', '(1인)' 같은 표기도 함께 남긴다
            price = re.sub(r"\s+", " ", chunk[m.start():]).strip()
            if price.count("(") > price.count(")"):
                price += ")"
        else:
            name, price = chunk, None
        name = re.sub(r"\s+", " ", name).strip(" :")
        if name.count("(") > name.count(")"):
            name += ")"
        if name in ("대", "중", "소", "大", "中", "小", "특"):
            continue
        if not name or len(name) > 40 or re.fullmatch(r"[\d\s()~원]+", name):
            # 이름 없이 가격만 나온 조각은 앞 항목의 사이즈별 가격이라 건너뛴다
            continue
        items.append({"name": name, "price": price})
    return items


def price_range(menu, cuisine):
    vals = []
    for it in menu:
        if not it["price"]:
            continue
        v = parse_won(it["price"])
        if v and 1000 <= v <= 300000:
            vals.append(v)
    if not vals:
        return None
    mid = statistics.median(vals)
    if mid < 10000:
        return "1만원 미만"
    if mid < 20000:
        return "1~2만원"
    if mid < 30000:
        return "2~3만원"
    return "3만원 이상"


def mentions(text):
    return [label for label, pat in MENTIONS.items() if re.search(pat, text or "")]


def blank_record():
    return {
        "id": None, "name": None, "address": None, "region": None, "phone": None,
        "lat": None, "lng": None, "cuisine": None, "companions": [],
        "hasRoom": None, "roomCapacity": None, "babyChair": None, "playroom": None,
        "parking": None, "seating": None, "stairs": None,
        "priceRange": None, "menu": [], "hours": None, "closedDays": None,
        "intro": None, "owner": None, "area": None,
        "article": {"title": None, "url": None, "date": None},
        "relatedArticles": [], "articleMentions": [],
        "closed": None, "lastChecked": None,
    }


def split_auto(text):
    """[상호] 소제목 단위로 본문을 나눈다."""
    parts = re.split(r"(?m)^\[([^\]\n]{2,25})\]$", text)
    out = {}
    for i in range(1, len(parts) - 1, 2):
        body = parts[i + 1]
        f = {}
        for key, field in (("문의", "phone"), ("위치", "address"), ("메뉴", "prices")):
            m = re.search(rf"(?m)^\W*{key}\s*[:：]\s*(.+)$", body)
            f[field] = m.group(1).strip() if m else None
        out[parts[i].strip()] = f
    return out


def main():
    import sys
    sys.path.insert(0, str(ROOT))
    from extract import norm_phone  # noqa: E402

    index = json.loads((ROOT / "raw" / "_index.json").read_text(encoding="utf-8"))
    rows = {r["idxno"]: r for r in json.loads((ROOT / "extracted.json").read_text(encoding="utf-8"))["rows"]}
    cls = load_classify()
    rev = load_reviews()
    splits = json.loads((REVIEW / "splits.json").read_text(encoding="utf-8"))

    records, excluded, nameless = [], [], []
    for item in index["articles"]:
        idx = item["idxno"]
        c = cls.get(idx, "N")
        r = rows[idx]
        art = json.loads((ROOT / "raw" / f"{idx}.json").read_text(encoding="utf-8"))
        text = art.get("text") or ""
        if (r["date"] or "") < MIN_DATE:
            continue
        if c not in ("F", "R"):
            continue
        if idx not in rev:
            excluded.append((idx, r, EXCLUDE["R"]))
            continue
        name_v, owner_v, cui_v, intro_v, region_v = rev[idx]
        if cui_v in EXCLUDE and idx not in splits:
            excluded.append((idx, r, EXCLUDE[cui_v]))
            continue

        base = blank_record()
        base["article"] = {"title": r["title"], "url": r["url"], "date": r["date"]}
        base["articleMentions"] = mentions(text)
        title_region = norm_region(r["area_in_title"], r["title"])

        if idx in splits:
            sp = splits[idx]
            if sp["sections"] == "auto":
                secs = [dict(name=k, **v, **sp["overrides"].get(k, {})) for k, v in split_auto(text).items()]
            else:
                secs = sp["sections"]
            for n, s in enumerate(secs, 1):
                rec = json.loads(json.dumps(base))
                rec["id"] = f"djt-{idx}-{n}"
                rec["name"] = s["name"]
                rec["owner"] = s.get("owner")
                rec["cuisine"] = CUISINE[s["cuisine"]]
                rec["intro"] = s["intro"]
                addr = s.get("address") or r["address"]
                rec["address"] = norm_address(addr)
                rec["phone"] = norm_phone(s.get("phone")) or r["phone"]
                rec["region"] = norm_region(addr, r["area_in_title"], r["title"])
                rec["menu"] = parse_menu(s.get("prices"))
                rec["priceRange"] = price_range(rec["menu"], rec["cuisine"])
                rec["hours"], rec["closedDays"] = r["hours"], r["closed"]
                records.append(rec)
            continue

        rec = base
        rec["id"] = f"djt-{idx}"
        rec["name"] = pick(name_v, r["name"])
        rec["owner"] = pick(owner_v, r["owner"])
        rec["cuisine"] = CUISINE[cui_v]
        rec["intro"] = intro_v
        rec["address"] = norm_address(r["address"])
        rec["phone"] = r["phone"]
        rec["region"] = (region_v or None) and norm_region(region_v) or region_v or \
            title_region or norm_region(r["address"])
        rec["menu"] = parse_menu(r["prices"])
        rec["priceRange"] = price_range(rec["menu"], rec["cuisine"])
        rec["hours"] = r["hours"]
        rec["closedDays"] = r["closed"]
        if not rec["name"]:
            # 상호를 찾지 못한 곳은 '기타'로 둔다
            rec["cuisine"] = "기타"
            nameless.append(rec)
        records.append(rec)

    # 같은 가게가 여러 번 소개된 경우: 전화번호가 같고 상호가 비슷하면 최신 기사 하나로 합친다
    def key_name(n):
        return re.sub(r"\s|당진점|당진|본점|점$|\(.*?\)", "", n or "")

    records.sort(key=lambda x: x["article"]["date"] or "", reverse=True)
    merged, seen = [], {}
    for rec in records:
        k = (rec["phone"], key_name(rec["name"])) if rec["phone"] and rec["name"] else None
        if k and k in seen:
            keep = seen[k]
            keep["relatedArticles"].append(rec["article"])
            continue
        if k:
            seen[k] = rec
        merged.append(rec)

    # scripts/geocode.mjs 가 찾아 둔 좌표·법정동을 다시 채운다
    geo_path = ROOT / "geo_cache.json"
    geo = json.loads(geo_path.read_text(encoding="utf-8")) if geo_path.exists() else {}
    for rec in merged:
        g = geo.get(rec["id"])
        if g and g.get("lat"):
            rec["lat"], rec["lng"] = g["lat"], g["lng"]
            rec["region"] = rec["region"] or g.get("region")
        rec["area"] = None if not rec["region"] else rec["region"] if rec["region"] in EUP_MYEON else "시내"

    out = PROJECT / "public" / "restaurants.json"
    out.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(merged, excluded, nameless)
    print(f"식당 {len(merged)}곳 저장 (중복 병합 {len(records) - len(merged)}건), 제외 {len(excluded)}건")


def write_report(recs, excluded, nameless):
    by_old = sorted(recs, key=lambda x: x["article"]["date"] or "")
    with open(REVIEW / "restaurants_review.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["게재일", "상호", "주소", "지역", "음식종류", "전화", "대표메뉴", "가격대", "기사 링크", "id"])
        for r in by_old:
            w.writerow([r["article"]["date"], r["name"] or "(상호 확인 필요)", r["address"] or "", r["region"] or "",
                        r["cuisine"], r["phone"] or "", ", ".join(m["name"] for m in r["menu"][:3]),
                        r["priceRange"] or "", r["article"]["url"], r["id"]])

    def years(r):
        return (r["article"]["date"] or "0000")[:4]

    lines = [f"# 당진시대 신설상가 식당 추출 결과 ({date.today().isoformat()})", ""]
    total = len(recs)
    lines.append(f"- 전체: **{total}곳** ({MIN_DATE[:4]}년 이후 기사, 식당외 포함, 같은 가게 중복 기사는 최신 기사로 병합)")
    lines.append(f"- 제외: {len(excluded)}건 (같은 기사 중복 게재 등)")
    cnt = {}
    for r in recs:
        cnt[r["cuisine"]] = cnt.get(r["cuisine"], 0) + 1
    lines.append("- 음식종류: " + ", ".join(f"{k} {v}" for k, v in sorted(cnt.items(), key=lambda x: -x[1])))
    yc = {}
    for r in recs:
        y = years(r)
        b = "2020~" if y >= "2020" else "2015~2019" if y >= "2015" else "2010~2014" if y >= "2010" else "~2009"
        yc[b] = yc.get(b, 0) + 1
    lines.append("- 게재 시기: " + ", ".join(f"{k} {yc.get(k, 0)}곳" for k in ["~2009", "2010~2014", "2015~2019", "2020~"]))
    for field, label in (("address", "주소"), ("phone", "전화"), ("region", "지역"), ("hours", "영업시간")):
        lines.append(f"- {label} 있음: {sum(1 for r in recs if r[field])}/{total}")
    lines.append("")
    lines.append("## 상호를 기사에서 찾지 못한 곳")
    for r in nameless:
        lines.append(f"- {r['article']['date']} [{r['article']['title']}]({r['article']['url']}) — {r['intro']}")
    lines.append("")
    lines.append("## 음식종류 '기타'로 분류한 곳")
    for r in recs:
        if r["cuisine"] == "기타":
            lines.append(f"- {r['name']} — {r['intro']}")
    lines.append("")
    lines.append("## 제외한 기사")
    for idx, r, why in excluded:
        lines.append(f"- {r['date']} {why}: [{r['title'][:50]}]({r['url']})")
    (REVIEW / "report.md").write_text("\n".join(lines), encoding="utf-8")
    write_review_html(by_old)


def write_review_html(by_old):
    import html
    rows = []
    for i, r in enumerate(by_old, 1):
        a = r["article"]
        rel = "".join(f'<br><a href="{x["url"]}" target=_blank>{x["date"]} 이전 기사</a>' for x in r["relatedArticles"])
        flag = (["상호 미상"] if not r["name"] else []) + (["종류 확인"] if r["cuisine"] == "기타" else [])
        rows.append(
            f"<tr><td>{i}</td><td>{a['date']}</td><td><b>{html.escape(r['name'] or '(상호 확인 필요)')}</b>"
            f"<div class=s>{html.escape(r['intro'] or '')}</div></td><td>{html.escape(r['address'] or '-')}</td>"
            f"<td>{r['region'] or '-'}</td><td>{r['cuisine']}</td>"
            f"<td><a href=\"{a['url']}\" target=_blank>기사</a>{rel}</td><td class=f>{' '.join(flag)}</td></tr>")
    page = (
        "<!doctype html><html lang=ko><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
        "<title>신설상가 식당 목록</title><style>"
        "body{font-family:system-ui,sans-serif;margin:12px;font-size:14px;background:#fff;color:#111}"
        "table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px 4px;vertical-align:top}"
        "th{position:sticky;top:0;background:#f4f4f4;text-align:left}.s{color:#666;font-size:12px}.f{color:#c00;font-size:12px}"
        "input{width:100%;padding:8px;font-size:15px;margin:8px 0;box-sizing:border-box}"
        "@media (prefers-color-scheme:dark){body{background:#111;color:#eee}th{background:#222}td,th{border-color:#333}"
        "a{color:#8ab4f8}.s{color:#aaa}}</style>"
        f"<h2>당진시대 신설상가 식당 {len(by_old)}곳 (게재일 오래된 순)</h2>"
        "<p>오래된 기사일수록 폐업 가능성이 높습니다. 빨간 표시는 확인이 필요한 항목입니다.</p>"
        "<input placeholder='상호·주소·지역으로 찾기' oninput=\"for(const t of document.querySelectorAll('tbody tr'))"
        "t.style.display=t.textContent.includes(this.value)?'':'none'\">"
        "<table><thead><tr><th>#</th><th>게재일</th><th>상호</th><th>주소</th><th>지역</th><th>종류</th><th>링크</th><th></th>"
        "</tr></thead><tbody>" + "".join(rows) + "</tbody></table></html>")
    (REVIEW / "restaurants_review.html").write_text(page, encoding="utf-8")


if __name__ == "__main__":
    main()
