import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type WheelEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ALL_PANELS, DEFAULT_LANDING_PATH, OWNER_PORTRAIT_BAR_IDS, PORTRAIT_BAR_IDS, USER_PANEL } from '../../core/categories/categories';
import type { Category, PanelMeta } from '../../core/categories/categoryTypes';
import { MAP_FILTERS, subCategoryById } from '../../core/categories/subCategories';
import { fetchMapStores, floorLabel, type MapStore, type MapStoreData } from '../../core/supabase/stores';
import { useVisibleCategories } from '../../core/categories/useVisibleCategories';
import { useLayoutMode } from '../../core/device/LayoutModeContext';
import { panelAxis, TOUCH_PRIMARY_QUERY } from '../../core/device/layoutMode';
import { fetchStores, fetchStoresByIds } from '../../core/source/storeSource';
import { useAuth } from '../../core/auth/AuthContext';
import { distanceMeters } from '../../core/utils/geo';
import { useActivePath } from '../../core/router/useActivePath';
import type { CategorySupport, GeoPoint, Store } from '../../core/types/place';
import Icon from '../../shared/Icon';
import MainMap, { type MainMapHandle, type MapInsets } from '../../shared/map/MainMap';
import { usePalette } from '../../core/theme/palette';
import { MAP_CENTER } from '../../shared/map/vworld/mapExtent';
import { useToast } from '../../shared/toast/ToastContext';
import AllMenu from '../AllMenu/AllMenu';
import CategoryNav from '../CategoryNav/CategoryNav';
import KeepAlivePages from '../KeepAlivePages/KeepAlivePages';
import MapPlaceList, { type MapListItem } from '../MapPlaceList/MapPlaceList';
import SecondaryPanel, { type SecondaryPlace } from '../SecondaryPanel/SecondaryPanel';
import SubCategoryList from '../SubCategories/SubCategoryList';
import type { PanelState } from '../SwipePanel/SwipePanel';
import UserButton from '../UserButton/UserButton';
import { ShellContext, type SecondaryFocus, type ShellApi } from './ShellContext';
import './AppShell.css';

/** 이 카테고리를 열면 지도에는 그 카테고리와 관련된 가게 핀만 보여준다 (상가정보 핀은 숨김) */
const FEATURE_PANEL_IDS = new Set(['space-rental', 'oneday-class', 'closing-sale', 'partner-stores', 'roulette', 'coupon']);

/** 지도에 표시할 가게: 가게가 지원하는 카테고리면 그 가게만, 아니면(동네 소식·유저) 전체 */
function storesForPanel(stores: Store[], panelId: string): Store[] {
  const key = panelId as keyof CategorySupport;
  const matched = stores.filter((store) => store.supports[key]);
  if (FEATURE_PANEL_IDS.has(panelId)) return matched;
  return matched.length > 0 ? matched : stores;
}

/** 카테고리 가게 → 2차 탭 요약 */
function storeToSecondary(store: Store): SecondaryPlace {
  return {
    id: store.id,
    name: store.name,
    category: store.cuisineType ?? '',
    address: store.address,
    location: store.location,
    facts: [{ label: '전화', value: store.phone }].filter((f) => f.value), // 영업시간은 2차 탭 아래쪽에 요일별로 나온다
  };
}

/** 지도 가게(DB) → 2차 탭 요약 */
function placeToSecondary(place: MapStore): SecondaryPlace {
  return {
    id: place.id,
    name: place.name,
    category: [subCategoryById(place.typeId)?.label, place.industry].filter(Boolean).join(' · '),
    address: place.address,
    location: { lat: place.lat, lng: place.lng },
    facts: [
      { label: '층', value: floorLabel(place.floor) },
      { label: '건물', value: place.buildingName },
      { label: '전화', value: place.phone },
    ].filter((f) => f.value),
  };
}

/** PC 에서는 손가락으로 밀 수 없으므로, 마우스 휠(세로)로 그 외 카테고리 한 줄을 옆으로 넘긴다 */
function scrollBarByWheel(event: WheelEvent<HTMLElement>) {
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.currentTarget.scrollLeft += event.deltaY;
}

const NO_INSETS: MapInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** 열린 가게 창(2차 탭)을 주소에 남기는 쿼리 이름 (예: /recommend?place=가게ID). store 는 스탬프·제휴 화면이 쓰고 있다 */
const PLACE_PARAM = 'place';
/** 가게 창을 열면서 새로 쌓은 기록인지 (history.state.usr 에 둔다). 그렇다면 닫을 때 뒤로가기로 그 기록을 걷어낸다 */
type PlaceHistoryState = { placePushed?: boolean } | null;

/** 지금 브라우저 주소에 place 만 바꾼 주소. 같은 렌더 안에서 다른 화면이 쿼리를 바꿨을 수 있어 window.location 을 읽는다 */
function urlWithPlace(id: string | null): string {
  const params = new URLSearchParams(window.location.search);
  if (id) params.set(PLACE_PARAM, id);
  else params.delete(PLACE_PARAM);
  const search = params.toString();
  return `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
}
/** 지도 검색창이 보는 글: 가게 이름 · 업종 · 주소 */
const storeSearchText = (store: Store) => [store.name, store.cuisineType ?? '', store.address].join(' ').toLocaleLowerCase();
const placeSearchText = (place: MapStore) => [place.name, subCategoryById(place.typeId)?.label ?? '', place.industry, place.address].join(' ').toLocaleLowerCase();
const matchesSearch = (text: string, term: string) => !term || text.includes(term);

/** 검색 결과로 지도를 옮길 때의 최소 줌. 18 까지는 가까운 가게 핀이 묶여 보여서, 가게 하나가 따로 보이는 19 */
const SEARCH_RESULT_ZOOM = 19;

/**
 * 가게가 검색어와 얼마나 맞는지 (작을수록 가까움). 이름이 맞는 가게를 먼저 본다:
 * 이름이 똑같음 → 이름 앞부분 → 띄어쓴 단어의 앞부분 → 이름 어딘가 → 업종·주소에만 있음. 안 맞으면 -1
 */
function searchRank(name: string, text: string, term: string): number {
  const n = name.toLocaleLowerCase();
  if (n === term) return 0;
  if (n.startsWith(term)) return 1;
  if (n.split(/\s+/).some((word) => word.startsWith(term))) return 2;
  if (n.includes(term)) return 3;
  return text.includes(term) ? 4 : -1;
}

/** 검색어에 가장 맞는 가게. 맞는 정도가 같으면 from 에서 가까운 곳 */
function bestSearchResult<T extends { name: string; text: string; point: GeoPoint }>(items: T[], term: string, from: GeoPoint): T | null {
  let best: { item: T; rank: number; distance: number } | null = null;
  for (const item of items) {
    const rank = searchRank(item.name, item.text, term);
    if (rank < 0) continue;
    const distance = distanceMeters(from, item.point);
    if (!best || rank < best.rank || (rank === best.rank && distance < best.distance)) best = { item, rank, distance };
  }
  return best?.item ?? null;
}

/**
 * 앱 셸: 지도를 뒤에 깔고, 그 위에 카테고리별 1차 탭을 올린다.
 *
 * - portrait (모바일·태블릿 세로) : [지도 + 1차 탭(아래→위) + 왼쪽 위 전체 메뉴 버튼] / [하단 카테고리 바(주요 4개, 고정)]
 * - mobile-landscape (모바일 가로) : [지도 + 1차 탭(우→좌)] [우측 카테고리 바 + 최하단 유저]
 * - wide (태블릿 가로·PC)          : [지도 + 1차 탭(우→좌, 눌러서 닫기/열기만)] [우측 카테고리 바(고정) + 맨 아래 유저]
 *
 * 지도 버튼(내 위치)은 항상 "탭에 가려지지 않은 지도"의 우측 하단에 붙는다.
 * 그 기준이 되는 가림 크기는 .app-stage 의 CSS 변수(--inset-*)로 관리한다.
 */
export default function AppShell() {
  const mode = useLayoutMode();
  const axis = panelAxis(mode);
  const navigate = useNavigate();
  const { search } = useLocation();
  const urlPlaceId = new URLSearchParams(search).get(PLACE_PARAM);
  const activePath = useActivePath();
  const categories = useVisibleCategories();
  const showToast = useToast();
  const active = ALL_PANELS.find((p) => p.path === activePath) ?? null;
  const activeId = active?.id ?? null;
  /** 없는 경로면 지도 영역을 그리지 않고 기본 화면으로 보낸다 */
  const hasStage = active !== null;

  const stageRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MainMapHandle>(null);
  const palette = usePalette();
  const secondaryRef = useRef<HTMLElement>(null);
  const autoLocateRequestedRef = useRef(false);
  /** 마지막으로 확인한 내 위치 (가게 검색에서 가까운 가게를 고르는 기준). 모르면 월계1동 기준점 */
  const myLocationRef = useRef<GeoPoint>(MAP_CENTER);
  /** 지도를 이미 옮긴 검색어 (엔터 뒤 키보드가 닫히며 한 번 더 옮기지 않도록) */
  const searchedTermRef = useRef('');
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [panelStates, setPanelStates] = useState<Record<string, PanelState>>({});
  const [subId, setSubId] = useState<string | null>(null);
  const [storeQuery, setStoreQuery] = useState('');
  const [mapData, setMapData] = useState<MapStoreData | null>(null);
  const [categoryStores, setCategoryStores] = useState<Store[]>([]);
  /** 가게 목록 두 가지를 다 받아 봤는지 (실패해도 true). 주소로 들어온 가게는 이 뒤에 찾아서 연다 */
  const [storesLoaded, setStoresLoaded] = useState({ category: false, map: false });
  const [mapStoreIds, setMapStoreIds] = useState<string[] | null>(null);
  /** 화면이 mapStoreIds 와 함께 넘긴 가게 정보 (카테고리 가게 목록에 없는 가게도 핀을 찍는다) */
  const [mapExtraStores, setMapExtraStores] = useState<Store[]>([]);
  // 사장님 본인 가게: 가게 관리 탭 지도에 '내 가게' 핀으로 눈에 띄게 찍는다 (글이 없어 카테고리 가게 목록에 없어도)
  const { ownedStores } = useAuth();
  const ownedKey = ownedStores.map((store) => store.id).join(',');
  const [myStores, setMyStores] = useState<Store[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!ownedKey) { setMyStores([]); return; }
    const ids = ownedKey.split(',');
    void fetchStoresByIds(ids).then((found) => { if (!cancelled) setMyStores(ids.flatMap((id) => found.get(id) ?? [])); });
    return () => { cancelled = true; };
  }, [ownedKey]);
  const limitMapStores = useCallback((storeIds: string[] | null, stores: Store[] = []) => {
    setMapStoreIds(storeIds);
    setMapExtraStores(stores);
  }, []);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  /** 2차 탭에 연 지도 가게 (카테고리 가게와 동시에 열리지 않는다) */
  const [selectedPlace, setSelectedPlace] = useState<MapStore | null>(null);
  /** 2차 탭을 1차 탭에서 열었을 때 처음 보여줄 카테고리(항목). seq 는 같은 곳을 다시 눌러도 스크롤하도록 */
  const [focus, setFocus] = useState<(SecondaryFocus & { seq: number }) | null>(null);
  const [locating, setLocating] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // 지도 영역 크기 (1차 탭 크기 계산용)
  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasStage]);

  // 화면 배치가 바뀌면 이전 방향의 가림 값을 지운다 (새 방향 값은 탭이 다시 알려준다)
  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    node.style.setProperty('--inset-bottom', '0px');
    node.style.setProperty('--inset-right', '0px');
  }, [axis]);

  // 2차 탭이 좌측에 열리면 그만큼을 왼쪽 가림으로 기록한다
  const selectedStore = categoryStores.find((store) => store.id === selectedStoreId) ?? mapExtraStores.find((store) => store.id === selectedStoreId) ?? myStores.find((store) => store.id === selectedStoreId) ?? null;
  const secondaryPlace = useMemo(() => {
    if (selectedPlace) return placeToSecondary(selectedPlace);
    if (selectedStore) return storeToSecondary(selectedStore);
    // 카테고리 가게 목록에 아직 없는 가게면(불러오는 중 등) 이름·주소는 2차 탭이 DB 에서 읽어 채운다
    if (selectedStoreId) return { id: selectedStoreId, name: '', category: '', address: '', facts: [] };
    return null;
  }, [selectedPlace, selectedStore, selectedStoreId]);
  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const width = secondaryPlace && axis === 'x' ? (secondaryRef.current?.offsetWidth ?? 0) + 12 : 0;
    node.style.setProperty('--inset-left', `${width}px`);
  }, [secondaryPlace, axis, stage]);

  // 다른 카테고리로 오면, 닫혀 있던 탭은 반쯤 열어서 내용을 보여준다
  useEffect(() => {
    if (!activeId) return;
    limitMapStores(null);
    setPanelStates((prev) => (prev[activeId] === 'closed' ? { ...prev, [activeId]: 'half' } : prev));
  }, [activeId, limitMapStores]);

  const reportVisible = useCallback((size: number) => {
    stageRef.current?.style.setProperty(axis === 'y' ? '--inset-bottom' : '--inset-right', `${size}px`);
  }, [axis]);

  const getInsets = useCallback((): MapInsets => {
    const node = stageRef.current;
    if (!node) return NO_INSETS;
    const css = getComputedStyle(node);
    const read = (name: string) => parseFloat(css.getPropertyValue(name)) || 0;
    // 세로 화면: 가게 정보(2차 탭)는 아래 시트라, 열려 있으면 그 높이만큼 아래가 가려진다
    const sheet = secondaryRef.current;
    const sheetBottom = sheet?.dataset.layout === 'portrait' ? sheet.offsetHeight : 0;
    return { top: 0, right: read('--inset-right'), bottom: Math.max(read('--inset-bottom'), sheetBottom), left: read('--inset-left') };
  }, []);

  const setPanelState = useCallback((id: string, state: PanelState) => {
    setPanelStates((prev) => ({ ...prev, [id]: state }));
  }, []);

  /** 카테고리(또는 유저) 버튼: 다른 탭이면 이동, 지금 탭이면 접기/펼치기 */
  function openPanel(panel: PanelMeta) {
    if (panel.id === activeId) {
      setPanelState(panel.id, (panelStates[panel.id] ?? 'half') === 'closed' ? 'half' : 'closed');
      return;
    }
    navigateKeepingPlace(panel.path);
  }

  /** 다른 카테고리로 가도 열어 둔 가게 창은 그대로 둔다 (주소의 ?place= 를 따라 붙인다) */
  function navigateKeepingPlace(path: string) {
    const place = new URLSearchParams(window.location.search).get(PLACE_PARAM);
    navigate(place ? `${path}?${PLACE_PARAM}=${encodeURIComponent(place)}` : path);
  }

  /** 전체 메뉴에서 고르기: 메뉴를 닫고 그 탭으로 간다. 지금 탭이면 접지 않고 펼쳐서 보여준다 */
  function openFromMenu(panel: PanelMeta) {
    setMenuOpen(false);
    if (panel.id === activeId) {
      if ((panelStates[panel.id] ?? 'half') === 'closed') setPanelState(panel.id, 'half');
      return;
    }
    navigateKeepingPlace(panel.path);
  }

  // ---- 카테고리 가게(아직 없음) · 지도 가게(DB 의 공개 가게, 월계1동 상가정보) ----
  useEffect(() => {
    let cancelled = false;
    void fetchStores().then((stores) => {
      if (cancelled) return;
      setCategoryStores(stores);
      setStoresLoaded((prev) => ({ ...prev, category: true }));
    });
    return () => { cancelled = true; };
  }, []);

  // 지도 가게를 못 읽으면(null) 핀 없는 지도만 남으므로, 위쪽에 안내 띠와 다시 시도를 띄운다
  const [mapRetry, setMapRetry] = useState(0);
  const [mapLoading, setMapLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setMapLoading(true);
    void fetchMapStores().then((data) => {
      if (cancelled) return;
      setMapData(data);
      setMapLoading(false);
      setStoresLoaded((prev) => ({ ...prev, map: true }));
    });
    return () => { cancelled = true; };
  }, [mapRetry]);
  const mapStoresFailed = !mapLoading && mapData === null;

  // ---- 지도에 표시할 가게 ----
  // 지도 위쪽 필터는 대표 유형 여러 개를 묶은 것 (MAP_FILTERS)
  const subCategory = MAP_FILTERS.find((s) => s.id === subId) ?? null;
  const storeTerm = storeQuery.trim().toLocaleLowerCase();
  const subCounts = useMemo(() => Object.fromEntries(MAP_FILTERS.map((s) =>
    [s.id, mapData ? mapData.stores.filter((p) => p.typeId !== null && s.typeIds.includes(p.typeId) && matchesSearch(placeSearchText(p), storeTerm)).length : 0])), [mapData, storeTerm]);
  // 가게가 한 곳도 없는 항목은 목록에서 뺀다 (데이터가 아직 없으면 전부 보여준다)
  const visibleSubs = useMemo(() => (mapData ? MAP_FILTERS.filter((s) => subCounts[s.id] > 0) : MAP_FILTERS), [mapData, subCounts]);
  // 가게를 하나 열어 둔 동안(2차 탭)에는 그 가게 핀만 남긴다
  const focusedId = selectedPlace?.id ?? selectedStoreId;
  const categoryPins = useMemo(() => {
    if (focusedId) return selectedStore ? [selectedStore] : [];
    // 그 외 카테고리를 고른 동안에는 카테고리 가게 핀을 숨기고 지도 가게만 보여준다
    if (subCategory) return [];
    // 화면이 가게를 정해 주면 그 가게들을 그대로 (카테고리 가게 목록에 없으면 함께 넘긴 가게 정보로)
    if (mapStoreIds) {
      const byId = new Map([...mapExtraStores, ...categoryStores].map((store) => [store.id, store]));
      return mapStoreIds.flatMap((id) => byId.get(id) ?? []).filter((store) => matchesSearch(storeSearchText(store), storeTerm));
    }
    // 룰렛은 돌려서 나온 가게만: 필터가 아직 없을(null) 때도 핀을 보여주지 않는다
    if (activeId === 'roulette') return [];
    // 동네 소식은 등록 가게도 상가정보 핀과 같이 묶어 숫자 핀으로 보여준다 (places 로 넘어간다). 가게 관리도 같은 지도
    if (activeId === 'recommend' || activeId === 'owner') return [];
    return storesForPanel(categoryStores, activeId ?? '').filter((store) => matchesSearch(storeSearchText(store), storeTerm));
  }, [focusedId, subCategory, activeId, selectedStore, categoryStores, mapStoreIds, mapExtraStores, storeTerm]);
  // 가게 관리: 내 가게 핀은 늘 함께 (다른 가게를 열어 둔 동안에도). 상가정보 핀에서는 빠진다
  const showMine = activeId === 'owner';
  const mapStores = useMemo(() => {
    if (!showMine || !myStores.length) return categoryPins;
    const mineIds = new Set(myStores.map((store) => store.id));
    return [...myStores, ...categoryPins.filter((store) => !mineIds.has(store.id))];
  }, [categoryPins, showMine, myStores]);
  // 지도 가게: 그 외 카테고리를 고르면 그 유형만, 아니면 전부. 카테고리 핀으로 이미 나온 가게는 두 번 그리지 않는다
  const places = useMemo(() => {
    if (!mapData) return [];
    const shown = new Set(mapStores.map((s) => s.id));
    if (focusedId) return mapData.stores.filter((p) => p.id === focusedId && !shown.has(p.id));
    if (FEATURE_PANEL_IDS.has(activeId ?? '')) return [];
    return mapData.stores.filter((p) => !shown.has(p.id) && matchesSearch(placeSearchText(p), storeTerm) && (!subCategory || (p.typeId !== null && subCategory.typeIds.includes(p.typeId))));
  }, [mapData, subCategory, mapStores, focusedId, storeTerm, activeId]);

  // ---- 2차 탭: 카테고리 가게 또는 지도 가게 하나만 연다 ----
  const selectStore = useCallback((id: string) => { setSelectedPlace(null); setSelectedStoreId(id); }, []);
  const selectPlace = useCallback((place: MapStore) => { setSelectedStoreId(null); setSelectedPlace(place); }, []);
  const closeSecondary = useCallback(() => { setFocus(null); setSelectedStoreId(null); setSelectedPlace(null); }, []);
  // 지도에서 가게를 직접 고르면 2차 탭을 가게 정보(맨 위)부터 보여준다
  // 세로 화면: 가게 정보는 하단 시트로 열리므로, 아래에 깔린 1차 탭을 접어 지도와 정보가 서로 가리지 않게 한다
  const collapseForSheet = useCallback(() => {
    if (axis !== 'y' || !activeId) return;
    setPanelStates((prev) => (prev[activeId] === 'closed' ? prev : { ...prev, [activeId]: 'closed' }));
  }, [axis, activeId]);
  const pickStoreOnMap = useCallback((id: string) => { setFocus(null); selectStore(id); collapseForSheet(); }, [selectStore, collapseForSheet]);
  const pickPlaceOnMap = useCallback((place: MapStore) => { setFocus(null); selectPlace(place); collapseForSheet(); }, [selectPlace, collapseForSheet]);

  // 1차 탭에서 가게를 열 때 가게를 찾는 곳 (카테고리 가게 → 지도 가게 순)
  const lookupRef = useRef({ categoryStores, mapData });
  lookupRef.current = { categoryStores, mapData };
  const selectAnyStore = useCallback((storeId: string) => {
    const { categoryStores: list, mapData: data } = lookupRef.current;
    const place = list.some((s) => s.id === storeId) ? null : data?.stores.find((p) => p.id === storeId) ?? null;
    if (place) selectPlace(place);
    else selectStore(storeId);
  }, [selectPlace, selectStore]);
  // 지도 핀에서 고른 가게가 카테고리 가게면 카테고리 가게로 연다 (동네 소식에서는 같은 핀으로 묶여 있다)
  const pickMapPlace = useCallback((place: MapStore) => {
    if (lookupRef.current.categoryStores.some((s) => s.id === place.id)) pickStoreOnMap(place.id);
    else pickPlaceOnMap(place);
  }, [pickStoreOnMap, pickPlaceOnMap]);

  // ---- 열린 가게 창 ↔ 주소(?place=ID) 맞추기: 뒤로가기로 닫고, 주소를 공유·새로고침해도 같은 가게가 열린다 ----
  // 주소가 바뀌었으면(뒤로·앞으로가기, 공유 링크) 창을 주소에 맞추고, 창이 바뀌었으면(가게 열기·닫기) 주소를 창에 맞춘다
  const storesReady = storesLoaded.category && storesLoaded.map;
  const syncedRef = useRef<{ open: string | null; url: string | null }>({ open: null, url: null });
  useEffect(() => {
    const prev = syncedRef.current;
    if (urlPlaceId !== prev.url && urlPlaceId !== focusedId) {
      if (!urlPlaceId) {
        closeSecondary();
      } else {
        // 지도 가게인지 카테고리 가게인지 알아야 층·건물까지 보여줄 수 있어서, 가게 목록을 받은 뒤에 연다
        if (!storesReady) return;
        setFocus(null);
        selectAnyStore(urlPlaceId);
      }
    } else if (focusedId !== prev.open && focusedId !== urlPlaceId) {
      const pushed = (window.history.state?.usr as PlaceHistoryState)?.placePushed === true;
      if (!focusedId) {
        // 창을 열며 쌓은 기록이면 걷어내서, 닫은 뒤 뒤로가기가 같은 가게를 다시 열지 않게 한다
        if (pushed) navigate(-1);
        else navigate(urlWithPlace(null), { replace: true });
      } else if (urlPlaceId) {
        // 가게 창이 열린 채 다른 가게로: 기록을 늘리지 않고 바꾼다 (뒤로가기 한 번이면 창이 닫힌다)
        navigate(urlWithPlace(focusedId), { replace: true, state: { placePushed: pushed } });
      } else {
        navigate(urlWithPlace(focusedId), { state: { placePushed: true } });
      }
    }
    syncedRef.current = { open: focusedId, url: urlPlaceId };
  }, [urlPlaceId, focusedId, storesReady, closeSecondary, selectAnyStore, navigate]);

  // 가게를 열면 그 자리를 탭·가게 창에 가려지지 않은 영역 가운데로 (2차 탭 크기가 반영된 뒤에)
  const focusPoint = selectedPlace ?? selectedStore?.location ?? (selectedStoreId ? mapData?.stores.find((p) => p.id === selectedStoreId) : undefined) ?? null;
  const focusLat = focusPoint?.lat;
  const focusLng = focusPoint?.lng;
  useEffect(() => {
    if (focusLat === undefined || focusLng === undefined) return;
    const frame = requestAnimationFrame(() => mapRef.current?.centerOn({ lat: focusLat, lng: focusLng }, getInsets()));
    return () => cancelAnimationFrame(frame);
  }, [focusedId, focusLat, focusLng, getInsets]);

  // ---- 지도 대체 목록: 지금 지도에 보이는 가게를 글 목록으로 ----
  const listItems = useMemo<MapListItem[]>(() => [
    ...mapStores.map((store) => ({ id: store.id, name: store.name, category: store.cuisineType ?? '', address: store.address })),
    ...places.map((place) => ({ id: place.id, name: place.name, category: placeToSecondary(place).category, address: place.address })),
  ], [mapStores, places]);
  const pickFromList = useCallback((id: string) => {
    setListOpen(false);
    const place = places.find((p) => p.id === id);
    if (place) pickPlaceOnMap(place);
    else pickStoreOnMap(id);
  }, [places, pickPlaceOnMap, pickStoreOnMap]);

  const toggleSub = useCallback((id: string) => setSubId((prev) => (prev === id ? null : id)), []);

  // ---- 가게 검색(이름·업종·주소): 엔터를 치거나 입력을 마치면(검색창을 벗어나면) 가장 맞는 가게로 지도를 옮긴다 ----
  // 지금 지도에 보이는 가게(업종 필터 포함) 중에서 이름이 가장 맞는 곳(이름에 없으면 업종·주소가 맞는 곳), 같으면 내 위치에서 가까운 곳
  const jumpToSearchResult = () => {
    if (!storeTerm || storeTerm === searchedTermRef.current) return;
    searchedTermRef.current = storeTerm;
    const best = bestSearchResult([
      ...mapStores.map((store) => ({ name: store.name, text: storeSearchText(store), point: store.location })),
      ...places.map((place) => ({ name: place.name, text: placeSearchText(place), point: { lat: place.lat, lng: place.lng } })),
    ], storeTerm, myLocationRef.current);
    if (!best) {
      showToast(`'${storeQuery.trim()}' 가게를 찾지 못했어요`);
      return;
    }
    if (mapRef.current?.centerOn(best.point, getInsets(), SEARCH_RESULT_ZOOM)) showToast(`${best.name} 위치로 이동했어요`);
  };

  // ---- 현재 위치: 첫 진입 때 자동 표시하고, 버튼으로도 다시 확인 ----
  const locate = useCallback((announceSuccess = true) => {
    const moveTo = (point: GeoPoint, notice?: string) => {
      myLocationRef.current = point;
      mapRef.current?.showMyLocation(point);
      const moved = mapRef.current?.centerOn(point, getInsets());
      if (!moved) showToast('지도를 불러오지 못해 위치를 표시할 수 없어요');
      else if (notice) showToast(notice);
    };
    if (!navigator.geolocation) {
      moveTo(MAP_CENTER, '위치를 확인할 수 없어 월계1동 기준점으로 이동했어요');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        moveTo(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          announceSuccess ? '현재 위치를 지도에 표시했어요' : undefined,
        );
      },
      () => { setLocating(false); moveTo(MAP_CENTER, '위치 권한이 없어 월계1동 기준점으로 이동했어요'); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, [getInsets, showToast]);

  useEffect(() => {
    if (autoLocateRequestedRef.current) return;
    autoLocateRequestedRef.current = true;
    locate(false);
  }, [locate]);

  // 가게를 보여줄 때 1차 탭이 지도를 가리지 않게 접는다 (세로 화면: 닫기 / 가로 화면: 전체면 반으로)
  const layoutRef = useRef({ activeId, axis });
  layoutRef.current = { activeId, axis };
  const revealMap = useCallback(() => {
    const { activeId: id, axis: dir } = layoutRef.current;
    if (!id) return;
    setPanelStates((prev) => {
      const current = prev[id] ?? 'half';
      const next = dir === 'y' ? 'closed' : current === 'full' ? 'half' : current;
      return next === current ? prev : { ...prev, [id]: next };
    });
  }, []);

  /** 1차 탭에서 가게를 연다: 2차 탭을 열고, focus 가 있으면 그 카테고리(항목)를 맨 위로 스크롤한다 */
  const openStore = useCallback((storeId: string, target?: SecondaryFocus) => {
    selectAnyStore(storeId);
    setFocus(target ? { ...target, seq: Date.now() } : null);
    revealMap();
  }, [selectAnyStore, revealMap]);

  const api = useMemo<ShellApi>(() => ({
    openStore,
    setMapStoreIds: limitMapStores,
    setActivePanelState(state) {
      if (activeId) setPanelState(activeId, state);
    },
  }), [activeId, setPanelState, openStore, limitMapStores]);

  if (!active) {
    return <Navigate to={DEFAULT_LANDING_PATH} replace />;
  }

  const activeState = panelStates[active.id] ?? 'half';
  const portrait = mode === 'portrait';
  // 세로 화면 하단 바는 정해 둔 몇 개만, 나머지는 전체 메뉴로. 사장님은 사장님 센터 + 내 정보 버튼까지 바에 둔다
  const ownerBar = categories.some((c) => c.id === 'owner');
  const barItems = portrait
    ? (ownerBar ? OWNER_PORTRAIT_BAR_IDS : PORTRAIT_BAR_IDS).map((id) => categories.find((c) => c.id === id)).filter((c): c is Category => !!c)
    : categories;
  const userButton = <UserButton active={active.id === USER_PANEL.id} onClick={() => openPanel(USER_PANEL)} />;

  return (
    <ShellContext.Provider value={api}>
      <div className="app-shell" data-layout={mode}>
        <div
          className="app-stage"
          ref={stageRef}
          data-panel-state={activeState}
        >
          <MainMap
            key={palette /* 지도는 만들 때 색을 한 번 읽으므로 팔레트가 바뀌면 다시 만든다 */}
            ref={mapRef}
            stores={mapStores}
            places={places}
            selectedPlaceId={selectedPlace?.id ?? null}
            onPlaceSelect={pickMapPlace}
            placesMonth={mapData?.sbizMonth || null}
            selectedId={selectedStoreId}
            onSelect={pickStoreOnMap}
            getInsets={getInsets}
            showZoomControl={mode === 'wide' && !window.matchMedia(TOUCH_PRIMARY_QUERY).matches}
            portrait={mode === 'portrait'}
            allowOutsideWolgye={activeId === 'partner-stores' || activeId === 'roulette'}
            smallPins={activeId === 'recommend' || activeId === 'owner'}
            myStoreIds={showMine ? myStores.map((store) => store.id) : undefined}
          />

          {/* 그 외 카테고리: 모든 화면에서 지도 위쪽에 얇은 한 줄로 늘어놓는다 (넘치면 옆으로 밀기) */}
          <nav className="map-sub-bar" aria-label="가게 검색 및 업종 카테고리" onWheel={scrollBarByWheel}>
            <form
              className="map-store-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                jumpToSearchResult();
                // 모바일 키보드를 내려 지도가 보이게 한다 (blur 로 한 번 더 옮기지는 않는다)
                (event.currentTarget.querySelector('input') as HTMLInputElement | null)?.blur();
              }}
            >
              <Icon name="search" />
              <input
                type="search"
                enterKeyHint="search"
                aria-label="가게 이름·업종·주소 검색"
                placeholder="가게·업종·주소 검색"
                value={storeQuery}
                onChange={(event) => { searchedTermRef.current = ''; setStoreQuery(event.target.value); }}
                onBlur={jumpToSearchResult}
              />
              {storeQuery && (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  // 누를 때 검색창 포커스를 뺏지 않는다 (blur 로 지우기 전 검색어 위치로 지도가 옮겨가지 않도록)
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => { searchedTermRef.current = ''; setStoreQuery(''); }}
                >
                  ×
                </button>
              )}
            </form>
            <SubCategoryList items={visibleSubs} selectedId={subId} counts={subCounts} onToggle={toggleSub} />
          </nav>

          {(mapStoresFailed || (mapLoading && mapRetry > 0)) && (
            <div className="map-load-error" role="alert">
              <span>{mapLoading ? '가게 정보를 다시 불러오는 중…' : '가게 정보를 불러오지 못했어요'}</span>
              {!mapLoading && <button type="button" onClick={() => setMapRetry((n) => n + 1)}>다시 시도</button>}
            </div>
          )}

          {portrait && (
            <button
              type="button"
              className="map-menu-button"
              aria-label="전체 메뉴"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              data-active={(!barItems.some((c) => c.id === active.id) && !(ownerBar && active.id === USER_PANEL.id)) || undefined /* 하단 바에 없는 탭을 보는 중 */}
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
          )}

          <div className="map-fabs">
            <button type="button" className="map-fab map-fab--text" aria-haspopup="dialog" onClick={() => setListOpen(true)}>
              목록
            </button>
            <button
              type="button"
              className="map-fab map-location-fab"
              aria-label={locating ? '현재 위치 확인 중' : '내 위치로 이동'}
              aria-busy={locating}
              disabled={locating}
              onClick={() => locate()}
            >
              <Icon name="locate" />
              <span>{locating ? '위치 확인 중…' : '내 위치'}</span>
            </button>
          </div>

          <MapPlaceList
            open={listOpen}
            items={listItems}
            filters={visibleSubs}
            selectedId={subId}
            counts={subCounts}
            onSelectFilter={setSubId}
            searchTerm={storeQuery.trim()}
            onPick={pickFromList}
            onClose={() => setListOpen(false)}
          />

          {portrait && (
            <AllMenu
              open={menuOpen}
              items={categories}
              activeId={active.id}
              onSelect={openFromMenu}
              userActive={active.id === USER_PANEL.id}
              onSelectUser={() => openFromMenu(USER_PANEL)}
              onClose={() => setMenuOpen(false)}
            />
          )}

          <SecondaryPanel ref={secondaryRef} place={secondaryPlace} layout={mode} onClose={closeSecondary} focus={focus} />

          <KeepAlivePages
            activeId={active.id}
            axis={axis}
            stage={stage}
            states={panelStates}
            onStateChange={setPanelState}
            onVisibleChange={reportVisible}
            toggleOnly={mode === 'wide'}
          />
        </div>

        <CategoryNav
          orientation={portrait ? 'horizontal' : 'vertical'}
          scrollable={mode === 'mobile-landscape'}
          items={barItems}
          activeId={active.id}
          onSelect={openPanel}
          userButton={portrait && !ownerBar ? undefined : userButton}
          userPlacement={mode === 'wide' ? 'end' : 'list'}
        />
      </div>
    </ShellContext.Provider>
  );
}
