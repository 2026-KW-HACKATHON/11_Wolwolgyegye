-- =====================================================================
-- 예시(mock) 데이터 표시. 2026-10-05
--
-- 예시 데이터는 "예시 가게(stores.is_mock = true)"에만 붙인다.
-- 메뉴·영업시간·사진·마감세일·제휴 혜택·공간대여·원데이클래스·스탬프 정책은 모두 가게를 가리키고
-- 가게를 지우면 함께 지워지므로(on delete cascade), 표마다 표시를 달 필요가 없다.
--
-- 예시 데이터 전부 지우기 (SQL Editor):
--   delete from public.stores where is_mock;
-- 예시 데이터 넣기/새로 고치기: database/mock/seed_mock.sql 전체 실행
-- =====================================================================
begin;

alter table public.stores add column is_mock boolean not null default false;
comment on column public.stores.is_mock is '예시 가게. true 인 가게와 거기 딸린 데이터는 언제든 지워도 된다';
create index stores_mock_idx on public.stores(id) where is_mock;

-- 예시 가게는 사장님 신청 승인 대상이 아니다 (승인 기록이 남으면 restrict 때문에 예시 가게를 지울 수 없게 된다)
create function private.reject_mock_store_approval()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.approved_store_id is not null
     and exists (select 1 from public.stores where id = new.approved_store_id and is_mock) then
    raise exception 'Mock store cannot be approved' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.reject_mock_store_approval() from public;
create trigger owner_applications_no_mock before insert or update of approved_store_id on public.owner_applications
for each row execute function private.reject_mock_store_approval();

commit;
