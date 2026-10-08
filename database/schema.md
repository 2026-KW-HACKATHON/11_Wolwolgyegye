# DB 표 구조

가지(├─)가 이어진 표는 위쪽 표에 **딸린** 표입니다. 위쪽 행을 지우면 딸린 행도 함께 지워집니다.
`→` 는 다른 표를 가리키는 칸입니다.

```text
auth.users                         로그인 계정 (Supabase 가 관리)
└─ profiles                        사용자 프로필
   ├─ user_id                      계정 번호
   ├─ display_name                 표시 이름
   ├─ college_id → partners        내 단과대 (사용자가 직접 등록. 비어 있으면 미등록)
   ├─ owner_applications           사장님 신청서
   │  ├─ applicant_name            신청자 이름
   │  ├─ contact_phone             연락처
   │  ├─ store_name                가게 이름
   │  ├─ store_address             가게 주소
   │  ├─ requested_store_id → stores  신청한 기존 가게 (가게 이름·주소는 여기서 복사)
   │  ├─ business_registration_number  사업자등록번호 (숫자 10자리)
   │  ├─ status                    상태 (대기 / 승인 / 반려)
   │  ├─ approved_store_id → stores  승인된 가게
   │  ├─ review_note               처리 메모
   │  └─ reviewed_at               처리 시각
   ├─ store_favorites              가게 찜 (사용자 + 가게)
   ├─ sale_likes                   마감세일 관심 (사용자 + 세일 → closing_sales)
   └─ post_favorites               공간대여·클래스 글 찜 (사용자 + 글 번호. 글 표를 가리키는 연결은 없음)

private.admin_users                운영 관리자 (일반 사용자는 볼 수 없는 표)
└─ user_id → auth.users            관리자 계정

store_types                        대표 유형 (= 지도 위쪽 "그 외 카테고리": 한식·카페·편의점 …)
├─ id                              유형 코드 (예: korean)
├─ name                            유형 이름 (예: 한식)
└─ group_name                      묶음 (음식점 / 카페 / 편의점 / 그 외)

stores                             가게
├─ id                              가게 번호
├─ owner_id → profiles             사장님 (없으면 비어 있음)
├─ sbiz_id                         상가정보 업소번호 (공공데이터 가게만)
├─ sbiz_month                      상가정보 기준월 (예: 202606)
├─ name                            가게 이름
├─ type_id → store_types           대표 유형
├─ industry                        원본 업종 (예: 백반/한정식)
├─ address                         주소
├─ lat / lng                       위도 / 경도
├─ floor                           층 (지하는 음수)
├─ building_id / building_name     건물관리번호 / 건물 이름 (지도에서 같은 건물 묶기)
├─ phone                           전화번호
├─ is_published                    공개 여부
├─ is_mock                         예시 가게 여부
│
├─ store_menus                     메뉴
│  ├─ name                         메뉴 이름
│  ├─ price                        가격 (원)
│  ├─ type_id → store_types        메뉴 유형
│  ├─ section                      메뉴판 구역 제목 (가게마다 다름. 예: 면류, COFFEE)
│  ├─ kind                         공통 분류 (식사 / 세트 / 사이드 / 추가·토핑 / 음료 / 주류 / 디저트)
│  ├─ description                  옵션·비고 (예: HOT, ICE 변경가능)
│  ├─ board_date                   메뉴판 등록일
│  ├─ board_image                  메뉴판 사진 파일 이름
│  ├─ review_status                엑셀 검수 상태 (confirmed / needs_review)
│  ├─ data_source                  메뉴를 가져온 원본 자료
│  └─ sort_order                   보여줄 순서
├─ store_hours                     영업시간 (요일마다 한 줄)
│  ├─ weekday                      요일 (0=일 … 6=토)
│  ├─ opens_at / closes_at         여는 / 닫는 시각
│  └─ is_closed                    휴무
├─ store_images                    가게 사진
│  ├─ image_path                   사진 저장 위치
│  └─ sort_order                   순서
├─ closing_sales                   마감세일
│  ├─ discount_type                할인 유형 (amount 금액 / rate 퍼센트 / free 무료 제공)
│  ├─ discount_amount              할인 금액 (원)
│  ├─ discount_rate                할인율 (0.3 = 30%)
│  ├─ condition                    조건
│  ├─ offer                        제공 내용
│  └─ starts_at / ends_at          시작 / 끝 시각
├─ partner_benefits                제휴 혜택
│  ├─ discount_amount              할인 금액 (원)
│  ├─ discount_rate                할인율
│  ├─ offer                        실제 할인·증정 혜택 원문
│  ├─ condition                    조건
│  ├─ data_source / source_ref     원본 자료 / 원본 행 식별자
│  └─ benefit_partners             혜택 ↔ 제휴사 연결
│     └─ partner_id → partners     제휴사
├─ store_partners                  단과대 제휴 가게 연결
│  └─ partner_id → partners        제휴 단과대학
├─ space_rentals                   공간대여 글
│  ├─ category_id → space_rental_categories  분류
│  ├─ title / summary / body       제목 / 간단 설명 / 본문
│  ├─ available_hours              이용 가능 시간
│  ├─ price                        시간당 가격
│  ├─ capacity                     최대 인원
│  ├─ min_hours                    최소 이용 시간 (비어 있을 수 있음)
│  ├─ status                       모집 상태 (open 모집 중 / closed 마감)
│  ├─ is_published                 공개 여부
│  └─ space_rental_images          글 사진
├─ one_day_classes                 원데이클래스 글
│  ├─ category_id → one_day_class_categories  분류
│  ├─ title / summary / body       제목 / 간단 설명 / 본문
│  ├─ starts_at                    수업 일시
│  ├─ duration_minutes             수업 시간 (분)
│  ├─ price                        1인 가격
│  ├─ current_count / max_count    현재 인원 / 마감 인원
│  ├─ status                       모집 상태 (open 모집 중 / closed 마감)
│  ├─ is_published                 공개 여부
│  └─ one_day_class_images         글 사진
└─ stamp_policies                  스탬프 규칙 (가게당 하나)
   ├─ required_stamps              모아야 하는 개수
   ├─ reward                       받는 선물
   ├─ unit                         1개가 찍히는 기준
   ├─ condition                    조건
   ├─ user_stamps                  사용자별 스탬프 수 (사용자 + 가게)
   │  └─ stamp_transactions        적립·사용 기록 (서버에서만 기록)
   └─ stamp_codes                  6자리 적립 코드 (사용자 + 가게당 하나, 3분·1회용, 서버 함수로만 발급·사용)

partners                           제휴사 (광운대 단과대학 8곳)
└─ name                            제휴사 이름

space_rental_categories            공간대여 분류 (모임·파티 / 스터디·회의 / 촬영·작업 / 연습·공연 / 공유주방 / 전시·팝업)
one_day_class_categories           원데이클래스 분류 (요리·베이킹 / 커피·음료 / 공예·미술 / 꽃·식물 / 향·캔들 / 운동·건강)
```

모든 표에는 `id`(번호)와 만든 시각 같은 기본 칸도 있습니다. 위 그림에서는 뺐습니다.

## 사장님이 앱에서 직접 고치는 칸

내 가게(`stores.owner_id` = 나)에 한해서만 바뀝니다.

| 표 | 고칠 수 있는 것 | 화면 |
|---|---|---|
| stores | 가게 이름 · 대표 유형 · 업종 설명 · 전화번호 | 사장님 > 가게 정보 |
| store_hours | 요일별 여는·닫는 시각, 휴무 | 사장님 > 가게 정보 |
| store_menus | 메뉴 추가·수정·삭제 (이름 · 가격 · 메뉴판 구역 · 공통 분류 · 설명) | 사장님 > 가게 정보 |
| closing_sales | 마감세일 등록 · 지금 종료 · 삭제 | 사장님 > 마감세일 |
| space_rentals / one_day_classes | 글 쓰기 · 수정 · 삭제 | 공간대여 · 원데이클래스 글쓰기 |
