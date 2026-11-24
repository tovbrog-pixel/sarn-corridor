// ===== TOWNS AND CITIES =====
// A scenario switches this on with modules: ['urban'] and may tune URBAN through sc.urban. All numbers are game settings.
//  1. Taking a town means troops in the town. A town with a built-up area on the map (minCells cells or more) changes hands when
//     one side's formed troops stand in its built-up cells, or at its centre, and none of the other side's do. Smaller places keep
//     the engine's 1.2 km rule.
//  2. Districts. A city named in sc.districts is several objectives, each with its own share of the built-up area. The cells are
//     shared out by flooding from each district's point through built-up ground (a river is a boundary) and, where two floods
//     meet, by the nearer point.
//  3. A town fight favours an infantry assault with armor in support: tanks firing into a town without infantry beside them
//     lose effect; infantry attacking a town with tanks beside them gain; infantry at close range in a town hit tanks hard, and
//     less hard when the tanks have their own infantry with them.
//  4. A general ordered into an enemy-held town with tanks and little infantry says so.
//  5. A corps commander whose objective takes in an enemy-held town holds his armored division in reserve and moves the sector
//     boundaries so the town falls to infantry (command.js, planCommandOrder).
const URBAN = { minCells: 4, maxKm: 8, centreKm: .7, armSoft: .6, combined: 1.25, supKm: .8, faust: 2.5, faustGuarded: 1.4, cacheMin: 5 };
function attachUrban(S) {
  const sc = S.sc, U = Object.assign({}, URBAN, sc.urban || {}), map = S.map, W = map.W, H = map.H, cs = map.cs;
  const built = c => map.t[c] === T.TOWN || map.t[c] === T.CITY, cx = c => (c % W + .5) * cs, cy = c => (((c / W) | 0) + .5) * cs;
  const district = {}; for (const d of sc.districts || []) for (const n of d.parts) district[n] = d.city;
  // flood each objective's built-up area from the built-up cell nearest its point
  const claim = new Map();   // cell -> [vp, distance to that vp's point]
  for (const v of S.vp) { let seed = -1, sd = 1.6; const r = Math.ceil(1.6 / cs), i0 = Math.floor(v.x / cs), j0 = Math.floor(v.y / cs);
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= W || j >= H) continue; const c = j * W + i; if (!built(c)) continue; const d = Math.hypot(cx(c) - v.x, cy(c) - v.y); if (d < sd) { sd = d; seed = c; } }
    v.cells = null; if (seed < 0) continue; const got = [seed], seen = new Set(got);
    for (let h = 0; h < got.length; h++) { const c = got[h], i = c % W; for (const n of [i > 0 ? c - 1 : -1, i < W - 1 ? c + 1 : -1, c - W, c + W]) { if (n < 0 || n >= W * H || seen.has(n) || !built(n) || Math.hypot(cx(n) - v.x, cy(n) - v.y) > U.maxKm) continue; seen.add(n); got.push(n); } }
    if (got.length < U.minCells && !district[v.n]) continue; v.city = district[v.n] || null;
    for (const c of got) { const d = Math.hypot(cx(c) - v.x, cy(c) - v.y), q = claim.get(c); if (!q || d < q[1]) claim.set(c, [v, d]); } }
  const cellVP = new Int16Array(W * H); S.urbanCellVP = cellVP;   // 1 + index of the objective whose built-up area the cell belongs to
  for (const [c, q] of claim) { const v = q[0]; (v.cells || (v.cells = new Set())).add(c); v.cellR = Math.max(v.cellR || 0, q[1] + cs); cellVP[c] = 1 + S.vp.indexOf(v); }
  S.urban = U;
  S.townAt = (x, y) => { const k = cellVP[map.idx(x, y)]; return k ? S.vp[k - 1] : null; };
  // is a friendly unit of the given kind within supporting distance? ('arm' tanks; 'inf' infantry, engineers, commandos, armored infantry)
  const INF = { inf: 1, mech: 1, eng: 1, cdo: 1 };
  S.urbanNear = function (u, kind) { if (u.unT == null || S.t - u.unT > U.cacheMin) { u.unT = S.t; let a = false, f = false;
      for (const o of S.subs) { if (o === u || o.s !== u.s || !o.active || o.dead || o.coh < .3) continue; const dx = o.x - u.x; if (dx > U.supKm || dx < -U.supKm) continue; if (Math.hypot(dx, o.y - u.y) > U.supKm) continue; if (o.cls === 'arm') a = true; else if (INF[o.cls]) f = true; if (a && f) break; }
      u.unArm = a; u.unInf = f; } return kind === 'arm' ? u.unArm : u.unInf; };
  S.urbanInf = INF;
  // a general sent into an enemy-held town with tanks and little infantry says so, once per order
  let last = -1e9; const prev = S.cmdHook; S.cmdHook = function () { if (prev) prev(); if (S.t - last < 30) return; last = S.t;
    for (const F of S.forms) { const O = F.order; if (!O || O === F.urbO || !F.active || F.dead || !O.line) continue; F.urbO = O; const L = O.line, m = [(L[0][0] + L[L.length - 1][0]) / 2, (L[0][1] + L[L.length - 1][1]) / 2];
      let v = S.townAt(m[0], m[1]); if (!v) for (const p of L) { v = S.townAt(p[0], p[1]); if (v) break; } if (!v || v.own === F.s) continue;
      const us = F.subs.filter(u => u.active && !u.dead && LEADCLS[u.cls]), tanks = us.filter(u => u.cls === 'arm').length;
      if (tanks >= 2 && tanks * 3 >= us.length)   // an armored division or brigade
        S.say(F, 'My tanks will be exposed in the streets of ' + v.n + '. I recommend infantry lead the assault, with armor in support.', 1, v.x, v.y); } };
  return S;
}
if (typeof module !== 'undefined') module.exports = { attachUrban, URBAN };
