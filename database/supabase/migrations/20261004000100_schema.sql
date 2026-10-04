-- =====================================================================
-- 월월계계 DB 전체 구조 (2026-10-04 새로 설계)
--
-- 이 파일은 표의 "형태"만 만든다. 가게·메뉴·게시글 같은 데이터는 넣지 않는다.
--   - 가게 851곳: frontend 의 npm run import:stores 가 상가정보를 DB 에 넣는다.
--   - 대표 유형(store_types): 같은 스크립트가 앱의 그 외 카테고리 목록으로 채운다.
--   - 분류·제휴사: 운영자가 SQL Editor 에서 넣는다.
--
-- 묶음
--   1. 공통 함수
--   2. 사용자: profiles, owner_applications (로그인·사장님 신청. 이전 구조와 같은 이름·칸)
--   3. 가게: store_types, stores, store_menus, store_hours, store_images, store_favorites
--   4. 제휴: partners, partner_benefits, benefit_partners
--   5. 마감세일: closing_sales
--   6. 공간대여: space_rental_categories, space_rentals, space_rental_images
--   7. 원데이클래스: one_day_class_categories, one_day_classes, one_day_class_images
--   8. 스탬프: stamp_policies, user_stamps, stamp_transactions (이전 구조 유지)
--   9. 사진 저장소(store-media) 권한
--
-- 권한(RLS) 기본 규칙
--   - 누구나: 공개된 가게(stores.is_published)에 딸린 정보만 읽는다.
--   - 사장님: 자기 가게(stores.owner_id = 본인)의 정보만 쓴다.
--   - 운영자(service_role, SQL Editor): 가게 등록·공개, 소유권 연결, 제휴, 분류.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. 공통 함수
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
-- 정책 안의 검사 함수를 비로그인(anon) 조회에서도 쓰므로 anon 에도 사용 권한을 준다.
grant usage on schema private to anon, authenticated, service_role;

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public;

-- ---------------------------------------------------------------------
-- 2. 사용자
-- ---------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (user_id, display_name), update (display_name) on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy profiles_self_read on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_self_insert on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger profiles_updated before update on public.profiles for each row execute function private.touch_updated_at();

-- 소셜/이메일 가입 모두 공통 프로필 생성. user_metadata 는 표시 이름에만 사용한다.
create function private.create_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      '월계 주민'
    ), 40)
  ) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_auth_profile() from public, anon, authenticated;
create trigger wolwolgyegye_auth_profile_created after insert on auth.users
for each row execute function private.create_auth_profile();

-- 이미 가입한 계정의 프로필을 채운다 (표를 새로 만들었으므로 전부 다시 생긴다).
insert into public.profiles(user_id, display_name)
select id, left(coalesce(
  nullif(btrim(raw_user_meta_data ->> 'display_name'), ''),
  nullif(btrim(raw_user_meta_data ->> 'full_name'), ''),
  nullif(btrim(raw_user_meta_data ->> 'name'), ''),
  '월계 주민'
), 40) from auth.users
on conflict (user_id) do nothing;

-- 확인된 이메일 + 이메일 로그인 identity 필요. 클라이언트 metadata 는 신뢰하지 않는다.
create function private.has_verified_email_login(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.email_confirmed_at is not null
      and exists (
        select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
      )
  );
$$;
revoke all on function private.has_verified_email_login(uuid) from public, anon, authenticated;
grant execute on function private.has_verified_email_login(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. 가게
-- ---------------------------------------------------------------------

-- 대표 유형 = 앱의 "그 외 카테고리" (한식, 중식, 카페, 편의점 ...). id 는 앱 코드의 id 와 같다.
create table public.store_types (
  id text primary key check (char_length(btrim(id)) between 1 and 40),
  name text not null check (char_length(btrim(name)) between 1 and 30),
  group_name text not null check (group_name in ('restaurant', 'cafe', 'convenience', 'etc')),
  sort_order integer not null default 0
);
alter table public.store_types enable row level security;
revoke all on public.store_types from anon, authenticated;
grant select on public.store_types to anon, authenticated;
grant all on public.store_types to service_role;
create policy store_types_read on public.store_types for select to anon, authenticated using (true);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(user_id) on delete set null,
  -- 소상공인 상가정보 업소번호. 사장님이 직접 등록한 가게는 비어 있다.
  sbiz_id text unique,
  -- 상가정보 기준월 (예: 202606). 지도 아래 출처 표시에 쓴다.
  sbiz_month text check (sbiz_month ~ '^[0-9]{6}$'),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  type_id text references public.store_types(id) on update cascade on delete set null,
  -- 원본 업종명 (예: 백반/한정식). 화면 표시용
  industry text not null default '' check (char_length(industry) <= 100),
  address text not null check (char_length(btrim(address)) between 1 and 300),
  lng double precision not null check (lng between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  -- 층 (지하는 음수, 모르면 비움)
  floor smallint check (floor between -10 and 200 and floor <> 0),
  -- 건물관리번호·건물명 (같은 건물 가게를 지도에서 한 핀으로 묶는다)
  building_id text not null default '' check (char_length(building_id) <= 40),
  building_name text not null default '' check (char_length(building_name) <= 100),
  phone text not null default '' check (char_length(phone) <= 30),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_owner_idx on public.stores(owner_id);
create index stores_type_idx on public.stores(type_id);
alter table public.stores enable row level security;
revoke all on public.stores from anon, authenticated;
grant select on public.stores to anon, authenticated;
grant update (name, type_id, industry, phone) on public.stores to authenticated;
grant all on public.stores to service_role;
create policy stores_read on public.stores for select to anon, authenticated using (is_published or owner_id = (select auth.uid()));
create policy stores_owner_update on public.stores for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create trigger stores_updated before update on public.stores for each row execute function private.touch_updated_at();

-- RLS 안에서만 쓰는 검사 함수. 공개 API 에 노출하지 않는다.
create function private.owns_store(p_store_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.stores
    where id = p_store_id and owner_id = (select auth.uid())
  );
$$;
create function private.store_is_public(p_store_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.stores where id = p_store_id and is_published);
$$;
revoke all on function private.owns_store(uuid), private.store_is_public(uuid) from public;
grant execute on function private.owns_store(uuid), private.store_is_public(uuid) to anon, authenticated, service_role;

create table public.store_menus (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  price integer not null check (price between 0 and 10000000),
  -- 메뉴 유형 (한 가게에 한식·카페 메뉴가 같이 있을 수 있다)
  type_id text references public.store_types(id) on update cascade on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index store_menus_store_idx on public.store_menus(store_id);
create trigger store_menus_updated before update on public.store_menus for each row execute function private.touch_updated_at();

-- 요일별 영업시간. 한 가게에 요일마다 한 줄. 자정을 넘기면 closes_at 이 opens_at 보다 이르다.
create table public.store_hours (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0=일 ... 6=토
  opens_at time,
  closes_at time,
  is_closed boolean not null default false, -- 휴무
  unique (store_id, weekday),
  check (is_closed or (opens_at is not null and closes_at is not null and opens_at <> closes_at))
);

create table public.store_images (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  -- store-media 저장소 안의 경로: <store_id>/<파일>
  image_path text not null check (char_length(image_path) between 1 and 300),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index store_images_store_idx on public.store_images(store_id);

-- 메뉴·영업시간·이미지: 공개 가게면 누구나 읽고, 사장님은 자기 가게 것만 쓴다.
alter table public.store_menus enable row level security;
alter table public.store_hours enable row level security;
alter table public.store_images enable row level security;
revoke all on public.store_menus, public.store_hours, public.store_images from anon, authenticated;
grant select on public.store_menus, public.store_hours, public.store_images to anon, authenticated;
grant insert, update, delete on public.store_menus, public.store_hours, public.store_images to authenticated;
grant all on public.store_menus, public.store_hours, public.store_images to service_role;
create policy store_menus_read on public.store_menus for select to anon, authenticated using (private.store_is_public(store_id) or private.owns_store(store_id));
create policy store_menus_owner on public.store_menus for all to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));
create policy store_hours_read on public.store_hours for select to anon, authenticated using (private.store_is_public(store_id) or private.owns_store(store_id));
create policy store_hours_owner on public.store_hours for all to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));
create policy store_images_read on public.store_images for select to anon, authenticated using (private.store_is_public(store_id) or private.owns_store(store_id));
create policy store_images_owner on public.store_images for all to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));

-- 가게 찜 (로그인 사용자 본인 것만)
create table public.store_favorites (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);
create index store_favorites_store_idx on public.store_favorites(store_id);
alter table public.store_favorites enable row level security;
revoke all on public.store_favorites from anon, authenticated;
grant select, delete on public.store_favorites to authenticated;
grant insert (user_id, store_id) on public.store_favorites to authenticated;
grant all on public.store_favorites to service_role;
create policy store_favorites_read on public.store_favorites for select to authenticated using (user_id = (select auth.uid()));
create policy store_favorites_delete on public.store_favorites for delete to authenticated using (user_id = (select auth.uid()));
create policy store_favorites_insert on public.store_favorites for insert to authenticated with check (
  user_id = (select auth.uid()) and private.store_is_public(store_id)
);

-- 사장님 신청 (이전 구조와 같다). 승인은 서버 전용 함수가 한다.
create table public.owner_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  applicant_name text not null check (char_length(btrim(applicant_name)) between 1 and 80),
  contact_phone text not null check (
    char_length(contact_phone) between 8 and 25 and contact_phone ~ '^[0-9+() -]+$'
  ),
  store_name text not null check (char_length(btrim(store_name)) between 1 and 100),
  store_address text not null check (char_length(btrim(store_address)) between 1 and 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_store_id uuid references public.stores(id) on delete restrict,
  review_note text not null default '' check (char_length(review_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'pending' and approved_store_id is null and reviewed_at is null and review_note = '')
    or (status = 'approved' and approved_store_id is not null and reviewed_at is not null)
    or (status = 'rejected' and approved_store_id is null and reviewed_at is not null)
  )
);
create unique index owner_applications_one_pending_idx on public.owner_applications(user_id) where status = 'pending';
create index owner_applications_user_idx on public.owner_applications(user_id, created_at desc);
create index owner_applications_store_idx on public.owner_applications(approved_store_id);
alter table public.owner_applications enable row level security;
revoke all on public.owner_applications from anon, authenticated;
grant select on public.owner_applications to authenticated;
grant insert (user_id, applicant_name, contact_phone, store_name, store_address) on public.owner_applications to authenticated;
grant all on public.owner_applications to service_role;
create policy owner_applications_self_read on public.owner_applications
for select to authenticated using (user_id = (select auth.uid()));
create policy owner_applications_self_insert on public.owner_applications
for insert to authenticated with check (
  user_id = (select auth.uid()) and private.has_verified_email_login((select auth.uid()))
);

-- 운영자가 신청을 승인/반려한다. 승인하면 stores.owner_id 가 연결된다.
-- SQL Editor 예: select public.review_owner_application('<신청 id>', 'approved', '<가게 id>', '');
create function public.review_owner_application(
  p_application_id uuid,
  p_decision text,
  p_store_id uuid default null,
  p_note text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_application public.owner_applications%rowtype;
  v_owner_id uuid;
begin
  if p_decision is null or p_decision not in ('approved', 'rejected')
     or p_note is null or char_length(p_note) > 500
     or (p_decision = 'approved' and p_store_id is null)
     or (p_decision = 'rejected' and p_store_id is not null) then
    raise exception 'Invalid application review' using errcode = '22023';
  end if;
  select * into v_application from public.owner_applications
  where id = p_application_id for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  -- 같은 처리를 다시 보내면 그대로 돌려주고, 판단이 바뀐 재요청은 거절한다.
  if v_application.status <> 'pending' then
    if v_application.status = p_decision
       and v_application.approved_store_id is not distinct from p_store_id
       and v_application.review_note = p_note then
      return v_application.approved_store_id;
    end if;
    raise exception 'Application already reviewed' using errcode = '22023';
  end if;

  if p_decision = 'approved' then
    if not private.has_verified_email_login(v_application.user_id) then
      raise exception 'Verified email login required' using errcode = '42501';
    end if;
    select owner_id into v_owner_id from public.stores where id = p_store_id for update;
    if not found then
      raise exception 'Store not found' using errcode = 'P0002';
    end if;
    if v_owner_id is not null and v_owner_id <> v_application.user_id then
      raise exception 'Store already has another owner' using errcode = '23505';
    end if;
    update public.stores set owner_id = v_application.user_id where id = p_store_id;
  end if;

  update public.owner_applications
  set status = p_decision, approved_store_id = p_store_id, review_note = p_note, reviewed_at = now()
  where id = p_application_id;
  return p_store_id;
end;
$$;
revoke all on function public.review_owner_application(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.review_owner_application(uuid, text, uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- 4. 제휴: 혜택 하나를 여러 제휴사(단과대학 등)에 걸 수 있다.
--    사장님이 학생 제휴를 마음대로 만들지 못하게 쓰기는 운영자만 한다.
-- ---------------------------------------------------------------------
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.partner_benefits (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  discount_amount integer check (discount_amount between 1 and 10000000), -- 원
  discount_rate numeric(5,4) check (discount_rate > 0 and discount_rate <= 1), -- 30% = 0.3
  condition text not null default '' check (char_length(condition) <= 500),
  created_at timestamptz not null default now(),
  check (discount_amount is not null or discount_rate is not null)
);
create index partner_benefits_store_idx on public.partner_benefits(store_id);

create table public.benefit_partners (
  id uuid primary key default gen_random_uuid(),
  benefit_id uuid not null references public.partner_benefits(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  unique (benefit_id, partner_id)
);
create index benefit_partners_partner_idx on public.benefit_partners(partner_id);

alter table public.partners enable row level security;
alter table public.partner_benefits enable row level security;
alter table public.benefit_partners enable row level security;
revoke all on public.partners, public.partner_benefits, public.benefit_partners from anon, authenticated;
grant select on public.partners, public.partner_benefits, public.benefit_partners to anon, authenticated;
grant all on public.partners, public.partner_benefits, public.benefit_partners to service_role;
create policy partners_read on public.partners for select to anon, authenticated using (true);
create policy partner_benefits_read on public.partner_benefits for select to anon, authenticated using (private.store_is_public(store_id));
create policy benefit_partners_read on public.benefit_partners for select to anon, authenticated using (
  exists (select 1 from public.partner_benefits b where b.id = benefit_id and private.store_is_public(b.store_id))
);

-- ---------------------------------------------------------------------
-- 5. 마감세일: 할인 유형은 세 가지
--    amount = 금액 할인(discount_amount) / rate = 퍼센트 할인(discount_rate) / free = 무료 제공(offer)
-- ---------------------------------------------------------------------
create table public.closing_sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  discount_type text not null check (discount_type in ('amount', 'rate', 'free')),
  discount_amount integer check (discount_amount between 1 and 10000000),
  discount_rate numeric(5,4) check (discount_rate > 0 and discount_rate <= 1),
  condition text not null default '' check (char_length(condition) <= 500),
  -- 제공 내용 (예: 빵 2개 구매 시 1개 무료). free 일 때 필수, 다른 유형에서는 할인 대상 설명
  offer text not null default '' check (char_length(offer) <= 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (discount_type = 'amount' and discount_amount is not null and discount_rate is null)
    or (discount_type = 'rate' and discount_rate is not null and discount_amount is null)
    or (discount_type = 'free' and btrim(offer) <> '' and discount_amount is null and discount_rate is null)
  )
);
create index closing_sales_store_idx on public.closing_sales(store_id);
create index closing_sales_ends_idx on public.closing_sales(ends_at);
create trigger closing_sales_updated before update on public.closing_sales for each row execute function private.touch_updated_at();
alter table public.closing_sales enable row level security;
revoke all on public.closing_sales from anon, authenticated;
grant select on public.closing_sales to anon, authenticated;
grant insert, update, delete on public.closing_sales to authenticated;
grant all on public.closing_sales to service_role;
create policy closing_sales_read on public.closing_sales for select to anon, authenticated using (private.store_is_public(store_id) or private.owns_store(store_id));
create policy closing_sales_owner on public.closing_sales for all to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));

-- ---------------------------------------------------------------------
-- 6. 공간대여 / 7. 원데이클래스
--    한 가게가 여러 개를 올릴 수 있다. 게시글 본문(body)은 글 안에, 사진은 여러 장.
--    분류 목록은 운영자가 넣는다.
-- ---------------------------------------------------------------------
create table public.space_rental_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 30),
  sort_order integer not null default 0
);

create table public.space_rentals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.space_rental_categories(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 70),
  summary text not null default '' check (char_length(summary) <= 200), -- 간단 설명
  body text not null default '' check (char_length(body) <= 5000),     -- 게시글
  available_hours text not null default '' check (char_length(available_hours) <= 200), -- 이용 가능 시간
  price integer not null check (price between 0 and 10000000),
  capacity integer not null check (capacity between 1 and 1000),        -- 인원
  min_hours smallint check (min_hours between 1 and 24),                -- 최소 이용 시간
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index space_rentals_store_idx on public.space_rentals(store_id);
create trigger space_rentals_updated before update on public.space_rentals for each row execute function private.touch_updated_at();

create table public.space_rental_images (
  id uuid primary key default gen_random_uuid(),
  space_rental_id uuid not null references public.space_rentals(id) on delete cascade,
  image_path text not null check (char_length(image_path) between 1 and 300),
  sort_order integer not null default 0
);
create index space_rental_images_rental_idx on public.space_rental_images(space_rental_id);

create table public.one_day_class_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 30),
  sort_order integer not null default 0
);

create table public.one_day_classes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.one_day_class_categories(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 70),
  summary text not null default '' check (char_length(summary) <= 200),
  body text not null default '' check (char_length(body) <= 5000),
  starts_at timestamptz not null,                                       -- 수업 일시
  duration_minutes integer not null check (duration_minutes between 15 and 1440), -- 이용 시간
  price integer not null check (price between 0 and 10000000),
  current_count integer not null default 0 check (current_count >= 0),  -- 현재 인원
  max_count integer not null check (max_count between 1 and 1000),      -- 마감 인원
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_count <= max_count)
);
create index one_day_classes_store_idx on public.one_day_classes(store_id);
create index one_day_classes_starts_idx on public.one_day_classes(starts_at);
create trigger one_day_classes_updated before update on public.one_day_classes for each row execute function private.touch_updated_at();

create table public.one_day_class_images (
  id uuid primary key default gen_random_uuid(),
  one_day_class_id uuid not null references public.one_day_classes(id) on delete cascade,
  image_path text not null check (char_length(image_path) between 1 and 300),
  sort_order integer not null default 0
);
create index one_day_class_images_class_idx on public.one_day_class_images(one_day_class_id);

alter table public.space_rental_categories enable row level security;
alter table public.one_day_class_categories enable row level security;
alter table public.space_rentals enable row level security;
alter table public.one_day_classes enable row level security;
alter table public.space_rental_images enable row level security;
alter table public.one_day_class_images enable row level security;
revoke all on public.space_rental_categories, public.one_day_class_categories, public.space_rentals,
  public.one_day_classes, public.space_rental_images, public.one_day_class_images from anon, authenticated;
grant select on public.space_rental_categories, public.one_day_class_categories, public.space_rentals,
  public.one_day_classes, public.space_rental_images, public.one_day_class_images to anon, authenticated;
grant insert, update, delete on public.space_rentals, public.one_day_classes,
  public.space_rental_images, public.one_day_class_images to authenticated;
grant all on public.space_rental_categories, public.one_day_class_categories, public.space_rentals,
  public.one_day_classes, public.space_rental_images, public.one_day_class_images to service_role;

create policy space_rental_categories_read on public.space_rental_categories for select to anon, authenticated using (true);
create policy one_day_class_categories_read on public.one_day_class_categories for select to anon, authenticated using (true);

create policy space_rentals_read on public.space_rentals for select to anon, authenticated using (
  (is_published and private.store_is_public(store_id)) or private.owns_store(store_id)
);
create policy space_rentals_owner on public.space_rentals for all to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));
create policy one_day_classes_read on public.one_day_classes for select to anon, authenticated using (
  (is_published and private.store_is_public(store_id)) or private.owns_store(store_id)
);
create policy one_day_classes_owner on public.one_day_classes for all to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));

create policy space_rental_images_read on public.space_rental_images for select to anon, authenticated using (
  exists (select 1 from public.space_rentals r where r.id = space_rental_id)
);
create policy space_rental_images_owner on public.space_rental_images for all to authenticated using (
  exists (select 1 from public.space_rentals r where r.id = space_rental_id and private.owns_store(r.store_id))
) with check (
  exists (select 1 from public.space_rentals r where r.id = space_rental_id and private.owns_store(r.store_id))
);
create policy one_day_class_images_read on public.one_day_class_images for select to anon, authenticated using (
  exists (select 1 from public.one_day_classes c where c.id = one_day_class_id)
);
create policy one_day_class_images_owner on public.one_day_class_images for all to authenticated using (
  exists (select 1 from public.one_day_classes c where c.id = one_day_class_id and private.owns_store(c.store_id))
) with check (
  exists (select 1 from public.one_day_classes c where c.id = one_day_class_id and private.owns_store(c.store_id))
);

-- ---------------------------------------------------------------------
-- 8. 스탬프 (이전 구조 유지. 로그인 단계에서 다시 다듬는다)
--    잔액과 이력은 서버 전용 함수가 한 번에 바꾼다.
-- ---------------------------------------------------------------------
create table public.stamp_policies (
  store_id uuid primary key references public.stores(id) on delete cascade,
  required_stamps integer not null check (required_stamps between 1 and 100),
  reward text not null check (char_length(btrim(reward)) between 1 and 300),
  unit text not null check (char_length(btrim(unit)) between 1 and 100),
  condition text not null default '' check (char_length(condition) <= 1000)
);
alter table public.stamp_policies enable row level security;
revoke all on public.stamp_policies from anon, authenticated;
grant select on public.stamp_policies to anon, authenticated;
grant insert (store_id, required_stamps, reward, unit, condition), update (required_stamps, reward, unit, condition) on public.stamp_policies to authenticated;
grant all on public.stamp_policies to service_role;
create policy stamp_policies_read on public.stamp_policies for select to anon, authenticated using (private.store_is_public(store_id));
create policy stamp_policies_owner on public.stamp_policies for all to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));

create table public.user_stamps (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  store_id uuid not null references public.stamp_policies(store_id) on delete cascade,
  count integer not null default 0 check (count between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, store_id)
);
create index user_stamps_store_idx on public.user_stamps(store_id);

create table public.stamp_transactions (
  request_id uuid primary key,
  user_id uuid not null,
  store_id uuid not null,
  delta integer not null check (delta between -1000 and 1000 and delta <> 0),
  balance_after integer not null check (balance_after between 0 and 100000),
  reason text not null check (char_length(btrim(reason)) between 1 and 300),
  created_at timestamptz not null default now(),
  foreign key (user_id, store_id) references public.user_stamps(user_id, store_id) on delete cascade
);
create index stamp_transactions_history_idx on public.stamp_transactions(user_id, store_id, created_at desc);
alter table public.user_stamps enable row level security;
alter table public.stamp_transactions enable row level security;
revoke all on public.user_stamps, public.stamp_transactions from anon, authenticated;
grant select on public.user_stamps, public.stamp_transactions to authenticated;
grant all on public.user_stamps, public.stamp_transactions to service_role;
create policy user_stamps_read on public.user_stamps for select to authenticated using (user_id = (select auth.uid()));
create policy stamp_transactions_read on public.stamp_transactions for select to authenticated using (user_id = (select auth.uid()));

-- 호출 전 서버가 구매 확인/보상 사용/담당 가게 권한을 검증해야 한다.
-- request_id 는 같은 요청을 다시 보낼 때 반드시 같은 값을 쓴다.
create function public.apply_stamp_change(
  p_user_id uuid, p_store_id uuid, p_delta integer, p_request_id uuid, p_reason text
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_balance integer;
  v_previous public.stamp_transactions%rowtype;
begin
  if p_user_id is null or p_store_id is null or p_request_id is null
     or p_delta is null or p_delta = 0 or p_delta not between -1000 and 1000
     or p_reason is null or char_length(btrim(p_reason)) not between 1 and 300 then
    raise exception 'Invalid stamp change' using errcode = '22023';
  end if;
  insert into public.user_stamps(user_id, store_id) values (p_user_id, p_store_id)
  on conflict (user_id, store_id) do nothing;

  select count into v_balance from public.user_stamps
  where user_id = p_user_id and store_id = p_store_id for update;

  select * into v_previous from public.stamp_transactions where request_id = p_request_id;
  if found then
    if v_previous.user_id <> p_user_id or v_previous.store_id <> p_store_id
       or v_previous.delta <> p_delta or v_previous.reason <> p_reason then
      raise exception 'Request ID already used for another change' using errcode = '22023';
    end if;
    return v_previous.balance_after;
  end if;

  v_balance := v_balance + p_delta;
  if v_balance not between 0 and 100000 then
    raise exception 'Insufficient stamps or balance limit exceeded' using errcode = '23514';
  end if;
  insert into public.stamp_transactions(request_id, user_id, store_id, delta, balance_after, reason)
  values (p_request_id, p_user_id, p_store_id, p_delta, v_balance, p_reason);
  update public.user_stamps set count = v_balance, updated_at = now()
  where user_id = p_user_id and store_id = p_store_id;
  return v_balance;
end;
$$;
revoke all on function public.apply_stamp_change(uuid, uuid, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_stamp_change(uuid, uuid, integer, uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- 9. 사진 저장소: 공개 가게·게시글 사진 전용. 경로는 <store_id>/<파일>
--    누구나 공개 주소로 볼 수 있고, 올리기·지우기는 그 가게 사장님만 한다.
-- ---------------------------------------------------------------------
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('store-media', 'store-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.owns_media_path(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.stores s
    where s.id::text = (storage.foldername(p_name))[1] and s.owner_id = (select auth.uid())
  );
$$;
revoke all on function private.owns_media_path(text) from public;
grant execute on function private.owns_media_path(text) to authenticated, service_role;

create policy store_media_owner_select on storage.objects for select to authenticated using (
  bucket_id = 'store-media' and private.owns_media_path(name)
);
create policy store_media_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'store-media' and private.owns_media_path(name)
);
create policy store_media_owner_update on storage.objects for update to authenticated using (
  bucket_id = 'store-media' and private.owns_media_path(name)
) with check (
  bucket_id = 'store-media' and private.owns_media_path(name)
);
create policy store_media_owner_delete on storage.objects for delete to authenticated using (
  bucket_id = 'store-media' and private.owns_media_path(name)
);

commit;
