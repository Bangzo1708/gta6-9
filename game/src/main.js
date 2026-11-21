// SOLANO HEAT — boot, the fixed-step loop and every mode (title, play,
// paused, wasted, busted, complete). The state object S is the whole game;
// each system in src/ reads and writes it.
import { VARIANTS, CHAPTERS, RADIO, TUNE } from './config.js';
import { createRng, hashSeed } from './rng.js';
import { generateCity } from './city.js';
import { makeCar, spawnTrafficCar, spawnParkedCar, updateVehicles } from './vehicles.js';
import { makePed, updatePeds, updateFare, updatePackages, spawnFare, spawnPackage } from './peds.js';
import { makePlayer, updatePlayer, updateBullets, respawnPlayer } from './player.js';
import { updateWanted, inSearchlight } from './police.js';
import { makeMissions, updateEnemies } from './missions.js';
import { makeAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { makeInput, attachInput } from './input.js';
import { drawGame, drawTitle } from './render.js';
import { applyShot, shotSteps } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const STEP = 1 / 60;

function createGame(variantId) {
  const cfg = VARIANTS[variantId] || VARIANTS.solano;
  const rng = createRng(hashSeed(variantId));
  const city = generateCity(cfg, rng);
  const saveData = loadSave();
  const S = {
    variantId: cfg.id, cfg, rng, city,
    time: 0, clockMinutes: cfg.clockStart,
    player: makePlayer(city.spawn.x, city.spawn.y),
    cars: [], peds: [], enemies: [], bullets: [], particles: [], packages: [],
    heli: null, fare: null, fareCooldown: 12,
    wanted: 0, heat: 0, hideTimer: 0, wantedTimer: 0,
    cash: 0, chapter: 0, kills: 0,
    missions: makeMissions(),
    missionMarker: null, message: null,
    nextChapterOffer: null,
    camera: { x: city.spawn.x, y: city.spawn.y, zoom: 1 },
    shake: 0, mode: 'title', modeT: 0,
    menuIndex: 0, saveData,
    audio: makeAudio(),
    input: makeInput(),
    mouse: { sx: 640, sy: 360, wx: city.spawn.x, wy: city.spawn.y },
    saveDirty: false, saveTimer: 0,
    shotName: null, shotInput: null,
  };
  // Traffic, parked cars, pedestrians, street stashes.
  for (let i = 0; i < TUNE.trafficCount; i++) S.cars.push(spawnTrafficCar(city, rng));
  for (let i = 0; i < TUNE.parkedCount; i++) S.cars.push(spawnParkedCar(city, rng));
  for (let i = 0; i < TUNE.pedCount; i++) S.peds.push(makePed(city, rng));
  for (let i = 0; i < 3; i++) spawnPackage(S);
  // A sports car near the garage, for Chapter 2 and for joyriders.
  const comet = makeCar(city.spawn.x + 60, city.spawn.y, 0, { name: 'Comet GT', color: '#e33e3e', len: 46, wid: 22, top: 640, sport: true }, 'parked');
  S.cars.push(comet);
  // The radio starts on this city's station.
  S.audio.setStation(cfg.radio);
  return S;
}

let S = createGame(params.get('variant') || (loadSave() || {}).variant || 'solano');

// --- input wiring ------------------------------------------------------------

function firstGesture() {
  S.audio.ensure();
}

attachInput(S.input, canvas, firstGesture, (code, down) => {
  if (!down) return;
  if (code === 'Enter') onEnter();
  if (code === 'Escape') onEscape();
  if (code === 'KeyQ') S.audio.setStation(S.audio.station + 1);
  if (code === 'KeyM') S.audio.setMuted(!S.audio.muted);
  if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
    if (S.mode === 'title') switchVariant(['solano', 'neon', 'sunset'][Number(code.slice(-1)) - 1]);
    else S.audio.setStation(Number(code.slice(-1)) - 1);
  }
  if (S.mode === 'title') {
    if (code === 'ArrowUp') S.menuIndex = Math.max(0, S.menuIndex - 1);
    if (code === 'ArrowDown') S.menuIndex = Math.min(2, S.menuIndex + 1);
  }
});

canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  S.mouse.sx = ((e.clientX - r.left) / r.width) * 1280;
  S.mouse.sy = ((e.clientY - r.top) / r.height) * 720;
});

function switchVariant(id) {
  const keep = { cash: S.cash, chapter: S.chapter };
  S = createGame(id);
  S.cash = keep.cash;
  S.chapter = keep.chapter;
  attachInput(S.input, canvas, firstGesture, () => {});
}

function onEnter() {
  if (S.mode === 'title') {
    const save = S.saveData;
    const hasContinue = !!save;
    const idx = S.menuIndex;
    if (hasContinue && idx === 0) {
      S.cash = save.cash;
      S.chapter = save.chapter;
      S.mode = 'play';
      S.missions.startChapter(S, save.chapter);
    } else if ((!hasContinue && idx === 0) || (hasContinue && idx === 1)) {
      S.cash = 0;
      S.chapter = 0;
      S.mode = 'play';
      S.missions.startChapter(S, 0);
    } else {
      S.mode = 'play'; // free roam
    }
    S.audio.ensure();
    S.audio.setStation(S.cfg.radio);
  } else if (S.mode === 'play' && S.nextChapterOffer !== null && S.nextChapterOffer !== undefined) {
    S.missions.acceptNextChapter(S);
  } else if (S.mode === 'complete') {
    S.mode = 'play';
  } else if (S.mode === 'paused') {
    S.mode = 'play';
  }
}

function onEscape() {
  if (S.mode === 'play') S.mode = 'paused';
  else if (S.mode === 'paused') S.mode = 'play';
}

// --- the update ---------------------------------------------------------------

function updateParticles(S, dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
    if (p.life <= 0) S.particles.splice(i, 1);
  }
}

function update(dt) {
  S.time += dt;
  S.clockMinutes += dt / 60; // one game-minute a second
  S.shake = Math.max(0, S.shake - dt * 22);
  if (S.message) {
    S.message.t -= dt;
    if (S.message.t <= 0) S.message = null;
  }
  // Mouse in world coordinates, for aiming.
  S.mouse.wx = S.camera.x + (S.mouse.sx - 640) / S.camera.zoom;
  S.mouse.wy = S.camera.y + (S.mouse.sy - 360) / S.camera.zoom;

  if (S.mode === 'title') {
    // Slow cinematic pan over the city behind the title.
    if (!S.shotName) {
      S.camera.x = 1800 + Math.cos(S.time * 0.05) * 500;
      S.camera.y = 1800 + Math.sin(S.time * 0.04) * 400;
      S.camera.zoom = 0.8;
    }
    return;
  }
  if (S.mode === 'paused') return;

  if (S.mode === 'wasted' || S.mode === 'busted') {
    S.modeT += dt;
    updateParticles(S, dt);
    if (S.modeT > 2.6) respawnPlayer(S);
    return;
  }
  if (S.mode === 'complete') {
    updateParticles(S, dt);
    return;
  }

  // --- play ---
  if (S.shotInput) Object.assign(S.input, S.shotInput);
  updatePlayer(S, dt);
  updateVehicles(S, dt);
  updatePeds(S, dt);
  updateWanted(S, dt);
  updateBullets(S, dt);
  updateEnemies(S, dt);
  S.missions.update(S, dt);
  updateFare(S, dt);
  updatePackages(S, dt);
  updateParticles(S, dt);

  // The searchlight keeps the heat on: no cooling off inside its cone.
  if (inSearchlight(S)) S.hideTimer = 0;

  // A new fare appears when the streets are quiet.
  S.fareCooldown -= dt;
  if (!S.fare && S.fareCooldown <= 0 && S.wanted === 0) {
    spawnFare(S);
    S.fareCooldown = 45;
  }

  // Story end: after chapter 8 the city is Mara's.
  if (S.chapter >= 8 && !S.missions.active && S.mode === 'play' && !S.nextChapterOffer) {
    S.mode = 'complete';
    S.modeT = 0;
  }

  // Camera: follow Mara, pull back a little at speed.
  const targetZoom = S.player.car ? Math.max(0.8, 0.95 - Math.abs(S.player.car.speed) / 4000) : 1;
  S.camera.zoom += (targetZoom - S.camera.zoom) * Math.min(1, dt * 2);
  S.camera.x += (S.player.x - S.camera.x) * Math.min(1, dt * 5);
  S.camera.y += (S.player.y - S.camera.y) * Math.min(1, dt * 5);

  // Audio follows the action.
  S.audio.updateEngine(S.player.car ? Math.abs(S.player.car.speed) : 0, !!S.player.car);
  let copNear = false;
  for (const c of S.cars) {
    if (c.kind === 'police' && Math.hypot(c.x - S.player.x, c.y - S.player.y) < 600) { copNear = true; break; }
  }
  S.audio.updateSiren(copNear || !!S.heli);
  S.audio.radioTick();

  // Autosave.
  S.saveTimer += dt;
  if (S.saveDirty && S.saveTimer > 2) {
    writeSave(S);
    S.saveTimer = 0;
  }
}

// --- the loop -----------------------------------------------------------------

function render() {
  if (S.mode === 'title') drawTitle(ctx, S);
  else drawGame(ctx, S);
}

let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) {
    update(STEP);
    acc -= STEP;
    n++;
  }
  render();
  requestAnimationFrame(frame);
}

// --- deterministic shots -------------------------------------------------------

const shot = params.get('shot');
if (shot) {
  applyShot(S, shot);
  const steps = shotSteps(shot);
  for (let i = 0; i < steps; i++) update(STEP);
  render();
  document.title = 'SOLANO HEAT — shot ready';
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
