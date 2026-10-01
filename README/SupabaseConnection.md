# Supabase 첫 연결

## 범위

`frontend/src/core/supabase/`에 공통 클라이언트와 공개 가게 조회 함수를 준비했다.
기존 mock 데이터, 브라우저 저장 게시글, 임시 로그인은 아직 교체하지 않았다.
`fetchPublicStores()`는 공개 가게를 이름·ID 순으로 최대 100개 조회한다.
카테고리 데이터와 DB의 UUID를 대응한 뒤 화면별로 연결해야 한다.

## 로컬 설정

기존 `frontend/.env.local`의 카카오맵 설정을 유지하고 다음 변수를 추가한다.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Secret key, service_role JWT, DB 비밀번호는 브라우저 환경변수에 넣지 않는다.
현재 연결 코드는 `sb_publishable_` 형식만 허용한다. 공개 키 자체는 권한 장벽이 아니므로 DB의 RLS 정책이 필수다.
`.env.local`은 Git에서 제외되어 있다. 설정 변경 후 개발 서버를 다시 시작한다.

## 읽기 연결 검사

Node.js 24에서 `frontend` 폴더를 기준으로 실행한다.

```powershell
npm run test:supabase-config
npm run db:check
npm run build
```

`db:check`는 Vite development 환경변수와 현재 프로세스 환경변수(우선)를 읽는다.
공개용 키로 `stores`의 공개 가게 수만 조회하며 데이터·키 값은 출력하지 않는다.
조회가 성공해도 0개일 수 있다. 데이터가 없거나 비공개인 경우이며, 조회 권한을 풀어서 해결하지 않는다.
이 검사는 로그인·사진 업로드·쓰기 권한 또는 전체 RLS 검증을 대신하지 않는다.

## 다음 단계

1. 실제 주소·좌표·공개 동의를 확인한 가게를 등록한다. 예시 데이터는 실제 가게로 표시하지 않는다.
2. 공개 가게 조회 함수를 화면에 연결한다. 기존 mock ID와 UUID가 다르므로 단순 전환하지 않는다.
3. 실제 Auth와 사장님 승인 흐름을 연결한 뒤 본인 가게의 게시글 등록을 검증한다.
4. 배포할 때 Vercel에도 동일한 공개용 환경변수를 설정하고 새 빌드를 실행한다.

## SQL 수동 적용 주의

사용자가 Supabase SQL Editor에서 초기 SQL 6개를 순서대로 실행했다고 확인했다.
수동 실행은 CLI migration 이력 등록과 별개다. 이후 `db push` 전에 실제 스키마와 migration 이력을 대조해야 한다.
초기 SQL을 재실행하거나 원격 `db reset`을 실행하지 않는다.
`database/tests/bootstrap.sql`과 개발용 `seed.sql`은 운영 DB에 실행하지 않는다.
