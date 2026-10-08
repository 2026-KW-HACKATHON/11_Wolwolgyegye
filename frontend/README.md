# 월월계계 프런트엔드

## 인증 환경변수

Vite 빌드에는 아래 공개용 값이 필요합니다. 로컬 개발에서는 `frontend/.env.local`, 운영 배포에서는 Vercel 프로젝트의 Production 환경변수에 설정합니다. `service_role` 또는 `sb_secret_` 키를 프런트엔드에 넣지 마세요.

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<public-key>
```

카카오 로그인 설정은 [README/SupabaseConnection.md](../README/SupabaseConnection.md)의 "로그인 설정"을 따릅니다.

Supabase URL Configuration의 Site URL은 운영 주소로, Redirect URLs에는 운영 주소의 `/login`을 등록합니다. 환경변수를 변경한 뒤에는 프런트엔드를 다시 빌드·배포해야 합니다.

## 색상 테마

색은 [src/shared/theme.css](src/shared/theme.css) 한 곳에만 적습니다. 사용자는 유저 탭 아래 **설정 > 색상 테마**에서 팔레트 9개 중 하나를 고르고, 고른 값은 이 기기(localStorage)에 저장됩니다.

| 번호 | 이름 | 원색 |
|---|---|---|
| 1 | 네이비 오렌지 (기본) | `#000000` `#14213d` `#fca311` `#e5e5e5` `#ffffff` |
| 2 | 테라코타 틸 | `#f4f1de` `#e07a5f` `#3d405b` `#81b29a` `#f2cc8f` |
| 3 | 레드 블루 | `#780000` `#c1121f` `#fdf0d5` `#003049` `#669bbc` |
| 4 | 코랄 틸 | `#f6bd60` `#f7ede2` `#f5cac3` `#84a59d` `#f28482` |
| 5 | 인디고 팝 | `#540d6e` `#ee4266` `#ffd23f` `#3bceac` `#0ead69` |
| 6 | 미드나잇 네이비 | `#010736` `#0d1c42` `#22396f` `#fcf1d0` |
| 7 | 와인 샌드 | `#790d16` `#e5d3af` `#f5efe1` `#aec4d4` |
| 8 | 올리브 브라운 | `#6e3511` `#91ac67` `#597928` `#fcecd8` |
| 9 | 코랄 네이비 | `#f5ebdd` `#f2765e` `#315b8c` `#413333` |

| 층 | 예 | 쓰는 곳 |
|---|---|---|
| 1층 팔레트 (역할별) | `--primary-500` 주색, `--deep-900` 진한 색, `--base-50` 바탕, `--accent-400` 밝은 강조, `--strong-600` 진한 강조, `--support-600` 보조 | theme.css 의 `[data-palette='N']` 블록. 팔레트마다 값만 다름 |
| 2층 의미 토큰 | `--color-primary`, `--color-text-muted`, `--color-tag-coupon-bg` | 모든 화면 CSS |
| 지도 토큰 | `--building-fill`, `--place-cafe` | 지도 (MainMap.tsx 가 읽어서 Canvas 에 칠함. 팔레트가 바뀌면 지도를 다시 만듦) |

- 다른 CSS·TSX 에 `#hex`·`rgb()` 를 직접 쓰지 않습니다. 필요한 색이 없으면 theme.css 에 토큰을 추가합니다.
- 팔레트를 추가하려면 theme.css 에 `[data-palette='10']` 블록(1층 토큰 전부)을 넣고, [src/core/theme/palette.ts](src/core/theme/palette.ts) 의 `PALETTES` 에 이름을 더합니다. 단계 값은 본문 대비 4.5:1 을 검사해 계산했습니다.
- 반투명은 `color-mix(in srgb, var(--토큰) 30%, transparent)`, 그림자는 `rgb(var(--shadow-color) / 0.2)` 로 씁니다.
