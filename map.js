// ===== MAP: terrain grid, features, pathfinding =====
const T = { OPEN: 0, LF: 1, HF: 2, HILL: 3, MTN: 4, ROUGH: 5, DESERT: 6, JUNGLE: 7, BEACH: 8, MARSH: 9, TOWN: 10, CITY: 11, SEA: 12, RIVER: 13, STREAM: 14, BOCAGE: 15 };
const TNAME = ['Open ground', 'Light forest', 'Heavy forest', 'Hills', 'Mountain', 'Rough ground', 'Desert', 'Jungle', 'Beach', 'Marsh / polder', 'Town', 'City', 'Sea', 'River', 'Stream', 'Bocage'];
// speed factor by move class [foot, wheel, track]
const TFAC = [[1, .45, .7], [.8, .25, .45], [.6, .08, .18], [.7, .3, .5], [.35, 0, .06], [.7, .2, .4], [.9, .45, .8], [.4, 0, .1], [.8, .25, .55], [.5, .08, .12], [.9, .6, .6], [.8, .5, .5], [0, 0, 0], [0, 0, 0], [.35, .12, .25], [.7, .15, .3]];
const RFAC = [null, [1.1, .6, .75], [1.2, .9, .95], [1.25, 1, 1]];
const COVER = [1, .7, .5, .8, .6, .75, 1.1, .5, 1.3, 1, .55, .4, 1, 1, 1, .55];
const MVI = { foot: 0, wheel: 1, track: 2, ship: 0 };

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, s) { return (vnoise(x, y, s) * .5 + vnoise(x * 2.1, y * 2.1, s + 7) * .3 + vnoise(x * 4.3, y * 4.3, s + 13) * .2) * 2 - 1; }
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; } return c; }
function catmull(pts, step) { // smooth polyline through points, sampled roughly every `step` km
  if (pts.length < 3) { const o = []; for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]), n = Math.max(1, Math.ceil(d / step)); for (let k = 0; k < n; k++) o.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / n, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / n]); } o.push(pts[pts.length - 1].slice(0, 2)); return o; }
  const o = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(d / step));
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; const f = (a, b, c, e) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - e) * t2 + (-a + 3 * b - 3 * c + e) * t3); o.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); }
  }
  o.push(pts[pts.length - 1].slice(0, 2)); return o;
}

function densify(pts, step) { // keep every point, add points so no gap exceeds `step` km
  const o = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step); for (let k = 1; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  return o;
}
function buildMap(sc) {
  const cs = sc.cs, W = Math.round(sc.w / cs), H = Math.round(sc.h / cs), N = W * H, seed = sc.seed || 7;
  const m = { sc, cs, W, H, N, w: sc.w, h: sc.h, t: new Uint8Array(N), el: new Float32Array(N), road: new Uint8Array(N), lane: new Uint8Array(N), riv: new Uint8Array(N), br: new Int16Array(N).fill(-1), bridges: [], towns: [], fac: [new Float32Array(N), new Float32Array(N), new Float32Array(N)], roadLines: [], riverLines: [], townFire: [] };
  const E = sc.elev || {}, base = sc.base === 'desert' ? T.DESERT : T.OPEN;
  m.elevAt = function (x, y) {
    let e = E.base || 0;
    if (E.noise) e += fbm(x / E.noise[1], y / E.noise[1], seed) * E.noise[0];
    if (E.hills) for (const h of E.hills) { const d2 = ((x - h[0]) ** 2 + (y - h[1]) ** 2) / (h[2] * h[2]); if (d2 < 6) e += h[3] * Math.exp(-d2 * 1.4); }
    if (E.ridges) for (const r of E.ridges) { const d = segDist(x, y, r[0], r[1], r[2], r[3]) / r[4]; if (d < 2.6) e += r[5] * Math.exp(-d * d * 1.3) * (.72 + .5 * vnoise(x / 2.3, y / 2.3, seed + 3)); }
    return e;
  };
  const inSea = (x, y) => { if (!sc.sea) return false; for (const p of sc.sea) if (inPoly(x, y, p)) return true; return false; };
  const blob = (list, x, y) => { let best = 0; if (list) for (const b of list) { const d = Math.hypot(x - b[0], y - b[1]) / b[2]; if (d < 1.5) { const n = .7 + .6 * vnoise(x / 1.7, y / 1.7, seed + 21); if (d < n) best = Math.max(best, b[3] || 1); } } return best; };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = j * W + i, x = (i + .5) * cs, y = (j + .5) * cs;
    if (sc.raster) { m.t[c] = sc.raster.t[c]; m.el[c] = sc.raster.el[c]; continue; }   // real terrain built from data/terrain
    if (inSea(x, y)) { m.t[c] = T.SEA; m.el[c] = -8; continue; }
    const e = Math.max(1, m.elevAt(x, y)); m.el[c] = e;
    let t = base;
    if (e > (sc.mtnT || 1e9)) t = T.MTN; else if (e > (sc.hillT || 1e9)) t = T.HILL;
    if (t !== T.MTN) {
      const f = blob(sc.forest, x, y); if (f) t = f >= 2 ? T.HF : T.LF;
      if (blob(sc.rough, x, y) && t !== T.HF) t = T.ROUGH;
      if (blob(sc.marsh, x, y)) t = T.MARSH;
      if (blob(sc.jungle, x, y)) t = T.JUNGLE;
    }
    m.t[c] = t;
  }
  // beaches
  if (sc.beach) for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const c = j * W + i; if (m.t[c] === T.SEA) continue;
    const x = (i + .5) * cs, y = (j + .5) * cs; let ok = false; for (const b of sc.beach) if (x >= b[0] && y >= b[1] && x <= b[2] && y <= b[3]) ok = true; if (!ok) continue;
    let near = false; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (m.t[c + dj * W + di] === T.SEA) near = true;
    if (near) { m.t[c] = T.BEACH; m.el[c] = 2; }
  }
  // coastal smoothing of elevation near sea
  // A* heuristic table: HT[dx * H + dy] = Math.hypot(dx, dy) * 0.8 for cell offsets, the same values the search computed per step
  let HT_ = null; const htab = () => HT_ || (HT_ = (() => { const z = new Float64Array(W * H); for (let dx = 0; dx < W; dx++) for (let dy = 0; dy < H; dy++) z[dx * H + dy] = Math.hypot(dx, dy) * .8; return z; })());
  const idx = (x, y) => { const i = Math.max(0, Math.min(W - 1, Math.floor(x / cs))), j = Math.max(0, Math.min(H - 1, Math.floor(y / cs))); return j * W + i; };
  m.idx = idx;
  function raster(pts, fn) { let pi = -1, pj = -1; for (const p of pts) { const i = Math.floor(p[0] / cs), j = Math.floor(p[1] / cs); if (i < 0 || j < 0 || i >= W || j >= H) { pi = -1; continue; } if (i === pi && j === pj) continue; if (pi >= 0 && i !== pi && j !== pj) fn(j * W + pi); fn(j * W + i); pi = i; pj = j; } }
  if (sc.raster && (sc.raster.w !== W || sc.raster.h !== H)) throw new Error('raster size ' + sc.raster.w + 'x' + sc.raster.h + ' does not match map ' + W + 'x' + H);
  const line = (p) => sc.realLines ? densify(p, cs / 3) : catmull(p, cs / 3);   // real survey lines are used as drawn; sketch lines are smoothed
  for (const r of sc.rivers || []) { const pts = line(r[2]); m.riverLines.push({ name: r[0], cls: r[1], pts }); raster(pts, c => { if (m.t[c] === T.SEA) return; if (r[1] === 1) { m.riv[c] = 1; m.t[c] = T.RIVER; } else if (m.riv[c] !== 1) { m.riv[c] = 2; m.t[c] = T.STREAM; } }); }
  for (const t of sc.towns || []) {
    const tw = { name: t[0], x: t[1], y: t[2], size: t[3], fire: 0 }; m.towns.push(tw);
    const r = t[4] || (t[3] >= 3 ? 1.7 : t[3] === 2 ? .95 : .4);   // t[4]: radius of the built-up area in km, when the scenario sets one
    for (let j = Math.floor((t[2] - r) / cs); j <= Math.floor((t[2] + r) / cs); j++) for (let i = Math.floor((t[1] - r) / cs); i <= Math.floor((t[1] + r) / cs); i++) {
      if (i < 0 || j < 0 || i >= W || j >= H) continue; const c = j * W + i; if (m.t[c] === T.SEA || m.t[c] === T.RIVER) continue;
      const d = Math.hypot((i + .5) * cs - t[1], (j + .5) * cs - t[2]); if (d <= r + cs * .3) m.t[c] = (t[3] >= 3 && d < r * .7) ? T.CITY : T.TOWN;
    }
  }
  for (const r of sc.roads || []) { const pts = line(r[1]); m.roadLines.push({ cls: r[0], pts: sc.realLines ? r[1] : pts }); raster(pts, c => { if (m.t[c] === T.SEA) return; if (m.road[c] < r[0]) m.road[c] = r[0]; }); }
  // bridges: road over major river
  const seen = new Uint8Array(N);
  for (let c = 0; c < N; c++) if (m.riv[c] === 1 && m.road[c] && !seen[c]) {
    const cells = [], st = [c]; seen[c] = 1;
    while (st.length) { const q = st.pop(); cells.push(q); const qi = q % W, qj = (q / W) | 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ni = qi + di, nj = qj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const n = nj * W + ni; if (!seen[n] && m.riv[n] === 1 && m.road[n]) { seen[n] = 1; st.push(n); } } }
    let bx = 0, by = 0; for (const q of cells) { bx += (q % W + .5) * cs; by += (((q / W) | 0) + .5) * cs; } bx /= cells.length; by /= cells.length;
    const b = { id: m.bridges.length, cells, x: bx, y: by, intact: true, wired: 0, own: 1, work: 0, repairH: 10, name: '' };
    let bd = 1e9; for (const t of m.towns) { const d = Math.hypot(t.x - bx, t.y - by); if (d < bd) { bd = d; b.name = t.name; } }
    b.name += ' bridge';
    for (const q of cells) m.br[q] = b.id; m.bridges.push(b);
  }
  for (const o of sc.bridges || []) { let best = null, bd = 2.5; for (const b of m.bridges) { const d = Math.hypot(b.x - o[0], b.y - o[1]); if (d < bd) { bd = d; best = b; } } if (best) Object.assign(best, o[2]); else if (typeof console !== 'undefined') console.warn('bridge override not matched', o); }
  m.facX = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  m.calcFac = function () {
    for (let c = 0; c < N; c++) {
      const t = m.t[c], r = m.road[c];
      for (let k = 0; k < 3; k++) {
        let f = t === T.MARSH && sc.mines && m.lane[c] ? TFAC[T.OPEN][k] : TFAC[t][k];   // a lane cleared through a minefield drives like open ground
        if (t === T.RIVER) { const b = m.br[c] >= 0 ? m.bridges[m.br[c]] : null; f = b && b.intact && (r || b.fl) ? RFAC[r || 2][k] : 0; }   // a floating bridge carries traffic where no road crosses
        const fx = f;   // cross-country factor: the terrain alone (doctrine: a developed formation leaves the roads)
        if (t !== T.RIVER && r) { let rf = RFAC[r][k]; if (t === T.MTN) rf *= .6; else if (t === T.HF || t === T.HILL || t === T.JUNGLE) rf *= .85; f = Math.max(f, rf); }
        m.fac[k][c] = f; m.facX[k][c] = t === T.RIVER ? f : fx;
      }
    }
  };
  m.calcFac();
  m.setBridge = function (b, intact) { b.intact = intact; b.work = 0; m.calcFac(); m.ver = (m.ver || 0) + 1; };
  // floating bridges built by engineers in play, and taken up again
  m.addBridge = function (cells, x, y, name, own, dir) { const b = { id: m.bridges.length, cells, x, y, intact: true, wired: 0, own, work: 0, repairH: 2, name, fl: 1, dir }; for (const q of cells) m.br[q] = b.id; m.bridges.push(b); m.calcFac(); m.ver = (m.ver || 0) + 1; return b; };
  m.removeBridge = function (b) { for (const q of b.cells) if (m.br[q] === b.id) m.br[q] = -1; b.gone = true; b.intact = false; m.calcFac(); m.ver = (m.ver || 0) + 1; };
  m.hAt = function (x, y) { const fx = Math.max(0, Math.min(W - 1.001, x / cs - .5)), fy = Math.max(0, Math.min(H - 1.001, y / cs - .5)); const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, c = j * W + i; return m.el[c] * (1 - u) * (1 - v) + m.el[c + 1] * u * (1 - v) + m.el[c + W] * (1 - u) * v + m.el[c + W + 1] * u * v; };
  m.tAt = (x, y) => m.t[idx(x, y)];
  // nearest passable cell centre for class k (optionally best cover)
  // lab: keep to cells in that connected piece of ground (see m.comp)
  m.snap = function (k, x, y, rad, cover, lab) {
    const ci = Math.floor(x / cs), cj = Math.floor(y / cs), cl = lab ? m.comp(k) : null; let best = null, bs = 1e9; rad = Math.max(1, Math.round(rad || 4));
    for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= W || j >= H) continue; const c = j * W + i; if (m.fac[k][c] <= 0 || m.t[c] === T.RIVER || (cl && cl[c] !== lab)) continue;
      let s = Math.hypot(di, dj); if (cover) s += COVER[m.t[c]] * 2.2 - m.el[c] * .0015;
      if (s < bs) { bs = s; best = c; }
    }
    return best == null ? null : [(best % W + .5) * cs, (((best / W) | 0) + .5) * cs];
  };
  // connected pieces of ground for move class k: water with no bridge splits them. Rebuilt when a bridge goes up or down.
  const compC = [];
  m.comp = function (k) { const C = compC[k]; if (C && C.ver === (m.ver || 0)) return C.lab;
    const lab = new Int32Array(N), fac = m.fac[k], st = []; let n = 0;
    for (let c0 = 0; c0 < N; c0++) { if (lab[c0] || fac[c0] <= 0) continue; n++; lab[c0] = n; st.push(c0);
      while (st.length) { const c = st.pop(), ci = c % W, cj = (c / W) | 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= W || j >= H) continue; const q = j * W + i; if (!lab[q] && fac[q] > 0) { lab[q] = n; st.push(q); } } } }
    compC[k] = { ver: m.ver || 0, lab }; return lab; };
  m.compAt = function (k, x, y) { const s = m.snap(k, x, y, 2); return s ? m.comp(k)[idx(s[0], s[1])] : 0; };
  // A* --------------------------------------------------------------
  const g = new Float32Array(N), from = new Int32Array(N), stamp = new Uint32Array(N), closed = new Uint32Array(N); let gen = 0;
  const hp = [], hf = [];
  function push(c, f) { let i = hp.length; hp.push(c); hf.push(f); while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; hp[i] = hp[p]; hf[i] = hf[p]; i = p; } hp[i] = c; hf[i] = f; }
  function pop() { const top = hp[0], lc = hp.pop(), lf = hf.pop(); const n = hp.length; if (n) { let i = 0; for (; ;) { let l = 2 * i + 1; if (l >= n) break; if (l + 1 < n && hf[l + 1] < hf[l]) l++; if (hf[l] >= lf) break; hp[i] = hp[l]; hf[i] = hf[l]; i = l; } hp[i] = lc; hf[i] = lf; } return top; }
  // trucks keep to roads; desert, towns and beaches count as drivable ground for them
  const offRoad = c => !m.road[c] && m.t[c] !== T.DESERT && m.t[c] !== T.TOWN && m.t[c] !== T.CITY && m.t[c] !== T.BEACH && m.t[c] !== T.RIVER;
  m.pathCount = 0;
  // regions a search can cross: cells with fac[k] > 0 that the block mask leaves open, joined orthogonally, or diagonally where
  // both side cells are passable (the search's own move rules). findPath with opt.comp skips a search that cannot reach its goal.
  m.compLabel = function (k, block, lab) {
    const fac = m.fac[k], st = new Int32Array(N); lab = lab || new Int32Array(N); lab.fill(0); let n = 0;
    const ok = c => fac[c] > 0 && !(block && block[c]);
    for (let c0 = 0; c0 < N; c0++) { if (lab[c0] || !ok(c0)) continue; n++; lab[c0] = n; let sp = 0; st[sp++] = c0;
      while (sp) { const c = st[--sp], ci = c % W, cj = (c / W) | 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const q = nj * W + ni;
          if (lab[q] || !ok(q)) continue; if (di && dj && (fac[cj * W + ni] <= 0 || fac[nj * W + ci] <= 0)) continue; lab[q] = n; st[sp++] = q; } } }
    return lab;
  };
  // can a search from cell a reach cell b under the same rules? a expands even if blocked; b is accepted even if blocked
  function canReach(k, lab, block, a, b) {
    const fac = m.fac[k], nb = (c, f) => { const ci = c % W, cj = (c / W) | 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const q = nj * W + ni; if (fac[q] <= 0) continue; if (di && dj && (fac[cj * W + ni] <= 0 || fac[nj * W + ci] <= 0)) continue; if (f(q)) return true; } return false; };
    const from = new Set(); nb(a, q => { if (q === b) { from.add(-1); return true; } if (lab[q]) from.add(lab[q]); return false; });
    if (from.has(-1)) return fac[b] > 0; if (!from.size || fac[b] <= 0) return false;
    if (lab[b] && from.has(lab[b])) return true;
    return nb(b, q => lab[q] > 0 && from.has(lab[q]));
  }
  m.findPath = function (k, sx, sy, gx, gy, opt) {
    m.pathCount++; opt = opt || {}; const fac = (opt.cross ? m.facX : m.fac)[k], block = opt.block, threat = opt.threat, rb = opt.road || 0;   // rb: extra cost on ground with no road (supply columns)
    const s0 = m.snap(k, sx, sy, 3), g0 = m.snap(k, gx, gy, opt.grad || 4); if (!s0 || !g0) return null;
    const sc0 = idx(s0[0], s0[1]), gc = idx(g0[0], g0[1]), gi = gc % W, gj = (gc / W) | 0;
    if (sc0 === gc) return [[g0[0], g0[1]]];
    if (opt.comp && !canReach(k, opt.comp, block, sc0, gc)) return null;   // the search would fail: skip it
    const HT = htab(); gen++; hp.length = 0; hf.length = 0; g[sc0] = 0; stamp[sc0] = gen; from[sc0] = -1; push(sc0, 0);
    let found = false, it = 0; const maxIt = opt.maxIt || N * 2;
    while (hp.length && it++ < maxIt) {
      const c = pop(); if (closed[c] === gen) continue; closed[c] = gen; if (c === gc) { found = true; break; }
      const ci = c % W, cj = (c / W) | 0, gcst = g[c];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const n = nj * W + ni;
        const f = fac[n]; if (f <= 0 || closed[n] === gen) continue; if (block && block[n] && n !== gc) continue;
        if (di && dj && (fac[cj * W + ni] <= 0 || fac[nj * W + ci] <= 0)) continue;
        let cost = (di && dj ? 1.4142 : 1) / f; if (rb && offRoad(n)) cost *= rb; if (threat) cost += threat[n];
        const ng = gcst + cost;
        if (stamp[n] !== gen || ng < g[n]) { g[n] = ng; stamp[n] = gen; from[n] = c; push(n, ng + HT[(ni > gi ? ni - gi : gi - ni) * H + (nj > gj ? nj - gj : gj - nj)]); }
      }
    }
    if (!found) return null;
    const cells = []; for (let c = gc; c !== -1; c = from[c]) cells.push(c); cells.reverse();
    let pts = cells.map(c => [(c % W + .5) * cs, (((c / W) | 0) + .5) * cs]);
    // drop collinear points
    const o = [pts[0]]; for (let i = 1; i < pts.length - 1; i++) { const a = o[o.length - 1], b = pts[i], d = pts[i + 1]; if (Math.abs((b[0] - a[0]) * (d[1] - b[1]) - (b[1] - a[1]) * (d[0] - b[0])) > 1e-6) o.push(b); } if (pts.length > 1) o.push(pts[pts.length - 1]);
    if (rb) { let off = 0; for (let i = 1; i < cells.length; i++) if (offRoad(cells[i])) { const a = cells[i - 1], b = cells[i]; off += (a % W !== b % W && ((a / W) | 0) !== ((b / W) | 0) ? 1.4142 : 1) * cs * (m.t[b] === T.OPEN ? .5 : 1); } o.off = off; }   // km driven off the road; open fields count half, since farm tracks cross them
    o.cost = g[gc] * cs; return o;
  };
  return m;
}
