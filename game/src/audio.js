// Sound, all synthesized with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots and three procedural radio stations.
import { RADIO } from './config.js';

export function makeAudio() {
  const A = {
    ctx: null, master: null, engineOsc: null, engineGain: null, engineFilter: null,
    radioTimer: null, radioStep: 0, radioNext: 0, station: 0, muted: false,
    sirenOsc: null, sirenGain: null, sirenOn: false,

    // Called on the first user gesture; browsers block audio before that.
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return true;
      }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        // Engine: a sawtooth through a lowpass, pitch follows speed.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 420;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        // Siren: two alternating tones, quiet until a chase starts.
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 700;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        return true;
      } catch (e) {
        return false;
      }
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },

    // Engine pitch + volume from the player's speed.
    updateEngine(speed, driving) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const target = driving ? 0.05 + Math.min(0.1, speed / 6000) : 0;
      this.engineGain.gain.setTargetAtTime(target, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(55 + speed * 0.16, t, 0.08);
    },

    // The siren wails while any cruiser is close.
    updateSiren(active) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.sirenGain.gain.setTargetAtTime(active ? 0.045 : 0, t, 0.3);
      if (active) {
        const phase = Math.floor(t * 1.6) % 2;
        this.sirenOsc.frequency.setTargetAtTime(phase ? 950 : 650, t, 0.05);
      }
    },

    sirenBurst() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.sirenGain.gain.setTargetAtTime(0.06, t, 0.05);
      this.sirenGain.gain.setTargetAtTime(0, t + 0.9, 0.4);
    },

    blip(freq, dur) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.1));
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + (dur || 0.1) + 0.02);
    },

    door() { this.blip(140, 0.12); },

    thud() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.2);
    },

    gunshot(far) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const len = 0.14;
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = far ? 0.1 : 0.22;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 2400;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    },

    explosion() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const len = 0.7;
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = 0.5;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
      og.gain.setValueAtTime(0.4, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      o.connect(og); og.connect(this.master);
      o.start(t); o.stop(t + 0.7);
    },

    fanfare() {
      if (!this.ctx) return;
      const notes = [523, 659, 784, 1047];
      notes.forEach((n, i) => {
        const t = this.ctx.currentTime + i * 0.12;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = n;
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + 0.32);
      });
    },

    // --- radio: a tiny step sequencer per station ---------------------------
    setStation(i) {
      this.station = ((i % RADIO.length) + RADIO.length) % RADIO.length;
      this.radioStep = 0;
      if (this.ctx) this.radioNext = this.ctx.currentTime + 0.05;
    },

    radioTick() {
      if (!this.ctx || this.muted) return;
      const st = RADIO[this.station];
      const stepDur = 60 / st.bpm / 4; // 16th notes
      if (this.radioNext === 0) this.radioNext = this.ctx.currentTime + 0.05;
      while (this.radioNext < this.ctx.currentTime + 0.25) {
        this.playRadioStep(st, this.radioStep, this.radioNext, stepDur);
        this.radioStep = (this.radioStep + 1) % 64;
        this.radioNext += stepDur;
      }
    },

    playRadioStep(st, step, t, stepDur) {
      const root = st.root;
      // Bass: root notes on a per-station pattern.
      const bassPat = st.bright ? [0, 0, 7, 0, 10, 0, 7, 5] : [0, 0, 0, 7, 0, 0, 5, 3];
      const chordPat = [0, 3, 7, 10];
      const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
      if (step % 4 === 0) {
        const deg = bassPat[(step / 4) % bassPat.length];
        this.note(midi(root + deg - 12), t, stepDur * 3.5, st.wave, 0.10);
      }
      // Lead arp on the bright stations.
      if (st.bright && step % 2 === 0) {
        const arp = [12, 15, 19, 24, 19, 15];
        const deg = arp[(step / 2) % arp.length] + chordPat[Math.floor(step / 16) % 4];
        this.note(midi(root + deg), t, stepDur * 1.8, 'sine', 0.05);
      }
      // Chords on the chill station.
      if (!st.bright && step % 8 === 0) {
        for (const iv of chordPat.slice(0, 3)) {
          this.note(midi(root + 12 + iv), t, stepDur * 7, 'triangle', 0.035);
        }
      }
      // Hat tick every off-beat.
      if (step % 2 === 1) this.hat(t, 0.02);
    },

    note(freq, t, dur, wave, vol) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = wave;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },

    hat(t, vol) {
      const len = 0.03;
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 6000;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    },
  };
  return A;
}
