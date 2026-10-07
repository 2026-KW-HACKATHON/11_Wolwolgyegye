import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sourcePath = resolve('public/data/vworld/buildings.geojson');
const outputPath = resolve('public/data/3d/buildings.geojson');

function roundCoordinates(value) {
  if (typeof value === 'number') return Number(value.toFixed(6));
  if (Array.isArray(value)) return value.map(roundCoordinates);
  return value;
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

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(optimized));

const sourceKb = Math.round((await readFile(sourcePath)).byteLength / 1024);
const outputKb = Math.round((await readFile(outputPath)).byteLength / 1024);
console.log(`3D buildings: ${source.features.length} features, ${sourceKb}KB -> ${outputKb}KB`);
