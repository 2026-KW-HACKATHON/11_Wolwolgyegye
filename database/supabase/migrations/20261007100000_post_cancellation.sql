-- 공간대여·원데이클래스 등록 취소.
-- 사장님이 취소하면 글을 비공개(is_published = false)·마감(status = closed)으로 바꾸고, 취소 시각과 사유를 남긴다.
-- 사유는 사장님 센터의 "운영 중인 소식"에서 다시 볼 수 있다. 쓰기 권한은 기존 사장님 정책(owns_store)을 그대로 따른다.
begin;

alter table public.space_rentals
  add column cancelled_at timestamptz,
  add column cancel_reason text not null default '' check (char_length(cancel_reason) <= 500),
  add constraint space_rentals_cancel_reason check (cancelled_at is null or char_length(btrim(cancel_reason)) >= 1);

alter table public.one_day_classes
  add column cancelled_at timestamptz,
  add column cancel_reason text not null default '' check (char_length(cancel_reason) <= 500),
  add constraint one_day_classes_cancel_reason check (cancelled_at is null or char_length(btrim(cancel_reason)) >= 1);

commit;
