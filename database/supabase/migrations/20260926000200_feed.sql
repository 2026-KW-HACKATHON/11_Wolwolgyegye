-- 두 피드의 공통 필드 + 종류별 필수 필드.
begin;

create table public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  author_id uuid references public.profiles(user_id) on delete set null,
  kind text not null check (kind in ('space-rental', 'oneday-class')),
  title text not null check (char_length(btrim(title)) between 1 and 70),
  description text not null check (char_length(btrim(description)) between 1 and 2000),
  category text not null,
  price integer not null check (price between 0 and 10000000),
  capacity integer not null check (capacity between 1 and 1000),
  contact_phone text not null check (char_length(contact_phone) between 8 and 25 and contact_phone ~ '^[0-9+()[:space:]-]+$'),
  image_path text,
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'open' check (status in ('open', 'closed')),
  is_published boolean not null default true,
  schedule text,
  minimum_hours integer,
  starts_at timestamptz,
  duration_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feed_kind_fields check (
    (kind = 'space-rental'
      and category in ('모임·파티', '스터디·회의', '촬영·작업')
      and schedule is not null and char_length(btrim(schedule)) between 1 and 200
      and minimum_hours is not null and minimum_hours between 1 and 24
      and starts_at is null and duration_minutes is null)
    or
    (kind = 'oneday-class'
      and category in ('요리·베이킹', '공예·미술', '커피·음료')
      and starts_at is not null
      and duration_minutes is not null and duration_minutes between 15 and 1440
      and schedule is null and minimum_hours is null)
  )
);
create index feed_posts_store_idx on public.feed_posts(store_id);
create index feed_posts_author_idx on public.feed_posts(author_id);
create index feed_posts_feed_idx on public.feed_posts(kind, created_at desc) where is_published;
alter table public.feed_posts enable row level security;
revoke all on public.feed_posts from anon, authenticated;
grant select on public.feed_posts to anon, authenticated;
grant insert (store_id, author_id, kind, title, description, category, price, capacity, contact_phone, image_path, notes, status, is_published, schedule, minimum_hours, starts_at, duration_minutes) on public.feed_posts to authenticated;
grant update (title, description, category, price, capacity, contact_phone, image_path, notes, status, is_published, schedule, minimum_hours, starts_at, duration_minutes), delete on public.feed_posts to authenticated;
grant all on public.feed_posts to service_role;
create policy posts_public_read on public.feed_posts for select to anon, authenticated using (
  is_published and exists (select 1 from public.stores s where s.id = store_id and s.is_published)
);
create policy posts_owner_read on public.feed_posts for select to authenticated using (private.owns_store(store_id));
create policy posts_owner_insert on public.feed_posts for insert to authenticated with check (
  private.owns_store(store_id) and author_id = (select auth.uid())
);
create policy posts_owner_update on public.feed_posts for update to authenticated using (private.owns_store(store_id)) with check (private.owns_store(store_id));
create policy posts_owner_delete on public.feed_posts for delete to authenticated using (private.owns_store(store_id));
create trigger posts_updated before update on public.feed_posts for each row execute function private.touch_updated_at();

create table public.store_favorites (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);
create index store_favorites_store_idx on public.store_favorites(store_id);
create table public.post_favorites (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.store_favorites enable row level security;
alter table public.post_favorites enable row level security;
revoke all on public.store_favorites, public.post_favorites from anon, authenticated;
grant select, delete on public.store_favorites, public.post_favorites to authenticated;
grant insert (user_id, store_id) on public.store_favorites to authenticated;
grant insert (user_id, post_id) on public.post_favorites to authenticated;
grant all on public.store_favorites, public.post_favorites to service_role;
create index post_favorites_post_idx on public.post_favorites(post_id);
create policy store_favorites_read on public.store_favorites for select to authenticated using (user_id = (select auth.uid()));
create policy store_favorites_delete on public.store_favorites for delete to authenticated using (user_id = (select auth.uid()));
create policy store_favorites_insert on public.store_favorites for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.stores s where s.id = store_id and s.is_published)
);
create policy post_favorites_read on public.post_favorites for select to authenticated using (user_id = (select auth.uid()));
create policy post_favorites_delete on public.post_favorites for delete to authenticated using (user_id = (select auth.uid()));
create policy post_favorites_insert on public.post_favorites for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.feed_posts p join public.stores s on s.id = p.store_id
    where p.id = post_id and p.is_published and s.is_published
  )
);
commit;
