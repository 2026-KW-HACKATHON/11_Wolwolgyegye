# 월월계계 데이터베이스

Supabase(PostgreSQL) 구조. 이 폴더에는 **표의 형태(SQL)만** 둔다. 가게·메뉴·게시글 같은 데이터는 실제 DB 에만 있다.

## 폴더 구조

```text
database/
├─ README.md                 실행 방법과 적용 순서
├─ schema.md                 표 관계와 칸 설명
├─ auth.md                   일반/사장님 가입·로그인·승인 흐름
├─ package.json              DB 검사용 개발 의존성 (PGlite)
├─ package-lock.json
├─ supabase/
│  ├─ config.toml            로컬 Supabase 설정
│  ├─ migrations/
│  │  └─ 20261004000100_schema.sql   전체 구조 (2026-10-04 새로 설계)
│  └─ reset/
│     └─ 20261004_drop_old_schema.sql 이전 구조 지우기 (일회용, 실제 DB 에서 한 번만)
└─ tests/
   ├─ bootstrap.sql          테스트 전용 Auth/Storage 최소 대역
   └─ database.test.mjs      제약·RLS·함수 검사
```

파일명 앞 번호는 버전이다. 실제 DB 에 적용한 SQL 은 고치지 않고, 바꿀 내용을 새 번호의 파일로 추가한다.

## 로컬 검사

`database` 폴더에서 실행한다. 메모리 PostgreSQL(PGlite)을 쓰므로 키·외부 DB 가 필요 없다.

```powershell
npm ci
npm test
```

검사 범위(12개): 모든 표의 RLS, 비로그인 공개/비공개 조회, 사장님 수정 가능 칸, 메뉴·영업시간·이미지 소유권,
제휴 등록 권한, 마감세일 세 유형 필수값, 공간대여·클래스 공개 범위와 사진, 가입 프로필 생성, 사장님 신청·승인,
가게 찜, 스탬프 적립 중복 방지, 사진 저장소 경로 소유권.
Auth/Storage 서비스 자체는 대역이므로 실제 로그인·업로드는 Supabase 에서 따로 확인한다.

## 실제 Supabase 적용 (SQL Editor)

팀은 CLI 대신 대시보드 SQL Editor 로 SQL 을 실행한다.

1. 2026-09-26 이전 구조가 남아 있으면 `supabase/reset/20261004_drop_old_schema.sql` 전체를 실행해 먼저 지운다. (표 이름이 겹쳐 새 구조가 만들어지지 않는다)
2. `supabase/migrations/20261004000100_schema.sql` 파일 **전체**를 붙여 넣고 실행한다.
3. `frontend` 폴더에서 가게를 넣는다.
   ```powershell
   npm run fetch:sbiz      # 상가정보 → scripts/.data/sbiz-stores.geojson (git 에 안 올라감)
   npm run import:stores   # 그 파일 → DB stores 표 (+ store_types)
   ```
   `import:stores` 는 `frontend/.env.local` 의 `SUPABASE_SECRET_KEY`(sb_secret_…)를 쓴다. 이 키에는 `VITE_` 를 붙이지 않는다.
4. 분류(공간대여·원데이클래스)와 제휴사는 운영자가 SQL Editor 에서 넣는다.

## 데이터가 들어오는 길

| 데이터 | 넣는 쪽 |
|---|---|
| 가게 851곳, 대표 유형 | `npm run import:stores` (상가정보, 여러 번 실행해도 중복 없음) |
| 메뉴·영업시간·사진·마감세일·공간대여·클래스 | 사장님 화면 (자기 가게만) |
| 제휴사·제휴 혜택·분류·가게 공개/숨김·사장님 승인 | 운영자 (SQL Editor) |

- 가게 행은 상가업소번호(`stores.sbiz_id`)로 구분한다. 사장님이 연결된 가게는 다시 넣을 때 건너뛰어 사장님이 고친 정보를 지킨다.
- 새 가게는 공개(`is_published=true`)로 들어간다. 상가정보 기준월(`sbiz_month`) 이후 폐업했을 수 있어, 지도 아래에 기준월을 표시한다.

## 보안 규칙

- 비로그인 사용자: 공개 가게와 거기에 딸린 메뉴·영업시간·사진·세일·혜택·공간대여·클래스만 조회.
- 로그인 사용자: 본인 프로필·찜·스탬프 내역 조회. 찜은 직접 추가/삭제.
- 사장님: 본인 가게의 이름·유형·전화, 메뉴·영업시간·사진·세일·공간대여·클래스·스탬프 정책 관리. 소유권·좌표·공개 여부는 못 바꾼다.
- 운영자/서버: 가게 등록·공개, 소유권 연결(`review_owner_application`), 제휴·분류 등록, 스탬프 적립/차감(`apply_stamp_change`).
- `service_role`·Supabase secret key 는 프론트나 `VITE_*` 변수에 절대 넣지 않는다.

[Supabase RLS 안내](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 사진

공개 버킷 `store-media`, 경로 `<store_id>/<파일>`. JPG/PNG/WebP, 최대 5MiB. DB 에는 경로만 저장하고 프론트에서 공개 URL 로 바꾼다.
공개 버킷이라 글을 숨겨도 사진 URL 자체는 공개된다. 신분증·사업자 증빙은 넣지 않는다.

## 범위

전화 문의 방식이라 예약·결제·채팅 표는 없다. 로그인은 Supabase Auth 를 쓰며 비밀번호 표는 없다. 평점/리뷰는 수집 기능이 없어 제외했다.
