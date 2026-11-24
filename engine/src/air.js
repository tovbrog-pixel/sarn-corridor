// ===== AIR BASES AND AIR TRANSPORT at theater scale =====
// Airfields have a capacity and a condition. Engineers build advanced landing grounds in their own ground; airfields overrun by
// the enemy are lost, and the captor's engineers repair them. Air commanders move groups forward to fields nearer the front,
// since every kilometre flown to the target costs time over it. A troop carrier fleet of transport aircraft is shared by airborne
// lifts, air supply drops and airlifts of supply to forward airfields. Airborne divisions drop, fight, then withdraw to refit.
// All numbers below are starting values for balance testing.
const AIR = {
  acPerBn: { para: 36, glider: 40, art: 30, other: 20 },   // transport aircraft (with gliders where needed) to lift one battalion
  acPerDrop: 40,                    // aircraft for one supply drop mission
  supplyPerAc: .2,                  // supply units an aircraft lands at a forward airfield
  turnH: 24,                        // one lift per aircraft per day
  prepH: 6,                         // briefing and loading before the first lift
  refitDays: 14,                    // an airborne division withdrawn to England before it can drop again
  buildH: 72, repairH: 36,          // engineer-battalion hours to build a landing ground or repair a captured field
  engKm: 3,                         // engineers this close to the site count
  algCap: 3,                        // air groups a landing ground can base
  lostOnGround: .3,                 // share of a group's aircraft lost when its field is overrun
  rebaseH: 24, rebaseEveryH: 6, rebaseGainKm: 40,           // a group moves to a field at least 40 km nearer the front; 24 hours out of action
  minCond: .5, rebaseCond: .8       // condition to fly from a field, and to move a group onto it
};
function attachAir(S) {
  const sc = S.sc, map = S.map, A0 = AIR;
  const onMap = b => b.x >= 0 && b.y >= 0 && b.x <= map.w && b.y <= map.h;
  for (let s = 0; s < 2; s++) for (const b of S.air[s].bases) { if (b.cap == null) b.cap = onMap(b) ? A0.algCap * 2 : 99; if (b.cond == null) b.cond = 1; if (!b.kind) b.kind = onMap(b) ? 'field' : 'offmap'; }
  const sites = [];
  const at = (s, i) => S.air[s].groups.filter(g => g.base === i);
  // where the fighting is for a side: the centre of its battalions in contact, else of all its battalions
  function frontRef(s) { let x = 0, y = 0, n = 0; for (const u of S.subs) if (u.s === s && u.active && !u.dead && u.ned < 5) { x += u.x; y += u.y; n++; }
    if (!n) for (const u of S.subs) if (u.s === s && u.active && !u.dead) { x += u.x; y += u.y; n++; } return n ? [x / n, y / n] : [map.w / 2, map.h / 2]; }
  const engNear = (s, x, y) => S.subs.filter(u => u.s === s && u.cls === 'eng' && u.active && !u.dead && !u.moving && u.coh > .4 && Math.hypot(u.x - x, u.y - y) < A0.engKm).length;

  // ---------- airfields ----------
  const planned = new Set();
  S.buildAirfield = function (s, x, y, n) { if (S.ownAt(x, y) !== s) return null; const q = { s, x, y, n: n || 'Landing ground ' + S.nearTown(x, y), prog: 0, repair: null }; sites.push(q); S.say(s, 'Engineers to build ' + q.n + '.', 1, x, y); return q; };
  function fieldsTick() {   // hourly
    // fields a scenario schedules by their historical opening dates: each opens on its date once its side holds the site
    for (let i = 0; i < (sc.fieldPlan || []).length; i++) { const P = sc.fieldPlan[i]; if (planned.has(i) || S.t < P.t * 60 || S.ownAt(P.x, P.y) !== P.s) continue; planned.add(i);
      S.air[P.s].bases.push({ s: P.s, n: P.n, x: P.x, y: P.y, cap: A0.algCap, cond: 1, kind: 'alg', hist: P.hist }); S.say(P.s, P.n + ' is open for aircraft.', 0, P.x, P.y); }
    for (const q of sites) { if (q.done || q.lost) continue;
      if (S.ownAt(q.x, q.y) !== q.s) { q.lost = true; S.say(q.s, q.n + ' abandoned: the enemy holds the site.', 1, q.x, q.y); continue; }
      const e = engNear(q.s, q.x, q.y); if (!e) continue;
      if (q.repair) { q.repair.cond = Math.min(1, q.repair.cond + e * .8 / A0.repairH); if (q.repair.cond >= 1) { q.done = true; S.say(q.s, q.repair.n + ' repaired and in full use.', 1, q.x, q.y); } continue; }
      q.prog += e / A0.buildH; if (q.prog >= 1) { q.done = true; S.air[q.s].bases.push({ s: q.s, n: q.n, x: q.x, y: q.y, cap: A0.algCap, cond: 1, kind: 'alg' }); S.say(q.s, q.n + ' is ready for aircraft.', 1, q.x, q.y); } }
    // fields overrun by the enemy
    for (let s = 0; s < 2; s++) { const B = S.air[s].bases;
      B.forEach((b, i) => { if (b.dead || !onMap(b) || S.ownAt(b.x, b.y) === s) return; b.dead = true;
        S.say(s, b.n + ' overrun by the enemy.', 2, b.x, b.y);
        for (const g of at(s, i)) { const lost = Math.round(g.avail * A0.lostOnGround); g.avail -= lost; g.total -= lost; const j = nearestBase(s, b.x, b.y, g); if (j >= 0) { g.base = j; g.next = S.t + A0.rebaseH * 60; S.say(s, g.n + ' lost ' + lost + ' aircraft on the ground and fell back to ' + B[j].n + '.', 2); } }
        const nb = { s: 1 - s, n: b.n + ' (captured)', x: b.x, y: b.y, cap: b.cap, cond: .2, kind: 'captured' }; S.air[1 - s].bases.push(nb);
        sites.push({ s: 1 - s, x: b.x, y: b.y, n: nb.n, repair: nb }); S.say(1 - s, b.n + ' captured; engineers needed to repair it.', 1, b.x, b.y); }); }
  }
  function nearestBase(s, x, y, g) { const B = S.air[s].bases; let best = -1, bd = 1e9; B.forEach((b, i) => { if (b.dead || b.cond < A0.minCond || (at(s, i).length >= b.cap && !(g && g.base === i))) return; const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = i; } }); return best; }
  // air commander: move groups forward to fields with room, nearer the fighting
  function rebaseTick() {
    for (let s = 0; s < 2; s++) { const A = S.air[s], fr = frontRef(s);
      for (const g of A.groups) { if (S.t < g.next || g.mission === 'rec') continue; const cur = A.bases[g.base], dc = Math.hypot(cur.x - fr[0], cur.y - fr[1]);
        let best = -1, bd = dc - A0.rebaseGainKm; A.bases.forEach((b, i) => { if (i === g.base || b.dead || b.cond < A0.rebaseCond || at(s, i).length >= b.cap) return; const d = Math.hypot(b.x - fr[0], b.y - fr[1]); if (d < bd) { bd = d; best = i; } });
        if (best >= 0) { g.base = best; g.next = S.t + A0.rebaseH * 60; S.say(s, g.n + ' moving to ' + A.bases[best].n + ', ' + Math.round(dc - bd) + ' km nearer the front; out of action for a day.', 1); } } }
  }
  function groundTick() { for (let s = 0; s < 2; s++) { const A = S.air[s]; for (const g of A.groups) { const b = A.bases[g.base]; if (b && (b.dead || b.cond < A0.minCond) && g.next < S.t + 10) g.next = S.t + 10; } } }   // no flying from a wrecked field

  // ---------- troop carrier fleet ----------
  const fleet = [0, 1].map(s => { const t = (sc.sides[s] || {}).transport; return t ? { total: t.aircraft, avail: t.aircraft, pend: [], lastLeft: null } : null; });
  S.fleet = fleet;
  function useAc(s, n) { const F = fleet[s]; F.avail -= n; F.pend.push({ t: S.t + A0.turnH * 60, n }); }
  function fleetTick() {
    for (let s = 0; s < 2; s++) { const F = fleet[s]; if (!F) continue;
      for (let i = F.pend.length - 1; i >= 0; i--) if (S.t >= F.pend[i].t) { F.avail += F.pend[i].n; F.pend.splice(i, 1); }
      // the engine's supply-drop missions draw on the same aircraft
      const L = S.lift[s]; if (F.lastLeft != null && L.left < F.lastLeft) useAc(s, (F.lastLeft - L.left) * A0.acPerDrop);
      L.left = L.day = Math.max(0, Math.floor(F.avail / A0.acPerDrop)); F.lastLeft = L.left; }
  }
  const need = u => u.k && /para/i.test(u.k.n) ? A0.acPerBn.para : /Glider|Airlanding/i.test(u.k.n || '') ? A0.acPerBn.glider : u.cls === 'art' ? A0.acPerBn.art : A0.acPerBn.other;
  const ops = [];
  const badWx = () => ['fog', 'rain', 'snow', 'dust'].indexOf(S.wx) >= 0;
  // launch an airborne operation: formation F (in England) drops on x, y; lifts follow day by day as aircraft allow
  S.airborneOp = function (F, x, y, opt) {
    opt = opt || {}; const s = F.s, FL = fleet[s]; if (!FL) return { ok: false, why: 'no troop carrier fleet' };
    if (F.active && !F.dead) return { ok: false, why: F.n + ' is in action; withdraw it first' };
    if (F.refitT && S.t < F.refitT) return { ok: false, why: F.n + ' is refitting until ' + S.clock(F.refitT) };
    const order = F.subs.filter(u => !u.dead).sort((a, b) => (a.cls === 'hq' ? -1 : 0) - (b.cls === 'hq' ? -1 : 0) || (LEADCLS[b.cls] ? 1 : 0) - (LEADCLS[a.cls] ? 1 : 0));
    const op = { F, x, y, queue: order.slice(), lift: 0, t: S.t + A0.prepH * 60, night: !!opt.night }; ops.push(op);
    F.arr = null; F.trans = false; F.active = false; for (const u of F.subs) { u.active = false; u.goal = null; u.path = null; }
    F.status = 'Preparing for the airborne lift'; S.say(F, 'Airborne operation ordered: drop near ' + S.nearTown(x, y) + '. First lift in ' + A0.prepH + ' hours.', 1, x, y);
    return { ok: true, aircraftNeeded: order.reduce((t, u) => t + need(u), 0), available: FL.avail };
  };
  function opsTick() {
    for (const op of ops) { if (op.done || S.t < op.t) continue; const F = op.F, FL = fleet[F.s];
      if (badWx() || (!op.night && S.night)) { op.t = S.t + 80; F.status = 'Lift ' + (op.lift + 1) + ' postponed: ' + (badWx() ? WXNAME[S.wx].toLowerCase() : 'darkness'); continue; }
      const batch = []; let used = 0; while (op.queue.length && used + need(op.queue[0]) <= FL.avail) { const u = op.queue.shift(); used += need(u); batch.push(u); }
      if (!batch.length) { op.t = S.t + 60; F.status = 'Waiting for transport aircraft'; continue; }
      useAc(F.s, used); op.lift++;
      let k = 0; for (const u of batch) { const a = S.rnd() * 6.283, r = .4 + S.rnd() * 1.8 + k * .05, p = map.snap(u.mvi, op.x + Math.cos(a) * r, op.y + Math.sin(a) * r, 4) || [op.x, op.y];
        u.x = p[0]; u.y = p[1]; u.active = true; u.coh = Math.min(u.coh, .8); u.state = 'ok'; u.goal = null; u.path = null; k++; }
      F.active = true; F.x = op.x; F.y = op.y;
      S.say(F, 'Lift ' + op.lift + ' down near ' + S.nearTown(op.x, op.y) + ': ' + batch.length + ' units, ' + used + ' aircraft.' + (op.queue.length ? ' ' + op.queue.length + ' units wait for the next lift.' : ' The whole division is on the ground.'), 1, op.x, op.y);
      F.status = op.queue.length ? 'On the ground, more lifts to come' : 'On the ground and assembling';
      if (op.queue.length) op.t = S.t + A0.turnH * 60; else op.done = true; }
  }
  // take an airborne division out of the line to refit in England
  S.withdrawToRefit = function (F) { F.active = false; F.order = null; for (const u of F.subs) { u.active = false; u.goal = null; u.path = null; } F.refitT = S.t + A0.refitDays * 1440; F.refitting = true; F.status = 'Refitting in England'; S.say(F, 'Withdrawn to refit in England; ready again ' + S.clock(F.refitT) + '.', 1); };
  function refitTick() { for (const F of S.forms) if (F.refitting && S.t >= F.refitT) { F.refitting = false; for (const u of F.subs) if (!u.dead) { u.str = Math.max(u.str, .9); u.coh = 1; } F.status = 'Ready for an airborne operation'; S.say(F, 'Refit complete; ready for an airborne operation.', 1); } }
  // land supply at a forward airfield; it becomes a supply source there
  S.airlift = function (s, x, y, aircraft) {
    const FL = fleet[s]; if (!FL) return false; const B = S.air[s].bases, i = B.findIndex(b => !b.dead && b.cond >= A0.minCond && Math.hypot(b.x - x, b.y - y) < 3); if (i < 0) return false;
    const n = Math.min(aircraft, FL.avail); if (n < 1) return false; useAc(s, n);
    let q = S.src[s].find(q => q.airlift && q.base === B[i]); if (!q) { q = { s, n: 'Airlift, ' + B[i].n, x: B[i].x, y: B[i].y, stock: 0, cap: 0, rate: 0, captured: false, t: 0, dropT: 0, airlift: true, base: B[i] }; S.src[s].push(q); }
    q.stock += n * A0.supplyPerAc; q.cap = Math.max(q.cap, q.stock); S.say(s, n + ' transport aircraft landed supply at ' + B[i].n + '.', 1, x, y); return n;
  };
  let nextH = 60, nextRebase = A0.rebaseEveryH * 60;
  const prevHook = S.cmdHook;
  S.cmdHook = function () { if (prevHook) prevHook(); if (S.sc.hHour && S.t < S.sc.hHour * 60) return; fleetTick(); opsTick(); groundTick();
    if (S.t >= nextH) { nextH += 60; fieldsTick(); refitTick(); } if (S.t >= nextRebase) { nextRebase += A0.rebaseEveryH * 60; rebaseTick(); } };
  S.airSites = sites; S.airOps = ops; S.frontRef = frontRef;
  return S;
}
