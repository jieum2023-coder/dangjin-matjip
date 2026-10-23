# 당진 맛집

당진시대 [신설상가 코너](https://www.djtimes.co.kr/news/articleList.html?sc_sub_section_code=S2N26&view_type=tm)에
소개된 가게(2014년 이후 기사, 702곳)를 모은 모바일 웹앱입니다. Vite + React, 홈 화면에 추가할 수 있는 PWA입니다.

## 로컬에서 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev        # http://localhost:5173 에서 개발용 서버
npm run build      # dist/ 에 배포용 파일 생성
npm run preview    # 만든 배포용 파일을 http://localhost:4173 에서 확인
```

## 데이터

- 앱이 읽는 파일: `public/restaurants.json`
- 기사에 없는 정보(룸·아기의자·놀이방·주차 등)는 `null` 이고, 화면에는 "확인 중"으로 표시됩니다.
- `articleMentions` 는 기사 본문에 해당 단어가 언급됐다는 표시일 뿐 확인된 정보가 아닙니다.

### 데이터 다시 만들기 (선택)

```bash
python3 scripts/crawl.py            # 기사 목록·본문 수집 → scripts/raw/ (약 1시간)
python3 scripts/extract.py          # 사실 정보 추출 → scripts/extracted.json
python3 scripts/build_restaurants.py  # 검토 파일과 합쳐 public/restaurants.json 생성
```

`scripts/review/` 의 검토 파일(음식점 여부, 상호·음식종류·한줄소개)이 최종값을 정합니다.
기사 원문(`scripts/raw/`)과 추출 중간본은 저작권 때문에 저장소에 올리지 않습니다.

### 필드

| 필드 | 뜻 |
|---|---|
| name / address / phone | 상호 / 주소 / 전화 |
| area / region | 지역 그룹(읍·면 또는 "시내") / 법정동·읍면 |
| cuisine | 한식·중식·일식·양식·분식·카페·디저트·외국음식·기타·식당외 |
| companions | 식사상대 태그(업무미팅룸, 부모님·가족, 어린이동반, 혼밥, 회식) |
| hasRoom, roomCapacity, babyChair, playroom, parking, seating, stairs | 방문 후 채우는 편의 정보 |
| priceRange, menu, hours, closedDays | 가격대(기사 게재 당시), 대표메뉴, 영업시간, 휴무일 |
| intro, owner | 한줄소개(직접 작성), 대표자 |
| article, relatedArticles | 기사 제목·링크·게재일, 같은 가게의 이전 기사 |
| closed, lastChecked | 폐업 여부, 최종 확인일 |

## 배포 (Vercel)

1. 이 폴더를 GitHub 저장소에 올립니다.
2. [vercel.com](https://vercel.com) 에서 **Add New → Project** 로 저장소를 고릅니다.
3. Framework Preset 은 **Vite** 로 자동 인식됩니다(빌드 명령 `npm run build`, 출력 폴더 `dist`).
4. **Deploy** 를 누릅니다. `vercel.json` 에 새로고침해도 상세 페이지가 열리도록 설정이 들어 있습니다.

지도(카카오맵)와 관리 화면 설정은 해당 단계에서 이 문서에 추가합니다.
