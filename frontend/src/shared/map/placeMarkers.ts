// ---------------------------------------------------------------------
// 가게 핀: 건물 단위 묶기(A) + 줌에 따른 화면 묶기(C)
//
// - 가게 좌표(상가정보)는 가게 칸이 아니라 건물 단위라, 같은 건물 가게는 한 핀으로 묶는다.
//     가게 1곳  → 작은 점. 누르면 바로 그 가게(2차 탭)
//     가게 여럿 → 숫자 핀. 누르면 층별 목록이 먼저 뜨고, 목록에서 가게를 골라야 2차 탭이 열린다
// - 줌을 줄이면 화면에서 가까운 건물끼리 숫자 묶음으로 합친다. 누르면 그 묶음이 보이게 확대한다.
//   CLUSTER_MAX_ZOOM 이상에서는 묶지 않는다.
// ---------------------------------------------------------------------
import L from 'leaflet';
import { subCategoryById, type SubCategory } from '../../core/categories/subCategories';
import { floorLabel, type MapStore } from '../../core/supabase/stores';

/** 핀 크기 [가로, 세로] (px). 아래 끝 가운데가 가게 위치. 크기를 바꾸면 MainMap.css 의 .pl-pin 도 같이 */
const PIN_SINGLE: [number, number] = [22, 28];
const PIN_BUILDING: [number, number] = [30, 38];
/** 핀 위에 띄우는 층별 목록이 핀을 가리지 않도록 올리는 높이 (px) */
export const PIN_POPUP_OFFSET = PIN_BUILDING[1] - 4;

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
  places: MapStore[];
}

interface PlaceCluster {
  lat: number;
  lng: number;
  groups: BuildingGroup[];
  /** 묶인 가게 수 */
  count: number;
}

/**
 * 같은 건물의 가게를 하나로 묶는다. 건물관리번호로 묶고, 번호가 없는 가게(따로 추가한 가게)는
 * 같은 주소에 번호가 있는 가게의 건물로, 그것도 없으면 같은 주소끼리, 주소도 없으면 같은 좌표끼리 묶는다.
 * (번호 없는 가게가 따로 묶이면 같은 건물 위에 핀이 두 개 겹쳐 보인다)
 */
export function groupByBuilding(places: MapStore[]): BuildingGroup[] {
  const buildingByAddress = new Map<string, string>();
  for (const place of places) {
    if (place.buildingId && place.address && !buildingByAddress.has(place.address)) buildingByAddress.set(place.address, place.buildingId);
  }
  const byKey = new Map<string, MapStore[]>();
  for (const place of places) {
    const key = place.buildingId
      || (place.address && (buildingByAddress.get(place.address) ?? `addr:${place.address}`))
      || `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
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

/** 한 건물에 여러 묶음이 섞여 있을 때 핀 색으로 고르는 순서: 음식점 → 카페·베이커리 → 편의점 → 그 외 */
const GROUP_PRIORITY: SubCategory['group'][] = ['restaurant', 'cafe', 'convenience', 'etc'];

/** 건물 핀 색: 가게 중 우선순위가 가장 높은 묶음 */
export function pinGroup(places: MapStore[]): SubCategory['group'] {
  const groups = new Set(places.map((p) => subCategoryById(p.typeId)?.group ?? 'etc'));
  return GROUP_PRIORITY.find((g) => groups.has(g)) ?? 'etc';
}

/**
 * 물방울 모양 핀 (아래 뾰족한 끝이 가게 위치). 모양은 MainMap.css 의 .pl-pin__shape (그라데이션 + 모양 마스크),
 * 가운데 흰 구멍에 가게 수, 1곳이면 빈 구멍
 */
function pinHtml(className: string, label: string): string {
  return `<span class="pl-pin ${className}"><span class="pl-pin__shape"></span><span class="pl-pin__label">${label}</span></span>`;
}

/** 가게 1곳 = 작은 핀 / 건물에 여럿 = 숫자 핀 / 건물 여럿 묶음 = 큰 숫자 원. 색은 모두 pinGroup 우선순위 */
export function clusterIcon(cluster: PlaceCluster, selected: boolean): L.DivIcon {
  const sel = selected ? ' is-selected' : '';
  if (cluster.groups.length > 1) {
    // 묶음 색도 같은 우선순위: 묶인 가게 중 음식점이 하나라도 있으면 음식점 색
    const color = `pl--${pinGroup(cluster.groups.flatMap((g) => g.places))}`;
    return L.divIcon({ className: 'pl-wrap', html: `<span class="pl-cluster ${color}${sel}">${cluster.count}</span>`, iconSize: [36, 36], iconAnchor: [18, 18] });
  }
  const group = cluster.groups[0];
  const color = `pl--${pinGroup(group.places)}`;
  if (group.places.length === 1) {
    return L.divIcon({ className: 'pl-wrap', html: pinHtml(`pl-pin--single ${color}${sel}`, ''), iconSize: PIN_SINGLE, iconAnchor: [PIN_SINGLE[0] / 2, PIN_SINGLE[1]] });
  }
  return L.divIcon({ className: 'pl-wrap', html: pinHtml(`${color}${sel}`, String(group.places.length)), iconSize: PIN_BUILDING, iconAnchor: [PIN_BUILDING[0] / 2, PIN_BUILDING[1]] });
}

/**
 * 건물 가게 목록 (층별). 지하 → 1층 → 위층 순, 층 정보가 없는 가게는 맨 아래.
 * textContent 로 넣어서 가게 이름이 HTML 로 해석되지 않는다.
 */
export function buildingListElement(group: BuildingGroup, onPick: (place: MapStore) => void): HTMLElement {
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

  const byFloor = new Map<number | null, MapStore[]>();
  for (const p of group.places) {
    const list = byFloor.get(p.floor);
    if (list) list.push(p);
    else byFloor.set(p.floor, [p]);
  }
  const floors = [...byFloor.keys()].sort((a, b) => (a === null ? 1 : b === null ? -1 : a - b));

  const body = document.createElement('div');
  body.className = 'pl-list__body';
  for (const floor of floors) {
    const section = document.createElement('section');
    const label = document.createElement('h4');
    label.textContent = floor === null ? '층 정보 없음' : floorLabel(floor);
    section.append(label);
    for (const place of byFloor.get(floor)!.sort((a, b) => a.name.localeCompare(b.name, 'ko'))) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pl-list__item pl--${subCategoryById(place.typeId)?.group ?? 'etc'}`;
      const name = document.createElement('span');
      name.textContent = place.name;
      const kind = document.createElement('small');
      kind.textContent = place.industry;
      button.append(name, kind);
      button.addEventListener('click', () => onPick(place));
      section.append(button);
    }
    body.append(section);
  }
  root.append(body);
  return root;
}
