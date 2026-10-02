"""소상공인시장진흥공단 CSV/ZIP에서 월계1동 가게 검토표와 SQL을 만든다.

사용 예: python database/scripts/import_wolgye_stores.py 원본.zip --out-dir database/imports
원본: https://www.data.go.kr/data/15083033/fileData.do
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import sys
import zipfile
from pathlib import Path


SOURCE = "semas-store"
REQUIRED = ("상가업소번호", "상호명", "시도명", "시군구명", "행정동명", "경도", "위도")
EXPORT_COLUMNS = ("상가업소번호", "상호명", "업종", "주소", "위도", "경도", "원본파일")


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def stable_uuid(store_number: str) -> str:
    digest = hashlib.md5(f"{SOURCE}:{store_number}".encode("utf-8")).hexdigest()
    return f"{digest[:8]}-{digest[8:12]}-{digest[12:16]}-{digest[16:20]}-{digest[20:]}"


def read_sources(path: Path):
    if zipfile.is_zipfile(path):
        # 공공데이터포털 ZIP의 파일명은 CP949일 수 있다.
        with zipfile.ZipFile(path, metadata_encoding="cp949") as archive:
            names = [name for name in archive.namelist() if name.lower().endswith(".csv") and not name.startswith("__MACOSX/")]
            if not names:
                raise ValueError("ZIP 안에 CSV 파일이 없습니다.")
            for name in names:
                # 전국 ZIP이라도 서울 파일만 열어 시간과 메모리를 아낀다.
                if "서울" not in name:
                    continue
                with archive.open(name) as raw, io.TextIOWrapper(raw, encoding="utf-8-sig", newline="") as stream:
                    yield name, csv.DictReader(stream)
    else:
        with path.open(encoding="utf-8-sig", newline="") as stream:
            yield path.name, csv.DictReader(stream)


def collect(path: Path) -> tuple[list[dict[str, str]], int]:
    matches: dict[str, dict[str, str]] = {}
    scanned = 0
    sources_found = 0
    for filename, reader in read_sources(path):
        sources_found += 1
        missing = set(REQUIRED) - set(reader.fieldnames or ())
        if missing:
            raise ValueError(f"{filename}: 필수 열이 없습니다: {', '.join(sorted(missing))}")
        for row in reader:
            scanned += 1
            if (row["시도명"].strip(), row["시군구명"].strip(), row["행정동명"].strip()) != ("서울특별시", "노원구", "월계1동"):
                continue
            store_number = row["상가업소번호"].strip()
            name = row["상호명"].strip()
            address = (row.get("도로명주소") or row.get("지번주소") or "").strip()
            category = (row.get("상권업종소분류명") or "").strip()
            try:
                lat, lng = float(row["위도"]), float(row["경도"])
            except (ValueError, TypeError):
                continue
            if not (store_number and name and address and 37.0 <= lat <= 38.0 and 126.0 <= lng <= 128.0):
                continue
            if len(name) > 100 or len(address) > 300:
                continue
            matches[store_number] = {
                "상가업소번호": store_number,
                "상호명": name,
                "업종": category,
                "주소": address,
                "위도": str(lat),
                "경도": str(lng),
                "원본파일": filename,
            }
    if sources_found == 0:
        raise ValueError("ZIP 안에서 서울 CSV를 찾지 못했습니다.")
    return sorted(matches.values(), key=lambda row: (row["상호명"], row["상가업소번호"])), scanned


def write_outputs(rows: list[dict[str, str]], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    review_path = out_dir / "wolgye1-stores-review.csv"
    sql_path = out_dir / "wolgye1-stores-import.sql"
    if review_path.exists() or sql_path.exists():
        raise FileExistsError("출력 파일이 이미 있습니다. 검토 데이터를 보존하기 위해 덮어쓰지 않습니다.")
    with review_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=EXPORT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    with sql_path.open("w", encoding="utf-8", newline="\n") as stream:
        stream.write("-- 출처: https://www.data.go.kr/data/15083033/fileData.do\n")
        stream.write("-- 공공 데이터 후보. 최신 영업 여부·메뉴·사진은 개별 확인 전까지 공개하지 않는다.\n")
        stream.write("-- 생성된 목록을 검토한 뒤 Supabase SQL Editor에서 실행한다. 재실행해도 기존 행은 수정하지 않는다.\n")
        stream.write("begin;\n")
        for row in rows:
            fields = [
                stable_uuid(row["상가업소번호"]),
                row["상호명"],
                row["업종"],
                row["주소"],
            ]
            stream.write(
                "insert into public.stores (id, name, cuisine_type, address, lat, lng, is_published, is_demo) values ("
                + ", ".join(sql_literal(value) for value in fields)
                + f", {row['위도']}, {row['경도']}, false, false) on conflict (id) do nothing;\n"
            )
        stream.write("commit;\n")
    print(f"월계1동 후보 {len(rows)}곳: {review_path}\nDB 가져오기 SQL: {sql_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="공공데이터포털에서 받은 서울 CSV 또는 전국 ZIP")
    parser.add_argument("--out-dir", type=Path, default=Path("database/imports"))
    args = parser.parse_args()
    if not args.input.is_file():
        parser.error(f"파일을 찾지 못했습니다: {args.input}")
    try:
        rows, scanned = collect(args.input)
        if not rows:
            raise ValueError(f"{scanned}행을 읽었지만 유효한 월계1동 가게가 없습니다. 원본 열과 기준일을 확인하세요.")
        write_outputs(rows, args.out_dir)
    except (ValueError, FileExistsError, zipfile.BadZipFile) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
