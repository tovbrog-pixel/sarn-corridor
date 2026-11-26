// ===== SOUND: synthesised effects (no audio files). Starts on the first click or key press, because browsers block sound before that. =====
// Every sound is placed on the map. Its loudness falls with distance from the point the camera looks at, and rises as you zoom in:
// from the full-map view the battle is a distant mutter; close in, you hear single rifles, engines and shells landing.
const SFX = (function () {
  let ctx = null, master = null, buf = null, on = true, acc = 0, lastDrone = -9, lastChime = -9, beds = null;
  const api = { get on() { return on; } };
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); master = ctx.createGain(); master.gain.value = on ? .55 : 0; master.connect(ctx.destination);
      const n = ctx.sampleRate * 2; buf = ctx.createBuffer(1, n, ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; mkBeds(); } catch (e) { ctx = null; }
  }
  const ok = () => ctx && on && ctx.state === 'running';
  function noise(dur, type, f0, f1, vol, q, delay) {
    const t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = buf; s.loop = true; f.type = type; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .005); g.gain.exponentialRampToValueAtTime(.0008, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  function tone(type, f0, f1, dur, vol, delay) {
    const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0008, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  }
  // continuous beds: engine and march noise whose loudness follows the moving units near the camera
  function bed(parts, lfoHz, lfoDepth) {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(master); const mix = ctx.createGain(); mix.gain.value = 1; mix.connect(out);
    for (const p of parts) { let src; if (p.noise) { src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; } else { src = ctx.createOscillator(); src.type = p.osc; src.frequency.value = p.f; }
      const f = ctx.createBiquadFilter(); f.type = p.ft; f.frequency.value = p.ff; f.Q.value = p.q || 1; const g = ctx.createGain(); g.gain.value = p.v; src.connect(f); f.connect(g); g.connect(mix); src.start(); }
    if (lfoHz) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = lfoHz; lg.gain.value = lfoDepth; l.connect(lg); lg.connect(mix.gain); l.start(); }
    return out;
  }
  function mkBeds() {
    beds = {
      tank: bed([{ noise: 1, ft: 'lowpass', ff: 120, v: 1.1 }, { osc: 'sawtooth', f: 41, ft: 'lowpass', ff: 160, v: .35 }, { noise: 1, ft: 'bandpass', ff: 1700, q: 6, v: .12 }], 7.5, .35),    // tracks: low roar, engine note, track squeal
      truck: bed([{ noise: 1, ft: 'bandpass', ff: 190, q: 1.4, v: .8 }, { osc: 'sawtooth', f: 74, ft: 'lowpass', ff: 260, v: .18 }], 3.1, .15),                                                // lorries on the road: engine hum
      rough: bed([{ noise: 1, ft: 'bandpass', ff: 850, q: 3, v: .7 }, { noise: 1, ft: 'lowpass', ff: 90, v: .5 }], 11, .6),                                                                     // wheels across country: rattle and grind
      march: bed([{ noise: 1, ft: 'bandpass', ff: 520, q: 1.2, v: .5 }], 1.9, .8),                                                                                                             // marching infantry: scuff of boots and kit
      air: bed([{ osc: 'sawtooth', f: 88, ft: 'lowpass', ff: 420, v: .25 }, { osc: 'sawtooth', f: 91, ft: 'lowpass', ff: 420, v: .2 }, { noise: 1, ft: 'bandpass', ff: 600, q: 2, v: .3 }], .7, .3),   // aircraft overhead
    };
  }
  const setBed = (b, v) => { if (beds && beds[b]) beds[b].gain.setTargetAtTime(Math.min(.9, v), ctx.currentTime, .35); };
  const fx = {
    rifle: v => noise(.07, 'bandpass', 2400, 1200, .5 * v, 1.2),
    mg: v => { for (let i = 0; i < 4; i++) noise(.05, 'bandpass', 2000, 1100, .35 * v, 1, i * .06); },
    gun: v => { noise(.22, 'lowpass', 1400, 200, .8 * v, .7); tone('sine', 120, 45, .25, .7 * v); },
    thump: v => { tone('sine', 70, 38, .4, .7 * v); noise(.3, 'lowpass', 300, 80, .5 * v, .7); },                                                       // a battery firing, heard from afar
    boom: (v, dl) => { noise(.9, 'lowpass', 600, 60, 1.0 * v, .6, dl); tone('sine', 75, 28, .9, .9 * v, dl); },                                         // a shell landing
    whistle: (v, dl) => tone('sine', 1300, 520, Math.max(.2, dl), .08 * v, 0),                                                                          // incoming, close to the camera
    blast: v => { noise(1.6, 'lowpass', 900, 50, 1.2 * v, .5); tone('sine', 60, 22, 1.4, 1.1 * v); tone('sine', 90, 30, .8, .6 * v, .15); },
    thud: v => { tone('sine', 85, 35, .3, .6 * v); noise(.18, 'lowpass', 500, 120, .4 * v); },
    drone: v => { noise(2.6, 'bandpass', 380, 700, .35 * v, 3); tone('sawtooth', 62, 74, 2.6, .07 * v); tone('sawtooth', 94, 108, 2.6, .04 * v); },
    dive: v => { tone('sawtooth', 160, 420, 1.6, .06 * v); noise(1.6, 'bandpass', 500, 1500, .25 * v, 2); },
    flak: v => { for (let i = 0; i < 3; i++) noise(.12, 'bandpass', 900, 300, .45 * v, 1.5, i * .18 + Math.random() * .1); },
  };
  api.chime = function () { if (!ok() || ctx.currentTime - lastChime < 1.2) return; lastChime = ctx.currentTime; tone('sine', 660, 650, .35, .22); tone('sine', 880, 870, .45, .2, .16); };
  api.toggle = function () { on = !on; if (master) master.gain.value = on ? .55 : 0; init(); return on; };
  api.init = init;
  // called every frame: S is the sim, R the renderer, dt real seconds, speed game minutes per second
  api.frame = function (S, R, dt, speed) {
    if (!ctx) return; const cam = R.cam, zg = Math.max(.08, Math.min(1.25, Math.pow(40 / Math.max(cam.dist, 1), .75))), hear = Math.max(3, cam.dist * .5),
      vol = (x, y) => { const d = Math.hypot(x - cam.tx, y - cam.tz) / hear; return zg / (1 + d * d * 2.2); };
    if (!ok()) return;
    acc += dt; if (acc > .2) { acc = 0;
      // engines and boots: only while the clock runs
      let tk = 0, tr = 0, rg = 0, mr = 0, ar = 0; const M = S.map, run = speed > 0;
      if (run) { for (const u of S.subs) { if (!u.active || u.dead || !u.moving || u.mv === 'ship') continue; const v = vol(u.x, u.y); if (v < .02) continue; const w = v * (.4 + .6 * u.str);
          if (u.mv === 'track') tk += w * .5; else if (u.mv === 'wheel' || u.mv === 'motor') { if (M.road[M.idx(u.x, u.y)]) tr += w * .4; else rg += w * .45; } else if (u.mv === 'foot') mr += w * .25; }
        for (const c of S.convoys) { if (c.dead || c.st !== 'out' || c.x == null) continue; const v = vol(c.x, c.y); if (v < .02) continue; if (M.road[M.idx(c.x, c.y)]) tr += v * .35; else rg += v * .4; }
        for (const f of S.flights || []) { if (f.st === 'gone' || f.x == null) continue; ar += vol(f.x, f.y) * .4; } }
      setBed('tank', tk); setBed('truck', tr); setBed('rough', rg); setBed('march', mr * (zg > .5 ? 1 : zg * 2)); setBed('air', ar);
      // fire: single shots near the camera at 1x to 12x; at higher speeds the beds alone carry the battle
      if (run && speed <= 12) { const sc = speed <= 1 ? 1 : speed <= 4 ? .45 : .2; let shots = 0;
        for (const u of S.subs) { if (!u.active || u.dead || S.t - u.fireT > 1.3) continue; const ind = u.k.ir > 0, v = vol(u.x, u.y);
          if (ind) { const tg = u.tgt && !u.tgt.dead ? u.tgt : null, vi = tg ? vol(tg.x, tg.y) : 0; if ((v > .05 || vi > .05) && Math.random() < .22 * sc * .2 && shots < 6) { shots++; if (v > .05) fx.thump(v * (u.mv === 'ship' ? 1.3 : .8)); if (vi > .05) { const dl = .5 + Math.random() * .6; if (vi > .5) fx.whistle(vi, dl); fx.boom(vi * .9, dl); } } continue; }
          if (u.mv === 'ship' || v < .06) continue; const p = (u.cls === 'arm' || u.cls === 'at' ? .3 : .55) * sc * .2;
          if (Math.random() < p && shots < 6) { shots++; if (u.cls === 'arm' || u.cls === 'at') fx.gun(v * .7); else if (Math.random() < .55) fx.rifle(v * .8); else fx.mg(v * .8); } } } }
    if (speed > 0 && speed <= 12) for (const ev of S.ev) {
      if (ev.k === 'bridge' && ev.blown) fx.blast(Math.max(.15, vol(ev.b.x, ev.b.y)) * 1.2);
      else if (ev.k === 'dead' && ev.u) { const v = vol(ev.u.x, ev.u.y); if (v > .1) fx.thud(v); }
      else if (ev.k === 'air' && ev.x != null) { const v = vol(ev.x, ev.y); if (v > .05) { fx.dive(v); fx.boom(v * .8, 1.4); fx.boom(v * .6, 1.7); } }
      else if (ev.k === 'flakhit' && ev.x != null) { const v = vol(ev.x, ev.y); if (v > .05) fx.flak(v); }
      else if (ev.k === 'shell' && ev.x != null) { const v = vol(ev.x, ev.y); if (v > .05) fx.boom(v * .7, 0); }
      else if ((ev.k === 'airdrop' || ev.k === 'dogfight') && ctx.currentTime - lastDrone > 4) { lastDrone = ctx.currentTime; fx.drone(.7); }
    }
  };
  window.addEventListener('pointerdown', init, { once: false, passive: true }); window.addEventListener('keydown', init, { passive: true });
  return api;
})();
