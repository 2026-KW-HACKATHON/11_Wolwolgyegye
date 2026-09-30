-- 스탬프 잔액과 이력은 서버 전용 함수가 한 트랜잭션으로 변경한다.
begin;
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
create policy stamp_policies_read on public.stamp_policies for select to anon, authenticated using (
  exists (select 1 from public.stores s where s.id = store_id and s.is_published)
);
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
-- request_id는 동일 요청 재시도 시 반드시 재사용한다.
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
commit;
