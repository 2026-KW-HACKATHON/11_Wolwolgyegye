-- 최종 발표용 공개 게시글 2개.
-- 운영 DB의 기존 공간대여·원데이클래스 글을 각각 한 개씩 교체하며,
-- 사진은 프런트의 /public/demo-posts 정적 자산을 사용한다.
begin;

insert into public.stores (
  id, owner_id, is_mock, name, type_id, industry, address, lat, lng, phone, is_published
) values
  ('dddddddd-0000-4000-8000-000000000001', null, true, '월계빵', 'bakery', '빵·디저트', '[예시] 서울특별시 노원구 광운로', 37.62012, 127.05834, '', true),
  ('dddddddd-0000-4000-8000-000000000002', null, true, '월계카페', 'cafe', '카페', '[예시] 서울특별시 노원구 광운로', 37.62042, 127.05862, '', true)
on conflict (id) do update set
  owner_id = excluded.owner_id,
  is_mock = excluded.is_mock,
  name = excluded.name,
  type_id = excluded.type_id,
  industry = excluded.industry,
  address = excluded.address,
  lat = excluded.lat,
  lng = excluded.lng,
  phone = excluded.phone,
  is_published = excluded.is_published;

insert into public.space_rentals (
  id, store_id, category_id, title, summary, body, available_hours,
  price, capacity, min_hours, status, is_published, cancelled_at, cancel_reason, created_at
) values (
  '4b27be6e-4445-45c2-ab3b-255048162df1',
  'dddddddd-0000-4000-8000-000000000002',
  (select id from public.space_rental_categories where name = '모임·파티'),
  '월계카페 모임 공간 대여',
  '스터디·동아리·소모임을 위한 아늑한 카페 공간을 빌려드려요.',
  E'안녕하세요, 월계카페입니다. 영업이 한가한 시간에 카페 공간을 편안한 모임 장소로 빌려드려요.\n\n· 6~20명 모임에 추천해요.\n· 테이블은 모임 형태에 맞게 배치할 수 있어요.\n· 와이파이와 콘센트를 이용할 수 있어요.\n· 이용 시간과 음료 주문은 예약 전에 편하게 문의해 주세요.',
  '평일 18:00~22:00 · 주말 10:00~22:00 (사전 협의)',
  15000, 20, 2, 'open', true, null, '', now()
)
on conflict (id) do update set
  store_id = excluded.store_id,
  category_id = excluded.category_id,
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  available_hours = excluded.available_hours,
  price = excluded.price,
  capacity = excluded.capacity,
  min_hours = excluded.min_hours,
  status = excluded.status,
  is_published = excluded.is_published,
  cancelled_at = excluded.cancelled_at,
  cancel_reason = excluded.cancel_reason,
  created_at = excluded.created_at;

insert into public.space_rental_images (id, space_rental_id, image_path, sort_order)
values (
  'dddddddd-1000-4000-8000-000000000002',
  '4b27be6e-4445-45c2-ab3b-255048162df1',
  '/demo-posts/wolgye-cafe-space.png', 0
)
on conflict (id) do update set
  space_rental_id = excluded.space_rental_id,
  image_path = excluded.image_path,
  sort_order = excluded.sort_order;

insert into public.one_day_classes (
  id, store_id, category_id, title, summary, body, starts_at, duration_minutes,
  price, current_count, max_count, status, is_published, cancelled_at, cancel_reason, created_at
) values (
  '241d377b-f83b-4681-8dd6-8048b226c3a2',
  'dddddddd-0000-4000-8000-000000000001',
  (select id from public.one_day_class_categories where name = '요리·베이킹'),
  '고구마 초코빵 원데이 클래스',
  '달콤한 고구마 필링을 가득 채운 초코빵을 직접 만들어 봐요.',
  E'안녕하세요, 월계빵 사장입니다. 촉촉한 초코 반죽 안에 고구마와 견과류 필링을 듬뿍 채우는 원데이 클래스를 준비했어요.\n\n· 반죽부터 필링 만들기까지 함께 진행해요.\n· 재료비와 포장 상자가 포함돼요.\n· 완성한 빵 2개는 직접 가져가실 수 있어요.\n· 베이킹이 처음인 분도 편하게 참여할 수 있어요.',
  '2026-10-12 14:00:00+09', 120,
  28000, 0, 8, 'open', true, null, '', now()
)
on conflict (id) do update set
  store_id = excluded.store_id,
  category_id = excluded.category_id,
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  starts_at = excluded.starts_at,
  duration_minutes = excluded.duration_minutes,
  price = excluded.price,
  current_count = excluded.current_count,
  max_count = excluded.max_count,
  status = excluded.status,
  is_published = excluded.is_published,
  cancelled_at = excluded.cancelled_at,
  cancel_reason = excluded.cancel_reason,
  created_at = excluded.created_at;

insert into public.one_day_class_images (id, one_day_class_id, image_path, sort_order)
values (
  'dddddddd-1000-4000-8000-000000000001',
  '241d377b-f83b-4681-8dd6-8048b226c3a2',
  '/demo-posts/wolgye-bread-class.png', 0
)
on conflict (id) do update set
  one_day_class_id = excluded.one_day_class_id,
  image_path = excluded.image_path,
  sort_order = excluded.sort_order;

commit;
