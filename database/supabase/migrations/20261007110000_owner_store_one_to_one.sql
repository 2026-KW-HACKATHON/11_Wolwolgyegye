-- 사장 계정과 가게를 1:1로 연결한다.
-- 한 계정이 여러 가게를 소유하거나, 한 가게에 여러 승인 대기 신청이 쌓이는 것을 DB에서 막는다.
begin;

create unique index stores_one_owner_per_account_idx
  on public.stores(owner_id)
  where owner_id is not null;

create unique index owner_applications_one_pending_store_idx
  on public.owner_applications(requested_store_id)
  where status = 'pending' and requested_store_id is not null;

create or replace function private.prepare_owner_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store public.stores%rowtype;
begin
  if (select auth.uid()) is not null
     and new.user_id is distinct from (select auth.uid()) then
    raise exception 'Cannot submit application for another user' using errcode = '42501';
  end if;

  new.business_registration_number := regexp_replace(
    coalesce(new.business_registration_number, ''), '[^0-9]', '', 'g'
  );
  if new.business_registration_number !~ '^[0-9]{10}$' then
    raise exception 'Invalid business registration number' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.stores where owner_id = new.user_id
  ) then
    raise exception 'Owner account already linked to a store' using errcode = '23505';
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

  if exists (
    select 1
    from public.owner_applications
    where requested_store_id = new.requested_store_id
      and status = 'pending'
  ) then
    raise exception 'Store already has pending owner application' using errcode = '23505';
  end if;

  new.store_name := v_store.name;
  new.store_address := v_store.address;
  return new;
end;
$$;
revoke all on function private.prepare_owner_application() from public, anon, authenticated;

create or replace function public.search_claimable_stores(p_query text)
returns table (
  id uuid,
  name text,
  address text,
  phone text,
  industry text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.address, s.phone, s.industry
  from public.stores s
  where s.owner_id is null
    and s.is_published
    and not s.is_mock
    and not exists (
      select 1
      from public.owner_applications a
      where a.requested_store_id = s.id
        and a.status = 'pending'
    )
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

create or replace function public.review_owner_application(
  p_application_id uuid,
  p_decision text,
  p_store_id uuid default null,
  p_note text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_application public.owner_applications%rowtype;
  v_owner_id uuid;
  v_existing_store_id uuid;
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

    select id into v_existing_store_id
    from public.stores
    where owner_id = v_application.user_id
    for update;
    if found and v_existing_store_id <> p_store_id then
      raise exception 'Owner account already linked to another store' using errcode = '23505';
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

commit;
