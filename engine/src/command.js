// ===== COMMAND LAYER: corps and armies above the formations =====
// A command node holds formations (divisions) or other command nodes (corps under an army).
// The player, or a superior's AI, draws one line of advance and one objective line for the node.
// The node's commander takes staff time to plan, splits the objective line into sectors left to right,
// keeps a reserve when his style calls for it, and passes each child a parallel line of advance, so sister
// formations do not cross each other's routes. Children then plan their own orders as before.
// review settings, all starting values for balance testing
const CMDAI = { spentFrac: .45, spentCoh: .3, stallMin: 180, onObjKm: 1.5, coolMin: 120 };
function attachCommand(S) {
  const nodes = []; S.commands = nodes; const sc = S.sc;
  const segOf = (line, a, b) => {           // the part of polyline `line` between distances a and b
    const out = [], A = polyAt(line, a); out.push([A.x, A.y]); let acc = 0;
    for (let i = 1; i < line.length; i++) { acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]); if (acc > a && acc < b) out.push([line[i][0], line[i][1]]); }
    const B = polyAt(line, b); out.push([B.x, B.y]); return out;
  };
  function pos(n) {                         // where a node stands: the centre of its children's fighting units
    if (n.forms) { let x = 0, y = 0, k = 0; for (const F of n.forms) { const p = pos(F); if (p) { x += p[0]; y += p[1]; k++; } } return k ? [x / k, y / k] : null; }
    let x = 0, y = 0, k = 0; for (const u of n.subs) if (u.active && !u.dead && u.cls !== 'hq' && u.mv !== 'ship') { x += u.x; y += u.y; k++; } return k ? [x / k, y / k] : null;
  }
  function weight(n) {                      // frontage a child can hold: its fighting units still in being
    if (n.forms) return n.forms.reduce((s, c) => s + weight(c), 0);
    return n.subs.filter(u => (u.active || n.transit) && !u.dead && LEADCLS[u.cls]).length * (n.dead ? 0 : 1);
  }
  const live = n => n.forms ? n.forms.some(live) : !n.dead && (!!n.transit || n.subs.some(u => u.active && !u.dead));   // a division on the move by road or rail is alive though off the map

  // create a command node: { n, s, cmd: { n, ag, sk }, forms: [formations or nodes], parent }
  S.mkCommand = function (o) { const C = Object.assign({ id: nodes.length, order: null, status: 'No orders', log: [] }, o); for (const c of C.forms) c.parent = C; nodes.push(C); return C; };

  // plan the split of one order across the node's children. Returns [{ child, path, line, reserve }].
  S.planCommandOrder = function (C, path, line, opt) {
    opt = opt || {}; const kids = C.forms.filter(live); if (!kids.length || !line || line.length < 2) return [];
    const p0 = pos(C) || line[0], L = polyLen(line), mid = polyAt(line, L / 2);
    let ax = mid.x - p0[0], ay = mid.y - p0[1]; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
    const px = -ay, py = ax;                 // left-hand perpendicular of the axis of advance
    // the objective line runs left to right as the commander faces it
    const side = (q) => (q[0] - mid.x) * px + (q[1] - mid.y) * py;
    const ln = side(line[0]) >= side(line[line.length - 1]) ? line.slice() : line.slice().reverse();
    // children ordered left to right by where they stand now, so assignments do not cross
    const at = kids.map(c => ({ c, p: pos(c) || p0 })).sort((a, b) => ((b.p[0] - p0[0]) * px + (b.p[1] - p0[1]) * py) - ((a.p[0] - p0[0]) * px + (a.p[1] - p0[1]) * py));
    // a reserve: cautious commanders hold one child back when they have three or more
    const ag = C.cmd ? C.cmd.ag : .5; let reserve = null;
    if (opt.reserve !== false && at.length >= 3 && (opt.reserve === true || ag < .65)) {
      let ri = 0, bw = 1e9; at.forEach((o, i) => { const w = weight(o.c); if (i > 0 && i < at.length - 1 && w < bw) { bw = w; ri = i; } }); if (!ri) ri = Math.floor(at.length / 2);
      reserve = at.splice(ri, 1)[0];
    }
    const W = at.reduce((s, o) => s + Math.max(1, weight(o.c)), 0); let acc = 0; const out = [];
    const P = (path && path.length ? path : []).filter(q => q);
    for (const o of at) {
      const w = Math.max(1, weight(o.c)), a = acc / W * L, b = (acc + w) / W * L; acc += w;
      const seg = segOf(ln, a, b), sm = polyAt(ln, (a + b) / 2), off = side([sm.x, sm.y]);
      const cp = P.map(q => [q[0] + px * off, q[1] + py * off]);          // corps route shifted to the child's sector
      out.push({ child: o.c, path: cp, line: seg, reserve: false });
    }
    if (reserve) {                           // reserve keeps its own lane, parallel to its neighbours, and halts 6 km short of the objective
      const roff = Math.max(-L / 2, Math.min(L / 2, (reserve.p[0] - p0[0]) * px + (reserve.p[1] - p0[1]) * py)), hw = 1.5;
      const bx = mid.x - ax * 6 + px * roff, by = mid.y - ay * 6 + py * roff;
      out.push({ child: reserve.c, path: P.map(q => [q[0] + px * roff, q[1] + py * roff]), line: [[bx + px * hw, by + py * hw], [bx - px * hw, by - py * hw]], reserve: true });
    }
    return out;
  };

  // issue an order to a node: staff time first, then the children receive theirs
  S.issueCommandOrder = function (C, path, line, opt) {
    opt = opt || {}; const sk = C.cmd ? C.cmd.sk : .6, lvl = C.level === 'army' ? 1.5 : 1;
    const delay = opt.free ? 0 : (40 + 80 * (1 - sk)) * lvl * (1 + (S.rnd() - .3) * .25);
    C.order = { path: path || [], line, opt, t0: S.t + delay, st: 'pending' };
    C.status = delay ? (C.level === 'army' ? 'Army' : 'Corps') + ' staff planning (' + Math.round(delay) + ' min)' : 'Orders passed down';
    if (!delay) release(C); return delay;
  };
  function release(C) {
    const O = C.order; O.st = 'issued'; const plan = S.planCommandOrder(C, O.path, O.line, O.opt);
    for (const q of plan) send(q.child, q.path, q.line, O.opt, q.reserve);
    O.plan = plan.map(q => ({ child: q.child, path: q.path, line: q.line, reserve: q.reserve, w0: weight(q.child), best: 1e9, tBest: S.t }));
    O.nextReview = S.t + 60; O.lastAct = -1e9;
    C.status = 'Orders passed to ' + plan.length + (plan.some(q => q.reserve) ? ', one in reserve' : '');
    report(C, 'orders passed to ' + plan.map(q => q.child.n + (q.reserve ? ' (reserve)' : '')).join(', ') + '.');
  }
  function send(child, path, line, opt, reserve, then) {
    const o = Object.assign({}, opt, reserve ? { then: 'reserve' } : {}, then ? { then } : {}); delete o.reserve;
    if (child.forms) S.issueCommandOrder(child, path, line, o); else S.issueOrder(child, path, line, o);
  }
  function report(C, txt, lvl) { C.log.push({ t: S.t, txt }); S.say(C.s, C.n + ': ' + txt, lvl || 1); }
  const lineDist = (n, line) => { const p = pos(n); if (!p) return 1e9; let b = 1e9; for (let i = 1; i < line.length; i++) { const ax = line[i - 1][0], ay = line[i - 1][1], dx = line[i][0] - ax, dy = line[i][1] - ay, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)); b = Math.min(b, Math.hypot(p[0] - ax - dx * t, p[1] - ay - dy * t)); } return b; };
  const cohOf = n => { if (n.forms) { const k = n.forms.filter(live); return k.length ? k.reduce((s, c) => s + cohOf(c), 0) / k.length : 0; } const L = n.subs.filter(u => (u.active || n.transit) && !u.dead && LEADCLS[u.cls]); return L.length ? L.reduce((s, u) => s + u.coh, 0) / L.length : 0; };
  // the commander's review every half hour of an order in progress: spent or stalled divisions, the reserve, losses
  function review(C) {
    const O = C.order, P = O.plan; if (!P) return; O.nextReview = S.t + 30;
    for (const q of P) { if (q.reserve || !live(q.child)) continue; const d = lineDist(q.child, q.line); if (d < q.best - .5) { q.best = d; q.tBest = S.t; } }
    if (S.t - O.lastAct < CMDAI.coolMin) return;
    const fwd = P.filter(q => !q.reserve), res = P.find(q => q.reserve && live(q.child) && weight(q.child) >= CMDAI.spentFrac * q.w0);
    const moving = n => n.forms ? n.forms.some(moving) : !!n.transit;
    const state = q => { if (!live(q.child)) return 'lost'; if (moving(q.child)) { q.tBest = S.t; return 'ok'; } if (weight(q.child) < CMDAI.spentFrac * q.w0 || cohOf(q.child) < CMDAI.spentCoh) return 'spent';
      const d = lineDist(q.child, q.line); if (d < CMDAI.onObjKm) return 'done'; if (S.t - q.tBest > CMDAI.stallMin && S.t - O.t0 > CMDAI.stallMin) return 'stalled'; return 'ok'; };
    // 1. commit the reserve where a forward division is spent or stalled
    const bad = fwd.map(q => ({ q, st: state(q) })).find(o => o.st === 'spent' || o.st === 'stalled' || o.st === 'lost');
    if (bad && res) {
      const q = bad.q; send(res.child, res.path.length ? res.path : q.path, q.line, O.opt, false);
      res.reserve = false; res.line = q.line; res.best = 1e9; res.tBest = S.t; res.w0 = weight(res.child);
      if (bad.st !== 'lost') { const L = polyLen(q.line), m = polyAt(q.line, L / 2), p0 = pos(C) || [m.x, m.y], dx = m.x - p0[0], dy = m.y - p0[1], dl = Math.hypot(dx, dy) || 1, bx = m.x - dx / dl * 6, by = m.y - dy / dl * 6, hw = 1.5;
        send(q.child, [], [[bx - dy / dl * hw, by + dx / dl * hw], [bx + dy / dl * hw, by - dx / dl * hw]], O.opt, false, 'rest'); q.reserve = true; q.w0 = Math.max(weight(q.child), 1); }
      else P.splice(P.indexOf(q), 1);
      O.lastAct = S.t; report(C, q.child.n + ' is ' + bad.st + '; ' + res.child.n + ' committed from reserve to take over its sector.', 2); return;
    }
    // 2. a forward division lost with no reserve: spread the line among those left
    if (bad && bad.st === 'lost') { O.lastAct = S.t; report(C, bad.q.child.n + ' is lost; sectors redrawn among the remaining divisions.', 2);
      const plan = S.planCommandOrder(C, O.path, O.line, Object.assign({}, O.opt, { reserve: false }));
      for (const r of plan) send(r.child, r.path, r.line, O.opt, false);
      O.plan = plan.map(r => ({ child: r.child, path: r.path, line: r.line, reserve: false, w0: weight(r.child), best: 1e9, tBest: S.t })); return; }
    // 3. report when every forward division stands on the objective
    if (fwd.length && fwd.every(q => state(q) === 'done') && !O.doneSaid) { O.doneSaid = true; C.status = 'On the objective'; report(C, 'all divisions on the objective.'); }
  }
  // corps a scenario defines (sc.commands), and the dates divisions join them (sc.cmdPlan: { t: hours, f: division name, c: command id })
  const byId = {}; for (const c of sc.commands || []) byId[c.id] = S.mkCommand({ n: c.n, s: c.s, level: c.level || 'corps', cmd: Object.assign({ ag: .5, sk: .6 }, c.cmd), forms: [], key: c.id });
  const plan = (sc.cmdPlan || []).slice().sort((a, b) => a.t - b.t); let pi = 0; const fByN = {}; for (const F of S.forms) fByN[F.n] = F;
  function planTick() { while (pi < plan.length && plan[pi].t * 60 <= S.t) { const q = plan[pi++], F = q.f.startsWith('cmd:') ? byId[q.f.slice(4)] : fByN[q.f], C = byId[q.c];   // 'cmd:<id>' moves a corps between armies if (!F || !C || F.parent === C) continue;
      if (F.parent && F.parent.forms) { const i = F.parent.forms.indexOf(F); if (i >= 0) F.parent.forms.splice(i, 1); } C.forms.push(F); F.parent = C; if (S.t > 0) S.say(F.s, F.n + ' now under ' + C.n + '.', 0); } }
  planTick();
  // scheduled corps orders for the side the computer plays (sc.corpsPlan: { t: hours, c: command id, line: [[x, y], [x, y]], path }):
  // the corps commander splits the objective line among his divisions, as when the player orders the whole corps
  const cplan = (sc.corpsPlan || []).slice().sort((a, b) => a.t - b.t); let ci = 0;
  function corpsPlanTick() { while (ci < cplan.length && cplan[ci].t * 60 <= S.t) { const q = cplan[ci++], C = byId[q.c]; if (!C || C.s === S.player || !live(C)) continue; S.issueCommandOrder(C, q.path || [], q.line, q.opt || {}); report(C, 'ordered forward on the corps objective.', 0); } }
  // AI army commanders (sc.armyAI): on the side the computer plays, each army gives its corps objectives in turn. The commander's
  // aggression sets the rhythm: a cautious one (Montgomery's armies) waits longer between attacks and for fuller supply; a bold one
  // (Patton) attacks more often and reaches farther. All values are starting values for balance testing.
  const ARMYAI = { cadenceH: [60, 24], supply: [.75, .4], reachKm: [18, 32], frontKm: 4 };
  function armyTick() { if (!sc.armyAI) return;
    const cfg = typeof sc.armyAI === 'object' ? sc.armyAI : {};   // { only: [army keys], from: hours } limits the AI armies and when they start; cadenceH, waitH, supply and reachKm replace the values above for a pursuit
    for (const A of nodes) { if (A.level !== 'army' || A.s === S.player || S.t < (A.nextPlan || 0) || (cfg.only && !cfg.only.includes(A.key)) || S.t < (cfg.from || 0) * 60) continue; const ag = A.cmd ? A.cmd.ag : .5, k = Math.max(0, Math.min(1, (ag - .4) / .5));
      const lerp = a => a[0] + (a[1] - a[0]) * k; A.nextPlan = S.t + 60 * (cfg.cadenceH || lerp(ARMYAI.cadenceH)) * (.85 + S.rnd() * .3); const taken = new Set(), picks = [];
      for (const C of A.forms) { if (!C.forms || !live(C)) continue; if (C.order && C.order.st !== 'issued' && C.order.st !== 'done') continue;
        if (C.order && C.order.st === 'issued' && !C.order.doneSaid && S.t - C.order.t0 < (cfg.waitH || 48) * 60) continue;   // a corps attack still under way runs to its end, or 48 hours
        const kids = C.forms.filter(F => !F.forms && F.active && !F.dead); if (!kids.length) continue;
        if (kids.reduce((a, F) => a + F.stock / Math.max(1, F.cap), 0) / kids.length < (cfg.supply || lerp(ARMYAI.supply))) continue;
        const p = pos(C); if (!p) continue; let best = null, bs = -1e9;
        for (const v of S.vp) { if (v.own === C.s || taken.has(v)) continue; const d = Math.hypot(v.x - p[0], v.y - p[1]); if (d > (cfg.reachKm || lerp(ARMYAI.reachKm)) || (S.phaseBlock && S.phaseBlock(kids[0], v.x, v.y))) continue; const sc0 = v.pts / (d + 6) * (cfg.pocketBonus && S.ownAt(v.x, v.y) === C.s ? cfg.pocketBonus : 1); if (sc0 > bs) { bs = sc0; best = v; } }   // pocketBonus: an enemy-held objective standing on our ground is a bypassed pocket to reduce
        if (!best) continue; taken.add(best); picks.push({ C, best, bs, p, kids }); }
      // doctrine (sc.modules has 'doctrine'): the corps with the best objective makes the main effort on a narrow zone with a reserve;
      // the others attack on wide zones without one (FM 100-5, 1941, pars. 456-457). Without doctrine every corps attacks alike.
      const doc = (sc.modules || []).includes('doctrine'), mainC = doc && picks.length > 1 ? picks.reduce((a, q) => q.bs > a.bs ? q : a, picks[0]).C : null;
      for (const { C, best, p, kids } of picks) { const isMain = C === mainC, fk = (cfg.frontKm || ARMYAI.frontKm) * (doc ? (isMain ? .7 : 1.4) : 1);
        const dx = best.x - p[0], dy = best.y - p[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl, half = fk * kids.length / 2, cx = best.x + ux, cy = best.y + uy;
        S.issueCommandOrder(C, [], [[cx - uy * half, cy + ux * half], [cx + uy * half, cy - ux * half]], doc ? (isMain ? { main: true, reserve: true } : { reserve: false }) : {}); C.aiTgt = best;
        report(A, C.n + (isMain ? ' to make the main effort toward ' : ' to attack toward ') + best.n + '.', 0); } } }
  // called once per simulation step
  const prevHook = S.cmdHook;
  let armyT = -1e9; S.cmdHook = function () { if (prevHook) prevHook(); planTick(); corpsPlanTick(); if (S.t - armyT >= 60) { armyT = S.t; armyTick(); } for (const C of nodes) { if (!C.order) continue; if (C.order.st === 'pending' && S.t >= C.order.t0) release(C); else if (C.order.st === 'issued' && S.t >= C.order.nextReview) review(C); } };
  return S;
}
