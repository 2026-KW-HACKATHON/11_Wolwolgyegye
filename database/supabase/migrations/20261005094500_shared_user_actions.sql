-- 브라우저 localStorage에만 있던 사용자 행동을 공유 DB로 옮긴다.
begin;

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
create policy sale_likes_self_read on public.sale_likes for select to authenticated using (user_id = (select auth.uid()));
create policy sale_likes_self_delete on public.sale_likes for delete to authenticated using (user_id = (select auth.uid()));
create policy sale_likes_self_insert on public.sale_likes for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.closing_sales s where s.id = sale_id and private.store_is_public(s.store_id)
  )
);

create function public.get_sale_like_counts(p_sale_ids uuid[])
returns table (sale_id uuid, like_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(array_length(p_sale_ids, 1), 0) > 500 then
    raise exception 'Too many sale ids' using errcode = '22023';
  end if;
  return query
  select l.sale_id, count(*)::bigint
  from public.sale_likes l
  join public.closing_sales s on s.id = l.sale_id
  where l.sale_id = any(coalesce(p_sale_ids, array[]::uuid[]))
    and private.store_is_public(s.store_id)
  group by l.sale_id;
end;
$$;
revoke all on function public.get_sale_like_counts(uuid[]) from public;
grant execute on function public.get_sale_like_counts(uuid[]) to anon, authenticated, service_role;

create table public.post_favorites (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  post_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index post_favorites_post_idx on public.post_favorites(post_id);
alter table public.post_favorites enable row level security;
revoke all on public.post_favorites from anon, authenticated;
grant select, delete on public.post_favorites to authenticated;
grant insert (user_id, post_id) on public.post_favorites to authenticated;
grant all on public.post_favorites to service_role;
create policy post_favorites_self_read on public.post_favorites for select to authenticated using (user_id = (select auth.uid()));
create policy post_favorites_self_delete on public.post_favorites for delete to authenticated using (user_id = (select auth.uid()));
create policy post_favorites_self_insert on public.post_favorites for insert to authenticated with check (
  user_id = (select auth.uid()) and (
    exists (select 1 from public.space_rentals r where r.id = post_id and r.is_published and private.store_is_public(r.store_id))
    or exists (select 1 from public.one_day_classes c where c.id = post_id and c.is_published and private.store_is_public(c.store_id))
  )
);

alter table public.space_rentals
  add column status text not null default 'open' check (status in ('open', 'closed'));
alter table public.one_day_classes
  add column status text not null default 'open' check (status in ('open', 'closed'));

commit;
