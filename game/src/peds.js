// Pedestrians: crowds on the sidewalks, fleeing when shots ring out,
// and the taxi-fare side activity (drive a passenger across town for cash).
import { WORLD, TUNE } from './config.js';
import { nearestRoad, resolveBuildingCollision, clampToWorld } from './city.js';

const SHIRTS = ['#e35d6a', '#4a90d9', '#f2c230', '#7ac74f', '#e8e8e8', '#c96fd8', '#ff8a3c', '#3ec9a7'];
const PANTS = ['#2e3440', '#4a4a55', '#6a5a4a', '#24344d', '#3a3a3a'];

export function makePed(city, rng, x, y) {
  const horizontal = rng.chance(0.5);
  const road = rng.pick(city.roads);
  const px = x !== undefined ? x : (horizontal ? rng.range(100, WORLD - 100) : road + (rng.chance(0.5) ? 52 : -52));
  const py = y !== undefined ? y : (horizontal ? road + (rng.chance(0.5) ? 52 : -52) : rng.range(100, WORLD - 100));
  return {
    x: px, y: py,
    angle: horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
    speed: rng.range(28, 55), walkPhase: rng.range(0, Math.PI * 2),
    shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS),
    skin: rng.pick(['#f0c8a0', '#c98d5f', '#8a5a3c', '#e8b88a']),
    state: 'walk', // walk | flee | wait (taxi fare)
    fleeT: 0, fare: false,
  };
}

export function updatePeds(S, dt) {
  const { city, rng, player } = S;
  for (const p of S.peds) {
    p.walkPhase += dt * (p.state === 'flee' ? 14 : 7);
    if (p.state === 'flee') {
      p.fleeT -= dt;
      const dx = p.x - player.x, dy = p.y - player.y;
      const d = Math.hypot(dx, dy) || 1;
      p.angle = Math.atan2(dy, dx);
      p.x += Math.cos(p.angle) * 150 * dt;
      p.y += Math.sin(p.angle) * 150 * dt;
      if (p.fleeT <= 0) p.state = 'walk';
    } else if (p.state === 'walk') {
      const speed = p.speed;
      p.x += Math.cos(p.angle) * speed * dt;
      p.y += Math.sin(p.angle) * speed * dt;
      // At an intersection, sometimes turn onto the crossing sidewalk.
      const onX = Math.abs(p.y - nearestRoad(city, p.y)) < 4;
      const onY = Math.abs(p.x - nearestRoad(city, p.x)) < 4;
      if ((onX || onY) && rng.chance(0.01)) {
        p.angle = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      }
      // Keep peds on sidewalks: nudge them toward the nearest road line on
      // the axis perpendicular to their walk direction.
      if (Math.abs(Math.cos(p.angle)) > 0.5) {
        const ry = nearestRoad(city, p.y);
        const want = ry + (p.y > ry ? 52 : -52);
        p.y += (want - p.y) * Math.min(1, dt * 0.8);
      } else {
        const rx = nearestRoad(city, p.x);
        const want = rx + (p.x > rx ? 52 : -52);
        p.x += (want - p.x) * Math.min(1, dt * 0.8);
      }
    }
    // 'wait' peds (taxi fares) stand still.
    resolveBuildingCollision(city, p, 10);
    clampToWorld(p, 30);
  }
}

// A gunshot nearby makes every ped in earshot run.
export function scarePeds(S, x, y, radius) {
  for (const p of S.peds) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) { p.state = 'flee'; p.fleeT = 2.5; }
  }
}

// --- taxi fares ---------------------------------------------------------------

export function spawnFare(S) {
  const { city, rng } = S;
  const road = rng.pick(city.roads);
  const along = rng.range(200, WORLD - 200);
  const horizontal = rng.chance(0.5);
  const ped = makePed(city, rng,
    horizontal ? along : road + 52, horizontal ? road + 52 : along);
  ped.state = 'wait';
  ped.fare = true;
  ped.shirt = '#ffd23e';
  S.peds.push(ped);
  S.fare = { ped, stage: 'pickup', dest: null, timer: 0 };
}

export function updateFare(S, dt) {
  const fare = S.fare;
  if (!fare) return;
  if (fare.stage === 'pickup') {
    // Player drives up in a car and the passenger hops in.
    if (S.player.car && Math.hypot(S.player.x - fare.ped.x, S.player.y - fare.ped.y) < 90) {
      const dest = pickFareDestination(S);
      fare.dest = dest;
      fare.stage = 'ride';
      fare.ped.state = 'gone';
      S.peds = S.peds.filter((p) => p !== fare.ped);
      S.message = { text: `Passenger aboard — take them to ${dest.label}`, t: 3 };
      S.missionMarker = { x: dest.x, y: dest.y, label: dest.label, color: '#ffd23e' };
    }
  } else if (fare.stage === 'ride') {
    if (Math.hypot(S.player.x - fare.dest.x, S.player.y - fare.dest.y) < 110) {
      S.cash += TUNE.taxiFare;
      S.message = { text: `Fare complete! +$${TUNE.taxiFare}`, t: 3 };
      S.fare = null;
      S.missionMarker = missionMarkerOf(S);
      S.fareCooldown = 20;
    }
  }
}

function pickFareDestination(S) {
  const { rng } = S;
  const spots = [
    { x: 600, y: 600, label: 'Downtown' },
    { x: 2600, y: 1000, label: 'East Side' },
    { x: 1000, y: 2600, label: 'South Docks' },
    { x: 2200, y: 2200, label: 'Neon Plaza' },
    { x: 1600, y: 3000, label: 'The Pier' },
  ];
  return rng.pick(spots);
}

// --- street packages ----------------------------------------------------------

export function spawnPackage(S) {
  const { city, rng } = S;
  const road = rng.pick(city.roads);
  const along = rng.range(200, WORLD - 200);
  const horizontal = rng.chance(0.5);
  S.packages.push({
    x: horizontal ? along : road + 60,
    y: horizontal ? road + 60 : along,
    t: 0,
  });
}

export function updatePackages(S, dt) {
  for (const pk of S.packages) pk.t += dt;
  for (let i = S.packages.length - 1; i >= 0; i--) {
    const pk = S.packages[i];
    if (Math.hypot(S.player.x - pk.x, S.player.y - pk.y) < 46) {
      S.cash += TUNE.packageReward;
      S.message = { text: `Found a stash! +$${TUNE.packageReward}`, t: 3 };
      S.packages.splice(i, 1);
      spawnPackage(S);
      S.audio.blip(880, 0.12);
    }
  }
}

export function missionMarkerOf(S) {
  if (!S.missions) return null;
  return S.missions.markerOf(S);
}
