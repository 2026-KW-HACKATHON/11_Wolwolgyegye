-- 실제 메뉴 원본 추적과 단과대학-가게 직접 연결.
-- 메뉴는 store_menus 에 한 번만 저장하고, 여러 단과대 제휴는 store_partners 로 표현한다.

alter table public.store_menus
  add column review_status text not null default 'confirmed'
    check (review_status in ('confirmed', 'needs_review')),
  add column data_source text not null default ''
    check (char_length(data_source) <= 100);

comment on column public.store_menus.review_status is '엑셀 정제 검수 상태: confirmed 또는 needs_review';
comment on column public.store_menus.data_source is '메뉴를 가져온 원본 자료 이름';

create table public.store_partners (
  store_id uuid not null references public.stores(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (store_id, partner_id)
);

create index store_partners_partner_idx on public.store_partners(partner_id);

alter table public.store_partners enable row level security;
revoke all on public.store_partners from anon, authenticated;
grant select on public.store_partners to anon, authenticated;
grant all on public.store_partners to service_role;

create policy store_partners_read
  on public.store_partners
  for select
  to anon, authenticated
  using (private.store_is_public(store_id));

comment on table public.store_partners is '광운대학교 단과대학(partners)과 실제 제휴 가게의 다대다 관계';
