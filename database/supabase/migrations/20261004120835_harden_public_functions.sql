-- 플랫폼 event trigger 함수가 Data API RPC로 노출되지 않도록 실행 권한을 닫는다.
begin;
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
    grant execute on function public.rls_auto_enable() to service_role;
  end if;
end;
$$;
commit;
