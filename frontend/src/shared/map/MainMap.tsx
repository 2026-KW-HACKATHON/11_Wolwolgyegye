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
  /** point 를 보이는 지도 영역의 가운데로 옮긴다. 지도가 아직 없으면 false */
  centerOn(point: GeoPoint, insets: MapInsets): boolean;
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
function centerInVisibleArea(map: L.Map, point: GeoPoint, insets: MapInsets) {
  const zoom = map.getZoom();
  const target = map.project([point.lat, point.lng], zoom).add([(insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2]);
  map.panTo(map.unproject(target, zoom));
}

/** 내 위치 점 (Canvas 로 그려져 CSS 클래스가 적용되지 않으므로 색을 직접 지정) */
const MY_LOCATION_STYLE: L.CircleMarkerOptions = { radius: 8, color: '#ffffff', weight: 3, fillColor: '#2f7cf6', fillOpacity: 1, interactive: false };

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
const MainMap = forwardRef<MainMapHandle, MainMapProps>(function MainMap({ stores, selectedId, onSelect, getInsets, showZoomControl, portrait, places, selectedPlaceId, onPlaceSelect, placesMonth }, ref) {
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
    centerOn(point, insets) {
      const map = mapRef.current;
      if (!map) return false;
      centerInVisibleArea(map, point, insets);
      return true;
    },
    showMyLocation(point) {
      const map = mapRef.current;
      if (!map) return;
      if (meRef.current) meRef.current.setLatLng([point.lat, point.lng]);
      else meRef.current = L.circleMarker([point.lat, point.lng], MY_LOCATION_STYLE).addTo(map);
    },
  }), []);

  // 1) 지도 만들기 + 데이터 읽어 그리기 (앱이 켜져 있는 동안 한 번)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

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
    const ctx: DrawContext = {
      map,
      featureRenderer: L.canvas(),
      boundaryRenderer: L.canvas({ pane: 'boundary' }),
      styles: createStyles((name) => read.getPropertyValue(name).trim()),
    };

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
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      const minZoom = minZoomFor(map, portraitRef.current);
      map.setMinZoom(minZoom);
      if (map.getZoom() < minZoom) map.setZoom(minZoom);
    });
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
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
      const buildingId = group.places[0]?.buildingId;
      if (buildingId) colors.set(buildingId, cssRef.current(`--place-${pinGroup(group.places)}`));
    }
    outlines.set(colors);
  }, [buildingGroups, status]);
  useEffect(() => {
    const map = mapRef.current;
    const layer = placeLayerRef.current;
    if (!map || !layer) return;
    const render = () => {
      layer.clearLayers();
      for (const cluster of clusterGroups(map, buildingGroups)) {
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
    render();
    map.on('zoomend', render);
    return () => { map.off('zoomend', render); };
  }, [buildingGroups, selectedPlaceId, status]);

  // 3) 가게 핀 — 월계1동 안의 가게만
  useEffect(() => {
    const layer = pinLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const store of stores) {
      const { lat, lng } = store.location;
      if (!isInWolgye1(lat, lng, adminDongRef.current)) continue;
      const selected = store.id === selectedId;
      L.marker([lat, lng], { icon: storeIcon(store, selected), title: store.name, zIndexOffset: selected ? 1000 : 0 })
        .on('click', () => onSelectRef.current(store.id))
        .addTo(layer);
    }
  }, [stores, selectedId, status]);

  // 4) 선택한 가게를 보이는 영역 가운데로
  useEffect(() => {
    const map = mapRef.current;
    const store = stores.find((item) => item.id === selectedId);
    if (map && store) centerInVisibleArea(map, store.location, getInsetsRef.current());
  }, [selectedId, stores]);

  return (
    <div className="mm-root">
      <div ref={containerRef} className="mm-canvas" role="region" aria-label="월계1동 지도" />
      <p className="mm-source">데이터 © 브이월드 · 도로 © OpenStreetMap{placesMonth ? ` · 상가정보 © 소상공인시장진흥공단 (${placesMonth.slice(0, 4)}.${placesMonth.slice(4, 6)})` : ''}</p>
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
