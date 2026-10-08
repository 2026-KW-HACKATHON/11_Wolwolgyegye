# 스탬프 · 제휴 가게 화면

## 스탬프 (`/coupon`)

- **나의 스탬프 지갑**: 모은 도장 수, 사용 가능한 스탬프, 적립 중인 가게 수를 맨 위에 보여준다. 선물을 받을 수 있는 가게(없으면 선물까지 가장 가까운 가게)를 바로 열 수 있다.
- **목록**: 검색(가게·업종·선물), 상태별 보기(전체·사용 가능·모으는 중·찜한 가게), 정렬(선물 가까운순·가까운 가게순·최근 적립순·이름순).
- **적립판** (`/coupon?store=ID`): 도장마다 적립 날짜가 찍힌다. 선물 진행률, 적립 내역(`stamp_transactions`), 가게 정보, 적립·교환 안내가 있다.
- **적립 코드 → 도장**: 결제할 때 6자리 코드를 보여주고 사장님이 사장님 화면에 입력하면 적립된다. 코드는 3분 동안 한 번만 쓸 수 있다.
- **선물 교환권**: 다 모으면 교환권을 보여준다.

## 제휴 가게 (`/partner-stores`)

- **내 소속**: 단과대 칩으로 고르고, 고른 칩에 해당 가게 수가 보인다. 선택은 이 기기에만 저장한다.
- **바로 연결**: `/partner-stores?store=ID`로 들어오면 그 가게를 맨 위에 둔다. 스탬프 적립판에서 이 화면으로 오는 링크가 있다.

## 바꾼 파일

- `features/coupon/*`: 화면을 새로 만들었다. `StampList`, `StampDetail`, `StampSeal`, `constants`를 추가했다.
- `features/partner-stores/PartnerStoresPage.tsx`, `features/partner-stores/partner.css`
- 새 공용 파일: `shared/ExtraIcon.tsx`
- 다른 팀원 폴더, `core` 규격, 공용 `icons.ts`·`theme.css`는 바꾸지 않았다. 색은 `theme.css` 토큰을 화면별 변수(`--st-*`, `--ps-*`)로 연결해서 쓴다.
