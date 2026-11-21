// Mara Voss on foot and behind the wheel: movement, carjacking, shooting,
// health and the bust/wasted states.
import { TUNE } from './config.js';
import { resolveBuildingCollision, clampToWorld, buildingAt } from './city.js';
import { carHit } from './vehicles.js';
import { scarePeds } from './peds.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, aim: -Math.PI / 2,
    hp: TUNE.playerHp, armor: 50,
    onFoot: true, car: null, speed: 0,
    fireCooldown: 0, hurtT: 0, bustT: 0,
    walkPhase: 0, kills: 0,
  };
}

export function updatePlayer(S, dt) {
  const p = S.player;
  const input = S.input;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);

  // Aim follows the mouse (world coordinates come from the camera).
  p.aim = Math.atan2(S.mouse.wy - p.y, S.mouse.wx - p.x);

  if (p.onFoot) {
    const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const sprint = input.sprint ? 1.55 : 1;
    const sp = TUNE.playerWalk * sprint;
    const len = Math.hypot(mx, my) || 1;
    p.x += (mx / len) * sp * dt * (mx || my ? 1 : 0);
    p.y += (my / len) * sp * dt * (mx || my ? 1 : 0);
    if (mx || my) {
      p.angle = Math.atan2(my, mx);
      p.walkPhase += dt * 11 * sprint;
    }
    p.speed = (mx || my) ? sp : 0;
    resolveBuildingCollision(S.city, p, 14);
    clampToWorld(p, 24);

    if (input.shoot && p.fireCooldown <= 0) shootBullet(S);
  } else if (p.car) {
    // Driving is handled by drivePlayerCar in vehicles.js; sync the player.
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    p.speed = Math.abs(p.car.speed);
    resolveBuildingCollision(S.city, p.car, p.car.len / 2);
    clampToWorld(p.car, 40);
  }

  // Enter / exit a car.
  if (input.enterPressed) {
    input.enterPressed = false;
    if (p.onFoot) tryEnterCar(S);
    else exitCar(S);
  }
  if (input.boostPressed && p.car) {
    input.boostPressed = false;
    p.car.boost = 1.6;
    S.audio.blip(220, 0.2);
    spawnExhaust(S, p.car);
  }
}

function nearestCar(S, maxDist) {
  let best = null, bd = maxDist;
  for (const car of S.cars) {
    if (car.kind === 'player') continue;
    const d = Math.hypot(car.x - S.player.x, car.y - S.player.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function tryEnterCar(S) {
  const p = S.player;
  const car = nearestCar(S, 70);
  if (!car) return;
  const wasParked = car.kind === 'parked';
  const wasTraffic = car.kind === 'traffic';
  car.kind = 'player';
  p.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
  S.audio.door();
  if (wasParked || wasTraffic) {
    // Stealing a car is a crime: the heat rises.
    S.wanted = Math.max(S.wanted, 1);
    S.heat = 1;
    S.wantedTimer = 0;
    S.message = { text: car.model.sport ? `Jacked a ${car.model.name}! The cops noticed.` : `Took a ${car.model.name}. Keep it moving.`, t: 3 };
    if (wasTraffic) scarePeds(S, p.x, p.y, 260);
  }
  if (S.mission) S.missions.onEnterCar(S, car);
}

function exitCar(S) {
  const p = S.player;
  const car = p.car;
  if (!car) return;
  // Step out to the side of the car.
  const side = Math.PI / 2;
  p.x = car.x + Math.cos(car.angle + side) * 34;
  p.y = car.y + Math.sin(car.angle + side) * 34;
  resolveBuildingCollision(S.city, p, 14);
  car.kind = 'parked';
  car.speed = 0;
  p.car = null;
  p.onFoot = true;
  S.audio.door();
  if (S.mission) S.missions.onExitCar(S);
}

function shootBullet(S) {
  const p = S.player;
  p.fireCooldown = TUNE.fireInterval;
  const bx = p.x + Math.cos(p.aim) * 22;
  const by = p.y + Math.sin(p.aim) * 22;
  S.bullets.push({
    x: bx, y: by, angle: p.aim, speed: TUNE.bulletSpeed,
    life: 0.7, from: 'player',
  });
  S.particles.push({ x: bx, y: by, vx: Math.cos(p.aim) * 60, vy: Math.sin(p.aim) * 60, life: 0.12, max: 0.12, color: '#ffe14d', size: 7, kind: 'flash' });
  S.audio.gunshot();
  S.shake = Math.max(S.shake, 3);
  scarePeds(S, p.x, p.y, 420);
  // Firing a gun in public draws the law.
  S.heat = Math.min(1, S.heat + 0.34);
  if (S.heat >= 1) { S.heat = 0; raiseWanted(S, 1, 'Shots fired'); }
}

// A police bullet, fired from a cruiser window.
export function policeShoot(S, car) {
  const p = S.player;
  const a = Math.atan2(p.y - car.y, p.x - car.x) + S.rng.range(-0.12, 0.12);
  S.bullets.push({
    x: car.x + Math.cos(a) * 26, y: car.y + Math.sin(a) * 26,
    angle: a, speed: TUNE.bulletSpeed * 0.85, life: 0.7, from: 'police',
  });
  S.audio.gunshot(true);
}

export function updateBullets(S, dt) {
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    // Buildings stop bullets.
    if (!dead && buildingAt(S.city, b.x, b.y)) {
      dead = true;
      S.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#ffd76a', size: 4, kind: 'spark' });
    }
    if (!dead && b.from === 'player') {
      // Hit a police car?
      for (const car of S.cars) {
        if (car.kind !== 'police') continue;
        if (carHit(car, b.x, b.y, 4)) {
          dead = true;
          car.hp -= 34;
          S.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ff9a3c', size: 6, kind: 'spark' });
          if (car.hp <= 0) {
            explodeCar(S, car);
            raiseWanted(S, 1, 'Cop car destroyed');
          }
          break;
        }
      }
      // Hit an armed crew enemy (mission shootouts)?
      if (!dead && S.enemies) {
        for (const e of S.enemies) {
          if (Math.hypot(e.x - b.x, e.y - b.y) < 16) {
            dead = true;
            e.hp -= 34;
            S.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ff9a3c', size: 6, kind: 'spark' });
            if (e.hp <= 0) {
              S.enemies = S.enemies.filter((q) => q !== e);
              S.player.kills++;
              for (let k = 0; k < 8; k++) {
                S.particles.push({ x: e.x, y: e.y, vx: S.rng.range(-90, 90), vy: S.rng.range(-90, 90), life: 0.5, max: 0.5, color: '#c94a4a', size: 5, kind: 'smoke' });
              }
              if (S.missions) S.missions.onKill(S);
            }
            break;
          }
        }
      }
      // Hit a pedestrian? (counts as a crime, and the crowd notices)
      if (!dead) {
        for (const ped of S.peds) {
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
            dead = true;
            ped.state = 'gone';
            S.peds = S.peds.filter((q) => q !== ped);
            S.player.kills++;
            raiseWanted(S, 1, 'Pedestrian down');
            scarePeds(S, b.x, b.y, 500);
            break;
          }
        }
      }
    }
    if (!dead && (b.from === 'police' || b.from === 'enemy')) {
      const p = S.player;
      const hitR = p.onFoot ? 14 : 24;
      if (Math.hypot(p.x - b.x, p.y - b.y) < hitR) {
        dead = true;
        hurtPlayer(S, 12);
      }
    }
    if (dead) S.bullets.splice(i, 1);
  }
}

export function explodeCar(S, car) {
  car.kind = 'wreck';
  car.speed = 0;
  for (let i = 0; i < 26; i++) {
    const a = S.rng.range(0, Math.PI * 2);
    const sp = S.rng.range(40, 260);
    S.particles.push({ x: car.x, y: car.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: S.rng.range(0.4, 1.1), max: 1.1, color: S.rng.pick(['#ff6a2a', '#ffd23e', '#5a5a5a', '#ff3c2a']), size: S.rng.range(4, 10), kind: 'fire' });
  }
  S.shake = Math.max(S.shake, 12);
  S.audio.explosion();
  S.cars = S.cars.filter((c) => c !== car);
  if (S.player.car === car) {
    S.player.car = null;
    S.player.onFoot = true;
    hurtPlayer(S, 25);
  }
}

export function hurtPlayer(S, dmg) {
  const p = S.player;
  if (p.hurtT > 0) return;
  p.hurtT = 0.5;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, dmg);
    p.armor -= absorbed;
    dmg -= absorbed;
  }
  p.hp -= dmg;
  S.shake = Math.max(S.shake, 5);
  if (p.hp <= 0) {
    p.hp = 0;
    S.mode = 'wasted';
    S.modeT = 0;
  }
}

export function raiseWanted(S, n, why) {
  const before = S.wanted;
  S.wanted = Math.min(5, S.wanted + n);
  S.wantedTimer = 0;
  if (S.wanted > before) {
    S.message = { text: `WANTED ${S.wanted}★ — ${why}`, t: 2.5 };
    S.audio.sirenBurst();
  }
}

function spawnExhaust(S, car) {
  for (let i = 0; i < 10; i++) {
    S.particles.push({
      x: car.x - Math.cos(car.angle) * 24, y: car.y - Math.sin(car.angle) * 24,
      vx: -Math.cos(car.angle) * 80 + S.rng.range(-30, 30), vy: -Math.sin(car.angle) * 80 + S.rng.range(-30, 30),
      life: 0.5, max: 0.5, color: '#c8c8c8', size: 6, kind: 'smoke',
    });
  }
}

export function respawnPlayer(S) {
  const p = S.player;
  const h = S.city.hospital;
  p.x = h.x; p.y = h.y + 90;
  p.hp = TUNE.playerHp; p.armor = 50;
  p.onFoot = true; p.car = null;
  p.bustT = 0;
  S.wanted = 0; S.heat = 0;
  S.cash = Math.max(0, S.cash - 100);
  for (const car of S.cars) if (car.kind === 'police') car.hp = 0;
  S.cars = S.cars.filter((c) => c.kind !== 'police');
  if (S.heli) S.heli = null;
  S.mode = 'play';
}
