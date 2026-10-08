import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sourcePath = resolve('public/data/vworld/buildings.geojson');
const outputPath = resolve('public/data/3d/buildings.geojson');
const landmarksPath = resolve('public/data/3d/landmarks.geojson');

/** 같은 시설의 여러 동은 한 이름표로 묶는다. priority가 작을수록 겹칠 때 먼저 보인다. */
const landmarkRules = [
  { label: '광운대학교', names: ['광운대학교'], minZoom: 14.7, priority: 1, kind: 'campus' },
  { label: '인덕대학교', names: ['인덕대학'], minZoom: 14.9, priority: 2, kind: 'campus' },
  { label: '이마트 월계점', names: ['월계동 이마트', '월계 이마트'], minZoom: 15.1, priority: 3, kind: 'public' },
  { label: '월계1동 주민센터', names: ['월계1동주민센터'], minZoom: 15.2, priority: 4, kind: 'public' },
  { label: '월계문화체육센터', names: ['월계문화체육센터'], minZoom: 15.4, priority: 5, kind: 'public' },
  { label: '월계문화정보도서관', names: ['월계문화정보도서관'], minZoom: 15.4, priority: 6, kind: 'public' },
  { label: '해인병원', names: ['해인병원'], minZoom: 15.5, priority: 7, kind: 'public' },
  { label: '광운대 공공기숙사', names: ['광운대학교 공공기숙사'], minZoom: 15.6, priority: 8, kind: 'campus' },
  { label: '광운중·고등학교', names: ['광운중학교', 'A동(중학교본관)', 'E동(고등학교본관)'], minZoom: 15.8, priority: 9, kind: 'school' },
  { label: '광운초등학교', names: ['광운초등학교'], minZoom: 16, priority: 10, kind: 'school' },
  { label: '남대문중학교', names: ['남대문중학교'], minZoom: 16, priority: 11, kind: 'school' },
  { label: '선곡초등학교', names: ['선곡초등학교', '선곡초등학교(교사1동)', '선곡초등학교(교사2동)', '선곡초등학교(체육관동)'], minZoom: 16, priority: 12, kind: 'school' },
  { label: '월계동성당', names: ['월계동성당'], minZoom: 16.1, priority: 13, kind: 'public' },
  { label: '월계고등학교', names: ['월계고등학교'], minZoom: 16.1, priority: 14, kind: 'school' },
  { label: '월계중학교', names: ['월계중학교'], minZoom: 16.1, priority: 15, kind: 'school' },
  { label: '월계초등학교', names: ['월계초등학교'], minZoom: 16.1, priority: 16, kind: 'school' },
  { label: '그랑빌아파트', names: ['그랑빌아파트'], minZoom: 16.4, priority: 20, kind: 'residence' },
  { label: '월계센트럴아이파크', names: ['월계센트럴아이파크아파트'], minZoom: 16.4, priority: 21, kind: 'residence' },
  { label: '롯데캐슬 루나', names: ['롯데캐슬 루나'], minZoom: 16.5, priority: 22, kind: 'residence' },
  { label: '월계대우아파트', names: ['월계대우아파트'], minZoom: 16.5, priority: 23, kind: 'residence' },
  { label: '두산아파트', names: ['두산아파트'], minZoom: 16.6, priority: 24, kind: 'residence' },
];

function roundCoordinates(value) {
  if (typeof value === 'number') return Number(value.toFixed(6));
  if (Array.isArray(value)) return value.map(roundCoordinates);
  return value;
}

function flatCoordinates(geometry) {
  const result = [];
  const visit = (value) => {
    if (Array.isArray(value) && typeof value[0] === 'number') result.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
  };
  visit(geometry.coordinates);
  return result;
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const optimized = {
  type: 'FeatureCollection',
  features: source.features.map((feature) => ({
    type: 'Feature',
    properties: {
      levels: Math.max(1, Number.parseInt(feature.properties?.gro_flo_co, 10) || 1),
    },
    geometry: {
      type: feature.geometry.type,
      coordinates: roundCoordinates(feature.geometry.coordinates),
    },
  })),
};

const landmarks = {
  type: 'FeatureCollection',
  features: landmarkRules.flatMap((rule) => {
    const matched = source.features.filter((feature) => rule.names.includes((feature.properties?.buld_nm || '').trim()));
    const points = matched.flatMap((feature) => flatCoordinates(feature.geometry));
    if (points.length === 0) return [];
    const lngs = points.map((point) => point[0]);
    const lats = points.map((point) => point[1]);
    return [{
      type: 'Feature',
      properties: { label: rule.label, minZoom: rule.minZoom, priority: rule.priority, kind: rule.kind },
      geometry: {
        type: 'Point',
        coordinates: [
          Number(((Math.min(...lngs) + Math.max(...lngs)) / 2).toFixed(6)),
          Number(((Math.min(...lats) + Math.max(...lats)) / 2).toFixed(6)),
        ],
      },
    }];
  }),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(optimized));
await writeFile(landmarksPath, JSON.stringify(landmarks));

const sourceKb = Math.round((await readFile(sourcePath)).byteLength / 1024);
const outputKb = Math.round((await readFile(outputPath)).byteLength / 1024);
console.log(`3D buildings: ${source.features.length} features, ${sourceKb}KB -> ${outputKb}KB`);
console.log(`3D landmarks: ${landmarks.features.length} labels`);
