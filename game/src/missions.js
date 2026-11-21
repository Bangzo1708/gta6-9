// The story engine: eight chapters for Mara Voss, each a chain of steps
// (drive there, steal that, survive this), with dialogue, cash rewards
// and a save after every chapter.
import { CHAPTERS, PLACES } from './config.js';
import { raiseWanted } from './player.js';

function resolveSteps(chapter) {
  return chapter.steps.map((s) => {
    const step = { ...s, done: false, t: 0, progress: 0 };
    if (s.place && PLACES[s.place]) {
      step.x = PLACES[s.place].x;
      step.y = PLACES[s.place].y;
      step.label = PLACES[s.place].label;
    }
    return step;
  });
}

export function makeMissions() {
  return {
    active: null, // { chapterIdx, chapter, steps, step }
    banner: null, // { title, sub, t }
    dialogue: null, // { lines, i, t }

    startChapter(S, idx) {
      const chapter = CHAPTERS[idx];
      if (!chapter) return false;
      this.active = { chapterIdx: idx, chapter, steps: resolveSteps(chapter), step: 0 };
      this.dialogue = { lines: chapter.intro.slice(), i: 0, t: 0 };
      S.chapter = idx;
      S.missionMarker = this.markerOf(S);
      S.audio.blip(660, 0.15);
      return true;
    },

    markerOf(S) {
      const m = this.active;
      if (!m) return null;
      const step = m.steps[m.step];
      if (!step || step.x === undefined) return null;
      return { x: step.x, y: step.y, label: step.text, color: '#ffe14d' };
    },

    currentText(S) {
      const m = this.active;
      if (!m) return null;
      const step = m.steps[m.step];
      if (!step) return null;
      if (step.type === 'shoot') return step.text.replace(/\(\d+\/\d+\)/, `(${step.progress}/${step.count})`);
      return step.text;
    },

    onEnterCar(S, car) {
      const m = this.active;
      if (!m) return;
      const step = m.steps[m.step];
      if (step && step.type === 'steal' && car.model.sport) this.completeStep(S);
    },

    onExitCar(S) { /* stepping out never completes a step on its own */ },

    onKill(S) {
      const m = this.active;
      if (!m) return;
      const step = m.steps[m.step];
      if (step && step.type === 'shoot') {
        step.progress++;
        if (step.progress >= step.count) this.completeStep(S);
      }
    },

    completeStep(S) {
      const m = this.active;
      if (!m) return;
      const step = m.steps[m.step];
      step.done = true;
      S.audio.blip(990, 0.2);
      m.step++;
      if (m.step >= m.steps.length) this.completeChapter(S);
      else S.missionMarker = this.markerOf(S);
    },

    completeChapter(S) {
      const m = this.active;
      const reward = m.chapter.reward;
      S.cash += reward;
      this.banner = { title: `CHAPTER ${m.chapterIdx + 1} COMPLETE`, sub: `${m.chapter.title}  •  +$${reward}`, t: 4 };
      S.message = { text: `Chapter complete! +$${reward}`, t: 3 };
      S.audio.fanfare();
      this.active = null;
      S.missionMarker = null;
      S.chapter = Math.min(m.chapterIdx + 1, CHAPTERS.length - 1);
      S.saveDirty = true;
      // The next chapter starts when the player drives to the next marker:
      // offer it on the title-style prompt instead of forcing it.
      S.nextChapterOffer = m.chapterIdx + 1 < CHAPTERS.length ? m.chapterIdx + 1 : null;
    },

    acceptNextChapter(S) {
      if (S.nextChapterOffer === null || S.nextChapterOffer === undefined) return;
      const idx = S.nextChapterOffer;
      S.nextChapterOffer = null;
      this.startChapter(S, idx);
    },

    update(S, dt) {
      // Dialogue lines advance on their own timer.
      if (this.dialogue) {
        this.dialogue.t += dt;
        if (this.dialogue.t > 4.2) {
          this.dialogue.t = 0;
          this.dialogue.i++;
          if (this.dialogue.i >= this.dialogue.lines.length) this.dialogue = null;
        }
      }
      if (this.banner) {
        this.banner.t -= dt;
        if (this.banner.t <= 0) this.banner = null;
      }
      const m = this.active;
      if (!m) return;
      const step = m.steps[m.step];
      if (!step) return;
      const p = S.player;
      const dist = step.x !== undefined ? Math.hypot(p.x - step.x, p.y - step.y) : Infinity;

      switch (step.type) {
        case 'goto':
        case 'meet':
        case 'deliver':
          if (dist < 110) this.completeStep(S);
          break;
        case 'escape':
          if (S.wanted === 0) this.completeStep(S);
          break;
        case 'survive':
          step.t += dt;
          if (S.wanted < 4 && m.chapterIdx === 5) raiseWanted(S, 1, 'Reyes is closing in');
          if (step.t >= step.seconds) this.completeStep(S);
          break;
        case 'shoot':
          // Progress comes from onKill; the crew spawns once when the step starts.
          if (!step.spawned) {
            step.spawned = true;
            spawnCrew(S, step);
          }
          break;
        case 'steal':
          // Completed by onEnterCar with a sports car.
          break;
        default:
          break;
      }
    },
  };
}

// --- the crew: armed enemies for the shootout chapters ----------------------

function spawnCrew(S, step) {
  const cx = step.x !== undefined ? step.x : S.player.x;
  const cy = step.y !== undefined ? step.y : S.player.y;
  S.enemies = S.enemies || [];
  for (let i = 0; i < step.count; i++) {
    const a = (i / step.count) * Math.PI * 2;
    S.enemies.push({
      x: cx + Math.cos(a) * 220, y: cy + Math.sin(a) * 220,
      hp: 60, shootT: S.rng.range(0.8, 2.2), angle: 0,
      shirt: '#3a3a3a', bandana: '#e33e3e',
    });
  }
  S.message = { text: `Reyes' crew is here — take them down! (${step.count} enemies)`, t: 3.5 };
  S.audio.sirenBurst();
}

export function updateEnemies(S, dt) {
  if (!S.enemies) return;
  const p = S.player;
  for (const e of S.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    // Close in slowly, but hold a firing distance.
    if (d > 260) {
      e.x += Math.cos(e.angle) * 90 * dt;
      e.y += Math.sin(e.angle) * 90 * dt;
    }
    e.shootT -= dt;
    if (d < 520 && e.shootT <= 0) {
      e.shootT = S.rng.range(1.4, 2.6);
      const a = e.angle + S.rng.range(-0.14, 0.14);
      S.bullets.push({
        x: e.x + Math.cos(a) * 22, y: e.y + Math.sin(a) * 22,
        angle: a, speed: 820, life: 0.7, from: 'enemy',
      });
      S.audio.gunshot(true);
    }
  }
}

