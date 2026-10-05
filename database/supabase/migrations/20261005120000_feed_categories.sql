-- =====================================================================
-- 공간대여·원데이클래스 분류 늘리기. 2026-10-05
--
-- 3개씩이던 분류를 6개씩으로 늘린다. 이미 있는 분류는 이름을 그대로 두고 순서만 맞춘다.
-- 화면의 분류 목록(frontend store-feed/types.ts FEED_CATEGORIES)과 이름·순서가 같아야 한다.
--   공간대여     모임·파티 / 스터디·회의 / 촬영·작업 / 연습·공연 / 공유주방 / 전시·팝업
--   원데이클래스 요리·베이킹 / 커피·음료 / 공예·미술 / 꽃·식물 / 향·캔들 / 운동·건강
-- =====================================================================
begin;

insert into public.space_rental_categories(name, sort_order) values
  ('모임·파티', 1), ('스터디·회의', 2), ('촬영·작업', 3), ('연습·공연', 4), ('공유주방', 5), ('전시·팝업', 6)
on conflict (name) do update set sort_order = excluded.sort_order;

insert into public.one_day_class_categories(name, sort_order) values
  ('요리·베이킹', 1), ('커피·음료', 2), ('공예·미술', 3), ('꽃·식물', 4), ('향·캔들', 5), ('운동·건강', 6)
on conflict (name) do update set sort_order = excluded.sort_order;

commit;
