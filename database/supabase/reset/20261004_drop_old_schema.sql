-- =====================================================================
-- 이전 구조(2026-09-26 SQL 6개)의 남은 부분을 지우는 일회용 SQL. 실제 Supabase 에서 한 번만 실행한다.
--
-- 순서: SQL Editor 에서 ① 이 파일 전체 실행
--       → ② migrations/20261004000100_schema.sql 전체 실행
--       → ③ frontend 에서 npm run import:stores (가게 다시 넣기)
--
-- 지우는 것: 이전 앱 표(남아 있는 profiles, stores 포함), 이전 함수, 가입 트리거, private 스키마, 사진 저장소 권한 규칙.
-- 남는 것: 로그인 계정(auth.users) — Supabase Auth 소관이라 건드리지 않는다. 프로필은 ②가 다시 만든다.
--          사진 저장소(store-media) 버킷 — ②가 같은 이름으로 다시 설정한다.
-- 이미 지운 것은 "if exists" 라 건너뛴다.
-- 안전장치: 새 구조(store_types 표)가 이미 있으면 아무것도 지우지 않고 멈춘다. ② 이후에 실수로 다시 실행해도 안전하다.
-- 2026-10-04 확인: 메뉴·게시글·세일·제휴·룰렛 0건, 사장님 연결 가게 0건.
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.store_types') is not null then
    raise exception '새 구조가 이미 적용돼 있습니다. 이 초기화 파일은 실행하지 않습니다.';
  end if;
end;
$$;

-- 사진 저장소 권한 규칙 (stores 를 가리켜서 stores 가 안 지워지는 원인)
drop policy if exists store_media_owner_select on storage.objects;
drop policy if exists store_media_owner_insert on storage.objects;
drop policy if exists store_media_owner_update on storage.objects;
drop policy if exists store_media_owner_delete on storage.objects;

-- 가입할 때 프로필을 만드는 트리거 (profiles 에 쓰는 함수를 부른다)
drop trigger if exists wolwolgyegye_auth_profile_created on auth.users;

-- 이전 공개 함수
drop function if exists public.get_sale_like_counts(uuid[]);
drop function if exists public.apply_stamp_change(uuid, uuid, integer, uuid, text);
drop function if exists public.review_owner_application(uuid, text, uuid, text);

-- 이전 표 (손으로 지운 것은 건너뛴다)
drop table if exists
  public.stamp_transactions,
  public.user_stamps,
  public.stamp_policies,
  public.sale_likes,
  public.closing_sale_items,
  public.closing_sales,
  public.partner_benefits,
  public.roulette_store_links,
  public.post_favorites,
  public.store_favorites,
  public.feed_posts,
  public.store_menus,
  public.owner_applications,
  public.stores,
  public.profiles
cascade;

-- 이전 내부 함수 묶음 (touch_updated_at, owns_store, create_auth_profile, has_verified_email_login)
drop schema if exists private cascade;

commit;

-- 확인: 아래 결과가 0 이면 ②를 실행해도 된다.
select count(*) as remaining_tables
from information_schema.tables
where table_schema = 'public' and table_name in ('profiles', 'stores');
