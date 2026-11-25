// ===== COMMAND LAYER: corps and armies above the formations =====
// A command node holds formations (divisions) or other command nodes (corps under an army).
// The player, or a superior's AI, draws one line of advance and one objective line for the node.
// The node's commander takes staff time to plan, splits the objective line into sectors left to right,
// keeps a reserve when his style calls for it, and passes each child a parallel line of advance, so sister
// formations do not cross each other's routes. Children then plan their own orders as before.
// review settings, all starting values for balance testing
const CMDAI = { spentFrac: .45, spentCoh: .3, stallMin: 180, onObjKm: 2.5, coolMin: 120, townBeyondKm: 4, riverBeyondKm: 3, kmPerBn: .45, echelonKm: 15, restMin: 1440 };   // kmPerBn: attack frontage per leading battalion (a 9-battalion division needs about 4 km); echelonKm: a child this far behind the others follows as second echelon, and a corps this far beyond an army's objective keeps its orders; restMin: a relieved division rests this long before it can be committed again
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
    return n.subs.filter(u => (u.active || n.transit) && !u.dead && LEADCLS[u.cls]).reduce((a, u) => a + BW(u), 0) * (n.dead ? 0 : 1);
  }
  // does the straight way from a to b cross the river where no intact bridge stands in our hands? (fixes A1, A6)
  const riverBars = (a, b, s) => { const m = S.map, l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(l / .4));
    for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n; if (x < 0 || y < 0 || x >= m.w || y >= m.h || m.t[m.idx(x, y)] !== 13) continue;   // 13 is the river terrain code
      if (!m.bridges.some(br => br.intact && !br.gone && Math.hypot(br.x - x, br.y - y) < 2.5 && S.ownAt(br.x, br.y) === s)) return true; k += 3; } return false; };
  const xSeg = (a, b, c, d) => { const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1], den = rx * sy - ry * sx; if (Math.abs(den) < 1e-9) return null; const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den; return t > 0 && t < 1 && u > 0 && u < 1 ? [a[0] + rx * t, a[1] + ry * t] : null; };
  // two routes cross when they meet more than a kilometre from where either division starts (nearer than that, one is only passing the other's assembly area)
  const xPoly = (A, B) => { for (let i = 1; i < A.length; i++) for (let j = 1; j < B.length; j++) { const x = xSeg(A[i - 1], A[i], B[j - 1], B[j]); if (x && Math.hypot(x[0] - A[0][0], x[1] - A[0][1]) > 1 && Math.hypot(x[0] - B[0][0], x[1] - B[0][1]) > 1) return true; } return false; };
  const live = n => n.forms ? n.forms.some(live) : !n.dead && (!!n.transit || n.subs.some(u => u.active && !u.dead));   // a division on the move by road or rail is alive though off the map

  // create a command node: { n, s, cmd: { n, ag, sk }, forms: [formations or nodes], parent }
  S.mkCommand = function (o) { const C = Object.assign({ id: nodes.length, order: null, status: 'No orders', log: [] }, o); for (const c of C.forms) c.parent = C; nodes.push(C); return C; };

  // plan the split of one order across the node's children. Returns [{ child, path, line, reserve }].
  S.planCommandOrder = function (C, path, line, opt) {
    opt = opt || {}; const kids = C.forms.filter(live); if (!kids.length || !line || line.length < 2) return [];
    const p0 = pos(C) || line[0], mid = polyAt(line, polyLen(line) / 2); let L = polyLen(line);
    let ax = mid.x - p0[0], ay = mid.y - p0[1]; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
    // the axis of advance runs square to the objective line, away from our side of it; the line from the node's centre to the
    // objective decides only which way, since one far-off child (a corps attacking from the other side) can pull that centre aside.
    // Army orders only by default: a corps keeps the axis from its centre to the objective, as the France tutorial and scenario plans expect.
    // A scenario with sc.squareAxis: 'all' squares corps orders too (Sarn Corridor: on Tov's 22 Jun replay, 2 turn-backs in 200 hours against 14)
    { const lx = line[line.length - 1][0] - line[0][0], ly = line[line.length - 1][1] - line[0][1], ll = Math.hypot(lx, ly);
      if (opt.square !== false && (C.level === 'army' || S.sc.squareAxis === 'all') && ll > 1) { let nx = -ly / ll, ny = lx / ll; if (nx * ax + ny * ay < 0) { nx = -nx; ny = -ny; } ax = nx; ay = ny; } }
    const px = -ay, py = ax;                 // left-hand perpendicular of the axis of advance
    // a corps standing well beyond the objective line, on the enemy's far side (the Ostval Corps when the army attacks the corridor
    // from the west), keeps its present orders: its route to the line would cross the whole enemy rear. The player orders it apart.
    let beyondNote = '';
    if (C.level === 'army' && kids.length > 1) { const far = kids.filter(c => { const q = pos(c); return q && ((mid.x - q[0]) * ax + (mid.y - q[1]) * ay) < -CMDAI.echelonKm; });
      if (far.length && far.length < kids.length) { for (const c of far) kids.splice(kids.indexOf(c), 1); beyondNote = far.map(c => c.n).join(' and ') + (far.length > 1 ? ' stand' : ' stands') + ' beyond the objective, on the far side of the enemy, and ' + (far.length > 1 ? 'keep their' : 'keeps its') + ' present orders.'; } }
    // the objective line runs left to right as the commander faces it
    const side = (q) => (q[0] - mid.x) * px + (q[1] - mid.y) * py;
    let ln = side(line[0]) >= side(line[line.length - 1]) ? line.slice() : line.slice().reverse(), L0 = L, widened = '';
    // an objective line too short for the formations: the commander widens it along its own direction, equally on both flanks,
    // so the drawn objective stays the centre of the attack and every division gets a sector it can attack on
    // ... and so that the formations advance on the frontage they hold now: a line shorter than their spread runs on to cover it, so
    // the flanks go straight ahead and the formations facing the objective take it (Tov 24 Nov 2026, "I ordered the whole army to advance")
    const needKm = kids.reduce((s, c) => s + Math.max(1, weight(c)), 0) * CMDAI.kmPerBn;
    if (opt.widen !== false) { const a = ln[0], b = ln[ln.length - 1], ul = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / ul, uy = (b[1] - a[1]) / ul, tq = q => (q[0] - mid.x) * ux + (q[1] - mid.y) * uy;
      let lo = Math.min(-L / 2, -needKm / 2), hi = Math.max(L / 2, needKm / 2);
      // an army keeps its frontage; a corps closes up on the objective it is given, as concentration demands
      if (C.level === 'army') for (const c of kids) { const q = pos(c); if (!q) continue; const hw = Math.max(1.5, weight(c) * CMDAI.kmPerBn / 2), t = tq(q); lo = Math.min(lo, t - hw); hi = Math.max(hi, t + hw); }
      const eL = -L / 2 - lo, eR = hi - L / 2;
      if (eL > .5 || eR > .5) { const a1 = ln[1], b1 = ln[ln.length - 2], ua = Math.hypot(a[0] - a1[0], a[1] - a1[1]) || 1, ub = Math.hypot(b[0] - b1[0], b[1] - b1[1]) || 1, cl = (x, lim) => Math.max(0, Math.min(lim, x));
        ln = [[cl(a[0] + (a[0] - a1[0]) / ua * eL, S.map.w), cl(a[1] + (a[1] - a1[1]) / ua * eL, S.map.h)]].concat(ln, [[cl(b[0] + (b[0] - b1[0]) / ub * eR, S.map.w), cl(b[1] + (b[1] - b1[1]) / ub * eR, S.map.h)]]);
        L = polyLen(ln); widened = 'The objective is ' + L0.toFixed(0) + ' km wide; the line runs on to ' + L.toFixed(0) + ' km' + (C.level === 'army' ? ' to cover the front, the formations facing the objective take it as drawn.' : ', the room ' + kids.length + ' divisions need to attack, the main effort on the objective as drawn.'); } }
    // children ordered left to right by where they stand now, so assignments do not cross
    const at = kids.map(c => ({ c, p: pos(c) || p0 })).sort((a, b) => ((b.p[0] - p0[0]) * px + (b.p[1] - p0[1]) * py) - ((a.p[0] - p0[0]) * px + (a.p[1] - p0[1]) * py));
    // a reserve: cautious commanders hold one child back when they have three or more
    const ag = C.cmd ? C.cmd.ag : .5; let reserve = null;
    // towns on the objective (urban module): the stretches of the line that lie in the built-up area of an enemy-held town
    const armd = n => !n.forms && n.subs && (() => { const us = n.subs.filter(u => !u.dead && LEADCLS[u.cls]); return us.length > 0 && us.filter(u => u.cls === 'arm').length * 3 >= us.length; })();   // an armored division: a third or more of its leading battalions are tanks, the map symbol's own test
    const towns = []; let townN = null; if (S.urban && S.townAt) { let open = null; for (let d = 0; d <= L; d += .5) { const q = polyAt(ln, d), v = S.townAt(q.x, q.y), hit = v && v.own !== C.s; if (hit) { townN = townN || v.n; if (open == null) open = d; } if ((!hit || d + .5 > L) && open != null) { towns.push([Math.max(0, open - .5), Math.min(L, d + (hit ? .5 : 0))]); open = null; } } }
    // a town a short way beyond the objective line, and a river on the way with no bridge in our hands (fix A1): both are infantry work as well
    let river = false, beyond = null;
    if (S.urban && S.townAt && !towns.length) for (let d = 0; d <= L && !beyond; d += .5) { const q = polyAt(ln, d); for (let k = 1; k <= CMDAI.townBeyondKm; k++) { const v = S.townAt(q.x + ax * k, q.y + ay * k); if (v && v.own !== C.s) { beyond = v.n; break; } } }
    { const rt = [p0].concat((path || []).filter(q => q), [[mid.x, mid.y], [mid.x + ax * CMDAI.riverBeyondKm, mid.y + ay * CMDAI.riverBeyondKm]]); for (let i = 1; i < rt.length && !river; i++) river = riverBars(rt[i - 1], rt[i], C.s); }
    let note = '';
    if ((towns.length || beyond || river) && opt.reserve !== false && at.length >= 3 && at.filter(o => !armd(o.c)).length >= 2 && at.some(o => armd(o.c))) {
      // a town fight is infantry work: the armored division waits in reserve, whatever its place in the line
      let ri = -1, bw = 1e9; at.forEach((o, i) => { if (armd(o.c) && weight(o.c) < bw) { bw = weight(o.c); ri = i; } }); reserve = at.splice(ri, 1)[0]; note = reserve.c.n + (towns.length || beyond ? ' is held in reserve: ' + (townN || beyond) + ' is infantry work.' : ' is held in reserve until the infantry has a bridgehead over the river.');
    } else if (opt.reserve !== false && at.length >= 3 && (opt.reserve === true || ag < .65)) {
      let ri = 0, bw = 1e9; at.forEach((o, i) => { const w = weight(o.c); if (i > 0 && i < at.length - 1 && w < bw) { bw = w; ri = i; } }); if (!ri) ri = Math.floor(at.length / 2);
      reserve = at.splice(ri, 1)[0];
    }
    // second echelon: children standing well behind the rest (by the median depth along the axis) follow the main effort
    // instead of taking sectors in the line, so their routes do not cut across the leading formations' (Tov 24 Nov 2026)
    const second = []; let med = 0;
    if (opt.reserve !== false && at.length >= 3) {
      // depth: distance behind the objective line (negative for a child already beyond it, as a corps attacking from the far side)
      const behind = o => (mid.x - o.p[0]) * ax + (mid.y - o.p[1]) * ay;   // along the axis only, so a corps off a flank does not count as behind
      const ds = at.map(behind).sort((a, b) => a - b); med = ds[ds.length >> 1];
      for (let i = at.length - 1; i >= 0; i--) if (behind(at[i]) > med + CMDAI.echelonKm && at.length - 1 >= 2) second.push(at.splice(i, 1)[0]); }
    if (second.length) note = (note ? note + ' ' : '') + second.map(o => o.c.n).reverse().join(' and ') + (second.length > 1 ? ' follow' : ' follows') + ' in second echelon behind the main effort.';
    const W = at.reduce((s, o) => s + Math.max(1, weight(o.c)), 0); let acc = 0; const out = [];
    const P = (path && path.length ? path : []).filter(q => q);
    const bnd = [0]; for (const o of at) { acc += Math.max(1, weight(o.c)); bnd.push(acc / W * L); }
    // an armored division forward beside an infantry division: the boundary moves so the town lies in the infantry's sector
    if (towns.length) for (let i = 0; i < at.length; i++) { if (!armd(at[i].c)) continue; for (const [c0, c1] of towns) { const a = bnd[i], b = bnd[i + 1], wd = b - a; if (c1 <= a || c0 >= b || wd < 3) continue;
        const lf = i > 0 && !armd(at[i - 1].c), rt = i < at.length - 1 && !armd(at[i + 1].c), nearL = (c0 + c1) / 2 - a <= b - (c0 + c1) / 2;   // the infantry neighbour on the town's side takes it; the armor keeps at least 1.5 km beside the town
        if (lf && (nearL || !rt)) { bnd[i] = Math.min(c1, b - 1.5); note = note || at[i - 1].c.n + ' takes ' + townN + '; ' + at[i].c.n + ' attacks beside it.'; }
        else if (rt) { bnd[i + 1] = Math.max(c0, a + 1.5); note = note || at[i + 1].c.n + ' takes ' + townN + '; ' + at[i].c.n + ' attacks beside it.'; } } }
    // a division's lane: the corps route moved sideways into its sector, less the part that lies behind where the division stands
    const lane = (p, off) => P.map(q => [q[0] + px * off, q[1] + py * off]).filter(q => (q[0] - p[0]) * ax + (q[1] - p[1]) * ay > 1);
    for (let i = 0; i < at.length; i++) { const o = at[i];
      const a = bnd[i], b = bnd[i + 1];
      const seg = segOf(ln, a, b), sm = polyAt(ln, (a + b) / 2), off = side([sm.x, sm.y]);
      out.push({ child: o.c, path: lane(o.p, off), line: seg, reserve: false, p: o.p, off });
    }
    // no two divisions cross (fix A2): where two routes cross, the divisions change sectors; if they still cross, each marches straight to its sector
    const route = q => [q.p].concat(q.path, [(m => [m.x, m.y])(polyAt(q.line, polyLen(q.line) / 2))]);
    const crossN = () => { let n = 0; for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) if (xPoly(route(out[i]), route(out[j]))) n++; return n; };
    for (let pass = 0, n0 = crossN(); pass < 6 && n0; pass++) { let done = false;
      for (let i = 0; i < out.length && !done; i++) for (let j = i + 1; j < out.length && !done; j++) { if (!xPoly(route(out[i]), route(out[j]))) continue; const A = out[i], B = out[j], sw = () => { const l = A.line, o = A.off; A.line = B.line; A.off = B.off; B.line = l; B.off = o; A.path = lane(A.p, A.off); B.path = lane(B.p, B.off); };
        sw(); let n1 = crossN(); if (n1 >= n0) { sw(); A.path = []; B.path = []; n1 = crossN(); } done = n1 < n0; n0 = n1; }
      if (!done) break; }
    if (reserve) {                           // reserve keeps its own lane, parallel to its neighbours, and halts 6 km short of the objective
      const roff = Math.max(-L / 2, Math.min(L / 2, (reserve.p[0] - p0[0]) * px + (reserve.p[1] - p0[1]) * py)), hw = 1.5;
      // the assembly area lies on our side of the river (fix A6): step it back along the axis, then in toward the corps axis, until the way to it is open
      // and its way there crosses no forward division (fix A2). Tried in turn: behind the centre of the corps, then out toward its own side, then the far side
      const r0 = roff, mk = (ro, back) => { const x = mid.x - ax * back + px * ro, y = mid.y - ay * back + py * ro, q = { child: reserve.c, path: [], line: [[x + px * hw, y + py * hw], [x - px * hw, y - py * hw]], reserve: true, p: reserve.p, off: ro }; q.path = lane(reserve.p, ro).filter(w => (x - w[0]) * ax + (y - w[1]) * ay > 1); return q; };
      let R = null, fall = null;
      for (const f of [0, .5, 1, -.5, -1]) { for (let back = 6; back <= 16 && !R; back += 2) { const q = mk(r0 * f, back), m = [(q.line[0][0] + q.line[1][0]) / 2, (q.line[0][1] + q.line[1][1]) / 2]; if (riverBars(reserve.p, m, C.s) || riverBars(q.line[0], q.line[1], C.s)) continue; fall = fall || q;
          if (out.some(o => xPoly(route(o), route(q)))) { q.path = []; if (out.some(o => xPoly(route(o), route(q)))) continue; } R = q; } if (R) break; }
      if (!R) { const p = reserve.p; R = { child: reserve.c, path: [], line: [[p[0] + px * hw, p[1] + py * hw], [p[0] - px * hw, p[1] - py * hw]], reserve: true, p, off: roff }; }   // every way forward crosses a sister division: the reserve assembles where it stands
      out.push(R);
    }
    second.forEach((o, k) => {                // second echelon: lanes either side of the centre, halting 10 km short of the objective
      const off = (k - (second.length - 1) / 2) * 6, hw = 2, bx = mid.x - ax * 10 + px * off, by = mid.y - ay * 10 + py * off;
      // the route runs first behind the line of departure to the centre (8 km behind the leading formations), then forward, so the
      // second echelon passes behind the leading divisions' columns instead of across them
      const wb = med + 8, wx = Math.max(0, Math.min(S.map.w, mid.x - ax * wb + px * off)), wy = Math.max(0, Math.min(S.map.h, mid.y - ay * wb + py * off));
      out.push({ child: o.c, path: [[wx, wy]].concat(P.map(q => [q[0] + px * off, q[1] + py * off])), line: [[bx + px * hw, by + py * hw], [bx - px * hw, by - py * hw]], reserve: true }); });
    out.why = reserve && note ? (towns.length || beyond ? 'town' : river ? 'river' : '') : '';
    out.note = [widened, note, beyondNote].filter(Boolean).join(' '); out.line = ln; return out;
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
    // sister divisions still on the orders this one replaces do not count as crossed (fix A3)
    const leafs = n => n.forms ? n.forms.reduce((a, c) => a.concat(leafs(c)), []) : [n], old = new Set(plan.reduce((a, q) => a.concat(leafs(q.child)), []));
    for (const q of plan) { for (const f of leafs(q.child)) old.delete(f); send(q.child, q.path, q.line, Object.assign({}, O.opt, { sisters: new Set(old) }), q.reserve); }
    O.plan = plan.map(q => ({ child: q.child, path: q.path, line: q.line, reserve: q.reserve, w0: weight(q.child), best: 1e9, tBest: S.t }));
    O.nextReview = S.t + 60; O.lastAct = -1e9; O.why = plan.why || ''; O.whyChild = O.why ? (plan.find(q => q.reserve) || {}).child : null;
    C.status = 'Orders passed to ' + plan.length + (plan.some(q => q.reserve) ? ', one in reserve' : '');
    report(C, 'orders passed to ' + plan.map(q => q.child.n + (q.reserve ? ' (reserve)' : '')).join(', ') + '.');
    if (plan.note) report(C, plan.note);
  }
  function send(child, path, line, opt, reserve, then) {
    const o = Object.assign({}, opt, reserve ? { then: 'reserve' } : {}, then ? { then } : {}, { byCmd: 1 }); delete o.reserve;   // byCmd: the corps staff plans river crossings for divisions under its orders
    if (child.forms) S.issueCommandOrder(child, path, line, o); else S.issueOrder(child, path, line, o);
  }
  // a division the player gives its own order leaves the corps plan: the corps commander no longer counts it as a sector or as his reserve
  S.leaveCorpsOrder = function (F) { const C = F.parent, O = C && C.order; if (!O || !O.plan) return false; const i = O.plan.findIndex(q => q.child === F); if (i < 0) return false; O.plan.splice(i, 1); if (O.whyChild === F) { O.why = ''; O.whyChild = null; } return true; };
  function report(C, txt, lvl) { C.log.push({ t: S.t, txt }); S.say(C.s, C.n + ': ' + txt, lvl || 1); }
  const lineDist = (n, line) => { const p = pos(n); if (!p) return 1e9; let b = 1e9; for (let i = 1; i < line.length; i++) { const ax = line[i - 1][0], ay = line[i - 1][1], dx = line[i][0] - ax, dy = line[i][1] - ay, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)); b = Math.min(b, Math.hypot(p[0] - ax - dx * t, p[1] - ay - dy * t)); } return b; };
  const cohOf = n => { if (n.forms) { const k = n.forms.filter(live); return k.length ? k.reduce((s, c) => s + cohOf(c), 0) / k.length : 0; } const L = n.subs.filter(u => (u.active || n.transit) && !u.dead && LEADCLS[u.cls]); return L.length ? L.reduce((s, u) => s + u.coh, 0) / L.length : 0; };
  // the commander's review every half hour of an order in progress: spent or stalled divisions, the reserve, losses
  function review(C) {
    const O = C.order, P = O.plan; if (!P) return; O.nextReview = S.t + 30;
    for (const q of P) { if (q.reserve || !live(q.child)) continue; const d = lineDist(q.child, q.line); if (d < q.best - .5) { q.best = d; q.tBest = S.t; } }
    if (S.t - O.lastAct < CMDAI.coolMin) return;
    const fwd = P.filter(q => !q.reserve), res = P.find(q => q.reserve && live(q.child) && weight(q.child) >= CMDAI.spentFrac * q.w0 && !(q.restUntil > S.t));   // a formation just pulled out of the line rests before it can be committed again
    const moving = n => n.forms ? n.forms.some(moving) : !!n.transit;
    // a division waiting at a river, for boats, a bridge or a route, is not stalled: committing the reserve would only bring it to the same bank
    const atRiver = n => n.forms ? n.forms.some(atRiver) : ((S.xings || []).some(X => X.F === n && !X.done) || !!n.alignHold || !!n.flankHold || /crossing|bridg|no route|is down/i.test(n.status || ''));   // also a division halted on purpose for its neighbours or its flank (doctrine module)
    // arrived: a division whose own order is complete (it stands as near the objective as the ground allows, a river bank for one on the water)
    const fin = n => n.forms ? n.forms.filter(live).every(fin) : !!(n.order && n.order.st === 'done');
    const state = q => { if (!live(q.child)) return 'lost'; if (fin(q.child)) return 'done'; if (moving(q.child) || atRiver(q.child)) { q.tBest = S.t; return 'ok'; } if (weight(q.child) < CMDAI.spentFrac * q.w0 || cohOf(q.child) < CMDAI.spentCoh) return 'spent';
      const d = lineDist(q.child, q.line); if (d < CMDAI.onObjKm) return 'done'; if (S.t - q.tBest > CMDAI.stallMin && S.t - O.t0 > CMDAI.stallMin) return 'stalled'; return 'ok'; };
    // 1. commit the reserve where a forward division is spent or lost. A division merely stalled against a defended line keeps its
    // sector: the commander reports it once and leaves the decision to the player, because relieving divisions every time an attack
    // is held up swapped them back and forth and turned the front into churn (Sarn Corridor play, 24 Nov 2026). This replaces the
    // relieve-once rule of fix A2 and makes the reserve-kept rule of fix A1 hold for every stall.
    const sts = fwd.map(q => ({ q, st: state(q) }));
    for (const o of sts) if (o.st === 'stalled' && !o.q.stallRep) { o.q.stallRep = 1; report(C, o.q.child.n + ' is held up short of its objective and has made no ground for ' + Math.round((S.t - o.q.tBest) / 60) + ' hours. ' + (res ? res.child.n + ' stands ready in reserve.' : 'No reserve is left.'), 1); }
    for (const o of sts) if (o.st === 'ok' && o.q.stallRep && S.t - o.q.tBest < 60) o.q.stallRep = 0;
    const bad = sts.find(o => o.st === 'spent' || o.st === 'lost'), kept = false;
    if (bad && res && !kept) {
      const q = bad.q; if (bad.st === 'stalled') res.relieved = true;
      // the relieved division rests where it stands and becomes the reserve; the fresh division passes through to the sector
      if (bad.st !== 'lost') { const p = pos(q.child), m = polyAt(q.line, polyLen(q.line) / 2), dx = m.x - p[0], dy = m.y - p[1], dl = Math.hypot(dx, dy) || 1, hw = 1.5;
        send(q.child, [], [[p[0] - dy / dl * hw, p[1] + dx / dl * hw], [p[0] + dy / dl * hw, p[1] - dx / dl * hw]], O.opt, false, 'rest'); }
      send(res.child, [], q.line, O.opt, false);
      res.reserve = false; res.line = q.line; res.best = 1e9; res.tBest = S.t; res.w0 = weight(res.child);
      if (bad.st !== 'lost') { q.reserve = true; q.w0 = Math.max(weight(q.child), 1); q.restUntil = S.t + CMDAI.restMin; }
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
        for (const v of S.vp) { if (v.own === C.s || taken.has(v) || (v.noWay && v.noWay[C.s] > S.t)) continue; const d = Math.hypot(v.x - p[0], v.y - p[1]); if (d > (cfg.reachKm || lerp(ARMYAI.reachKm)) || (S.phaseBlock && S.phaseBlock(kids[0], v.x, v.y))) continue; const sc0 = v.pts / (d + 6) * (cfg.pocketBonus && S.ownAt(v.x, v.y) === C.s ? cfg.pocketBonus : 1); if (sc0 > bs) { bs = sc0; best = v; } }   // pocketBonus: an enemy-held objective standing on our ground is a bypassed pocket to reduce
        if (!best) continue;
        // an objective no road or ground leads to (a point in the sea, an island) is set aside for ten days; the corps picks again at the next planning hour
        if (!S.map.findPath(1, p[0], p[1], best.x, best.y, {})) { (best.noWay || (best.noWay = [0, 0]))[C.s] = S.t + 14400; A.nextPlan = Math.min(A.nextPlan, S.t + 60); continue; }
        taken.add(best); picks.push({ C, best, bs, p, kids }); }
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
