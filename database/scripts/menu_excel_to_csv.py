"""팀원이 정리한 메뉴 엑셀을 DB 적재용 CSV 로 바꾼다.

엑셀 형식 (1행은 제목, 2행부터 데이터)
  A 식당명 | B 분류 | C 메뉴 | D 옵션/비고 | E 가격(원) | F 메뉴판 등록 | G 메뉴판 파일 | H 추출 방식(무시)

사용법
  pip install openpyxl
  python menu_excel_to_csv.py 메뉴.xlsx                # 메뉴.csv 로 저장
  python menu_excel_to_csv.py 메뉴.xlsx -o out.csv --sheet 시트1
"""

import argparse
import csv
import re
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

try:
    from openpyxl import load_workbook
except ImportError:
    sys.exit("openpyxl 이 필요합니다: pip install openpyxl")

OUTPUT_COLUMNS = [
    "store_name",          # 식당명
    "category",            # 분류 원문
    "section",             # 판독 메모를 뺀 구역 제목 -> store_menus.section
    "kind",                # 공통 분류 (KIND_LABELS) -> store_menus.kind
    "menu_name",           # 메뉴
    "description",         # 옵션/비고
    "price",               # 가격(원), 정수. 해석 못 하면 빈칸
    "price_raw",           # 가격 원문 (확인용)
    "menu_registered_on",  # 메뉴판 등록일 YYYY-MM-DD
    "menu_image",          # 메뉴판 파일
    "sort_order",          # 가게 안에서의 순서 (엑셀 순서)
    "source_row",          # 엑셀 행 번호 (오류 추적용)
]


def text(value):
    """셀 값을 앞뒤 공백·줄바꿈 정리된 문자열로."""
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return re.sub(r"\s+", " ", str(value)).strip()


def parse_price(value):
    """8000, '8,000', '8,000원' -> 8000. '시가', '8,000/9,000' 처럼 애매하면 None."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return int(value)
    digits = re.sub(r"[,\s원₩]", "", text(value))
    return int(digits) if digits.isdigit() else None


def parse_date(value):
    """datetime, '2026-10-01', '2026.10.1', '2026/10/01' -> '2026-10-01'."""
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    m = re.fullmatch(r"(\d{4})\D(\d{1,2})\D(\d{1,2})\D?", text(value))
    if not m:
        return None
    y, mo, d = map(int, m.groups())
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return None


# --- 분류 정리 -------------------------------------------------------------
# 엑셀 "분류"는 가게마다 메뉴판에 적힌 구역 제목이다. 괄호 안에는 손님용 설명(곱빼기 +2000)과
# 팀원 판독 메모(천원 단위 표기, 판독 불확실 …)가 섞여 있어서, 메모만 골라 지운다.
NOTE_WORDS = ("천원 단위", "환산", "판독", "사진", "메뉴판", "보정", "추정", "칠판",
              "입구", "간판", "벽면", "매장 앞", "표기", "최저가 기준")


def clean_section(raw):
    """'면류 (2023-10 메뉴판, 일부 판독 불확실)' -> '면류', '밥류 (곱빼기 +2000)' 는 그대로."""
    def keep_useful(m):
        parts = [p.strip() for p in re.split(r";|,(?!\d)|(?<!\d),", m.group(1))]  # 1,000 은 안 나눈다
        useful = [p for p in parts if p and not any(w in p for w in NOTE_WORDS)]
        if useful == parts:
            return m.group(0)  # 지울 메모가 없으면 원문 그대로
        return f" ({', '.join(useful)})" if useful else ""
    return re.sub(r"\s+", " ", re.sub(r"\s*\(([^()]*)\)", keep_useful, raw)).strip()


KIND_LABELS = {"main": "식사", "set": "세트", "side": "사이드", "extra": "추가·토핑",
               "drink": "음료", "alcohol": "주류", "dessert": "디저트"}

# 구역 제목(괄호 앞부분)으로 판단. 대소문자 무시.
SECTION_RULES = [
    ("alcohol", r"(?<!안)주류|술|소주|맥주|\bBEER\b|하이볼|HIGH ?BALL|와인|양주|증류주|칵테일|WHISKEY|TEQUILA|\bGIN\b|"
                r"DRAFT|주당"),
    ("drink", r"음료|마실거리|드링크|커피|COFFEE|(^|[\s/&,·])티($|[\s/&,·])|\bTEA\b|홍차|아이스티|에이드|\bADE\b|"
              r"스무디|주스|JUICE|BEVERAGE|DRINK|라떼|FRAPPE|BLENDED(?! WHISKEY)|COLD BREW|ESPRESSO|BREWING|"
              r"DECAFFEINE|SODA"),
    ("dessert", r"디저트|DESSERT|후식|도넛|케이크|쿠키|마들렌|휘낭시에|와플|젤라또|GELATO|ICE CREAM|아이스크림|"
                r"CHURROS|츄러스|베이커리|간식"),
    ("set", r"세트|셋트|\bSET\b|COMBO|콤보"),
    ("extra", r"토핑|사리|추가|옵션|OPTION|\bADD\b"),
    ("side", r"사이드|SIDE|곁들"),
    ("main", r"식사|메인|요리"),
]
# 메뉴 이름으로 판단. 구역 제목이 애매하거나(주류/음료) 가게 이름뿐일 때 쓴다. 위에서부터 검사.
MENU_RULES = [
    ("set", r"세트|셋트|\bset\b"),  # '곱창+순대+소주or음료' 같은 세트가 주류로 가지 않게 먼저
    ("alcohol", r"(?<!최)소주|맥주|생맥|막걸리|하이볼|와인|사케|청하|참이슬|처음처럼|진로|카스|테라|켈리|클라우드|"
                r"하이네켄|아사히|칭따오|버드와이저|호가든|코로나|위스키|칵테일|동동주|복분자(?!뱅쇼)|매화수|고량주|연태|"
                r"이과두|사와|한라산|산사춘|매취순|백세주"),
    ("drink", r"콜라|사이다|환타|스프라이트|탄산|음료|생수|웰치스|밀키스|토닉|아메리카노|라떼|에스프레소|에이드|"
              r"주스|쥬스|스무디|쉐이크|치노|아이스티|홍차|녹차|식혜|수정과|커피|핫초코|히비스커스|캐모마일|"
              r"카모마일|얼그레이|차(\(.*\))?$"),
    ("dessert", r"와플|케이크|케익|도넛|마카롱|쿠키|휘낭시에|마들렌|아이스크림|젤라또|빙수|츄러스|티라미수|푸딩|샤베트"),
    ("extra", r"^(?!.*\+).*(공기밥|공깃밥|사리|추가)"),  # '라면+공기밥' 은 추가가 아니라 식사
]
BEVERAGE = {"drink", "alcohol"}
# 음료·주류·디저트로 분류됐어도 이름이 식사이면 식사 (고깃집 '후식' 냉면, 사케동, 녹차비빔냉면 …)
MEAL = r"냉면|찌개|국수|볶음밥|공기밥|공깃밥|돌솥밥|계란찜|라면|우동|덮밥|파스타|떡볶이|찜"
# 구역 제목에 분류가 여러 개 걸렸는데 메뉴 이름으로도 못 정하면, 음료·주류보다 음식 쪽을 고른다
FALLBACK_ORDER = ["main", "set", "side", "extra", "dessert", "drink", "alcohol"]


def classify(section, menu_name):
    title = section.split("(")[0]  # 괄호 속 설명('닭다리 추가 +2,500원' 등)에 끌려가지 않게
    hits = [k for k, pat in SECTION_RULES if re.search(pat, title, re.IGNORECASE)]
    by_name = next((k for k, pat in MENU_RULES if re.search(pat, menu_name, re.IGNORECASE)), None)
    if len(hits) == 1:
        kind = hits[0]
        if kind in BEVERAGE and by_name in BEVERAGE:  # '마실거리' 칸의 소주 -> 주류
            kind = by_name
    elif hits:
        kind = by_name or min(hits, key=FALLBACK_ORDER.index)
    else:
        kind = by_name or "main"
    if kind in ("drink", "alcohol", "dessert") and re.search(MEAL, menu_name):
        kind = "main"
    return kind


def merged_values(ws):
    """병합 셀은 왼쪽 위 칸에만 값이 있으므로, 병합 범위 전체에 그 값을 채운다."""
    filled = {}
    for rng in ws.merged_cells.ranges:
        top_left = ws.cell(rng.min_row, rng.min_col).value
        for row in range(rng.min_row, rng.max_row + 1):
            for col in range(rng.min_col, rng.max_col + 1):
                filled[(row, col)] = top_left
    return filled


def convert(xlsx_path, sheet_name=None):
    wb = load_workbook(xlsx_path, data_only=True)  # 수식은 계산된 값으로
    ws = wb[sheet_name] if sheet_name else wb.worksheets[0]
    merged = merged_values(ws)

    def cell(row, col):
        return merged.get((row, col), ws.cell(row, col).value)

    rows, warnings = [], []
    order = Counter()

    for r in range(2, ws.max_row + 1):
        store, category, menu, desc, price_cell, reg, _ = (cell(r, c) for c in range(1, 8))
        if all(text(v) == "" for v in (store, category, menu, desc, price_cell, reg)):
            continue  # 빈 줄

        store, category, menu = text(store), text(category), text(menu)
        price = parse_price(price_cell)
        reg_date = parse_date(reg)

        image_cell = ws.cell(r, 7)
        image = text(cell(r, 7))
        if image_cell.hyperlink and image_cell.hyperlink.target:
            image = image_cell.hyperlink.target

        if not store:
            warnings.append(f"{r}행: 식당명 없음")
        if not menu:
            warnings.append(f"{r}행: 메뉴명 없음")
        if price is None:
            warnings.append(f"{r}행: 가격 해석 불가 ({text(price_cell)!r})")
        if text(reg) and reg_date is None:
            warnings.append(f"{r}행: 등록일 해석 불가 ({text(reg)!r})")

        order[store] += 1
        section = clean_section(category)
        rows.append({
            "store_name": store,
            "category": category,
            "section": section,
            "kind": classify(section, menu),
            "menu_name": menu,
            "description": text(desc),
            "price": "" if price is None else price,
            "price_raw": text(price_cell),
            "menu_registered_on": reg_date or "",
            "menu_image": image,
            "sort_order": order[store],
            "source_row": r,
        })

    return rows, warnings


def resolve_input(path):
    """확장자를 빼먹고 입력해도(탐색기는 기본으로 확장자를 숨긴다) 파일을 찾는다."""
    if not path.exists():
        for suffix in (".xlsx", ".xlsm", ".xls"):
            candidate = path.with_name(path.name + suffix)
            if candidate.exists():
                path = candidate
                break
        else:
            sys.exit(f"파일을 찾을 수 없습니다: {path}")
    if path.suffix.lower() == ".xls":
        sys.exit("옛날 .xls 형식입니다. 엑셀에서 '다른 이름으로 저장' -> .xlsx 로 바꾼 뒤 다시 실행하세요.")
    return path


def main():
    parser = argparse.ArgumentParser(description="메뉴 엑셀 -> CSV")
    parser.add_argument("xlsx", type=Path)
    parser.add_argument("-o", "--output", type=Path)
    parser.add_argument("--sheet", help="시트 이름 (기본: 첫 번째 시트)")
    args = parser.parse_args()
    args.xlsx = resolve_input(args.xlsx)

    output = args.output or args.xlsx.with_suffix(".csv")
    rows, warnings = convert(args.xlsx, args.sheet)

    # utf-8-sig: 엑셀에서 열어도 한글이 깨지지 않는다
    with output.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    # 분류 검토표: 가게 + 구역 + 공통 분류마다 한 줄, 예시 메뉴 3개
    review = output.with_name(output.stem + "_분류검토.csv")
    groups = {}
    for row in rows:
        key = (row["store_name"], row["section"], row["kind"])
        groups.setdefault(key, []).append(row["menu_name"])
    with review.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["가게", "구역 제목", "공통 분류", "메뉴 수", "예시 메뉴"])
        for (store, section, kind), menus in groups.items():
            writer.writerow([store, section, KIND_LABELS[kind], len(menus), ", ".join(menus[:3])])

    stores = Counter(row["store_name"] for row in rows)
    kinds = Counter(row["kind"] for row in rows)

    print(f"저장: {output}")
    print(f"분류 검토표: {review}")
    print(f"메뉴 {len(rows)}개 / 가게 {len(stores)}곳 / 구역 {len({(r['store_name'], r['section']) for r in rows})}개")
    print("\n[공통 분류]")
    for kind, label in KIND_LABELS.items():
        print(f"  {label}: {kinds[kind]}")
    if warnings:
        print(f"\n[확인 필요 {len(warnings)}건]")
        for w in warnings:
            print(f"  {w}")


if __name__ == "__main__":
    main()
