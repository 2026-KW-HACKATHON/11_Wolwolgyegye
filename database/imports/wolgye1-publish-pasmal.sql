-- 팀의 2026년 9월 빠말 현장 인터뷰로 상호·위치·빵집 업종을 확인했다.
-- 공개 범위는 이 한 가게뿐이다. 나머지 공공데이터 후보 850곳은 비공개로 둔다.
begin;
do $$
declare changed_count integer;
begin
  update public.stores
  set cuisine_type = '베이커리', is_published = true
  where id = '592edcaa-4052-815a-fec1-42ee0868fb7d'
    and name = '빠말Pasmal'
    and address = '서울특별시 노원구 광운로 7'
    and owner_id is null
    and is_demo = false;
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception '빠말 대상 가게가 정확히 1건이 아닙니다. 공개 상태를 변경하지 않았습니다.';
  end if;
end $$;
commit;

select id, name, cuisine_type, address, is_published
from public.stores
where id = '592edcaa-4052-815a-fec1-42ee0868fb7d';
