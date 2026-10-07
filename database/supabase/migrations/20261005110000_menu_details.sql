-- =====================================================================
-- 메뉴 상세 칸 추가. 2026-10-05
--
-- 팀원이 메뉴판 사진을 직접 판독한 엑셀(가게 109곳, 메뉴 4,413개)을 넣기 위해
-- store_menus 에 칸을 더한다. 기존 칸은 그대로라 지금 화면·검사는 영향 없다.
--
--   section     메뉴판 구역 제목. 가게마다 제각각 (예: 면류, COFFEE, 밥류 (곱빼기 +2000))
--               가게 화면에서 메뉴를 묶어 보여줄 때 쓴다.
--   kind        공통 분류. 가게를 가로지르는 필터·통계용
--               main 식사 / set 세트 / side 사이드 / extra 추가·토핑 /
--               drink 음료 / alcohol 주류 / dessert 디저트
--   description 옵션·비고 (예: HOT, ICE 변경가능)
--   board_date  메뉴판 등록일. 한 가게에 날짜가 다른 메뉴판이 여러 장일 수 있어 메뉴마다 둔다
--   board_image 메뉴판 사진 파일 이름 (출처 확인용)
-- =====================================================================
begin;

alter table public.store_menus
  add column section text not null default '' check (char_length(section) <= 200),
  add column kind text check (kind in ('main', 'set', 'side', 'extra', 'drink', 'alcohol', 'dessert')),
  add column description text not null default '' check (char_length(description) <= 300),
  add column board_date date,
  add column board_image text not null default '' check (char_length(board_image) <= 300);

comment on column public.store_menus.section is '메뉴판 구역 제목 (가게마다 다름)';
comment on column public.store_menus.kind is '공통 분류: main 식사 / set 세트 / side 사이드 / extra 추가·토핑 / drink 음료 / alcohol 주류 / dessert 디저트';
comment on column public.store_menus.description is '옵션·비고';
comment on column public.store_menus.board_date is '메뉴판 등록일';
comment on column public.store_menus.board_image is '메뉴판 사진 파일 이름';

create index store_menus_kind_idx on public.store_menus(kind);

commit;
