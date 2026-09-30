# 테이블과 프론트 연결

## 핵심 관계

```text
auth.users → profiles
                ├─ owner_applications (사장님 신청·승인 기록)
                ├─ stores.owner_id (사장님 소유권)
                ├─ store_favorites / post_favorites / sale_likes
                └─ user_stamps → stamp_transactions

stores
  ├─ store_menus
  ├─ feed_posts                  공간대여 + 원데이클래스
  ├─ closing_sales → closing_sale_items
  ├─ partner_benefits
  ├─ roulette_store_links
  └─ stamp_policies → user_stamps
```

## 테이블 15개

| 테이블 | 저장하는 내용 |
|---|---|
| profiles | Auth 사용자 ID와 표시 이름. 비밀번호는 저장하지 않음 |
| owner_applications | 사장님 신청자·연락처·가게 정보·심사 상태·승인된 가게 ID. 본인과 서버만 조회 |
| stores | 가게명·주소·좌표·연락처·운영 시간·사장님·공개 여부 |
| store_menus | 가게 메뉴·원화 가격·사진 경로·판매 여부 |
| feed_posts | 사장님 공간대여/클래스 게시글·가격·인원·일정·전화번호 |
| store_favorites | 사용자별 가게 찜 |
| post_favorites | 사용자별 게시글 찜 |
| closing_sales | 가게별 마감세일 설명·할인율·종료 시간 |
| closing_sale_items | 마감세일 상품·정가·할인율 |
| sale_likes | 사용자별 마감세일 관심 표시 |
| partner_benefits | 가게와 단과대학별 제휴 혜택·이용 조건 |
| roulette_store_links | 룰렛 메뉴에 연결할 가게·표시 문구 |
| stamp_policies | 가게별 필요 스탬프 수·보상·적립 조건 |
| user_stamps | 사용자와 가게별 현재 스탬프 잔액 |
| stamp_transactions | 적립/차감 이력·처리 후 잔액·중복 방지 요청 ID |

## 공간대여와 클래스

공통 내용은 `feed_posts` 하나에 저장하고 `kind`로 구분한다.

| 종류 | 필수 전용 필드 | 다른 종류의 필드 |
|---|---|---|
| space-rental | schedule, minimum_hours | starts_at, duration_minutes는 NULL |
| oneday-class | starts_at, duration_minutes | schedule, minimum_hours는 NULL |

`status`는 모집 상태(open/closed), `is_published`는 게시 여부다. 공개 글도 부모 가게가 비공개면 일반 사용자에게 보이지 않는다.
한 글당 대표 사진 한 장이며, 추가 사진이 필요해질 때 별도 테이블을 추가한다.

## 프론트와 다른 부분

화면을 버리고 다시 만드는 것이 아니라 **데이터 공급/변환 계층을 교체**한다. 이번 작업은 DB 초안만 추가하며 프론트는 변경하지 않는다.

- `frontend/src/core/source/storeSource.ts`: 가게 데이터 조회 연결 지점.
- `frontend/src/features/store-feed/feedSource.ts`: 게시글 조회·저장 연결 지점. 같은 파일의 가게 검색/목록도 mock 의존성을 함께 바꿔야 한다.
- `feed_posts.store_id` → `storeId`처럼 snake_case를 기존 camelCase 타입으로 변환.
- `stores.lat/lng` → `location: { lat, lng }`.
- `supported_features` 배열 → 현재 `supports` 객체.
- 사진 경로 → `store-media` 공개 URL → `imageUrl/thumbnailUrl`.
- `feed_posts`의 서버 UUID와 기존 mock 문자열 ID는 다르므로 하드코딩된 가게 ID도 함께 제거.
- 현재 게시글 `origin: sample | local` 타입은 서버 출처를 표현하도록 확장. localStorage 데이터가 자동 이전되는 것은 아님.
- 현재 닉네임 기반 로그인은 DB 인증이 아니다. Supabase Auth 계정 생성 시 프로필이 자동 생성되며, 이메일 인증과 사장님 승인 뒤 본인 가게 글 쓰기가 가능. 자세한 연결은 `auth.md` 참고.
- `distance/walkMinutes`는 사용자 위치로 계산하므로 테이블에 저장하지 않음.
- `rating/reviewCount`는 실제 리뷰 기능 도입 전 비워 두고 mock 수치를 실제 값처럼 표시하지 않음.
- 마감세일 관심 수는 `get_sale_like_counts(uuid[])` RPC로 조회. 개인 사용자 ID 목록은 공개하지 않음.
- 제휴 혜택의 행들을 기존 단과대학별 화면 객체로 묶어 전달.
- 룰렛의 개인 사용자 설정은 계속 로컬에 둘 수 있음.

## 데이터 규칙과 확장 경계

- 가격은 원 단위 정수, 할인율은 0 초과 1 이하(30% = 0.3).
- 시각은 `timestamptz`로 저장하고 화면에서 한국 시간으로 표시.
- 가게/게시글 찜과 세일 관심은 복합 기본키로 중복 방지.
- 글·혜택 등의 삭제는 부모 가게 삭제 시 연쇄 삭제된다. 운영 가게는 이력 보존을 위해 삭제보다 비공개 처리를 우선한다.
- 스탬프 정책 변경 시 기존 고객 안내/보상 규칙은 서비스 운영 정책으로 정해야 한다.
- 가게 소유자는 현재 한 명이다. 여러 직원 계정 지원 시 가게 멤버 테이블을 추가한다.
- 일반 가게 홍보 전용 글 종류는 이번에 추가하지 않았다. 현재 구현된 공간대여/클래스와 분리해 요구사항 확정 후 확장한다.
