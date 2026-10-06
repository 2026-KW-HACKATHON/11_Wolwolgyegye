-- 일반 사용자가 등록하는 "내 단과대".
-- 단과대는 제휴사(partners) 표에 있으므로 그 행을 가리킨다. 비워 두면 등록하지 않은 것.
-- 사용자는 자기 프로필의 이 칸만 고칠 수 있다 (기존 profiles_self_update 정책을 그대로 쓴다).

alter table public.profiles
  add column college_id uuid references public.partners(id) on delete set null;

grant update (college_id) on public.profiles to authenticated;

comment on column public.profiles.college_id is '사용자가 등록한 소속 단과대학 (partners). 제휴 가게 화면의 기본 필터로 쓴다';
