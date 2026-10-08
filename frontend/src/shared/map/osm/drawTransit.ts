// ---------------------------------------------------------------------
// 지하철 그리기: 노선(얇은 색 선) · 역(이름표) · 출구(번호 네모 + 역과 잇는 점선)
// 철도 선로(차량기지 포함)는 vworld/draw.ts 의 drawRailways 가 따로 그리고, 노선은 그 위에 겹친다.
// ---------------------------------------------------------------------
import L from 'leaflet';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { DrawContext } from '../vworld/draw';
import { escapeHtml, stationLabelHtml, stationPopupHtml, subwayLinePopupHtml } from '../popups';
import { EXIT_MIN_ZOOM, longestSubwayLines, normalizeStationExit, normalizeSubwayLine } from './normalize';

/** 노선마다 선 하나. 클릭하면 노선 이름 */
export function drawSubwayLines(ctx: DrawContext, linesGeoJSON: FeatureCollection) {
  return L.geoJSON({ type: 'FeatureCollection', features: longestSubwayLines(linesGeoJSON) } as FeatureCollection, {
    renderer: ctx.featureRenderer,
    style: (feature) => ({ ...ctx.styles.SUBWAY_LINE_STYLE, color: normalizeSubwayLine(feature as Feature).colour || ctx.styles.SUBWAY_LINE_STYLE.color }),
    onEachFeature(feature, sublayer) {
      sublayer.bindPopup(() => subwayLinePopupHtml(feature));
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
    stationPoints.set(String(feature.id ?? ''), at);
    L.marker(at, {
      pane: 'stations',
      icon: L.divIcon({ className: 'st-wrap', html: stationLabelHtml(feature), iconSize: [0, 0], iconAnchor: [0, 0] }),
      keyboard: false,
    })
      .bindPopup(stationPopupHtml(feature))
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
