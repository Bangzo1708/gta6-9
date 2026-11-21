// The wanted system: stars that rise with crime and fall when Mara lays
// low, the cruisers that chase her, and the police helicopter that joins
// the hunt at four stars and up.
import { TUNE } from './config.js';
import { spawnPoliceCar, makeHeli } from './vehicles.js';
import { policeShoot, explodeCar } from './player.js';

export function updateWanted(S, dt) {
  const p = S.player;
  S.wantedTimer += dt;

  // Laying low: no police nearby and no fresh crime for a while.
  const nearestCop = nearestPoliceDist(S);
  if (S.wanted > 0 && S.heat <= 0 && nearestCop > 380) {
    S.hideTimer = (S.hideTimer || 0) + dt;
    if (S.hideTimer > TUNE.wantedHideSeconds) {
      S.wanted -= 1;
      S.hideTimer = 0;
      S.message = { text: S.wanted > 0 ? `Heat cooling... ${S.wanted}★ left` : 'You lost them. Clean — for now.', t: 2.5 };
    }
  } else {
    S.hideTimer = 0;
  }
  S.heat = Math.max(0, S.heat - dt * 0.05);

  // Cruisers on the street scale with the wanted level.
  const wantCops = S.wanted === 0 ? 0 : S.wanted + 1;
  const cops = S.cars.filter((c) => c.kind === 'police');
  if (cops.length < wantCops && S.mode === 'play') {
    const car = spawnPoliceCar(S.city, S.rng, p.x, p.y);
    // Spawn a few blocks away, never on top of the player.
    let tries = 0;
    while (Math.hypot(car.x - p.x, car.y - p.y) < 420 && tries < 8) {
      car.x = p.x + S.rng.range(-700, 700);
      car.y = p.y + S.rng.range(-700, 700);
      tries++;
    }
    S.cars.push(car);
    S.audio.sirenBurst();
  }
  if (cops.length > wantCops) {
    // Too many cruisers: the farthest one gives up and drives off.
    let far = null, fd = -1;
    for (const c of cops) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d > fd) { fd = d; far = c; }
    }
    if (far && fd > 900) S.cars = S.cars.filter((c) => c !== far);
  }

  // The helicopter joins at four stars.
  if (S.wanted >= TUNE.heliMinWanted && !S.heli && S.mode === 'play') {
    S.heli = makeHeli(p.x + 200, p.y - 300);
    S.message = { text: 'POLICE HELICOPTER overhead — the searchlight is on you!', t: 3.5 };
    S.audio.sirenBurst();
  }
  if (S.wanted < TUNE.heliMinWanted && S.heli) S.heli = null;

  // Cruisers shoot when close, and ram the player's car.
  for (const cop of S.cars.filter((c) => c.kind === 'police')) {
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    cop.shootT = (cop.shootT || S.rng.range(1, 2.5)) - dt;
    if (d < 520 && cop.shootT <= 0) {
      cop.shootT = S.rng.range(1.1, 2.2);
      policeShoot(S, cop);
    }
    if (p.car && d < 60 && Math.abs(cop.speed) > 80) {
      // A ram: shake, damage the player's car, slow both down.
      cop.speed *= 0.4;
      p.car.speed *= 0.55;
      p.car.hp -= 6;
      S.shake = Math.max(S.shake, 7);
      S.audio.thud();
      if (p.car.hp <= 0) explodeCar(S, p.car);
    }
    // Busted: a cruiser sits on Mara while she is on foot.
    if (p.onFoot && d < 44 && Math.abs(cop.speed) < 60) {
      p.bustT += dt;
      if (p.bustT > TUNE.bustSeconds) {
        S.mode = 'busted';
        S.modeT = 0;
        p.bustT = 0;
      }
    } else {
      p.bustT = Math.max(0, p.bustT - dt * 2);
    }
  }
}

export function nearestPoliceDist(S) {
  let best = Infinity;
  for (const c of S.cars) {
    if (c.kind !== 'police') continue;
    const d = Math.hypot(c.x - S.player.x, c.y - S.player.y);
    if (d < best) best = d;
  }
  return best;
}

// Police searchlight: when the heli is up, being inside its cone keeps the
// heat from cooling. Called from the main update.
export function inSearchlight(S) {
  if (!S.heli) return false;
  const d = Math.hypot(S.heli.lightX - S.player.x, S.heli.lightY - S.player.y);
  return d < 130;
}
