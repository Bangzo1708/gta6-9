// Deterministic screenshot scenes (?shot=cover|street|combat|menu).
// Each one scripts the city into a single readable frame — a chase, a
// street walk, a shootout, the title — then freezes it, so the same URL
// always renders the same pixels.
import { makeCar, makeHeli, spawnPoliceCar, CAR_MODELS } from './vehicles.js';
import { makePed } from './peds.js';

// How many fixed 1/60s steps each scene simulates before the capture.
export function shotSteps(name) {
  return { cover: 70, street: 50, combat: 110, menu: 1 }[name] || 120;
}

export function applyShot(S, name) {
  const city = S.city;
  const rng = S.rng;
  S.shotName = name;
  S.shotInput = {};

  if (name === 'menu') {
    S.mode = 'title';
    S.menuIndex = 0;
    S.camera.x = 1800; S.camera.y = 1800; S.camera.zoom = 0.8;
    S.player.x = 1800; S.player.y = 1800;
    return;
  }

  S.mode = 'play';
  if (name === 'cover') {
    // A four-star chase at a downtown crossroads: Mara in a Comet GT,
    // three cruisers on her tail, the helicopter overhead, traffic and
    // pedestrians everywhere, Chapter 6 on the HUD.
    const px = 1800, py = 1800;
    const comet = CAR_MODELS[0];
    const car = makeCar(px, py, -Math.PI / 2, comet, 'player');
    car.speed = 380;
    S.cars = S.cars.filter((c) => c.kind === 'parked');
    S.cars.push(car);
    S.player.car = car;
    S.player.onFoot = false;
    S.player.x = px; S.player.y = py;
    S.wanted = 4;
    S.heli = makeHeli(px + 140, py - 200);
    // Three cruisers tight on her tail, close enough to stay in frame.
    for (let i = 0; i < 3; i++) {
      const cop = spawnPoliceCar(city, rng, px, py);
      cop.x = px + rng.range(-30, 30) + (i === 2 ? 60 : 0);
      cop.y = py + 170 + i * 120;
      cop.angle = -Math.PI / 2;
      cop.speed = 470;
      S.cars.push(cop);
    }
    // Traffic on the road ahead and the cross street she is about to hit.
    const trafficSpots = [
      [1800, 1150, -Math.PI / 2, -1], [1800, 950, Math.PI / 2, 1],
      [1450, 1400, 0, 1], [2150, 1400, Math.PI, -1], [1800, 1500, -Math.PI / 2, -1],
    ];
    for (const [tx, ty, ta, tdir] of trafficSpots) {
      const t = makeCar(tx, ty, ta, CAR_MODELS[1 + (S.rng.int(0, 5))], 'traffic');
      t.axis = (ta === 0 || ta === Math.PI) ? 'x' : 'y';
      t.dir = tdir; t.targetSpeed = 85; t.speed = 85;
      S.cars.push(t);
    }
    // Pedestrians on the sidewalks along her escape route.
    S.peds = [];
    for (let i = 0; i < 12; i++) {
      const p = makePed(city, rng, 1748 + rng.range(-40, 40), 1150 + rng.range(0, 650));
      S.peds.push(p);
    }
    for (let i = 0; i < 6; i++) {
      const p = makePed(city, rng, 1500 + rng.range(0, 600), 1400 + (rng.chance(0.5) ? 52 : -52));
      S.peds.push(p);
    }
    S.missions.startChapter(S, 5);
    // Jump straight to the survive step (the trap is sprung).
    S.missions.active.step = 0;
    S.cash = 12450;
    S.clockMinutes = S.cfg.clockStart;
    S.camera.zoom = 0.88;
    S.shotInput = { up: true };
    return;
  }

  if (name === 'street') {
    // On foot by the pier: Mara walking the beach road, peds, parked cars,
    // the Ferris wheel behind her, Chapter 1 on the HUD.
    S.player.onFoot = true;
    S.player.car = null;
    S.player.x = 1560; S.player.y = 2750;
    S.player.angle = Math.PI / 2;
    S.wanted = 0;
    S.cars = S.cars.filter((c) => c.kind === 'parked');
    S.peds = [];
    for (let i = 0; i < 16; i++) {
      const p = makePed(city, rng, 1200 + rng.range(0, 900), 3000 + (rng.chance(0.5) ? 52 : -52));
      S.peds.push(p);
    }
    S.missions.startChapter(S, 0);
    S.cash = 320;
    S.clockMinutes = S.cfg.clockStart;
    S.camera.zoom = 1;
    S.shotInput = { down: true };
    return;
  }

  if (name === 'combat') {
    // A warehouse shootout at dusk: Mara behind a car, Reyes' crew closing
    // in, five stars, the helicopter's searchlight sweeping the ground.
    S.player.onFoot = true;
    S.player.car = null;
    S.player.x = 2560; S.player.y = 2380;
    S.player.aim = Math.PI / 4;
    S.wanted = 5;
    S.heli = makeHeli(2560 + 120, 2380 - 180);
    S.cars = S.cars.filter((c) => c.kind === 'parked');
    const cover = makeCar(2600, 2400, Math.PI / 2, CAR_MODELS[4], 'parked');
    S.cars.push(cover);
    S.peds = [];
    S.missions.startChapter(S, 6);
    S.missions.active.step = 1; // the shoot step
    S.missions.active.steps[1].spawned = false;
    S.missions.active.steps[1].progress = 2;
    S.cash = 9800;
    S.clockMinutes = S.cfg.clockStart;
    S.camera.zoom = 0.95;
    // A few bullets already in the air + muzzle smoke, for motion.
    S.bullets.push({ x: 2560, y: 2380, angle: Math.PI / 4, speed: 900, life: 0.4, from: 'player' });
    S.bullets.push({ x: 2450, y: 2250, angle: Math.PI * 0.8, speed: 820, life: 0.5, from: 'enemy' });
    S.message = { text: "DARIO: They grabbed me, Mara. Warehouse 9. Hurry.", t: 4 };
    S.shotInput = { shoot: true };
    return;
  }
}
