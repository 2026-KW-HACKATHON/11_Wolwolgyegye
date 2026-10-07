-- 회원 탈퇴: 로그인한 사용자가 자기 계정을 지운다.
-- auth.users 를 지우면 profiles 와 그에 딸린 찜·스탬프·사장님 신청은 함께 지워지고(on delete cascade),
-- 사장님 가게는 남긴 채 연결만 끊는다(stores.owner_id on delete set null → 다른 사장님이 다시 신청할 수 있다).
-- 관리자는 여기서 탈퇴하지 않는다 (관리자가 모두 사라지지 않도록, 관리자 명단에서 먼저 뺀 뒤 탈퇴).
begin;

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if private.is_admin(v_user_id) then
    raise exception 'Admins cannot delete their own account' using errcode = '42501';
  end if;
  delete from auth.users where id = v_user_id;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;
