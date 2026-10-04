// ---------------------------------------------------------------------
// 레이어 그리기 — V_World/main.js 의 "레이어 그리기" 부분을 옮긴 것.
// 원본은 전역 map·renderer 를 썼고, 여기서는 DrawContext 로 받는다.
// ---------------------------------------------------------------------
import L from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import { normalizeOsmRoad, normalizeRailway, type RoadGrade, type RoadInfo } from '../osm/normalize';
import { NO_INFO, ROAD_GRADE_LABELS, SCHOOL_FACILITY_LABELS, type AreaLayerConfig, type MapStyles } from './config';
import { withoutOverlaps } from './geometry';
import { normalizeBuilding, normalizeSchoolFacility, type AreaInfo, type BuildingInfo } from './normalize';

export interface DrawContext {
  map: L.Map;
  /** 영역·도로·건물을 "추가한 순서대로" 그리는 Canvas 하나 (pane 마다 나누면 위 Canvas 가 클릭을 가로챈다) */
  featureRenderer: L.Canvas;
  /** 경계 점선용 Canvas (pane 'boundary', 마우스 이벤트 통과) */
  boundaryRenderer: L.Canvas;
  styles: MapStyles;
}

/** 팝업에 넣을 문자열의 HTML 특수문자를 이스케이프 */
function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** 영역 하나(산/강/학교/아파트)를 그린다. 클릭하면 이름과 설명을 보여준다 */
export function drawArea(ctx: DrawContext, config: AreaLayerConfig, geojson: FeatureCollection) {
  return L.geoJSON(geojson, {
    renderer: ctx.featureRenderer,
    style: ctx.styles.AREA_STYLES[config.key],
    onEachFeature(feature, sublayer) {
      const info = config.normalize(feature);
      sublayer.bindPopup(() => areaPopupHtml(config.label, info));
    },
  } as L.GeoJSONOptions).addTo(ctx.map);
}

function areaPopupHtml(label: string, { title, lines }: AreaInfo) {
  // 줄마다 이스케이프한 뒤 <br> 로 잇는다 (빈 줄은 뺀다)
  const detailHtml = (lines || []).filter(Boolean).map(escapeHtml).join('<br>');
  return `
    <div class="popup-kind">${escapeHtml(label)}</div>
    <div class="popup-title">${escapeHtml(title || NO_INFO)}</div>
    ${detailHtml ? `<div>${detailHtml}</div>` : ''}`;
}

/**
 * 도로(OpenStreetMap)를 등급별 레이어로 나눠 그린다. (ROAD_STYLES 순서대로 추가 = 그 순서로 겹쳐 그림)
 * 등급이 없는 도로(모르는 종류, 지하차도)는 그리지 않는다.
 * LineString, MultiLineString 모두 L.geoJSON 이 그대로 처리한다.
 * minZoom 미만인 등급은 지도에 넣어둔 채 투명하게만 바꾼다.
 * (지도에서 뺐다가 다시 넣으면 Canvas 그리기 순서상 건물 위로 올라오기 때문)
 */
export function drawRoads(ctx: DrawContext, roadsGeoJSON: FeatureCollection) {
  const { map, styles } = ctx;
  const grades = Object.keys(styles.ROAD_STYLES) as RoadGrade[];
  const layers = {} as Record<RoadGrade, L.GeoJSON>;
  for (const grade of grades) {
    const { minZoom, ...style } = styles.ROAD_STYLES[grade];
    layers[grade] = L.geoJSON(undefined, {
      renderer: ctx.featureRenderer,
      style,
      onEachFeature(feature, sublayer) {
        const info = normalizeOsmRoad(feature);
        // 숨겨진(투명한) 도로는 클릭해도 팝업을 띄우지 않는다
        sublayer.on('click', (e: L.LeafletMouseEvent) => {
          if (map.getZoom() < minZoom) return;
          L.popup().setLatLng(e.latlng).setContent(roadPopupHtml(info)).openOn(map);
        });
      },
    } as L.GeoJSONOptions);
  }
  for (const feature of roadsGeoJSON.features || []) {
    const { grade } = normalizeOsmRoad(feature);
    if (grade) layers[grade].addData(feature);
  }
  for (const grade of grades) layers[grade].addTo(map);
  return layers;
}

function roadPopupHtml({ name, grade, widthM, lanes, bridge }: RoadInfo) {
  const rows = [
    ['구분', `${grade ? ROAD_GRADE_LABELS[grade] : NO_INFO}${bridge ? ' (다리)' : ''}`],
    ['도로폭', widthM === null ? NO_INFO : `${widthM}m`],
    ['차로수', lanes === null ? NO_INFO : `${lanes}차로`],
  ];
  return `
    <div class="popup-kind">도로</div>
    <div class="popup-title">${escapeHtml(name || '이름 없는 도로')}</div>
    <table class="popup-table">
      ${rows.map(([k, v]) => `<tr><td>${k}</td><td>${escapeHtml(v)}</td></tr>`).join('')}
    </table>`;
}

/**
 * 철도(OpenStreetMap)를 그린다. 바탕 선 위에 흰 점선을 겹쳐 철길처럼 보이게 한다.
 * 지하 구간은 그리지 않는다. 클릭하면 노선 이름을 보여준다.
 */
export function drawRailways(ctx: DrawContext, railwaysGeoJSON: FeatureCollection) {
  const above: FeatureCollection = { type: 'FeatureCollection', features: (railwaysGeoJSON.features || []).filter((f) => !normalizeRailway(f).underground) };
  L.geoJSON(above, {
    renderer: ctx.featureRenderer,
    style: ctx.styles.RAILWAY_BASE_STYLE,
    onEachFeature(feature, sublayer) {
      const { name, kindLabel } = normalizeRailway(feature);
      sublayer.bindPopup(() => `
        <div class="popup-kind">${escapeHtml(kindLabel)}</div>
        <div class="popup-title">${escapeHtml(name || '이름 없는 노선')}</div>`);
    },
  } as L.GeoJSONOptions).addTo(ctx.map);
  L.geoJSON(above, { renderer: ctx.featureRenderer, style: ctx.styles.RAILWAY_DASH_STYLE, interactive: false } as L.GeoJSONOptions).addTo(ctx.map);
}

/** 건물 테두리 색칠 (가게 핀이 있는 건물) */
export interface BuildingOutlines {
  /** 건물관리번호 → 테두리 색. 목록에 없는 건물은 원래 테두리로 돌아간다 */
  set: (colors: Map<string, string>) => void;
}

/**
 * 일반 건물(도로명주소 건물)을 그린다.
 * hiddenBy 에 준 건물(학교 건물)과 겹치는 건물은 빼서, 같은 건물이 두 번 겹쳐 그려지지 않게 한다.
 * 돌려주는 outlines 로 가게가 있는 건물의 테두리를 핀 색으로 칠한다.
 */
export function drawBuildings(ctx: DrawContext, buildingsGeoJSON: FeatureCollection, hiddenBy: Feature[] = []): BuildingOutlines {
  const visible: FeatureCollection = hiddenBy.length
    ? { type: 'FeatureCollection', features: withoutOverlaps(buildingsGeoJSON.features || [], hiddenBy) }
    : buildingsGeoJSON;
  const byId = new Map<string, L.Path>();
  const outlined = new Map<L.Path, string>();
  const restyle = (path: L.Path) => {
    layer.resetStyle(path);
    const color = outlined.get(path);
    if (color) path.setStyle({ ...ctx.styles.BUILDING_OUTLINE_STYLE, color });
  };
  const layer: L.GeoJSON = L.geoJSON(visible, {
    renderer: ctx.featureRenderer,
    style: ctx.styles.BUILDING_STYLE,
    onEachFeature(feature, sublayer) {
      const info = normalizeBuilding(feature);
      const path = sublayer as L.Path;
      if (info.id) byId.set(info.id, path);
      path.bindPopup(() => buildingPopupHtml(info));
      path.on('mouseover', () => path.setStyle(ctx.styles.BUILDING_HOVER_STYLE));
      path.on('mouseout', () => restyle(path));
    },
  } as L.GeoJSONOptions);
  layer.addTo(ctx.map);

  return {
    set(colors) {
      const previous = [...outlined.keys()];
      outlined.clear();
      for (const [id, color] of colors) {
        const path = byId.get(id);
        if (path) outlined.set(path, color);
      }
      for (const path of new Set([...previous, ...outlined.keys()])) restyle(path);
    },
  };
}

/** 지도에 그리는 학교 건물 (종류를 알 수 있는 건물만) */
export function visibleSchoolFacilities(geojson: FeatureCollection | null): Feature[] {
  return (geojson?.features || []).filter((feature) => normalizeSchoolFacility(feature).kind !== null);
}

/**
 * 학교 안 건물을 그린다. 색은 일반 건물과 같고, 누르면 학교 이름과 건물 종류를 보여준다.
 * 겹치는 일반 건물은 drawBuildings 가 미리 뺀다.
 */
export function drawSchoolFacilities(ctx: DrawContext, facilities: Feature[]) {
  const layer: L.GeoJSON = L.geoJSON({ type: 'FeatureCollection', features: facilities } as FeatureCollection, {
    renderer: ctx.featureRenderer,
    style: ctx.styles.BUILDING_STYLE,
    onEachFeature(feature, sublayer) {
      const info = normalizeSchoolFacility(feature);
      if (!info.kind) return;
      const label = SCHOOL_FACILITY_LABELS[info.kind];
      const path = sublayer as L.Path;
      path.on('mouseover', () => path.setStyle(ctx.styles.BUILDING_HOVER_STYLE));
      path.on('mouseout', () => layer.resetStyle(path));
      path.bindPopup(() => `
        <div class="popup-kind">학교 건물 · ${escapeHtml(label)} (추정)</div>
        <div class="popup-title">${escapeHtml(info.name || '이름 없는 건물')}</div>
        <table class="popup-table">
          <tr><td>학교</td><td>${escapeHtml(info.school || NO_INFO)}</td></tr>
          <tr><td>층수</td><td>${escapeHtml(info.floors === null ? '층수 정보 없음' : `지상 ${info.floors}층`)}</td></tr>
        </table>`);
    },
  } as L.GeoJSONOptions);
  return layer.addTo(ctx.map);
}

function buildingPopupHtml({ name, address, floors }: BuildingInfo) {
  const floorsText = floors === null ? '층수 정보 없음' : `지상 ${floors}층`;
  return `
    <div class="popup-kind">건물</div>
    <div class="popup-title">${escapeHtml(name || NO_INFO)}</div>
    <table class="popup-table">
      <tr><td>주소</td><td>${escapeHtml(address || NO_INFO)}</td></tr>
      <tr><td>층수</td><td>${escapeHtml(floorsText)}</td></tr>
    </table>`;
}

/**
 * 경계를 점선으로 그리고 라벨을 붙인다. (지금은 월계1동 행정동 경계에만 사용)
 * 경계가 조회 범위보다 넓을 수 있으므로 fitBounds 로 화면을 맞추지 않는다.
 */
export function drawBoundary(ctx: DrawContext, boundaryGeoJSON: FeatureCollection, style: L.PathOptions, label: string, labelClass = '') {
  const layer = L.geoJSON(boundaryGeoJSON, {
    pane: 'boundary',
    renderer: ctx.boundaryRenderer,
    style,
    interactive: false,
  } as L.GeoJSONOptions).addTo(ctx.map);

  // 다각형 무게중심에 라벨을 띄운다. (Polygon.getCenter 는 지도에 추가된 뒤에만 쓸 수 있다)
  const first = layer.getLayers()[0] as L.Polygon | undefined;
  if (first) {
    L.tooltip({ permanent: true, direction: 'center', className: `boundary-label ${labelClass}`, pane: 'boundary' })
      .setLatLng(first.getCenter())
      .setContent(label)
      .addTo(ctx.map);
  }
  return layer;
}
