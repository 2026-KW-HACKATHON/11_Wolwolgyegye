# database 폴더 안내

우리 앱의 DB(Supabase)에 관한 파일을 모아 둔 곳입니다.
**여기에는 DB의 "모양"만 있고, 실제 가게·메뉴 같은 데이터는 Supabase 에만 있습니다.**
표가 서로 어떻게 이어지는지는 [schema.md](schema.md) 를 보세요.

## 폴더와 파일

```text
database/
├─ README.md            이 안내서
├─ schema.md            표 구조 그림 (어떤 표에 어떤 칸이 있는지)
├─ package.json         DB 검사 도구 설정 (npm test 로 실행)
├─ package-lock.json    위 도구의 버전 고정 (손대지 않음)
├─ supabase/
│  ├─ config.toml       내 컴퓨터에서 Supabase 를 띄울 때 쓰는 설정 (지금은 안 씀)
│  └─ migrations/       DB 모양을 만드는 SQL. 번호 순서대로 한 번씩 실행 (하는 일은 각 파일 맨 위 주석)
├─ scripts/
│  ├─ menu_excel_to_csv.py     팀원이 판독한 메뉴 엑셀 → DB 적재용 CSV
│  └─ partner_excel_to_csv.py  제휴매장 엑셀 → 제휴 혜택 CSV
├─ mock/
│  └─ seed_mock.sql     예시(가짜) 데이터 넣기
└─ tests/
   ├─ bootstrap.sql     검사용 가짜 Supabase 기본 틀 (실제 DB 에 실행 금지)
   ├─ database.test.mjs DB 모양·권한 검사 20개
   └─ mock.test.mjs     예시 데이터 넣기·지우기 검사 4개
```

## 파일별로 하는 일

### migrations — DB 모양 만들기
- Supabase 대시보드 → **SQL Editor** 에 파일 전체를 붙여 넣고 실행합니다.
- **번호 순서대로, 파일마다 한 번만** 실행합니다.
- 이미 실행한 파일은 고치지 않습니다. 바꿀 게 생기면 새 번호의 파일을 추가합니다.

### scripts/menu_excel_to_csv.py — 메뉴 엑셀 정리
팀원이 메뉴판 사진을 직접 판독한 엑셀(1행 제목, A~H열)을 DB 에 넣기 좋은 CSV 로 바꿉니다.

```powershell
pip install openpyxl
python database/scripts/menu_excel_to_csv.py "엑셀 경로.xlsx"
```

- 엑셀 옆에 `○○.csv`(넣을 데이터)와 `○○_분류검토.csv`(가게·구역마다 공통 분류가 맞는지 보는 표)가 생깁니다.
- 분류 이름 괄호 속 판독 메모(천원 단위 표기, 판독 불확실 …)는 지우고, 손님용 설명(곱빼기 +2000 …)은 남깁니다.
- 공통 분류는 구역 제목과 메뉴 이름으로 자동으로 정합니다. 틀린 것이 있으면 스크립트의 규칙(`SECTION_RULES`, `MENU_RULES`)을 고칩니다.

### mock/seed_mock.sql — 예시 데이터
화면을 확인하려고 넣는 가짜 데이터입니다. 이름 앞에 모두 `[예시]` 가 붙습니다.

| 하고 싶은 것 | SQL Editor 에서 |
|---|---|
| 넣기 / 새로 고치기 | `seed_mock.sql` 전체 실행 (예전 예시는 지우고 다시 넣음. 세일·수업 시간도 지금 기준으로 다시 맞춰짐) |
| 전부 지우기 | `delete from public.stores where is_mock;` |

- 예시 가게 14곳에 **서로 이어진** 데이터가 붙습니다: 메뉴 40 · 영업시간 98 · 마감세일 12 · 제휴 혜택 12 · 공간대여 12 · 원데이클래스 12 · 스탬프 10.
- 가게를 누르면 2차 탭에 그 가게의 메뉴·영업시간·세일·제휴·공간대여·클래스·스탬프가 아래로 이어서 나옵니다.
  여러 가지가 한꺼번에 붙어 있는 가게: **[예시] 골목 카페**, **[예시] 아침 빵집**, **[예시] 커피 랩**.
- 예시 표시는 가게 표 한 곳에만 있습니다. 나머지는 모두 가게에 딸려 있어서, 가게를 지우면 함께 지워집니다.
- 제휴사(광운대 단과대학 8곳)와 공간대여·클래스 분류는 실제로 계속 쓸 목록이라 지워지지 않습니다.
- 실제 DB 가 배포 사이트와 같은 DB 라서, 넣어 둔 동안은 배포 사이트에도 보입니다.

### tests — 내 컴퓨터에서 검사
`database` 폴더에서 아래를 실행합니다. 내 컴퓨터 안의 가짜 DB 로 검사하므로 실제 DB 는 건드리지 않습니다.

```powershell
npm ci     # 처음 한 번
npm test   # 검사 24개 실행
```

## 실제 가게 데이터는 어디서 오나

| 데이터 | 넣는 방법 |
|---|---|
| 가게 851곳 (월계1동 상가정보) | `frontend` 폴더에서 `npm run fetch:sbiz` → `npm run import:stores` (관리자 키 `SUPABASE_SECRET_KEY` 필요) |
| 메뉴 3,762개 (팀원이 메뉴판 사진 판독, 가게 94곳) | 엑셀 → `scripts/menu_excel_to_csv.py` → `frontend` 폴더에서 `npm run import:menus -- "CSV 경로"` (미리보기) → 같은 명령 끝에 `--apply` (관리자 키 필요). 가게 이름 연결이 안 되면 `frontend/scripts/import-menus.js` 의 `STORE_ALIASES` 에 상가업소번호를 적는다 |
| 메뉴·세일·공간대여 등 | 사장님 화면에서 |
| 제휴 혜택 | `frontend` 폴더에서 `npm run import:partner-benefits` (관리자 키 필요) |
| 가게 공개/숨김, 사장님 승인 | 관리자 화면(`/admin`)에서 |

## 지킬 것
- 관리자 키(`sb_secret_…`)는 `frontend/.env.local` 에만 두고, 앞에 `VITE_` 를 붙이지 않습니다. 채팅·git 에 올리지 않습니다.
- `tests/bootstrap.sql` 은 검사 전용입니다. 실제 DB 에 실행하지 않습니다.
