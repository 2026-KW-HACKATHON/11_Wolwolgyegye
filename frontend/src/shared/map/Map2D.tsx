import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { PathOptions } from 'leaflet';
import type { GeoPoint } from '../../core/types/place';
import type { MainMapHandle, MainMapProps, MapInsets } from './MainMap';
import { buildingGroupsListElement, buildingListElement, clusterGroups, clusterIcon, groupByBuilding, pinGroup, PIN_POPUP_OFFSET, storeIcon, type IconSpec } from './placeMarkers';
import { areaPopupHtml, buildingPopupHtml, escapeHtml, railwayPopupHtml, roadPopupHtml, schoolFacilityPopupHtml, stationLabelHtml, stationPopupHtml, subwayLinePopupHtml } from './popups';
import { EXIT_MIN_ZOOM, longestSubwayLines, normalizeOsmRoad, normalizeRailway, normalizeStationExit, normalizeSubwayLine, type RoadGrade } from './osm/normalize';
import { CAMPUS_LABEL_MIN_ZOOM, campusLabelPoints, ringCentroid } from './vworld/campusLabels';
import { ADMIN_DONG_LABEL, AREA_LAYERS, createStyles, type MapStyles } from './vworld/config';
import { isInWolgye1, withoutOverlaps } from './vworld/geometry';
import { loadData } from './vworld/loadData';
import { normalizeBuilding, visibleSchoolFacilities } from './vworld/normalize';
import { LANDSCAPE_MIN_ZOOM_HEIGHT_RATIO, MAP_CENTER, MAP_EXTENT, MAP_HEIGHT_PER_RECT, portraitMinZoomHeightRatio, WOLGYE1_LAT_SPAN } from './vworld/mapExtent';

type Status = 'loading' | 'ready' | 'missing';

/**
 * 줌 값은 화면 규칙(가게 핀 묶기, 도로 표시, 검색 결과 확대 등)이 모두 Leaflet 기준으로 정해져 있다.
 * MapLibre 는 512px 타일이라 같은 축척이 Leaflet 줌보다 1 작다. 규칙 값을 받을 때는 이만큼 빼서 쓴다.
 */
const LEAFLET_ZOOM_OFFSET = 1;
const glZoom = (leafletZoom: number) => leafletZoom - LEAFLET_ZOOM_OFFSET;
const MAX_ZOOM = glZoom(20);

const blankStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f3efe7' } }],
};

// blob: Worker 가 제한된 인앱 브라우저에서도 동작하도록 번들된 Worker 파일을 명시한다.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

// ---------------------------------------------------------------------
// 범위·줌 계산 (MainMap 의 minZoomFor / centerInVisibleArea 와 같은 규칙을 메르카토르 좌표로)
// ---------------------------------------------------------------------
const mercator = (lng: number, lat: number) => maplibregl.MercatorCoordinate.fromLngLat([lng, lat]);
const EXTENT_MERC = { west: mercator(MAP_EXTENT.west, MAP_CENTER.lat).x, east: mercator(MAP_EXTENT.east, MAP_CENTER.lat).x, north: mercator(MAP_CENTER.lng, MAP_EXTENT.north).y, south: mercator(MAP_CENTER.lng, MAP_EXTENT.south).y };
/** 화면 px 에 메르카토르 길이 units 가 꼭 들어가는 줌 */
const zoomToFit = (px: number, units: number) => Math.log2(px / (units * 512));

/** 가장 많이 축소할 수 있는 줌 (월계1동 세로 비율 기준 / 화면 전체가 지도 범위 안에 들어오는 줌 중 더 확대된 쪽) */
function minZoomFor(map: MapLibreMap, portrait: boolean): number {
  const { clientWidth: width, clientHeight: height } = map.getContainer();
  if (!width || !height) return map.getMinZoom();
  const ratio = portrait ? Math.min(MAP_HEIGHT_PER_RECT, portraitMinZoomHeightRatio(height)) : LANDSCAPE_MIN_ZOOM_HEIGHT_RATIO;
  const span = (WOLGYE1_LAT_SPAN * ratio) / 2;
  const target = mercator(MAP_CENTER.lng, MAP_CENTER.lat - span).y - mercator(MAP_CENTER.lng, MAP_CENTER.lat + span).y;
  const byRatio = zoomToFit(height, target);
  const cover = Math.max(zoomToFit(width, EXTENT_MERC.east - EXTENT_MERC.west), zoomToFit(height, EXTENT_MERC.south - EXTENT_MERC.north)) + 0.001;
  return Math.max(byRatio, cover);
}

/** point 가 탭에 가려지지 않은 영역의 가운데에 오도록 지도 중심을 옮긴다 (minZoom 은 MapLibre 기준) */
function centerInVisibleArea(map: MapLibreMap, point: GeoPoint, insets: MapInsets, minZoom: number) {
  const shift = [(insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2];
  const { clientWidth: width, clientHeight: height } = map.getContainer();
  const at = mercator(point.lng, point.lat);
  const centerAt = (zoom: number) => {
    const scale = 512 * 2 ** zoom;
    return { x: at.x + shift[0] / scale, y: at.y + shift[1] / scale, halfX: width / 2 / scale, halfY: height / 2 / scale };
  };
  // 지도는 범위 밖으로 못 나가서, 줌이 낮으면 가게를 가려지지 않은 곳 가운데로 끌어올 수 없다.
  // 그럴 때는 가운데에 올 수 있을 때까지만 한 단계씩 확대한다
  const fits = (zoom: number) => {
    const c = centerAt(zoom);
    return c.x - c.halfX >= EXTENT_MERC.west && c.x + c.halfX <= EXTENT_MERC.east && c.y - c.halfY >= EXTENT_MERC.north && c.y + c.halfY <= EXTENT_MERC.south;
  };
  const current = map.getZoom();
  let zoom = Math.min(Math.max(current, minZoom), map.getMaxZoom());
  while (!fits(zoom) && zoom < map.getMaxZoom()) zoom = Math.min(zoom + 1, map.getMaxZoom());
  const c = centerAt(zoom);
  const center = new maplibregl.MercatorCoordinate(c.x, c.y).toLngLat();
  if (zoom === current) map.panTo(center);
  else map.easeTo({ center, zoom });
}

interface Box { west: number; east: number; south: number; north: number }
/** 지금 화면을 사방으로 ratio 배 넓힌 범위 */
function paddedBounds(map: MapLibreMap, ratio: number): Box {
  const b = map.getBounds();
  const dx = (b.getEast() - b.getWest()) * ratio;
  const dy = (b.getNorth() - b.getSouth()) * ratio;
  return { west: b.getWest() - dx, east: b.getEast() + dx, south: b.getSouth() - dy, north: b.getNorth() + dy };
}
const boxContains = (box: Box, lat: number, lng: number) => lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east;
const boxCovers = (box: Box, map: MapLibreMap) => {
  const b = map.getBounds();
  return boxContains(box, b.getSouth(), b.getWest()) && boxContains(box, b.getNorth(), b.getEast());
};

// ---------------------------------------------------------------------
// Leaflet 스타일(config.ts) → MapLibre paint
// ---------------------------------------------------------------------
/** Leaflet 점선(px) → MapLibre 점선(선 굵기 배수) */
function dashOf(style: PathOptions): number[] | undefined {
  if (!style.dashArray) return undefined;
  const weight = style.weight ?? 3;
  return String(style.dashArray).split(/[\s,]+/).map(Number).map((n) => n / weight);
}

function linePaint(style: PathOptions, color: ExpressionSpecification | string = style.color ?? '#000') {
  const dash = dashOf(style);
  return {
    'line-color': color,
    'line-width': style.weight ?? 3,
    'line-opacity': style.opacity ?? 1,
    ...(dash ? { 'line-dasharray': dash } : {}),
  };
}

function lineLayout(style: PathOptions) {
  // Leaflet 기본값과 같게 둥근 끝·둥근 꺾임 ('inherit' 같은 Canvas 전용 값은 쓰지 않는다)
  const cap = style.lineCap === 'butt' || style.lineCap === 'square' ? style.lineCap : 'round';
  const join = style.lineJoin === 'bevel' || style.lineJoin === 'miter' ? style.lineJoin : 'round';
  return { 'line-cap': cap, 'line-join': join } as const;
}

const withProps = (features: Feature[], extra: (feature: Feature) => Record<string, unknown>): FeatureCollection => ({
  type: 'FeatureCollection',
  features: features.map((feature) => ({ ...feature, properties: { ...feature.properties, ...extra(feature) } })),
});

/** 렌더러와 상관없는 핀 모양 → MapLibre 마커 (아이콘 왼쪽 위 기준으로 anchor 만큼 당긴다) */
function iconMarker(spec: IconSpec, lng: number, lat: number, zIndex: number, onClick: () => void, title?: string): maplibregl.Marker {
  const element = document.createElement('div');
  element.className = spec.className;
  element.style.width = `${spec.size[0]}px`;
  element.style.height = `${spec.size[1]}px`;
  element.style.zIndex = String(zIndex);
  element.innerHTML = spec.html;
  element.tabIndex = 0;
  element.setAttribute('role', 'button');
  if (title) element.title = title;
  element.addEventListener('click', (event) => {
    // 지도 click(빈 곳 누르면 팝업 닫기, 도형 팝업)까지 가지 않게 한다
    event.stopPropagation();
    onClick();
  });
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onClick();
  });
  return new maplibregl.Marker({ element, anchor: 'top-left', offset: [-spec.anchor[0], -spec.anchor[1]] }).setLngLat([lng, lat]);
}

/** 지도 위에 늘 떠 있는 글자 라벨 (경계 이름·캠퍼스 건물·역·출구). 크기 0 자리 가운데에 놓는다 */
function labelMarker(className: string, html: string, lng: number, lat: number, zIndex: number): maplibregl.Marker {
  const element = document.createElement('div');
  element.className = className;
  element.style.zIndex = String(zIndex);
  element.innerHTML = html;
  return new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]);
}

const pointOf = (feature: Feature): [number, number] | null => feature.geometry?.type === 'Point' ? (feature.geometry as Point).coordinates as [number, number] : null;

/** 지도 위 z-index (DOM 마커끼리). 라벨 < 역 < 상가정보 핀 < 추천 가게 핀 */
const Z = { label: 1, station: 2, place: 10, placeSelected: 510, store: 20, storeSelected: 1020, mine: 2020 };

/**
 * 앱 전체 배경 지도의 평면(2D) 버전. MainMap(Leaflet) 과 같은 데이터·같은 표시 규칙을 MapLibre(WebGL)로 그린다.
 * Leaflet Canvas 는 화면 근처만 미리 그려 두어 축소할 때 가장자리가 늦게 채워졌는데,
 * MapLibre 는 전체 데이터를 GPU 에 올려 두고 매 프레임 그리므로 축소해도 빈 곳이 생기지 않는다.
 * WebGL 을 못 쓰는 기기에서는 HybridMap 이 MainMap(Leaflet) 을 대신 쓴다.
 *
 * 그리는 순서 (아래 → 위): 영역 → 도로 → 철도 → 건물 → 학교 건물 → 가게 있는 건물 테두리 → 지하철 노선 → 월계1동 경계 점선 → 내 위치
 * DOM 마커: 경계·캠퍼스 이름표 → 역·출구 → 상가정보 핀 → 추천 가게 핀
 */
const Map2D = forwardRef<MainMapHandle, MainMapProps>(function Map2D({ stores, selectedId, onSelect, getInsets, showZoomControl, portrait, places, selectedPlaceId, onPlaceSelect, placesMonth, allowOutsideWolgye = false, smallPins = false, myStoreIds, markerStyle = 'signboard' }, ref) {
  // 배열은 렌더마다 새로 만들어지므로 내용(id 목록)이 바뀔 때만 핀을 다시 그린다
  const myStoreKey = (myStoreIds ?? []).join(',');
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  /** CSS 변수 읽기 (가게 핀 색을 건물 테두리에도 쓴다) */
  const cssRef = useRef<(name: string) => string>(() => '');
  const adminDongRef = useRef<FeatureCollection | null>(null);
  const pendingLocationRef = useRef<GeoPoint | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onPlaceSelectRef = useRef(onPlaceSelect);
  onPlaceSelectRef.current = onPlaceSelect;
  const getInsetsRef = useRef(getInsets);
  getInsetsRef.current = getInsets;
  const portraitRef = useRef(portrait);
  portraitRef.current = portrait;
  const [status, setStatus] = useState<Status>('loading');

  /** 팝업은 한 번에 하나 (Leaflet openOn 처럼) */
  const openPopup = (popup: maplibregl.Popup) => {
    popupRef.current?.remove();
    popupRef.current = popup;
    popup.addTo(mapRef.current!);
  };
  const closePopup = () => {
    popupRef.current?.remove();
    popupRef.current = null;
  };

  useImperativeHandle(ref, () => ({
    centerOn(point, insets, minZoom) {
      const map = mapRef.current;
      if (!map) return false;
      centerInVisibleArea(map, point, insets, minZoom === undefined ? 0 : glZoom(minZoom));
      return true;
    },
    showMyLocation(point) {
      pendingLocationRef.current = point;
      const source = mapRef.current?.getSource('my-location') as GeoJSONSource | undefined;
      source?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [point.lng, point.lat] } }] });
    },
  }), []);

  // 1) 지도 만들기 + 데이터 읽어 그리기 (앱이 켜져 있는 동안 한 번)
  useEffect(() => {
    const root = rootRef.current;
    const container = containerRef.current;
    if (!root || !container) return;
    let cancelled = false;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

    const map = new maplibregl.Map({
      container,
      style: blankStyle,
      center: [MAP_CENTER.lng, MAP_CENTER.lat],
      zoom: glZoom(15),
      maxZoom: MAX_ZOOM,
      maxBounds: [[MAP_EXTENT.west, MAP_EXTENT.south], [MAP_EXTENT.east, MAP_EXTENT.north]],
      // 평면 지도: 기울이기·회전 없음
      pitch: 0,
      maxPitch: 0,
      bearing: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      renderWorldCopies: false,
      attributionControl: false, // 출처는 .mm-source 라벨로 직접 표시 (아래쪽에 작게)
      fadeDuration: 0,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    mapRef.current = map;
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    const fitMinZoom = () => {
      const minZoom = minZoomFor(map, portraitRef.current);
      map.setMinZoom(minZoom);
      if (map.getZoom() < minZoom) map.jumpTo({ zoom: minZoom });
    };
    // 처음에는 가장 많이 축소한 화면 (MainMap 과 같다)
    fitMinZoom();
    map.jumpTo({ center: [MAP_CENTER.lng, MAP_CENTER.lat], zoom: map.getMinZoom() });
    // 화면 회전·창 크기·탭 배치가 바뀌면 다시 맞추고, 가장 많이 축소할 수 있는 줌도 다시 계산한다
    let resizeFrame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        map.resize();
        fitMinZoom();
      });
    });
    observer.observe(container);

    const read = getComputedStyle(root);
    const css = (name: string) => read.getPropertyValue(name).trim();
    cssRef.current = css;
    const styles: MapStyles = createStyles(css);

    // 드래그·핀치 중에는 CSS 그림자와 필터를 잠시 빼 GPU 합성 비용을 줄인다.
    let interactionFrame: number | null = null;
    const interactionStart = () => {
      if (interactionFrame !== null) cancelAnimationFrame(interactionFrame);
      interactionFrame = null;
      container.classList.add('is-interacting');
    };
    const interactionEnd = () => {
      interactionFrame = requestAnimationFrame(() => {
        interactionFrame = null;
        container.classList.remove('is-interacting');
      });
    };
    map.on('movestart', interactionStart);
    map.on('moveend', interactionEnd);

    const labelMarkers: { marker: maplibregl.Marker; minZoom: number }[] = [];
    const updateLabelVisibility = () => {
      const zoom = map.getZoom();
      for (const { marker, minZoom } of labelMarkers) marker.getElement().style.display = zoom >= minZoom ? '' : 'none';
    };

    const loaded = new Promise<void>((resolve) => map.once('load', () => resolve()));
    void Promise.all([loadData(), loaded]).then(([data]) => {
      if (cancelled) return;
      if (!data) { setStatus('missing'); return; }

      map.setPaintProperty('background', 'background-color', css('--map-bg') || '#f3efe7');
      /** 누르면 팝업을 띄우는 레이어 → 팝업 HTML */
      const popupLayers = new Map<string, (feature: MapGeoJSONFeature) => string>();

      // 영역: 학교 → 아파트 단지 → 강·하천 → 산 (테두리 없이 면만)
      for (const config of AREA_LAYERS) {
        const geojson = data.areas[config.key];
        if (!geojson) continue;
        const style = styles.AREA_STYLES[config.key];
        const id = `area-${config.key}`;
        map.addSource(id, { type: 'geojson', data: geojson });
        map.addLayer({ id, source: id, type: 'fill', paint: { 'fill-color': style.fillColor ?? '#ccc', 'fill-opacity': style.fillOpacity ?? 1, 'fill-antialias': false } });
        if (config.popup !== false) popupLayers.set(id, (feature) => areaPopupHtml(config.label, config.normalize(feature)));
      }

      // 도로: 등급별 한 레이어씩. 키 순서 = 그리는 순서 (넓은 길이 좁은 길을 덮는다). 등급별 최소 줌 미만은 그리지 않는다
      if (data.roads) {
        map.addSource('roads', { type: 'geojson', data: withProps(data.roads.features || [], (f) => ({ _grade: normalizeOsmRoad(f).grade ?? '' })) });
        for (const [grade, { minZoom, ...style }] of Object.entries(styles.ROAD_STYLES) as [RoadGrade, MapStyles['ROAD_STYLES'][RoadGrade]][]) {
          const id = `road-${grade}`;
          map.addLayer({ id, source: 'roads', type: 'line', filter: ['==', ['get', '_grade'], grade], ...(minZoom > 0 ? { minzoom: glZoom(minZoom) } : {}), layout: lineLayout(style), paint: linePaint(style) });
          popupLayers.set(id, (feature) => roadPopupHtml(normalizeOsmRoad(feature)));
        }
      }

      // 철도: 바탕 선 위에 흰 점선 (지하 구간은 그리지 않는다)
      if (data.railways) {
        map.addSource('railways', { type: 'geojson', data: { type: 'FeatureCollection', features: (data.railways.features || []).filter((f) => !normalizeRailway(f).underground) } });
        map.addLayer({ id: 'railway-base', source: 'railways', type: 'line', layout: lineLayout(styles.RAILWAY_BASE_STYLE), paint: linePaint(styles.RAILWAY_BASE_STYLE) });
        map.addLayer({ id: 'railway-dash', source: 'railways', type: 'line', layout: lineLayout(styles.RAILWAY_DASH_STYLE), paint: linePaint(styles.RAILWAY_DASH_STYLE) });
        popupLayers.set('railway-base', (feature) => railwayPopupHtml(feature));
      }

      // 건물: 학교 건물과 겹치는 일반 건물은 빼고, 학교 건물을 그 위에 그린다. 마우스를 올리면 색을 바꾼다
      const schoolBuildings = visibleSchoolFacilities(data.schoolFacilities);
      const buildingFill = (style: PathOptions): ExpressionSpecification => ['case', ['boolean', ['feature-state', 'hover'], false], styles.BUILDING_HOVER_STYLE.fillColor ?? '#ccc', style.fillColor ?? '#ccc'];
      const buildingOpacity: ExpressionSpecification = ['case', ['boolean', ['feature-state', 'hover'], false], styles.BUILDING_HOVER_STYLE.fillOpacity ?? 1, styles.BUILDING_STYLE.fillOpacity ?? 1];
      map.addSource('buildings', { type: 'geojson', data: { type: 'FeatureCollection', features: withoutOverlaps(data.buildings.features || [], schoolBuildings) }, generateId: true });
      map.addSource('school-buildings', { type: 'geojson', data: { type: 'FeatureCollection', features: schoolBuildings }, generateId: true });
      for (const [id, source] of [['buildings', 'buildings'], ['school-buildings', 'school-buildings']] as const) {
        map.addLayer({ id, source, type: 'fill', paint: { 'fill-color': buildingFill(styles.BUILDING_STYLE), 'fill-opacity': buildingOpacity } });
        map.addLayer({ id: `${id}-line`, source, type: 'line', paint: linePaint(styles.BUILDING_STYLE) });
      }
      popupLayers.set('buildings', (feature) => buildingPopupHtml(normalizeBuilding(feature)));
      popupLayers.set('school-buildings', (feature) => schoolFacilityPopupHtml(feature));
      // 가게 핀이 있는 건물 테두리 (색은 아래 effect 가 핀 색으로 채운다)
      map.addLayer({ id: 'building-outlines', source: 'buildings', type: 'line', filter: ['in', ['to-string', ['get', 'bd_mgt_sn']], ['literal', []]], paint: linePaint(styles.BUILDING_OUTLINE_STYLE, '#000') });

      // 지하철 노선: 철도·건물 위에 얇게, 노선 색으로
      if (data.subwayLines) {
        const fallback = styles.SUBWAY_LINE_STYLE.color ?? '#888';
        map.addSource('subway-lines', { type: 'geojson', data: withProps(longestSubwayLines(data.subwayLines), (f) => ({ _colour: normalizeSubwayLine(f).colour || fallback })) });
        map.addLayer({ id: 'subway-lines', source: 'subway-lines', type: 'line', layout: lineLayout(styles.SUBWAY_LINE_STYLE), paint: linePaint(styles.SUBWAY_LINE_STYLE, ['get', '_colour']) });
        popupLayers.set('subway-lines', (feature) => subwayLinePopupHtml(feature));
      }

      // 역 이름표 + 출구(확대했을 때만, 역과 점선으로 잇는다)
      if (data.stations) {
        const stationPoints = new Map<string, [number, number]>();
        for (const feature of data.stations.features || []) {
          const at = pointOf(feature);
          if (!at) continue;
          stationPoints.set(String(feature.id ?? ''), at);
          const marker = labelMarker('st-wrap', stationLabelHtml(feature), at[0], at[1], Z.station).addTo(map);
          marker.getElement().addEventListener('click', (event) => {
            event.stopPropagation();
            openPopup(new maplibregl.Popup({ offset: 12 }).setLngLat(at).setHTML(stationPopupHtml(feature)));
          });
        }
        const links: Feature[] = [];
        for (const feature of data.stationExits?.features || []) {
          const at = pointOf(feature);
          if (!at) continue;
          const { number, stationId } = normalizeStationExit(feature);
          const station = stationPoints.get(stationId);
          if (station) links.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [station, at] } });
          const marker = labelMarker('st-wrap', `<span class="st-exit">${escapeHtml(number || '출구')}</span>`, at[0], at[1], Z.station).addTo(map);
          marker.getElement().style.pointerEvents = 'none';
          labelMarkers.push({ marker, minZoom: glZoom(EXIT_MIN_ZOOM) });
        }
        map.addSource('station-exit-links', { type: 'geojson', data: { type: 'FeatureCollection', features: links } });
        map.addLayer({ id: 'station-exit-links', source: 'station-exit-links', type: 'line', minzoom: glZoom(EXIT_MIN_ZOOM), paint: linePaint(styles.STATION_EXIT_LINK_STYLE) });
      }

      // 월계1동 경계 점선 + 이름 (클릭은 아래로 통과)
      if (data.adminDong) {
        map.addSource('admin-dong', { type: 'geojson', data: data.adminDong });
        map.addLayer({ id: 'admin-dong', source: 'admin-dong', type: 'line', layout: lineLayout(styles.ADMIN_DONG_STYLE), paint: linePaint(styles.ADMIN_DONG_STYLE) });
        const geometry = data.adminDong.features[0]?.geometry;
        const ring = geometry?.type === 'Polygon' ? geometry.coordinates[0] : geometry?.type === 'MultiPolygon' ? geometry.coordinates[0][0] : null;
        if (ring) {
          const center = ringCentroid(ring);
          labelMarker('map-label boundary-label admin-dong-label', escapeHtml(ADMIN_DONG_LABEL), center.lng, center.lat, Z.label).addTo(map).getElement().style.pointerEvents = 'none';
        }
      }
      adminDongRef.current = data.adminDong;

      // 광운대 건물 이름 (확대했을 때만)
      for (const { name, at } of campusLabelPoints(data.buildings)) {
        const marker = labelMarker('map-label campus-label', escapeHtml(name), at[1], at[0], Z.label).addTo(map);
        marker.getElement().style.pointerEvents = 'none';
        labelMarkers.push({ marker, minZoom: glZoom(CAMPUS_LABEL_MIN_ZOOM) });
      }
      map.on('zoom', updateLabelVisibility);
      updateLabelVisibility();

      // 내 위치 점
      map.addSource('my-location', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'my-location', source: 'my-location', type: 'circle', paint: { 'circle-radius': 8, 'circle-color': css('--map-me') || '#1a73e8', 'circle-stroke-color': css('--map-me-ring') || '#fff', 'circle-stroke-width': 3 } });
      if (pendingLocationRef.current) {
        const point = pendingLocationRef.current;
        (map.getSource('my-location') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [point.lng, point.lat] } }] });
      }

      // 도형 누르기: 맨 위 도형 하나만 팝업. 빈 곳을 누르면 열린 팝업을 닫는다
      const interactive = [...popupLayers.keys()];
      const topFeature = (event: MapMouseEvent) => map.queryRenderedFeatures(event.point, { layers: interactive })[0];
      map.on('click', (event) => {
        const feature = topFeature(event);
        const html = feature ? popupLayers.get(feature.layer.id)?.(feature) : '';
        if (!html) { closePopup(); return; }
        openPopup(new maplibregl.Popup().setLngLat(event.lngLat).setHTML(html));
      });

      // PC: 누를 수 있는 도형 위에서는 손가락 커서, 건물은 색을 바꾼다
      if (!coarsePointer) {
        let hovered: { source: string; id: string | number } | null = null;
        const setHover = (next: typeof hovered) => {
          if (hovered && (hovered.source !== next?.source || hovered.id !== next?.id)) map.setFeatureState(hovered, { hover: false });
          if (next) map.setFeatureState(next, { hover: true });
          hovered = next;
        };
        map.on('mousemove', (event) => {
          const feature = topFeature(event);
          map.getCanvas().style.cursor = feature ? 'pointer' : '';
          const building = feature && (feature.layer.id === 'buildings' || feature.layer.id === 'school-buildings') && feature.id !== undefined;
          setHover(building ? { source: feature.layer.id, id: feature.id! } : null);
        });
        map.on('mouseout', () => setHover(null));
      }

      setStatus('ready');
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      if (interactionFrame !== null) cancelAnimationFrame(interactionFrame);
      popupRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // 세로 ↔ 가로 화면이 바뀌면 가장 많이 축소할 수 있는 줌을 다시 계산한다
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const minZoom = minZoomFor(map, portrait);
    map.setMinZoom(minZoom);
    if (map.getZoom() < minZoom) map.easeTo({ zoom: minZoom });
  }, [portrait]);

  // 2) 확대·축소 버튼 — PC 에서만, 왼쪽 아래
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showZoomControl) return;
    const control = new maplibregl.NavigationControl({ showCompass: false, showZoom: true });
    map.addControl(control, 'bottom-left');
    // 지도가 먼저 없어졌으면(map.remove 가 컨트롤도 같이 뗀다) 다시 떼지 않는다
    return () => { if (mapRef.current === map) map.removeControl(control); };
  }, [showZoomControl]);

  // 상가정보 가게 핀 — 월계1동 안의 가게만, 건물 단위로 묶고(가게 수 숫자), 줌을 줄이면 가까운 건물끼리 묶는다
  // 경계는 지도 데이터를 읽은 뒤(status 'ready') 알 수 있어서 status 가 바뀌면 다시 거른다
  const buildingGroups = useMemo(() => groupByBuilding(allowOutsideWolgye ? places
    : places.filter((place) => isInWolgye1(place.lat, place.lng, adminDongRef.current))), [places, allowOutsideWolgye, status]);

  // 핀이 있는 건물은 테두리를 그 핀 색으로 칠한다
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;
    const colors = new Map<string, string>();
    for (const group of buildingGroups) {
      const buildingId = group.places.find((p) => p.buildingId)?.buildingId;
      if (buildingId) colors.set(buildingId, cssRef.current(`--place-${pinGroup(group.places)}`));
    }
    const ids = [...colors.keys()];
    map.setFilter('building-outlines', ['in', ['to-string', ['get', 'bd_mgt_sn']], ['literal', ids]] as FilterSpecification);
    map.setPaintProperty('building-outlines', 'line-color', ids.length
      ? ['match', ['to-string', ['get', 'bd_mgt_sn']], ...[...colors].flat(), '#000'] as ExpressionSpecification
      : '#000');
  }, [buildingGroups, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let markers: maplibregl.Marker[] = [];
    let renderFrame: number | null = null;
    let renderedCoverage: Box | null = null;
    const render = () => {
      renderFrame = null;
      markers.forEach((marker) => marker.remove());
      markers = [];
      // 이동 중에는 기존 핀을 그대로 움직이고, 손을 뗀 뒤 현재 화면 주변만 다시 만든다.
      // 여유 영역을 넉넉히 둬 빠르게 드래그해도 가장자리에 빈 구간이 보이지 않게 한다.
      const visible = paddedBounds(map, 0.45);
      renderedCoverage = visible;
      const visibleGroups = buildingGroups.filter((group) => (
        boxContains(visible, group.lat, group.lng)
        || (selectedPlaceId !== null && group.places.some((place) => place.id === selectedPlaceId))
      ));
      const zoom = map.getZoom() + LEAFLET_ZOOM_OFFSET; // 묶기 규칙은 Leaflet 줌 기준
      for (const cluster of clusterGroups((lat, lng) => map.project([lng, lat]), zoom, visibleGroups)) {
        const selected = selectedPlaceId !== null && cluster.groups.some((g) => g.places.some((p) => p.id === selectedPlaceId));
        const [group] = cluster.groups;
        let onClick: () => void;
        if (cluster.groups.length > 1) {
          // 축소 상태의 숫자 핀도 바로 건물 → 층 → 가게 순서로 확인한다.
          onClick = () => {
            const list = buildingGroupsListElement(cluster.groups, (place) => { closePopup(); onPlaceSelectRef.current(place); });
            openPopup(new maplibregl.Popup({ className: 'pl-popup', maxWidth: '320px', offset: 18 }).setLngLat([cluster.lng, cluster.lat]).setDOMContent(list));
          };
        } else if (group.places.length === 1) {
          // 가게 1곳: 바로 그 가게
          onClick = () => onPlaceSelectRef.current(group.places[0]);
        } else {
          // 한 건물에 여럿: 층별 목록을 먼저 띄우고, 목록에서 고른 가게만 연다
          onClick = () => {
            const list = buildingListElement(group, (place) => { closePopup(); onPlaceSelectRef.current(place); });
            openPopup(new maplibregl.Popup({ className: 'pl-popup', maxWidth: '280px', offset: PIN_POPUP_OFFSET }).setLngLat([group.lng, group.lat]).setDOMContent(list));
          };
        }
        markers.push(iconMarker(clusterIcon(cluster, selected), cluster.lng, cluster.lat, selected ? Z.placeSelected : Z.place, onClick).addTo(map));
      }
    };
    const scheduleRender = (force: boolean) => {
      if (!force && renderedCoverage && boxCovers(renderedCoverage, map)) return;
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      renderFrame = requestAnimationFrame(render);
    };
    // 줌이 바뀌면 묶음이 달라지므로 항상, 이동만 했으면 그려 둔 범위를 벗어났을 때만 다시 그린다
    let lastZoom = map.getZoom();
    const renderAfterMove = () => {
      const zoomChanged = map.getZoom() !== lastZoom;
      lastZoom = map.getZoom();
      scheduleRender(zoomChanged);
    };
    scheduleRender(true);
    map.on('moveend', renderAfterMove);
    return () => {
      map.off('moveend', renderAfterMove);
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      markers.forEach((marker) => marker.remove());
    };
  }, [buildingGroups, selectedPlaceId, status]);

  // 3) 가게 핀 — 월계1동 안의 가게만 (내 가게는 밖이어도)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const myIds = new Set(myStoreKey ? myStoreKey.split(',') : []);
    let markers: maplibregl.Marker[] = [];
    let renderFrame: number | null = null;
    let renderedCoverage: Box | null = null;
    const render = () => {
      renderFrame = null;
      markers.forEach((marker) => marker.remove());
      markers = [];
      const visible = paddedBounds(map, 0.45);
      renderedCoverage = visible;
      for (const store of stores) {
        const { lat, lng } = store.location;
        const mine = myIds.has(store.id);
        if (!mine && !allowOutsideWolgye && !isInWolgye1(lat, lng, adminDongRef.current)) continue;
        const selected = store.id === selectedId;
        if (!selected && !mine && !boxContains(visible, lat, lng)) continue;
        const z = mine ? Z.mine : selected ? Z.storeSelected : Z.store;
        markers.push(iconMarker(storeIcon(store, selected, smallPins, mine), lng, lat, z, () => onSelectRef.current(store.id), mine ? `내 가게: ${store.name}` : store.name).addTo(map));
      }
    };
    const scheduleRender = () => {
      if (renderedCoverage && boxCovers(renderedCoverage, map)) return;
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      renderFrame = requestAnimationFrame(render);
    };
    scheduleRender();
    map.on('moveend', scheduleRender);
    return () => {
      map.off('moveend', scheduleRender);
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      markers.forEach((marker) => marker.remove());
    };
  }, [stores, selectedId, status, allowOutsideWolgye, smallPins, myStoreKey]);

  // 선택한 가게를 가운데로 옮기는 건 AppShell 이 한다 (가게 창 크기가 정해진 뒤에, centerOn)

  return (
    <div ref={rootRef} className="mm-root mm-root--gl2d" data-marker-style={markerStyle}>
      <div ref={containerRef} className="mm-canvas mm-maplibre" role="region" aria-label="월계1동 지도" />
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

export default Map2D;
