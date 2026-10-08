import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, GeoJsonProperties, Point } from 'geojson';
import type { GeoPoint, Store } from '../../core/types/place';
import type { MapStore } from '../../core/supabase/stores';
import type { MainMapHandle, MainMapProps, MapInsets } from './MainMap';
import { MAP_CENTER, MAP_EXTENT } from './vworld/mapExtent';

type PointCollection = FeatureCollection<Point, GeoJsonProperties>;
type Status = 'loading' | 'ready' | 'missing';

const EMPTY_POINTS: PointCollection = { type: 'FeatureCollection', features: [] };
const EMPTY_IDS: string[] = [];
const BUILDINGS_URL = '/data/3d/buildings.geojson';
const LANDMARKS_URL = '/data/3d/landmarks.geojson';
const ROADS_URL = '/data/osm/roads.geojson';
const ADMIN_URL = '/data/vworld/admin_dong.geojson';
const AREA_URLS = {
  school: '/data/vworld/schools.geojson',
  apartment: '/data/vworld/apartments.geojson',
  water: '/data/vworld/water.geojson',
  mountain: '/data/vworld/mountains.geojson',
} as const;

const blankStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f3efe7' } }],
};

// blob: Worker 가 제한된 인앱 브라우저에서도 동작하도록 번들된 Worker 파일을 명시한다.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

async function fetchGeoJSON(url: string): Promise<FeatureCollection> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json() as Promise<FeatureCollection>;
}

function cssColor(element: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

function storesToGeoJSON(stores: Store[], selectedId: string | null, myStoreIds: string[]): PointCollection {
  const mine = new Set(myStoreIds);
  return {
    type: 'FeatureCollection',
    features: stores.map((store) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [store.location.lng, store.location.lat] },
      properties: { id: store.id, selected: store.id === selectedId, mine: mine.has(store.id), name: store.name },
    })),
  };
}

function placesToGeoJSON(places: MapStore[], selectedId: string | null): PointCollection {
  return {
    type: 'FeatureCollection',
    features: places.map((place) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [place.lng, place.lat] },
      properties: { id: place.id, selected: place.id === selectedId, name: place.name },
    })),
  };
}

function visibleOffset(insets: MapInsets): [number, number] {
  return [(insets.left - insets.right) / 2, (insets.top - insets.bottom) / 2];
}

interface LandmarkProperties {
  label: string;
  minZoom: number;
  priority: number;
  kind: 'campus' | 'public' | 'school' | 'residence';
}

/** 이름표가 겹치면 우선순위가 높은 주요 건물만 남긴다. */
function mountLandmarkLabels(map: MapLibreMap, data: FeatureCollection): () => void {
  const labels = data.features.flatMap((feature) => {
    if (feature.geometry?.type !== 'Point') return [];
    const properties = feature.properties as unknown as LandmarkProperties;
    if (!properties?.label) return [];
    const element = document.createElement('span');
    element.className = `mm-landmark-label mm-landmark-label--${properties.kind}`;
    element.textContent = properties.label;
    element.setAttribute('aria-hidden', 'true');
    const coordinates = feature.geometry.coordinates as [number, number];
    const marker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(coordinates).addTo(map);
    return [{ element, marker, coordinates, minZoom: Number(properties.minZoom), priority: Number(properties.priority) }];
  }).sort((a, b) => a.priority - b.priority);

  let frame = 0;
  const update = () => {
    frame = 0;
    const zoom = map.getZoom();
    const occupied: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    for (const label of labels) {
      if (zoom < label.minZoom) {
        label.element.hidden = true;
        continue;
      }
      const point = map.project(label.coordinates);
      const width = label.element.offsetWidth || label.element.textContent!.length * 7 + 16;
      const height = label.element.offsetHeight || 22;
      const rect = { left: point.x - width / 2 - 5, right: point.x + width / 2 + 5, top: point.y - height / 2 - 4, bottom: point.y + height / 2 + 4 };
      const overlaps = occupied.some((other) => rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top);
      label.element.hidden = overlaps;
      if (!overlaps) occupied.push(rect);
    }
  };
  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  map.on('move', schedule);
  schedule();
  return () => {
    if (frame) cancelAnimationFrame(frame);
    map.off('move', schedule);
    labels.forEach(({ marker }) => marker.remove());
  };
}

const Map3D = forwardRef<MainMapHandle, MainMapProps>(function Map3D({
  stores,
  selectedId,
  onSelect,
  showZoomControl,
  places,
  selectedPlaceId,
  onPlaceSelect,
  placesMonth,
  myStoreIds = EMPTY_IDS,
}, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const storesRef = useRef(stores);
  const placesRef = useRef(places);
  const pendingLocationRef = useRef<GeoPoint | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  onSelectRef.current = onSelect;
  onPlaceSelectRef.current = onPlaceSelect;
  storesRef.current = stores;
  placesRef.current = places;

  useImperativeHandle(ref, () => ({
    centerOn(point, insets, minZoom = 16) {
      const map = mapRef.current;
      if (!map || !map.loaded()) return false;
      map.easeTo({
        center: [point.lng, point.lat],
        zoom: Math.max(map.getZoom(), minZoom),
        offset: visibleOffset(insets),
        duration: 420,
      });
      return true;
    },
    showMyLocation(point) {
      pendingLocationRef.current = point;
      const source = mapRef.current?.getSource('my-location') as GeoJSONSource | undefined;
      source?.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [point.lng, point.lat] } }],
      });
    },
  }), []);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const selectedStore = stores.find((store) => store.id === selectedId);
    const selectedPlace = places.find((place) => place.id === selectedPlaceId);
    const initial = selectedStore?.location ?? (selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng } : MAP_CENTER);
    const map = new maplibregl.Map({
      container: canvas,
      style: blankStyle,
      center: [initial.lng, initial.lat],
      zoom: selectedStore || selectedPlace ? 17 : 15.4,
      minZoom: 14.3,
      maxZoom: 20,
      maxBounds: [[MAP_EXTENT.west, MAP_EXTENT.south], [MAP_EXTENT.east, MAP_EXTENT.north]],
      pitch: 55,
      maxPitch: 72,
      bearing: -18,
      attributionControl: false,
      dragRotate: true,
      touchPitch: true,
      fadeDuration: 0,
    });
    mapRef.current = map;
    // 지연 로딩 직후에는 MapLibre가 기본 400×300 크기를 잡을 수 있어 실제 지도 영역으로 다시 맞춘다.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(canvas);
    const resizeFrame = requestAnimationFrame(() => map.resize());
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: showZoomControl, visualizePitch: true }), 'top-right');

    const setPointer = () => { map.getCanvas().style.cursor = 'pointer'; };
    const clearPointer = () => { map.getCanvas().style.cursor = ''; };

    let disposeLandmarkLabels = () => {};
    map.on('load', async () => {
      try {
        const [buildings, landmarks, roads, admin, school, apartment, water, mountain] = await Promise.all([
          fetchGeoJSON(BUILDINGS_URL), fetchGeoJSON(LANDMARKS_URL), fetchGeoJSON(ROADS_URL), fetchGeoJSON(ADMIN_URL),
          fetchGeoJSON(AREA_URLS.school), fetchGeoJSON(AREA_URLS.apartment), fetchGeoJSON(AREA_URLS.water), fetchGeoJSON(AREA_URLS.mountain),
        ]);
        if (mapRef.current !== map) return;

        const colors = {
          background: cssColor(root, '--map-bg', '#f3efe7'),
          building: cssColor(root, '--building-fill', '#d8d1c5'),
          buildingStroke: cssColor(root, '--building-stroke', '#b8ad9c'),
          road: cssColor(root, '--road-medium', '#ffffff'),
          water: cssColor(root, '--water-fill', '#b8dbea'),
          mountain: cssColor(root, '--mountain-fill', '#cdddbd'),
          school: cssColor(root, '--school-fill', '#eee5cf'),
          apartment: cssColor(root, '--apartment-fill', '#e6dfd4'),
          boundary: cssColor(root, '--admin-dong', '#8a5c3d'),
          brand: cssColor(root, '--color-brand', '#8f2635'),
          place: cssColor(root, '--place-pin', '#ed7c31'),
          me: cssColor(root, '--map-me', '#1a73e8'),
          text: cssColor(root, '--color-text', '#211a16'),
          surface: cssColor(root, '--color-surface', '#fffdf8'),
        };
        map.setPaintProperty('background', 'background-color', colors.background);

        const areas = [
          ['area-school', school, colors.school],
          ['area-apartment', apartment, colors.apartment],
          ['area-water', water, colors.water],
          ['area-mountain', mountain, colors.mountain],
        ] as const;
        for (const [id, data, color] of areas) {
          map.addSource(id, { type: 'geojson', data });
          map.addLayer({ id, source: id, type: 'fill', paint: { 'fill-color': color, 'fill-opacity': 0.86 } });
        }

        map.addSource('roads', { type: 'geojson', data: roads });
        map.addLayer({
          id: 'roads', source: 'roads', type: 'line',
          paint: {
            'line-color': colors.road,
            'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 17, 3, 20, 8],
            'line-opacity': 0.92,
          },
        });
        map.addSource('buildings', { type: 'geojson', data: buildings });
        map.addLayer({
          id: 'buildings', source: 'buildings', type: 'fill-extrusion', minzoom: 14.5,
          paint: {
            'fill-extrusion-color': colors.building,
            'fill-extrusion-height': ['max', 3, ['*', ['to-number', ['get', 'levels'], 1], 3]],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.9,
            'fill-extrusion-vertical-gradient': true,
          },
        });
        map.addLayer({ id: 'building-outlines', source: 'buildings', type: 'line', paint: { 'line-color': colors.buildingStroke, 'line-width': 0.45 } });
        map.addSource('admin', { type: 'geojson', data: admin });
        map.addLayer({ id: 'admin', source: 'admin', type: 'line', paint: { 'line-color': colors.boundary, 'line-width': 2, 'line-dasharray': [2, 3] } });
        disposeLandmarkLabels = mountLandmarkLabels(map, landmarks);

        map.addSource('places', { type: 'geojson', data: placesToGeoJSON(placesRef.current, selectedPlaceId), cluster: true, clusterRadius: 34, clusterMaxZoom: 17 });
        map.addLayer({
          id: 'place-clusters', source: 'places', type: 'circle', filter: ['has', 'point_count'],
          paint: { 'circle-color': colors.place, 'circle-radius': ['step', ['get', 'point_count'], 15, 20, 19, 60, 23], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
        });
        map.addLayer({
          id: 'place-cluster-count', source: 'places', type: 'symbol', filter: ['has', 'point_count'],
          layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11 }, paint: { 'text-color': '#fff' },
        });
        map.addLayer({
          id: 'place-points', source: 'places', type: 'circle', filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['case', ['boolean', ['get', 'selected'], false], colors.brand, colors.place],
            'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 10, 7],
            'circle-stroke-color': '#fff', 'circle-stroke-width': 2,
          },
        });
        // 네이버 지도처럼 멀리서는 랜드마크만, 충분히 확대하면 개별 가게 이름을 보여 준다.
        // symbol 레이어의 충돌 회피를 사용해 화면이 좁은 모바일에서도 이름표가 서로 겹치지 않는다.
        map.addLayer({
          id: 'place-labels', source: 'places', type: 'symbol', minzoom: 17.2, filter: ['!', ['has', 'point_count']],
          layout: {
            'text-field': ['get', 'name'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 17.2, 10, 19, 12],
            'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
            'text-radial-offset': 1.15,
            'text-max-width': 11,
            'text-padding': 4,
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color': ['case', ['boolean', ['get', 'selected'], false], colors.brand, colors.text],
            'text-halo-color': colors.surface,
            'text-halo-width': 1.6,
            'text-halo-blur': 0.4,
          },
        });

        map.addSource('feature-stores', { type: 'geojson', data: storesToGeoJSON(storesRef.current, selectedId, myStoreIds) });
        map.addLayer({
          id: 'feature-stores', source: 'feature-stores', type: 'circle',
          paint: {
            'circle-color': ['case', ['boolean', ['get', 'mine'], false], '#2563eb', ['boolean', ['get', 'selected'], false], colors.brand, '#157a5b'],
            'circle-radius': ['case', ['any', ['boolean', ['get', 'mine'], false], ['boolean', ['get', 'selected'], false]], 12, 9],
            'circle-stroke-color': '#fff', 'circle-stroke-width': 3,
          },
        });
        map.addLayer({
          id: 'feature-store-labels', source: 'feature-stores', type: 'symbol', minzoom: 16.8,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 16.8, 10.5, 19, 12.5],
            'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
            'text-radial-offset': 1.2,
            'text-max-width': 12,
            'text-padding': 5,
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'symbol-sort-key': ['case', ['boolean', ['get', 'selected'], false], 0, ['boolean', ['get', 'mine'], false], 1, 2],
          },
          paint: {
            'text-color': ['case', ['boolean', ['get', 'mine'], false], '#1d4ed8', ['boolean', ['get', 'selected'], false], colors.brand, '#0f6248'],
            'text-halo-color': colors.surface,
            'text-halo-width': 1.8,
            'text-halo-blur': 0.4,
          },
        });
        map.addSource('my-location', { type: 'geojson', data: EMPTY_POINTS });
        map.addLayer({ id: 'my-location-glow', source: 'my-location', type: 'circle', paint: { 'circle-radius': 14, 'circle-color': colors.me, 'circle-opacity': 0.2 } });
        map.addLayer({ id: 'my-location', source: 'my-location', type: 'circle', paint: { 'circle-radius': 7, 'circle-color': colors.me, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });

        if (pendingLocationRef.current) {
          const point = pendingLocationRef.current;
          (map.getSource('my-location') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [point.lng, point.lat] } }] });
        }

        const selectFeatureStore = (event: MapLayerMouseEvent) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === 'string') onSelectRef.current(id);
        };
        const selectPlace = (event: MapLayerMouseEvent) => {
          const id = event.features?.[0]?.properties?.id;
          const place = placesRef.current.find((item) => item.id === id);
          if (place) onPlaceSelectRef.current(place);
        };
        map.on('click', 'feature-stores', selectFeatureStore);
        map.on('click', 'feature-store-labels', selectFeatureStore);
        map.on('click', 'place-points', selectPlace);
        map.on('click', 'place-labels', selectPlace);
        map.on('click', 'place-clusters', async (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          const clusterId = Number(feature?.properties?.cluster_id);
          if (!feature || !Number.isFinite(clusterId) || feature.geometry.type !== 'Point') return;
          const source = map.getSource('places') as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(clusterId);
          map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom, duration: 360 });
        });
        for (const layer of ['feature-stores', 'feature-store-labels', 'place-points', 'place-labels', 'place-clusters']) {
          map.on('mouseenter', layer, setPointer);
          map.on('mouseleave', layer, clearPointer);
        }
        setStatus('ready');
      } catch (error) {
        console.error('3D map data failed to load', error);
        setStatus('missing');
      }
    });

    return () => {
      cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      disposeLandmarkLabels();
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource('feature-stores') as GeoJSONSource | undefined;
    source?.setData(storesToGeoJSON(stores, selectedId, myStoreIds));
  }, [stores, selectedId, myStoreIds]);

  useEffect(() => {
    const source = mapRef.current?.getSource('places') as GeoJSONSource | undefined;
    source?.setData(placesToGeoJSON(places, selectedPlaceId));
  }, [places, selectedPlaceId]);

  return (
    <div ref={rootRef} className="mm-root mm-root--3d">
      <div ref={canvasRef} className="mm-canvas mm-maplibre" role="region" aria-label="월계1동 3D 지도" />
      <p className="mm-source">
        건물 © 브이월드 · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">도로 © OpenStreetMap contributors</a>
        {placesMonth ? ` · © 소상공인시장진흥공단 ${placesMonth.slice(0, 4)}.${placesMonth.slice(4, 6)}` : ''}
      </p>
      {status === 'loading' && <div className="mm-state" role="status">건물을 세우는 중…</div>}
      {status === 'missing' && <div className="mm-state" role="alert"><strong>3D 지도를 불러오지 못했어요</strong><span>2D 지도로 전환해 주세요.</span></div>}
    </div>
  );
});

export default Map3D;
