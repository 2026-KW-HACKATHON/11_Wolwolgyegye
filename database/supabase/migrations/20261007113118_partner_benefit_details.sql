-- 실제 제휴 자료에는 금액·퍼센트 할인뿐 아니라 무료 메뉴, 토핑, 사이즈업처럼
-- 숫자로만 표현할 수 없는 혜택이 있다. 원문 혜택과 가져온 자료의 출처를 함께 보존한다.
begin;

alter table public.partner_benefits
  add column offer text not null default ''
    check (char_length(btrim(offer)) <= 1500),
  add column data_source text not null default ''
    check (char_length(data_source) <= 100),
  add column source_ref text
    check (char_length(source_ref) between 1 and 100);

alter table public.partner_benefits
  drop constraint partner_benefits_check,
  add constraint partner_benefits_value_check check (
    discount_amount is not null
    or discount_rate is not null
    or btrim(offer) <> ''
  ),
  add constraint partner_benefits_source_unique
    unique (store_id, data_source, source_ref);

comment on column public.partner_benefits.offer is '학생에게 표시할 실제 제휴 혜택 원문';
comment on column public.partner_benefits.data_source is '혜택을 가져온 원본 자료 이름';
comment on column public.partner_benefits.source_ref is '원본 안에서 혜택을 다시 찾기 위한 안정적인 행 식별자';

commit;
