-- 마감세일, 제휴, 룰렛. 공개 정보와 사용자별 관심을 분리한다.
begin;
create table public.closing_sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  discount_rate numeric(5,4) not null check (discount_rate > 0 and discount_rate <= 1),
  close_at timestamptz not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, store_id)
);
create index closing_sales_feed_idx on public.closing_sales(close_at) where is_published;

create table public.closing_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null,
  store_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  original_price integer not null check (original_price between 0 and 10000000),
  discount_rate numeric(5,4) not null check (discount_rate > 0 and discount_rate <= 1),
  foreign key (sale_id, store_id) references public.closing_sales(id, store_id) on delete cascade
);
create index closing_sale_items_sale_idx on public.closing_sale_items(sale_id, store_id);

create table public.roulette_store_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  menu_name text not null check (char_length(btrim(menu_name)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  tag_label text not null default '' check (char_length(tag_label) <= 30),
  emoji text not null default '🍽️' check (char_length(emoji) <= 20),
  unique (store_id, menu_name)
);

create table public.partner_benefits (
  store_id uuid not null references public.stores(id) on delete cascade,
  college_key text not null check (college_key in ('eie','ai','eng','sci','hss','law','biz','chambit')),
  benefit text not null check (char_length(btrim(benefit)) between 1 and 1000),
  condition text not null default '' check (char_length(condition) <= 1000),
  primary key (store_id, college_key)
);
-- 제휴 확인은 관리자 처리. 사장님이 임의로 학생 제휴를 발급할 수 없다.
alter table public.partner_benefits enable row level security;
revoke all on public.partner_benefits from anon, authenticated;
grant select on public.partner_benefits to anon, authenticated;
grant all on public.partner_benefits to service_role;
create policy partner_benefits_read on public.partner_benefits for select to anon, authenticated using (
  exists (select 1 from public.stores s where s.id = store_id and s.is_published)
);

alter table public.closing_sales enable row level security;
revoke all on public.closing_sales from anon, authenticated;
grant select on public.closing_sales to anon, authenticated;
grant insert (store_id, description, discount_rate, close_at, is_published), update (description, discount_rate, close_at, is_published), delete on public.closing_sales to authenticated;
grant all on public.closing_sales to service_role;
create index closing_sales_store_idx on public.closing_sales(store_id);
create policy closing_sales_read on public.closing_sales for select to anon, authenticated using (is_published and exists (select 1 from public.stores s where s.id = store_id and s.is_published));
create policy closing_sales_owner on public.closing_sales for all to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));

alter table public.closing_sale_items enable row level security;
revoke all on public.closing_sale_items from anon, authenticated;
grant select on public.closing_sale_items to anon, authenticated;
grant insert (store_id, sale_id, name, original_price, discount_rate), update (name, original_price, discount_rate), delete on public.closing_sale_items to authenticated;
grant all on public.closing_sale_items to service_role;
create index closing_sale_items_store_idx on public.closing_sale_items(store_id);
create policy closing_sale_items_read on public.closing_sale_items for select to anon, authenticated using (exists (select 1 from public.closing_sales c join public.stores s on s.id = c.store_id where c.id = sale_id and c.is_published and s.is_published));
create policy closing_sale_items_owner on public.closing_sale_items for all to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));

alter table public.roulette_store_links enable row level security;
revoke all on public.roulette_store_links from anon, authenticated;
grant select on public.roulette_store_links to anon, authenticated;
grant insert (store_id, menu_name, description, tag_label, emoji), update (menu_name, description, tag_label, emoji), delete on public.roulette_store_links to authenticated;
grant all on public.roulette_store_links to service_role;
create index roulette_store_links_store_idx on public.roulette_store_links(store_id);
create policy roulette_store_links_read on public.roulette_store_links for select to anon, authenticated using (exists (select 1 from public.stores s where s.id = store_id and s.is_published));
create policy roulette_store_links_owner on public.roulette_store_links for all to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));

create trigger closing_sales_updated before update on public.closing_sales for each row execute function private.touch_updated_at();

create table public.sale_likes (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  sale_id uuid not null references public.closing_sales(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sale_id)
);
create index sale_likes_sale_idx on public.sale_likes(sale_id);
alter table public.sale_likes enable row level security;
revoke all on public.sale_likes from anon, authenticated;
grant select, delete on public.sale_likes to authenticated;
grant insert (user_id, sale_id) on public.sale_likes to authenticated;
grant all on public.sale_likes to service_role;
create policy sale_likes_read on public.sale_likes for select to authenticated using (user_id = (select auth.uid()));
create policy sale_likes_delete on public.sale_likes for delete to authenticated using (user_id = (select auth.uid()));
create policy sale_likes_insert on public.sale_likes for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.closing_sales c join public.stores s on s.id = c.store_id
    where c.id = sale_id and c.is_published and s.is_published
  )
);
-- 공개 세일의 총 관심 수만 반환한다. 찜한 사람의 ID는 공개하지 않는다.
create function public.get_sale_like_counts(p_sale_ids uuid[])
returns table (sale_id uuid, like_count bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, count(l.user_id)
  from public.closing_sales c
  join public.stores s on s.id = c.store_id
  left join public.sale_likes l on l.sale_id = c.id
  where c.id = any(p_sale_ids) and c.is_published and s.is_published
  group by c.id;
$$;
revoke all on function public.get_sale_like_counts(uuid[]) from public;
grant execute on function public.get_sale_like_counts(uuid[]) to anon, authenticated, service_role;
commit;
