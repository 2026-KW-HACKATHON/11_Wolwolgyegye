-- 사용자, 가게, 메뉴. 소유권 부여와 가게 공개는 관리자가 확인한 뒤 처리한다.
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public;

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

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(user_id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  cuisine_type text,
  address text not null check (char_length(btrim(address)) between 1 and 300),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  phone text not null default '' check (char_length(phone) <= 30),
  business_hours text not null default '' check (char_length(business_hours) <= 500),
  thumbnail_path text,
  supported_features text[] not null default '{}' check (
    supported_features <@ array['space-rental','oneday-class','roulette','closing-sale','coupon','partner-stores']::text[]
    and array_position(supported_features, null) is null
  ),
  is_published boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_owner_idx on public.stores(owner_id);
alter table public.stores enable row level security;
revoke all on public.stores from anon, authenticated;
grant select on public.stores to anon, authenticated;
grant update (name, cuisine_type, address, lat, lng, phone, business_hours, thumbnail_path, supported_features) on public.stores to authenticated;
grant all on public.stores to service_role;
create policy stores_read on public.stores for select to anon, authenticated using (is_published or owner_id = (select auth.uid()));
create policy stores_owner_update on public.stores for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create trigger stores_updated before update on public.stores for each row execute function private.touch_updated_at();

-- RLS 내부에서만 사용하는 소유권 검사. 공개 API 스키마에 노출하지 않는다.
create function private.owns_store(p_store_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.stores
    where id = p_store_id and owner_id = (select auth.uid())
  );
$$;
revoke all on function private.owns_store(uuid) from public;
grant execute on function private.owns_store(uuid) to authenticated, service_role;

create table public.store_menus (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  price integer not null check (price between 0 and 10000000),
  image_path text,
  is_available boolean not null default true,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index store_menus_store_idx on public.store_menus(store_id);
alter table public.store_menus enable row level security;
revoke all on public.store_menus from anon, authenticated;
grant select on public.store_menus to anon, authenticated;
grant insert (store_id, name, price, image_path, is_available), update (name, price, image_path, is_available), delete on public.store_menus to authenticated;
grant all on public.store_menus to service_role;
create policy menus_public_read on public.store_menus for select to anon, authenticated using (
  is_available and exists (select 1 from public.stores s where s.id = store_id and s.is_published)
);
create policy menus_owner on public.store_menus for all to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));
create trigger menus_updated before update on public.store_menus for each row execute function private.touch_updated_at();

commit;
