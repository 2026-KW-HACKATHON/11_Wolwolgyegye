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
        │  ├─ categories/  categoryTypes.ts, categories.ts, enabledCategories.ts, useVisibleCategories.ts
        │  ├─ types/       place.ts            (가게 공통 규격 Store — 필드는 추가만)
        │  ├─ mock/        stores.ts           (모든 카테고리가 공유하는 예시 가게 + 기준 위치)
        │  ├─ source/      storeSource.ts      (storeId -> Store 조회, 사용자 위치)
        │  └─ utils/       geo.ts              (거리 / 도보 시간 계산)
        ├─ layout/
        │  ├─ AppShell/          AppShell.tsx, AppShell.css
        │  ├─ Splash/            Splash.tsx, Splash.css
        │  ├─ PageHeader/        PageHeader.tsx, PageHeader.css
        │  ├─ HelpPopup/         HelpPopup.tsx, HelpPopup.css
        │  ├─ KeepAlivePages/    KeepAlivePages.tsx, PageActiveContext.ts
        │  └─ navigation/
        │     ├─ Navigation.tsx
        │     ├─ handlers/           navHandlers.ts, desktopHandlers.ts, touchHandlers.ts, useNavHandlers.ts
        │     ├─ shared/             NavItem.tsx/.css, SwipeStrip.tsx/.css, navTypes.ts, icons.ts
        │     ├─ compact/            CompactNav.tsx/.css
        │     ├─ compact-landscape/  CompactLandscapeNav.tsx/.css
        │     └─ desktop/            DesktopNav.tsx/.css
        └─ features/
            ├─ pageRegistry.ts
            ├─ recommend / space-rental / oneday-class / roulette / closing-sale
            │   / coupon / partner-stores / login / settings   (폴더 형식은 Code.md 4번 참고)
            └─ owner/   사장님 화면 (/owner, AppShell 밖 독립 라우트)
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

