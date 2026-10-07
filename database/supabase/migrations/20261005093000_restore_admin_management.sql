-- 최신 통합 스키마(industry, is_mock)에 맞춘 관리자 권한과 사장님 신청 검토 API.
-- 관리자 명단은 private 스키마에 두고, 모든 공개 RPC가 호출 시점에 권한을 다시 확인한다.
begin;

create table if not exists private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on private.admin_users from public, anon, authenticated;
grant all on private.admin_users to service_role;

create or replace function private.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1 from private.admin_users where user_id = p_user_id
  );
$$;
revoke all on function private.is_admin(uuid) from public, anon, authenticated;
grant execute on function private.is_admin(uuid) to service_role;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin((select auth.uid()));
$$;
revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated, service_role;

create or replace function public.admin_list_owner_applications(p_status text default 'pending')
returns table (
  id uuid,
  user_id uuid,
  applicant_name text,
  applicant_email text,
  contact_phone text,
  store_name text,
  store_address text,
  status text,
  approved_store_id uuid,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin((select auth.uid())) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'approved', 'rejected', 'all') then
    raise exception 'Invalid application status' using errcode = '22023';
  end if;

  return query
  select a.id, a.user_id, a.applicant_name, u.email::text, a.contact_phone,
         a.store_name, a.store_address, a.status, a.approved_store_id,
         a.review_note, a.reviewed_at, a.created_at
  from public.owner_applications a
  join auth.users u on u.id = a.user_id
  where p_status = 'all' or a.status = p_status
  order by a.created_at desc;
end;
$$;
revoke all on function public.admin_list_owner_applications(text) from public, anon;
grant execute on function public.admin_list_owner_applications(text) to authenticated, service_role;

-- 기존 프런트 타입 이름을 유지하되 최신 DB의 industry/is_mock 값을 반환한다.
create or replace function public.admin_list_stores()
returns table (
  id uuid,
  name text,
  cuisine_type text,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  owner_id uuid,
  is_published boolean,
  is_demo boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin((select auth.uid())) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select s.id, s.name, nullif(s.industry, ''), s.address, s.lat, s.lng, s.phone,
         s.owner_id, s.is_published, s.is_mock, s.created_at
  from public.stores s
  order by s.name, s.address, s.id;
end;
$$;
revoke all on function public.admin_list_stores() from public, anon;
grant execute on function public.admin_list_stores() to authenticated, service_role;

create or replace function public.admin_review_owner_application(
  p_application_id uuid,
  p_decision text,
  p_store_id uuid default null,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin((select auth.uid())) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return public.review_owner_application(p_application_id, p_decision, p_store_id, p_note);
end;
$$;
revoke all on function public.admin_review_owner_application(uuid, text, uuid, text) from public, anon;
grant execute on function public.admin_review_owner_application(uuid, text, uuid, text) to authenticated, service_role;

create or replace function public.admin_create_store_and_approve(
  p_application_id uuid,
  p_name text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_cuisine_type text default null,
  p_phone text default '',
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
begin
  if not private.is_admin((select auth.uid())) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 100
     or p_address is null or char_length(btrim(p_address)) not between 1 and 300
     or p_lat is null or p_lat not between -90 and 90
     or p_lng is null or p_lng not between -180 and 180
     or p_phone is null or char_length(p_phone) > 30
     or p_note is null or char_length(p_note) > 500 then
    raise exception 'Invalid store details' using errcode = '22023';
  end if;

  insert into public.stores (
    name, industry, address, lat, lng, phone, is_published, is_mock
  ) values (
    btrim(p_name), coalesce(nullif(btrim(p_cuisine_type), ''), ''), btrim(p_address),
    p_lat, p_lng, p_phone, false, false
  ) returning id into v_store_id;

  perform public.review_owner_application(
    p_application_id, 'approved', v_store_id, p_note
  );
  return v_store_id;
end;
$$;
revoke all on function public.admin_create_store_and_approve(uuid, text, text, double precision, double precision, text, text, text) from public, anon;
grant execute on function public.admin_create_store_and_approve(uuid, text, text, double precision, double precision, text, text, text) to authenticated, service_role;

create or replace function public.admin_set_store_published(
  p_store_id uuid,
  p_is_published boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin((select auth.uid())) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_store_id is null or p_is_published is null then
    raise exception 'Invalid store publication request' using errcode = '22023';
  end if;

  update public.stores set is_published = p_is_published where id = p_store_id;
  if not found then
    raise exception 'Store not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.admin_set_store_published(uuid, boolean) from public, anon;
grant execute on function public.admin_set_store_published(uuid, boolean) to authenticated, service_role;

-- 플랫폼 event trigger 함수가 Data API RPC로 노출되지 않도록 실행 권한을 닫는다.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
    grant execute on function public.rls_auto_enable() to service_role;
  end if;
end;
$$;

commit;
