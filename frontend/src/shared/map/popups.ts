// ---------------------------------------------------------------------
// 지도 팝업 HTML (2D Leaflet · 2D MapLibre 가 같이 쓴다)
// 렌더러와 상관없이 feature 속성 → 팝업 내용만 만든다.
// ---------------------------------------------------------------------
import type { Feature } from 'geojson';
import { normalizeRailway, normalizeStation, shortLineLabel, subwayLineBase, type RoadInfo } from './osm/normalize';
import { NO_INFO, ROAD_GRADE_LABELS, SCHOOL_FACILITY_LABELS } from './vworld/config';
import { normalizeSchoolFacility, type AreaInfo, type BuildingInfo } from './vworld/normalize';

/** 팝업에 넣을 문자열의 HTML 특수문자를 이스케이프 */
export function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function areaPopupHtml(label: string, { title, lines }: AreaInfo) {
  // 줄마다 이스케이프한 뒤 <br> 로 잇는다 (빈 줄은 뺀다)
  const detailHtml = (lines || []).filter(Boolean).map(escapeHtml).join('<br>');
  return `
    <div class="popup-kind">${escapeHtml(label)}</div>
    <div class="popup-title">${escapeHtml(title || NO_INFO)}</div>
    ${detailHtml ? `<div>${detailHtml}</div>` : ''}`;
}

export function roadPopupHtml({ name, grade, widthM, lanes, bridge }: RoadInfo) {
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

export function railwayPopupHtml(feature: Feature) {
  const { name, kindLabel } = normalizeRailway(feature);
  return `
    <div class="popup-kind">${escapeHtml(kindLabel)}</div>
    <div class="popup-title">${escapeHtml(name || '이름 없는 노선')}</div>`;
}

export function buildingPopupHtml({ name, address, floors }: BuildingInfo) {
  const floorsText = floors === null ? '층수 정보 없음' : `지상 ${floors}층`;
  return `
    <div class="popup-kind">건물</div>
    <div class="popup-title">${escapeHtml(name || NO_INFO)}</div>
    <table class="popup-table">
      <tr><td>주소</td><td>${escapeHtml(address || NO_INFO)}</td></tr>
      <tr><td>층수</td><td>${escapeHtml(floorsText)}</td></tr>
    </table>`;
}

/** 학교 건물. 종류를 알 수 없는 건물(kind null)은 그리지 않으므로 빈 문자열 */
export function schoolFacilityPopupHtml(feature: Feature) {
  const info = normalizeSchoolFacility(feature);
  if (!info.kind) return '';
  return `
    <div class="popup-kind">학교 건물 · ${escapeHtml(SCHOOL_FACILITY_LABELS[info.kind])} (추정)</div>
    <div class="popup-title">${escapeHtml(info.name || '이름 없는 건물')}</div>
    <table class="popup-table">
      <tr><td>학교</td><td>${escapeHtml(info.school || NO_INFO)}</td></tr>
      <tr><td>층수</td><td>${escapeHtml(info.floors === null ? '층수 정보 없음' : `지상 ${info.floors}층`)}</td></tr>
    </table>`;
}

export function subwayLinePopupHtml(feature: Feature) {
  return `<div class="popup-kind">지하철 노선</div><div class="popup-title">${escapeHtml(subwayLineBase(feature) || '이름 없는 노선')}</div>`;
}

/** 역 이름 ("역" 이 없으면 붙인다) */
export function stationTitle(feature: Feature) {
  const { name } = normalizeStation(feature);
  return name.endsWith('역') ? name : `${name}역`;
}

export function stationPopupHtml(feature: Feature) {
  const { lines } = normalizeStation(feature);
  return `<div class="popup-kind">지하철역</div><div class="popup-title">${escapeHtml(stationTitle(feature))}</div><div>${escapeHtml(lines.map((l) => l.label).join(' · '))}</div>`;
}

/** 역 이름표 [1][6] 석계역 (지도 위에 늘 떠 있는 마커 HTML) */
export function stationLabelHtml(feature: Feature) {
  const { lines } = normalizeStation(feature);
  const chips = lines.map((l) => `<i style="--line:${l.colour || 'var(--map-line-default)'}" title="${escapeHtml(l.label)}">${escapeHtml(shortLineLabel(l.label))}</i>`).join('');
  return `<span class="st-box">${chips}<b>${escapeHtml(stationTitle(feature))}</b></span>`;
}
