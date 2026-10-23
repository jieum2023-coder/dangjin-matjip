"""scripts/raw/*.json (crawl.py 결과)에서 사실 정보만 뽑아 scripts/extracted.json 으로 저장한다.

- 기사 본문 끝의 정보 블록(■위치: … ■문의: … 형식)과 제목에서 상호·지역·대표자를 뽑는다.
- 기사 문장은 저장하지 않는다. 사람이 검토할 때 참고할 수 있게 본문 앞부분 일부만 digest에 남긴다.
- 음식점 여부·음식종류는 키워드로 1차 추정만 하고, 최종값은 scripts/overrides.json 에서 덮어쓴다.

실행: python3 scripts/extract.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
RAW = ROOT / "raw"

MARK = r"[□■◼◾▪▶▷●◆◇○•※☞☎◎◈△▲\-]"
FIELD_KEYS = {
    "address": ["위치", "주소", "장소", "소재지"],
    "phone": ["문의", "전화", "연락처", "예약", "전화번호", "예약문의", "주문전화", "TEL", "Tel", "tel"],
    "hours": ["영업시간", "운영시간", "영업 시간", "운영 시간", "오픈시간", "시간", "영업"],
    "closed": ["휴무", "휴무일", "정기휴무", "휴일", "쉬는 날", "쉬는날"],
    "prices": ["가격", "메뉴", "주요메뉴", "주요 메뉴", "대표메뉴", "대표 메뉴", "주메뉴", "메뉴 및 가격", "메뉴·가격",
               "메뉴 가격", "메뉴가격", "가격대"],
}
KEY_TO_FIELD = {k: f for f, ks in FIELD_KEYS.items() for k in ks}
KEY_RE = "|".join(sorted(map(re.escape, KEY_TO_FIELD), key=len, reverse=True))
LINE_RE = re.compile(rf"^\s*{MARK}?\s*({KEY_RE})\s*[:：]\s*(.+)$")

AREA_RE = r"[가-힣]{1,4}(?:동|읍|면)(?:\s*[가-힣0-9]{1,5}리)?"
EUP_MYEON = ["합덕읍", "송악읍", "고대면", "석문면", "대호지면", "정미면", "면천면", "순성면", "우강면",
             "신평면", "송산면"]
DONG = ["읍내동", "채운동", "우두동", "원당동", "시곡동", "수청동", "대덕동", "행정동", "용연동",
        "사기소동", "구룡동", "정미동"]

FOOD_WORDS = ("식당 음식 메뉴 맛 요리 카페 커피 빵 베이커리 디저트 케이크 국밥 탕 찌개 고기 갈비 삼겹 치킨 "
              "피자 햄버거 버거 짬뽕 짜장 중식 중화 한식 일식 초밥 스시 회 횟집 분식 김밥 떡볶이 냉면 국수 "
              "칼국수 면 우동 돈가스 돈까스 족발 보쌈 곱창 막창 해장 순대 추어 장어 아구 낙지 쭈꾸미 주꾸미 "
              "게장 백반 정식 뷔페 샤브 쌀국수 파스타 스테이크 브런치 와플 마카롱 떡 술집 호프 포차 이자카야 "
              "닭갈비 오리 한우 정육식당 반찬 도시락 토스트 샌드위치 아이스크림 빙수 차 찻집 막국수 해물 "
              "만두 수제비 탕수육 마라 양꼬치 쌈밥 한정식 생선 구이 전골 감자탕 설렁탕 곰탕 육개장 샐러드").split()
NON_FOOD_WORDS = ("미용 헤어 네일 피부 에스테틱 학원 교습 병원 의원 치과 한의원 약국 안경 휴대폰 부동산 "
                  "세차 자동차 카센터 정비 타이어 인테리어 가구 꽃 플라워 옷 의류 패션 골프웨어 스포츠 탁구 "
                  "헬스 필라테스 요가 태권도 당구 PC방 노래 사진관 스튜디오 세탁 빨래방 철물 공방 펜션 "
                  "모텔 호텔 숙박 마트 편의점 문구 서점 반려 애견 동물병원 렌탈 컴퓨터 보청기 공인중개").split()


def clean(s):
    return re.sub(r"\s+", " ", s).strip(" ,.·") if s else s


def parse_footer(text):
    out = {}
    for line in text.split("\n"):
        # 한 줄에 여러 항목이 붙어 있는 경우(■위치: … ■문의: …)를 나눈다.
        for part in re.split(rf"(?={MARK}\s*(?:{KEY_RE})\s*[:：])|\s/\s(?=(?:{KEY_RE})\s*[:：])", line):
            m = LINE_RE.match(part)
            if not m:
                continue
            field = KEY_TO_FIELD[m.group(1)]
            val = clean(m.group(2))
            if field not in out and val:
                out[field] = val
    # ☎ 355-0000 처럼 항목명 없이 전화번호만 있는 경우
    if "phone" not in out:
        m = re.search(r"[☎☏]\s*[.:]?\s*([\d\-\s]{7,})", text)
        if m:
            out["phone"] = clean(m.group(1))
    return out


def norm_phone(s):
    if not s:
        return None
    m = re.search(r"(0\d{1,3}[-\s)]?\d{3,4}[-\s]?\d{4}|\d{3,4}-\d{4})", s)
    if not m:
        return None
    num = re.sub(r"[\s)]", "-", m.group(1))
    if not num.startswith("0"):
        num = "041-" + num  # 지역번호가 빠진 당진(041) 번호
    return num


def split_hours(hours, closed):
    """영업시간 괄호 안의 '매주 ○요일 휴무'를 휴무일로 분리한다."""
    if hours and not closed:
        m = re.search(r"([^,()]*?(?:휴무|휴일|쉼)[^,()]*)", hours)
        if m:
            closed = clean(m.group(1))
    return hours, closed


def region_of(*texts):
    for t in texts:
        if not t:
            continue
        for name in EUP_MYEON:
            if name in t:
                return name
        for name in DONG:
            if name in t:
                return name
    return None


def parse_title(title):
    t = re.sub(r"^\s*\[[^\]]*?(신설상가|맛집)[^\]]*?\]\s*", "", title)
    t = re.sub(r"^신설상가\s*", "", t)
    res = {"name": None, "owner": None, "area": None}

    # [신설상가-상호 | 대표 홍길동]
    m = re.match(r"^\[신설상가\s*-\s*(.+?)\s*\|\s*(?:대표|원장|사장)\s*([^\]]+)\]", title)
    if m:
        res["name"], res["owner"] = clean(m.group(1)), clean(m.group(2))
        return res
    # ‘상호’| 대표 홍길동 또는 ‘상호’ - “…”
    m = re.match(r"^[‘'\"“]([^’'\"”]+)[’'\"”]\s*(?:[|\-]\s*(?:대표|원장)?\s*([가-힣·`ㆍ,\s]+?)(?:\s*(?:씨|부부|대표))?\s*[-“\"]|)", t)
    if m:
        res["name"] = clean(m.group(1))
        if m.group(2):
            res["owner"] = clean(m.group(2))
        return res
    # 상호(지역) 홍길동 대표
    m = re.match(rf"^(.+?)\s*\(([^)]*?)\)\s*(.*)$", t)
    if m and re.search(AREA_RE, m.group(2)):
        res["name"], res["area"] = clean(m.group(1)), clean(m.group(2))
        rest = m.group(3)
    else:
        # 지역 상호 홍길동 대표
        m = re.match(rf"^({AREA_RE})\s+(.+)$", t)
        if not m:
            return res
        res["area"], rest = m.group(1), m.group(2)
        m2 = re.match(r"^(.+?)\s+([가-힣]{2,4}(?:\s*[·`ㆍ,]\s*[가-힣]{2,4})*)\s*(?:대표|원장|점장|사장|셰프|부부|씨)", rest)
        if m2:
            res["name"], res["owner"] = clean(m2.group(1)), clean(m2.group(2))
        return res
    m2 = re.match(r"^([가-힣]{2,4}(?:\s*[·`ㆍ,]\s*[가-힣]{2,4})*)\s*(?:대표|원장|점장|사장|부부|씨)", rest)
    if m2:
        res["owner"] = clean(m2.group(1))
    return res


CUISINE_WORDS = [
    ("카페·디저트", "카페 커피 베이커리 빵 제과 케이크 디저트 마카롱 와플 크로플 아이스크림 빙수 꽈배기 도넛 도너츠 "
                  "츄러스 탕후루 쿠키 스콘 찻집 꽃차 한방차 라떼 베이글 에그타르트 떡카페 호두과자 붕어빵 솜사탕"),
    ("중식", "짬뽕 짜장 중화 중식 반점 탕수육 마라 양꼬치 훠궈 북경오리 깐풍기"),
    ("일식", "초밥 스시 일식 라멘 돈부리 덮밥 우동 이자카야 선술집 참치 연어 오뎅 타코야끼 모밀 소바"),
    ("양식", "파스타 피자 스테이크 함박 버거 브런치 이탈리안 리조또 경양식 샌드위치 샐러드 바비큐 케밥"),
    ("분식", "분식 김밥 떡볶이 튀김 순대 핫도그 토스트 만두 라면 쫄면"),
]


def guess_cuisine(title, prices):
    hay = f"{title} {prices or ''}"
    scores = {c: sum(hay.count(w) for w in words.split()) for c, words in CUISINE_WORDS}
    best = max(scores, key=scores.get)
    return best if scores[best] else "한식"


def food_score(title, prices, lead):
    hay = f"{title} {prices or ''} {lead}"
    food = sum(hay.count(w) for w in FOOD_WORDS)
    non = sum(hay.count(w) for w in NON_FOOD_WORDS)
    return food, non


def main():
    index = json.loads((RAW / "_index.json").read_text(encoding="utf-8"))
    rows, unread = [], []
    for item in index["articles"]:
        path = RAW / f"{item['idxno']}.json"
        if not path.exists():
            unread.append(item)
            continue
        art = json.loads(path.read_text(encoding="utf-8"))
        text = art.get("text") or ""
        f = parse_footer(text)
        tp = parse_title(art.get("headline") or item["title"])
        hours, closed = split_hours(f.get("hours"), f.get("closed"))
        lead = text[:300]
        food, non = food_score(item["title"], f.get("prices"), lead)
        rows.append({
            "idxno": item["idxno"],
            "title": clean(art.get("headline") or item["title"]),
            "url": item["url"],
            "date": art.get("date"),
            "section": art.get("section"),
            "title_tagged": item.get("title_tagged"),
            "name": tp["name"],
            "owner": tp["owner"],
            "area_in_title": tp["area"],
            "address": f.get("address"),
            "phone": norm_phone(f.get("phone")),
            "phone_raw": f.get("phone"),
            "prices": f.get("prices"),
            "hours": hours,
            "closed": closed,
            "region": region_of(tp["area"], f.get("address"), lead),
            "cuisine_guess": guess_cuisine(item["title"], f.get("prices")),
            "food_score": food,
            "nonfood_score": non,
            "lead": lead,  # 검토용. restaurants.json 에는 들어가지 않는다.
        })
    out = {"rows": rows, "unread": unread}
    (ROOT / "extracted.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"추출 {len(rows)}건, 본문 없음 {len(unread)}건")


if __name__ == "__main__":
    main()
