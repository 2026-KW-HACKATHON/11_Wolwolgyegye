-- 스탬프 적립 코드: 손님이 6자리 코드를 보여주면 사장님 화면에서 입력해 스탬프를 찍는다.
--   1. 손님: issue_stamp_code(가게) → 서버가 6자리 코드를 만들어 3분간 유효하게 저장한다 (가게·손님당 하나, 다시 받으면 바뀜).
--   2. 사장님: redeem_stamp_code(가게, 코드, 개수) → 자기 가게 코드인지·유효한지 확인하고 apply_stamp_change 로 적립한다.
--   3. 손님 화면은 자기 코드 행(used_at)을 읽어 적립이 끝났는지 안다.
-- 코드는 한 번만 쓸 수 있고, 같은 가게 안에서 겹치지 않는다.
begin;

create table public.stamp_codes (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  store_id uuid not null references public.stamp_policies(store_id) on delete cascade,
  code char(6) not null check (code ~ '^[0-9]{6}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_count integer check (used_count between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);
create unique index stamp_codes_store_code_idx on public.stamp_codes(store_id, code);
alter table public.stamp_codes enable row level security;
revoke all on public.stamp_codes from anon, authenticated;
grant select on public.stamp_codes to authenticated;
grant all on public.stamp_codes to service_role;
create policy stamp_codes_read on public.stamp_codes for select to authenticated using (user_id = (select auth.uid()));

-- 손님: 이 가게에서 쓸 새 적립 코드를 받는다. 이전 코드는 바로 못 쓰게 된다.
create function public.issue_stamp_code(p_store_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_code text;
  v_expires timestamptz := now() + interval '180 seconds';
begin
  if v_user_id is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.stamp_policies p where p.store_id = p_store_id)
     or not private.store_is_public(p_store_id) then
    raise exception 'Stamp policy not found' using errcode = 'P0002';
  end if;
  if private.owns_store(p_store_id) then
    raise exception 'Owners cannot collect stamps at their own store' using errcode = '42501';
  end if;

  -- 지난 코드는 비워서 번호를 다시 쓸 수 있게 한다 (적립 기록은 stamp_transactions 에 남는다)
  delete from public.stamp_codes c where c.store_id = p_store_id and c.user_id <> v_user_id
    and (c.expires_at <= now() or c.used_at is not null);

  for i in 1..20 loop
    -- gen_random_uuid() 는 안전한 난수를 쓴다
    v_code := lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
    begin
      insert into public.stamp_codes as c (user_id, store_id, code, expires_at)
      values (v_user_id, p_store_id, v_code, v_expires)
      on conflict (user_id, store_id) do update
        set code = excluded.code, expires_at = excluded.expires_at, used_at = null, used_count = null, created_at = now();
      return query select v_code, v_expires;
      return;
    exception when unique_violation then
      -- 같은 가게의 다른 손님 코드와 겹침 → 다시 뽑는다
    end;
  end loop;
  raise exception 'Could not issue stamp code' using errcode = '55000';
end;
$$;
revoke all on function public.issue_stamp_code(uuid) from public, anon;
grant execute on function public.issue_stamp_code(uuid) to authenticated;

-- 사장님: 손님이 보여준 코드를 입력해 스탬프 p_count 개를 찍는다. 적립 뒤 잔액을 돌려준다.
create function public.redeem_stamp_code(p_store_id uuid, p_code text, p_count integer default 1)
returns table (balance integer, required_stamps integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.stamp_codes%rowtype;
  v_policy public.stamp_policies%rowtype;
  v_balance integer;
begin
  if (select auth.uid()) is null or not private.owns_store(p_store_id) then
    raise exception 'Not the owner of this store' using errcode = '42501';
  end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' then
    raise exception 'Invalid stamp code' using errcode = '22023';
  end if;
  if p_count is null or p_count not between 1 and 100 then
    raise exception 'Invalid stamp count' using errcode = '22023';
  end if;
  select * into v_policy from public.stamp_policies p where p.store_id = p_store_id;
  if not found then
    raise exception 'Stamp policy not found' using errcode = 'P0002';
  end if;

  select * into v_row from public.stamp_codes c
  where c.store_id = p_store_id and c.code = p_code for update;
  if not found or v_row.used_at is not null or v_row.expires_at <= now() then
    raise exception 'Stamp code not found or expired' using errcode = 'P0002';
  end if;

  v_balance := public.apply_stamp_change(v_row.user_id, p_store_id, p_count, gen_random_uuid(),
    left(v_policy.unit || ' 적립', 300));
  update public.stamp_codes c set used_at = now(), used_count = p_count
  where c.user_id = v_row.user_id and c.store_id = p_store_id;
  return query select v_balance, v_policy.required_stamps;
end;
$$;
revoke all on function public.redeem_stamp_code(uuid, text, integer) from public, anon;
grant execute on function public.redeem_stamp_code(uuid, text, integer) to authenticated;

commit;
