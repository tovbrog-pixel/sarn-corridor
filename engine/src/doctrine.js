// ===== DOCTRINE: how large units deploy and advance along a front =====
// Field-manual practice for division and corps operations (FM 100-5, 1941, chapters 8 and 9; German practice as reported in
// US intelligence bulletins), turned into engine rules. A scenario switches it on with modules: ['doctrine'] and may tune DOCTRINE
// through sc.doctrine. All numbers are starting values for balance testing (game settings).
//  1. Development: a division within devKm of known enemy, or on ground the enemy holds, leaves the roads and moves across
//     country in its deployed formation (cross-country movement factors; the road bonus is ignored).
//  2. Alignment by bounds: in a corps attack, a division that gets more than alignKm ahead of its slowest neighbour halts at
//     the bound until the flank comes up. Mobile divisions in a main-effort attack are exempt and follow rule 3 instead.
//  3. Guarded corridors: an armoured or motorised division pushing ahead of the front measures how far back along its
//     axis its flanks stand on enemy ground. Its own infantry and reconnaissance battalions can guard a length of flank
//     (guardKmPerBn each, plus guardKm0); past that it halts until the flanks are covered, and its corps sends an infantry
//     division forward to line the open flank.
//  4. Main effort: the army commander gives the corps with the best objective a narrow zone and a reserve; the others attack
//     on wide zones without one (command.js, armyTick).
const DOCTRINE = { devKm: 15, alignKm: 8, guardKm0: 10, guardKmPerBn: 4, flankOff: 7, sampleKm: 4, tickMin: 30, xingNearKm: 6, bridgeKm: 8 };   // xingNearKm: how near the river the division must be to start an assault crossing; bridgeKm: an intact bridge this close is used instead
function attachDoctrine(S) {
  const sc = S.sc, D = Object.assign({}, DOCTRINE, sc.doctrine || {});
  const fighting = u => u.active && !u.dead && u.cls !== 'hq' && u.mv !== 'ship';
  const centre = F => { let x = 0, y = 0, k = 0; for (const u of F.subs) if (fighting(u)) { x += u.x; y += u.y; k++; } return k ? [x / k, y / k] : null; };
  // a mobile division: most of its leading battalions ride in vehicles (armour, mechanised, or motorised infantry and reconnaissance)
  const mobile = F => { const L = F.subs.filter(u => fighting(u) && LEADCLS[u.cls]); return L.length && L.filter(u => u.cls === 'arm' || u.cls === 'mech' || u.mv !== 'foot').length / L.length > .6; };
  S.isMobile = mobile;
  const guardBns = F => F.subs.filter(u => fighting(u) && (u.cls === 'inf' || u.cls === 'mech' || u.cls === 'rec')).reduce((a, u) => a + BW(u), 0);

  // 1. development: hourly flag per formation
  function devTick() {
    for (const F of S.forms) { if (!F.active || F.dead) { F.dev = false; continue; } const p = centre(F); if (!p) continue;
      let near = S.ownAt(p[0], p[1]) !== F.s;
      if (!near) for (const e of S.subs) if (e.s !== F.s && e.active && !e.dead && e.mv !== 'ship' && S.t - e.seenT < 60 && Math.hypot(e.x - p[0], e.y - p[1]) < D.devKm) { near = true; break; }
      if (near !== !!F.dev) { F.dev = near; for (const u of F.subs) if (u.goal) u.needPath = true; } } }

  // 2 and 3: alignment and corridors, for every command node with an attack under way
  function frontTick() {
    for (const F of S.forms) { F.alignHold = null; F.flankHold = null; }
    for (const C of S.commands || []) {
      const O = C.order; if (!O || O.st !== 'issued' || !O.plan || C.forms.some(c => c.forms)) continue;   // divisions under a corps only
      if (O.p0 == null) O.p0 = O.plan.map(q => centre(q.child)).filter(Boolean).reduce((a, p, i, A) => [a[0] + p[0] / A.length, a[1] + p[1] / A.length], [0, 0]);
      const L = polyLen(O.line), m = polyAt(O.line, L / 2); let ax = m.x - O.p0[0], ay = m.y - O.p0[1]; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al; const px = -ay, py = ax;
      const fwd = O.plan.filter(q => !q.reserve && !q.child.dead && centre(q.child)).map(q => { const p = centre(q.child); return { q, F: q.child, p, prog: (p[0] - O.p0[0]) * ax + (p[1] - O.p0[1]) * ay, lat: (p[0] - O.p0[0]) * px + (p[1] - O.p0[1]) * py }; }).sort((a, b) => b.lat - a.lat);
      fwd.forEach((o, i) => {
        const F = o.F, mob = mobile(F), free = mob && (O.opt.main || O.opt.exploit);
        // 2. alignment with the neighbours to left and right
        if (!free && fwd.length > 1) { const nb = [fwd[i - 1], fwd[i + 1]].filter(Boolean), lag = nb.reduce((a, n) => n.prog < a.prog ? n : a, nb[0]);
          if (lag && o.prog - lag.prog > D.alignKm && !F.contact) F.alignHold = 'Halted at the bound, waiting for ' + lag.F.n + ' to come up on the flank'; }
        // 3. a mobile spearhead's open flanks: sample back along the axis on both sides
        if (mob) { const cap = D.guardKm0 + D.guardKmPerBn * guardBns(F); let open = [0, 0];
          for (let s = 0; s < 2; s++) { const sg = s ? -1 : 1; for (let d = 0; d < Math.max(0, o.prog) - 2; d += D.sampleKm) { const x = o.p[0] - ax * d + px * sg * D.flankOff, y = o.p[1] - ay * d + py * sg * D.flankOff; if (x < 0 || y < 0 || x > S.map.w || y > S.map.h) break; if (S.ownAt(x, y) === F.s) break; open[s] = d + D.sampleKm; } }
          const worst = Math.max(open[0], open[1]);
          if (worst > cap) { const s = open[0] >= open[1] ? 0 : 1, sg = s ? -1 : 1; F.flankHold = 'Halted: ' + Math.round(worst) + ' km of open flank, more than our ' + guardBns(F) + ' guard battalions can cover; waiting for infantry';
            // the corps sends an infantry division that is in reserve or finished with its task to line the open flank
            if (!O.flankSent || S.t - O.flankSent > 240) { const inf = O.plan.map(q => q.child).filter(c => c !== F && !c.dead && !mobile(c) && c.active && (O.plan.find(q => q.child === c).reserve || !c.order || c.order.st === 'done'))
                .sort((a, b) => { const pa = centre(a), pb = centre(b); return (pa ? Math.hypot(pa[0] - o.p[0], pa[1] - o.p[1]) : 1e9) - (pb ? Math.hypot(pb[0] - o.p[0], pb[1] - o.p[1]) : 1e9); })[0];
              if (inf) { const dmid = Math.min(worst, o.prog) / 2, cx = o.p[0] - ax * dmid + px * sg * D.flankOff, cy = o.p[1] - ay * dmid + py * sg * D.flankOff, hw = Math.min(10, worst / 2);
                S.issueOrder(inf, [], [[cx - ax * hw, cy - ay * hw], [cx + ax * hw, cy + ay * hw]], { then: 'dig' }); O.flankSent = S.t;
                S.say(C.s, C.n + ': ' + inf.n + ' sent forward to cover the open flank of ' + F.n + '.', 1); } } } }
      });
    }
    for (const F of S.forms) { const why = F.flankHold || F.alignHold; if (why && F.status !== why && !F.contact) F.status = why; }
  }
  let last = -1e9, lastDev = -1e9;
  // river assault: a division ordered to an objective across a river that needs a bridge, with no intact bridge within bridgeKm of its
  // axis, puts its battalions over in assault boats where the axis meets the river, instead of marching its columns to a distant bridge
  // and crowding its neighbours (Tov 24 Nov 2026, "No one makes a river assault?"). The AI side and divisions under corps or army
  // orders do this themselves; a division under the player's direct order waits for the Cross order.
  function xingTick() {
    if (!S.cross || !S.xings) return; const map = S.map;
    for (const F of S.forms) { const O = F.order; if (F.dead || !F.active || !O || O.st !== 'active' || !O.line || O.then === 'reserve') continue;
      if (!(S.ai[F.s] || F.staff || O.byCmd) || S.t < (F.xAutoT || 0) || S.xings.some(X => X.F === F && !X.done)) continue;
      const c0 = [F.cx, F.cy], L = O.line, m = [(L[0][0] + L[L.length - 1][0]) / 2, (L[0][1] + L[L.length - 1][1]) / 2], dist = Math.hypot(m[0] - c0[0], m[1] - c0[1]); if (dist < 3) continue;
      let hit = null; for (let d = .5; d < dist; d += .5) { const x = c0[0] + (m[0] - c0[0]) * d / dist, y = c0[1] + (m[1] - c0[1]) * d / dist, t = map.t[map.idx(x, y)]; if (t === T.RIVER) { hit = [x, y, d]; break; } if (t === T.SEA) break; }
      if (!hit || hit[2] > D.xingNearKm) continue;                                               // no river on the axis, or the division is not yet near it
      if (map.bridges.some(b => b.intact !== false && !b.gone && Math.hypot(b.x - hit[0], b.y - hit[1]) < D.bridgeKm)) continue;   // a bridge close by: use it
      F.xAutoT = S.t + 360; const r = S.cross(F, hit[0], hit[1]);
      if (r && typeof r === 'object') { F.status = 'Assault crossing'; S.say(F.s, F.n + ': no bridge near our axis; the battalions go over the river in assault boats.', 1); } }
  }
  const prev = S.cmdHook; S.cmdHook = function () { if (prev) prev(); if (S.t - lastDev >= 60) { lastDev = S.t; devTick(); } if (S.t - last >= D.tickMin) { last = S.t; frontTick(); xingTick(); } };
  return S;
}

// ===== INTELLIGENCE: the picture each side holds of the enemy's divisions =====
// At the start (sc.intel), each side knows a share of the enemy divisions on the map: front-line divisions (within frontKm of its
// own troops) with probability known[s], rear divisions with known[s] * rearMul, each placed with an error of errKm[0] (front) or
// errKm[1] (rear) and identified by name with probability named[s]. Each hour, an enemy division seen by any unit moves its entry
// to where it was seen and is identified; between sightings the entry keeps its last known position and age. The renderer draws
// entries for divisions not currently in view as faded estimated symbols. All values are game settings.
const INTEL0 = { known: [.8, .6], rearMul: .55, errKm: [4, 14], named: [.6, .4], frontKm: 30, clearKm: 3, staleH: 24 };   // clearKm: our troops this near a reported position see it is empty; staleH: hours a report on our own ground survives
function attachIntel(S) {
  const sc = S.sc, Q = Object.assign({}, INTEL0, sc.intel || {}), rnd = S.rnd;
  const fighting = u => u.active && !u.dead && u.cls !== 'hq' && u.mv !== 'ship';
  const centre = (F, f) => { let x = 0, y = 0, k = 0; for (const u of F.subs) if (fighting(u) && (!f || f(u))) { x += u.x; y += u.y; k++; } return k ? [x / k, y / k] : null; };
  const label = F => F.n.replace(/ (Infantry |Armou?red |Panzer |Motorized |Rifle |Tank )?Division.*| \(.*/, m => /Panzer|Armou?red|Tank/.test(m) ? ' Armd' : /Motorized/.test(m) ? ' Mot' : '').replace(/^(\d+)(st|nd|rd|th)\b/, '$1');
  const kind = F => { const L = F.subs.filter(u => fighting(u)); return L.filter(u => u.cls === 'arm').length * 3 >= L.length ? 'arm' : 'inf'; };
  S.intel = [[], []];
  for (let s = 0; s < 2; s++) { const mine = S.subs.filter(u => u.s === s && fighting(u));
    for (const F of S.forms) { if (F.s === s || !F.active || F.dead) continue; const p = centre(F); if (!p) continue;
      let dn = 1e9; for (const u of mine) { const d = Math.hypot(u.x - p[0], u.y - p[1]); if (d < dn) dn = d; }
      const front = dn <= Q.frontKm; if (rnd() > Q.known[s] * (front ? 1 : Q.rearMul)) continue;
      const err = Q.errKm[front ? 0 : 1], a = rnd() * 6.283, r = err * Math.sqrt(rnd()), named = rnd() < Q.named[s];
      S.intel[s].push({ F, x: Math.max(0, Math.min(S.map.w, p[0] + Math.cos(a) * r)), y: Math.max(0, Math.min(S.map.h, p[1] + Math.sin(a) * r)), t: 0, named, label: named ? label(F) : 'Division', cls: rnd() < .85 ? kind(F) : 'inf', src: 'prewar' }); } }
  let last = 0;
  const prev = S.cmdHook; S.cmdHook = function () { if (prev) prev(); if (S.t - last < 60) return; last = S.t;
    for (let s = 0; s < 2; s++) { const L = S.intel[s];
      for (let i = L.length - 1; i >= 0; i--) if (L[i].F.dead) L.splice(i, 1);
      for (const F of S.forms) { if (F.s === s || !F.active || F.dead) continue; const p = centre(F, u => S.t - u.seenT < 60); if (!p) continue;
        let e = L.find(q => q.F === F); if (!e) { e = { F, src: 'contact' }; L.push(e); } Object.assign(e, { x: p[0], y: p[1], t: S.t, named: true, label: label(F), cls: kind(F) }); }
      // strike off a stale report: our troops stand within sight of the reported position and the division is not there, or the
      // position lies on ground we have held for a day without contact (Tov 24 Nov 2026: markers deep inside our lines)
      const mine = S.subs.filter(u => u.s === s && fighting(u));
      for (let i = L.length - 1; i >= 0; i--) { const e = L[i]; if (e.t >= S.t - 1) continue; const c = centre(e.F), there = c && Math.hypot(c[0] - e.x, c[1] - e.y) < 4;
        if (!there && mine.some(u => Math.hypot(u.x - e.x, u.y - e.y) < Q.clearKm)) { L.splice(i, 1); continue; }
        if (S.ownAt(e.x, e.y) === s) { e.ownT = e.ownT == null ? S.t : e.ownT; if (S.t - e.ownT > Q.staleH * 60) L.splice(i, 1); } else e.ownT = null; } } };
  return S;
}
