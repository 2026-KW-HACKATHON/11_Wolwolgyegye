import L from 'leaflet';
import type { FeatureCollection, Point } from 'geojson';
import type { DrawContext } from './draw';

/** 개별 건물명이 나타나기 전까지만 동네의 주요 시설 이름을 보여준다. */
const OVERVIEW_LABEL_MAX_ZOOM = 17;

interface LandmarkProperties {
  label?: unknown;
  minZoom?: unknown;
  kind?: unknown;
}

/**
 * 축소 상태의 주요 시설 라벨. 3D 지도와 같은 landmarks.geojson을 사용해
 * 지도 모드에 따라 이름이 달라지지 않게 한다.
 */
export function drawMajorLandmarkLabels(ctx: DrawContext, geojson: FeatureCollection) {
  const entries: { tooltip: L.Tooltip; minZoom: number }[] = [];

  for (const feature of geojson.features ?? []) {
    if (feature.geometry?.type !== 'Point') continue;
    const properties = (feature.properties ?? {}) as LandmarkProperties;
    const label = typeof properties.label === 'string' ? properties.label.trim() : '';
    if (!label) continue;
    const [lng, lat] = (feature.geometry as Point).coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const minZoom = Number(properties.minZoom);
    const kind = typeof properties.kind === 'string' ? properties.kind : 'public';
    const tooltip = L.tooltip({
      permanent: true,
      direction: 'center',
      className: `map-landmark-label map-landmark-label--${kind}`,
      pane: 'boundary',
      interactive: false,
    })
      .setLatLng([lat, lng])
      .setContent(label);
    entries.push({ tooltip, minZoom: Number.isFinite(minZoom) ? minZoom : 15 });
  }

  const update = () => {
    const zoom = ctx.map.getZoom();
    for (const entry of entries) {
      const visible = zoom >= entry.minZoom && zoom < OVERVIEW_LABEL_MAX_ZOOM;
      if (visible && !ctx.map.hasLayer(entry.tooltip)) entry.tooltip.addTo(ctx.map);
      else if (!visible && ctx.map.hasLayer(entry.tooltip)) entry.tooltip.remove();
    }
  };

  update();
  ctx.map.on('zoomend', update);
}
