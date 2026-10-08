-- 사장님이 자기 가게의 스탬프 혜택(스탬프판)을 없앨 수 있게 한다.
-- 행 범위는 기존 사장님 정책(stamp_policies_owner, owns_store)을 그대로 따른다.
-- 지우면 손님들이 모은 스탬프(user_stamps)와 이력(stamp_transactions)도 함께 지워진다 (on delete cascade).
begin;

grant delete on public.stamp_policies to authenticated;

commit;
