import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type WheelEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ALL_PANELS, DEFAULT_LANDING_PATH, OWNER_PORTRAIT_BAR_IDS, PORTRAIT_BAR_IDS, USER_PANEL } from '../../core/categories/categories';
import type { Category, PanelMeta } from '../../core/categories/categoryTypes';
import { SUB_CATEGORIES, subCategoryById } from '../../core/categories/subCategories';
import { fetchMapStores, floorLabel, type MapStore, type MapStoreData } from '../../core/supabase/stores';
import { useVisibleCategories } from '../../core/categories/useVisibleCategories';
import { useLayoutMode } from '../../core/device/LayoutModeContext';
import { panelAxis, TOUCH_PRIMARY_QUERY } from '../../core/device/layoutMode';
import { fetchStores } from '../../core/source/storeSource';
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

/** 지도에 표시할 가게: 가게가 지원하는 카테고리면 그 가게만, 아니면(동네 소식·유저) 전체 */
function storesForPanel(stores: Store[], panelId: string): Store[] {
  const key = panelId as keyof CategorySupport;
  const matched = stores.filter((store) => store.supports[key]);
  return matched.length > 0 ? matched : stores;
}

/** 카테고리 가게 → 2차 탭 요약 */
function storeToSecondary(store: Store): SecondaryPlace {
  return {
    id: store.id,
    name: store.name,
    category: store.cuisineType ?? '',
    address: store.address,
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
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [panelStates, setPanelStates] = useState<Record<string, PanelState>>({});
  const [subId, setSubId] = useState<string | null>(null);
  const [mapData, setMapData] = useState<MapStoreData | null>(null);
  const [categoryStores, setCategoryStores] = useState<Store[]>([]);
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
  const selectedStore = categoryStores.find((store) => store.id === selectedStoreId) ?? null;
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
    setPanelStates((prev) => (prev[activeId] === 'closed' ? { ...prev, [activeId]: 'half' } : prev));
  }, [activeId]);

  const reportVisible = useCallback((size: number) => {
    stageRef.current?.style.setProperty(axis === 'y' ? '--inset-bottom' : '--inset-right', `${size}px`);
  }, [axis]);

  const getInsets = useCallback((): MapInsets => {
    const node = stageRef.current;
    if (!node) return NO_INSETS;
    const css = getComputedStyle(node);
    const read = (name: string) => parseFloat(css.getPropertyValue(name)) || 0;
    return { top: 0, right: read('--inset-right'), bottom: read('--inset-bottom'), left: read('--inset-left') };
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
    navigate(panel.path);
  }

  /** 전체 메뉴에서 고르기: 메뉴를 닫고 그 탭으로 간다. 지금 탭이면 접지 않고 펼쳐서 보여준다 */
  function openFromMenu(panel: PanelMeta) {
    setMenuOpen(false);
    if (panel.id === activeId) {
      if ((panelStates[panel.id] ?? 'half') === 'closed') setPanelState(panel.id, 'half');
      return;
    }
    navigate(panel.path);
  }

  // ---- 카테고리 가게(아직 없음) · 지도 가게(DB 의 공개 가게, 월계1동 상가정보) ----
  useEffect(() => {
    let cancelled = false;
    void fetchStores().then((stores) => { if (!cancelled) setCategoryStores(stores); });
    void fetchMapStores().then((data) => { if (!cancelled) setMapData(data); });
    return () => { cancelled = true; };
  }, []);

  // ---- 지도에 표시할 가게 ----
  const subCategory = SUB_CATEGORIES.find((s) => s.id === subId) ?? null;
  const subCounts = useMemo(() => Object.fromEntries(SUB_CATEGORIES.map((s) =>
    [s.id, mapData ? mapData.stores.filter((p) => p.typeId === s.id).length : 0])), [mapData]);
  // 가게가 한 곳도 없는 항목은 목록에서 뺀다 (데이터가 아직 없으면 전부 보여준다)
  const visibleSubs = useMemo(() => (mapData ? SUB_CATEGORIES.filter((s) => subCounts[s.id] > 0) : SUB_CATEGORIES), [mapData, subCounts]);
  const mapStores = useMemo(() => {
    // 그 외 카테고리를 고른 동안에는 카테고리 가게 핀을 숨기고 지도 가게만 보여준다
    const list = subCategory ? [] : storesForPanel(categoryStores, activeId ?? '');
    return selectedStore && !list.includes(selectedStore) ? [...list, selectedStore] : list;
  }, [subCategory, activeId, selectedStore, categoryStores]);
  // 지도 가게: 그 외 카테고리를 고르면 그 유형만, 아니면 전부. 카테고리 핀으로 이미 나온 가게는 두 번 그리지 않는다
  const places = useMemo(() => {
    if (!mapData) return [];
    const shown = new Set(mapStores.map((s) => s.id));
    return mapData.stores.filter((p) => !shown.has(p.id) && (!subCategory || p.typeId === subCategory.id));
  }, [mapData, subCategory, mapStores]);

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

  // 지도 가게를 열면 그 자리를 탭에 가려지지 않은 영역 가운데로 (2차 탭 폭이 반영된 뒤에)
  useEffect(() => {
    if (!selectedPlace) return;
    const frame = requestAnimationFrame(() => mapRef.current?.centerOn(selectedPlace, getInsets()));
    return () => cancelAnimationFrame(frame);
  }, [selectedPlace, getInsets]);

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

  // ---- 내 위치 버튼: 현재 위치를 보이는 지도 영역 가운데로 ----
  function locate() {
    const moveTo = (point: GeoPoint, notice?: string) => {
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
      (pos) => { setLocating(false); moveTo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { setLocating(false); moveTo(MAP_CENTER, '위치 권한이 없어 월계1동 기준점으로 이동했어요'); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

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
    setActivePanelState(state) {
      if (activeId) setPanelState(activeId, state);
    },
  }), [activeId, setPanelState, openStore]);

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
            onPlaceSelect={pickPlaceOnMap}
            placesMonth={mapData?.sbizMonth || null}
            selectedId={selectedStoreId}
            onSelect={pickStoreOnMap}
            getInsets={getInsets}
            showZoomControl={mode === 'wide' && !window.matchMedia(TOUCH_PRIMARY_QUERY).matches}
            portrait={mode === 'portrait'}
          />

          {/* 그 외 카테고리: 모든 화면에서 지도 위쪽에 얇은 한 줄로 늘어놓는다 (넘치면 옆으로 밀기) */}
          <nav className="map-sub-bar" aria-label="그 외 카테고리" onWheel={scrollBarByWheel}>
            <SubCategoryList items={visibleSubs} selectedId={subId} counts={subCounts} onToggle={toggleSub} />
          </nav>

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
            <button type="button" className="map-fab" aria-label="내 위치로 이동" title="내 위치로 이동" aria-busy={locating} onClick={locate}>
              <Icon name="locate" />
            </button>
          </div>

          <MapPlaceList
            open={listOpen}
            items={listItems}
            filterLabel={subCategory?.label ?? null}
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
