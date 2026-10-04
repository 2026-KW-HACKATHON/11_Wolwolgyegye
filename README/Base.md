# 기본 수칙

1. Branch
    
- Branch는 오직 6개로만 구성하여 사용할 예정이며, 다음과 같은 용도로 사용한다.
    - `Main` : 최종 / 4명의 대면 혹은 원격 허락 하에 수정 가능
    - `Develop` : 팀원 모두의 코드를 취합한 환경 / Main 이전 모두가 다룰 수 있는 Demo
        - `Song`
        - `Min`
        - `Young`
        - `Jun`   : 각 중간글자로 브랜치의 이름을 명명하며, 본인의 코드를 작성 후 올린다.
---
2. Flowchart

- 순서도는 다음과 같으며, 언제든지 정보의 수정이 이뤄질 수 있다.

- 기본 화면
    - `카테고리`
        - `리스트`
        - `지도`
        - 공간 대여
        - 원데이 클래스
        - 룰렛
        - 마감 세일
        - 쿠폰제
        - 제휴 가게
        - `설정`
            - 카테고리 설정
            - 계정
            - 테마
    - `로그인`
        - 기본 로그인
        - `회원 가입`
            - 손님
                - 기본 로그인 (네이버, 카카오, 구글)
            - `사장님`
                - `본인 인증 (철저히)`
                    - `관리자 승인`
---
3. Tree

- 트리구조를 적어둔 목차이며, 지속적인 수정 요망. 
```
- frontend
    ├─ index.html
    ├─ package.json
    ├─ tsconfig.json
    ├─ vite.config.ts
    ├─ scripts/fetch-vworld.js   (브이월드 → public/data/vworld/*.geojson 건물·경계·영역 수집. 실행: npm run fetch:vworld, 키는 .env.local)
    ├─ scripts/fetch-osm.js      (OpenStreetMap → public/data/osm/ 도로·철도 수집. 실행: npm run fetch:osm, 키 없음)
    ├─ scripts/fetch-sbiz.js     (소상공인 상가정보 → scripts/.data/sbiz-stores.geojson, 월계1동 가게만. 실행: npm run fetch:sbiz)
    ├─ scripts/import-stores.js  (그 파일 → DB stores·store_types. 실행: npm run import:stores, 관리자 키는 .env.local)
    ├─ public/data/vworld/, public/data/osm/  (지도 배경 수집 결과. git 에 올린다. 화면은 이 파일만 읽고 키를 쓰지 않는다)
    ├─ scripts/.data/            (가게 수집 작업 파일. git 에 올리지 않는다. 가게 데이터는 DB 에만 둔다)
    └─ src/
        ├─ main.tsx
        ├─ global.css
        ├─ vite-env.d.ts
        ├─ app/
        │  ├─ App.tsx
        │  ├─ router.tsx
        │  └─ providers/
        │     ├─ AuthProvider.tsx
        │     └─ LayoutModeProvider.tsx
        ├─ core/
        │  ├─ device/      layoutMode.ts, useLayoutModeDetector.ts, LayoutModeContext.ts
        │  ├─ auth/        authTypes.ts, AuthContext.ts, useAuthStatus.ts
        │  ├─ router/      useActivePath.ts
        │  ├─ categories/  categoryTypes.ts, categories.ts, subCategories.ts, enabledCategories.ts, useVisibleCategories.ts
        │  ├─ types/       place.ts            (가게 공통 규격 Store — 필드는 추가만)
        │  ├─ source/      storeSource.ts      (storeId -> Store 조회, 사용자 위치)
        │  ├─ supabase/    client.ts, config.ts, stores.ts (지도 가게 = DB 공개 가게 읽기)
        │  └─ utils/       geo.ts              (거리 / 도보 시간 계산)
        ├─ layout/
        │  ├─ AppShell/          AppShell.tsx/.css, ShellContext.ts   (지도 + 1차 탭 + 바 배치)
        │  ├─ CategoryNav/       CategoryNav.tsx/.css                 (카테고리 바: 하단 가로 / 우측 세로)
        │  ├─ SwipePanel/        SwipePanel.tsx/.css                  (1차 탭: 닫힘 / 반 / 전체)
        │  ├─ KeepAlivePages/    KeepAlivePages.tsx, PageActiveContext.ts
        │  ├─ SecondaryPanel/    SecondaryPanel.tsx/.css              (2차 탭 자리, 구현 예정)
        │  ├─ SubCategories/     SubCategoryList.tsx/.css             (그 외 카테고리: 지도 위쪽 한 줄)
        │  ├─ UserButton/        UserButton.tsx/.css                  (유저 및 설정)
        │  └─ Splash/            Splash.tsx, Splash.css
        ├─ shared/
        │  └─ map/               MainMap.tsx/.css (배경 지도, Leaflet 1.9.4), StoreMap.tsx (위치 약도)
        │     ├─ osm/            normalize.ts (도로·철도 속성 정규화)
        │     ├─ vworld/         mapExtent.ts (지도 범위 규칙), config.ts (스타일·레이어 순서), normalize.ts (속성 정규화),
        │     │                  loadData.ts, draw.ts, geometry.ts (월계1동 안쪽 판단)
        │     └─ placeMarkers.ts (가게 핀: 건물 묶기·줌 묶기·층별 목록)
        └─ features/
            ├─ pageRegistry.ts
            ├─ recommend / space-rental / oneday-class / roulette / closing-sale
            │   / coupon / partner-stores / user (login + settings)   (폴더 형식은 Code.md 4번 참고)
            └─ owner/   사장님 화면 (/owner, AppShell 밖 독립 라우트)
- database
    └─ supabase/migrations/  (DB 표 형태만. 설명은 database/README.md)
- README
    └─ Base.md
```
---
4. Image

- 이미지 파일들은 반드시 `(Image)폴더로 묶어서 사용하는 공간 바로 하위 폴더`로 혹은 `상위 데이터 셋 집합`에 넣어둔다.
---
5. Language

- `HTML` + `CSS` + `JAVASCRIPT`
- `PYTHON`
- `+ETC`

