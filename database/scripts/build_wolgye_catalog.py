"""검토표에서 주민 지도용 공공데이터 스냅샷을 생성한다."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from import_wolgye_stores import stable_uuid


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "imports" / "wolgye1-stores-review.csv"
OUTPUT = ROOT.parent / "frontend" / "public" / "data" / "wolgye1-candidates.json"


def build_catalog(source: Path = SOURCE) -> dict:
    with source.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if len(rows) != 851:
        raise ValueError(f"기대했던 851개 가게가 아닙니다: {len(rows)}")
    stores = [
        {
            "id": stable_uuid(row["상가업소번호"]),
            "name": row["상호명"],
            "cuisine_type": row["업종"] or None,
            "address": row["주소"],
            "lat": float(row["위도"]),
            "lng": float(row["경도"]),
            "phone": "",
            "business_hours": "",
            "thumbnail_path": None,
            "supported_features": [],
        }
        for row in rows
    ]
    if len({store["id"] for store in stores}) != len(stores):
        raise ValueError("중복 업소번호가 있습니다.")
    return {"source": "소상공인시장진흥공단 상가(상권)정보", "as_of": "2026-06-30", "stores": stores}


if __name__ == "__main__":
    if OUTPUT.exists():
        raise SystemExit(f"기존 공개 목록을 덮어쓰지 않습니다: {OUTPUT}")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(build_catalog(), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"지도용 공공데이터 목록 생성: {OUTPUT}")
