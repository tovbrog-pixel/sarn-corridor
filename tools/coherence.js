// Coherence checker: plays a corridor game and scores how coherently the divisions and corps behave, hour by hour.
//   node tools/coherence.js save <file.loa.json> [hours] [out.json]   replays a saved game's orders
//   node tools/coherence.js ai <seed> [hours] [out.json]              computer against computer
// Measures, per side (the player's side in a save, both sides in an AI game):
//   wander     a division turns back (its centre moves over 1.5 km in one hour and back over 1.5 km in the next),
//              a commander's order sends a division over 40 km, a battalion straggles (over 8 km from its division centre with
//              no battalion of its own within 5 km)
//   shape      a battalion mixed into a sister division of its corps (over 4 km from its own division's centre, nearer the sister's
//              centre than its own, with a battalion of the sister within 2 km), a division attacking (in contact under an advance order)
//              with no other division within 8 km
//   piecemeal  a corps attack where one division is in contact and the others in the same attack (objective lines within 15 km of its own)
//              are over 10 km off and out of contact
//   jams       a battalion on the move with a path that made under 0.3 km in the hour with no enemy within 4 km, no halt, over
//              0.5 km from its goal and no unbridged river between it and its goal
//   refused    a division whose order its commander refused, in division-hours, with the reasons
//   spread     a corps whose two farthest divisions stand over 30 km apart, in corps-hours (and the median corps span)
//   held       a division halted at a bound (alignment) or for an open flank, in division-hours, with the longest unbroken halt
//   idle       a division with an active order whose centre moved under 0.5 km in 3 hours with no enemy within 5 km and no halt, river wait or bound
// Every count is in unit-hours; the worst six-hour windows are listed with places, for screenshots.
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const E = require(path.join(root, 'tools/load-engine'))(), mk = require(path.join(root, 'tools/scenario-corridor.js'));
const [mode, arg, hArg, outFile] = process.argv.slice(2);
if (mode !== 'save' && mode !== 'ai') { console.log('usage: node tools/coherence.js save <file> [hours] [out.json] | ai <seed> [hours] [out.json]'); process.exit(1); }
const sc = mk(); let S, tape = [], player = -1, end;
if (mode === 'save') {
  const o = JSON.parse(fs.readFileSync(arg, 'utf8')); player = o.player; S = E.createSim(sc, o.player, o.seed, o.opt); S.setup();
  const idx = {}; S.forms.forEach((F, j) => { if (!(F.n in idx)) idx[F.n] = j; });
  tape = o.tape.map(e => { if (e.length < 4 || e[3] == null) return e; const j = idx[e[3]]; if (j == null) return null; const a = e[2].slice(); a[0] = j; return [e[0], e[1], a, e[3]]; }).filter(Boolean);
  end = hArg ? +hArg * 60 : o.t;
} else { S = E.createSim(sc, -1, +arg || 101, {}); S.setup(); end = (+hArg || 200) * 60; }
const sides = player >= 0 ? [player] : [0, 1], SIDE = sc.labels || ['Side 0', 'Side 1'];
let dt = 1, ti = 0, byPlayer = false;
const runCmd = (k, a) => { const F = S.forms[a[0]]; byPlayer = true; try {
  if (k === 'corps') { const N = F && F.parent ? (a[4] === 'army' && F.parent.parent ? F.parent.parent : F.parent) : null; if (N) S.issueCommandOrder(N, a[1], a[2], a[3]); }
  else if (k === 'issue') S.issueOrder(F, a[1], a[2], a[3]); else if (k === 'press') S.setPress(F, a[1]); else if (k === 'dt') dt = a[0]; } finally { byPlayer = false; } };
// far orders: wrap issueOrder to see who gave each order and how far it sends the division
const farOrders = [], io = S.issueOrder;
S.issueOrder = function (F, p, line, opt) { const L = line && line.length ? line : p; if (L && L.length && !byPlayer && sides.includes(F.s)) { const m = L[Math.floor(L.length / 2)], d = Math.hypot(m[0] - F.cx, m[1] - F.cy); if (d > 40) farOrders.push({ t: S.t, s: F.s, F: F.n, km: Math.round(d), then: opt && opt.then }); } return io.apply(this, arguments); };
// a river with no bridge of ours between a battalion and its goal: the battalion waits for boats or a bridge, which is no jam
const riverAhead = (u, s) => { const g = u.goal; if (!g) return false; const m = S.map, a = [u.x, u.y], l = Math.hypot(g[0] - a[0], g[1] - a[1]), n = Math.max(1, Math.ceil(l / .4));
  for (let k = 0; k <= n; k++) { const x = a[0] + (g[0] - a[0]) * k / n, y = a[1] + (g[1] - a[1]) * k / n; if (x < 0 || y < 0 || x >= m.w || y >= m.h || m.t[m.idx(x, y)] !== 13) continue; if (!m.bridges.some(br => br.intact && !br.gone && Math.hypot(br.x - x, br.y - y) < 2.5 && S.ownAt(br.x, br.y) === s)) return true; k += 3; } return false; };
const live = F => F.active && !F.dead, bats = F => F.subs.filter(u => u.active && !u.dead && u.cls !== 'hq' && !u.det && u.mv !== 'ship');
const W = {}; const tally = (s, k, n, where) => { if (!n) return; const w = Math.floor(S.t / 360); const key = s + '|' + w; const r = W[key] || (W[key] = { s, w, c: {}, ex: {} }); r.c[k] = (r.c[k] || 0) + n; if (where) (r.ex[k] = r.ex[k] || []).push(where); };
const tot = [{}, {}]; const add = (s, k, n) => { tot[s][k] = (tot[s][k] || 0) + n; };
const hist = new Map(), spans = [], longest = [{}, {}], WHY = {}; const why = (s, k, r) => { const key = s + ' ' + k + ': ' + r; WHY[key] = (WHY[key] || 0) + 1; };
function hour() {
  // enemy battalions in 2 km buckets, for nearest-enemy distances
  const B = [new Map(), new Map()]; for (const F of S.forms) for (const u of F.subs) if (u.active && !u.dead) { const k = Math.floor(u.x / 2) + ',' + Math.floor(u.y / 2); const m = B[u.s]; (m.get(k) || m.set(k, []).get(k)).push(u); }
  const near = (s, x, y, r) => { const m = B[s], R = Math.ceil(r / 2), cx = Math.floor(x / 2), cy = Math.floor(y / 2); let best = 1e9, bu = null; for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) { const a = m.get((cx + i) + ',' + (cy + j)); if (a) for (const u of a) { const d = Math.hypot(u.x - x, u.y - y); if (d < best) { best = d; bu = u; } } } return [best, bu]; };
  for (const s of sides) {
    const divs = S.forms.filter(F => F.s === s && live(F) && bats(F).length);
    for (const F of divs) {
      const h = hist.get(F) || { p: [] }; hist.set(F, h); h.p.push([F.cx, F.cy]); if (h.p.length > 4) h.p.shift();
      const P = h.p, n = P.length, where = { F: F.n, x: +F.cx.toFixed(1), y: +F.cy.toFixed(1), at: S.nearTown(F.cx, F.cy) };
      // wander: turn-back
      if (n >= 3) { const a = [P[n - 2][0] - P[n - 3][0], P[n - 2][1] - P[n - 3][1]], b = [P[n - 1][0] - P[n - 2][0], P[n - 1][1] - P[n - 2][1]], la = Math.hypot(...a), lb = Math.hypot(...b);
        if (la > 1.5 && lb > 1.5 && (a[0] * b[0] + a[1] * b[1]) / (la * lb) < -.5) { add(s, 'turnBacks', 1); tally(s, 'turnBacks', 1, where); } }
      // wander: stragglers
      const us = bats(F); let str = 0; for (const u of us) if (u.cls !== 'rec' && Math.hypot(u.x - F.cx, u.y - F.cy) > 8 && !us.some(v => v !== u && Math.hypot(v.x - u.x, v.y - u.y) < 5)) str++;   // cut off from the body: over 8 km from the centre and no battalion of its own within 5 km
      if (process.env.COH_DEBUG && str && Math.round(S.t / 60) % 24 === 0) for (const u of us) if (Math.hypot(u.x - F.cx, u.y - F.cy) > 8 && !us.some(v => v !== u && Math.hypot(v.x - u.x, v.y - u.y) < 5)) console.log('DBG', S.clock(S.t).slice(0, 16), F.n, u.n, u.cls, u.k && u.k.n, 'fm', u.fm, 'd', Math.hypot(u.x - F.cx, u.y - F.cy).toFixed(1), 'path', !!u.path, u.path ? u.pi + '/' + u.path.length : '', 'goal', u.goal ? u.goal.map(v => v.toFixed(0)).join(',') : '-', 'slot', !!u.slot, 'st', u.state, 'mv', u.mv, 'F.order', F.order && F.order.st, 'trans', !!F.transit);
      if (process.env.COH_WHY) for (const u of us) if (u.cls !== 'rec' && Math.hypot(u.x - F.cx, u.y - F.cy) > 8 && !us.some(v => v !== u && Math.hypot(v.x - u.x, v.y - u.y) < 5)) why(s, 'straggler', (u.state === 'retreat' ? 'retreating' : 'ok') + (u.path && u.pi < u.path.length ? ' moving' : ' still') + (F.alignHold || F.flankHold ? ' div-held' : '') + ' ' + u.cls);
      if (str) { add(s, 'stragglers', str); tally(s, 'stragglers', str, where); }
      // halted at a bound or for an open flank: division-hours, and the longest unbroken halt
      if (F.alignHold || F.flankHold) { add(s, 'held', 1); tally(s, 'held', 1, Object.assign({ why: F.alignHold || F.flankHold }, where)); h.hold = (h.hold || 0) + 1; if (h.hold > (longest[s].h || 0)) longest[s] = { h: h.hold, F: F.n, why: F.alignHold || F.flankHold, t: S.t }; } else h.hold = 0;
      // shape: mixed into a sister division of the same corps
      let mix = 0; if (F.parent && F.parent.level === 'corps') for (const u of us) { const dOwn = Math.hypot(u.x - F.cx, u.y - F.cy); if (dOwn <= 4) continue; let bd = 2, bG = null; for (const G of divs) { if (G === F || G.parent !== F.parent || Math.hypot(u.x - G.cx, u.y - G.cy) >= dOwn) continue; for (const v of bats(G)) { const d = Math.hypot(v.x - u.x, v.y - u.y); if (d < bd) { bd = d; bG = G; } } } if (bG) { mix++; if (process.env.COH_WHY) why(s, 'mixed', (F.order && F.order.then === 'reserve' ? 'FOLLOWER ' : 'ATTACKER ') + u.cls + (u.state === 'retreat' ? ' retreating' : '') + (u.det ? ' detached' : '') + ' own:' + (F.order ? F.order.st + (F.post ? '/' + F.post : '') : 'none') + (F.contact ? '+contact' : '') + ' sister:' + (bG.order ? bG.order.st + (bG.post ? '/' + bG.post : '') : 'none') + (bG.contact ? '+contact' : '') + (u.path && u.pi < u.path.length ? ' moving' : ' still')); } }
      if (mix) { add(s, 'mixed', mix); tally(s, 'mixed', mix, where); }
      // shape: isolated division in contact
      if (F.contact && F.order && F.order.st === 'active' && F.order.L > 1) { let alone = true; for (const G of divs) { if (G === F) continue; if (Math.hypot(G.cx - F.cx, G.cy - F.cy) < 8 || bats(G).some(v => us.some(u => Math.hypot(v.x - u.x, v.y - u.y) < 8))) { alone = false; break; } } if (alone) { add(s, 'isolated', 1); tally(s, 'isolated', 1, where); } }
      // jams
      const ehere = near(1 - s, F.cx, F.cy, 6)[0];
      let jam = 0; for (const u of us) { const q = u._cohP; u._cohP = [u.x, u.y]; if (!q || !u.path || u.pi >= u.path.length || (u.goal && Math.hypot(u.goal[0] - u.x, u.goal[1] - u.y) < .5) || riverAhead(u, s) || (u.coh < .4 && S.t - u.hitT < 60) || F.halt || F.alignHold || F.flankHold || u.state === 'retreat') continue; if (Math.hypot(u.x - q[0], u.y - q[1]) < .3 && near(1 - s, u.x, u.y, 4)[0] > 4) { jam++; if (process.env.COH_WHY) { const c = S.map.idx(u.x, u.y), crowd = bats(F).length; why(s, 'jam', (u.fuel <= 0 && u.mv !== 'foot' ? 'no fuel' : u.coh < .4 ? 'low cohesion' : F.f && 0 ? '' : u.f && u.f.pace === 0 ? 'pace 0' : (S.map.fac[u.mvi][c] < .1 ? 'bad ground' : 'other')) + ' ' + u.cls + ' ' + u.mv); } } }
      if (jam) { add(s, 'jammed', jam); tally(s, 'jammed', jam, where); }
      // an order the commander refused and still stands refused
      if (F.order && F.order.st === 'refused') { add(s, 'refused', 1); tally(s, 'refused', 1, Object.assign({ why: F.order.why }, where)); why(s, 'refused', F.order.why || '?'); }
      // idle with orders
      const O = F.order; if (process.env.COH_WHY && O && O.st === 'active' && n >= 4 && Math.hypot(P[n - 1][0] - P[0][0], P[n - 1][1] - P[0][1]) < .5 && ehere > 5) why(s, 'idle', (F.status || '').replace(/ (near|at|grid|\().*$/, '').replace(/[0-9]+/g, 'N') + (O.then ? ' then ' + O.then : '') + (F.halt ? ' [halt]' : '') + (F.alignHold ? ' [bound]' : '') + (F.flankHold ? ' [flank]' : ''));
      if (O && O.st === 'active' && n >= 4 && Math.hypot(P[n - 1][0] - P[0][0], P[n - 1][1] - P[0][1]) < .5 && ehere > 5 && !us.some(u => riverAhead(u, s)) && !F.halt && !F.alignHold && !F.flankHold && !F.bridge && !F.needEng && !/river|cross|boat|bridge/i.test(F.status || '')) { add(s, 'idle', 1); tally(s, 'idle', 1, where); }
    }
    // piecemeal: per corps
    const corps = [...new Set(divs.map(F => F.parent).filter(C => C && C.level === 'corps'))];
    for (const C of corps) { const ks = divs.filter(F => F.parent === C); let span = 0, pr = null; for (const A of ks) for (const B2 of ks) { const d = Math.hypot(A.cx - B2.cx, A.cy - B2.cy); if (d > span) { span = d; pr = [A, B2]; } }
      if (ks.length >= 2) { spans.push(span); if (span > 30) { add(s, 'spread', 1); tally(s, 'spread', 1, { F: C.n + ' ' + Math.round(span) + ' km: ' + pr[0].n + ' to ' + pr[1].n, x: +pr[0].cx.toFixed(1), y: +pr[0].cy.toFixed(1), at: S.nearTown(pr[0].cx, pr[0].cy) }); } } }
    for (const C of corps) { const fw = divs.filter(F => F.parent === C && F.order && F.order.st === 'active' && F.post !== 'reserve' && F.order.then !== 'reserve'); if (fw.length < 2) continue;
      const hot = fw.filter(F => F.contact); if (hot.length !== 1) continue; const H = hot[0];
      // only the divisions in the same attack count: their objective lines lie within 15 km of the engaged division's
      const mid = G => { const L = G.order.line && G.order.line.length ? G.order.line : G.order.path; return L[Math.floor(L.length / 2)]; }, hm = mid(H);
      const mates = fw.filter(G => G !== H && Math.hypot(mid(G)[0] - hm[0], mid(G)[1] - hm[1]) < 15); if (!mates.length) continue;
      if (mates.every(F => Math.hypot(F.cx - H.cx, F.cy - H.cy) > 10)) { if (process.env.COH_WHY) { why(s, 'piecemeal lead', (H.status || '').replace(/ (near|at|grid) .*$/, '')); for (const G of mates) why(s, 'piecemeal other', ((G.status || '').replace(/ (near|at|grid|\().*$/, '').replace(/[0-9]+/g, 'N')) + (G.alignHold ? ' [bound]' : '') + ' ' + Math.round(Math.hypot(G.cx - H.cx, G.cy - H.cy) / 5) * 5 + ' km'); }
        add(s, 'piecemeal', 1); tally(s, 'piecemeal', 1, { F: C.n + ': ' + H.n + ' alone', x: +H.cx.toFixed(1), y: +H.cy.toFixed(1), at: S.nearTown(H.cx, H.cy) }); } }
  }
}
const t0 = Date.now();
while (S.t < end && !S.over) { while (ti < tape.length && tape[ti][0] <= S.t) { runCmd(tape[ti][1], tape[ti][2]); ti++; } S.stepOnce(dt); if (Math.round(S.t) % 60 === 0) hour(); }
for (const r of farOrders) { add(r.s, 'farOrders', 1); }
const K = ['turnBacks', 'farOrders', 'stragglers', 'mixed', 'isolated', 'piecemeal', 'jammed', 'idle', 'held', 'refused', 'spread'];
const hours = Math.round(S.t / 60), out = { mode, arg, hours, took: Math.round((Date.now() - t0) / 1000), sides: sides.map(s => ({ s, name: SIDE[s], totals: tot[s] })), farOrders: farOrders.slice(0, 40), worst: [] };
console.log('Coherence check: ' + (mode === 'save' ? path.basename(arg) : 'AI seed ' + arg) + ', ' + hours + ' game hours (' + out.took + ' s)');
console.log('per 100 hours'.padEnd(14) + K.map(k => k.padStart(11)).join(''));
for (const s of sides) console.log(SIDE[s].padEnd(14) + K.map(k => ((tot[s][k] || 0) * 100 / hours).toFixed(1).padStart(11)).join(''));
for (const s of sides) if (longest[s].h) console.log('longest halt, ' + SIDE[s] + ': ' + longest[s].F + ', ' + longest[s].h + ' hours to ' + S.clock(longest[s].t).slice(0, 16) + ' (' + longest[s].why + ')');
out.longest = longest; if (spans.length) { const q = spans.slice().sort((a, b) => a - b); console.log('corps span (km between its two farthest divisions): median ' + Math.round(q[q.length >> 1]) + ', 90th percentile ' + Math.round(q[Math.floor(q.length * .9)])); }
// worst six-hour windows, scored by the share of each measure in its own total
const score = r => K.reduce((a, k) => a + (r.c[k] || 0) / Math.max(1, tot[r.s][k] || 1), 0);
const ws = Object.values(W).sort((a, b) => score(b) - score(a)).slice(0, 8);
console.log('\nworst six-hour windows:');
for (const r of ws) { const top = K.filter(k => r.c[k]).sort((a, b) => (r.c[b] / (tot[r.s][b] || 1)) - (r.c[a] / (tot[r.s][a] || 1))); const k0 = top[0], e = r.ex[k0] ? r.ex[k0][0] : null;
  const line = S.clock(r.w * 360).slice(0, 16) + ' ' + SIDE[r.s] + ': ' + top.map(k => k + ' ' + r.c[k]).join(', ') + (e ? ' | e.g. ' + e.F + ' ' + e.at + ' (' + e.x + ', ' + e.y + ')' : '');
  console.log('  ' + line); out.worst.push({ t: r.w * 360, s: r.s, c: r.c, ex: Object.fromEntries(Object.entries(r.ex).map(([k, v]) => [k, v.slice(0, 4)])) }); }
{ const R = Object.entries(WHY).filter(([k]) => / refused: /.test(k)); if (R.length) { console.log('\nrefusals (division-hours):'); for (const [k, v] of R.sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('  ' + v + '  ' + k.replace(/^\d refused: /, '')); } }
if (process.env.COH_WHY) { console.log('\nreasons:'); for (const [k, v] of Object.entries(WHY).sort((a, b) => b[1] - a[1]).filter((e, i) => i < 30 || /piecemeal/.test(e[0]))) console.log('  ' + v + '  ' + k); }
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
