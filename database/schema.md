# 표와 관계 (2026-10-04 설계)

팀 Draw.io 그림을 기준으로 이름을 붙였다. 모든 `id` 는 uuid(대표 유형만 앱 코드와 같은 글자 id).

```text
auth.users → profiles
               ├─ owner_applications          사장님 신청·승인 기록
               ├─ stores.owner_id             사장님 소유권
               ├─ store_favorites             가게 찜
               └─ user_stamps → stamp_transactions

store_types ← stores.type_id, store_menus.type_id
stores
  ├─ store_menus          메뉴 (메뉴마다 유형)
  ├─ store_hours          요일별 영업시간·휴무
  ├─ store_images         가게 사진 (여러 장)
  ├─ partner_benefits ─ benefit_partners ─ partners
  ├─ closing_sales        마감세일
  ├─ space_rentals ─ space_rental_images        (분류: space_rental_categories)
  ├─ one_day_classes ─ one_day_class_images     (분류: one_day_class_categories)
  └─ stamp_policies → user_stamps
```

## 가게

| 표 | 칸 | 그림 |
|---|---|---|
| store_types | id, name, group_name(restaurant·cafe·convenience·etc), sort_order | 대표 유형 |
| stores | id, owner_id, sbiz_id, sbiz_month, name, type_id, industry, address, lng, lat, floor, building_id, building_name, phone, is_published | 가게 |
| store_menus | id, store_id, name, price, type_id, sort_order | 메뉴 |
| store_hours | id, store_id, weekday(0=일~6=토), opens_at, closes_at, is_closed | 요일별 시간·휴무 |
| store_images | id, store_id, image_path, sort_order | 이미지 주소 |

- `industry` 는 상가정보 원본 업종명(예: 백반/한정식), `floor`·`building_*` 는 지도에서 같은 건물 가게를 묶고 층별 목록을 만드는 데 쓴다.
- 영업시간이 자정을 넘기면 `closes_at` 이 `opens_at` 보다 이르다. 휴무일은 `is_closed=true` 이고 시간은 비운다.

## 제휴

| 표 | 칸 | 그림 |
|---|---|---|
| partners | id, name | 제휴사 |
| partner_benefits | id, store_id, discount_amount, discount_rate, condition | 할인 금액·할인율·조건 |
| benefit_partners | id, benefit_id, partner_id | 제휴 연결 |

혜택 하나를 여러 제휴사(단과대학 등)에 걸 수 있다. 할인 금액과 할인율 중 하나 이상은 있어야 한다.

## 마감세일

| 칸 | 설명 |
|---|---|
| discount_type | `amount` 금액 할인 / `rate` 퍼센트 할인 / `free` 무료 제공 |
| discount_amount | amount 일 때만 (원) |
| discount_rate | rate 일 때만 (30% = 0.3) |
| condition, offer | 조건, 제공 내용 (free 일 때 offer 필수) |
| starts_at, ends_at | 시작·종료 시각 (종료가 시작보다 뒤) |

## 공간대여·원데이클래스

한 가게가 여러 개를 올릴 수 있다. 그림의 "게시글"은 글 안의 `body` 칸으로 합쳤고, 사진은 글마다 여러 장이다.

| 표 | 칸 |
|---|---|
| space_rentals | id, store_id, category_id, title, summary(간단 설명), body(게시글), available_hours(이용 가능 시간), price, capacity(인원), min_hours(최소 이용 시간), is_published |
| one_day_classes | id, store_id, category_id, title, summary, body, starts_at(수업 일시), duration_minutes(이용 시간), price, current_count(현재 인원), max_count(마감 인원), is_published |
| *_categories | id, name, sort_order (운영자가 넣는다) |
| *_images | id, 글 id, image_path, sort_order |

## 스탬프·로그인

스탬프(`stamp_policies`, `user_stamps`, `stamp_transactions`)와 로그인(`profiles`, `owner_applications`)은 이전 구조를 그대로 옮겼다.
스탬프는 로그인 단계에서 다시 다듬는다. 흐름은 `auth.md` 참고.

## 데이터 규칙

- 가격은 원 단위 정수, 할인율은 0 초과 1 이하.
- 시각은 `timestamptz` 로 저장하고 화면에서 한국 시간으로 표시.
- 가게를 지우면 딸린 메뉴·사진·글이 함께 지워진다. 운영 중인 가게는 지우지 말고 `is_published=false` 로 숨긴다.
- 거리·도보 시간은 사용자 위치로 계산하므로 저장하지 않는다.
