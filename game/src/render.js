// The renderer: the city, the cars, the people, the helicopter, the
// lighting and the whole HUD (wanted stars, minimap, mission box, radio).
// Everything draws on one 1280x720 canvas; the camera follows Mara.
import { WORLD, RADIO, CHAPTERS } from './config.js';

const VW = 1280, VH = 720;

// A tiny coordinate hash, so window patterns and details are stable.
function hash2(x, y) {
  let h = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 4294967296;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------- the world

function drawGround(ctx, S, view) {
  const cfg = S.cfg;
  ctx.fillStyle = cfg.ground;
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  // Mown stripes on the grass, for texture.
  ctx.fillStyle = cfg.groundAlt;
  const stripe = 160;
  for (let y = Math.floor(view.y0 / stripe) * stripe; y < view.y1; y += stripe * 2) {
    ctx.fillRect(view.x0, y, view.x1 - view.x0, stripe);
  }
  // Water + sand along the south edge (beach variants).
  if (S.city.landmarks.some((l) => l.kind === 'beach')) {
    ctx.fillStyle = cfg.waterDeep;
    ctx.fillRect(view.x0, 3120, view.x1 - view.x0, 80);
    ctx.fillStyle = cfg.water;
    ctx.fillRect(view.x0, 3080, view.x1 - view.x0, 40);
    ctx.fillStyle = cfg.sand;
    ctx.fillRect(view.x0, 3040, view.x1 - view.x0, 40);
    // Wave lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let x = Math.floor(view.x0 / 90) * 90; x < view.x1; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 3108 + Math.sin(x * 0.05) * 3);
      ctx.quadraticCurveTo(x + 22, 3104, x + 45, 3108);
      ctx.stroke();
    }
  }
}

function drawRoads(ctx, S, view) {
  const cfg = S.cfg;
  const half = S.city.roadW / 2;
  for (const r of S.city.roads) {
    ctx.fillStyle = cfg.road;
    ctx.fillRect(view.x0, r - half, view.x1 - view.x0, S.city.roadW);
    ctx.fillRect(r - half, view.y0, S.city.roadW, view.y1 - view.y0);
  }
  // Sidewalks.
  ctx.fillStyle = cfg.sidewalk;
  for (const r of S.city.roads) {
    ctx.fillRect(view.x0, r - half - 12, view.x1 - view.x0, 12);
    ctx.fillRect(view.x0, r + half, view.x1 - view.x0, 12);
    ctx.fillRect(r - half - 12, view.y0, 12, view.y1 - view.y0);
    ctx.fillRect(r + half, view.y0, 12, view.y1 - view.y0);
  }
  // Centre dashes.
  ctx.fillStyle = cfg.roadLine;
  for (const r of S.city.roads) {
    for (let x = Math.floor(view.x0 / 70) * 70; x < view.x1; x += 70) {
      ctx.fillRect(x, r - 2, 34, 4);
      ctx.fillRect(r - 2, x, 4, 34);
    }
  }
  // Intersections read as asphalt, not sidewalk crosses.
  ctx.fillStyle = cfg.road;
  for (const rx of S.city.roads) for (const ry of S.city.roads) {
    ctx.fillRect(rx - half - 12, ry - half - 12, S.city.roadW + 24, S.city.roadW + 24);
  }
}

function drawParks(ctx, S, view) {
  for (const p of S.city.parks) {
    if (p.x > view.x1 || p.x + p.w < view.x0 || p.y > view.y1 || p.y + p.h < view.y0) continue;
    ctx.fillStyle = S.cfg.night ? '#1d3a24' : '#5da24a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(p.x, p.y + p.h / 2 - 6, p.w, 12);
    ctx.fillRect(p.x + p.w / 2 - 6, p.y, 12, p.h);
    for (const t of p.trees) drawTree(ctx, t.x, t.y, t.r, S.cfg.night);
  }
}

function drawTree(ctx, x, y, r, night) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x + 4, y + 5, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = night ? '#2a5a2e' : '#3f8f3a';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = night ? '#357a38' : '#57ab4e';
  ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.6, 0, Math.PI * 2); ctx.fill();
}

function drawPalm(ctx, x, y, night) {
  ctx.strokeStyle = '#6a4a2a';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y - 18, x + 10, y - 26); ctx.stroke();
  ctx.strokeStyle = night ? '#2a6a30' : '#3f9e4a';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const a = -0.4 - i * 0.55;
    ctx.beginPath(); ctx.moveTo(x + 10, y - 26);
    ctx.quadraticCurveTo(x + 10 + Math.cos(a) * 14, y - 26 + Math.sin(a) * 10, x + 10 + Math.cos(a) * 24, y - 26 + Math.sin(a) * 16);
    ctx.stroke();
  }
}

function drawBuildings(ctx, S, view) {
  const cfg = S.cfg;
  const shx = cfg.night ? 0 : Math.cos(cfg.sunAngle) * 0.9;
  const shy = cfg.night ? 0 : Math.sin(cfg.sunAngle) * 0.9;
  for (const b of S.city.buildings) {
    if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
    // Long soft shadow in the sun's direction.
    if (!cfg.night) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + shx * b.h * 0.55, b.y + shy * b.h * 0.55, b.w, b.h);
    }
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof rim.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
    // Rooftop detail: AC units and skylights, stable per building.
    const h1 = hash2(b.x, b.y);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    const ux = b.x + 8 + h1 * (b.w - 30);
    const uy = b.y + 8 + hash2(b.y, b.x) * (b.h - 30);
    ctx.fillRect(ux, uy, 14, 10);
    ctx.fillStyle = cfg.glass;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.25, b.h * 0.25);
    ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, b.w * 0.2, b.h * 0.2);
    ctx.globalAlpha = 1;
    // Lit windows at night.
    if (cfg.night) {
      ctx.fillStyle = '#ffd76a';
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (hash2(b.x + i * 31, b.y + j * 47) > 0.45) {
          ctx.fillRect(b.x + 8 + i * ((b.w - 16) / cols), b.y + 8 + j * ((b.h - 16) / rows), 9, 11);
        }
      }
    }
  }
}

function drawLandmarks(ctx, S, view) {
  const cfg = S.cfg;
  for (const l of S.city.landmarks) {
    if (l.x > view.x1 || l.x + l.w < view.x0 || l.y > view.y1 || l.y + l.h < view.y0) continue;
    if (l.kind === 'pier') {
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(l.x + 20, l.y - 90, 120, 260);
      ctx.fillStyle = '#6a4a2a';
      for (let y = l.y - 80; y < l.y + 160; y += 26) ctx.fillRect(l.x + 20, y, 120, 4);
      ctx.fillStyle = '#e8e4d8';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SOLANO PIER', l.x + 80, l.y + 130);
      // Ferris wheel at the pier head.
      ctx.strokeStyle = '#f2f2f2';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(l.x + 80, l.y - 130, 52, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ff4f6a';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        ctx.beginPath(); ctx.arc(l.x + 80 + Math.cos(a) * 52, l.y - 130 + Math.sin(a) * 52, 7, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (l.kind === 'marina') {
      ctx.fillStyle = cfg.water;
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = '#e8e4d8';
      for (let i = 0; i < 5; i++) {
        const bx = l.x + 30 + i * 70;
        ctx.fillRect(bx, l.y + 40, 44, 16);
        ctx.beginPath(); ctx.moveTo(bx + 22, l.y + 40); ctx.lineTo(bx + 22, l.y + 8); ctx.stroke();
      }
    }
    if (l.kind === 'stadium') {
      ctx.fillStyle = '#d8d8d8';
      ctx.beginPath(); ctx.ellipse(l.x + l.w / 2, l.y + l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f9e4a';
      ctx.beginPath(); ctx.ellipse(l.x + l.w / 2, l.y + l.h / 2, l.w / 2 - 34, l.h / 2 - 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f2f2f2';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(l.x + l.w / 2, l.y + l.h / 2, l.w / 2 - 34, l.h / 2 - 34, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#20242e';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SOLANO DOME', l.x + l.w / 2, l.y + l.h / 2 + 8);
    }
    if (l.kind === 'plaza') {
      ctx.fillStyle = '#c8b898';
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = '#e8e4d8';
      ctx.beginPath(); ctx.arc(l.x + l.w / 2, l.y + l.h / 2, 60, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a90d9';
      ctx.beginPath(); ctx.arc(l.x + l.w / 2, l.y + l.h / 2, 44, 0, Math.PI * 2); ctx.fill();
    }
    if (l.kind === 'towers') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(l.x + 20, l.y + 30, 280, 260);
      ctx.fillStyle = '#2c3550';
      ctx.fillRect(l.x, l.y, 130, 280);
      ctx.fillStyle = '#3a2c50';
      ctx.fillRect(l.x + 170, l.y + 20, 130, 260);
      ctx.fillStyle = '#ffd76a';
      for (let i = 0; i < 5; i++) for (let j = 0; j < 12; j++) {
        if (hash2(l.x + i, l.y + j) > 0.4) ctx.fillRect(l.x + 14 + i * 24, l.y + 14 + j * 22, 12, 12);
      }
    }
    if (l.kind === 'park') {
      ctx.fillStyle = S.cfg.night ? '#1d3a24' : '#5da24a';
      ctx.fillRect(l.x, l.y, l.w, l.h);
      for (let i = 0; i < 10; i++) {
        drawTree(ctx, l.x + 30 + hash2(i, 7) * (l.w - 60), l.y + 30 + hash2(i, 13) * (l.h - 60), 18, S.cfg.night);
      }
      ctx.fillStyle = '#c8b898';
      ctx.beginPath(); ctx.arc(l.x + l.w / 2, l.y + l.h / 2, 40, 0, Math.PI * 2); ctx.fill();
    }
    if (l.kind === 'port') {
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = cfg.water;
      ctx.fillRect(l.x, l.y + l.h - 40, l.w, 40);
    }
  }
  // Cranes + containers (sunset harbor).
  for (const c of S.city.cranes) {
    ctx.strokeStyle = '#e8a33c';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(c.x, c.y + 130); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x + 150, c.y + 14); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(c.x + 150, c.y + 14); ctx.lineTo(c.x + 150, c.y + 60); ctx.stroke();
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(c.x + 138, c.y + 58, 24, 20);
  }
  for (const c of S.city.containers) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, 110, 44);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 1, c.y + 1, 108, 42);
  }
  // Neon signs.
  for (const s of S.city.signs) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (S.cfg.neon) {
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, 0, 0);
      ctx.shadowBlur = 6;
      ctx.fillText(s.text, 0, 0);
    } else {
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, 0, 0);
    }
    ctx.restore();
  }
  // Street lamps.
  for (const lamp of S.city.lamps) {
    if (lamp.x < view.x0 || lamp.x > view.x1 || lamp.y < view.y0 || lamp.y > view.y1) continue;
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    if (S.cfg.lampGlow) {
      ctx.fillStyle = 'rgba(255,214,106,0.9)';
      ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Palms.
  for (const p of S.city.palms) {
    if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
    drawPalm(ctx, p.x, p.y, S.cfg.night);
  }
}

// ---------------------------------------------------------------- entities

function drawCar(ctx, car, S) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid, 7);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 7);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,28,38,0.9)';
  roundRect(ctx, -car.len * 0.18, -car.wid / 2 + 3, car.len * 0.36, car.wid - 6, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,235,0.85)';
  ctx.fillRect(car.len * 0.16, -car.wid / 2 + 4, 5, car.wid - 8);
  // Wheels.
  ctx.fillStyle = '#14161a';
  for (const [wx, wy] of [[-14, -car.wid / 2 - 1], [14, -car.wid / 2 - 1], [-14, car.wid / 2 - 3], [14, car.wid / 2 - 3]]) {
    ctx.fillRect(wx, wy, 10, 5);
  }
  if (car.kind === 'police') {
    // White doors + flashing light bar.
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-6, -car.wid / 2, 12, car.wid);
    const flash = Math.floor(S.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
    ctx.fillRect(-4, -car.wid / 2 - 3, 8, 6);
    ctx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
    ctx.fillRect(-4, car.wid / 2 - 3, 8, 6);
    ctx.fillStyle = '#20242e';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, -car.wid / 2 + 9);
  }
  if (car.model && car.model.name === 'Taxi Cab') {
    ctx.fillStyle = '#20242e';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.kind === 'player') {
    // Player car: a bright outline so it reads at a glance.
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 2;
    roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 7);
    ctx.stroke();
  }
  // Headlight beams at night.
  if (S.cfg.night && car.speed > 5) {
    ctx.fillStyle = 'rgba(255,240,180,0.14)';
    ctx.beginPath();
    ctx.moveTo(car.len / 2, -8);
    ctx.lineTo(car.len / 2 + 130, -34);
    ctx.lineTo(car.len / 2 + 130, 34);
    ctx.lineTo(car.len / 2, 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, p, S) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  const bob = Math.sin(p.walkPhase) * 1.5;
  ctx.rotate(p.angle);
  // Legs + body.
  ctx.fillStyle = p.pants;
  ctx.fillRect(-4, -5 + bob, 8, 10);
  ctx.fillStyle = p.shirt;
  roundRect(ctx, -6, -6, 12, 13, 4);
  ctx.fill();
  // Head.
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(8, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (p.fare) {
    // A taxi fare waves a yellow $.
    ctx.save();
    ctx.translate(p.x, p.y - 26 + Math.sin(S.time * 4) * 3);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 4.5);
    ctx.restore();
  }
}

function drawEnemy(ctx, e, S) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(2, 4, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(e.angle);
  ctx.fillStyle = '#20242e';
  ctx.fillRect(-4, -5, 8, 10);
  ctx.fillStyle = e.shirt;
  roundRect(ctx, -6, -6, 12, 13, 4);
  ctx.fill();
  ctx.fillStyle = e.bandana;
  ctx.fillRect(4, -5, 4, 10);
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath(); ctx.arc(8, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  // Gun.
  ctx.strokeStyle = '#14161a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(24, 0); ctx.stroke();
  ctx.restore();
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
  ctx.fillStyle = '#e33e3e';
  ctx.fillRect(e.x - 14, e.y - 22, 28 * Math.max(0, e.hp / 60), 4);
}

function drawPlayerFigure(ctx, p, S) {
  const bob = p.onFoot ? Math.sin(p.walkPhase) * 2 : 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 5, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.aim);
  // Mara: red jacket, dark jeans.
  ctx.fillStyle = '#24344d';
  ctx.fillRect(-5, -6 + bob, 10, 12);
  ctx.fillStyle = '#e33e3e';
  roundRect(ctx, -7, -7, 14, 15, 5);
  ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath(); ctx.arc(9, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20242e';
  ctx.beginPath(); ctx.arc(9, -2, 6, Math.PI, Math.PI * 2); ctx.fill();
  // Pistol.
  ctx.strokeStyle = '#14161a';
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(12, 2); ctx.lineTo(26, 2); ctx.stroke();
  ctx.restore();
  // Direction ring so the player is findable in a crowd.
  ctx.strokeStyle = 'rgba(255,225,77,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.stroke();
}

function drawBullets(ctx, S) {
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = 3;
  for (const b of S.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, S) {
  for (const pt of S.particles) {
    const a = Math.max(0, pt.life / pt.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (pt.kind === 'smoke' ? (1.6 - a * 0.6) : 1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHeli(ctx, S) {
  const h = S.heli;
  if (!h) return;
  // Shadow on the ground + the searchlight cone.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(h.x, h.y, 34, 16, 0, 0, Math.PI * 2); ctx.fill();
  const grad = ctx.createRadialGradient(h.lightX, h.lightY, 10, h.lightX, h.lightY, 130);
  grad.addColorStop(0, 'rgba(255,240,170,0.34)');
  grad.addColorStop(1, 'rgba(255,240,170,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(h.lightX, h.lightY, 130, 0, Math.PI * 2); ctx.fill();
  // Body, drawn above the ground by its altitude.
  const by = h.y - h.alt * 0.55;
  ctx.save();
  ctx.translate(h.x, by);
  ctx.rotate(h.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(3, 5, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20242e';
  roundRect(ctx, -26, -11, 44, 22, 9);
  ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(-26, -11, 14, 22);
  ctx.fillStyle = '#9fd8ef';
  ctx.beginPath(); ctx.arc(12, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20242e';
  ctx.fillRect(-44, -3, 20, 6);
  ctx.restore();
  // Rotor blur.
  ctx.save();
  ctx.translate(h.x, by);
  ctx.rotate(h.rotor);
  ctx.strokeStyle = 'rgba(20,22,26,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-46, 0); ctx.lineTo(46, 0); ctx.stroke();
  ctx.rotate(Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(-46, 0); ctx.lineTo(46, 0); ctx.stroke();
  ctx.restore();
  // "PD" on the belly.
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PD', h.x, by + 4);
}

function drawMarker(ctx, S) {
  const m = S.missionMarker;
  if (!m) return;
  const pulse = 1 + Math.sin(S.time * 5) * 0.15;
  // Beacon pillar.
  const grad = ctx.createLinearGradient(m.x, m.y - 260, m.x, m.y);
  grad.addColorStop(0, 'rgba(255,225,77,0)');
  grad.addColorStop(1, 'rgba(255,225,77,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(m.x - 8, m.y - 260, 16, 260);
  // Pulsing ring on the ground.
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(m.x, m.y, 46 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath(); ctx.arc(m.x, m.y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#20242e';
  const w = ctx.measureText(m.label).width + 18;
  ctx.fillStyle = 'rgba(255,225,77,0.92)';
  roundRect(ctx, m.x - w / 2, m.y - 92, w, 26, 6);
  ctx.fill();
  ctx.fillStyle = '#20242e';
  ctx.fillText(m.label, m.x, m.y - 74);
}

function drawPackages(ctx, S) {
  for (const pk of S.packages) {
    const bob = Math.sin(pk.t * 4) * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(pk.x, pk.y + 12, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a5a2a';
    ctx.fillRect(pk.x - 12, pk.y - 10 + bob, 24, 20);
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 2;
    ctx.strokeRect(pk.x - 12, pk.y - 10 + bob, 24, 20);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', pk.x, pk.y + 4 + bob);
  }
}

// ---------------------------------------------------------------- lighting

function drawLighting(ctx, S) {
  const cfg = S.cfg;
  if (cfg.light) {
    if (cfg.night) {
      // Night: darkness as a radial gradient centred on Mara, so the
      // street around her stays readable and the city falls off into dark.
      const px = (S.player.x - S.camera.x) * S.camera.zoom + VW / 2;
      const py = (S.player.y - S.camera.y) * S.camera.zoom + VH / 2;
      const g = ctx.createRadialGradient(px, py, 180, px, py, 620);
      g.addColorStop(0, 'rgba(4,6,18,0.08)');
      g.addColorStop(0.55, 'rgba(4,6,18,0.42)');
      g.addColorStop(1, 'rgba(4,6,18,0.66)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);
      // Warm lamp halos.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const lamp of S.city.lamps) {
        const sx = (lamp.x - S.camera.x) * S.camera.zoom + VW / 2;
        const sy = (lamp.y - S.camera.y) * S.camera.zoom + VH / 2;
        if (sx < -60 || sx > VW + 60 || sy < -60 || sy > VH + 60) continue;
        const lg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 60);
        lg.addColorStop(0, 'rgba(255,214,106,0.20)');
        lg.addColorStop(1, 'rgba(255,214,106,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(sx - 60, sy - 60, 120, 120);
      }
      ctx.restore();
    } else {
      // Sunset: a flat warm dusk tint.
      ctx.fillStyle = cfg.light;
      ctx.fillRect(0, 0, VW, VH);
    }
  }
  // Hurt flash.
  if (S.player.hurtT > 0.25) {
    ctx.fillStyle = `rgba(227,62,62,${(S.player.hurtT - 0.25) * 0.5})`;
    ctx.fillRect(0, 0, VW, VH);
  }
  // Wanted flash at 4+ stars.
  if (S.wanted >= 4 && Math.floor(S.time * 2) % 2 === 0) {
    ctx.strokeStyle = 'rgba(227,62,62,0.5)';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, VW - 10, VH - 10);
  }
}

// ---------------------------------------------------------------- the HUD

function drawStars(ctx, S) {
  const x0 = VW - 30;
  const y0 = 34;
  for (let i = 0; i < 5; i++) {
    const cx = x0 - i * 34;
    starPath(ctx, cx, y0, 14);
    if (i < S.wanted) {
      ctx.fillStyle = S.wanted >= 4 && Math.floor(S.time * 4) % 2 === 0 ? '#ff5a3c' : '#ffd23e';
      ctx.fill();
      ctx.strokeStyle = '#7a5a00';
    } else {
      ctx.fillStyle = 'rgba(20,24,32,0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    }
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.textAlign = 'right';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(S.wanted === 0 ? 'CLEAN' : 'WANTED', x0 + 14, y0 + 30);
}

function drawHud(ctx, S) {
  ctx.textAlign = 'left';
  // Mission objective box, top-left.
  const obj = S.missions ? S.missions.currentText(S) : null;
  const chapter = S.missions && S.missions.active ? S.missions.active.chapter : null;
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, 16, 14, 340, obj ? 74 : 44, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(chapter ? `CH ${S.missions.active.chapterIdx + 1} — ${chapter.title.toUpperCase()}` : 'FREE ROAM — PORT SOLANO', 28, 36);
  if (obj) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(obj.length > 46 ? obj.slice(0, 46) + '…' : obj, 28, 60);
    ctx.fillStyle = '#9fd8ef';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(S.missions.active.chapter.giver === 'Mara Voss' ? 'Mara Voss' : `from ${S.missions.active.chapter.giver}`, 28, 78);
  }
  // Cash + clock, top-right under the stars.
  drawStars(ctx, S);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7dff5e';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`$${S.cash.toLocaleString('en-US')}`, VW - 18, 96);
  const hh = Math.floor(S.clockMinutes / 60) % 24;
  const mm = Math.floor(S.clockMinutes % 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, VW - 18, 120);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(S.cfg.name, VW - 18, 138);

  // Health + armor bars above the minimap.
  const bx = 16, by = VH - 232;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, bx, by - 6, 190, 52, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('MARA VOSS', bx + 10, by + 10);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(bx + 10, by + 16, 170, 8);
  ctx.fillStyle = S.player.hp > 30 ? '#7dff5e' : '#ff5a3c';
  ctx.fillRect(bx + 10, by + 16, 170 * Math.max(0, S.player.hp / 100), 8);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(bx + 10, by + 28, 170, 6);
  ctx.fillStyle = '#4a90d9';
  ctx.fillRect(bx + 10, by + 28, 170 * Math.max(0, S.player.armor / 100), 6);

  // Speed + radio, bottom-right.
  ctx.textAlign = 'right';
  if (S.player.car) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`${Math.round(Math.abs(S.player.car.speed) * 0.24)}`, VW - 18, VH - 84);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('KM/H  •  ' + S.player.car.model.name.toUpperCase(), VW - 18, VH - 64);
  }
  const st = RADIO[S.audio.station];
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, VW - 218, VH - 52, 200, 34, 8);
  ctx.fill();
  ctx.fillStyle = '#ff8ad8';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`♪ ${st.name} — ${st.genre}`, VW - 28, VH - 30);

  // Toast message.
  if (S.message && S.message.t > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px system-ui, sans-serif';
    const w = ctx.measureText(S.message.text).width + 28;
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    roundRect(ctx, VW / 2 - w / 2, 96, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(S.message.text, VW / 2, 118);
  }
  // Dialogue subtitles, bottom-centre.
  if (S.missions && S.missions.dialogue) {
    const d = S.missions.dialogue;
    const line = d.lines[d.i];
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px system-ui, sans-serif';
    const w = Math.min(760, ctx.measureText(line).width + 30);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, VW / 2 - w / 2, VH - 118, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, VW / 2, VH - 95);
  }
  // Chapter banner.
  if (S.missions && S.missions.banner) {
    const b = S.missions.banner;
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, b.t);
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(b.title, VW / 2, VH / 2 - 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(b.sub, VW / 2, VH / 2 - 8);
    ctx.globalAlpha = 1;
  }
  // Next-chapter offer.
  if (S.nextChapterOffer !== null && S.nextChapterOffer !== undefined) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    roundRect(ctx, VW / 2 - 210, VH - 168, 420, 36, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(`Press ENTER for Chapter ${S.nextChapterOffer + 1}: ${CHAPTERS[S.nextChapterOffer].title}`, VW / 2, VH - 145);
  }
  // Busted / wasted overlays are drawn by main.js (they need the mode timer).
  drawMinimap(ctx, S);
}

function drawMinimap(ctx, S) {
  const size = 170, mx = 16, my = VH - size - 16;
  const k = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,18,0.82)';
  roundRect(ctx, mx - 4, my - 4, size + 8, size + 8, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(mx, my, size, size);
  ctx.clip();
  // Water + ground.
  ctx.fillStyle = S.cfg.night ? '#10182a' : '#5a7a4a';
  ctx.fillRect(mx, my, size, size);
  if (S.city.landmarks.some((l) => l.kind === 'beach')) {
    ctx.fillStyle = S.cfg.water;
    ctx.fillRect(mx, my + 3040 * k, size, 160 * k);
  }
  // Roads.
  ctx.strokeStyle = S.cfg.night ? '#4a5468' : '#d8d8d8';
  ctx.lineWidth = 2;
  for (const r of S.city.roads) {
    ctx.beginPath(); ctx.moveTo(mx, my + r * k); ctx.lineTo(mx + size, my + r * k); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx + r * k, my); ctx.lineTo(mx + r * k, my + size); ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = S.cfg.night ? '#3a4157' : '#8a8a7a';
  for (const b of S.city.buildings) ctx.fillRect(mx + b.x * k, my + b.y * k, Math.max(1.5, b.w * k), Math.max(1.5, b.h * k));
  // Mission marker.
  if (S.missionMarker) {
    const pulse = 1 + Math.sin(S.time * 5) * 0.25;
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.arc(mx + S.missionMarker.x * k, my + S.missionMarker.y * k, 6 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#20242e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police + heli.
  ctx.fillStyle = '#ff3c2a';
  for (const car of S.cars) {
    if (car.kind !== 'police') continue;
    ctx.beginPath(); ctx.arc(mx + car.x * k, my + car.y * k, 3, 0, Math.PI * 2); ctx.fill();
  }
  if (S.heli) {
    ctx.strokeStyle = '#ff3c2a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx + S.heli.x * k, my + S.heli.y * k, 5, 0, Math.PI * 2); ctx.stroke();
  }
  // Player arrow.
  const px = mx + S.player.x * k, py = my + S.player.y * k;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(S.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#20242e';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  // Viewport frame.
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  roundRect(ctx, mx - 4, my - 4, size + 8, size + 8, 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PORT SOLANO', mx + 2, my - 10);
}

// ---------------------------------------------------------------- frames

export function drawWorldFrame(ctx, S) {
  const cam = S.camera;
  const zoom = cam.zoom;
  const view = {
    x0: cam.x - VW / 2 / zoom - 80, x1: cam.x + VW / 2 / zoom + 80,
    y0: cam.y - VH / 2 / zoom - 80, y1: cam.y + VH / 2 / zoom + 80,
  };
  ctx.save();
  ctx.clearRect(0, 0, VW, VH);
  ctx.fillStyle = S.cfg.sky;
  ctx.fillRect(0, 0, VW, VH);
  const sx = (S.shake ? (hash2(Math.floor(S.time * 60), 1) - 0.5) * S.shake : 0);
  const sy = (S.shake ? (hash2(Math.floor(S.time * 60), 2) - 0.5) * S.shake : 0);
  ctx.translate(VW / 2 + sx, VH / 2 + sy);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);
  drawGround(ctx, S, view);
  drawRoads(ctx, S, view);
  drawParks(ctx, S, view);
  drawLandmarks(ctx, S, view);
  drawBuildings(ctx, S, view);
  drawPackages(ctx, S);
  drawMarker(ctx, S);
  // Cars sorted so wrecks and parked cars sit under moving ones.
  for (const car of S.cars) if (car.kind === 'parked') drawCar(ctx, car, S);
  for (const car of S.cars) if (car.kind !== 'parked') drawCar(ctx, car, S);
  for (const p of S.peds) if (p.state !== 'gone') drawPed(ctx, p, S);
  for (const e of (S.enemies || [])) drawEnemy(ctx, e, S);
  if (S.player.onFoot) drawPlayerFigure(ctx, S.player, S);
  drawHeli(ctx, S);
  drawBullets(ctx, S);
  drawParticles(ctx, S);
  ctx.restore();
  drawLighting(ctx, S);
}

export function drawGame(ctx, S) {
  drawWorldFrame(ctx, S);
  if (S.mode === 'play' || S.mode === 'paused') drawHud(ctx, S);
  if (S.mode === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', VW / 2, VH / 2 - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('ESC resume  •  ENTER new chapter  •  Q radio  •  M mute', VW / 2, VH / 2 + 20);
  }
  if (S.mode === 'wasted' || S.mode === 'busted') {
    ctx.fillStyle = S.mode === 'wasted' ? 'rgba(120,0,0,0.45)' : 'rgba(0,20,80,0.45)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(S.mode === 'wasted' ? 'WASTED' : 'BUSTED', VW / 2, VH / 2 - 10);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(S.mode === 'wasted' ? 'Mara is patched up at St. Marina. -$100.' : 'Captain Reyes has you. -$100, and the heat is gone.', VW / 2, VH / 2 + 30);
  }
  if (S.mode === 'complete') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('SOLANO RISING', VW / 2, VH / 2 - 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('All eight chapters complete. Port Solano is yours — free roam continues.', VW / 2, VH / 2 + 10);
    ctx.fillText('Press ENTER to keep playing.', VW / 2, VH / 2 + 40);
  }
}

// ---------------------------------------------------------------- the title

export function drawTitle(ctx, S) {
  drawWorldFrame(ctx, S);
  ctx.fillStyle = 'rgba(6,10,18,0.62)';
  ctx.fillRect(0, 0, VW, VH);
  // Top strip: the city name.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('WELCOME TO PORT SOLANO', VW / 2, 96);
  // The title.
  ctx.save();
  ctx.shadowColor = '#ff4f6a';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 108px system-ui, sans-serif';
  ctx.fillText('SOLANO', VW / 2, 218);
  ctx.shadowColor = '#33e0ff';
  ctx.fillStyle = '#ffe14d';
  ctx.fillText('HEAT', VW / 2, 322);
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 19px system-ui, sans-serif';
  ctx.fillText('One last job. One family. One captain who never lets go.', VW / 2, 362);
  // Menu.
  const save = S.saveData;
  const items = [];
  if (save) items.push(`CONTINUE — Chapter ${save.chapter + 1}: ${CHAPTERS[save.chapter].title}  ($${save.cash})`);
  items.push('NEW GAME — Chapter 1: The Last Job');
  items.push('FREE ROAM — Explore Port Solano');
  ctx.font = 'bold 19px system-ui, sans-serif';
  items.forEach((it, i) => {
    const y = 424 + i * 36;
    const selected = i === S.menuIndex;
    if (selected) {
      ctx.fillStyle = 'rgba(255,225,77,0.92)';
      const w = ctx.measureText(it).width + 30;
      roundRect(ctx, VW / 2 - w / 2, y - 24, w, 32, 6);
      ctx.fill();
      ctx.fillStyle = '#20242e';
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillText(it, VW / 2, y);
  });
  // Controls + credits.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD drive / walk  •  E steal & enter cars  •  Mouse aim, Click shoot  •  SHIFT boost  •  Q radio  •  M mute  •  ESC pause', VW / 2, 596);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('8 chapters  •  Wanted system with police helicopter  •  Taxi fares & stashes  •  Progress saves automatically', VW / 2, 622);
  ctx.fillText('An original fan-made tribute. Not affiliated with Rockstar Games.  •  Press ENTER to start', VW / 2, 648);
  // Variant tag.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9fd8ef';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`${S.cfg.name} — ${S.cfg.tag}  (1/2/3 switch city)`, VW - 20, VH - 18);
}
