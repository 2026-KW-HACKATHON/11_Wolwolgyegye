// ---------------------------------------------------------------------
// 레이어 그리기 — V_World/main.js 의 "레이어 그리기" 부분을 옮긴 것.
// 원본은 전역 map·renderer 를 썼고, 여기서는 DrawContext 로 받는다.
// ---------------------------------------------------------------------
import L from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import { NO_INFO, ROAD_GRADE_LABELS, type AreaLayerConfig, type MapStyles } from './config';
import { normalizeBuilding, normalizeRoad, normalizeSchoolFacility, type AreaInfo, type BuildingInfo, type RoadGrade, type RoadInfo } from './normalize';

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
    style: (feature) => ctx.styles.AREA_STYLES[config.styleKey ? config.styleKey(config.normalize(feature as Feature)) : config.key],
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
 * 도로를 등급별 레이어로 나눠 그린다. (ROAD_STYLES 순서대로 추가 = 그 순서로 겹쳐 그림)
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
        const info = normalizeRoad(feature);
        // 숨겨진(투명한) 도로는 클릭해도 팝업을 띄우지 않는다
        sublayer.on('click', (e: L.LeafletMouseEvent) => {
          if (map.getZoom() < minZoom) return;
          L.popup().setLatLng(e.latlng).setContent(roadPopupHtml(info)).openOn(map);
        });
      },
    } as L.GeoJSONOptions);
  }
  for (const feature of roadsGeoJSON.features || []) {
    const { grade } = normalizeRoad(feature);
    layers[grade].addData(feature);
  }
  for (const grade of grades) layers[grade].addTo(map);
  return layers;
}

function roadPopupHtml({ name, grade, widthM, lanes, complexName, schoolName }: RoadInfo) {
  let title = name || '이름 없는 도로';
  if (grade === 'complex') title = `${complexName || '아파트'} 단지 내 도로`;
  if (grade === 'school') title = `${schoolName || '학교'} 안 도로`;
  const rows = [
    ['구분', `${ROAD_GRADE_LABELS[grade]}${grade === 'complex' || grade === 'school' ? ' (추정)' : ''}`],
    ['도로폭', widthM === null ? NO_INFO : `${widthM}m`],
    ['차로수', lanes === null ? NO_INFO : `${lanes}차로`],
  ];
  return `
    <div class="popup-kind">도로</div>
    <div class="popup-title">${escapeHtml(title)}</div>
    <table class="popup-table">
      ${rows.map(([k, v]) => `<tr><td>${k}</td><td>${escapeHtml(v)}</td></tr>`).join('')}
    </table>`;
}

export function drawBuildings(ctx: DrawContext, buildingsGeoJSON: FeatureCollection) {
  const layer: L.GeoJSON = L.geoJSON(buildingsGeoJSON, {
    renderer: ctx.featureRenderer,
    style: ctx.styles.BUILDING_STYLE,
    onEachFeature(feature, sublayer) {
      const info = normalizeBuilding(feature);
      const path = sublayer as L.Path;
      path.bindPopup(() => buildingPopupHtml(info));
      path.on('mouseover', () => path.setStyle(ctx.styles.BUILDING_HOVER_STYLE));
      path.on('mouseout', () => layer.resetStyle(path));
    },
  } as L.GeoJSONOptions);
  return layer.addTo(ctx.map);
}

/** 학교 안 건물을 종류별 색으로 그린다. 일반 건물(도로명주소 건물) 위에 덮어 그려진다 */
export function drawSchoolFacilities(ctx: DrawContext, geojson: FeatureCollection) {
  const { SCHOOL_FACILITY_STYLES, SCHOOL_FACILITY_BASE_STYLE } = ctx.styles;
  return L.geoJSON(geojson, {
    renderer: ctx.featureRenderer,
    filter: (feature) => normalizeSchoolFacility(feature).kind !== null,
    style: (feature) => {
      const { kind } = normalizeSchoolFacility(feature as Feature);
      return { ...SCHOOL_FACILITY_BASE_STYLE, fillColor: kind ? SCHOOL_FACILITY_STYLES[kind].fillColor : undefined };
    },
    onEachFeature(feature, sublayer) {
      const info = normalizeSchoolFacility(feature);
      if (!info.kind) return;
      const label = SCHOOL_FACILITY_STYLES[info.kind].label;
      sublayer.bindPopup(() => `
        <div class="popup-kind">학교 건물 · ${escapeHtml(label)} (추정)</div>
        <div class="popup-title">${escapeHtml(info.name || '이름 없는 건물')}</div>
        <table class="popup-table">
          <tr><td>학교</td><td>${escapeHtml(info.school || NO_INFO)}</td></tr>
          <tr><td>층수</td><td>${escapeHtml(info.floors === null ? '층수 정보 없음' : `지상 ${info.floors}층`)}</td></tr>
        </table>`);
    },
  } as L.GeoJSONOptions).addTo(ctx.map);
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
