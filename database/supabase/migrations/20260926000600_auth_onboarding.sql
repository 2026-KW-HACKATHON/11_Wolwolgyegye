-- 로그인 수단은 Supabase Auth, 사장님 신청/가게 권한은 앱 DB에서 관리한다.
begin;

-- 소셜/이메일 가입 모두 공통 프로필 생성. user_metadata는 표시 이름에만 사용한다.
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

-- 기존 계정도 누락된 프로필만 채운다. 이미 지정한 닉네임은 유지한다.
insert into public.profiles(user_id, display_name)
select id, left(coalesce(
  nullif(btrim(raw_user_meta_data ->> 'display_name'), ''),
  nullif(btrim(raw_user_meta_data ->> 'full_name'), ''),
  nullif(btrim(raw_user_meta_data ->> 'name'), ''),
  '월계 주민'
), 40) from auth.users
on conflict (user_id) do nothing;

-- 확인된 이메일 + 이메일 로그인 identity 필요. 클라이언트 metadata는 신뢰하지 않는다.
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
create unique index owner_applications_one_pending_idx on public.owner_applications(user_id)
where status = 'pending';
create index owner_applications_user_idx on public.owner_applications(user_id, created_at desc);
create index owner_applications_store_idx on public.owner_applications(approved_store_id);
alter table public.owner_applications enable row level security;
revoke all on public.owner_applications from anon, authenticated;
grant select on public.owner_applications to authenticated;
grant insert (user_id, applicant_name, contact_phone, store_name, store_address)
on public.owner_applications to authenticated;
grant all on public.owner_applications to service_role;
create policy owner_applications_self_read on public.owner_applications
for select to authenticated using (user_id = (select auth.uid()));
create policy owner_applications_self_insert on public.owner_applications
for insert to authenticated with check (
  user_id = (select auth.uid()) and private.has_verified_email_login((select auth.uid()))
);
-- 신청 내용은 제출 후 고정한다. 반려 뒤 새 신청 가능, 승인 여부는 서버만 결정한다.

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

  -- 동일 처리 재시도는 안전하게 반환하되 변경된 판단/내용은 거절한다.
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
revoke all on function public.review_owner_application(uuid, text, uuid, text)
from public, anon, authenticated;
grant execute on function public.review_owner_application(uuid, text, uuid, text) to service_role;
-- 서버가 관리자 인증/가게 증빙을 확인한 뒤 호출한다. 가게 공개 승인은 별도다.
commit;
