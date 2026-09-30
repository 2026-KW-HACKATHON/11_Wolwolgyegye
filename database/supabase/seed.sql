-- 로컬 개발 전용. 실제 가게/연락처/가격이 아닌 명시적인 예시다.
-- 로그인 사용자는 Auth로 가입한 후 profiles를 생성한다. 소유권은 관리자만 지정한다.
begin;
insert into public.stores(id, name, address, lat, lng, phone, business_hours, supported_features, is_published, is_demo)
values
  ('10000000-0000-4000-8000-000000000001', '[예시] 월계 모임공방', '서울특별시 노원구 월계1동 (개발용 예시)', 37.619, 127.058, '', '예시: 10:00~18:00', array['space-rental','oneday-class'], true, true),
  ('10000000-0000-4000-8000-000000000002', '[예시] 월계 카페', '서울특별시 노원구 월계1동 (개발용 예시)', 37.621, 127.059, '', '예시: 09:00~20:00', array['roulette','closing-sale','coupon','partner-stores'], true, true)
on conflict (id) do nothing;

insert into public.store_menus(id, store_id, name, price) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '[예시] 아메리카노', 3000)
on conflict (id) do nothing;

insert into public.feed_posts(id, store_id, kind, title, description, category, price, capacity, contact_phone, schedule, minimum_hours) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'space-rental',
   '[예시] 우리 동네 모임 공간', 'DB 연결을 확인하기 위한 예시 게시글입니다.', '스터디·회의', 10000, 6, '000-0000-0000', '평일 14:00~18:00', 2)
on conflict (id) do nothing;
insert into public.feed_posts(id, store_id, kind, title, description, category, price, capacity, contact_phone, starts_at, duration_minutes) values
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'oneday-class',
   '[예시] 도자기 만들기', '실제 모집 중인 수업이 아닌 개발용 예시입니다.', '공예·미술', 35000, 4, '000-0000-0000', now() + interval '7 days', 90)
on conflict (id) do nothing;

insert into public.closing_sales(id, store_id, description, discount_rate, close_at) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '[예시] 오늘의 디저트 할인', 0.3, now() + interval '1 day')
on conflict (id) do nothing;
insert into public.closing_sale_items(id, sale_id, store_id, name, original_price, discount_rate) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '[예시] 쿠키', 3000, 0.3)
on conflict (id) do nothing;
insert into public.stamp_policies(store_id, required_stamps, reward, unit, condition) values
  ('10000000-0000-4000-8000-000000000002', 10, '[예시] 아메리카노 1잔', '음료 1잔 구매', '실제 적립·사용 불가')
on conflict (store_id) do nothing;
insert into public.partner_benefits(store_id, college_key, benefit, condition) values
  ('10000000-0000-4000-8000-000000000002', 'ai', '[예시] 학생 할인 10%', '실제 제휴 아님')
on conflict (store_id, college_key) do nothing;
insert into public.roulette_store_links(id, store_id, menu_name, description, tag_label, emoji) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '커피', '개발용 가게 연결 예시', '커피', '☕')
on conflict (id) do nothing;
commit;
