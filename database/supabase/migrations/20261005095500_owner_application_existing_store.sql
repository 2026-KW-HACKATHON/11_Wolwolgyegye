-- 사장님 신청은 임의의 가게명/주소가 아니라 DB에 등록된 실제 가게를 선택한다.
-- 사업자등록번호는 신청자 본인과 관리자만 볼 수 있는 owner_applications 행에 저장한다.
begin;

alter table public.owner_applications
  add column requested_store_id uuid references public.stores(id) on delete restrict,
  add column business_registration_number text;

-- 기존 방식으로 접수된 행은 보존한다. 새 신청은 아래 트리거와 열 권한으로 두 값을 필수화한다.
alter table public.owner_applications
  add constraint owner_applications_business_number_format
    check (
      business_registration_number is null
      or business_registration_number ~ '^[0-9]{10}$'
    );

create index owner_applications_requested_store_idx
  on public.owner_applications(requested_store_id, created_at desc);

create function private.prepare_owner_application()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_store public.stores%rowtype;
begin
  new.business_registration_number := regexp_replace(
    coalesce(new.business_registration_number, ''), '[^0-9]', '', 'g'
  );
  if new.business_registration_number !~ '^[0-9]{10}$' then
    raise exception 'Invalid business registration number' using errcode = '22023';
  end if;

  select * into v_store
  from public.stores
  where id = new.requested_store_id
    and owner_id is null
    and is_published
    and not is_mock;
  if not found then
    raise exception 'Store is not available for owner application' using errcode = '22023';
  end if;

  -- 화면에서 보낸 문자열을 신뢰하지 않고 DB의 가게명·주소를 신청 당시 값으로 보관한다.
  new.store_name := v_store.name;
  new.store_address := v_store.address;
  return new;
end;
$$;
revoke all on function private.prepare_owner_application() from public, anon, authenticated;

create trigger owner_applications_prepare
before insert on public.owner_applications
for each row execute function private.prepare_owner_application();

-- 가입 화면에는 소유자가 없고 공개된 실제 가게만 제한적으로 검색해 준다.
create function public.search_claimable_stores(p_query text)
returns table (
  id uuid,
  name text,
  address text,
  phone text,
  industry text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.name, s.address, s.phone, s.industry
  from public.stores s
  where s.owner_id is null
    and s.is_published
    and not s.is_mock
    and char_length(btrim(coalesce(p_query, ''))) between 2 and 100
    and concat_ws(' ', s.name, s.address, s.industry) ilike
        '%' || btrim(p_query) || '%'
  order by
    case when s.name ilike btrim(p_query) || '%' then 0 else 1 end,
    s.name,
    s.address,
    s.id
  limit 20;
$$;
revoke all on function public.search_claimable_stores(text) from public, anon;
grant execute on function public.search_claimable_stores(text) to authenticated, service_role;

-- 가게명·주소 직접 삽입 권한을 없애고 선택한 가게 ID와 사업자번호만 받는다.
revoke insert on public.owner_applications from authenticated;
grant insert (
  user_id, applicant_name, contact_phone,
  requested_store_id, business_registration_number
) on public.owner_applications to authenticated;

-- 관리자는 신청자가 선택한 가게 외의 가게로 승인할 수 없다.
create or replace function public.review_owner_application(
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

  if v_application.status <> 'pending' then
    if v_application.status = p_decision
       and v_application.approved_store_id is not distinct from p_store_id
       and v_application.review_note = p_note then
      return v_application.approved_store_id;
    end if;
    raise exception 'Application already reviewed' using errcode = '22023';
  end if;

  if p_decision = 'approved' then
    if p_store_id <> v_application.requested_store_id then
      raise exception 'Approved store must match requested store' using errcode = '22023';
    end if;
    if not private.has_verified_email_login(v_application.user_id) then
      raise exception 'Verified email login required' using errcode = '42501';
    end if;
    select owner_id into v_owner_id
    from public.stores
    where id = p_store_id and is_published and not is_mock
    for update;
    if not found then
      raise exception 'Store not found' using errcode = 'P0002';
    end if;
    if v_owner_id is not null and v_owner_id <> v_application.user_id then
      raise exception 'Store already has another owner' using errcode = '23505';
    end if;
    update public.stores set owner_id = v_application.user_id where id = p_store_id;
  end if;

  update public.owner_applications
  set status = p_decision, approved_store_id = p_store_id,
      review_note = p_note, reviewed_at = now()
  where id = p_application_id;
  return p_store_id;
end;
$$;
revoke all on function public.review_owner_application(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.review_owner_application(uuid, text, uuid, text)
  to service_role;

-- 관리자 목록에도 선택 가게 ID, 가게 전화번호, 사업자등록번호를 함께 제공한다.
drop function public.admin_list_owner_applications(text);
create function public.admin_list_owner_applications(p_status text default 'pending')
returns table (
  id uuid,
  user_id uuid,
  applicant_name text,
  applicant_email text,
  contact_phone text,
  store_name text,
  store_address text,
  requested_store_id uuid,
  requested_store_phone text,
  business_registration_number text,
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
         a.store_name, a.store_address, a.requested_store_id, s.phone,
         a.business_registration_number, a.status, a.approved_store_id,
         a.review_note, a.reviewed_at, a.created_at
  from public.owner_applications a
  join auth.users u on u.id = a.user_id
  left join public.stores s on s.id = a.requested_store_id
  where p_status = 'all' or a.status = p_status
  order by a.created_at desc;
end;
$$;
revoke all on function public.admin_list_owner_applications(text) from public, anon;
grant execute on function public.admin_list_owner_applications(text)
  to authenticated, service_role;

-- 이제 신청에 없는 새 가게를 관리자 화면에서 만들어 승인하는 우회 경로는 사용하지 않는다.
drop function if exists public.admin_create_store_and_approve(
  uuid, text, text, double precision, double precision, text, text, text
);

commit;
