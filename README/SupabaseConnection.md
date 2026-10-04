# Supabase 첫 연결

## 범위

`frontend/src/core/supabase/`에 공통 클라이언트와 공개 가게 조회 함수를 준비했다.
로그인·회원가입은 Supabase Auth로 연결했다. 가짜(mock) 데이터는 두지 않는다.
`fetchMapStores()`(`core/supabase/stores.ts`)가 공개 가게 전부를 지도 핀으로 읽는다. 표 구조는 `database/schema.md` 참고.
메뉴·세일·공간대여 등 카테고리 화면은 아직 DB와 연결하지 않았다.

## 로컬 설정

`frontend/.env.local`에 다음 변수를 추가한다.

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

## 로그인 설정

`/login`에서 주민 카카오 간편로그인, 주민 이메일 회원가입, 사장님 이메일 회원가입·로그인을 제공한다. 이메일 가입은 인증 메일을 보낸 뒤 계정을 활성화한다. 사장님은 인증된 이메일 계정으로 로그인한 후 이름·연락처·가게 정보를 제출하며, 승인 후 `stores.owner_id`가 연결되면 `/owner`를 열 수 있다.

- Supabase Dashboard의 Authentication → URL Configuration에서 배포 주소를 Site URL로 설정하고 `https://배포주소/login`, `https://배포주소/login?intent=owner`, 로컬 개발 주소의 같은 경로를 Redirect URLs에 추가한다.
- Authentication → Providers에서 Email 가입·이메일 확인을 활성화한다. 인증 메일과 비밀번호 재설정 메일이 실제로 배달되도록 운영용 SMTP를 설정한다.
- 카카오 간편로그인은 Supabase 기본 Kakao provider가 `account_email`, `profile_image`, `profile_nickname`을 항상 요청해, 이메일 동의 권한이 없는 비즈 앱 미등록 상태에서는 Kakao `KOE205`로 실패한다. `Allow users without an email`만 켜거나 클라이언트의 `scopes`를 바꾸어도 기본 요청 범위는 제거되지 않는다.
- 이 앱은 Supabase Authentication → Sign In / Providers → Custom Providers에서 OIDC 제공자 `custom:kakao-no-email`을 생성해 사용한다. Issuer URL은 `https://kauth.kakao.com`, Client ID는 카카오 REST API 키, Client Secret은 해당 키의 카카오 로그인 클라이언트 시크릿 코드다. Scopes는 `openid`, `profile_nickname`만 설정하고 `Email optional`을 켠다. Kakao Developers의 OpenID Connect도 ON이어야 한다. 생성 화면의 Callback URL을 Kakao Developers → 앱 → 플랫폼 키 → REST API 키 → 로그인 리다이렉트 URI에 등록한다. 시크릿은 대시보드에 직접 입력하고 저장소나 채팅에 남기지 않는다.
- 기본 Kakao provider의 활성화는 위 맞춤형 제공자를 대신하지 않는다. 제공자 생성 전에는 사이트의 카카오 버튼이 동작하지 않는다. 운영 사이트에서 로그인 버튼 → Kakao 동의 → `/login` 복귀 → 세션 생성까지 검증해야 한다.
- 비밀번호·OAuth 토큰·`service_role` 키는 앱 테이블이나 프론트 환경변수에 저장하지 않는다. 실제 권한은 RLS와 `stores.owner_id`가 판단한다.

브라우저에서 이메일 가입→인증→로그인→로그아웃, 카카오 로그인→복귀, 사장님 신청→관리자 승인→`/owner` 접근을 각각 실제 계정으로 점검해야 한다. 관리자 승인 API와 화면은 아직 구현되지 않아 승인 처리는 서버 측에서 별도로 수행한다.

## 다음 단계

1. 메뉴·영업시간·사진·세일·공간대여·클래스를 2차 탭과 카테고리 화면에 연결한다.
2. 관리자 승인 API와 화면을 만들고, 승인된 사장님 계정으로 본인 가게의 게시글 등록을 검증한다.
3. 배포할 때 Vercel에도 동일한 공개용 환경변수를 설정하고 새 빌드를 실행한다.

## SQL 수동 적용 주의

DB 구조는 SQL Editor에서 수동으로 적용한다. 2026-10-04 구조를 새로 설계해 `database/supabase/migrations/20261004000100_schema.sql` 하나로 바꿨다. 적용 순서는 `database/README.md` 참고.
수동 실행은 CLI migration 이력 등록과 별개다. 이후 `db push`를 쓰려면 먼저 실제 스키마와 migration 이력을 대조해야 한다.
`database/tests/bootstrap.sql`은 운영 DB에 실행하지 않는다.
