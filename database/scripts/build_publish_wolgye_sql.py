"""검토표의 851개 월계1동 후보만 공개하는, 재실행 가능한 SQL을 생성한다."""

from __future__ import annotations

import csv
from pathlib import Path

from import_wolgye_stores import sql_literal, stable_uuid


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "imports" / "wolgye1-stores-review.csv"
OUTPUT = ROOT / "imports" / "wolgye1-publish-all-candidates.sql"
EXPECTED_ROWS = 851


def build_sql(source: Path = SOURCE) -> str:
    with source.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if len(rows) != EXPECTED_ROWS:
        raise ValueError(f"후보 수가 {EXPECTED_ROWS}곳이 아닙니다: {len(rows)}")
    ids = [stable_uuid(row["상가업소번호"]) for row in rows]
    if len(set(ids)) != EXPECTED_ROWS:
        raise ValueError("중복 상가업소번호가 있습니다.")
    if any(not row["상호명"].strip() or not row["주소"].strip() for row in rows):
        raise ValueError("상호명 또는 주소가 비어 있습니다.")

    values = ",\n".join(
        "  (" + ", ".join((
            sql_literal(store_id) + "::uuid",
            sql_literal(row["상호명"]),
            sql_literal(row["주소"]),
        )) + ")"
        for store_id, row in zip(ids, rows, strict=True)
    )
    return f"""-- 2026-06 공공데이터 후보 {EXPECTED_ROWS}곳. 현재 영업 여부는 미확인이다.
-- 이 파일을 전체 실행해야 한다. 선택된 일부 문장만 실행하지 않는다.
-- ID·상호·주소가 모두 일치하고 사장님 소유가 없는 후보만 공개한다.
begin;
create temp table wolgye_publish_candidates (id uuid primary key, name text not null, address text not null) on commit drop;
insert into wolgye_publish_candidates (id, name, address) values
{values};

do $$
declare matched_count integer;
begin
  select count(*) into matched_count
  from wolgye_publish_candidates c
  join public.stores s on s.id = c.id and s.name = c.name and s.address = c.address
  where s.owner_id is null and s.is_demo = false;
  if matched_count <> {EXPECTED_ROWS} then
    raise exception '후보 851곳 중 %곳만 정확히 일치합니다. 공개하지 않았습니다.', matched_count;
  end if;
end $$;

update public.stores s
set is_published = true
from wolgye_publish_candidates c
where s.id = c.id and s.name = c.name and s.address = c.address
  and s.owner_id is null and s.is_demo = false and s.is_published = false;

commit;
"""


if __name__ == "__main__":
    if OUTPUT.exists():
        raise SystemExit(f"기존 SQL을 덮어쓰지 않습니다: {OUTPUT}")
    OUTPUT.write_text(build_sql(), encoding="utf-8", newline="\n")
    print(f"공개 SQL 생성: {OUTPUT}")
