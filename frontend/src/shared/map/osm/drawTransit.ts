// ---------------------------------------------------------------------
// 지하철 그리기: 노선(얇은 색 선) · 역(이름표) · 출구(번호 네모 + 역과 잇는 점선)
// 철도 선로(차량기지 포함)는 vworld/draw.ts 의 drawRailways 가 따로 그리고, 노선은 그 위에 겹친다.
// ---------------------------------------------------------------------
import L from 'leaflet';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { DrawContext } from '../vworld/draw';
import { normalizeStation, normalizeStationExit, normalizeSubwayLine, shortLineLabel, subwayLineBase } from './normalize';

/** 이 줌부터 출구와 역-출구 연결선을 보여준다 (그 아래에서는 역만) */
const EXIT_MIN_ZOOM = 17;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** 노선마다 선 하나. 클릭하면 노선 이름 */
export function drawSubwayLines(ctx: DrawContext, linesGeoJSON: FeatureCollection) {
  // 같은 노선(1호선의 여러 계통 등)이 여러 개 들어 있으면 가장 긴 것 하나만 그린다
  const pointCount = (f: Feature) => {
    const g = f.geometry;
    return g?.type === 'MultiLineString' ? g.coordinates.flat().length : g?.type === 'LineString' ? g.coordinates.length : 0;
  };
  const longest = new Map<string, Feature>();
  for (const feature of linesGeoJSON.features || []) {
    const base = subwayLineBase(feature);
    const prev = longest.get(base);
    if (!prev || pointCount(feature) > pointCount(prev)) longest.set(base, feature);
  }
  return L.geoJSON({ type: 'FeatureCollection', features: [...longest.values()] } as FeatureCollection, {
    renderer: ctx.featureRenderer,
    style: (feature) => ({ ...ctx.styles.SUBWAY_LINE_STYLE, color: normalizeSubwayLine(feature as Feature).colour }),
    onEachFeature(feature, sublayer) {
      const label = subwayLineBase(feature);
      sublayer.bindPopup(() => `<div class="popup-kind">지하철 노선</div><div class="popup-title">${escapeHtml(label || '이름 없는 노선')}</div>`);
    },
  } as L.GeoJSONOptions).addTo(ctx.map);
}

const latLngOf = (f: Feature): L.LatLng | null => {
  if (f.geometry?.type !== 'Point') return null;
  const [lng, lat] = (f.geometry as Point).coordinates;
  return L.latLng(lat, lng);
};

/**
 * 역 이름표와 출구를 그린다. 역·출구는 가게 핀 아래 전용 pane('stations')에 둔다.
 * 출구는 EXIT_MIN_ZOOM 이상에서만 보이고, 출구마다 역 이름표 가운데로 가는 점선을 잇는다.
 */
export function drawStations(ctx: DrawContext, stationsGeoJSON: FeatureCollection, exitsGeoJSON: FeatureCollection | null) {
  const { map } = ctx;
  const pane = map.getPane('stations') ?? map.createPane('stations');
  pane.style.zIndex = '560'; // 가게 핀(600)보다 아래, 지도 도형보다 위

  const stationPoints = new Map<string, L.LatLng>();
  const linkRenderer = L.canvas({ pane: 'stations' });
  for (const feature of stationsGeoJSON.features || []) {
    const at = latLngOf(feature);
    if (!at) continue;
    const { name, lines } = normalizeStation(feature);
    stationPoints.set(String(feature.id ?? ''), at);
    const chips = lines.map((l) => `<i style="--line:${l.colour}" title="${escapeHtml(l.label)}">${escapeHtml(shortLineLabel(l.label))}</i>`).join('');
    const title = name.endsWith('역') ? name : `${name}역`;
    L.marker(at, {
      pane: 'stations',
      icon: L.divIcon({ className: 'st-wrap', html: `<span class="st-box">${chips}<b>${escapeHtml(title)}</b></span>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
      keyboard: false,
    })
      .bindPopup(`<div class="popup-kind">지하철역</div><div class="popup-title">${escapeHtml(title)}</div><div>${escapeHtml(lines.map((l) => l.label).join(' · '))}</div>`)
      .addTo(map);
  }

  // 출구 + 역과 잇는 점선 (줌에 따라 붙였다 뗀다)
  const exits = L.layerGroup();
  for (const feature of exitsGeoJSON?.features || []) {
    const at = latLngOf(feature);
    if (!at) continue;
    const { number, stationId } = normalizeStationExit(feature);
    const station = stationPoints.get(stationId);
    if (station) L.polyline([station, at], { ...ctx.styles.STATION_EXIT_LINK_STYLE, renderer: linkRenderer, pane: 'stations' }).addTo(exits);
    L.marker(at, {
      pane: 'stations',
      icon: L.divIcon({ className: 'st-wrap', html: `<span class="st-exit">${escapeHtml(number || '출구')}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
      keyboard: false,
      interactive: false,
    }).addTo(exits);
  }
  const updateExits = () => {
    if (map.getZoom() >= EXIT_MIN_ZOOM) exits.addTo(map);
    else exits.remove();
  };
  map.on('zoomend', updateExits);
  updateExits();
}
