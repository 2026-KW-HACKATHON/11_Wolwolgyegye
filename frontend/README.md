# 월월계계 프런트엔드

## 인증 환경변수

Vite 빌드에는 아래 공개용 값이 필요합니다. 로컬 개발에서는 `frontend/.env.local`, 운영 배포에서는 Vercel 프로젝트의 Production 환경변수에 설정합니다. `service_role` 또는 `sb_secret_` 키를 프런트엔드에 넣지 마세요.

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<public-key>
```

카카오 로그인은 별도로 카카오디벨로퍼스 REST API 키에 `https://<project-ref>.supabase.co/auth/v1/callback`을 리다이렉트 URI로 등록하고 카카오 로그인을 켜야 합니다. Supabase Authentication의 Kakao 제공자에는 해당 REST API 키와 Kakao Login Client Secret을 입력합니다. 이 프로젝트처럼 카카오 앱에서 이메일 동의 권한이 없는 경우 `Allow users without an email`을 켭니다.

Supabase URL Configuration의 Site URL은 운영 주소로, Redirect URLs에는 운영 주소의 `/login`을 등록합니다. 환경변수를 변경한 뒤에는 프런트엔드를 다시 빌드·배포해야 합니다.
