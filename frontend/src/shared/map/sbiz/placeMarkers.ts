// ---------------------------------------------------------------------
// 상가정보 가게 핀: 건물 단위 묶기(A) + 줌에 따른 화면 묶기(C)
//
// - 상가정보 좌표는 가게 칸이 아니라 건물 단위라, 같은 건물 가게는 한 핀으로 묶는다.
//     가게 1곳  → 작은 점. 누르면 바로 그 가게(2차 탭)
//     가게 여럿 → 숫자 핀. 누르면 층별 목록이 먼저 뜨고, 목록에서 가게를 골라야 2차 탭이 열린다
// - 줌을 줄이면 화면에서 가까운 건물끼리 숫자 묶음으로 합친다. 누르면 그 묶음이 보이게 확대한다.
//   CLUSTER_MAX_ZOOM 이상에서는 묶지 않는다.
// ---------------------------------------------------------------------
import L from 'leaflet';
import { subCategoryOf, type SubCategory } from '../../../core/categories/subCategories';
import type { SbizStore } from './stores';

/** 이 줌부터는 건물끼리 묶지 않고 건물 핀을 그대로 보여준다 */
export const CLUSTER_MAX_ZOOM = 18;
/** 화면 묶기 격자 한 칸 크기 (px). 같은 칸에 들어온 건물끼리 묶인다 */
const CLUSTER_CELL_PX = 56;

interface BuildingGroup {
  key: string;
  lat: number;
  lng: number;
  /** 건물명, 없으면 주소 */
  name: string;
  places: SbizStore[];
}

interface PlaceCluster {
  lat: number;
  lng: number;
  groups: BuildingGroup[];
  /** 묶인 가게 수 */
  count: number;
}

/** 같은 건물(건물관리번호, 없으면 같은 좌표)의 가게를 하나로 묶는다 */
export function groupByBuilding(places: SbizStore[]): BuildingGroup[] {
  const byKey = new Map<string, SbizStore[]>();
  for (const place of places) {
    const key = place.buildingId || `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
    const list = byKey.get(key);
    if (list) list.push(place);
    else byKey.set(key, [place]);
  }
  return [...byKey.entries()].map(([key, list]) => ({
    key,
    lat: list.reduce((sum, p) => sum + p.lat, 0) / list.length,
    lng: list.reduce((sum, p) => sum + p.lng, 0) / list.length,
    name: list.find((p) => p.buildingName)?.buildingName || list[0].address || '이름 없는 건물',
    places: list,
  }));
}

/** 현재 줌에서 화면 격자 칸이 같은 건물끼리 묶는다. CLUSTER_MAX_ZOOM 이상이면 묶지 않는다 */
export function clusterGroups(map: L.Map, groups: BuildingGroup[]): PlaceCluster[] {
  const zoom = map.getZoom();
  const single = (g: BuildingGroup): PlaceCluster => ({ lat: g.lat, lng: g.lng, groups: [g], count: g.places.length });
  if (zoom >= CLUSTER_MAX_ZOOM) return groups.map(single);
  const cells = new Map<string, BuildingGroup[]>();
  for (const g of groups) {
    const p = map.project([g.lat, g.lng], zoom);
    const key = `${Math.floor(p.x / CLUSTER_CELL_PX)}:${Math.floor(p.y / CLUSTER_CELL_PX)}`;
    const list = cells.get(key);
    if (list) list.push(g);
    else cells.set(key, [g]);
  }
  return [...cells.values()].map((list) => (list.length === 1 ? single(list[0]) : {
    lat: list.reduce((sum, g) => sum + g.lat, 0) / list.length,
    lng: list.reduce((sum, g) => sum + g.lng, 0) / list.length,
    groups: list,
    count: list.reduce((sum, g) => sum + g.places.length, 0),
  }));
}

/** 가장 많은 가게가 속한 묶음 (핀 색) */
function dominantGroup(places: SbizStore[]): SubCategory['group'] {
  const counts = new Map<SubCategory['group'], number>();
  for (const p of places) {
    const g = subCategoryOf(p)?.group ?? 'etc';
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'etc';
}

/** 가게 1곳 = 작은 점 / 건물에 여럿 = 숫자 핀 / 건물 여럿 묶음 = 큰 숫자 원 */
export function clusterIcon(cluster: PlaceCluster, selected: boolean): L.DivIcon {
  const sel = selected ? ' is-selected' : '';
  if (cluster.groups.length > 1) {
    return L.divIcon({ className: 'pl-wrap', html: `<span class="pl-cluster${sel}">${cluster.count}</span>`, iconSize: [36, 36], iconAnchor: [18, 18] });
  }
  const group = cluster.groups[0];
  const color = `pl--${dominantGroup(group.places)}`;
  if (group.places.length === 1) {
    return L.divIcon({ className: 'pl-wrap', html: `<span class="pl-dot ${color}${sel}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
  }
  return L.divIcon({ className: 'pl-wrap', html: `<span class="pl-building ${color}${sel}">${group.places.length}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });
}

/**
 * 건물 가게 목록 (층별). 지하 → 1층 → 위층 순, 층 정보가 없는 가게는 맨 아래.
 * textContent 로 넣어서 가게 이름이 HTML 로 해석되지 않는다.
 */
export function buildingListElement(group: BuildingGroup, onPick: (place: SbizStore) => void): HTMLElement {
  const root = document.createElement('div');
  root.className = 'pl-list';

  const head = document.createElement('div');
  head.className = 'pl-list__head';
  const title = document.createElement('strong');
  title.textContent = group.name;
  const count = document.createElement('span');
  count.textContent = `가게 ${group.places.length}곳`;
  head.append(title, count);
  root.append(head);

  const byFloor = new Map<number | null, SbizStore[]>();
  for (const p of group.places) {
    const list = byFloor.get(p.floorNumber);
    if (list) list.push(p);
    else byFloor.set(p.floorNumber, [p]);
  }
  const floors = [...byFloor.keys()].sort((a, b) => (a === null ? 1 : b === null ? -1 : a - b));

  const body = document.createElement('div');
  body.className = 'pl-list__body';
  for (const floor of floors) {
    const section = document.createElement('section');
    const label = document.createElement('h4');
    label.textContent = floor === null ? '층 정보 없음' : floor < 0 ? `지하 ${-floor}층` : `${floor}층`;
    section.append(label);
    for (const place of byFloor.get(floor)!.sort((a, b) => a.name.localeCompare(b.name, 'ko'))) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pl-list__item pl--${subCategoryOf(place)?.group ?? 'etc'}`;
      const name = document.createElement('span');
      name.textContent = place.name;
      const kind = document.createElement('small');
      kind.textContent = place.small || place.middle;
      button.append(name, kind);
      button.addEventListener('click', () => onPick(place));
      section.append(button);
    }
    body.append(section);
  }
  root.append(body);
  return root;
}
