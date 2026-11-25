// ===== TRANSPORT: administrative moves by road and rail behind the front =====
// A formation ordered to a distant objective first travels on the road or rail network while it is inside its own
// ground and clear of known enemy. Its commander picks the means (rail, truck or foot march) and a release point
// short of the expected contact. There the column leaves the network, forms up in an assembly area, and the existing
// engine takes over with the tactical order. A column that meets the enemy on the way deploys where it stands, at a cost.
// All speeds and times below are starting values for balance testing.
const TRANSPORT = {
  roadKmh: { 3: 22, 2: 14, 1: 9 },   // motor column average by road class, halts included
  footKmh: 4,                         // foot march average
  railKmh: 25,                        // train average
  nightRoad: .7,                      // blackout driving
  formMin: 30, unloadRoadMin: 20,     // forming the column; leaving it at the release point
  railLoadMin: 240, railUnloadMin: 180,
  minAdminKm: 12,                     // shorter moves stay tactical
  minRailKm: 30,                      // rail is not worth loading for less
  railFrontKm: 15,                    // trains unload at least this far from enemy-held ground: a move toward battle ends on foot or by road
  stationKm: 6, exitKm: 8,            // reach from a unit to a station or road, and from the release point to the road
  safetyKm: 6, safetySkillKm: 6,      // distance kept from known enemy: 6 km plus up to 6 km for a less skilled commander
  colKmMotor: .8, colKmFoot: .5,      // column length per unit
  caughtKm: 3,                        // enemy this close to the column head forces deployment
  approachKmh: 3,                     // planning figure for the tactical approach from the release point to the objective
  airHitPerHour: .12,                 // chance per daylight hour that a column under full enemy air threat is attacked
  airLossStr: [.02, .05], airLossCoh: .1, airDelayMin: [20, 40],
  airFbFull: 150,                     // enemy fighter-bombers available that make the threat total
  nightOnlyThreat: .5,                // German and Italian columns move only by night above this threat
  railCutEveryH: 6, railRepairH: [24, 48]   // interdiction cycle and repair time for a cut rail line
};
function attachTransport(S) {
  const map = S.map, sc = S.sc, T0 = TRANSPORT;
  // enemy-held ground within r km of a point (sampled every 2.5 km)
  const nearFoe = (s, x, y, r) => { for (let dy = -r; dy <= r; dy += 2.5) for (let dx = -r; dx <= r; dx += 2.5) { if (dx * dx + dy * dy > r * r) continue; const qx = x + dx, qy = y + dy; if (qx < 0 || qy < 0 || qx >= map.w || qy >= map.h) continue; const o = S.ownAt(qx, qy); if (o != null && o !== s && map.tAt(qx, qy) !== T.SEA) return true; } return false; };
  // ---------- the network ----------
  const net = { x: [], y: [], adj: [], kind: [], station: [], key: new Map() };
  const K = (x, y) => Math.round(x / .25) + ',' + Math.round(y / .25);
  function node(x, y, kind) {
    const k = K(x, y) + '|' + kind; let id = net.key.get(k); if (id != null) return id;
    id = net.x.length; net.key.set(k, id); net.x.push(x); net.y.push(y); net.adj.push([]); net.kind.push(kind); net.station.push(false); return id;
  }
  function link(a, b, cls) { if (a === b) return; const E = { len: Math.hypot(net.x[a] - net.x[b], net.y[a] - net.y[b]), cls, cut: false, repT: 0 }; net.adj[a].push({ to: b, len: E.len, cls, E }); net.adj[b].push({ to: a, len: E.len, cls, E }); }
  for (const r of map.roadLines || []) { let p = null; for (const q of r.pts) { const n = node(q[0], q[1], 'road'); if (p != null) link(p, n, r.cls); p = n; } }
  for (const line of sc.rails || []) { let p = null; for (const q of line) { const n = node(q[0], q[1], 'rail'); if (p != null) link(p, n, 'rail'); p = n; } }
  { // join loose ends of the same kind that sit within 0.35 km of each other (junctions drawn as separate lines)
    const B = new Map(), cell = .5; net.x.forEach((x, i) => { const k = Math.floor(x / cell) + ',' + Math.floor(net.y[i] / cell); (B.get(k) || B.set(k, []).get(k)).push(i); });
    for (let i = 0; i < net.x.length; i++) { const ci = Math.floor(net.x[i] / cell), cj = Math.floor(net.y[i] / cell);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of B.get((ci + a) + ',' + (cj + b)) || []) if (j > i && net.kind[j] === net.kind[i] && Math.hypot(net.x[i] - net.x[j], net.y[i] - net.y[j]) < .35 && !net.adj[i].some(e => e.to === j)) link(i, j, net.kind[i] === 'rail' ? 'rail' : 1); }
  }
  // railheads: a unit can load or unload anywhere on the line; stations (within 1.5 km of a town, or a line end) have ramps
  // and sidings, and away from them loading and unloading take half again as long
  for (let i = 0; i < net.x.length; i++) if (net.kind[i] === 'rail') net.station[i] = net.adj[i].length === 1 || (map.towns || []).some(t => Math.hypot(t.x - net.x[i], t.y - net.y[i]) < 1.5);
  S.net = net;
  const nearest = (x, y, kind, maxKm, filt) => { let b = -1, bd = maxKm; for (let i = 0; i < net.x.length; i++) if (net.kind[i] === kind && (!filt || filt(i))) { const d = Math.hypot(net.x[i] - x, net.y[i] - y); if (d < bd) { bd = d; b = i; } } return b; };
  // Dijkstra on travel time from node a through nodes passing ok(); returns the whole tree
  function tree(a, kmh, ok) {
    const n = net.x.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n), heap = [[0, a]]; dist[a] = 0;
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
    const push = v => { heap.push(v); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    while (heap.length) { const [d, u] = pop(); if (done[u]) continue; done[u] = 1;
      for (const e of net.adj[u]) { if (e.E.cut || (ok && !ok(e.to))) continue; const nd = d + e.len / kmh(e.cls); if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = u; push([nd, e.to]); } } }
    return { dist, prev };
  }
  function trace(t, b) { const nodes = []; for (let v = b; v >= 0; v = t.prev[v]) nodes.push(v); nodes.reverse(); let km = 0; for (let i = 1; i < nodes.length; i++) km += Math.hypot(net.x[nodes[i]] - net.x[nodes[i - 1]], net.y[nodes[i]] - net.y[nodes[i - 1]]); return { nodes, km, hours: t.dist[b] }; }
  // the reachable node closest to the target; among near-equals, the quicker one
  function bestExit(t, tx, ty) { let best = -1, bd = 1e9; for (let i = 0; i < net.x.length; i++) if (isFinite(t.dist[i])) { const d = Math.hypot(net.x[i] - tx, net.y[i] - ty); if (d < bd - .5 || (d < bd + .5 && best >= 0 && t.dist[i] < t.dist[best])) { if (d < bd) bd = d; best = i; } } return best; }
  // interdiction: cut every network link within r km of a point (bombed bridge, blown rail line); engineers reopen it after repairH hours
  S.cutNetwork = function (x, y, r, kind, repairH) { let n = 0; for (let i = 0; i < net.x.length; i++) if ((!kind || net.kind[i] === kind) && Math.hypot(net.x[i] - x, net.y[i] - y) < r) for (const e of net.adj[i]) if (!e.E.cut) { e.E.cut = true; e.E.repT = S.t + 60 * (repairH == null ? 36 : repairH); n++; } return n; };

  // ---------- planning a move ----------
  const cols = []; S.columns = cols;
  const alive = F => F.subs.filter(u => u.active && !u.dead);
  const centre = F => { const a = alive(F).filter(u => u.mv !== 'ship'); return a.length ? [a.reduce((s, u) => s + u.x, 0) / a.length, a.reduce((s, u) => s + u.y, 0) / a.length] : null; };
  const knownEnemy = (s) => S.subs.filter(e => e.s !== s && e.active && !e.dead && S.t - (e.seenT == null ? -1e9 : e.seenT) < 360);
  // threat from enemy fighter-bombers over a side's rear, 0 to 1; a scenario can set sides[s].airThreat directly
  S.airThreat = function (s) { const sd = sc.sides[s] || {}; if (sd.airThreat != null) return sd.airThreat; const A = S.air && S.air[1 - s]; if (!A) return 0;
    const fb = A.groups.filter(g => g.mission === 'cas' || g.mission === 'int').reduce((t, g) => t + (g.avail || 0), 0); return Math.min(1, fb / T0.airFbFull); };
  const inUse = (s, mode) => cols.filter(c => c.F.s === s && c.mode === mode && c.ph !== 'done').length;
  // the commander's plan: travel inside his own ground, clear of known enemy, to the network point nearest the objective
  S.planMove = function (F, path, line) {
    const from = centre(F); if (!from) return null;
    const L = line && line.length ? line : (path || []); if (!L.length) return null;
    const tx = L.reduce((a, q) => a + q[0], 0) / L.length, ty = L.reduce((a, q) => a + q[1], 0) / L.length, d0 = Math.hypot(tx - from[0], ty - from[1]);
    const safety = T0.safetyKm + T0.safetySkillKm * (1 - F.cmd.sk), foes = knownEnemy(F.s);
    if (foes.some(e => Math.hypot(e.x - from[0], e.y - from[1]) < safety)) return null;          // already near the enemy: tactical move
    const safe = i => S.ownAt(net.x[i], net.y[i]) === F.s && !foes.some(e => Math.hypot(e.x - net.x[i], e.y - net.y[i]) < .8 * safety);
    const side = sc.sides[F.s] || {}, a = alive(F), veh = a.filter(u => u.mv !== 'foot').length / Math.max(1, a.length);
    const motor = veh >= .6 || inUse(F.s, 'truck') < (side.trucks == null ? (F.nat === 'GE' || F.nat === 'IT' ? 0 : 2) : side.trucks);
    const kmh = motor ? (c => T0.roadKmh[c] || T0.roadKmh[1]) : (c => T0.footKmh * (c === 1 ? .9 : 1)), tacKmh = T0.approachKmh;
    let road = null; { const e0 = nearest(from[0], from[1], 'road', T0.stationKm);
      if (e0 >= 0) { const t = tree(e0, kmh, safe), e1 = bestExit(t, tx, ty);
        if (e1 >= 0 && d0 - Math.hypot(net.x[e1] - tx, net.y[e1] - ty) >= T0.minAdminKm) { const r = trace(t, e1); road = { mode: motor ? (veh >= .6 ? 'motor' : 'truck') : 'foot', r, rel: { x: net.x[e1], y: net.y[e1] }, from, kmh,
          hours: T0.formMin / 60 + r.hours + T0.unloadRoadMin / 60 + Math.hypot(net.x[e1] - tx, net.y[e1] - ty) / tacKmh }; } } }
    let rail = null; if ((sc.rails || []).length && inUse(F.s, 'rail') < (side.trains == null ? 2 : side.trains)) { const s0 = nearest(from[0], from[1], 'rail', T0.stationKm);
      if (s0 >= 0) { const t = tree(s0, () => T0.railKmh, safe), s1 = bestExit(t, tx, ty);
        if (s1 >= 0) { const r = trace(t, s1), ramps = net.station[s0] ? 1 : 1.5, rampsOut = net.station[s1] ? 1 : 1.5;
          if (r.km >= T0.minRailKm && d0 - Math.hypot(net.x[s1] - tx, net.y[s1] - ty) >= T0.minAdminKm && !nearFoe(F.s, net.x[s1], net.y[s1], T0.railFrontKm)) rail = { mode: 'rail', r, rel: { x: net.x[s1], y: net.y[s1] }, from, ramps, rampsOut,
            hours: (T0.railLoadMin * ramps + T0.railUnloadMin * rampsOut) / 60 + r.hours + Math.hypot(net.x[s1] - tx, net.y[s1] - ty) / tacKmh }; } } }
    if (rail && (!road || rail.hours < road.hours)) return rail;
    return road;
  };

  // ---------- running a move ----------
  const issueTactical = S.issueOrder;   // the engine's own order routine
  S.issueOrder = function (F, path, line, opt) {
    opt = opt || {}; if (opt.tactical || !F.active || F.dead) return issueTactical(F, path, line, opt);
    const old = cols.find(c => c.F === F && c.ph !== 'done'); if (old) { old.ph = 'done'; }
    const plan = S.planMove(F, path, line); if (!plan) return issueTactical(F, path, line, opt);
    const a = alive(F), nMotor = a.filter(u => u.mv !== 'foot').length, staff = (25 + 70 * (1 - F.cmd.sk)) * (1 + (S.rnd() - .3) * .25);
    const walk = Math.hypot(net.x[plan.r.nodes[0]] - plan.from[0], net.y[plan.r.nodes[0]] - plan.from[1]) / (plan.mode === 'foot' ? T0.footKmh : 15) * 60;
    const prep = staff + walk + (plan.mode === 'rail' ? T0.railLoadMin * (1.25 - .5 * F.cmd.sk) * plan.ramps : T0.formMin);
    const poly = plan.r.nodes.map(i => [net.x[i], net.y[i]]);
    const nightOnly = plan.mode !== 'rail' && (F.nat === 'GE' || F.nat === 'IT') && S.airThreat(F.s) >= T0.nightOnlyThreat;
    const C = { F, mode: plan.mode, nightOnly, pauseT: 0, rampsOut: plan.rampsOut || 1, poly, L: plan.r.km, head: 0, ph: 'prep', tEnd: S.t + prep, rel: plan.rel, path, line, opt, kmh: plan.kmh,
      len: a.reduce((s, u) => s + BW(u), 0) * (plan.mode === 'rail' ? 0 : nMotor / Math.max(1, a.length) >= .6 || plan.mode === 'truck' ? T0.colKmMotor : T0.colKmFoot), t0: S.t };
    cols.push(C);
    for (const u of a) { u.active = false; u.goal = null; u.path = null; u.needPath = false; u.slot = null; }
    F.active = false; F.order = null; F.transit = C;
    const how = { rail: 'by rail', motor: 'by road, motorized', truck: 'by road in attached trucks', foot: 'by road on foot' }[plan.mode];
    F.status = 'Preparing to move ' + how + ' (' + Math.round(prep) + ' min)';
    S.say(F, 'Moving ' + how + (nightOnly ? ' by night only, for fear of fighter-bombers' : '') + ', ' + plan.r.km.toFixed(0) + ' km, to a release point ' + S.nearTown(plan.rel.x, plan.rel.y) + '.', 1, plan.rel.x, plan.rel.y);
    return prep;
  };
  const at = (C, s) => polyAt(C.poly, Math.max(0, Math.min(C.L, s)));
  function deploy(C, x, y, caught) {
    const F = C.F; C.ph = 'done'; F.transit = null; F.active = true;
    const a = F.subs.filter(u => !u.dead), ang = Math.atan2(y - C.poly[0][1], x - C.poly[0][0]); let k = 0;
    for (const u of a) { const r = .4 + .35 * Math.floor(k / 4), th = ang + Math.PI / 2 + (k % 4 - 1.5) * .6, p = map.snap(u.mvi, x + Math.cos(th) * r - Math.cos(ang) * .3 * Math.floor(k / 4), y + Math.sin(th) * r - Math.sin(ang) * .3 * Math.floor(k / 4), 3) || [x, y];
      u.x = p[0]; u.y = p[1]; u.active = true; u.goal = null; u.path = null; u.needPath = false; u.state = 'ok'; u.hx = Math.cos(ang); u.hy = Math.sin(ang);
      if (caught) u.coh = Math.max(.2, u.coh - .3); else if (C.mode === 'rail') u.coh = Math.min(u.coh, .9); k++; }
    if (caught) { F.dis = Math.min(1, (F.dis || 0) + .4); S.say(F, 'Caught on the march ' + S.nearTown(x, y) + ': deploying from column under pressure.', 2, x, y); }
    else S.say(F, 'Arrived at the release point ' + S.nearTown(x, y) + ' and formed up in the assembly area.', 1, x, y);
    issueTactical(F, C.path || [], C.line, Object.assign({}, C.opt, caught ? {} : { free: true }));
  }
  let nextCut = T0.railCutEveryH * 60, nextRepair = 60;
  function interdict() {
    // each side with an interdiction priority (sides[s].interdict, 0 to 1) cuts rail lines in enemy-held ground every few hours
    for (let s = 0; s < 2; s++) { const k = Math.round(((sc.sides[s] || {}).interdict || 0) * 2); if (!k) continue;
      const targets = []; for (let i = 0; i < net.x.length; i++) if (net.kind[i] === 'rail' && S.ownAt(net.x[i], net.y[i]) !== s && !net.adj[i].every(e => e.E.cut)) targets.push(i);
      for (let j = 0; j < k && targets.length; j++) { const i = targets.splice(Math.floor(S.rnd() * targets.length), 1)[0], h = T0.railRepairH[0] + S.rnd() * (T0.railRepairH[1] - T0.railRepairH[0]);
        if (S.cutNetwork(net.x[i], net.y[i], .3, 'rail', h)) S.say(s, 'Air interdiction: rail line cut ' + S.nearTown(net.x[i], net.y[i]) + '.', 1, net.x[i], net.y[i]); } }
  }
  function repair() { for (const list of net.adj) for (const e of list) if (e.E.cut && e.E.repT && S.t >= e.E.repT) { e.E.cut = false; e.E.repT = 0; } }
  function tick(dt) {
    const night = S.night;
    if (S.t >= nextCut) { nextCut += T0.railCutEveryH * 60; interdict(); }
    if (S.t >= nextRepair) { nextRepair += 60; repair(); }
    for (const C of cols) {
      if (C.ph === 'done') continue;
      if (C.ph === 'prep') { if (S.t >= C.tEnd) { C.ph = 'move'; C.F.status = 'On the move (' + C.mode + ')'; } continue; }
      if (C.ph === 'move') {
        const p = at(C, C.head), foes = S.subs.some(e => e.s !== C.F.s && e.active && !e.dead && e.mv !== 'ship' && Math.hypot(e.x - p.x, e.y - p.y) < T0.caughtKm);
        if (foes && C.mode !== 'rail') { deploy(C, p.x, p.y, true); continue; }
        if (S.t < C.pauseT) continue;
        if (C.nightOnly && !night) { if (C.F.status.indexOf('cover') < 0) C.F.status = 'Halted under cover until dark'; continue; } else if (C.F.status.indexOf('cover') >= 0) C.F.status = 'On the move (' + C.mode + ')';
        // fighter-bombers find columns on the move by day in flying weather; trains less often
        const fly = !night && (S.wx === 'clear' || S.wx === 'cloud'), thr = fly ? S.airThreat(C.F.s) * (C.mode === 'rail' ? .5 : 1) : 0;
        if (thr > 0 && S.rnd() < T0.airHitPerHour * thr * dt / 60) {
          let lost = 0; for (const u of C.F.subs) if (!u.dead) { const d = T0.airLossStr[0] + S.rnd() * (T0.airLossStr[1] - T0.airLossStr[0]); lost += Math.min(u.str, d) * u.size; u.str = Math.max(.12, u.str - d); u.coh = Math.max(.2, u.coh - T0.airLossCoh); }
          if (S.losses) S.losses[C.F.s] += lost; C.pauseT = S.t + T0.airDelayMin[0] + S.rnd() * (T0.airDelayMin[1] - T0.airDelayMin[0]); C.airHits = (C.airHits || 0) + 1;
          S.say(C.F, 'Column attacked by fighter-bombers ' + S.nearTown(p.x, p.y) + '; vehicles burning, the march is delayed.', 2, p.x, p.y); continue; }
        let kmh; if (C.mode === 'rail') kmh = T0.railKmh; else { const e = nearestEdgeCls(C, C.head); kmh = C.kmh(e) * (night ? T0.nightRoad : 1); }
        const share = cols.filter(o => o !== C && o.ph === 'move' && o.mode !== 'rail' && C.mode !== 'rail' && Math.hypot(at(o, o.head).x - p.x, at(o, o.head).y - p.y) < 2).length;
        C.head += kmh / 60 * dt / (1 + .5 * share);
        if (C.head >= C.L + C.len) { C.ph = 'unload'; C.tEnd = S.t + (C.mode === 'rail' ? T0.railUnloadMin * C.rampsOut : T0.unloadRoadMin); C.F.status = 'Leaving the column at the release point'; }
        continue;
      }
      if (C.ph === 'unload' && S.t >= C.tEnd) deploy(C, C.rel.x, C.rel.y, false);
    }
  }
  function nearestEdgeCls(C, s) { const p = at(C, s), i = nearest(p.x, p.y, 'road', 1); if (i < 0) return 1; let c = 1; for (const e of net.adj[i]) if (typeof e.cls === 'number' && e.cls > c) c = e.cls; return c; }
  // positions of every unit strung out along its column, for the map display
  S.columnUnits = function () { const out = []; for (const C of cols) if (C.ph === 'move') { const a = C.F.subs.filter(u => !u.dead); a.forEach((u, k) => { const q = at(C, C.head - k * (C.len / Math.max(1, a.length))); out.push({ u, x: q.x, y: q.y, mode: C.mode }); }); } return out; };
  // every column for the map display: its phase, the head's distance along the route, and a function giving the point at a distance
  S.columnView = function () { return cols.map(C => ({ F: C.F, s: C.F.s, mode: C.mode, ph: C.ph, head: C.head, L: C.L, len: C.len, at: d => at(C, d) })); };
  const prevHook = S.cmdHook; S.cmdHook = function () { if (prevHook) prevHook(); tick(S.lastDt || 1); };
  return S;
}
