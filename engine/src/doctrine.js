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
const DOCTRINE = { devKm: 15, alignKm: 8, guardKm0: 10, guardKmPerBn: 4, flankOff: 7, sampleKm: 4, tickMin: 30 };
function attachDoctrine(S) {
  const sc = S.sc, D = Object.assign({}, DOCTRINE, sc.doctrine || {});
  const fighting = u => u.active && !u.dead && u.cls !== 'hq' && u.mv !== 'ship';
  const centre = F => { let x = 0, y = 0, k = 0; for (const u of F.subs) if (fighting(u)) { x += u.x; y += u.y; k++; } return k ? [x / k, y / k] : null; };
  // a mobile division: most of its leading battalions ride in vehicles (armour, mechanised, or motorised infantry and reconnaissance)
  const mobile = F => { const L = F.subs.filter(u => fighting(u) && LEADCLS[u.cls]); return L.length && L.filter(u => u.cls === 'arm' || u.cls === 'mech' || u.mv !== 'foot').length / L.length > .6; };
  S.isMobile = mobile;
  const guardBns = F => F.subs.filter(u => fighting(u) && (u.cls === 'inf' || u.cls === 'mech' || u.cls === 'rec')).length;

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
  const prev = S.cmdHook; S.cmdHook = function () { if (prev) prev(); if (S.t - lastDev >= 60) { lastDev = S.t; devTick(); } if (S.t - last >= D.tickMin) { last = S.t; frontTick(); } };
  return S;
}
