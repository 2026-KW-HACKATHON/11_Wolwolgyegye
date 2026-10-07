import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FeatureCollection } from 'geojson';
import type { GeoPoint, Store } from '../../core/types/place';
import { ICONS } from '../icons';
import { buildingListElement, clusterGroups, clusterIcon, CLUSTER_MAX_ZOOM, groupByBuilding, pinGroup, PIN_POPUP_OFFSET } from './placeMarkers';
import type { MapStore } from '../../core/supabase/stores';
import { ADMIN_DONG_LABEL, AREA_LAYERS, createStyles } from './vworld/config';
import { drawStations, drawSubwayLines } from './osm/drawTransit';
import { drawCampusLabels } from './vworld/campusLabels';
import { drawArea, drawBoundary, drawBuildings, drawRailways, drawRoads, drawSchoolFacilities, visibleSchoolFacilities, type BuildingOutlines, type DrawContext } from './vworld/draw';
import { isInWolgye1 } from './vworld/geometry';
import { loadData } from './vworld/loadData';
import { LANDSCAPE_MIN_ZOOM_HEIGHT_RATIO, MAP_CENTER, MAP_EXTENT, MAP_HEIGHT_PER_RECT, portraitMinZoomHeightRatio, WOLGYE1_LAT_SPAN } from './vworld/mapExtent';
import './MainMap.css';

/** 지도 위를 덮고 있는 탭·패널의 크기(px). 가운데 맞추기는 이만큼을 뺀 "보이는 영역" 기준으로 한다 */
export interface MapInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MainMapHandle {
  /** point 를 보이는 지도 영역의 가운데로 옮긴다. minZoom 을 주면 적어도 그만큼 확대한다. 지도가 아직 없으면 false */
  centerOn(point: GeoPoint, insets: MapInsets, minZoom?: number): boolean;
  /** 내 위치 점을 표시한다 */
  showMyLocation(point: GeoPoint): void;
}

interface MainMapProps {
  stores: Store[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 가게 선택 시 가운데 맞추기에 쓸 현재 가림 영역 */
  getInsets: () => MapInsets;
  /** 확대·축소(+/-) 버튼 표시. PC 에서만 켠다 (터치 기기는 두 손가락으로 조절) */
  showZoomControl: boolean;
  /** 세로 화면(모바일·태블릿 세로)이면 true. 가장 많이 축소할 수 있는 정도가 달라진다 */
  portrait: boolean;
  /** 소상공인 상가정보 가게 (월계1동). 건물 단위로 묶고, 줌을 줄이면 가까운 건물끼리 묶어 그린다 */
  places: MapStore[];
  /** 지금 2차 탭에 열린 상가정보 가게 id (그 핀을 강조) */
  selectedPlaceId: string | null;
  /** 상가정보 가게를 고르면 (단일 핀을 누르거나, 층별 목록에서 고르면) 불린다 */
  onPlaceSelect: (place: MapStore) => void;
  /** 상가정보 기준월 (예: 202606). 데이터가 없으면 null */
  placesMonth: string | null;
  /** 제휴 가게처럼 월계1동 경계 밖의 인접 가게도 표시할 때 true */
  allowOutsideWolgye?: boolean;
}

type Status = 'loading' | 'ready' | 'missing';

// Leaflet 은 [위도, 경도] 순서
const EXTENT_BOUNDS = L.latLngBounds([MAP_EXTENT.south, MAP_EXTENT.west], [MAP_EXTENT.north, MAP_EXTENT.east]);
/** 월계1동 세로 H 의 ratio 배 높이를 가진 (폭 없는) 범위 */
const heightBounds = (ratio: number) => L.latLngBounds(
  [MAP_CENTER.lat - (WOLGYE1_LAT_SPAN * ratio) / 2, MAP_CENTER.lng],
  [MAP_CENTER.lat + (WOLGYE1_LAT_SPAN * ratio) / 2, MAP_CENTER.lng],
);

/**
 * 가장 많이 축소할 수 있는 줌.
 * - 화면 세로에 월계1동 세로의 일정 비율이 들어오는 줌 (가로 화면 0.5배, 세로 화면은 화면 크기별 표로 보간)
 * - 그리고 화면 전체가 지도 범위 안에 들어오는 줌 (범위 밖이 보이지 않게) 중 더 확대된 쪽
 */
function minZoomFor(map: L.Map, portrait: boolean): number {
  if (!portrait) {
    return Math.max(map.getBoundsZoom(heightBounds(LANDSCAPE_MIN_ZOOM_HEIGHT_RATIO), false), map.getBoundsZoom(EXTENT_BOUNDS, true));
  }
  // 세로 화면: getBoundsZoom 은 0.25 단위로 끊어서 (내림하면 월계1동이 다 들어오고, 올림하면 필요 이상으로 막힌다)
  // 끊지 않은 정확한 줌을 쓴다. zoom 0 에서의 픽셀 크기로 배율을 구해 줌으로 바꾼다.
  const size = map.getSize();
  const pixelSizeAtZoom0 = (bounds: L.LatLngBounds) => map.project(bounds.getSouthEast(), 0).subtract(map.project(bounds.getNorthWest(), 0));
  const target = pixelSizeAtZoom0(heightBounds(Math.min(MAP_HEIGHT_PER_RECT, portraitMinZoomHeightRatio(size.y))));
  const extent = pixelSizeAtZoom0(EXTENT_BOUNDS);
  const byRatio = map.getScaleZoom(size.y / target.y, 0);
  // 화면 전체가 지도 범위 안에 들어오는 줌 (반올림 오차로 범위 밖 한 줄이 보이지 않게 아주 조금 더 확대)
  const cover = map.getScaleZoom(Math.max(size.x / extent.x, size.y / extent.y), 0) + 0.001;
  return Math.max(byRatio, cover);
}

/** point 가 탭에 가려지지 않은 영역의 가운데에 오도록 지도 중심을 옮긴다 */
function centerInVisibleArea(map: L.Map, point: GeoPoint, insets: MapInsets, minZoom = 0) {
  const shift = L.point((insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2);
  const centerAt = (zoom: number) => map.unproject(map.project([point.lat, point.lng], zoom).add(shift), zoom);
  // 지도는 이동 범위(maxBounds) 밖으로 못 나가서, 줌이 낮으면 가게를 가려지지 않은 곳 가운데로 끌어올 수 없다.
  // 그럴 때는 가운데에 올 수 있을 때까지만 한 단계씩 확대한다
  const limit = EXTENT_BOUNDS;
  const half = map.getSize().divideBy(2);
  const fits = (zoom: number) => {
    const center = map.project(centerAt(zoom), zoom);
    return limit.contains(L.latLngBounds(map.unproject(center.subtract(half), zoom), map.unproject(center.add(half), zoom)));
  };
  let zoom = Math.min(Math.max(map.getZoom(), minZoom), map.getMaxZoom());
  while (!fits(zoom) && zoom < map.getMaxZoom()) zoom += 1;
  if (zoom === map.getZoom()) map.panTo(centerAt(zoom));
  else map.setView(centerAt(zoom), zoom);
}

/** 내 위치 점. Canvas 로 그려져 CSS 클래스가 적용되지 않으므로 theme.css 토큰 값을 읽어 넘긴다 */
const myLocationStyle = (css: (name: string) => string): L.CircleMarkerOptions => ({
  radius: 8, color: css('--map-me-ring'), weight: 3, fillColor: css('--map-me'), fillOpacity: 1, interactive: false,
});

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** 가게 핀. 원데이클래스는 자주(동네 소식·원데이클래스 색), 그 밖은 초록(공간대여 색) */
function storeIcon(store: Store, selected: boolean): L.DivIcon {
  const kind = store.supports['oneday-class'] ? 'class' : store.supports['space-rental'] ? 'space' : 'store';
  const glyph = ICONS[kind === 'class' ? 'palette' : kind === 'space' ? 'house' : 'storefront'];
  return L.divIcon({
    className: 'mm-pin-wrap',
    html: `<span class="mm-pin mm-pin--${kind}${selected ? ' is-selected' : ''}">${glyph}</span>${selected ? `<strong class="mm-pin-name">${escapeHtml(store.name)}</strong>` : ''}`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
}

/**
 * 앱 전체 배경 지도 (Leaflet 1.9.4, 배경 타일 없음).
 * 지도 테스트 워크스페이스 V_World/main.js 의 지도 초기화·실행 부분을 옮긴 것.
 * 데이터는 scripts/fetch-vworld.js 가 저장한 public/data/vworld/*.geojson 만 읽는다. (키를 쓰지 않는다)
 *
 * 그리는 순서 (아래 → 위): 영역(학교 → 아파트 단지 → 강·하천 → 산) → 도로 → 건물 → 학교 건물 → 월계1동 경계 점선 → 가게 핀
 */
const MainMap = forwardRef<MainMapHandle, MainMapProps>(function MainMap({ stores, selectedId, onSelect, getInsets, showZoomControl, portrait, places, selectedPlaceId, onPlaceSelect, placesMonth, allowOutsideWolgye = false }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinLayerRef = useRef<L.LayerGroup | null>(null);
  const placeLayerRef = useRef<L.LayerGroup | null>(null);
  const outlinesRef = useRef<BuildingOutlines | null>(null);
  /** CSS 변수 읽기 (가게 핀 색을 건물 테두리에도 쓴다) */
  const cssRef = useRef<(name: string) => string>(() => '');
  const onPlaceSelectRef = useRef(onPlaceSelect);
  onPlaceSelectRef.current = onPlaceSelect;
  const meRef = useRef<L.CircleMarker | null>(null);
  const adminDongRef = useRef<FeatureCollection | null>(null);
  const onSelectRef = useRef(onSelect);
  const getInsetsRef = useRef(getInsets);
  const portraitRef = useRef(portrait);
  portraitRef.current = portrait;
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { getInsetsRef.current = getInsets; }, [getInsets]);

  useImperativeHandle(ref, () => ({
    centerOn(point, insets, minZoom) {
      const map = mapRef.current;
      if (!map) return false;
      centerInVisibleArea(map, point, insets, minZoom);
      return true;
    },
    showMyLocation(point) {
      const map = mapRef.current;
      if (!map) return;
      if (meRef.current) meRef.current.setLatLng([point.lat, point.lng]);
      else meRef.current = L.circleMarker([point.lat, point.lng], myLocationStyle(cssRef.current)).addTo(map);
    },
  }), []);

  // 1) 지도 만들기 + 데이터 읽어 그리기 (앱이 켜져 있는 동안 한 번)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

    const map = L.map(container, {
      preferCanvas: true, // 건물이 수천 개라 SVG 대신 Canvas 로 그려 성능 확보
      zoomControl: false, // +/- 버튼은 아래 effect 에서 PC 일 때만 왼쪽 아래에 붙인다
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      maxZoom: 20,
      maxBounds: EXTENT_BOUNDS,
      maxBoundsViscosity: 1, // 범위 끝에서 더 끌리지 않고 멈춘다 (튕김 없음)
      bounceAtZoomLimits: false,
      attributionControl: false, // 출처는 .mm-source 라벨로 직접 표시 (아래쪽에 작게)
      inertia: true,
      inertiaDeceleration: 3200,
      inertiaMaxSpeed: 1400,
      easeLinearity: 0.25,
      // 모바일에서는 수백 개 DOM 마커를 줌 애니메이션마다 확대하지 않는다.
      // 배경 지도 확대 애니메이션은 유지해 손가락 조작감은 그대로 둔다.
      markerZoomAnimation: !coarsePointer,
    });
    map.setMinZoom(minZoomFor(map, portraitRef.current));
    map.setView([MAP_CENTER.lat, MAP_CENTER.lng], map.getMinZoom());
    // 타일 레이어(L.tileLayer)는 추가하지 않는다. 배경은 CSS 의 단색.
    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
    mapRef.current = map;
    pinLayerRef.current = L.layerGroup().addTo(map);

    // 경계 점선은 맨 위 별도 pane. 마우스 이벤트를 통과시켜 아래 건물·영역 클릭을 막지 않게 한다.
    const boundaryPane = map.createPane('boundary');
    boundaryPane.style.zIndex = '450';
    boundaryPane.style.pointerEvents = 'none';
    placeLayerRef.current = L.layerGroup().addTo(map);

    const read = getComputedStyle(container);
    cssRef.current = (name) => read.getPropertyValue(name).trim();
    const featureRenderer = L.canvas({ padding: coarsePointer ? 0.12 : 0.2, tolerance: coarsePointer ? 5 : 3 });
    const ctx: DrawContext = {
      map,
      featureRenderer,
      boundaryRenderer: L.canvas({ pane: 'boundary', padding: 0.12, tolerance: 5 }),
      styles: createStyles((name) => read.getPropertyValue(name).trim()),
    };

    // 드래그·핀치 중에는 CSS 그림자와 필터를 잠시 빼 GPU 합성 비용을 줄인다.
    // 조작이 끝나면 같은 프레임에서 원래 표시로 되돌린다.
    let interactionDepth = 0;
    let interactionFrame: number | null = null;
    const interactionStart = () => {
      interactionDepth += 1;
      if (interactionFrame !== null) cancelAnimationFrame(interactionFrame);
      interactionFrame = null;
      container.classList.add('is-interacting');
    };
    const interactionEnd = () => {
      interactionDepth = Math.max(0, interactionDepth - 1);
      if (interactionDepth > 0) return;
      interactionFrame = requestAnimationFrame(() => {
        interactionFrame = null;
        container.classList.remove('is-interacting');
      });
    };
    map.on('movestart zoomstart', interactionStart);
    map.on('moveend zoomend', interactionEnd);

    void loadData().then((data) => {
      if (cancelled) return;
      if (!data) { setStatus('missing'); return; }

      // 추가 순서 = Canvas 그리기 순서. 영역 → 도로 → 철도 → 건물 순으로 넣어야 건물이 맨 위에 온다.
      for (const config of AREA_LAYERS) {
        const geojson = data.areas[config.key];
        if (geojson) drawArea(ctx, config, geojson); // 파일이 없으면 조용히 건너뛴다
      }
      const roadLayers = data.roads ? drawRoads(ctx, data.roads) : null;
      if (data.railways) drawRailways(ctx, data.railways);
      // 학교 건물은 종류별 색으로 그리고, 같은 건물이 일반 건물에도 있으면 일반 건물 쪽을 뺀다
      const schoolBuildings = visibleSchoolFacilities(data.schoolFacilities);
      outlinesRef.current = drawBuildings(ctx, data.buildings, schoolBuildings);
      drawSchoolFacilities(ctx, schoolBuildings);
      // 지하철: 노선은 철도·건물 위에 얇게 한 줄씩, 역 이름표·출구는 그 위 (가게 핀보다는 아래)
      if (data.subwayLines) drawSubwayLines(ctx, data.subwayLines);
      if (data.stations) drawStations(ctx, data.stations, data.stationExits);
      if (data.adminDong) drawBoundary(ctx, data.adminDong, ctx.styles.ADMIN_DONG_STYLE, ADMIN_DONG_LABEL, 'admin-dong-label');
      if (data.buildings) drawCampusLabels(ctx, data.buildings);
      adminDongRef.current = data.adminDong;

      // 줌이 바뀔 때마다 등급별 표시 여부 갱신 (투명도만 바꿔서 그리기 순서를 유지)
      const updateRoadVisibility = () => {
        if (!roadLayers) return;
        const zoom = map.getZoom();
        for (const [grade, { minZoom, opacity }] of Object.entries(ctx.styles.ROAD_STYLES)) {
          roadLayers[grade as keyof typeof roadLayers].setStyle({ opacity: zoom >= minZoom ? opacity : 0 });
        }
      };
      map.on('zoomend', updateRoadVisibility);
      updateRoadVisibility();
      setStatus('ready');
    });

    // 화면 회전·창 크기·탭 배치가 바뀌면 다시 맞추고, 가장 많이 축소할 수 있는 줌도 다시 계산한다
    let resizeFrame: number | null = null;
    let lastWidth = 0;
    let lastHeight = 0;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width <= 0 || height <= 0 || (width === lastWidth && height === lastHeight)) return;
      lastWidth = width;
      lastHeight = height;
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        map.invalidateSize({ pan: false, debounceMoveend: true });
        const minZoom = minZoomFor(map, portraitRef.current);
        map.setMinZoom(minZoom);
        if (map.getZoom() < minZoom) map.setZoom(minZoom, { animate: false });
      });
    });
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      if (interactionFrame !== null) cancelAnimationFrame(interactionFrame);
      map.off('movestart zoomstart', interactionStart);
      map.off('moveend zoomend', interactionEnd);
      map.remove();
      mapRef.current = null;
      pinLayerRef.current = null;
      placeLayerRef.current = null;
      outlinesRef.current = null;
      meRef.current = null;
    };
  }, []);

  // 세로 ↔ 가로 화면이 바뀌면 가장 많이 축소할 수 있는 줌을 다시 계산한다
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const minZoom = minZoomFor(map, portrait);
    map.setMinZoom(minZoom);
    if (map.getZoom() < minZoom) map.setZoom(minZoom);
  }, [portrait]);

  // 2) 확대·축소 버튼 — PC 에서만, 왼쪽 아래
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showZoomControl) return;
    const control = L.control.zoom({ position: 'bottomleft', zoomInTitle: '확대', zoomOutTitle: '축소' }).addTo(map);
    return () => { control.remove(); };
  }, [showZoomControl]);

  // 상가정보 가게 핀 — 건물 단위로 묶고(가게 수 숫자), 줌을 줄이면 가까운 건물끼리 다시 묶는다
  const buildingGroups = useMemo(() => groupByBuilding(places), [places]);

  // 핀이 있는 건물은 테두리를 그 핀 색으로 칠한다 (그 외 카테고리를 고르면 그 업종 건물만)
  useEffect(() => {
    const outlines = outlinesRef.current;
    if (!outlines) return;
    const colors = new Map<string, string>();
    for (const group of buildingGroups) {
      const buildingId = group.places.find((p) => p.buildingId)?.buildingId;
      if (buildingId) colors.set(buildingId, cssRef.current(`--place-${pinGroup(group.places)}`));
    }
    outlines.set(colors);
  }, [buildingGroups, status]);
  useEffect(() => {
    const map = mapRef.current;
    const layer = placeLayerRef.current;
    if (!map || !layer) return;
    let renderFrame: number | null = null;
    let renderedCoverage: L.LatLngBounds | null = null;
    const render = () => {
      renderFrame = null;
      layer.clearLayers();
      // 이동 중에는 기존 핀을 그대로 움직이고, 손을 뗀 뒤 현재 화면 주변만 다시 만든다.
      // 여유 영역을 넉넉히 둬 빠르게 드래그해도 가장자리에 빈 구간이 보이지 않게 한다.
      const visibleBounds = map.getBounds().pad(0.45);
      renderedCoverage = visibleBounds;
      const visibleGroups = buildingGroups.filter((group) => (
        visibleBounds.contains([group.lat, group.lng])
        || (selectedPlaceId !== null && group.places.some((place) => place.id === selectedPlaceId))
      ));
      for (const cluster of clusterGroups(map, visibleGroups)) {
        const selected = selectedPlaceId !== null && cluster.groups.some((g) => g.places.some((p) => p.id === selectedPlaceId));
        const marker = L.marker([cluster.lat, cluster.lng], { icon: clusterIcon(cluster, selected), zIndexOffset: selected ? 500 : 0, keyboard: true });
        const [group] = cluster.groups;
        if (cluster.groups.length > 1) {
          // 여러 건물 묶음: 그 건물들이 보이게 확대 (탭에 가려지지 않은 영역 기준)
          marker.on('click', () => {
            const insets = getInsetsRef.current();
            const bounds = L.latLngBounds(cluster.groups.map((g) => [g.lat, g.lng] as [number, number]));
            map.fitBounds(bounds, {
              paddingTopLeft: [insets.left + 48, insets.top + 48],
              paddingBottomRight: [insets.right + 48, insets.bottom + 48],
              maxZoom: CLUSTER_MAX_ZOOM,
            });
          });
        } else if (group.places.length === 1) {
          // 가게 1곳: 바로 그 가게
          marker.on('click', () => onPlaceSelectRef.current(group.places[0]));
        } else {
          // 한 건물에 여럿: 층별 목록을 먼저 띄우고, 목록에서 고른 가게만 연다
          marker.on('click', () => {
            const list = buildingListElement(group, (place) => {
              map.closePopup();
              onPlaceSelectRef.current(place);
            });
            L.popup({ className: 'pl-popup', maxWidth: 280, minWidth: 220, autoPanPadding: [24, 24], offset: [0, -PIN_POPUP_OFFSET] })
              .setLatLng([group.lat, group.lng])
              .setContent(list)
              .openOn(map);
          });
        }
        marker.addTo(layer);
      }
    };
    const scheduleRender = (force = false) => {
      if (!force && renderedCoverage?.contains(map.getBounds())) return;
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      renderFrame = requestAnimationFrame(render);
    };
    const renderAfterMove = () => scheduleRender(false);
    const renderAfterZoom = () => scheduleRender(true);
    scheduleRender(true);
    map.on('moveend', renderAfterMove);
    map.on('zoomend', renderAfterZoom);
    return () => {
      map.off('moveend', renderAfterMove);
      map.off('zoomend', renderAfterZoom);
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
    };
  }, [buildingGroups, selectedPlaceId, status]);

  // 3) 가게 핀 — 월계1동 안의 가게만
  useEffect(() => {
    const map = mapRef.current;
    const layer = pinLayerRef.current;
    if (!map || !layer) return;
    let renderFrame: number | null = null;
    let renderedCoverage: L.LatLngBounds | null = null;
    const render = () => {
      renderFrame = null;
      layer.clearLayers();
      const visibleBounds = map.getBounds().pad(0.45);
      renderedCoverage = visibleBounds;
      for (const store of stores) {
        const { lat, lng } = store.location;
        if (!allowOutsideWolgye && !isInWolgye1(lat, lng, adminDongRef.current)) continue;
        const selected = store.id === selectedId;
        if (!selected && !visibleBounds.contains([lat, lng])) continue;
        L.marker([lat, lng], { icon: storeIcon(store, selected), title: store.name, zIndexOffset: selected ? 1000 : 0 })
          .on('click', () => onSelectRef.current(store.id))
          .addTo(layer);
      }
    };
    const scheduleRender = () => {
      if (renderedCoverage?.contains(map.getBounds())) return;
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      renderFrame = requestAnimationFrame(render);
    };
    renderedCoverage = null;
    scheduleRender();
    map.on('moveend zoomend', scheduleRender);
    return () => {
      map.off('moveend zoomend', scheduleRender);
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
    };
  }, [stores, selectedId, status, allowOutsideWolgye]);

  // 선택한 가게를 가운데로 옮기는 건 AppShell 이 한다 (가게 창 크기가 정해진 뒤에, centerOn)

  return (
    <div className="mm-root">
      <div ref={containerRef} className="mm-canvas" role="region" aria-label="월계1동 지도" />
      <p className="mm-source">
        © 브이월드 · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
        {placesMonth ? ` · © 소상공인시장진흥공단 ${placesMonth.slice(0, 4)}.${placesMonth.slice(4, 6)}` : ''}
      </p>
      {status === 'loading' && <div className="mm-state" role="status">지도를 불러오는 중…</div>}
      {status === 'missing' && (
        <div className="mm-state" role="alert">
          <strong>지도 데이터를 찾을 수 없어요</strong>
          {import.meta.env.DEV && <span>frontend 폴더에서 <code>npm run fetch:vworld</code> 를 먼저 실행하세요.</span>}
        </div>
      )}
    </div>
  );
});

export default MainMap;
