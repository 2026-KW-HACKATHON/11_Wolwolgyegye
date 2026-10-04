-- =====================================================================
-- 예시(mock) 데이터 넣기. SQL Editor 에서 파일 전체를 실행한다. (2026-10-05)
--
-- - 예시 가게 14곳(이름 앞 [예시], stores.is_mock = true)과 거기에만 딸린 데이터를 넣는다.
--   실제 가게 851곳에는 아무것도 붙이지 않는다.
-- - 다시 실행하면 이전 예시 데이터를 지우고 새로 넣는다. (마감세일·수업 시각이 지금 기준으로 다시 맞춰진다)
-- - 전부 지우기: delete from public.stores where is_mock;
-- - 제휴사(광운대 단과대학)와 공간대여·원데이클래스 분류는 실제 기준 목록이라 예시가 아니다.
--   없으면 넣고, 있으면 그대로 둔다. 예시 데이터를 지워도 남는다.
-- - 사진(store_images 등)은 실제 파일이 없어서 넣지 않는다.
--
-- 들어가는 양: 가게 14 · 메뉴 40 · 영업시간 98 · 마감세일 12 · 제휴 혜택 12 · 공간대여 12 · 원데이클래스 12 · 스탬프 정책 10
-- =====================================================================
begin;

-- 1. 이전 예시 데이터 지우기 (딸린 데이터는 함께 지워진다)
delete from public.stores where is_mock;

-- 2. 실제 기준 목록 (없을 때만)
insert into public.partners(name) values
  ('전자정보공과대학'), ('인공지능융합대학'), ('공과대학'), ('자연과학대학'),
  ('인문사회과학대학'), ('정책법학대학'), ('경영대학'), ('참빛인재대학')
on conflict (name) do nothing;
insert into public.space_rental_categories(name, sort_order) values ('모임·파티', 1), ('스터디·회의', 2), ('촬영·작업', 3)
on conflict (name) do nothing;
insert into public.one_day_class_categories(name, sort_order) values ('요리·베이킹', 1), ('공예·미술', 2), ('커피·음료', 3)
on conflict (name) do nothing;

-- 3. 예시 가게 14곳 (id 는 eeeeeeee-… 로 고정해 아래에서 가리킨다. 좌표는 월계1동 광운로 주변)
insert into public.stores(id, is_mock, name, type_id, industry, address, lat, lng, phone) values
  ('eeeeeeee-0000-4000-8000-000000000001', true, '[예시] 월계 한식당',   'korean',            '백반/한정식',   '[예시] 서울특별시 노원구 광운로 1', 37.61905, 127.05812, '02-0000-0001'),
  ('eeeeeeee-0000-4000-8000-000000000002', true, '[예시] 광운 분식',     'snack',             '김밥/만두/분식', '[예시] 서울특별시 노원구 광운로 2', 37.61968, 127.05862, '02-0000-0002'),
  ('eeeeeeee-0000-4000-8000-000000000003', true, '[예시] 석계 짜장',     'chinese',           '중국집',        '[예시] 서울특별시 노원구 광운로 3', 37.62031, 127.05905, '02-0000-0003'),
  ('eeeeeeee-0000-4000-8000-000000000004', true, '[예시] 초안산 스시',   'japanese',          '일식 회/초밥',  '[예시] 서울특별시 노원구 광운로 4', 37.62094, 127.05948, '02-0000-0004'),
  ('eeeeeeee-0000-4000-8000-000000000005', true, '[예시] 동네 치킨',     'chicken',           '치킨',          '[예시] 서울특별시 노원구 광운로 5', 37.62157, 127.05991, '02-0000-0005'),
  ('eeeeeeee-0000-4000-8000-000000000006', true, '[예시] 파스타 키친',   'western',           '파스타/스테이크', '[예시] 서울특별시 노원구 광운로 6', 37.62220, 127.06034, '02-0000-0006'),
  ('eeeeeeee-0000-4000-8000-000000000007', true, '[예시] 골목 카페',     'cafe',              '카페',          '[예시] 서울특별시 노원구 광운로 7', 37.62283, 127.06077, '02-0000-0007'),
  ('eeeeeeee-0000-4000-8000-000000000008', true, '[예시] 아침 빵집',     'bakery',            '빵/도넛',       '[예시] 서울특별시 노원구 광운로 8', 37.61880, 127.05700, '02-0000-0008'),
  ('eeeeeeee-0000-4000-8000-000000000009', true, '[예시] 광운 편의점',   'convenience',       '편의점',        '[예시] 서울특별시 노원구 광운로 9', 37.61943, 127.05743, '02-0000-0009'),
  ('eeeeeeee-0000-4000-8000-000000000010', true, '[예시] 모임 스튜디오', 'etc-시설관리·임대', '공간 대여',     '[예시] 서울특별시 노원구 광운로 10', 37.62006, 127.05786, '02-0000-0010'),
  ('eeeeeeee-0000-4000-8000-000000000011', true, '[예시] 스터디 라운지', 'etc-시설관리·임대', '공간 대여',     '[예시] 서울특별시 노원구 광운로 11', 37.62069, 127.05829, '02-0000-0011'),
  ('eeeeeeee-0000-4000-8000-000000000012', true, '[예시] 공방 하루',     'etc-예술·스포츠',   '공예 공방',     '[예시] 서울특별시 노원구 광운로 12', 37.62132, 127.05872, '02-0000-0012'),
  ('eeeeeeee-0000-4000-8000-000000000013', true, '[예시] 쿠킹 스튜디오', 'etc-교육',          '요리 학원',     '[예시] 서울특별시 노원구 광운로 13', 37.62195, 127.05915, '02-0000-0013'),
  ('eeeeeeee-0000-4000-8000-000000000014', true, '[예시] 커피 랩',       'cafe',              '카페',          '[예시] 서울특별시 노원구 광운로 14', 37.62258, 127.05958, '02-0000-0014');

-- 4. 메뉴 40개 (음식·카페 가게)
insert into public.store_menus(store_id, name, price, type_id, sort_order)
select ('eeeeeeee-0000-4000-8000-0000000000' || s)::uuid, m.name, m.price, m.type_id, m.sort_order
from (values
  ('01', '[예시] 제육볶음 정식', 9000, 'korean', 1), ('01', '[예시] 된장찌개', 8000, 'korean', 2), ('01', '[예시] 김치찌개', 8000, 'korean', 3), ('01', '[예시] 고등어구이', 11000, 'korean', 4),
  ('02', '[예시] 참치김밥', 4500, 'snack', 1), ('02', '[예시] 떡볶이', 5000, 'snack', 2), ('02', '[예시] 라면', 4500, 'snack', 3), ('02', '[예시] 순대', 5000, 'snack', 4),
  ('03', '[예시] 짜장면', 7000, 'chinese', 1), ('03', '[예시] 짬뽕', 8500, 'chinese', 2), ('03', '[예시] 탕수육', 18000, 'chinese', 3), ('03', '[예시] 볶음밥', 8000, 'chinese', 4),
  ('04', '[예시] 모둠초밥', 15000, 'japanese', 1), ('04', '[예시] 연어덮밥', 13000, 'japanese', 2), ('04', '[예시] 우동', 8000, 'japanese', 3), ('04', '[예시] 돈카츠', 10000, 'japanese', 4),
  ('05', '[예시] 후라이드 치킨', 19000, 'chicken', 1), ('05', '[예시] 양념 치킨', 20000, 'chicken', 2), ('05', '[예시] 간장 치킨', 20000, 'chicken', 3), ('05', '[예시] 감자튀김', 4000, 'chicken', 4),
  ('06', '[예시] 토마토 파스타', 14000, 'western', 1), ('06', '[예시] 크림 파스타', 15000, 'western', 2), ('06', '[예시] 함박 스테이크', 16000, 'western', 3), ('06', '[예시] 리조또', 15000, 'western', 4),
  ('07', '[예시] 아메리카노', 3000, 'cafe', 1), ('07', '[예시] 카페라테', 3800, 'cafe', 2), ('07', '[예시] 레몬에이드', 4500, 'cafe', 3), ('07', '[예시] 치즈케이크', 5500, 'bakery', 4),
  ('08', '[예시] 소금빵', 3000, 'bakery', 1), ('08', '[예시] 크루아상', 3500, 'bakery', 2), ('08', '[예시] 식빵', 5000, 'bakery', 3), ('08', '[예시] 우유', 2000, 'cafe', 4),
  ('09', '[예시] 도시락', 4900, 'convenience', 1), ('09', '[예시] 삼각김밥', 1500, 'convenience', 2), ('09', '[예시] 컵라면', 1600, 'convenience', 3), ('09', '[예시] 생수', 1000, 'convenience', 4),
  ('14', '[예시] 핸드드립', 5000, 'cafe', 1), ('14', '[예시] 콜드브루', 4500, 'cafe', 2), ('14', '[예시] 플랫화이트', 4800, 'cafe', 3), ('14', '[예시] 쿠키', 2500, 'bakery', 4)
) as m(s, name, price, type_id, sort_order);

-- 5. 영업시간 98줄 (14곳 × 7일). 0=일요일. 짝수 번호 가게는 일요일 휴무
insert into public.store_hours(store_id, weekday, opens_at, closes_at, is_closed)
select s.id, d.weekday,
  case when d.weekday = 0 and s.n % 2 = 0 then null else '10:00'::time end,
  case when d.weekday = 0 and s.n % 2 = 0 then null when s.n in (3, 5) then '01:00'::time else '21:00'::time end,
  d.weekday = 0 and s.n % 2 = 0
from (select id, right(id::text, 2)::int as n from public.stores where is_mock) as s
cross join generate_series(0, 6) as d(weekday);

-- 6. 마감세일 12개: 금액 할인 4 · 퍼센트 할인 4 · 무료 제공 4
insert into public.closing_sales(store_id, discount_type, discount_amount, discount_rate, condition, offer, starts_at, ends_at)
select ('eeeeeeee-0000-4000-8000-0000000000' || c.s)::uuid, c.t, c.amount, c.rate, c.cond, c.offer,
  now() - interval '1 hour', now() + make_interval(hours => c.h)
from (values
  ('01', 'amount', 2000, null::numeric, '[예시] 오후 8시 이후 포장', '[예시] 반찬 세트', 3),
  ('02', 'amount', 1000, null, '[예시] 김밥 2줄 이상', '', 2),
  ('05', 'amount', 3000, null, '[예시] 포장 주문', '[예시] 후라이드 치킨', 4),
  ('06', 'amount', 2500, null, '[예시] 오후 9시 이후', '[예시] 파스타 전 메뉴', 2),
  ('03', 'rate', null, 0.2, '[예시] 오후 9시 이후 방문', '', 3),
  ('04', 'rate', null, 0.3, '[예시] 마감 1시간 전', '[예시] 초밥 세트', 1),
  ('07', 'rate', null, 0.5, '[예시] 당일 케이크', '[예시] 치즈케이크', 2),
  ('08', 'rate', null, 0.4, '[예시] 오후 7시 이후', '[예시] 당일 구운 빵 전체', 5),
  ('08', 'free', null, null, '[예시] 빵 3개 구매 시', '[예시] 소금빵 1개 무료', 4),
  ('09', 'free', null, null, '[예시] 도시락 구매 시', '[예시] 생수 1병 무료', 6),
  ('14', 'free', null, null, '[예시] 원두 구매 시', '[예시] 아메리카노 1잔 무료', 3),
  ('02', 'free', null, null, '[예시] 떡볶이 2인분 이상', '[예시] 튀김 1개 무료', 2)
) as c(s, t, amount, rate, cond, offer, h);

-- 7. 제휴 혜택 12개 + 단과대학 연결
with b(s, amount, rate, cond, colleges) as (values
  ('01', null::int, 0.1, '[예시] 학생증 제시', array['경영대학', '공과대학']),
  ('02', 500, null::numeric, '[예시] 학생증 제시', array['전자정보공과대학']),
  ('03', null, 0.1, '[예시] 학생증 제시, 2인 이상', array['인문사회과학대학', '정책법학대학']),
  ('04', 1000, null, '[예시] 점심시간', array['인공지능융합대학']),
  ('05', 2000, null, '[예시] 학생증 제시', array['자연과학대학', '공과대학', '경영대학']),
  ('06', null, 0.15, '[예시] 평일 저녁', array['참빛인재대학']),
  ('07', 500, null, '[예시] 음료 1잔 이상', array['전자정보공과대학', '인공지능융합대학']),
  ('08', null, 0.1, '[예시] 1만원 이상 구매', array['인문사회과학대학']),
  ('09', 300, null, '[예시] 도시락 구매', array['정책법학대학']),
  ('10', null, 0.2, '[예시] 동아리 단체 예약', array['경영대학', '자연과학대학']),
  ('11', 2000, null, '[예시] 시험 기간', array['공과대학', '전자정보공과대학', '인공지능융합대학']),
  ('14', null, 0.1, '[예시] 학생증 제시', array['참빛인재대학', '경영대학'])
), inserted as (
  insert into public.partner_benefits(store_id, discount_amount, discount_rate, condition)
  select ('eeeeeeee-0000-4000-8000-0000000000' || s)::uuid, amount, rate, cond from b
  returning id, store_id
)
insert into public.benefit_partners(benefit_id, partner_id)
select i.id, p.id
from inserted i
join b on ('eeeeeeee-0000-4000-8000-0000000000' || b.s)::uuid = i.store_id
join public.partners p on p.name = any(b.colleges);

-- 8. 공간대여 12개
insert into public.space_rentals(store_id, category_id, title, summary, body, available_hours, price, capacity, min_hours)
select ('eeeeeeee-0000-4000-8000-0000000000' || r.s)::uuid, c.id, r.title, r.summary, r.body, r.hours, r.price, r.capacity, r.min_hours
from (values
  ('10', '모임·파티', '[예시] 생일파티 룸', '[예시] 풍선·조명 있는 파티룸', '[예시] 최대 12명까지 이용할 수 있는 파티룸입니다.', '[예시] 매일 10:00~22:00', 20000, 12, 2),
  ('10', '모임·파티', '[예시] 소모임 공간', '[예시] 보드게임 구비', '[예시] 동아리 뒤풀이, 소모임에 알맞은 공간입니다.', '[예시] 평일 14:00~22:00', 15000, 8, 2),
  ('10', '촬영·작업', '[예시] 촬영 스튜디오', '[예시] 흰 배경·조명 2개', '[예시] 프로필·제품 촬영용 스튜디오입니다.', '[예시] 매일 09:00~21:00', 25000, 4, 1),
  ('10', '촬영·작업', '[예시] 작업실 대여', '[예시] 넓은 책상·전원', '[예시] 조용히 작업할 수 있는 작업실입니다.', '[예시] 매일 08:00~23:00', 8000, 3, 2),
  ('11', '스터디·회의', '[예시] 4인 스터디룸', '[예시] 화이트보드·모니터', '[예시] 조별 과제에 알맞은 4인실입니다.', '[예시] 24시간', 6000, 4, 1),
  ('11', '스터디·회의', '[예시] 6인 회의실', '[예시] 빔프로젝터', '[예시] 발표 연습이 가능한 회의실입니다.', '[예시] 24시간', 9000, 6, 1),
  ('11', '스터디·회의', '[예시] 1인 집중석', '[예시] 칸막이 좌석', '[예시] 혼자 공부하기 좋은 좌석입니다.', '[예시] 24시간', 2000, 1, 2),
  ('11', '모임·파티', '[예시] 세미나실', '[예시] 20석 강의 배치', '[예시] 동아리 세미나·설명회용 공간입니다.', '[예시] 평일 09:00~21:00', 30000, 20, 2),
  ('07', '모임·파티', '[예시] 카페 단체석', '[예시] 음료 주문 시 이용', '[예시] 카페 안쪽 단체석을 빌려드립니다.', '[예시] 평일 13:00~17:00', 10000, 10, 2),
  ('07', '스터디·회의', '[예시] 카페 회의 테이블', '[예시] 콘센트 좌석', '[예시] 4인 회의 테이블입니다.', '[예시] 매일 10:00~20:00', 5000, 4, 1),
  ('06', '모임·파티', '[예시] 레스토랑 대관', '[예시] 저녁 전체 대관', '[예시] 생일·회식용 레스토랑 대관입니다.', '[예시] 월요일 18:00~22:00', 50000, 25, 3),
  ('12', '촬영·작업', '[예시] 공방 작업대', '[예시] 공구 사용 가능', '[예시] 공방 작업대를 시간 단위로 빌려드립니다.', '[예시] 주말 10:00~18:00', 12000, 2, 2)
) as r(s, category, title, summary, body, hours, price, capacity, min_hours)
join public.space_rental_categories c on c.name = r.category;

-- 9. 원데이클래스 12개 (내일부터 하루씩 뒤 오후 2시~)
insert into public.one_day_classes(store_id, category_id, title, summary, body, starts_at, duration_minutes, price, current_count, max_count)
select ('eeeeeeee-0000-4000-8000-0000000000' || k.s)::uuid, c.id, k.title, k.summary, k.body,
  date_trunc('day', now()) + make_interval(days => k.d, hours => 14), k.minutes, k.price, k.cur, k.max
from (values
  ('13', '요리·베이킹', '[예시] 김치찌개 클래스', '[예시] 자취생 요리', '[예시] 기본 찌개 끓이는 법을 배워요.', 1, 90, 30000, 3, 8),
  ('13', '요리·베이킹', '[예시] 파스타 클래스', '[예시] 크림·토마토 두 가지', '[예시] 소스부터 직접 만들어요.', 2, 120, 40000, 5, 8),
  ('13', '요리·베이킹', '[예시] 도시락 만들기', '[예시] 일주일 도시락', '[예시] 미리 만들어 두는 반찬을 배워요.', 3, 120, 35000, 8, 8),
  ('08', '요리·베이킹', '[예시] 소금빵 굽기', '[예시] 반죽부터 굽기까지', '[예시] 직접 구운 빵을 가져가요.', 4, 150, 45000, 2, 6),
  ('08', '요리·베이킹', '[예시] 쿠키 클래스', '[예시] 아이와 함께', '[예시] 쉬운 쿠키를 함께 구워요.', 5, 90, 25000, 4, 10),
  ('12', '공예·미술', '[예시] 가죽 지갑 만들기', '[예시] 이름 각인 포함', '[예시] 카드 지갑을 직접 만들어요.', 1, 120, 50000, 2, 6),
  ('12', '공예·미술', '[예시] 도자기 컵', '[예시] 물레 체험', '[예시] 구워서 2주 뒤 받아요.', 2, 120, 55000, 6, 6),
  ('12', '공예·미술', '[예시] 캔들 만들기', '[예시] 향 고르기', '[예시] 향초 두 개를 만들어요.', 6, 60, 30000, 1, 8),
  ('12', '공예·미술', '[예시] 수채화 엽서', '[예시] 초보 환영', '[예시] 엽서 3장을 그려요.', 7, 90, 25000, 0, 10),
  ('14', '커피·음료', '[예시] 핸드드립 입문', '[예시] 원두 고르기', '[예시] 드립 기본 자세를 배워요.', 3, 90, 30000, 4, 6),
  ('14', '커피·음료', '[예시] 라테아트', '[예시] 하트 그리기', '[예시] 우유 스티밍부터 연습해요.', 5, 120, 40000, 3, 4),
  ('07', '커피·음료', '[예시] 홈카페 음료', '[예시] 에이드·스무디', '[예시] 집에서 만드는 음료 3가지.', 4, 60, 20000, 7, 10)
) as k(s, category, title, summary, body, d, minutes, price, cur, max)
join public.one_day_class_categories c on c.name = k.category;

-- 10. 스탬프 정책 10개
insert into public.stamp_policies(store_id, required_stamps, reward, unit, condition)
select ('eeeeeeee-0000-4000-8000-0000000000' || p.s)::uuid, p.req, p.reward, p.unit, p.cond
from (values
  ('01', 10, '[예시] 정식 1인분', '[예시] 식사 1회', '[예시] 1만원 이상'),
  ('02', 8, '[예시] 떡볶이 1인분', '[예시] 방문 1회', ''),
  ('03', 10, '[예시] 탕수육 소', '[예시] 주문 1회', '[예시] 배달 제외'),
  ('04', 10, '[예시] 우동 1그릇', '[예시] 식사 1회', ''),
  ('05', 10, '[예시] 치킨 1마리', '[예시] 주문 1회', '[예시] 포장 포함'),
  ('06', 8, '[예시] 파스타 1접시', '[예시] 식사 1회', ''),
  ('07', 10, '[예시] 아메리카노 1잔', '[예시] 음료 1잔', ''),
  ('08', 12, '[예시] 식빵 1개', '[예시] 5천원 구매', ''),
  ('09', 15, '[예시] 도시락 1개', '[예시] 5천원 구매', ''),
  ('14', 10, '[예시] 핸드드립 1잔', '[예시] 음료 1잔', '')
) as p(s, req, reward, unit, cond);

commit;

-- 확인: 각 숫자가 위 "들어가는 양"과 같으면 성공
select
  (select count(*) from public.stores where is_mock) as stores,
  (select count(*) from public.store_menus m join public.stores s on s.id = m.store_id where s.is_mock) as menus,
  (select count(*) from public.store_hours h join public.stores s on s.id = h.store_id where s.is_mock) as hours,
  (select count(*) from public.closing_sales c join public.stores s on s.id = c.store_id where s.is_mock) as closing_sales,
  (select count(*) from public.partner_benefits b join public.stores s on s.id = b.store_id where s.is_mock) as benefits,
  (select count(*) from public.space_rentals r join public.stores s on s.id = r.store_id where s.is_mock) as space_rentals,
  (select count(*) from public.one_day_classes k join public.stores s on s.id = k.store_id where s.is_mock) as classes,
  (select count(*) from public.stamp_policies p join public.stores s on s.id = p.store_id where s.is_mock) as stamps;
