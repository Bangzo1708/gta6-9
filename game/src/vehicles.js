// Vehicles: the player's car, traffic, parked cars and police cruisers,
// plus the police helicopter. All movement is fixed-step and seeded.
import { WORLD } from './config.js';
import { nearestRoad, resolveBuildingCollision, clampToWorld } from './city.js';

export const CAR_MODELS = [
  { name: 'Comet GT', color: '#e33e3e', len: 46, wid: 22, top: 640, sport: true },
  { name: 'Bison SUV', color: '#3e6fd8', len: 50, wid: 24, top: 480, sport: false },
  { name: 'Sunny Coupe', color: '#f2c230', len: 44, wid: 21, top: 560, sport: true },
  { name: 'Dune Buggy', color: '#7ac74f', len: 44, wid: 22, top: 500, sport: false },
  { name: 'Metro Sedan', color: '#c8c8c8', len: 46, wid: 22, top: 500, sport: false },
  { name: 'Taxi Cab', color: '#f2b705', len: 46, wid: 22, top: 520, sport: false },
  { name: 'Vintage', color: '#8a5a9e', len: 48, wid: 23, top: 460, sport: false },
  { name: 'Pickup', color: '#4a7a5a', len: 50, wid: 23, top: 500, sport: false },
];
export const POLICE_COLOR = '#20242e';
export const POLICE_TOP = 600;

export function makeCar(x, y, angle, model, kind) {
  return {
    kind: kind || 'traffic', // traffic | parked | police | player
    model, x, y, angle, speed: 0,
    len: model.len, wid: model.wid,
    color: model.color, hp: 100,
    // traffic AI state
    axis: 'x', dir: 1, lane: 0, targetSpeed: 0,
    // police AI state
    stuck: 0, reverse: 0,
    // player driving state
    boost: 0, skid: 0,
  };
}

export function spawnTrafficCar(city, rng) {
  const horizontal = rng.chance(0.5);
  const road = rng.pick(city.roads);
  const along = rng.range(100, WORLD - 100);
  const lane = rng.chance(0.5) ? 18 : -18;
  const model = rng.pick(CAR_MODELS);
  const car = makeCar(horizontal ? along : road + lane, horizontal ? road + lane : along,
    horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
    model, 'traffic');
  car.axis = horizontal ? 'x' : 'y';
  car.dir = horizontal ? (car.angle === 0 ? 1 : -1) : (car.angle === Math.PI / 2 ? 1 : -1);
  car.lane = lane;
  car.targetSpeed = rng.range(55, 115);
  car.speed = car.targetSpeed;
  return car;
}

export function spawnParkedCar(city, rng) {
  // Parked along a road edge, facing the road direction.
  const horizontal = rng.chance(0.5);
  const road = rng.pick(city.roads);
  const along = rng.range(120, WORLD - 120);
  const side = rng.chance(0.5) ? 1 : -1;
  const off = (city.roadW / 2 + 14) * side;
  const model = rng.pick(CAR_MODELS);
  const car = makeCar(horizontal ? along : road + off, horizontal ? road + off : along,
    horizontal ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2), model, 'parked');
  car.speed = 0;
  return car;
}

export function spawnPoliceCar(city, rng, nearX, nearY) {
  // A cruiser spawns on a road a few blocks from the player.
  const road = nearestRoad(city, nearX + rng.range(-500, 500));
  const road2 = nearestRoad(city, nearY + rng.range(-500, 500));
  const car = makeCar(road, road2, rng.range(0, Math.PI * 2),
    { name: 'Cruiser', color: POLICE_COLOR, len: 48, wid: 23, top: POLICE_TOP, sport: false }, 'police');
  car.axis = rng.chance(0.5) ? 'x' : 'y';
  car.dir = rng.chance(0.5) ? 1 : -1;
  car.targetSpeed = POLICE_TOP;
  return car;
}

// --- traffic ----------------------------------------------------------------

function trafficStep(car, city, rng, dt) {
  // Drive along the current road; at intersections sometimes turn.
  const pos = car.axis === 'x' ? car.x : car.y;
  const cross = nearestRoad(city, car.axis === 'x' ? car.y : car.x);
  const nearCross = Math.abs((car.axis === 'x' ? car.y : car.x) - cross) < 6;
  if (nearCross && rng.chance(0.004)) {
    // Turn onto the crossing road.
    const newAxis = car.axis === 'x' ? 'y' : 'x';
    car.axis = newAxis;
    car.dir = rng.chance(0.5) ? 1 : -1;
    car.angle = newAxis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (newAxis === 'x') car.y = cross + car.lane; else car.x = cross + car.lane;
  }
  const target = car.targetSpeed;
  car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
  const step = car.speed * car.dir * dt;
  if (car.axis === 'x') car.x += step; else car.y += step;
  // Wrap around the city edge instead of vanishing.
  if (car.x < 60) { car.x = 60; car.dir = 1; car.angle = 0; }
  if (car.x > WORLD - 60) { car.x = WORLD - 60; car.dir = -1; car.angle = Math.PI; }
  if (car.y < 60) { car.y = 60; car.dir = 1; car.angle = Math.PI / 2; }
  if (car.y > WORLD - 60) { car.y = WORLD - 60; car.dir = -1; car.angle = -Math.PI / 2; }
  clampToWorld(car, 40);
}

// --- police chase -----------------------------------------------------------

function policeStep(car, target, city, dt) {
  const dx = target.x - car.x, dy = target.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Steer toward the player, harder when close.
  const steer = Math.max(-2.6, Math.min(2.6, diff * 3.2));
  if (car.reverse > 0) {
    car.reverse -= dt;
    car.speed = Math.max(-160, car.speed - 500 * dt);
  } else {
    car.angle += steer * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.35);
    const top = POLICE_TOP * (dist > 500 ? 1 : 0.82);
    car.speed += ((dist > 140 ? top : top * 0.55) - car.speed) * Math.min(1, dt * 1.1);
  }
  const px = car.x, py = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (resolveBuildingCollision(city, car, car.len / 2)) {
    // Stuck on a building: back up and swing around.
    car.x = px; car.y = py;
    car.speed *= 0.3;
    car.stuck += dt;
    if (car.stuck > 0.5) { car.reverse = 0.7; car.stuck = 0; car.angle += 0.9; }
  } else {
    car.stuck = Math.max(0, car.stuck - dt);
  }
  clampToWorld(car, 40);
}

// --- the player car ---------------------------------------------------------

export function drivePlayerCar(car, input, dt) {
  const fwd = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const top = car.model.top * (car.boost > 0 ? 1.35 : 1);
  if (fwd > 0) car.speed += 620 * dt;
  else if (fwd < 0) car.speed -= car.speed > 0 ? 900 * dt : 260 * dt;
  else car.speed -= car.speed * Math.min(1, dt * 1.2);
  car.speed = Math.max(-220, Math.min(top, car.speed));
  const grip = Math.min(1, Math.abs(car.speed) / 140 + 0.25);
  car.angle += turn * 2.9 * grip * dt * (car.speed >= 0 ? 1 : -1) * (input.handbrake ? 1.5 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (input.handbrake && Math.abs(car.speed) > 120) car.skid = 0.35;
  car.skid = Math.max(0, car.skid - dt);
  if (car.boost > 0) car.boost -= dt;
  return car;
}

// --- helicopter ---------------------------------------------------------------

export function makeHeli(x, y) {
  return { x, y, angle: 0, alt: 130, rotor: 0, lightX: x, lightY: y };
}

export function heliStep(heli, target, dt) {
  // Ease to a hover point offset from the player, so the helicopter never
  // sits exactly on top of Mara; rotor spinning, searchlight sweeping.
  const hx = target.x + 130, hy = target.y - 110;
  heli.x += (hx - heli.x) * Math.min(1, dt * 1.4);
  heli.y += (hy - heli.y) * Math.min(1, dt * 1.4);
  heli.rotor += dt * 22;
  heli.angle = Math.atan2(target.y - heli.y, target.x - heli.x);
  const t = heli.rotor * 0.35;
  heli.lightX = target.x + Math.cos(t) * 60;
  heli.lightY = target.y + Math.sin(t) * 60;
}

// --- shared update ------------------------------------------------------------

export function updateVehicles(S, dt) {
  const { city, rng } = S;
  for (const car of S.cars) {
    if (car.kind === 'traffic') trafficStep(car, city, rng, dt);
    else if (car.kind === 'police') policeStep(car, S.player, city, dt);
    else if (car.kind === 'player' && S.player.car === car) drivePlayerCar(car, S.input, dt);
    // Parked cars never move.
    if (car.kind !== 'player') resolveBuildingCollision(city, car, car.len / 2);
  }
  if (S.heli) heliStep(S.heli, S.player, dt);
}

// Simple circle-vs-car test, used for bullets, rams and pickups.
export function carHit(car, x, y, r) {
  const dx = x - car.x, dy = y - car.y;
  const c = Math.cos(-car.angle), s = Math.sin(-car.angle);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) < car.len / 2 + r && Math.abs(ly) < car.wid / 2 + r;
}
