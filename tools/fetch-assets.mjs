// Télécharge les modèles, textures et HDRI (Poly Haven, CC0) et les textures de planètes
// (Solar System Scope, CC BY 4.0) dans public/assets. Usage : node tools/fetch-assets.mjs
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const OUT = 'public/assets';
const UA = { 'User-Agent': 'le-labo-asset-fetcher' };

const MODELS = [
  'GothicCabinet_01', 'vintage_cabinet_01', 'WoodenTable_01', 'wooden_table_02', 'WoodenChair_01',
  'ArmChair_01', 'vintage_grandfather_clock_01', 'standing_chalkboard_01', 'Chandelier_01',
  'vintage_oil_lamp', 'brass_candleholders', 'chemistry_set', 'vintage_microscope', 'magnifying_glass_01',
  'book_encyclopedia_set_01', 'marble_bust_01', 'fancy_picture_frame_01',
  'fancy_picture_frame_02', 'potted_plant_02', 'seadogs_compass', 'treasure_chest', 'antique_ceramic_vase_01',
  'vintage_binocular', 'mantel_clock_01', 'vintage_wooden_drawer_01',
  // bureau
  'round_spectacles', 'vintage_pocket_watch', 'wooden_candlestick', 'postcard_set_01', 'wicker_basket_01',
  'vintage_suitcase', 'Lantern_01', 'ClassicNightstand_01', 'stationery_supplies', 'painted_wooden_shelves',
];
const TEXTURES = ['herringbone_parquet', 'dark_paneled_wood', 'beige_wall_001', 'white_plaster_02', 'dark_wood', 'rosewood_veneer1'];
const HDRI = 'vintage_measuring_lab';
const PLANETS = [
  '2k_mercury.jpg', '2k_venus_atmosphere.jpg', '2k_mars.jpg', '2k_jupiter.jpg', '2k_saturn.jpg',
  '2k_saturn_ring_alpha.png', '2k_uranus.jpg', '2k_neptune.jpg', '2k_moon.jpg',
];

const exists = (p) => access(p).then(() => true, () => false);

async function download(url, dest) {
  if (await exists(dest)) return;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log('  ↓', dest);
}

const files = (id) => fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA }).then((r) => r.json());

for (const id of MODELS) {
  console.log('modèle', id);
  const gltf = (await files(id)).gltf?.['1k']?.gltf;
  if (!gltf) {
    console.log('  pas de glTF, ignoré');
    continue;
  }
  const dir = join(OUT, 'models', id);
  await download(gltf.url, join(dir, `${id}.gltf`));
  for (const [path, f] of Object.entries(gltf.include)) await download(f.url, join(dir, path));
}

for (const id of TEXTURES) {
  console.log('texture', id);
  const f = await files(id);
  const maps = { diff: f.Diffuse, nor: f.nor_gl, arm: f.arm };
  for (const [name, m] of Object.entries(maps)) {
    if (m) await download(m['1k'].jpg.url, join(OUT, 'textures', id, `${name}.jpg`));
  }
}

console.log('hdri', HDRI);
await download((await files(HDRI)).hdri['1k'].hdr.url, join(OUT, 'hdri', `${HDRI}.hdr`));

for (const p of PLANETS) {
  console.log('planète', p);
  await download(`https://www.solarsystemscope.com/textures/download/${p}`, join(OUT, 'planets', p.replace('2k_', '')));
}
console.log('Terminé.');
