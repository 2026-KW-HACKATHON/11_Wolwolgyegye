# 월월계계 데이터베이스

현재 프론트 기능을 위한 Supabase 초기 설계다. SQL 파일 작성만으로 실제 Supabase가 변경되거나 프론트가 연결되지는 않는다.

## 폴더 구조

```text
database/
├─ README.md                 실행 방법과 연결 순서
├─ schema.md                 테이블 관계와 프론트 연결 지점
├─ auth.md                   일반/사장님 가입·로그인·승인 흐름
├─ package.json              DB 검증용 개발 의존성
├─ package-lock.json
├─ supabase/
│  ├─ config.toml            로컬 Supabase 설정
│  ├─ migrations/
│  │  ├─ 20260926000100_core.sql       사용자·가게·메뉴
│  │  ├─ 20260926000200_feed.sql       공간대여·클래스·찜
│  │  ├─ 20260926000300_benefits.sql   마감세일·제휴·룰렛
│  │  ├─ 20260926000400_stamps.sql     스탬프 정책·잔액·이력
│  │  ├─ 20260926000500_storage.sql    사진 저장소 접근 권한
│  │  └─ 20260926000600_auth_onboarding.sql  가입 프로필·사장님 신청
│  └─ seed.sql               개발용 예시 데이터
└─ tests/
   ├─ bootstrap.sql          테스트 전용 Auth/Storage 최소 대역
   └─ database.test.mjs       SQL 제약·RLS·스탬프 검증
```

날짜는 폴더가 아니라 **변경 SQL의 파일명 앞 버전 번호**다. 이미 적용한 migration은 수정하지 않고 새 파일을 추가한다. Supabase CLI의 `migration new`가 이 번호를 자동으로 붙인다. [공식 migration 안내](https://supabase.com/docs/guides/local-development/database-migrations)

## 먼저 로컬에서 확인

아래 명령은 이 `database` 폴더 안에서 실행한다.

```powershell
npm ci
npm test
```

Node.js 24에서 검증했다. 테스트는 PGlite의 메모리 PostgreSQL을 사용하므로 Docker, API 키, 외부 DB 연결이 필요 없다. 실행할 때마다 새 DB를 만들며 실제 사용자 데이터에 접근하지 않는다.

검증 범위: 15개 테이블의 RLS, 타인 데이터 변경 차단, 공개/비공개 조회, 필수값, 중복 찜, 스탬프 중복 적립·잔액 부족, 사진 경로 소유권, 가입 프로필 생성, 사장님 신청/승인. 총 21개 테스트.
Auth/Storage HTTP 서비스는 테스트 대역이므로 **실제 로그인·파일 업로드·동시 요청은 Supabase 환경에서 추가 확인해야 한다.**

## 실제 Supabase 연결 순서

1. Docker Desktop을 실행하고 여기서 `npx supabase start`로 로컬 Supabase를 시작한다.
2. 로컬 Studio에서 테이블과 예시 데이터를 확인한다. 기존 로컬 DB가 있다면 `npx supabase migration up --local`로 미적용 migration을 적용한다.
3. Auth 회원 생성 시 `profiles`가 자동 생성된다. 일반 사용자는 소셜 간편로그인, 사장님은 이메일 회원가입·인증·로그인을 기본 흐름으로 한다. 세부 설정은 `auth.md` 참고.
4. 사장님이 `owner_applications`에 신청한다. 관리자가 가게를 준비하고 증빙을 확인한 뒤 서버 전용 `review_owner_application`으로 승인하면 `stores.owner_id`가 연결된다. 가게 공개는 별도 승인한다.
5. 프론트 데이터 공급 함수를 Supabase 조회/저장으로 교체한다. 자세한 대응은 `schema.md` 참고.
6. 검증 후 원격 프로젝트를 연결하고 migration만 배포한다. 기존 테이블이 있는 프로젝트라면 충돌 여부부터 확인한다.

로컬 초기화용 `seed.sql`은 실제 가게 정보가 아니다. 운영 DB에 넣지 않는다. `tests/bootstrap.sql`은 Supabase 시스템 테이블을 흉내 내는 테스트 파일이므로 실제 Supabase에서 실행하지 않는다.
`config.toml`의 로그인 주소는 로컬용이다. 운영 로그인 Redirect URL은 Supabase 대시보드에서 별도로 설정한다.

스키마의 실제 Supabase 적용은 팀이 SQL Editor에서 진행했다. 2026-10-02 공개용 키로 `stores` 비로그인 조회를 확인했으며, 공개된 실제 가게는 빠말 1곳이다. 로그인·Storage·전체 RLS는 운영 서비스에서 별도로 검증해야 한다.

## 실제 월계1동 가게 후보 일괄 수집

[소상공인시장진흥공단 상가(상권)정보](https://www.data.go.kr/data/15083033/fileData.do)의 최신 전국 ZIP 또는 서울 CSV를 내려받는다. 2026-06-30 배포본은 상호명·업종·주소·위경도를 제공하지만 **메뉴·가격·사진·전화번호·영업시간은 제공하지 않는다.** 원본 기준일과 현재 영업 여부가 다를 수 있다.

```powershell
python database/scripts/import_wolgye_stores.py "C:\다운로드\상가정보.zip" --out-dir database/imports
```

이 명령은 `시도명=서울특별시`, `시군구명=노원구`, `행정동명=월계1동`인 행만 골라 `wolgye1-stores-review.csv`와 `wolgye1-stores-import.sql`을 만든다. 2026-10-02 팀이 851건의 비공개 후보를 담은 SQL을 Supabase SQL Editor에서 실행했다. 실제 등록 건수는 기존 행과의 ID 충돌 가능성이 있어 운영 DB에서 별도 집계해야 한다. 생성 SQL은 동일한 상가업소번호를 다시 가져올 때 기존 DB 행을 덮어쓰지 않는다. 영업 및 정보 확인 후 필요한 가게만 별도로 공개한다. 기존 `seed.sql`의 가상 가게와 섞지 않는다.

원본 ZIP/CSV는 저장소에 넣지 않는다. 이 도구는 SQL 파일만 생성하며 Supabase에 자동 접속하거나 운영 DB를 변경하지 않는다.

월계1동 후보 가게는 `scripts/import_wolgye_stores.py`로 검토표와 SQL을 만든 뒤 Supabase `stores`에 적재한다. 프론트는 `is_published=true`인 DB 가게만 조회하며 정적 JSON이나 mock 목록과 합치지 않는다. 후보 전체를 공개하려면 `imports/wolgye1-publish-all-candidates.sql`을 실행하기 전에 [검토 안내](imports/README.md)에 따라 주소와 현재 영업 여부를 확인한다. 프론트 지도의 업종 필터는 `stores.cuisine_type`을 화면에서 묶는 방식이라 DB 테이블을 추가하지 않는다.

## 보안 규칙

- 비로그인 사용자: 공개 가게·게시글·혜택만 조회.
- 로그인 사용자: 본인 프로필·찜·스탬프 내역 조회. 찜은 직접 추가/삭제 가능.
- 사장님: 본인 가게의 정보·게시글·메뉴·세일·스탬프 정책 관리. 소유권 이전과 가게 공개 승인은 불가.
- 관리자/서버: 가게 등록·소유권 확인·제휴 혜택 등록·스탬프 적립/차감.
- 스탬프는 서버에서 구매/보상 조건을 확인한 뒤 `apply_stamp_change` 호출. 같은 요청을 재시도할 때는 같은 `request_id`를 사용한다. 서버 엔드포인트 자체는 아직 구현하지 않았다.
- `service_role` 또는 Supabase secret key는 프론트나 `VITE_*` 변수에 절대 넣지 않는다.

RLS와 함수별 실행 권한을 함께 제한했다. [Supabase RLS 안내](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 사진

공개 사진 버킷은 `store-media`, 파일 경로는 `<store_id>/<임의 UUID>.webp` 형식이다. JPG/PNG/WebP, 최대 5MiB를 허용한다.
DB에는 Storage 경로를 저장하고, 프론트에서 공개 URL로 변환한다. 실제 업로드 파일은 포함하지 않았다.

공개 버킷이므로 게시글을 숨겨도 기존 사진 URL 자체는 공개된다. 사업자 증빙·신분증 등 비공개 문서는 넣지 않는다. [Storage 접근 제어 안내](https://supabase.com/docs/guides/storage/security/access-control)

## 범위

전화 문의 방식이라 예약·결제·채팅 테이블은 만들지 않았다. 로그인은 Supabase Auth를 사용하며 비밀번호 테이블은 따로 만들지 않는다. 가게 평점/리뷰는 실제 수집 기능이 없어 제외했다.
