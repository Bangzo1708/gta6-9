// The city of Port Solano: a road grid, blocks of buildings, parks, and one
// landmark set per variant (beach + pier, neon downtown, harbor + cranes).
// Generation is seeded, so every variant's city is identical on every run.
import { WORLD, ROAD_AT, ROAD_W, PLACES } from './config.js';

// A block is the square between four roads. Returns its inner rectangle.
function blockRect(bx, by) {
  const x0 = ROAD_AT[bx] + ROAD_W / 2 + 14;
  const y0 = ROAD_AT[by] + ROAD_W / 2 + 14;
  const x1 = ROAD_AT[bx + 1] - ROAD_W / 2 - 14;
  const y1 = ROAD_AT[by + 1] - ROAD_W / 2 - 14;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// The landmark rectangles each variant reserves (nothing else builds there).
export function landmarkRects(variant) {
  const out = [];
  const kinds = variant.landmarkKinds;
  if (kinds.includes('beach')) out.push({ kind: 'beach', x: 0, y: 3040, w: WORLD, h: 160 });
  if (kinds.includes('pier')) out.push({ kind: 'pier', x: 1520, y: 3030, w: 160, h: 170 });
  if (kinds.includes('marina')) out.push({ kind: 'marina', x: 2460, y: 3030, w: 420, h: 170 });
  if (kinds.includes('port')) out.push({ kind: 'port', x: 0, y: 0, w: WORLD, h: 150 });
  if (kinds.includes('cranes')) out.push({ kind: 'cranes', x: 600, y: 0, w: 900, h: 150 });
  if (kinds.includes('stadium')) out.push({ kind: 'stadium', x: 2240, y: 640, w: 320, h: 320 });
  if (kinds.includes('plaza')) out.push({ kind: 'plaza', x: 2040, y: 1640, w: 320, h: 320 });
  if (kinds.includes('towers')) out.push({ kind: 'towers', x: 1640, y: 1640, w: 320, h: 320 });
  if (kinds.includes('park')) out.push({ kind: 'park', x: 1240, y: 1240, w: 320, h: 320 });
  return out;
}

export function generateCity(variant, rng) {
  const landmarks = landmarkRects(variant);
  const buildings = [];
  const parks = [];
  const palms = [];
  const lamps = [];
  const signs = [];
  const lots = [];

  // 7x7 blocks between the 8 roads each way.
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 7; by++) {
      const r = blockRect(bx, by);
      if (landmarks.some((l) => rectsOverlap(r, l))) continue;
      const roll = rng.next();
      if (roll < 0.12) {
        // Park block: grass, trees, a path.
        const trees = [];
        for (let i = 0; i < 9; i++) {
          trees.push({ x: r.x + 30 + rng.range(0, r.w - 60), y: r.y + 30 + rng.range(0, r.h - 60), r: rng.range(14, 26) });
        }
        parks.push({ x: r.x, y: r.y, w: r.w, h: r.h, trees });
        continue;
      }
      if (roll < 0.22) {
        // Parking lot: a few parked cars, no buildings.
        lots.push({ x: r.x, y: r.y, w: r.w, h: r.h });
        continue;
      }
      // Building block: 2-5 buildings with a courtyard gap.
      const n = rng.int(2, 5);
      for (let i = 0; i < n; i++) {
        const bw = rng.range(70, 130);
        const bh = rng.range(70, 130);
        const bx0 = r.x + rng.range(8, Math.max(9, r.w - bw - 8));
        const by0 = r.y + rng.range(8, Math.max(9, r.h - bh - 8));
        const b = { x: bx0, y: by0, w: bw, h: bh, color: rng.pick(variant.buildingRoofs), h: rng.range(14, 46) };
        if (!buildings.some((o) => rectsOverlap(b, { x: o.x - 12, y: o.y - 12, w: o.w + 24, h: o.h + 24 }))) {
          buildings.push(b);
        }
      }
      // A couple of palms on the block corners.
      for (let i = 0; i < 2; i++) {
        if (rng.chance(0.6)) palms.push({ x: r.x + rng.range(10, r.w - 10), y: r.y + rng.range(10, r.h - 10) });
      }
    }
  }

  // Neon signs on downtown towers (neon variant) and a few billboards.
  if (variant.neon) {
    const words = ['SOLANO', 'NEON', 'PIER 9', 'HOTEL', '24H TACOS', 'CASINO', 'RADIO', 'BAY'];
    for (let i = 0; i < 10; i++) {
      const b = buildings[rng.int(0, buildings.length - 1)];
      if (!b) break;
      signs.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, text: rng.pick(words), color: rng.pick(['#ff4fd8', '#33e0ff', '#ffe14d', '#7dff5e']) });
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const b = buildings[rng.int(0, buildings.length - 1)];
      if (!b) break;
      signs.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, text: rng.pick(['SOLANO', 'PIER 9', 'BAY HOTEL', 'TACOS']), color: '#e8e4d8' });
    }
  }

  // Street lamps at every intersection, palms along the beach road.
  for (const rx of ROAD_AT) for (const ry of ROAD_AT) {
    lamps.push({ x: rx + ROAD_W / 2 + 8, y: ry + ROAD_W / 2 + 8 });
  }
  for (let x = 120; x < WORLD; x += 160) palms.push({ x, y: 3020 });

  // Port cranes + container rows (sunset variant).
  const cranes = [];
  const containers = [];
  if (variant.landmarkKinds.includes('cranes')) {
    for (let i = 0; i < 4; i++) cranes.push({ x: 700 + i * 260, y: 90 });
    for (let i = 0; i < 14; i++) {
      containers.push({ x: 1800 + (i % 7) * 130, y: 40 + Math.floor(i / 7) * 60, color: rng.pick(['#c96a3c', '#3c7a96', '#7a9a3c', '#b03a3a']) });
    }
  }

  return {
    size: WORLD, roads: ROAD_AT.slice(), roadW: ROAD_W,
    buildings, parks, palms, lamps, signs, lots, landmarks, cranes, containers,
    spawn: { x: PLACES.garage.x, y: PLACES.garage.y + 120 },
    hospital: PLACES.hospital,
  };
}

// --- queries the gameplay uses -------------------------------------------

export function isOnRoad(city, x, y) {
  const m = ROAD_W / 2;
  return city.roads.some((r) => Math.abs(x - r) < m) || city.roads.some((r) => Math.abs(y - r) < m);
}

// Nearest road coordinate on one axis, for traffic lane following.
export function nearestRoad(city, v) {
  let best = city.roads[0], d = Infinity;
  for (const r of city.roads) {
    const dd = Math.abs(v - r);
    if (dd < d) { d = dd; best = r; }
  }
  return best;
}

export function buildingAt(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Push a circle (x, y, r) out of every building it overlaps. Returns true if it hit.
export function resolveBuildingCollision(city, e, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - cx, dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      e.x = cx + (dx / d) * r;
      e.y = cy + (dy / d) * r;
      hit = true;
    } else if (d2 <= 0.0001) {
      // Centre inside the building: push out along the smallest axis.
      const left = e.x - b.x, right = b.x + b.w - e.x;
      const top = e.y - b.y, bot = b.y + b.h - e.y;
      const m = Math.min(left, right, top, bot);
      if (m === left) e.x = b.x - r; else if (m === right) e.x = b.x + b.w + r;
      else if (m === top) e.y = b.y - r; else e.y = b.y + b.h + r;
      hit = true;
    }
  }
  return hit;
}

export function clampToWorld(e, m = 20) {
  e.x = Math.max(m, Math.min(WORLD - m, e.x));
  e.y = Math.max(m, Math.min(WORLD - m, e.y));
}
