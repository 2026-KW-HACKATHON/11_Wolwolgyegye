import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, GeoJsonProperties, Point } from 'geojson';
import type { GeoPoint, Store } from '../../core/types/place';
import type { MarkerStyleId } from '../../core/map/markerStyle';
import type { MapStore } from '../../core/supabase/stores';
import type { MainMapHandle, MainMapProps, MapInsets } from './MainMap';
import { buildingGroupsListElement, buildingListElement, groupByBuilding } from './placeMarkers';
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

function markerSvg(style: MarkerStyleId, variant: 'normal' | 'selected' | 'mine' | 'cluster', colors: { brand: string; surface: string }): string {
  const selected = variant === 'selected';
  const mine = variant === 'mine';
  const cluster = variant === 'cluster';
  const palette = style === 'classic'
    ? { fill: '#ef762f', stroke: colors.surface, accent: colors.surface }
    : style === 'diamond'
      ? { fill: '#147d78', stroke: '#f1c75b', accent: '#fff7d6' }
      : { fill: '#790d16', stroke: colors.surface, accent: colors.surface };
  if (selected) Object.assign(palette, { fill: '#8f2635', stroke: colors.surface, accent: colors.surface });
  if (mine) Object.assign(palette, { fill: '#2563eb', stroke: colors.surface, accent: colors.surface });
  const shape = style === 'classic'
    ? `<path d="M32 3A25 25 0 0 0 13 44L29 66Q32 70 35 66L51 44A25 25 0 0 0 32 3Z"/>`
    : style === 'diamond'
      ? `<path d="M32 3 59 31 32 67 5 31Z"/>`
      : `<circle cx="32" cy="32" r="28"/>`;
  const shop = cluster ? '' : `<path d="M20 28h24l-2-8H22l-2 8Zm2 0v16h20V28M27 44V34h10v10M19 28c0 4 6 4 6 0 0 4 7 4 7 0 0 4 7 4 7 0 0 4 6 4 6 0" fill="none" stroke="${palette.accent}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const height = style === 'signboard' ? 64 : 72;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="${height}" viewBox="0 0 64 ${height}"><g fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="4" stroke-linejoin="round">${shape}</g>${shop}</svg>`;
}

function loadMarkerImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('지도 핀 이미지를 만들지 못했어요.'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function storesToGeoJSON(stores: Store[], selectedId: string | null, myStoreIds: string[], hasSelection: boolean): PointCollection {
  const mine = new Set(myStoreIds);
  return {
    type: 'FeatureCollection',
    features: stores.map((store) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [store.location.lng, store.location.lat] },
      properties: {
        id: store.id,
        selected: store.id === selectedId,
        mine: mine.has(store.id),
        muted: hasSelection && store.id !== selectedId && !mine.has(store.id),
        name: store.name,
      },
    })),
  };
}

function placesToGeoJSON(places: MapStore[], selectedId: string | null, hasSelection: boolean): PointCollection {
  return {
    type: 'FeatureCollection',
    features: places.map((place) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [place.lng, place.lat] },
      properties: { id: place.id, selected: place.id === selectedId, muted: hasSelection && place.id !== selectedId, name: place.name },
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
  markerStyle = 'signboard',
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

        const [normalMarker, selectedMarker, mineMarker, clusterMarker] = await Promise.all([
          loadMarkerImage(markerSvg(markerStyle, 'normal', colors)),
          loadMarkerImage(markerSvg(markerStyle, 'selected', colors)),
          loadMarkerImage(markerSvg(markerStyle, 'mine', colors)),
          loadMarkerImage(markerSvg(markerStyle, 'cluster', colors)),
        ]);
        if (mapRef.current !== map) return;
        map.addImage('store-marker', normalMarker, { pixelRatio: 2 });
        map.addImage('store-marker-selected', selectedMarker, { pixelRatio: 2 });
        map.addImage('store-marker-mine', mineMarker, { pixelRatio: 2 });
        map.addImage('store-cluster', clusterMarker, { pixelRatio: 2 });

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
            'fill-extrusion-height': ['max', 3, ['to-number', ['get', 'height'], 3]],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.9,
            'fill-extrusion-vertical-gradient': true,
          },
        });
        map.addLayer({ id: 'building-outlines', source: 'buildings', type: 'line', paint: { 'line-color': colors.buildingStroke, 'line-width': 0.45 } });
        map.addSource('admin', { type: 'geojson', data: admin });
        map.addLayer({ id: 'admin', source: 'admin', type: 'line', paint: { 'line-color': colors.boundary, 'line-width': 2, 'line-dasharray': [2, 3] } });
        disposeLandmarkLabels = mountLandmarkLabels(map, landmarks);

        const hasSelection = Boolean(selectedId || selectedPlaceId);
        map.addSource('places', { type: 'geojson', data: placesToGeoJSON(placesRef.current, selectedPlaceId, hasSelection), cluster: true, clusterRadius: 34, clusterMaxZoom: 17 });
        map.addLayer({
          id: 'place-clusters', source: 'places', type: 'symbol', filter: ['has', 'point_count'],
          layout: {
            'icon-image': 'store-cluster',
            'icon-size': ['step', ['get', 'point_count'], 0.88, 20, 1.02, 60, 1.15],
            'icon-allow-overlap': true,
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 11,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'icon-opacity': hasSelection ? 0.5 : 1,
            'text-color': '#fff',
            'text-halo-color': colors.surface,
            'text-halo-width': markerStyle === 'diamond' ? 0.8 : 0,
            'text-opacity': hasSelection ? 0.5 : 1,
          },
        });
        map.addLayer({
          id: 'place-selected-glow', source: 'places', type: 'circle', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'selected'], true]],
          paint: { 'circle-radius': 24, 'circle-color': '#8f2635', 'circle-opacity': 0.18, 'circle-blur': 0.35, 'circle-stroke-color': '#8f2635', 'circle-stroke-opacity': 0.38, 'circle-stroke-width': 2 },
        });
        map.addLayer({
          id: 'place-points', source: 'places', type: 'symbol', filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': ['case', ['boolean', ['get', 'selected'], false], 'store-marker-selected', 'store-marker'],
            'icon-size': ['case', ['boolean', ['get', 'selected'], false], 0.92, ['boolean', ['get', 'muted'], false], 0.56, 0.7],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
          },
          paint: { 'icon-opacity': ['case', ['boolean', ['get', 'muted'], false], 0.58, 1] },
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
            'text-opacity': ['case', ['boolean', ['get', 'muted'], false], 0.52, 1],
          },
        });

        map.addSource('feature-stores', { type: 'geojson', data: storesToGeoJSON(storesRef.current, selectedId, myStoreIds, hasSelection) });
        map.addLayer({
          id: 'feature-store-selected-glow', source: 'feature-stores', type: 'circle', filter: ['==', ['get', 'selected'], true],
          paint: { 'circle-radius': 27, 'circle-color': '#8f2635', 'circle-opacity': 0.18, 'circle-blur': 0.35, 'circle-stroke-color': '#8f2635', 'circle-stroke-opacity': 0.38, 'circle-stroke-width': 2 },
        });
        map.addLayer({
          id: 'feature-stores', source: 'feature-stores', type: 'symbol',
          layout: {
            'icon-image': ['case', ['boolean', ['get', 'mine'], false], 'store-marker-mine', ['boolean', ['get', 'selected'], false], 'store-marker-selected', 'store-marker'],
            'icon-size': ['case', ['boolean', ['get', 'selected'], false], 1.08, ['boolean', ['get', 'mine'], false], 1, ['boolean', ['get', 'muted'], false], 0.66, 0.8],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
          },
          paint: { 'icon-opacity': ['case', ['boolean', ['get', 'muted'], false], 0.58, 1] },
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
            'text-opacity': ['case', ['boolean', ['get', 'muted'], false], 0.52, 1],
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
        let activePlacePopup: maplibregl.Popup | null = null;
        const openPlacePopup = (groups: ReturnType<typeof groupByBuilding>, coordinates: [number, number]) => {
          activePlacePopup?.remove();
          const popup = new maplibregl.Popup({ className: 'pl-popup', maxWidth: '320px', offset: 18 });
          activePlacePopup = popup;
          const list = groups.length === 1
            ? buildingListElement(groups[0], (place) => {
              popup.remove();
              onPlaceSelectRef.current(place);
            })
            : buildingGroupsListElement(groups, (place) => {
              popup.remove();
              onPlaceSelectRef.current(place);
            });
          popup.setLngLat(coordinates).setDOMContent(list).addTo(map);
        };
        const selectPlace = (event: MapLayerMouseEvent) => {
          const id = event.features?.[0]?.properties?.id;
          const place = placesRef.current.find((item) => item.id === id);
          if (!place) return;
          const group = groupByBuilding(placesRef.current).find((item) => item.places.some((candidate) => candidate.id === place.id));
          if (group && group.places.length > 1) openPlacePopup([group], [group.lng, group.lat]);
          else onPlaceSelectRef.current(place);
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
          const count = Number(feature.properties?.point_count);
          const leaves = await source.getClusterLeaves(clusterId, Number.isFinite(count) ? count : 1000, 0);
          const ids = new Set(leaves.map((leaf) => leaf.properties?.id).filter((id): id is string => typeof id === 'string'));
          const groups = groupByBuilding(placesRef.current.filter((place) => ids.has(place.id)));
          if (groups.length > 0) {
            openPlacePopup(groups, feature.geometry.coordinates as [number, number]);
            return;
          }
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
    source?.setData(storesToGeoJSON(stores, selectedId, myStoreIds, Boolean(selectedId || selectedPlaceId)));
  }, [stores, selectedId, selectedPlaceId, myStoreIds]);

  useEffect(() => {
    const source = mapRef.current?.getSource('places') as GeoJSONSource | undefined;
    source?.setData(placesToGeoJSON(places, selectedPlaceId, Boolean(selectedId || selectedPlaceId)));
    const map = mapRef.current;
    if (map?.getLayer('place-clusters')) {
      const opacity = selectedId || selectedPlaceId ? 0.5 : 1;
      map.setPaintProperty('place-clusters', 'icon-opacity', opacity);
      map.setPaintProperty('place-clusters', 'text-opacity', opacity);
    }
  }, [places, selectedId, selectedPlaceId]);

  return (
    <div ref={rootRef} className="mm-root mm-root--3d" data-marker-style={markerStyle} data-has-selection={Boolean(selectedId || selectedPlaceId)}>
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
