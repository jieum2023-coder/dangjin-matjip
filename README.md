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

5. 지도를 쓰려면 Vercel 프로젝트의 **Settings → Environment Variables** 에 `VITE_KAKAO_JS_KEY` 를 넣고
   다시 배포합니다(빌드할 때 키가 들어가므로 키를 바꾸면 재배포가 필요합니다).

## 카카오 지도 설정

1. [developers.kakao.com](https://developers.kakao.com) 에 로그인 → **내 애플리케이션 → 애플리케이션 추가**.
2. 만든 앱의 **앱 키**에서 두 가지를 복사합니다.
   - **JavaScript 키**: 앱 화면의 지도에 씁니다.
   - **REST API 키**: 좌표를 한 번에 찾는 스크립트에만 씁니다(앱에는 들어가지 않음).
3. **플랫폼 → Web → 사이트 도메인**에 앱을 여는 주소를 모두 등록합니다.
   예: `http://localhost:5173`, `http://localhost:4173`, `https://내프로젝트.vercel.app`
4. 앱 설정에 **카카오맵 사용 설정** 항목이 보이면 켜 둡니다(최근 만든 앱은 켜야 지도가 열립니다).
5. 프로젝트 폴더에 `.env` 파일을 만들고(`.env.example` 참고) 키를 넣습니다. `.env` 는 저장소에 올라가지 않습니다.

```
VITE_KAKAO_JS_KEY=자바스크립트키
KAKAO_REST_KEY=REST API 키
```

### 좌표 한 번에 넣기 (권장)

```bash
node scripts/geocode.mjs
```

- 주소로 좌표를 찾아 `public/restaurants.json` 에 `lat`/`lng` 를 채우고, 비어 있던 지역(법정동)도 채웁니다.
- 결과는 `scripts/geo_cache.json` 에 남아서 `build_restaurants.py` 를 다시 돌려도 유지됩니다.
- 주소로 못 찾은 곳은 "당진 + 상호" 키워드로 한 번 더 찾고, 그래도 없으면 목록을 출력합니다.

스크립트를 돌리지 않아도 지도는 동작합니다. 좌표가 없는 가게는 지도를 열 때 브라우저가 주소로 위치를
찾고, 그 결과를 그 기기에 저장해 두었다가 다음부터 다시 씁니다. 다만 기기마다 처음 한 번은 느릴 수 있습니다.

관리 화면 설정은 해당 단계에서 이 문서에 추가합니다.
