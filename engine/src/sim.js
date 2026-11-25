// ===== SIMULATION =====
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function polyLen(p) { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return l; }
function polyAt(p, s) { if (p.length === 1) return { x: p[0][0], y: p[0][1], dx: 1, dy: 0 }; s = Math.max(0, s); for (let i = 1; i < p.length; i++) { const dx = p[i][0] - p[i - 1][0], dy = p[i][1] - p[i - 1][1], l = Math.hypot(dx, dy) || 1e-6; if (s <= l || i === p.length - 1) { const t = Math.min(1, s / l); return { x: p[i - 1][0] + dx * t, y: p[i - 1][1] + dy * t, dx: dx / l, dy: dy / l }; } s -= l; } }
function polyProj(p, x, y) { let best = 0, bd = 1e9, acc = 0; for (let i = 1; i < p.length; i++) { const ax = p[i - 1][0], ay = p[i - 1][1], dx = p[i][0] - ax, dy = p[i][1] - ay, l2 = dx * dx + dy * dy || 1e-9; const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1), d = Math.hypot(x - ax - dx * t, y - ay - dy * t), l = Math.sqrt(l2); if (d < bd) { bd = d; best = acc + t * l; } acc += l; } return best; }
const LEADCLS = { inf: 1, arm: 1, mech: 1, rec: 1, cdo: 1 };
// battalion weight of a unit: a regiment or brigade simulated as one unit (sub spec 'kind|name|mul|bns', bns > 1) counts as bns battalions
// for frontage, guard and column counts. Size (fire and toughness) still comes from mul.
const BW = u => u.bns || 1;
const EXT_KM = .75;   // half a battalion frontage: a unit of bns battalions reaches (bns - 1) x 0.75 km further to each side
// ammunition used per minute of firing, resupply per ten-minute tick, and the attrition scale (tuned after first playtest)
// national command doctrine, simplified (see help card). delay: staff time for orders; init: chance a commander acts on his own; mass: bonus per extra battery on one target (fire direction centres); crad: command-radius multiplier (radios)
// how hard an attack presses: need scales the odds the commander wants; coh is the formation cohesion below which he halts; ret shifts the cohesion at which battalions fall back
const PRESS = [{ n: 'Probe', need: 1.35, coh: .5, ret: .06 }, { n: 'Deliberate', need: 1, coh: .42, ret: 0 }, { n: 'Determined', need: .75, coh: .32, ret: -.04 }, { n: 'Whatever the cost', need: .5, coh: .22, ret: -.08 }];
const DOCT = { US: { delay: .9, init: 1, mass: .15, crad: 1.1, n: 'US: fire direction centres mass the guns; combat commands regroup quickly' }, UK: { delay: 1.15, init: .7, mass: .15, crad: 1, n: 'British: deliberate, artillery-heavy set-piece fire plans; slower orders' }, GE: { delay: .8, init: 1.4, mass: .06, crad: 1.1, n: 'German: mission-type orders; fast staff work and junior initiative' }, IT: { delay: 1.25, init: .6, mass: .04, crad: .75, n: 'Italian: few radios; slow orders and a short command reach' } };
const INDEP = { rec: 1, cdo: 1 }, FMISS = { R: 'Reinforcing', GS: 'General support', GSR: 'General support, reinforcing' };
const AMMO = { ship: .006, shipRefill: .015, inf: .005, arm: .0065, ind: .009, refill: .035, refillArt: .05 }, ATT = { str: 2.4, coh: 1.8 };
const WXVIS = { clear: 1, cloud: 1, overcast: .9, rain: .75, fog: .45, snow: .65, dust: .35 };
const RATION = .15, BOOTY = .3;   // loads per battalion per day for rations and water; share of an overrun depot's stock the captor can use
const ROADBIAS = 4, OFFFREE = 3, OFFSLOPE = .08, OFFMIN = .5;   // supply columns: cost multiplier on ground with no road; km of off-road driving before loads shrink, loss per km past that, smallest load
const WXMOVE = { clear: 1, cloud: 1, overcast: 1, rain: .8, fog: .9, snow: .75, dust: .7 };
const WXNAME = { clear: 'Clear', cloud: 'Scattered cloud', overcast: 'Overcast', rain: 'Rain', fog: 'Fog', snow: 'Snow', dust: 'Sandstorm' };

const DIFF = [
  { n: 'Staff exercise', xp: .9, sup: .8, react: 1.5, arr: 1.1, delay: .75 },
  { n: (typeof GAMECFG !== 'undefined' && GAMECFG.levelName) || 'Historical', xp: 1, sup: 1, react: 1, arr: 1, delay: 1 },   // GAMECFG: the game's own settings (game.json), set by the page builder
  { n: 'Veteran opponent', xp: 1.08, sup: 1.2, react: .7, arr: .95, delay: 1.15 },
  { n: 'Supreme command', xp: 1.15, sup: 1.4, react: .5, arr: .88, delay: 1.3 }];
const FRICTION = ['As planned', 'Variable', 'Chaotic'];
const PLANS = [{ n: 'aggressive', tm: .82, rng: 27, stk: .3 }, { n: 'standard', tm: 1, rng: 20, stk: .4 }, { n: 'cautious', tm: 1.2, rng: 15, stk: .5 }];
// ----- lessons: each commander keeps a weight per situation, moved by the result of his own attacks -----
const THEN = { hold: 'Hold until further orders', dig: 'Dig in', rest: 'Rest and refit', exploit: 'Exploit', delay: 'Delay', reserve: 'Reserve' };
const LESSON = { dug: 'attacking dug-in troops', night: 'attacking at night', air: 'attacking under enemy aircraft', guns: 'attacking into enemy artillery', armour: 'attacking enemy armour', close: 'attacking in towns and woods', outnum: 'attacking when outnumbered', supply: 'attacking when short of supply', gen: 'attacking at all' };
function createSim(sc, player, seed, opt) {
  // deployment variants (sc.variants): one is drawn from the seed when the game starts, so a hidden plan differs from game to game;
  // a variant replaces the scenario fields it carries (forms, corpsPlan and the like). opt.variant forces one, for tests.
  if (sc.variants && sc.variants.length) { const vr = mulberry((seed || 20261119) ^ 0x5bd1e995), vi = opt && opt.variant != null ? opt.variant : Math.floor(vr() * sc.variants.length); sc = Object.assign({}, sc, sc.variants[vi], { variantIndex: vi }); }
  opt = opt || {}; const VR = opt.vary == null ? 1 : opt.vary, DF = DIFF[opt.diff == null ? 1 : opt.diff], foe = player < 0 ? -1 : 1 - player, D1 = { xp: 1, sup: 1, react: 1, arr: 1, delay: 1 }, dfS = s => s === foe ? DF : D1;
  const map = buildMap(sc), rnd = mulberry(seed || 20261119), N = map.N;
  // friction: the forecast stays as scripted, the weather that arrives may differ
  const WSEQ = ['clear', 'cloud', 'overcast', 'rain'], weather = sc.weather.map((w, i) => { if (!i || rnd() > .17 * VR) return w; const k = WSEQ.indexOf(w); if (k < 0) return rnd() < .5 ? 'overcast' : w; return WSEQ[clamp(k + (rnd() < .5 ? -1 : 1), 0, 3)]; });
  const plan = [0, 1].map(s => { if (!VR) return PLANS[1]; const r = rnd(), hard = s === foe && DF.react < .6; return PLANS[r < (hard ? .5 : .3) ? 0 : r < (hard ? 1 : .72) ? 1 : 2]; });
  const S = { sc, map, rnd, t: 0, player, ai: [player !== 0, player !== 1], forms: [], subs: [], convoys: [], flights: [], lossH: [], ev: [], log: [], pool: [[], []], src: [[], []], air: [], vp: [], over: false, planning: true, zoc: [new Uint8Array(N), new Uint8Array(N)], zE: [new Uint8Array(N), new Uint8Array(N)], lab: [new Int32Array(N), new Int32Array(N)], zones: [], nid: 1, wx: sc.weather[0], weather, plan, diff: DF, vary: VR, learn: opt.learn !== false, staff: [{ pre: 0 }, { pre: 0 }], night: false, pb: 40, losses: [0, 0] };
  const d0 = new Date(sc.start + ':00Z'); S.d0 = d0; const month = d0.getUTCMonth() + 1; S.dayA = month === 12 || month === 1 ? 8 : month === 2 ? 7 : 6; S.dayB = month === 12 || month === 1 ? 16.5 : month === 2 ? 18 : 19;
  S.hourOf = t => (d0.getUTCHours() + d0.getUTCMinutes() / 60 + t / 60) % 24;
  S.clock = function (t) { const d = new Date(d0.getTime() + (t == null ? S.t : t) * 60000); const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]; return d.getUTCDate() + ' ' + mo + ' ' + d.getUTCFullYear() + '  ' + String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes()).padStart(2, '0') + ' hrs'; };
  // a formation the player has handed to the staff reports routine trouble as information; losses still come through as alerts
  function say(F, txt, lvl, x, y) { const s = F && F.s != null ? F.s : (F === 0 || F === 1 ? F : -1); if (lvl === 2 && F && F.staff && !/destroyed|wiped out|overrun|lost|surrender/i.test(txt)) lvl = 1; S.log.push({ t: S.t, s, who: F && F.n ? F.n : '', cmd: F && F.cmd ? F.cmd.n : '', txt, lvl: lvl || 0, x: x != null ? x : (F && F.cx), y: y != null ? y : (F && F.cy) }); if (S.log.length > 400) S.log.splice(0, 100); }
  S.say = say;
  const aiF = F => S.ai[F.s] || !!F.staff;
  const AIRB = /Parachute|Airborne|Airlanding|Glider|Fallschirm/;   // airborne troops are meant to hold where they land until relieved   // formations run by a staff: the AI side, and any the player hands to his staff
  const nearTown = (x, y) => { let b = null, bd = 1e9; for (const t of map.towns) { const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; b = t; } } return b ? (bd < 1.2 ? b.name : (bd < 6 ? 'near ' + b.name : 'grid ' + Math.round(x) + '-' + Math.round(y))) : ''; };
  S.nearTown = nearTown;

  function alive(F) { return F.subs.filter(u => u.active && !u.dead); }
  function field(F) { return F.subs.filter(u => u.active && !u.dead && !u.det && !u.fm); }
  function leads(F) { return F.subs.filter(u => u.active && !u.dead && !u.det && LEADCLS[u.cls]); }
  // ---------- setup ----------
  sc.sides.forEach((sd, s) => {
    S.portSt = S.portSt || [];
    S.src[s] = sd.sources.map(o => { const q = Object.assign({ s, cap: o.stock * (o.air ? 1 : 1.4), captured: false, t: 0, dropT: 360 }, o), m = dfS(s).sup * (1 + (rnd() - .5) * .2 * VR); q.rate *= m; if (!q.air) q.stock *= dfS(s).sup; return q; });
    S.pool[s] = (sd.pool || []).map(o => Object.assign({ s, sub: null, F: null }, o));
    S.air[s] = { bases: sd.bases.map(b => Object.assign({ s }, b)), groups: sd.groups.map(g => ({ n: g[0], key: g[1], ac: AC[g[1]], total: g[2], avail: g[2], base: g[3], mission: g[4], pend: [], next: 0, s })), int: [], strat: [], cas: [], rec: [], ri: 0, si: 0, rci: 0 };
  });
  S.vp = sc.vp.map(v => ({ n: v[0], x: v[1], y: v[2], pts: v[3], own: v[4], orig: v[4], capR: sc.capBig && v[3] >= sc.capBig.pts ? sc.capBig.r : 0 }));   // capBig { pts, r }: an objective worth pts or more is a large town; it changes hands only when none of the holder's troops stand within r km
  // crossing equipment: assault boats and floating-bridge sets, parked at a depot until trucked to a crossing site
  S.assets = [[], []]; S.xings = [];
  { let d = 0; for (let c = 0; c < map.N; c++) if (map.t[c] === T.DESERT) d++; S.desert = d > map.N * .3; }   // desert maps double the water and ration draw
  sc.sides.forEach((sd, s) => { for (const a of sd.assets || []) { const q = S.src[s].find(q => !q.air && (!a.at || q.n === a.at)) || S.src[s].find(q => !q.air) || S.src[s][0]; S.assets[s].push({ id: S.assets[s].length, s, k: a.k, n: a.n, n0: a.n, nm: a.nm, x: q ? q.x : 0, y: q ? q.y : 0, t: a.t || 0, st: 'park', site: null, haul: null }); } });
  function mkSub(F, key, name, mul, x, y, bns) {
    const k = KIND[key]; if (!k) throw new Error('unknown kind ' + key);
    const u = { id: S.nid++, f: F, s: F.s, k, n: name || k.n, cls: k.cls, mv: k.mv, mvi: MVI[k.mv], size: k.size * (mul || 1), mul: mul || 1, bns: bns > 1 ? bns : 1, x, y, hx: F.s ? -1 : 1, hy: 0, str: 1, coh: 1, ammo: 1, fuel: 1, ent: 0, goal: null, slot: null, path: null, pi: 0, needPath: false, pathT: -99, noPath: false, moving: false, tgt: null, fireT: -99, hitT: -99, seenT: -99, active: false, dead: false, state: 'ok', assault: false, ned: 9, ne: null, dS: 0, dC: 0, xp: F.xp, trail: [] };
    u.mor0 = clamp(.62 + .45 * ((F.xp || 1) - 1) + (/para|glider|ranger|cdo|fj/.test(key) || /Guards|SS|Fallschirm|Parachute|Commando|Ranger|Hermann Goering|Lehr/.test(F.n) ? .12 : 0) - (/Costier|Coastal|Kuest|Bodenst|stragglers/.test(name || '') || /Costier|Coastal/.test(F.n) ? .15 : 0), .3, .95); u.mor = u.mor0; u.inC = 0; u.broken = false; u.aaRole = !!k.aa;
    u.ext = u.bns > 1 && k.cls !== 'art' && k.cls !== 'hq' ? (u.bns - 1) * EXT_KM : 0;
    S.subs.push(u); return u;
  }
  function spread(F, x, y, r) {
    let i = 0; for (const u of F.subs) { if (u.mv === 'ship') continue; const a = i * 2.4, rr = r * (.3 + .7 * ((i * .37) % 1)); const p = map.snap(u.mvi, x + Math.cos(a) * rr, y + Math.sin(a) * rr, 6) || [x, y]; u.x = p[0]; u.y = p[1]; i++; }
  }
  sc.forms.forEach((fs, fi) => {
    const F = { id: fi, s: fs.s, nat: fs.nat, n: fs.n, cmd: { n: fs.cmd, ag: clamp(fs.ag + (rnd() - .5) * (.08 + .08 * VR), .2, .98), sk: clamp(fs.sk + (rnd() - .5) * (.08 + .08 * VR), .3, .98), why: fs.why || '' }, xp: (fs.xp || 1) * dfS(fs.s).xp, subs: [], hq: null, order: null, stock: 0, cap: 0, active: false, dead: false, arr: fs.arr || null, ai: fs.ai ? fs.ai.map(a => ({ t: sc.aiExact ? a.t + rnd() * 3 : a.t > 2 ? a.t * (.92 + rnd() * .22) * plan[fs.s].tm * dfS(fs.s).arr : a.t, path: a.path, line: a.line, then: a.then, cond: a.cond })) : null, aiI: 0, res: !!fs.res, hold: !!fs.hold, stay: !!fs.stay, stayUntil: fs.stayUntil || 0, stayMinStr: fs.stayMinStr || 0, rearPt: fs.rear || null, freeT: (fs.free != null ? fs.free : (sc.sides[fs.s].free || 0)) * 60, x: fs.x, y: fs.y, cx: fs.x, cy: fs.y, halt: false, assaultT: 0, evalT: 0, msgT: 0, casCd: 0, airMsgT: 0, convT: 0, convoy: null, isolated: false, isoMsgT: 0, paraT: 0, status: '', nextT: fi * .37, bridge: null, needEng: false, dis: 0, jamT: 0, jamMsgT: 0, haltT: 0, rerouteT: 0, fired: 0, fallT: 0, idleT: 0, led: {}, ledN: {}, att: null };
    for (const sp of fs.sub) { const a = sp.split('|'); F.subs.push(mkSub(F, a[0], a[1], a[2] ? +a[2] : 1, fs.x, fs.y, a[3] ? +a[3] : 1)); }
    // regiments, brigades and combat commands: groups of the division's battalions (France 1944 scenarios only)
    if (fs.regs) { F.regs = fs.regs.map(r => ({ n: r.n, role: r.role || 'man', subs: r.idx.map(i => F.subs[i]).filter(Boolean) })); for (const R of F.regs) for (const u of R.subs) u.reg = R; }
    const abn = ((fs.arr && fs.arr.mode === 'air') || /Parachute|Glider|Airlanding|Fallschirm|FJR/.test(fs.n)) && KIND['hq_' + fs.nat.toLowerCase() + '_abn'];
    F.abn = !!abn; F.hq = mkSub(F, 'hq_' + fs.nat.toLowerCase() + (abn ? '_abn' : ''), 'HQ, ' + fs.n, 1, fs.x, fs.y); F.subs.push(F.hq);
    F.cap = 1.5 + F.subs.reduce((a, u) => a + u.size, 0) * 1.5; F.stock = F.cap * .7;
    S.forms.push(F);
    if (!F.arr) { activate(F, true); if (fs.line) { F.order = mkOrder(F, [], fs.line); F.order.st = 'done'; F.order.stretch = !!(fs.stretch || (sc.thin && sc.thin.some(r => r.test(F.n)))); F.order.prog = F.order.L; const sl = lineSlots(F, F.order); for (const u of F.subs) { const p = sl.get(u); if (p) { u.x = p[0]; u.y = p[1]; u.slot = p; u.ent = fs.dug ? 1 : .4; } } F.status = 'Holding position'; } }
    else { { const vf = [.25, 1, 1.8][VR], rd = F.arr.mode === 'road'; F.arrT = F.arr.t * 60 * (F.arr.t > 2 ? dfS(F.s).arr : 1) + (rd ? 0 : 20) + (F.arr.t > 2 ? (rd && F.arr.t > 8 ? rnd() * 1.25 - .25 : rnd()) * (rd ? 240 : 120) * vf : 0); } F.stock = F.cap * (F.arr.mode === 'road' ? .7 : .6); F.status = 'Arrives ' + S.clock(F.arrT); }
  });
  if (VR) {
    for (const u of S.subs) if (u.cls !== 'hq' && u.mv !== 'ship') u.str = 1 - rnd() * .05 * VR;
    for (const F of S.forms) { const m = 1 + (rnd() - .5) * .16 * VR; for (const u of F.subs) u.xp *= m; }
    for (let s = 0; s < 2; s++) { const c = S.forms.filter(F => F.s === s && F.ai && F.ai.length && !F.hold); if (c.length < 3) continue;
      const m = c[Math.floor(rnd() * c.length)]; m.main = true; m.cmd.ag = Math.min(.98, m.cmd.ag + .1); m.stock = m.cap; for (const u of m.subs) { u.xp *= 1.08; u.str = 1; }
      for (let k = 0; k < VR; k++) { const l = c[Math.floor(rnd() * c.length)]; if (l === m || l.late) continue; l.late = true; const d = 3 + rnd() * 5; for (const a of l.ai) if (a.t > 2) a.t += d; } }
  }
  S.mkBenches = () => { for (const F of S.forms) F.bench = mkBench(F); };
  function activate(F, init) {
    F.active = true; spread(F, F.x, F.y, .9);
    for (const u of F.subs) { u.active = true; if (F.arr && !init) u.coh = F.arr.mode === 'sea' ? .75 : 1; }
    if (F.arr && !init && F.arr.mode === 'air') airDrop(F);
    centroid(F);
    if (!init && F.arr.mode === 'sea') { let n = 0; for (const e of S.subs) if (e.s !== F.s && e.active && !e.dead && e.cls !== 'hq' && e.coh > .3 && Math.hypot(e.x - F.x, e.y - F.y) < 2.6) n++; if (n) { const loss = Math.min(.22, .06 * n); for (const u of F.subs) { u.str -= loss * (.6 + rnd() * .8); u.coh = Math.max(.3, u.coh - .15); u.hitT = S.t; } S.losses[F.s] += loss * F.subs.length * .7; say(F, 'Took fire in the run-in from ' + n + ' enemy unit' + (n > 1 ? 's' : '') + ' on the beach. About ' + Math.round(loss * 100) + ' percent losses.', 2); S.ev.push({ k: 'townfire', x: F.x, y: F.y }); } }
    if (!init) say(F, F.arr.mode === 'air' ? 'On the ground and assembling ' + nearTown(F.cx, F.cy) + '.' : F.arr.mode === 'sea' ? 'Ashore ' + nearTown(F.cx, F.cy) + '.' : 'Arriving ' + nearTown(F.cx, F.cy) + '.', 1);
  }
  // ----- airborne: scatter, losses in the air, hot drop zones
  function dropForecast(F, actual) {
    const t = Math.max(S.t, F.arrT || 0), h = S.hourOf(t), night = h < S.dayA || h > S.dayB, wx = actual ? S.wx : sc.weather[Math.min(sc.weather.length - 1, Math.floor(t / 720))];
    let R = .8, flak = 0; const why = [];
    if (night) { R += 2.6; why.push('darkness'); }
    if (wx === 'cloud') R += .6; else if (wx === 'overcast') { R += 2; why.push('low cloud'); }
    if (F.arr.wind) { R += F.arr.wind * 1.4; why.push('high wind'); }
    for (const e of S.subs) if (e.s !== F.s && e.active && !e.dead && (actual || S.t - e.seenT < 10) && Math.hypot(e.x - F.x, e.y - F.y) < 6) flak += e.k.aa && e.aaRole ? (Math.hypot(e.x - F.x, e.y - F.y) < e.k.aa.r + 1 ? 1.2 * Math.max(e.k.aa.lo, e.k.aa.hi) : .3) : .25;
    flak = Math.min(3, flak); if (flak > .4) { R += flak * .8; why.push('flak'); }
    if (/Glider|Airlanding/.test(F.n)) R *= .7;
    return { R, why, flak, night, wx };
  }
  S.dropForecast = dropForecast;
  function airDrop(F) {
    const fc = dropForecast(F, true), R = fc.R * (.7 + rnd() * .7), notes = []; let loss = 0;
    if (flyable() && S.air[1 - F.s].groups.some(g => g.mission === 'cap' && g.avail >= 4) && rnd() < .4) { loss += .04 + rnd() * .08; notes.push('enemy fighters'); }
    if (fc.flak > .4) { loss += fc.flak * .03; notes.push('flak'); }
    if (F.arr.ff) { loss += F.arr.ff; notes.push('friendly naval gunfire'); }
    if (F.arr.seaLoss) { loss += F.arr.seaLoss; notes.push('gliders released short and lost at sea'); }
    const da = rnd() * 6.283, drift = R * .45; let hot = 0;
    for (const u of F.subs) {
      const far = rnd() < clamp(R / 14, 0, .45), rr = far ? R * (1.5 + rnd() * 1.5) : R * Math.sqrt(rnd()), a = rnd() * 6.283;
      const p = map.snap(u.mvi, clamp(F.x + Math.cos(da) * drift + Math.cos(a) * rr, .5, map.w - .5), clamp(F.y + Math.sin(da) * drift + Math.sin(a) * rr, .5, map.h - .5), 8) || map.snap(u.mvi, F.x, F.y, 8) || [F.x, F.y];
      u.x = p[0]; u.y = p[1]; let n = 0; for (const e of S.subs) if (e.s !== F.s && e.active && !e.dead && e.cls !== 'hq' && e.coh > .3 && Math.hypot(e.x - u.x, e.y - u.y) < 1.5) n++;
      if (n) { hot++; u.hitT = S.t; }
      u.str = Math.max(.15, u.str - loss * (.5 + rnd()) - Math.min(.3, .1 * n)); u.coh = clamp(.78 - R * .06 - n * .15, .25, .78);
    }
    if (loss > 0) S.losses[F.s] += loss * F.subs.length * .7;
    say(F, 'Drop scattered over about ' + Math.round(R * 2) + ' km' + (fc.why.length ? ' (' + fc.why.join(', ') + ')' : '') + '.' + (loss > .01 ? ' About ' + Math.round(loss * 100) + ' percent lost in the air: ' + notes.join(', ') + '.' : '') + (hot ? ' ' + hot + ' unit' + (hot > 1 ? 's' : '') + ' came down among the enemy.' : ''), loss > .08 || hot || R > 3 ? 2 : 1, F.x, F.y);
    if (loss > .05) S.ev.push({ k: 'dogfight', x: F.x, y: F.y, a: 0, b: 0, lf: Math.min(3, Math.round(loss * 20)), li: 0 });
  }
  S.setDZ = function (F, x, y) { if (F.trans || F.active || !F.arr || F.arr.mode !== 'air') return 'late'; const p = map.snap(0, x, y, 3); if (!p) return 'water'; F.x = F.cx = p[0]; F.y = F.cy = p[1]; if (!S.planning && F.arrT - S.t < 720) { F.arrT = Math.max(F.arrT, S.t + 360); return 'replan'; } return 'ok'; };
  S.delayLift = function (F, h) { if (!F.trans && !F.active) F.arrT = Math.max(F.arrT, S.t) + h * 60; };
  S.holdLift = function (F, b) { if (F.trans || F.active) return; F.hold = b; if (!b && F.arrT < S.t + 40) F.arrT = S.t + 40; };
  function centroid(F) { let x = 0, y = 0, n = 0; for (const u of F.subs) if (u.active && !u.dead && !u.det && LEADCLS[u.cls]) { x += u.x; y += u.y; n++; } if (!n) for (const u of F.subs) if (u.active && !u.dead && !u.det && !u.fm && u.mv !== 'ship') { x += u.x; y += u.y; n++; } if (n) { F.cx = x / n; F.cy = y / n; } }
  S.alive = alive; S.leads = leads;
  function pow(u) { return (u.k.sa + u.k.ha) * u.str * u.size * (.4 + .6 * u.coh) * u.xp * (1 - .4 * u.f.dis); }
  function defPow(u) { return pow(u) * (1 + u.ent * .8) / COVER[map.tAt(u.x, u.y)]; }
  S.strength = F => { let a = 0, b = 0; for (const u of F.subs) if (u.active || F.arr) { b += u.size; if (!u.dead) a += u.size * u.str; } return b ? a / b : 0; };
  S.cohesion = F => { let a = 0, b = 0; for (const u of F.subs) if (u.active && !u.dead) { a += u.coh * u.size; b += u.size; } return b ? a / b : 0; };

  // ---------- orders ----------
  function mkOrder(F, path, line) {
    centroid(F); const P = [[F.cx, F.cy]];
    for (const p of path) if (Math.hypot(p[0] - P[P.length - 1][0], p[1] - P[P.length - 1][1]) > .5) P.push([p[0], p[1]]);
    const ll = polyLen(line), mid = polyAt(line, ll / 2);
    if (Math.hypot(mid.x - P[P.length - 1][0], mid.y - P[P.length - 1][1]) > .4) P.push([mid.x, mid.y]);
    return { path: P, line: line.map(p => [p[0], p[1]]), L: polyLen(P), st: 'pending', t0: S.t, prog: 0, best: 0, bestT: S.t, bestD: 1e9, slots: null, slotT: -999, why: '' };
  }
  function segX(a, b, c, d) { const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1], den = rx * sy - ry * sx; if (Math.abs(den) < 1e-9) return null; const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den; if (t < 0 || t > 1 || u < 0 || u > 1) return null; return [a[0] + rx * t, a[1] + ry * t, u]; }
  // friendly lines of advance that the path P would cross (ahead of the other formation's present position)
  const CROSS_COS = Math.cos(35 * Math.PI / 180);   // routes within 35 degrees of the same direction do not count as crossing
  S.crossings = function (F, P, skip) {   // skip: formations whose orders are being replaced by the same corps order (fix A3)
    const out = [];
    for (const G of S.forms) {
      if (G === F || (skip && skip.has(G)) || G.s !== F.s || !G.active || G.dead || !G.order) continue; const O = G.order; if ((O.st !== 'active' && O.st !== 'pending') || O.L < 1.5 || O.prog >= O.L - .5) continue;
      let acc = 0, hit = null;
      for (let j = 1; j < O.path.length && !hit; j++) { const c = O.path[j - 1], d = O.path[j], l = Math.hypot(d[0] - c[0], d[1] - c[1]); for (let i = 1; i < P.length; i++) { const x = segX(P[i - 1], P[i], c, d); if (!x || acc + x[2] * l < O.prog + .3 || Math.hypot(x[0] - P[0][0], x[1] - P[0][1]) < .8) continue; { const ux = P[i][0] - P[i - 1][0], uy = P[i][1] - P[i - 1][1], vx = d[0] - c[0], vy = d[1] - c[1], uu = Math.hypot(ux, uy) * Math.hypot(vx, vy); if (uu > 0 && (ux * vx + uy * vy) / uu > CROSS_COS) continue; } /* columns on the same road heading the same way follow one another: road sharing slows them, they do not cross */  hit = { G, x: x[0], y: x[1] }; break; } acc += l; }
      if (hit) out.push(hit);
    }
    return out;
  };
  S.issueOrder = function (F, path, line, opt) {
    opt = opt || {}; if (F.s === player) { const L = line && line.length ? line : path; if (L && L.length) { let mx = 0, my = 0; for (const q of L) { mx += q[0]; my += q[1]; } mx /= L.length; my /= L.length; if (S.haltBlock(F, mx, my)) { say(F, sc.halt.why, 2); F.status = 'Held at the army group boundary'; return 'halt'; } } }
    const pend = F.order && F.order.st === 'pending', prev = F.order && F.order.st === 'active' && F.order.L > 1, pendLeft = pend ? Math.max(0, F.order.t0 - S.t) : 0;
    const O = mkOrder(F, path, line); let delay = 0; O.then = THEN[opt.then] ? opt.then : null; O.forH = opt.forH > 0 ? +opt.forH : 0; O.ext = opt.ext || 0; O.own = !!opt.own; O.stretch = !!opt.stretch; O.byCmd = !!opt.byCmd; O.press = opt.press >= 0 && opt.press <= 3 ? opt.press | 0 : 1;
    if (!S.planning && !opt.free) { delay = (25 + 70 * (1 - F.cmd.sk)) * (DOCT[F.nat] || DOCT.US).delay * (prev ? 1.6 : 1) * (F.s === player ? DF.delay : 1) * (1 + (rnd() - .3) * .25 * VR); if (prev) { F.dis = Math.min(1, F.dis + .15); for (const u of alive(F)) u.coh = Math.max(.15, u.coh - .08); } if (F.post === 'reserve') delay *= .5; else if (F.post === 'dig') delay += 20; }
    const X = S.crossings(F, O.path, opt.sisters); O.cross = X; if (X.length) { delay += Math.min(60, 30 * X.length); F.dis = Math.min(1, F.dis + .25); for (const q of X) { q.G.dis = Math.min(1, q.G.dis + .25); q.G.jamT = Math.max(q.G.jamT, S.t + 30); say(F, 'Our line of advance crosses that of ' + q.G.n + ' ' + nearTown(q.x, q.y) + '. Both columns will be delayed and disordered.', 2, q.x, q.y); } }
    O.t0 = S.t + delay; F.order = O; F.post = null; F.halt = false; F.assaultT = 0; F.bridge = null; F.needEng = false; F.haltT = 0;
    if (pend && delay) { delay = Math.min(delay, pendLeft + 10); O.t0 = S.t + delay; }
    F.status = delay ? 'Preparing orders (' + Math.round(delay) + ' min)' : 'Orders received';
    return delay;
  };
  S.clearOrder = function (F) { const O = F.order; if (!O) return false; if (O.st === 'pending' || O.st === 'refused') { F.order = null; F.post = null; F.halt = false; F.status = 'Order cancelled'; return true; } S.halt(F); return true; };
  // detach battalions to seize and hold a point; they take no part in the formation's orders until told to rejoin
  S.detach = function (F, idx, x, y) {
    const us = idx.map(i => F.subs[i]).filter(u => u && u.active && !u.dead && u.cls !== 'hq' && u.mv !== 'ship'); let k = 0;
    for (const u of us) { const a = k++ * 2.4, r = us.length > 1 ? .35 : 0, p = map.snap(u.mvi, x + Math.cos(a) * r, y + Math.sin(a) * r, 5); if (!p) continue; u.det = { x: p[0], y: p[1] }; if (u.k.aa) u.aaRole = true; u.slot = null; u.goal = [p[0], p[1]]; u.needPath = true; u.noPath = false; u.path = null; u.assault = false; if (u.state === 'retreat') u.state = 'ok'; }
    if (us.length) say(F, us.length === 1 ? us[0].n + ' detached to hold ' + nearTown(x, y).replace('near ', '') + '.' : us.length + ' battalions detached to hold ' + nearTown(x, y).replace('near ', '') + '.', 1);
    return us.length;
  };
  S.rejoin = function (F, idx) { let n = 0; for (const i of idx) { const u = F.subs[i]; if (u && u.det) { u.det = null; u.slot = null; u.goal = null; u.path = null; n++; } } if (n) say(F, n + (n === 1 ? ' battalion rejoins' : ' battalions rejoin') + ' the formation.', 0); return n; };
  // corps and division artillery: DS is an ordinary attachment; R, GS and GSR stay under corps control and fire across the front
  S.fpri = [null, null];
  S.setFpri = function (s, x, y) { S.fpri[s] = x == null ? null : [x, y]; return true; };
  S.fires = function (s, idx, m, fid) {
    const it = S.pool[s][idx]; if (!it || S.t < it.t * 60 || (it.sub && it.sub.dead) || KIND[it.k].cls !== 'art') return false;
    let G = fid >= 0 ? S.forms[fid] : null; if (G && (G.s !== s || !G.active || G.dead)) G = null;
    if (!G) { let bd = 1e9; for (const H of S.forms) if (H.s === s && H.active && !H.dead && leads(H).length) { const d = Math.hypot(H.cx - it.x, H.cy - it.y); if (d < bd) { bd = d; G = H; } } }
    if (!G) return false;
    if (it.F !== G) S.attach(G, it); const u = it.sub; if (!u) return false;
    const was = u.fm || 'DS', now = m === 'DS' ? null : m; u.fm = now; u.slot = null; u.goal = null; u.path = null; if (G.order) G.order.slots = null;
    if (was !== (now || 'DS')) u.fmT = S.t + 20;
    say(G, it.n + ': ' + (now ? FMISS[now] + (now === 'GS' ? '' : ' to ' + G.n) : 'direct support of ' + G.n) + '. New fire plan in 20 minutes.', 0);
    return true;
  };
  // a second leg, prepared now and carried out when the current objective is reached
  S.queueOrder = function (F, path, line, opt) { const O = F.order; if (!O || O.st === 'done' || O.st === 'refused' || !Array.isArray(path) || !Array.isArray(line) || line.length < 2) return false; O.next = { path: path.map(p => [+p[0], +p[1]]), line: line.map(p => [+p[0], +p[1]]), opt: { then: opt && opt.then, forH: opt && opt.forH, stretch: !!(opt && opt.stretch), press: opt && opt.press } }; say(F, 'Next leg noted. We move on to it once the present objective is taken.', 0); return true; };
  // the staff estimate before an order goes out: time to the objective, the odds on arrival against the enemy we know of, the odds the commander wants, and how long supply lasts in a fight
  S.estimate = function (F, path, line, press) { if (!F || !line || line.length < 2) return null; const L = leads(F); if (!L.length) return null; centroid(F);
    const mid = polyAt(line, polyLen(line) / 2), pts = [[F.cx, F.cy], ...(path || []), [mid.x, mid.y]]; let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let pace = F.pace; if (!pace) { pace = 1e9; for (const u of L) pace = Math.min(pace, baseSpeed(u)); } const delay = S.planning ? 0 : 25 + 70 * (1 - F.cmd.sk), eta = delay + len * 1.25 / Math.max(pace * .8, .005);
    const en = S.subs.filter(e => e.s !== F.s && e.active && !e.dead && e.cls !== 'hq' && e.mv !== 'ship' && S.t - e.seenT < 60 && (Math.hypot(e.x - mid.x, e.y - mid.y) < 3 || line.some(q => Math.hypot(e.x - q[0], e.y - q[1]) < 2)));
    let own = 0, ep = 0; for (const u of alive(F)) own += pow(u) * (LEADCLS[u.cls] ? 1 : u.cls === 'art' ? .7 : .4); for (const e of en) ep += defPow(e);
    const need = (1.75 - .85 * F.cmd.ag) * (1 + clamp(S.learn ? F.led.gen || 0 : 0, -.45, .5)) * PRESS[press == null ? 1 : press].need;
    let burn = 0; for (const u of F.subs) if (u.active && !u.dead && u.mv !== 'ship') burn += u.size * (RATION / 24 + 30 * (u.cls === 'art' ? AMMO.ind * 1.5 : u.cls === 'arm' ? AMMO.arm : LEADCLS[u.cls] || u.cls === 'at' ? AMMO.inf : 0) * fireRate(F));
    return { eta, len, n: en.length, ratio: en.length ? own / Math.max(ep, .05) : null, need, supH: burn > 0 ? F.stock / burn : null }; };
  S.setPress = function (F, p) { const O = F.order; if (!O || !(p >= 0 && p <= 3)) return false; O.press = p | 0; F.msgT = 0; say(F, PRESS[O.press].n + (O.press >= 2 ? ': we press the attack and accept the losses.' : O.press === 0 ? ': we feel forward and stop at serious resistance.' : ': a deliberate attack, with the odds we judge we need.'), 0); return true; };
  S.setThen = function (F, then, forH) { const O = F.order; if (!O || !THEN[then]) return false; O.then = then; O.forH = forH > 0 ? +forH : 0; if (O.st === 'done') { O.doneT = S.t; O.str0 = S.strength(F); } return true; };
  S.halt = function (F) { F.order = null; F.post = null; for (const u of field(F)) { u.goal = null; u.slot = null; u.path = null; u.assault = false; } F.halt = false; F.status = 'Halted on your order'; };
  // the officer waiting to take over a formation: a veteran from another front, an experienced officer, or the deputy promoted from within
  function mkBench(F) {
    const names = CMD_NAMES[F.nat]; let n, g = 0; do { n = names[Math.floor(rnd() * names.length)]; } while ((n === F.cmd.n || S.forms.some(G => G.cmd.n === n)) && g++ < 12);
    const r = rnd(), kind = r < .25 ? 'vet' : r < .7 ? 'exp' : 'dep', led = {}, keys = Object.keys(LESSON).filter(k => k !== 'gen');
    const ag = kind === 'vet' ? .6 + rnd() * .35 : kind === 'exp' ? .4 + rnd() * .4 : .35 + rnd() * .4, sk = kind === 'vet' ? .7 + rnd() * .25 : kind === 'exp' ? .5 + rnd() * .3 : .4 + rnd() * .3;
    const nl = kind === 'vet' ? 2 + Math.floor(rnd() * 2) : kind === 'exp' ? 1 + Math.floor(rnd() * 2) : 0; for (let i = 0; i < nl; i++) { const k = keys.splice(Math.floor(rnd() * keys.length), 1)[0], m = kind === 'vet' ? .12 + rnd() * .14 : .08 + rnd() * .1; led[k] = rnd() < (kind === 'vet' ? .65 : .5) ? -m : m; }
    return { n, kind, ag, sk, led };
  }
  S.benchText = F => { const b = F.bench; if (!b) return ''; const ls = Object.keys(b.led).map(k => (b.led[k] > 0 ? 'wary of ' : 'confident ') + LESSON[k]);
    return b.n + ', ' + ({ vet: 'a veteran commander from another front', exp: 'an experienced officer from the staff', dep: 'the deputy commander, promoted from within' })[b.kind] + '. ' + (b.kind === 'dep' ? 'He knows the formation, so it reorganises in two hours, and he keeps about 60 percent of the lessons it has learned.' : ls.length ? 'He brings his own lessons: ' + ls.join(', ') + '.' : 'He brings no fixed habits.'); };
  // the price of a relief depends on the moment: in contact, in a lull, at rest, after a defeat or a success, and how often it has been done
  S.fireState = function (F) {
    const b = F.bench || (F.bench = mkBench(F)), dep = b.kind === 'dep', A = alive(F), contact = A.some(u => LEADCLS[u.cls] && (u.ned < 2 || S.t - u.hitT < 15)), O = F.order;
    const base = contact ? (O && (O.st === 'active' || O.st === 'pending') && O.L > 1 ? 'attack' : 'defend') : (F.post === 'rest' || F.post === 'reserve') ? 'rest' : 'lull';
    const res = !contact && F.lastRes && S.t - F.lastRes.t < 360 ? (F.lastRes.bad ? 'defeat' : 'success') : null, rep = (F.fireT || []).filter(t => S.t - t < 1440).length;
    let hm = base === 'attack' ? 1.5 : base === 'rest' ? .67 : 1, cm = base === 'rest' ? .5 : 1, dm = base === 'rest' ? .5 : 1; if (res === 'defeat') cm *= .5; if (res === 'success') cm *= 1.5; const esc = Math.pow(1.35, rep); hm *= esc; cm *= esc; dm *= esc;
    const hrs = Math.round((dep ? 2 : 3) * hm * 4) / 4, coh = (dep ? .12 : b.kind === 'vet' ? .15 : .2) * cm, dis = (dep ? .22 : .35) * dm, notes = [];
    if (base === 'attack') notes.push('The attack in progress is cancelled, and the troops will count it as a costly failure.'); if (base === 'defend') notes.push('Until he has command, the formation cannot fall back, counterattack or call for aircraft.'); if (base === 'rest') notes.push('Out of the line, the change goes quickly and quietly.');
    if (res === 'defeat') notes.push('After a costly action the troops expect a change' + (b.kind === 'vet' ? ', and a veteran will lift them once he has command.' : '.')); if (res === 'success') notes.push('The formation has just won an action. Removing its commander will puzzle the troops and make neighbouring commanders warier.'); if (rep) notes.push('This formation has changed commanders ' + (rep === 1 ? 'once' : rep + ' times') + ' in the last day, so the staff has little continuity left.');
    return { base, res, rep, hrs, coh, dis, notes, label: ({ attack: 'In contact, attacking', defend: 'In contact, defending', rest: F.post === 'reserve' ? 'In reserve' : 'Resting out of contact', lull: 'A lull, formation in the line' })[base] + (res === 'defeat' ? ', after a costly action' : res === 'success' ? ', after a success' : '') };
  };
  S.fire = function (F) {
    const q = S.fireState(F), b = F.bench, old = F.cmd.n, dep = b.kind === 'dep';
    if (q.base === 'attack' && S.learn) { const tags = F.att ? F.att.tags : ['gen'], d = .13 * (.6 + .8 * F.cmd.sk); for (const k of tags) { const dd = d * (k === 'gen' ? .4 : 1); F.led[k] = clamp((F.led[k] || 0) + dd, -.4, .4); for (const G of S.forms) if (G !== F && G.s === F.s && G.active && !G.dead && Math.hypot(G.cx - F.cx, G.cy - F.cy) < 15) G.led[k] = clamp((G.led[k] || 0) + dd * .5, -.4, .4); } }
    if (q.res === 'success' && S.learn) for (const G of S.forms) if (G !== F && G.s === F.s && G.active && !G.dead && Math.hypot(G.cx - F.cx, G.cy - F.cy) < 15) G.led.gen = clamp((G.led.gen || 0) + .05, -.4, .4);
    F.cmd = { n: b.n, ag: b.ag, sk: b.sk, kind: b.kind }; F.fired++; (F.fireT || (F.fireT = [])).push(S.t); F.att = null; F.ledN = {}; F.lastRes = null;
    if (dep) { for (const k in F.led) F.led[k] *= .6; F.ledBase = {}; } else { F.led = Object.assign({}, b.led); F.ledBase = Object.assign({}, b.led); }
    F.dis = Math.min(1, F.dis + q.dis); for (const u of alive(F)) u.coh = Math.max(.12, u.coh - q.coh - (q.base === 'attack' && u.ned < 2 ? .05 : 0));
    F.paraT = S.t + q.hrs * 60; F.liftT = q.res === 'defeat' && b.kind === 'vet' ? F.paraT : 0; F.halt = false; F.assaultT = 0; F.evalT = 0; F.msgT = 0; for (const u of alive(F)) u.assault = false;
    if (F.order && (F.order.st === 'refused' || F.order.st === 'active')) { F.order.st = 'pending'; F.order.t0 = F.paraT; }
    say(F, old + ' relieved of command. ' + b.n + ' takes over, ' + ({ vet: 'a veteran from another front', exp: 'an experienced officer from the staff', dep: 'his deputy' })[b.kind] + '. ' + q.label + ': the formation needs ' + q.hrs + ' hours to reorganise.', 2); F.status = 'Reorganising under new commander';
    F.bench = mkBench(F);
  };
  S.attach = function (F, it) {
    if (S.t < it.t * 60) return false;
    if (it.sub && !it.sub.dead) { const u = it.sub, o = u.f; o.subs.splice(o.subs.indexOf(u), 1); u.f = F; u.xp = F.xp; F.subs.push(u); u.slot = null; u.goal = null; if (o.order) o.order.slots = null; }
    else { const u = mkSub(F, it.k, it.n, it.size || 1, it.x, it.y); const p = u.mv === 'ship' ? [it.x, it.y] : (map.snap(u.mvi, it.x, it.y, 6) || [it.x, it.y]); u.x = p[0]; u.y = p[1]; u.active = true; u.pool = it; it.sub = u; F.subs.push(u); F.stock += u.size * 2 * (F.cap > 0 ? F.stock / F.cap : 1); F.cap += u.size * 2; }   /* a battalion from the pool brings its own load at the division's present level: attaching it raised the division's capacity alone, so the supply bar fell with the clock stopped (fix A5) */
    it.F = F; it.sub.fm = null; it.sub.fmT = 0; if (F.order) F.order.slots = null; if (it.sub.cls === 'eng') F.needEng = false; return true;
  };
  function canComply(F, O) {
    const A = field(F), L = leads(F); if (!L.length) return 'no fighting units left';
    const hard = F.cmd.ag < .82;
    if (hard && S.cohesion(F) < .3) return 'the formation is disorganised and must rally first';
    if (hard && S.strength(F) < .28) return 'the formation is combat ineffective';
    let am = 0, fu = 0, nv = 0; for (const u of A) { am += u.ammo; if (u.mv !== 'foot') { fu += u.fuel; nv++; } } am /= A.length;
    if (am < .12 && F.stock < 1) return 'ammunition is exhausted';
    if (nv && fu / nv < .06 && F.stock < 1) return 'vehicles are out of fuel';
    if (O.L > 1.5) { const u = L[0], e = polyAt(O.path, O.L); const p = map.findPath(u.mvi, F.cx, F.cy, e.x, e.y); if (!p) { const b = nearBridge(e.x, e.y, O); if (!(b && A.some(q => q.cls === 'eng'))) return b ? 'the ' + b.name + ' is down and we have no engineers' : 'there is no passable route to the objective'; } }
    return '';
  }
  function nearBridge(x, y, O) { let best = null, bd = 12; for (const b of map.bridges) if (!b.intact && !b.gone) { const d = O ? segMin(O.path, b.x, b.y) : Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } } return bd < 6 ? best : null; }
  function segMin(P, x, y) { let d = 1e9; for (let i = 1; i < P.length; i++) d = Math.min(d, segDist(x, y, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1])); return d; }
  function rearDir(F, O) {
    const P = O.path, n = P.length; let dx = 0, dy = 0;
    if (O.L > 1.5) { dx = P[n - 2][0] - P[n - 1][0]; dy = P[n - 2][1] - P[n - 1][1]; }
    else if (F.rearPt) { const m = polyAt(O.line, polyLen(O.line) / 2); dx = F.rearPt[0] - m.x; dy = F.rearPt[1] - m.y; }
    else { dx = sc.sides[F.s].rear[0]; dy = sc.sides[F.s].rear[1]; }
    // make perpendicular to the line
    const a = O.line[0], b = O.line[O.line.length - 1]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; } return [nx, ny];
  }
  // frontage a battalion can hold: about 2 km in open ground, 1 km in close country (FM 7-10 gives a company 800-1,000 yards in the open, 500 in close terrain; two companies forward)
  function frontAt(x, y) { return COVER[map.tAt(x, y)] < .62 ? 1 : 2; }
  // frontage per battalion along a stretch of line: the length-weighted mean of 1 km (close) and 2 km (open), sampled every 250 m
  function frontLine(line, a, b) { const ll = polyLen(line); a = a || 0; b = b == null ? ll : b; let t = 0, n = 0; for (let s = a; s <= b + 1e-6; s += .25) { const q = polyAt(line, Math.min(s, ll)); t += frontAt(q.x, q.y); n++; } return n ? t / n : 2; }
  // how much of a line the formation's battalions can hold: [km held, km of line, battalions forward]
  S.frontage = function (F, line) { const A = field(F), L = A.filter(u => LEADCLS[u.cls] && u.str >= .3), n = Math.max(0, L.length - (L.length >= 7 ? 2 : L.length >= 4 ? 1 : 0)), ll = polyLen(line); return [n * frontLine(line), ll, n]; };
  // a battalion in a line faces square to its own stretch of the line, away from the rear (a curved perimeter faces outward all round)
  function faceOf(p, r) { let nx = -p.dy, ny = p.dx; if (nx * r[0] + ny * r[1] > 0) { nx = -nx; ny = -ny; } return [nx, ny]; }
  function lineSlots(F, O) {
    const out = new Map(), A = field(F), L = A.filter(u => LEADCLS[u.cls] && u.str >= .3), AT = A.filter(u => u.cls === 'at');
    const r = rearDir(F, O), ll = polyLen(O.line), [sa, sb] = bankRange(F, O, ll), le = sb - sa, mid = polyAt(O.line, sa + le / 2);
    const a = O.line[0], b = O.line[O.line.length - 1], lx = b[0] - a[0], ly = b[1] - a[1], along = (u, v) => (u.x * lx + u.y * ly) - (v.x * lx + v.y * ly);
    let res = [], rank = null;
    const man = F.regs ? F.regs.filter(R => R.role === 'man' && R.subs.some(u => L.indexOf(u) >= 0)) : [];
    if (man.length >= 2) {
      // a division: two regiments up and one back when it has three or more and the order does not stretch it; each regiment keeps its battalions together
      const pos = R => { const us = R.subs.filter(u => L.indexOf(u) >= 0); return us.reduce((s, u) => s + u.x * lx + u.y * ly, 0) / us.length; };
      const strength = R => R.subs.filter(u => L.indexOf(u) >= 0).reduce((s, u) => s + u.str * u.size, 0);
      const byPos = man.slice().sort((p, q) => pos(p) - pos(q));
      F.resReg = null;
      if (byPos.length >= 3 && !O.stretch) { let best = byPos[Math.floor(byPos.length / 2)]; for (const R of byPos) if (strength(R) < strength(best) - .05) best = R; F.resReg = best; res = L.filter(u => u.reg === best); }
      const up = byPos.filter(R => R !== F.resReg); rank = new Map(); up.forEach((R, i) => rank.set(R, i));
      for (const u of L) if (!u.reg || !rank.has(u.reg)) { if (res.indexOf(u) >= 0) continue; let bi = 0, bd = 1e9; up.forEach((R, i) => { const d = Math.abs(pos(R) - (u.x * lx + u.y * ly)); if (d < bd) { bd = d; bi = i; } }); u.rgRank = bi; } else u.rgRank = rank.get(u.reg);
    } else if (L.length >= 4) { const pick = L.filter(u => u.cls === 'arm')[0] || L[L.length - 1]; res = [pick]; if (L.length >= 7) { const p2 = L.filter(u => u !== pick && u.cls !== 'rec')[0]; if (p2) res.push(p2); } }
    const lead = L.filter(u => res.indexOf(u) < 0), fw = frontLine(O.line, sa, sb), tw = lead.reduce((a, u) => a + BW(u), 0), W = tw * fw;
    // a line longer than the battalions can hold becomes a solid sector at its centre, unless the order says to stretch along all of it
    const held = !O.stretch && le > W * 1.1 ? W : le, s0 = sa + (le - held) / 2; O.held = [held, ll]; O.bank = le < ll - .5 ? le : 0;
    if (rank) lead.sort((u, v) => (u.rgRank - v.rgRank) || along(u, v)); else lead.sort(along); AT.sort(along);
    const n = Math.max(1, tw); let cum = 0;
    lead.forEach(u => { const w = BW(u), half = Math.min(fw, held / n) * w / 2, p = polyAt(O.line, s0 + held * (cum + w / 2) / n); cum += w; out.set(u, map.snap(u.mvi, p.x, p.y, Math.min(2, half * .6) / map.cs, true) || [p.x, p.y]); u.sec = { dx: p.dx, dy: p.dy, h: half }; u.face = faceOf(p, r); });
    // anti-tank guns stand at the seams between battalions, a little behind the line
    AT.forEach((u, j) => { const p = polyAt(O.line, s0 + held * ((j % Math.max(1, n - 1)) + 1) / n), x = p.x + r[0] * .3, y = p.y + r[1] * .3; out.set(u, map.snap(u.mvi, x, y, 2, true) || [x, y]); u.sec = null; u.face = faceOf(p, r); });
    const put = (u, d, lat) => { const x = mid.x + r[0] * d - r[1] * lat, y = mid.y + r[1] * d + r[0] * lat; const p = map.snap(u.mvi, x, y, 4, u.cls !== 'art'); if (p) out.set(u, p); };
    res.forEach((u, i) => put(u, rank ? 3.5 : 1.6, (i - (res.length - 1) / 2) * 1.6));   // a reserve regiment stands 3.5 km back, a reserve battalion 1.6 km
    let ai = 0; const arts = A.filter(u => u.cls === 'art' && u.mv !== 'ship');
    for (const u of A) { if (LEADCLS[u.cls] && u.str < .3) put(u, 2.2, 1); else if (u.cls === 'eng') put(u, 1.1, .7); else if (u.cls === 'hq') put(u, 2.6, 0); else if (u.cls === 'art' && u.mv !== 'ship') { put(u, 3.2 + (ai % 2) * .8, (ai - (arts.length - 1) / 2) * 1.3); ai++; } }
    reachFix(O.line, out); return out;
  }
  // a drawn line that crosses water with no bridge is held on one bank only: the stretch nearest where the line of advance meets it
  function bankRange(F, O, ll) {
    if (!O.path || !O.path.length) return [0, ll];
    const k = MVI.foot, st = map.cs / 2, segs = []; let a = null;
    for (let s = 0; s <= ll + 1e-6; s += st) { const q = polyAt(O.line, Math.min(s, ll)), c = map.idx(q.x, q.y), w = (map.t[c] === T.RIVER || map.t[c] === T.SEA) && map.fac[k][c] <= 0;
      if (!w && a == null) a = s; if (w && a != null) { segs.push([a, s - st]); a = null; } }
    if (a != null) segs.push([a, ll]); if (segs.length < 2) return segs.length ? [0, ll] : [0, ll];
    const E = O.path[O.path.length - 1]; let best = segs[0], bd = 1e9;
    for (const g of segs) for (let s = g[0]; s <= g[1] + 1e-6; s += st) { const q = polyAt(O.line, s), d = Math.hypot(q.x - E[0], q.y - E[1]); if (d < bd) { bd = d; best = g; } }
    return best[1] - best[0] < .5 ? [0, ll] : best;
  }
  // a place across water with no bridge moves to the nearest point of the line on the battalion's own bank, so it can get there and the order completes
  function reachFix(line, out) {
    const ll = polyLen(line);
    for (const [u, p] of out) { if (u.mv === 'ship') continue; const k = u.mvi, lab = map.compAt(k, u.x, u.y), C = map.comp(k); if (!lab || C[map.idx(p[0], p[1])] === lab) continue;
      let best = null, bd = 1e9; for (let s = 0; s <= ll; s += .25) { const q = polyAt(line, s); if (C[map.idx(q.x, q.y)] !== lab || map.fac[k][map.idx(q.x, q.y)] <= 0) continue; const d = Math.hypot(q.x - p[0], q.y - p[1]); if (d < bd) { bd = d; best = q; } }
      let np = best ? map.snap(k, best.x, best.y, 2, true, lab) : null;
      for (let r = 4; !np && r <= 16; r *= 2) np = map.snap(k, p[0], p[1], r, false, lab);
      if (np) { out.set(u, np); if (u.sec) u.sec = Object.assign({}, u.sec, { h: Math.min(u.sec.h, .5) }); } }
  }
  function advSlots(F, O, contact) {
    const out = new Map(), A = field(F), P = O.path, L = O.L; for (const u of A) { u.sec = null; u.face = null; }
    if (!contact) {
      const ord = { rec: 0, arm: 1, mech: 2, cdo: 3, inf: 4, at: 5, eng: 6, art: 7, hq: 8 }; const col = A.filter(u => u.mv !== 'ship').sort((a, b) => ord[a.cls] - ord[b.cls]);
      col.forEach((u, i) => { const p = polyAt(P, clamp(O.prog + 2.2 - i * .9, 0, L)); out.set(u, map.snap(u.mvi, p.x, p.y, 3) || [p.x, p.y]); });
      return out;
    }
    const Ld = A.filter(u => LEADCLS[u.cls] && u.str >= .3); for (const u of A) if (LEADCLS[u.cls] && u.str < .3) { const p = polyAt(P, clamp(O.prog - 2.5, 0, L)); const q = map.snap(u.mvi, p.x, p.y, 4); if (q) out.set(u, q); } let res = []; if (Ld.length >= 4) res = [Ld.filter(u => u.cls === 'inf')[0] || Ld[Ld.length - 1]];
    const front = Ld.filter(u => res.indexOf(u) < 0); const f = polyAt(P, Math.min(L, O.prog + 1.4)), nx = -f.dy, ny = f.dx;
    front.sort((u, v) => (u.x * nx + u.y * ny) - (v.x * nx + v.y * ny));
    const sh = F.shift || 0;
    front.forEach((u, i) => { const off = (i - (front.length - 1) / 2) * 1.25 + sh; const x = f.x + nx * off, y = f.y + ny * off; out.set(u, map.snap(u.mvi, x, y, 3, !u.assault) || [x, y]); });
    const at = (u, ds, lat) => { const p = polyAt(P, clamp(O.prog + ds, 0, L)); const x = p.x - p.dy * lat, y = p.y + p.dx * lat; const q = map.snap(u.mvi, x, y, 4); if (q) out.set(u, q); };
    res.forEach(u => at(u, -1.2, 0)); let ai = 0;
    for (const u of A) {
      if (u.cls === 'at') at(u, .4, (ai++ % 2 ? 1 : -1) * .7); else if (u.cls === 'eng') { if (!(F.bridge && !F.bridge.intact)) at(u, -.9, .6); } else if (u.cls === 'hq') at(u, -3, 0);
      else if (u.cls === 'art' && u.mv !== 'ship') { const d = Math.hypot(u.x - f.x, u.y - f.y); if (d > Math.min(u.k.ir * .6, 7) || !u.slot) at(u, -3.4, (ai++ % 2 ? 1 : -1) * .9); }
    }
    return out;
  }
  function setSlot(u, p) {
    if (!p || u.state === 'retreat') return;
    if (!u.slot || Math.hypot(u.slot[0] - p[0], u.slot[1] - p[1]) > .35) { u.slot = p; u.goal = p; u.needPath = true; u.noPath = false; }
    else if (!u.goal && Math.hypot(u.x - u.slot[0], u.y - u.slot[1]) > .5) { u.goal = u.slot; u.needPath = true; }
  }
  const known = e => S.t - e.seenT < 10;
  function knownEnemiesNear(F, list, r) { const out = []; for (const e of S.subs) if (e.s !== F.s && e.active && !e.dead && known(e)) { for (const u of list) if (Math.hypot(u.x - e.x, u.y - e.y) < r) { out.push(e); break; } } return out; }
  function reqCAS(F, e) { if (S.t < F.casCd || !e) return; F.casCd = S.t + 45; const A = S.air[F.s]; A.cas.push({ x: e.x, y: e.y, u: e, F, t: S.t }); if (A.cas.length > 6) A.cas.shift(); }
  function evaluate(F, O, L, en) {
    if (!en.length) { if (L.some(u => u.noPath)) bridging(F, O); else O.bestT = S.t; return; }
    { let am = 0; for (const u of L) am += u.ammo; if (L.length && am / L.length < .25) { if (!F.halt) F.haltT = S.t; F.halt = true; F.assaultT = 0; F.status = 'Halted: awaiting ammunition'; if (S.t > F.msgT) { say(F, 'Ammunition is nearly gone. Halting until the supply column gets through.', 2); F.msgT = S.t + 300; } return; } }
    if (S.strength(F) < .42 && F.cmd.ag < .9 && O.st === 'active') { const f = polyAt(O.path, clamp(O.best, 0, O.L)), hw = Math.max(1.2, L.length * .6); O.line = [[f.x - f.dy * hw, f.y + f.dx * hw], [f.x + f.dy * hw, f.y - f.dx * hw]]; O.path = [[F.cx, F.cy], [f.x, f.y]]; O.L = polyLen(O.path); O.prog = O.L; O.st = 'done'; O.doneT = S.t; O.slots = null; F.halt = false; F.assaultT = 0; F.spent = true; say(F, 'We are fought out at ' + Math.round(S.strength(F) * 100) + ' percent strength. Going over to the defensive ' + nearTown(F.cx, F.cy) + '.', 2); F.status = 'Spent: defending'; return; }
    let own = 0, ep = 0; for (const u of alive(F)) own += pow(u) * (LEADCLS[u.cls] ? 1 : u.cls === 'art' ? .7 : .4); for (const e of en) ep += defPow(e);
    let ec = 0, ee = 0, na = 0, cl = 0, ew = 0; for (const e of en) { const w = Math.max(.05, defPow(e)); ec += e.coh * w; ee += e.ent * w; ew += w; if (e.cls === 'arm') na++; if (COVER[e.tc] < .62) cl++; } ec /= ew; ee /= ew;   // weighted by fighting power
    const tags = ['gen']; if (S.learn) { if (ee > .6) tags.push('dug'); if (S.night) tags.push('night'); if (S.flyable() > 0 && S.air[1 - F.s].groups.some(g => g.mission === 'cas' && g.avail > 0)) tags.push('air'); { let g = 0; for (const e of S.subs) if (e.s !== F.s && e.cls === 'art' && e.active && !e.dead && S.t - e.fireT < 30 && Math.hypot(e.x - F.cx, e.y - F.cy) < 9) g++; if (g >= 2) tags.push('guns'); } if (na) tags.push('armour'); if (cl * 2 >= en.length) tags.push('close'); if (en.length > L.length) tags.push('outnum'); if (F.stock < F.cap * .4) tags.push('supply'); }
    let lw = 0; if (S.learn) for (const k of tags) lw += F.led[k] || 0;
    const PR = PRESS[O.press == null ? 1 : O.press], ratio = own / Math.max(ep, .05), need = (1.75 - .85 * F.cmd.ag) * (ec < .5 ? .75 : 1) * (1 + clamp(lw, -.45, .5)) * PR.need, where = nearTown(en[0].x, en[0].y), cohOk = S.cohesion(F) > PR.coh;
    let top = en[0]; for (const e of en) if (defPow(e) > defPow(top)) top = e;
    reqCAS(F, top);
    if (ratio >= need && cohOk) { if (!F.att) { let s0 = 0, e0 = 0; for (const u of L) s0 += u.str * u.size; for (const e of en) e0 += e.str * e.size; F.att = { t: S.t, tags, r: ratio, s0, e0, en: en.slice(), L: L.slice(), prog: O.prog || 0, where, lbL: lbSum(L), lbE: lbSum(en) }; } F.assaultT = S.t + 90; F.halt = false; F.shift = 0; if (S.t > F.msgT) { say(F, 'Attacking enemy positions ' + where + '.', 1, top.x, top.y); F.msgT = S.t + 120; } F.status = 'Assaulting ' + where; }
    else {
      if (!F.halt) F.haltT = S.t; F.halt = true; F.assaultT = 0;
      // say why: the odds, or battalions too disorganised to attack whatever the odds
      if (ratio >= need) { const c = S.cohesion(F), hrs = Math.max(1, Math.ceil((PR.coh + .05 - c) / (.24 * (.7 + .6 * F.cmd.sk)))); F.status = 'Halted: battalions too disorganised to attack';
        if (S.t > F.msgT) { say(F, 'Halted ' + where + '. The odds are good (' + ratio.toFixed(1) + ' to 1), but the battalions are too disorganised to attack (cohesion ' + Math.round(c * 100) + ' percent). They need about ' + hrs + ' hour' + (hrs > 1 ? 's' : '') + ' out of contact to reorganise.', 2, top.x, top.y); F.msgT = S.t + 360; } }
      else { F.status = 'Halted: enemy too strong ' + where;
        if (S.t > F.msgT || (F.heldR && Math.abs(ratio - F.heldR) > .4)) { F.heldR = ratio; say(F, 'Unable to proceed. Held up ' + where + ' by ' + en.length + ' enemy unit' + (en.length > 1 ? 's' : '') + ' (odds ' + ratio.toFixed(1) + ' to 1; ' + F.cmd.n.split(' ').slice(-1)[0] + ' wants ' + need.toFixed(1) + ' to 1). Request artillery, air or reinforcement, or order the attack pressed harder.', 2, top.x, top.y); F.msgT = S.t + 720; } }
    }
  }
  function bridging(F, O) {
    const f = polyAt(O.path, Math.min(O.L, O.prog + 2)); const b = nearBridge(f.x, f.y, O);
    if (!b) { if ((aiF(F) || O.byCmd) && S.t > (F.xTryT || 0)) { F.xTryT = S.t + 360; const X = S.cross(F, f.x, f.y); if (X && typeof X === 'object') { F.status = 'Assault crossing'; O.bestT = S.t; return; } }   // the staff puts the battalions over in boats
      if (S.t > F.msgT) { const m = polyAt(O.line, polyLen(O.line) / 2), n = Math.max(1, Math.ceil(Math.hypot(m.x - F.cx, m.y - F.cy) / .4)); let riv = false; for (let k = 0; k <= n && !riv; k++) riv = map.t[map.idx(F.cx + (m.x - F.cx) * k / n, F.cy + (m.y - F.cy) * k / n)] === T.RIVER;   // say what bars the way (fix A6)
        say(F, 'No route forward from ' + nearTown(F.cx, F.cy) + (riv ? ': the river bars the way and no bridge on our route is open. Draw the line over a bridge we hold, or order an assault crossing.' : ': no passable road or ground leads to the objective.'), 2); F.msgT = S.t + 720; } O.bestT = S.t; F.status = 'Halted: no route'; return; }
    const eng = field(F).find(u => u.cls === 'eng');
    if (!eng && (aiF(F) || O.byCmd) && S.t > (F.xTryT || 0)) { F.xTryT = S.t + 360; const X = S.cross(F, b.x, b.y); if (X && typeof X === 'object') { F.status = 'Assault crossing'; O.bestT = S.t; return; } }   // no engineers: the staff tries the boats
    if (!eng) { F.needEng = true; F.status = 'Halted: ' + b.name + ' is down'; if (S.t > F.msgT) { say(F, 'The ' + b.name + ' is down. We need engineers attached to bridge it.', 2, b.x, b.y); F.msgT = S.t + 720; } return; }
    if (F.bridge !== b) say(F, 'Engineers moving up to bridge the gap at the ' + b.name + '.', 1, b.x, b.y);
    F.bridge = b; F.status = 'Bridging at ' + b.name; O.bestT = S.t;
    const p = map.snap(eng.mvi, b.x + (F.cx - b.x) * .12 + Math.sign(F.cx - b.x) * .4, b.y + (F.cy - b.y) * .12 + Math.sign(F.cy - b.y) * .4, 3); if (p) setSlot(eng, p);
  }
  // what a formation does once it stands on its objective line: the instruction given with the order, and the commander's own initiative
  function arrived(F, O, L, en, contact) {
    let th = O.then || (aiF(F) ? 'std' : 'hold'); const where = nearTown(F.cx, F.cy), str = S.strength(F), coh = S.cohesion(F), low = F.stock < F.cap * .35;
    if (O.forH && th !== 'reserve' && S.t - O.doneT > O.forH * 60) { O.then = th = 'reserve'; O.forH = 0; say(F, 'Time limit reached. Reverting to reserve ' + where + '.', 1); }
    F.post = th; if (O.str0 == null) O.str0 = str;
    let formed = 0, shaken = 0, sx = 0, sy = 0, nd = 99; for (const e of en) if (LEADCLS[e.cls] || e.cls === 'at') { const d = Math.hypot(e.x - F.cx, e.y - F.cy); if (d < nd) nd = d; if (d < 6) { if (e.coh > .45) formed++; else { shaken++; sx += e.x; sy += e.y; } } }
    if (th === 'dig') F.status = (contact ? 'Defending' : 'Dug in') + ' ' + where;
    else if (th === 'reserve') F.status = contact ? 'Reserve engaged ' + where : 'In reserve ' + where;
    else if (th === 'rest') { F.status = contact ? 'Refit interrupted: under attack ' + where : 'Resting and refitting ' + where; if (!contact) { F.dis = Math.max(0, F.dis - (5 / 240) * (.6 + .8 * F.cmd.sk)); if (!F.isolated && S.t >= (F.convT || 0) - 60) F.convT = Math.min(F.convT || 0, S.t); } }
    else if (th === 'delay') { F.status = (contact ? 'Delaying the enemy' : 'Delay position') + ' ' + where;
      let ep = 0, own = 0; for (const e of en) if (Math.hypot(e.x - F.cx, e.y - F.cy) < 4) ep += pow(e); for (const u of L) own += defPow(u);
      if (contact && S.t > F.fallT && (str < O.str0 - .12 || coh < .5 || ep > own * 1.5)) { const r = rearDir(F, O), nl = O.line.map(p => [p[0] + r[0] * 4, p[1] + r[1] * 4]); if (nl.every(p => p[0] > 1 && p[1] > 1 && p[0] < map.w - 1 && p[1] < map.h - 1)) { O.line = nl; O.slots = null; O.str0 = str; F.fallT = S.t + 90; say(F, 'We have made them deploy. Falling back four kilometres to the next position.', 1); } else { O.then = 'hold'; say(F, 'No ground left to give ' + where + '. Holding here.', 2); } } }
    else if (th === 'exploit') { const lim = F.cmd.ag < .5 ? 5 : 2.5; F.status = 'Exploiting: reorganising ' + where;
      if (S.t - O.doneT >= 20) { const why = low ? 'supply is short' : F.isolated ? 'we are cut off' : str < .5 ? 'the formation is too weak' : coh < .5 ? 'the battalions need to reorganise' : formed && nd < lim ? 'a formed enemy defence lies ahead' : O.ext >= 6 ? 'we have outrun our support' : null;
        if (why) { if (formed || O.ext >= 6 || str < .5) { O.then = 'hold'; say(F, 'Exploitation ends ' + where + ': ' + why + '. Holding.', 2); } else F.status = 'Exploitation paused: ' + why; }
        else { const P = O.path, a = P[Math.max(0, P.length - 2)], b = P[P.length - 1]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy); if (l < .3) { const r = rearDir(F, O); dx = -r[0]; dy = -r[1]; } else { dx /= l; dy /= l; }
          const reach = 4 + 8 * F.cmd.ag; let tx = clamp(F.cx + dx * reach, 1.5, map.w - 1.5), ty = clamp(F.cy + dy * reach, 1.5, map.h - 1.5), tn = null; { const rr = sc.sides[F.s].rear || [0, 0]; for (const v of S.vp) if (v.own !== F.s) { const vx = v.x - F.cx, vy = v.y - F.cy, d = Math.hypot(vx, vy); const near = v.own === 1 - F.s && d < 10;   // an enemy-held objective close by counts whatever its direction
            if (d > 1.5 && d < 20 && (near || ((vx * dx + vy * dy) / d > -.3 && -(vx * rr[0] + vy * rr[1]) / d > -.3)) && (!tn || d < tn.d)) tn = { d, v }; } } if (tn) { tx = tn.v.x; ty = tn.v.y; } else { tx = clamp(tx, 3, map.w - 3); ty = clamp(ty, 3, map.h - 3); }
          if (Math.hypot(tx - F.cx, ty - F.cy) > 2 && autoOrder(F, tx, ty, false, { free: true, then: 'exploit', forH: O.forH, ext: O.ext + 1 })) { say(F, 'The way is open. Exploiting ' + (tn ? 'toward ' + tn.v.n : 'beyond ' + where.replace('near ', '')) + '.', 1); return true; } O.then = 'hold'; say(F, 'Exploitation ends ' + where + ': ' + (tn ? 'no route toward ' + tn.v.n : 'no objective left within reach') + '. Holding.', 1); } } }
    // sent to a town that is still in enemy hands: clear it, or say why not
    if (th === 'hold' && !aiF(F) && !O.own && S.t - O.doneT > 60 && S.t >= (F.clrT || 0) && O.path && O.path.length) {
      const end = O.path[O.path.length - 1]; let tv = null;
      for (const v of S.vp) if (v.own !== F.s && Math.hypot(v.x - end[0], v.y - end[1]) < 2 && Math.hypot(v.x - F.cx, v.y - F.cy) < 4) { tv = v; break; }
      if (tv) { F.clrT = S.t + 180; let ep = 0, mine = 0; for (const e of en) if (Math.hypot(e.x - tv.x, e.y - tv.y) < 1.5) ep += pow(e); for (const u of L) mine += pow(u);
        const why = low ? 'supply is short' : F.isolated ? 'we are cut off' : str < .5 ? 'the formation is too weak' : coh < .5 ? 'the battalions need to reorganise' : ep > mine * 1.2 ? 'the garrison is too strong for us alone' : null;
        if (!why && autoOrder(F, tv.x, tv.y, false, { free: true, then: 'hold' })) { say(F, tv.n + ' is still in enemy hands. Moving in to clear the town.', 1, tv.x, tv.y); return true; }
        say(F, tv.n + ' is still in enemy hands' + (why ? ', and ' + why : '') + '. Holding outside the town.', 2, tv.x, tv.y); } }
    // an aggressive commander told to hold may still take an opening he sees
    if (!aiF(F) && (th === 'hold' || th === 'dig' || th === 'reserve') && F.cmd.ag >= .75 && S.t >= (F.initT || 0) && S.t - O.doneT > 45 && str > .6 && coh > .6 && F.stock > F.cap * .5 && !F.isolated) {
      let tx = null, ty = null, what = null; if (shaken >= 2 && !formed) { tx = sx / shaken; ty = sy / shaken; what = 'the enemy in front of us is breaking'; }
      else if (nd > 5) { let bv = null, bd = 12; const tk = S.urban && L.filter(u => u.cls === 'arm').length * 3 >= L.length; /* with the town rules on, an armored commander does not go for an enemy-held town on his own: a town is infantry work (fix A1) */ for (const v of S.vp) if (v.own !== F.s && !tk) { const d = Math.hypot(v.x - F.cx, v.y - F.cy); if (d < bd && d > 1.5) { bd = d; bv = v; } } if (bv) { tx = bv.x; ty = bv.y; what = 'the road to ' + bv.n + ' is open'; } }
      if (what && rnd() < (F.cmd.ag - .7) * .1 * (DOCT[F.nat] || DOCT.US).init) { F.initT = S.t + 360; if (autoOrder(F, tx, ty, false, { free: true, then: 'hold', own: true })) { say(F, 'I know my orders were to ' + (th === 'reserve' ? 'stay in reserve' : 'hold') + ', but ' + what + '. I am going forward on my own initiative.', 2); S.init = (S.init || 0) + 1; return true; } } }
    return false;
  }
  function cmdTick(F) {
    if (!F.active || F.dead) return; for (const u of F.subs) if (u.det && u.active && !u.dead && u.state !== 'retreat' && !u.goal && Math.hypot(u.x - u.det.x, u.y - u.det.y) > .6) { u.goal = [u.det.x, u.det.y]; u.needPath = true; u.noPath = false; }
    { const D = DOCT[F.nat] || DOCT.US, hq = F.hq && !F.hq.dead && F.hq.active ? F.hq : null, cr = (5 + 5 * F.cmd.sk) * D.crad * (hq ? 1 : .6), hx = hq ? hq.x : F.cx, hy = hq ? hq.y : F.cy; F.crad = cr;
      for (const u of F.subs) u.oc = !!(u.active && !u.dead && u.cls !== 'hq' && u.mv !== 'ship' && !u.det && !u.fm && !INDEP[u.cls] && Math.hypot(u.x - hx, u.y - hy) > cr);
      let pace = 1e9; for (const u of F.subs) if (u.active && !u.dead && !u.det && !u.fm && u.cls !== 'hq' && u.mv !== 'ship' && !INDEP[u.cls] && u.state !== 'retreat') pace = Math.min(pace, baseSpeed(u)); F.pace = pace < 1e8 ? pace : 0;
      const rr = sc.sides[F.s].rear || [0, 0], rl = Math.hypot(rr[0], rr[1]) || 1;
      for (const u of F.subs) { if (!u.fm || !u.active || u.dead || u.state === 'retreat' || S.t - u.hitT < 10) continue; const fp = S.fpri[F.s], back = Math.min(4, u.k.ir * .35);
        const tx = u.fm === 'GS' && fp ? fp[0] : F.cx, ty = u.fm === 'GS' && fp ? fp[1] : F.cy, gx = tx + rr[0] / rl * back, gy = ty + rr[1] / rl * back;
        if (Math.hypot(u.x - gx, u.y - gy) > Math.max(2, u.k.ir * .3) && !u.goal) { const q = map.snap(u.mvi, gx, gy, 5); if (q) { u.goal = q; u.needPath = true; u.noPath = false; } } } }
    const A = field(F); if (!A.length) { if (alive(F).length) { F.status = 'All battalions detached'; return; } F.dead = true; F.status = 'Destroyed'; say(F, 'Formation destroyed.', 2); return; }
    { const hx = F.hq && !F.hq.dead && F.hq.active ? F.hq.x : F.cx, hy = F.hq && !F.hq.dead && F.hq.active ? F.hq.y : F.cy; for (const u of A) if (u.state === 'ok' && !u.goal && !u.slot && u.mv !== 'ship' && Math.hypot(u.x - hx, u.y - hy) > 9) { const q = map.snap(u.mvi, hx, hy, 6); if (q) { u.goal = q; u.needPath = true; u.noPath = false; } } }
    centroid(F); const L = A.filter(u => LEADCLS[u.cls]); F.hasEng = A.some(u => u.cls === 'eng'); if (!F.order || F.order.st !== 'done') F.post = null;
    F.dis = Math.max(0, F.dis - (5 / 240) * (.6 + .8 * F.cmd.sk));
    if (S.t < F.paraT) { F.status = 'Reorganising under new commander'; return; }
    if (F.liftT && S.t >= F.liftT) { F.liftT = 0; for (const u of A) u.coh = Math.min(1, u.coh + .1); say(F, F.cmd.n + ' has taken hold of the formation. The battalions have their confidence back.', 1); }
    if (S.t < F.jamT) { F.status = 'Delayed: columns crossing'; for (const u of A) if (u.state !== 'retreat') { u.goal = null; u.path = null; } return; }
    for (const u of A) if (u.state !== 'retreat' && (u.cls === 'art' || u.cls === 'hq') && u.mv !== 'ship' && u.ned < 1.1) startRetreat(u);
    const O = F.order;
    const en = knownEnemiesNear(F, L.length ? L : A, 3.2), contact = en.length > 0; F.contact = contact;
    let under = 0; for (const u of A) if (S.t - u.hitT < 6) under++;
    if (!O) { F.status = contact ? 'Engaged, no orders' : 'Awaiting orders'; if (under > 1 && en.length) reqCAS(F, en[0]); return; }
    if (O.st === 'refused') { F.status = 'Refused: ' + O.why; return; }
    if (O.st === 'pending') {
      if (S.t < O.t0) { F.status = 'Preparing orders (' + Math.ceil(O.t0 - S.t) + ' min)'; return; }
      const why = canComply(F, O); if (why) { O.st = 'refused'; O.why = why; say(F, 'Cannot comply: ' + why + '.', 2); F.status = 'Refused: ' + why; return; }
      O.st = 'active'; O.prog = clamp(polyProj(O.path, F.cx, F.cy), 0, O.L); O.best = O.prog; O.bestT = S.t; if (O.L > 2) say(F, 'Moving out toward ' + nearTown(O.path[O.path.length - 1][0], O.path[O.path.length - 1][1]).replace('near ', '') + '.', 0);
    }
    for (const u of L) u.assault = F.assaultT > S.t && u.coh > .4;
    let slots;
    if (O.st === 'active' && O.prog < O.L - .05) {
      let minP = 1e9, maxP = -1e9, nL = 0; for (const u of L) if (u.state !== 'retreat' && u.str >= .3) { const q = polyProj(O.path, u.x, u.y); minP = Math.min(minP, q); maxP = Math.max(maxP, q); nL++; } if (minP > 1e8) { minP = O.prog; maxP = O.prog; }
      else if (nL >= 4) { const ps = []; for (const u of L) if (u.state !== 'retreat' && u.str >= .3) ps.push(polyProj(O.path, u.x, u.y)); ps.sort((a, b) => a - b); minP = ps[Math.floor(ps.length / 4)]; }   // the advance is paced by the rear quarter of the leading battalions: one or two on a far flank, or beyond a bend in the route, held the whole division at a standstill
      const wide = contact || knownEnemiesNear(F, L, 4.5).length > 0;
      if (!F.halt) O.prog = Math.min(O.L, Math.max(O.prog, wide ? minP + 1.3 : Math.min(maxP + .6, minP + 2.6 + Math.max(0, nL - 1) * .9)));
      if (minP > O.best + .3) { O.best = minP; O.bestT = S.t; if (F.halt && !contact) F.halt = false; }
      if (!contact) for (const G of S.forms) { if (G === F || G.s !== F.s || !G.active || G.dead || !G.order || G.order.st !== 'active' || G.id < F.id) continue; let tang = false; for (const u of A) { if (!u.moving) continue; for (const w of G.subs) if (w.active && !w.dead && w.moving && Math.hypot(u.x - w.x, u.y - w.y) < .4) { tang = true; break; } if (tang) break; } if (tang) { F.dis = Math.min(.5, F.dis + .035); G.dis = Math.min(.5, G.dis + .035); if (S.t > F.jamMsgT && F.dis > .2) { F.jamMsgT = S.t + 240; say(F, 'Columns entangled with ' + G.n + ' ' + nearTown(F.cx, F.cy) + '. Movement is slowed.', 1); } } }
      const stalled = S.t - O.bestT > (contact ? 22 : 100);
      if (stalled && S.t >= F.evalT) { F.evalT = S.t + 30; evaluate(F, O, L, en); }
      else if (!stalled && !F.halt) F.status = F.assaultT > S.t ? F.status : (contact ? 'In contact ' + nearTown(F.cx, F.cy) : 'Advancing');
      const blk = !contact && L.some(u => u.detour && S.t - u.detour < 25); if (blk) bridging(F, O);
      if (F.halt || blk) { for (const u of L) { u.slot = [u.x, u.y]; u.goal = null; } slots = advSlots(F, O, true); for (const u of L) slots.delete(u); }
      else slots = advSlots(F, O, wide);
    } else {
      if (!O.slots || S.t - O.slotT > 45) { O.slots = lineSlots(F, O); O.slotT = S.t; }
      slots = O.slots;
      if (O.st === 'active') {
        let dsum = 0, n = 0, inPlace = 0; for (const u of L) { const p = slots.get(u); if (p) { const d = Math.hypot(u.x - p[0], u.y - p[1]); dsum += d; n++; if (d < .9) inPlace++; } }
        const avg = n ? dsum / n : 0; if (avg < O.bestD - .2) { O.bestD = avg; O.bestT = S.t; }
        if ((!n || inPlace >= Math.ceil(n * .75)) && O.next) { const N = O.next; O.next = null; say(F, 'Objective reached ' + nearTown(F.cx, F.cy) + '. Moving on to the next leg.', 1); S.issueOrder(F, N.path, N.line, Object.assign({}, N.opt, { free: true })); return; }
        if (!n || inPlace >= Math.ceil(n * .75)) { O.st = 'done'; O.doneT = S.t; O.str0 = S.strength(F); F.halt = false; F.assaultT = 0; const th = O.then || (aiF(F) ? 'dig' : 'hold'); if (O.L > 2) say(F, 'Objective reached ' + nearTown(F.cx, F.cy) + '. ' + ({ hold: 'Holding until further orders.', dig: 'Digging in.', rest: 'Standing down to rest and refit.', exploit: 'Looking for a way forward.', delay: 'Ready to delay and give ground.', reserve: 'Assembling in reserve.' })[th], 1); F.status = 'On objective'; }
        else { const stalled = S.t - O.bestT > 22; if (stalled && S.t >= F.evalT) { F.evalT = S.t + 30; evaluate(F, O, L, en); } else if (!stalled && !F.halt && !(F.assaultT > S.t)) F.status = 'Closing on objective'; if (F.halt) { slots = new Map(slots); for (const u of L) { slots.delete(u); u.slot = [u.x, u.y]; u.goal = null; } } }
      } else {
        F.status = contact ? 'Defending ' + nearTown(F.cx, F.cy) : 'Holding ' + nearTown(F.cx, F.cy);
        if (arrived(F, O, L, en, contact)) return;
        if (under > 1 && en.length) { let top = en[0]; for (const e of en) if (pow(e) > pow(top)) top = e; reqCAS(F, top); }
        if (contact && S.t > F.fallT && F.cmd.ag < .8 && L.length) {
          let ep = 0, own = 0; for (const e of en) ep += pow(e); for (const u of L) own += defPow(u);
          if ((S.cohesion(F) < .34 && ep > own * 1.6) || (S.strength(F) < .32 && ep > own)) { const r = rearDir(F, O); O.line = O.line.map(p => [p[0] + r[0] * 3, p[1] + r[1] * 3]); O.slots = null; F.fallT = S.t + 180; say(F, 'Cannot hold ' + nearTown(F.cx, F.cy) + '. Falling back three kilometres.', 2); }
        }
      }
    }
    if (slots) for (const u of A) { if (u.mv === 'ship') continue; if (F.bridge && !F.bridge.intact && u.cls === 'eng') continue; setSlot(u, slots.get(u)); }
  }
  function startRetreat(u, far) {
    if (u.mv === 'ship' || u.state === 'retreat') return; const F = u.f; let dx, dy;
    if (u.ne) { dx = u.x - u.ne.x; dy = u.y - u.ne.y; } else { dx = sc.sides[u.s].rear[0]; dy = sc.sides[u.s].rear[1]; }
    if (F.hq && F.hq !== u && !F.hq.dead) { dx += (F.hq.x - u.x) * .5; dy += (F.hq.y - u.y) * .5; }
    if (!u.det) { const rx = F.hq && F.hq !== u && !F.hq.dead && F.hq.active ? F.hq.x : F.cx, ry = F.hq && F.hq !== u && !F.hq.dead && F.hq.active ? F.hq.y : F.cy, rd = Math.hypot(rx - u.x, ry - u.y); if (rd > 5) { dx = (rx - u.x) / rd; dy = (ry - u.y) / rd; } }
    const l = Math.hypot(dx, dy) || 1; const p = map.snap(u.mvi, u.x + dx / l * (far || 2.6), u.y + dy / l * (far || 2.6), 5);
    if (!p) return; u.state = 'retreat'; u.goal = p; u.needPath = true; u.assault = false; u.path = null;
  }

  // ---------- movement ----------
  function baseSpeed(u) { return (u.mv === 'foot' ? 4.2 * (.9 + .1 * u.xp) : u.k.spd * .5) / 60; }
  function moveSubs(dt) {
    const wm = WXMOVE[S.wx] * (S.night ? .7 : 1);
    for (const u of S.subs) {
      if (!u.active || u.dead || u.mv === 'ship') continue; fatTick(u, dt); u.moving = false;
      // a battalion holding a line faces the enemy side of it once it stops shooting
      if (!u.goal) { if (u.face && S.t - (u.fireT || -99) > 15) { u.hx = u.face[0]; u.hy = u.face[1]; } continue; }
      if (u.needPath && S.pb > 0 && S.t - u.pathT > (u.noPath ? 30 : .5)) {
        S.pb--; u.pathT = S.t; const p = map.findPath(u.mvi, u.x, u.y, u.goal[0], u.goal[1], u.f.dev && !u.det && u.state !== 'retreat' ? { cross: 1 } : undefined);   // doctrine: a developed formation moves across country
        // a formation crosses as one body: a route far longer than the direct line (a blown bridge sends everyone round by the next crossing) is refused and reported
        let far = false; if (p && !u.det && u.state !== 'retreat' && u.slot && u.goal === u.slot) { let L = 0, px = u.x, py = u.y; for (const q of p) { L += Math.hypot(q[0] - px, q[1] - py); px = q[0]; py = q[1]; } const d0 = Math.hypot(u.goal[0] - u.x, u.goal[1] - u.y); if (d0 > 1.2 && L > d0 * 1.9 + (sc.detourKm || 5)) far = true; }
        if (far) { u.noPath = true; u.path = null; u.detour = S.t; u.needPath = true; }
        else if (p) { u.path = p; u.pi = 0; u.needPath = false; u.noPath = false; u.detour = 0; if (p.length > 1 && Math.hypot(p[0][0] - u.x, p[0][1] - u.y) < map.cs * .8) u.pi = 1; } else { u.noPath = true; u.path = null; }
      }
      if (!u.path) continue;
      const ret = u.state === 'retreat';
      if (!ret) { if (u.coh < .4 && S.t - u.hitT < 4) continue; const so = u.assault ? .28 : (u.cls === 'arm' || u.cls === 'at' ? 1.0 : LEADCLS[u.cls] ? .6 : 1.5); if (u.ned < so && u.ne && (u.assault ? u.ne.coh >= .25 : true)) { if (u.ne) { const l = Math.hypot(u.ne.x - u.x, u.ne.y - u.y) || 1; u.hx = (u.ne.x - u.x) / l; u.hy = (u.ne.y - u.y) / l; } continue; } }
      if (u.mv !== 'foot' && u.fuel <= 0) continue;
      // an enemy in fighting order within 1.2 km blocks the way: close with him, fight through on an assault, or fall back, but do not drive past
      let zf = 1; if (!ret && u.ze && u.pi < u.path.length) { const q = u.path[u.pi], qx = q[0] - u.x, qy = q[1] - u.y, ql = Math.hypot(qx, qy) || 1, rr = sc.sides[u.s].rear || [0, 0], back = (qx * rr[0] + qy * rr[1]) / ql > .3;
        if (!back) { const toward = (qx * (u.ze.x - u.x) + qy * (u.ze.y - u.y)) / ql > .15 * u.zd; if (u.assault) zf = .35; else if (!toward || u.zd < .5) { if (u.ze.seenT < S.t - 6) u.ze.seenT = S.t; continue; } else zf = .5; } }
      const c = map.idx(u.x, u.y); let sp = zf * baseSpeed(u) * (u.fat > .5 ? 1 - .6 * (u.fat - .5) : 1) * (!ret && !u.det && !u.fm && !INDEP[u.cls] && u.f.pace && !u.f.contact && u.f.order && u.f.order.st === 'active' ? Math.min(1, u.f.pace / baseSpeed(u)) : 1) * Math.max(.05, (u.f.dev && !u.det ? map.facX : map.fac)[u.mvi][c]) * wm * ((u.f.alignHold || u.f.flankHold) && !ret && !u.det && !u.f.contact && u.state !== 'retreat' ? 0 : 1) * (sc.hHour && S.t < sc.hHour * 60 && u.path && u.path[u.pi] && S.ownAt(u.path[u.pi][0], u.path[u.pi][1]) !== u.s ? 0 : 1) * (S.t - u.hitT < 3 && !ret ? .5 : 1) * (ret ? 1.15 : 1) * (1 - .5 * u.f.dis);
      let rem = sp * dt;
      while (rem > 0 && u.pi < u.path.length) {
        const p = u.path[u.pi], dx = p[0] - u.x, dy = p[1] - u.y, d = Math.hypot(dx, dy);
        if (d < 1e-4) { u.pi++; continue; }
        if (map.fac[u.mvi][map.idx(p[0], p[1])] <= 0) { u.needPath = true; u.path = null; break; }
        const st = Math.min(d, rem); u.x += dx / d * st; u.y += dy / d * st; u.hx = dx / d; u.hy = dy / d; rem -= st; u.moving = true;
        if (u.mv !== 'foot') u.fuel = Math.max(0, u.fuel - st / (u.mv === 'track' ? 170 : 320));
        if (st >= d - 1e-6) u.pi++;
      }
      // minefields hurt only the side that did not lay them: the side holding the ground at the start knows the gaps
      if (u.moving && sc.mines && map.t[c] === T.MARSH && !map.road[c] && !map.lane[c] && !u.breach && !(S.own0 && own0At(u.x, u.y) === u.s)) { hurt(u, .0016 * dt * (u.f.subs.some(q => q.cls === 'eng' && q.active && !q.dead) ? .4 : 1), 'mine'); u.dC += .003 * dt; u.hitT = S.t; if (S.t > (u.f.mineT || 0)) { u.f.mineT = S.t + 240; say(u.f, u.n + ' is in a minefield ' + nearTown(u.x, u.y) + ' and taking losses.', 2, u.x, u.y); } }
      if (u.moving) u.ent = Math.max(0, u.ent - dt * .2);
      if (u.path && u.pi >= u.path.length) { u.path = null; u.goal = null; if (ret) { u.slot = null; } }
    }
  }

  // march fatigue: foot troops tire over about 16 hours on the move (faster at night and off the roads) and recover over about 8 hours at rest; motor and tracked units wear far more slowly
  // Tired troops move and fight less well, and spent troops lose cohesion if driven on. A sustained march of 8 hours a day leaves them fit after a night's rest.
  function fatTick(u, dt) { const c = map.idx(u.x, u.y);
    if (u.moving) { const g = (u.mv === 'foot' ? 1 / 16 : 1 / 40) * (S.night ? 1.5 : 1) * (!map.road[c] ? 1.3 : 1); u.fat = Math.min(1, (u.fat || 0) + g * dt / 60); if (u.fat > .6) u.coh = Math.max(0, u.coh - .0015 * dt * (u.fat - .6) / .4); }
    else if (u.fat) u.fat = Math.max(0, u.fat - (1 / 8) * (u.f.post === 'rest' ? 2 : 1) * (S.t - u.hitT < 30 ? .5 : 1) * dt / 60); }
  S.fatWord = v => !v || v < .3 ? 'Fresh' : v < .6 ? 'Tired' : v < .85 ? 'Exhausted' : 'Spent';
  // losses by cause: every hit records what caused it, so after-action reports and the end screen can say what did the damage
  S.lossBy = [{}, {}];
  // what formations handed to the staff may do on their own: commit to threatened objectives and break out of pockets (on by default), and draw on the support pool (off)
  S.staffOpt = [{ commit: true, pool: false }, { commit: true, pool: false }];
  S.setStaffOpt = function (s, k, v) { if (!S.staffOpt[s] || !(k in S.staffOpt[s])) return false; S.staffOpt[s][k] = !!v; return true; };
  const CAUSE = { art: 'artillery', nav: 'naval gunfire', tank: 'tank fire', at: 'anti-tank guns', inf: 'infantry fire', air: 'air attack', mine: 'mines', iso: 'isolation and exposure' };
  S.CAUSE = CAUSE;
  function lbSum(A) { const o = {}; for (const u of A) if (u.lb) for (const c in u.lb) o[c] = (o[c] || 0) + u.lb[c]; return o; }
  function hurt(u, amt, cause) { u.dS += amt; const d = u.dsc || (u.dsc = {}); d[cause] = (d[cause] || 0) + amt; }
  // ---------- combat & spotting ----------
  const CONCEAL = [1, .6, .4, .9, .8, .85, 1.3, .35, 1.2, 1, .5, .4, 1, 1, 1];
  function combatTick() {
    const side = [[], []]; for (const u of S.subs) if (u.active && !u.dead) { side[u.s].push(u); u.ned = 9; u.ne = null; u.zd = 9; u.ze = null; u.tc = map.t[map.idx(u.x, u.y)]; u.bs = 1e9; u.bt = null; u.bd = 0; u.fd0 = u.fd == null ? 9 : u.fd; u.fd = 9; u.artN = 0; }
    const nv = (S.night ? .45 : 1) * WXVIS[S.wx], now = S.t;
    // spatial grid: only pairs within 31 km can interact, so each unit checks the 3 x 3 block of 31 km cells around it.
    // Candidates are visited in their original list order, which keeps results identical to the full pair scan.
    // A squared-distance test drops far pairs before the exact Math.hypot distance is taken.
    const GC = 31, grid = new Map(), B = side[1], ci = new Int32Array(B.length);
    for (let i = 0; i < B.length; i++) { const b = B[i]; const key = Math.floor(b.x / GC) * 4096 + Math.floor(b.y / GC); let l = grid.get(key); if (!l) grid.set(key, l = []); l.push(i); }
    for (const a of side[0]) {
      let nc = 0; const ix = Math.floor(a.x / GC), iy = Math.floor(a.y / GC);
      for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) { const l = grid.get((ix + gx) * 4096 + iy + gy); if (l) for (let k = 0; k < l.length; k++) ci[nc++] = l[k]; }
      const cs = ci.subarray(0, nc); if (nc > 1) cs.sort();
      for (let k = 0; k < nc; k++) {
      const b = B[cs[k]], dx = a.x - b.x, dy = a.y - b.y; if (dx * dx + dy * dy > 961.001) continue;
      const d0 = Math.hypot(dx, dy); if (d0 > 31) continue; const d = a.ext || b.ext ? Math.max(.05, d0 - a.ext - b.ext) : d0;
      if (d < 4.5 * 1.6) {
        const sa = 3 * nv * (a.cls === 'rec' ? 1.5 : 1) * (a.tc === T.HILL || a.tc === T.MTN ? 1.3 : 1) * CONCEAL[b.tc] * (b.moving ? 1.25 : .9) * (b.k.arm > 0 || b.mv !== 'foot' ? 1.15 : 1) * (now - b.fireT < 3 && !b.k.ir ? 1.5 : 1);
        if (d < Math.max(.5, sa)) b.seenT = now;
        const sb = 3 * nv * (b.cls === 'rec' ? 1.5 : 1) * (b.tc === T.HILL || b.tc === T.MTN ? 1.3 : 1) * CONCEAL[a.tc] * (a.moving ? 1.25 : .9) * (a.k.arm > 0 || a.mv !== 'foot' ? 1.15 : 1) * (now - a.fireT < 3 && !a.k.ir ? 1.5 : 1);
        if (d < Math.max(.5, sb)) a.seenT = now;
      }
      if (LEADCLS[b.cls] && d < a.fd) a.fd = d; if (LEADCLS[a.cls] && d < b.fd) b.fd = d;
      if (d < 1.2) { if (d < a.zd && b.coh > .3 && (LEADCLS[b.cls] || b.cls === 'at')) { a.zd = d; a.ze = b; } if (d < b.zd && a.coh > .3 && (LEADCLS[a.cls] || a.cls === 'at')) { b.zd = d; b.ze = a; } }
      const bv = now - b.seenT < 6, av = now - a.seenT < 6;
      if (bv && d < a.ned && b.cls !== 'hq' && b.mv !== 'ship') { a.ned = d; a.ne = b; }
      if (av && d < b.ned && a.cls !== 'hq' && a.mv !== 'ship') { b.ned = d; b.ne = a; }
      if (bv) pick(a, b, d); if (av) pick(b, a, d);
      }
    }
    cbTick(side, now);
    for (let s = 0; s < 2; s++) for (const u of side[s]) if (u.bt && u.state !== 'retreat' && u.k.ir) u.bt.artN++;
    for (let s = 0; s < 2; s++) for (const u of side[s]) { if (u.bt && u.state !== 'retreat' && !u.broken) fireAt(u, u.bt, u.bd); }
    for (let s = 0; s < 2; s++) for (const u of side[s]) {
      if (u.dS > 0) { const before = u.str, ap = Math.min(before, u.dS) * u.size; u.str = Math.max(0, u.str - u.dS); u.coh = Math.max(0, u.coh - u.dC); S.losses[u.s] += ap; if (u.dsc) { const lb = u.lb || (u.lb = {}), L = S.lossBy[u.s]; for (const c in u.dsc) { const v = ap * u.dsc[c] / u.dS; lb[c] = (lb[c] || 0) + v; L[c] = (L[c] || 0) + v; } u.dsc = null; } u.dS = 0; u.dC = 0; }
      // cohesion comes back once the shooting stops: more slowly for a battalion cut off or shaken
      const quiet = now - u.hitT > 8, po = u.det ? 'dig' : u.f.post, rest = po === 'rest' && now - u.hitT > 30; u.coh = Math.min((.4 + .6 * u.mor) * (1 - .25 * (u.fat || 0)), u.coh + (quiet ? .004 * (u.oc ? .5 : 1) * (.7 + .6 * u.f.cmd.sk) * (u.ammo > .1 ? 1 : .5) * (rest ? 2 : 1) * (u.cut || u.f.isolated ? .4 : 1) * (u.mor < .3 ? .5 : 1) : .0006));
      if (!u.moving) { const cap = po === 'hold' ? .7 : po === 'rest' ? .3 : po === 'reserve' ? .2 : po === 'delay' ? .5 : po === 'exploit' ? .4 : 1; if (u.ent < cap) u.ent = Math.min(cap, u.ent + (po === 'dig' ? (u.f.hasEng ? 3 : 2) : 1) / 360); } if (quiet && now - u.hitT > 120 && !u.f.isolated) { if (rest && u.str < .92) u.str += .0003; else if (u.str < .85) u.str += .00006; }
      // surrender is a state that has to last: shattered, cut off, out of ammunition, heavily outnumbered close by and with no friends near, for two hours
      if ((u.coh < .08 || u.mor < .14) && u.f.isolated && u.ned < 1) { if (u.surT == null) u.surT = now; } else u.surT = null;
      let sur = false; if (u.surT != null && now - u.surT >= 120 && u.ammo < .1) { const own = powNear(u.s, u.x, u.y, 2), en = powNear(1 - u.s, u.x, u.y, 2); if (en >= 3 * Math.max(own, .05) && !S.subs.some(w => w.s === u.s && w.active && !w.dead && !w.f.isolated && w.cls !== 'hq' && w.mv !== 'ship' && Math.hypot(w.x - u.x, w.y - u.y) < 5)) sur = true; }
      if (u.str < .12 || sur) { u.dead = true; u.active = true; S.ev.push({ k: 'dead', u }); say(u.f, u.n + (u.str < .12 ? ' has been destroyed ' : ' has surrendered ') + nearTown(u.x, u.y) + '.', 2, u.x, u.y); if (u.pool) u.pool.sub = null; continue; }
      if (!u.broken && u.mor < .25 && u.ned < 2.5 && u.mv !== 'ship' && u.cls !== 'hq') { u.broken = true; u.state = 'ok'; startRetreat(u, 5); for (const w of S.subs) if (w !== u && w.s === u.s && w.active && !w.dead) { const d = Math.hypot(w.x - u.x, w.y - u.y); if (d < 2) w.mor = Math.max(0, w.mor - .05 * (1 - d / 2)); } if (S.t > (u.f.brkMsgT || 0)) { u.f.brkMsgT = S.t + 60; say(u.f, u.n + ' has broken and is running for the rear ' + nearTown(u.x, u.y) + '.', 2, u.x, u.y); } }
      else if (u.broken && u.mor > .38 && now - u.hitT > 30) { u.broken = false; if (u.state === 'retreat' && !u.goal) u.state = 'ok'; say(u.f, u.n + ' has rallied.', 1, u.x, u.y); }
      else if (u.broken && u.state !== 'retreat' && u.ned < 2.5) startRetreat(u, 5);
      if (!u.broken && u.coh < clamp(.22 + .25 * (.6 - u.mor) + (u.f.order && u.f.order.press != null ? PRESS[u.f.order.press].ret : 0), .1, .46) && u.state !== 'retreat') startRetreat(u);
      else if (!u.broken && u.state === 'retreat' && u.coh > .5 && !u.goal) u.state = 'ok';
      else if (u.state === 'retreat' && !u.goal && !u.needPath) { if (u.ned < 1.2) startRetreatAgain(u); }
    }
  }
  // counter-battery: a firing battery is located by sound ranging, flash spotting and air observation over 30 to 90 minutes of its fire, faster with air observation up.
  // Once located it can be engaged until it moves or has been quiet for an hour. Batteries are no longer seen from the front line by their flashes alone.
  const CBR = { US: 1 / 30, UK: 1 / 30, GE: 1 / 50, IT: 1 / 90 };
  function cbTick(side, now) {
    for (let s = 0; s < 2; s++) { const o = 1 - s, nat = (S.forms.find(F => F.s === o && F.active && !F.dead) || {}).nat || 'US', air = S.flyable() > .5 && S.air[o] && S.air[o].groups.some(g => g.mission === 'rec' && g.avail > 0) ? 2 : 1;
      for (const e of side[s]) { if (!e.k.ir || e.cls !== 'art' || e.mv === 'ship') continue;
        if (e.cbX != null && Math.hypot(e.x - e.cbX, e.y - e.cbY) > 1) { e.cb = 0; e.cbX = null; e.cbT = null; }
        if (now - e.fireT < 1.01) { let near = false; for (const w of side[o]) if (Math.hypot(w.x - e.x, w.y - e.y) < 15) { near = true; break; } if (near) { if (e.cbX == null) { e.cbX = e.x; e.cbY = e.y; } e.cb = (e.cb || 0) + (CBR[nat] || 1 / 50) * air; if (e.cb >= 1) e.cbT = now; } }
        else if (e.cb) e.cb *= .995;
        if (e.cbT != null && now - e.cbT < 60) e.seenT = now; } } }
  function startRetreatAgain(u) { u.state = 'ok'; startRetreat(u); }
  function pick(u, e, d) {
    const k = u.k; let sc0;
    if (k.ir) { if (d > k.ir || d < .7 || u.ammo <= 0 || (u.mv === 'ship' && S.t < (u.silT || 0)) || S.t < (u.fmT || 0)) return; const F = u.f; const dF = Math.hypot(e.x - F.cx, e.y - F.cy);
      if (u.fm === 'GS' || u.fm === 'GSR') { const fp = S.fpri[u.s], dp = fp ? Math.hypot(e.x - fp[0], e.y - fp[1]) : 9; sc0 = Math.min(e.fd0 + 1, dp) - (e.cls === 'art' ? 1.5 : 0) + (S.t - e.hitT < 5 ? -1 : 0); if (u.fm === 'GSR') sc0 = Math.min(sc0, dF - 1); if (sc0 > 6) sc0 += 5; }
      else { sc0 = dF + (S.t - e.hitT < 5 ? -1 : 0) + (e.cls === 'hq' ? 2 : 0) - (u.fm === 'R' && e.artN ? .8 : 0); if (sc0 > k.ir) sc0 += 5; } }
    else { let r = k.rng; if (CONCEAL[e.tc] < .7 || CONCEAL[u.tc] < .7) r = Math.min(r, .7); if (S.night) r = Math.min(r, .6); if (d > r) return; sc0 = d * (e.cls === 'hq' || e.cls === 'art' ? 1.4 : 1) * (k.ha > k.sa && e.k.arm > 20 ? .5 : 1); }
    if (sc0 < u.bs) { u.bs = sc0; u.bt = e; u.bd = d; }
  }
  // armour a shot meets: frontal inside 60 degrees of the target's facing, side plate from 90 degrees round, a blend between.
  // A battalion standing in a line keeps the line's facing; one on the move faces the way it goes.
  function flankArm(u, e) { const ek = e.k; if (ek.side == null) return ek.arm; const f = e.face && !e.moving ? e.face : [e.hx, e.hy], dx = u.x - e.x, dy = u.y - e.y, l = Math.hypot(dx, dy) || 1, hl = Math.hypot(f[0], f[1]) || 1, c = (dx * f[0] + dy * f[1]) / (l * hl), w = clamp(c / .5, 0, 1); return ek.side + (ek.arm - ek.side) * w; }
  // fire discipline: a formation short of ammunition rations its fire. Auto rations by stock (full above half, three-quarters above a quarter, half below, a quarter when cut off); Free fires at full rate; Conserve at half
  function fireRate(F) { if (!F || F.fireD === 'free') return 1; if (F.fireD === 'conserve') return F.isolated ? .25 : .5; if (F.isolated) return .25; const f = F.cap > 0 ? F.stock / F.cap : 1; return f > .5 ? 1 : f > .25 ? .75 : .5; }
  S.fireRate = fireRate;
  S.setFireD = function (F, v) { if (!F || ['auto', 'free', 'conserve'].indexOf(v) < 0) return false; F.fireD = v === 'auto' ? null : v; return true; };
  function fireAt(u, e, d) {
    const k = u.k, ek = e.k, ind = k.ir > 0;
    const eff = (.4 + .6 * u.coh) * (1 - .35 * Math.max(0, (u.fat || 0) - .4) / .6) * (u.ammo > .05 ? 1 : .25) * (u.moving ? .6 : 1) * u.xp * (S.night && !ind ? .6 : 1) * u.str * u.size / (k.size) * (1 - .5 * u.f.dis) * (u.oc ? .85 : 1) * (u.aaRole && u.k.aa && d > .8 ? .35 : 1);
    const cov = COVER[e.tc] * (1 - .6 * e.ent) * (e.f.post === 'rest' ? 1.25 : 1) * (e.moving ? 1.3 : 1) * (e.moving && e.coh < .6 && !ind ? 1.6 : 1), close = !ind && d < .45 ? ((k.cls === 'arm' || k.cls === 'mech') && ek.arm < 20 && COVER[e.tc] >= 1 ? 5 : 3) : 1;
    const fd = fireRate(u.f); let soft = k.sa * eff * cov * close * (.6 + .4 * fd), hard = 0;
    if (ind) { if (u.mv === 'ship' && d > 12) soft *= .55; soft *= (1 + Math.min(.6, (DOCT[u.f.nat] || DOCT.US).mass * Math.max(0, e.artN - 1))) * .85 * (S.t - e.seenT < 3 ? 1 : .6) * (1 - .45 * e.ent) * (e.ned > 1.6 ? .35 : 1); if (ek.arm > 20) soft *= .22; else if (ek.arm > 0) soft *= .6; }
    else {
      if (ek.arm > 20) soft *= .08; else if (ek.arm > 0) soft *= .45;
      if (ek.arm > 0 && k.ha > 0) { const inRange = k.cls === 'inf' || k.cls === 'cdo' || k.cls === 'eng' ? d < .5 : true; if (inRange) { const fa = flankArm(u, e), ea = fa * .75; if (fa < ek.arm * .7 && S.t > (u.f.flkT || 0)) { u.f.flkT = S.t + 120; say(u.f, u.n + ' has caught ' + e.n + ' in the flank ' + nearTown(e.x, e.y) + '.', 1, e.x, e.y); } const pk = k.guns ? k.guns.reduce((a, g) => a + g[0] * clamp(.15 + (g[1] - ea) / ea, .04, 1), 0) : clamp(.15 + (k.pen - ea) / ea, .04, 1); hard = k.ha * eff * pk * Math.sqrt(cov) * close * (k.cls === 'at' && !u.moving ? 1.3 : 1) * (.6 + .4 * fd); } }
      else if (ek.arm === 0 && k.ha > 0) soft += k.ha * eff * cov * .25;
    }
    // town fighting (urban module): tanks need infantry beside them, infantry gain from tanks in support, and infantry at close range in a town are dangerous to tanks
    if (S.urban && !ind) { const U = S.urban, et = e.tc === T.TOWN || e.tc === T.CITY, ut = u.tc === T.TOWN || u.tc === T.CITY, foot = S.urbanInf[k.cls];
      if (et) { if (k.cls === 'arm') { if (!S.urbanNear(u, 'inf')) soft *= U.armSoft; } else if (foot && S.urbanNear(u, 'arm')) soft *= U.combined; }
      if (hard > 0 && foot && ek.arm > 20 && d < .5 && (et || ut)) hard *= S.urbanNear(e, 'inf') ? U.faustGuarded : U.faust; }
    const mass = e.size / (ek.size) * ek.size; // absolute toughness
    // artillery and naval fire neutralise more than they kill: indirect fire does 75% of its former damage to strength, its effect on cohesion unchanged
    const dS = ATT.str * (e.state === 'retreat' ? .6 : 1) * (.0006 * soft * (ind ? .75 : 1) + .0016 * hard) / Math.max(.2, mass) * (ek.cls === 'art' || ek.cls === 'hq' ? 1.3 : 1);
    hurt(e, dS, ind ? (u.mv === 'ship' ? 'nav' : 'art') : k.cls === 'arm' ? 'tank' : k.cls === 'at' ? 'at' : 'inf'); e.dC += dS * (ind ? 8 : 6) + ATT.coh * .0022 * soft * (ind ? 2 : 1) / Math.max(.3, mass) / (e.xp);
    e.hitT = S.t; u.fireT = S.t; u.tgt = e; u.ammo = Math.max(0, u.ammo - fd * (u.mv === 'ship' ? AMMO.ship : ind ? AMMO.ind : k.cls === 'arm' ? AMMO.arm : AMMO.inf));
    if (!u.moving && !ind) { const l = d || 1; u.hx = (e.x - u.x) / l; u.hy = (e.y - u.y) / l; }
  }

  // ---------- supply ----------
  function moraleTick() {
    // computer staffs swing heavy flak between roles: anti-tank when enemy armour closes, anti-aircraft otherwise (detached guns stay on their point)
    for (const u of S.subs) if (S.ai[u.s] && u.k.aa && u.k.aa.hi >= 1 && u.active && !u.dead && !u.det) { if (u.ne && u.ne.k.arm > 20 && u.ned < 3) u.aaRole = false; else if (u.ned > 4.5) u.aaRole = true; }
    for (const u of S.subs) { if (!u.active || u.dead || u.mv === 'ship') continue; const F = u.f;
      u.inC = S.t - u.hitT < 10 ? u.inC + 10 : Math.max(0, u.inC - (F.post === 'rest' || F.post === 'reserve' ? 30 : 10));
      let tg = u.mor0 * (.35 + .65 * Math.min(1, u.str / .9)) + (F.cmd.sk - .6) * .2 - Math.min(.2, u.inC / 60 * .012) - (F.isolated || u.cut ? .15 : 0) - (u.ammo < .2 ? .1 : 0) - (F.stock < F.cap * .15 ? .05 : 0) - (u.oc ? .06 : 0) + (F.lastRes && S.t - F.lastRes.t < 360 ? (F.lastRes.bad ? -.08 : .05) : 0) + (S.t < (F.paraT || 0) ? -.05 : 0);
      let nb = 0; for (const w of F.subs) if (w !== u && w.broken && w.active && !w.dead) { const d = Math.hypot(w.x - u.x, w.y - u.y); if (d < 2.5) nb += .07 * (1 - d / 2.5); } tg -= Math.min(.1, nb);   // broken neighbours weigh by distance, capped
      tg = clamp(tg, 0, 1); u.mor += (tg - u.mor) * (tg < u.mor ? .06 : .03); }
  }
  // transport aircraft can drop supplies to any formation; flak, weather and scatter decide how much arrives where
  // no Axis supply drops by default: none are recorded in these battles; in the Ardennes the Luftwaffe flew one mission, for Peiper, then refused (Cole ch. XVI)
  S.dropQ = [[], []]; S.drops = []; S.lift = [0, 1].map(s => { const d = sc.sides[s].lift != null ? sc.sides[s].lift : s === 0 ? 3 : 0; return { day: d, left: d, t: 0 }; });
  S.reqDrop = function (s, F, x, y) { const L = S.lift[s]; if (L.left < 1 || !F || F.s !== s || !F.active || F.dead) return false; L.left--; const q = { id: S.nid++, s, F, x, y, t: S.t + 90, load: 8 }; S.dropQ[s].push(q); say(F, 'Air supply drop requested ' + nearTown(x, y) + '. Transports load in about 90 minutes and fly in daylight and flying weather.', 0, x, y); return true; };
  function dropTick() {
    const fly = flyable();
    for (let s = 0; s < 2; s++) { const L = S.lift[s]; if (S.t - L.t >= 1440) { L.t = S.t; L.left = L.day; }
      for (const q of S.dropQ[s].slice()) { if (S.t < q.t) continue; if (S.t - q.t > 1440 || q.F.dead) { S.dropQ[s].splice(S.dropQ[s].indexOf(q), 1); L.left = Math.min(L.day, L.left + 1); say(q.F, 'Air drop cancelled after a day without flying weather.', 1); continue; }
        if (fly < .7) continue; S.dropQ[s].splice(S.dropQ[s].indexOf(q), 1);
        let flak = 0; for (const e of S.subs) if (e.s !== s && e.active && !e.dead && e.cls !== 'hq' && e.mv !== 'ship' && Math.hypot(e.x - q.x, e.y - q.y) < 4) flak += e.k.aa && e.aaRole ? 2.4 * Math.max(e.k.aa.lo, e.k.aa.hi) : e.cls === 'at' ? .6 : .3;
        const lost = Math.min(.6, flak * .05 * (.6 + rnd() * .8)), R = .5 + (S.wx === 'cloud' ? .6 : 0) + flak * .12 + rnd() * .6, a = rnd() * 6.283, r = R * Math.sqrt(rnd()), x = clamp(q.x + Math.cos(a) * r, .5, map.w - .5), y = clamp(q.y + Math.sin(a) * r, .5, map.h - .5);
        const load = q.load * (1 - lost); S.drops.push({ id: S.nid++, s, F: q.F, x, y, load, t: S.t }); S.ev.push({ k: 'airdrop', x, y, s });
        say(q.F, 'Supply drop flown ' + nearTown(q.x, q.y) + (lost > .05 ? ': flak destroyed ' + Math.round(lost * 100) + ' percent of the load' : '') + '. Containers came down about ' + r.toFixed(1) + ' km from the drop point.', lost > .25 || r > 1.5 ? 2 : 1, x, y); } }
    for (const d of S.drops.slice()) { let best = null, bd = 1.5; for (const u of S.subs) if (u.active && !u.dead && u.cls !== 'hq' && u.mv !== 'ship' && u.coh > .3 && !u.broken) { const dd = Math.hypot(u.x - d.x, u.y - d.y); if (dd < bd) { bd = dd; best = u; } }
      if (best) { const G = best.f; S.drops.splice(S.drops.indexOf(d), 1); G.stock = Math.min(G.cap * 1.2, G.stock + d.load); if (best.s === d.s) { for (const w of G.subs) if (w.active && !w.dead) w.mor = Math.min(1, w.mor + .04); say(G, 'Air drop recovered ' + nearTown(d.x, d.y) + ': ' + Math.round(d.load) + ' loads.', 1, d.x, d.y); } else { say(G, 'We captured an enemy supply drop ' + nearTown(d.x, d.y) + '.', 1, d.x, d.y); say(d.F, 'Our supply drop ' + nearTown(d.x, d.y) + ' fell into enemy hands.', 2, d.x, d.y); } }
      else if (S.t - d.t > 480) { S.drops.splice(S.drops.indexOf(d), 1); say(d.F, 'The supply drop ' + nearTown(d.x, d.y) + ' was never recovered.', 1, d.x, d.y); } }
    // computer staffs ask for drops for cut-off formations short of supply
    for (let s = 0; s < 2; s++) if (S.ai[s] && S.lift[s].left >= 1) { const F = S.forms.find(G => G.s === s && G.active && !G.dead && G.isolated && G.stock < G.cap * .3 && !S.dropQ[s].some(q => q.F === G)); if (F) { const h = F.hq && !F.hq.dead ? F.hq : { x: F.cx, y: F.cy }; S.reqDrop(s, F, h.x, h.y); } }
  }
  // reachable regions for supply columns (truck moves, this side's block mask), labelled at most once per supply tick per side when a column is planned
  const CC = [{ t: -1, lab: null }, { t: -1, lab: null }], colComp = s => { const q = CC[s]; if (q.t !== S.t) { q.lab = map.compLabel(1, S.zoc[s], q.lab); q.t = S.t; } return q.lab; };
  function supplyTick() {
    moraleTick(); dropTick();
    const M = m2o(), OA = OW.a; for (let s = 0; s < 2; s++) { const z = S.zoc[s]; z.fill(0); for (let c = 0; c < map.N; c++) if (OA[M[c]] !== s) z[c] = 1; const r = Math.ceil(1.2 / map.cs); for (const e of S.subs) if (e.s !== s && e.active && !e.dead && e.cls !== 'hq' && e.cls !== 'art' && e.coh > .2) { const ci = Math.floor(e.x / map.cs), cj = Math.floor(e.y / map.cs); for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < map.W && j < map.H && di * di + dj * dj <= r * r) z[j * map.W + i] = 1; } } }
    // battalion-level supply: the ground each side can reach, avoiding the enemy's immediate reach (1.2 km round his troops) and water with no bridge.
    // A battalion draws supply only if the ground round it (1.2 km) joins the ground round its headquarters.
    for (let s = 0; s < 2; s++) { const zE = S.zE[s], lab = S.lab[s]; zE.fill(0); lab.fill(0); const r = Math.ceil(1.2 / map.cs);
      for (const e of S.subs) if (e.s !== s && e.active && !e.dead && e.cls !== 'hq' && e.cls !== 'art' && e.coh > .2 && e.mv !== 'ship') { const ci = Math.floor(e.x / map.cs), cj = Math.floor(e.y / map.cs); for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < map.W && j < map.H && di * di + dj * dj <= r * r) zE[j * map.W + i] = 1; } }
      // ground the enemy owns blocks the link too, as it does for supply columns
      for (let c = 0; c < map.N; c++) if (!zE[c] && OA[M[c]] === 1 - s) zE[c] = 1;
      // connected regions, numbered in scan order as before; an explicit typed stack and inline neighbour tests for speed
      const W = map.W, N = map.N, F0 = map.fac[0], ST = S.labSt || (S.labSt = new Int32Array(N + 8));
      let n = 0; for (let c = 0; c < N; c++) { if (lab[c] || zE[c] || F0[c] <= 0) continue; n++; lab[c] = n; let sp = 0; ST[sp++] = c;
        while (sp) { const q = ST[--sp], i = q % W; let k;
          if (i > 0) { k = q - 1; if (!lab[k] && !zE[k] && F0[k] > 0) { lab[k] = n; ST[sp++] = k; } }
          if (i < W - 1) { k = q + 1; if (!lab[k] && !zE[k] && F0[k] > 0) { lab[k] = n; ST[sp++] = k; } }
          if (q >= W) { k = q - W; if (!lab[k] && !zE[k] && F0[k] > 0) { lab[k] = n; ST[sp++] = k; } }
          if (q < N - W) { k = q + W; if (!lab[k] && !zE[k] && F0[k] > 0) { lab[k] = n; ST[sp++] = k; } } } } }
    const near = (s, x, y) => { const out = new Set(), lab = S.lab[s], r = Math.ceil(1.2 / map.cs), ci = Math.floor(x / map.cs), cj = Math.floor(y / map.cs); for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < map.W && j < map.H && di * di + dj * dj <= r * r && lab[j * map.W + i]) out.add(lab[j * map.W + i]); } return out; };
    // a formation that has lost its headquarters links instead to the side's own network: another headquarters that is not cut off, or a working supply source
    const net = [null, null], netOf = s => { if (net[s]) return net[s]; const o = new Set(), add = (x, y) => { for (const l of near(s, x, y)) o.add(l); };
      for (const G of S.forms) if (G.s === s && G.active && !G.dead && !G.isolated && G.hq && !G.hq.dead && G.hq.active) add(G.hq.x, G.hq.y);
      for (const q of S.src[s]) if (!q.captured && !q.air && !q.booty && S.t >= q.t * 60) add(q.x, q.y); return (net[s] = o); };
    for (const F of S.forms) { if (!F.active || F.dead) continue; const hq = F.hq && !F.hq.dead && F.hq.active ? F.hq : null, H = hq ? near(F.s, hq.x, hq.y) : netOf(F.s); let cutN = 0;
      for (const u of F.subs) { if (!u.active || u.dead || u.mv === 'ship' || u === hq) { u.cut = false; continue; } let ok = false; for (const l of near(F.s, u.x, u.y)) if (H.has(l)) { ok = true; break; }
        if (!ok) { const X = S.xings.find(X => X.s === F.s && X.landed.includes(u)); if (X && X.boats.st === 'site' && X.boats.n > 0) ok = 'boats'; }   // boats still at the crossing keep a lodgement fed
        if (!ok && S.src[F.s].some(q => !q.captured && !q.air && !q.booty && S.t >= q.t * 60 && Math.hypot(q.x - u.x, q.y - u.y) < 3)) ok = 'beach';   // a battalion within 3 km of its own beach or port is fed over it
        if (!ok) { if (!u.cut) u.cutT = S.t; } u.cut = !ok; u.boatFed = ok === 'boats';
        if (u.cut) { cutN++; if (!u.cutRep && S.t - u.cutT >= 60 && S.t > (F.cutMsgT || 0)) { u.cutRep = true; F.cutMsgT = S.t + 120; say(F, u.n + ' is cut off from headquarters ' + nearTown(u.x, u.y) + '. It has only what it carries.', 2, u.x, u.y); } } else u.cutRep = false; }
      F.cutN = cutN; }
    // rations and water, drawn every day whether the formation fights or not; double in the desert
    for (const F of S.forms) if (F.active && !F.dead) { let n = 0; for (const u of F.subs) if (u.active && !u.dead && u.mv !== 'ship' && !u.cut) n += u.size; F.stock = Math.max(0, F.stock - n * RATION * (S.desert ? 1.5 : 1) / 144); }
    const fly = flyable();
    // a captured port opens as a supply source once the side has held it long enough to clear the quays
    (sc.ports || []).forEach((P, i) => { const st = S.portSt[i] || (S.portSt[i] = {}), v = S.vp.find(v => v.n === P.vp); if (!v || st.open) return; if (v.own !== P.s) { st.heldT = null; return; } if (st.heldT == null) st.heldT = S.t; if (S.t - st.heldT >= P.clear * 60) { st.open = true; S.src[P.s].push({ s: P.s, n: P.n, x: P.x, y: P.y, stock: 0, cap: P.stock, rate: P.rate * dfS(P.s).sup, t: 0, captured: false, dropT: 360, known: [1, 1] }); say(P.s, P.n + ' is cleared and open. Supply columns can draw from it now.', 1, P.x, P.y); } });
    for (let s = 0; s < 2; s++) for (const src of S.src[s].slice()) {
      if (S.t < src.t * 60) continue;
      let en = false, fr = false; for (const u of S.subs) if (u.active && !u.dead && u.cls !== 'hq' && Math.hypot(u.x - src.x, u.y - src.y) < 1) { if (u.s === s) fr = true; else en = true; }
      if (en && !fr && !src.captured) { src.captured = true; const loot = src.stock * BOOTY; src.stock = 0; say(s, src.n + ' has been overrun by the enemy.', 2, src.x, src.y); if (loot >= 1 && !src.air) { S.src[1 - s].push({ s: 1 - s, n: 'Captured stores (' + src.n + ')', x: src.x, y: src.y, stock: loot, cap: loot, rate: 0, t: 0, captured: false, dropT: 0, booty: true, known: [1, 1] }); say(1 - s, 'We have captured ' + src.n + ' with ' + Math.round(loot) + ' loads of usable stores.', 2, src.x, src.y); } } else if (fr && !en && src.captured) src.captured = false;
      for (const u of S.subs) if (u.s !== s && u.active && !u.dead && Math.hypot(u.x - src.x, u.y - src.y) < 5) { (src.known || (src.known = [0, 0]))[1 - s] = 1; break; }
      if (src.captured) continue;
      if (src.booty) { if (src.stock < 1) S.src[s].splice(S.src[s].indexOf(src), 1); continue; }
      if (src.air) { const LF = S.lift[s]; if (fly > .5 && src.stock < src.cap * .75 && S.t > src.dropT && LF.left > 0) { LF.left--; src.stock = Math.min(src.cap, src.stock + src.rate * 6); src.dropT = S.t + 360; S.ev.push({ k: 'airdrop', x: src.x, y: src.y, s }); say(s, 'Air resupply dropped at ' + src.n + '.', 0, src.x, src.y); } }
      else src.stock = Math.min(src.cap, src.stock + src.rate / 6);
    }
    for (const u of S.subs) if (u.mv === 'ship' && u.active && !u.dead) u.ammo = Math.min(1, u.ammo + AMMO.shipRefill);
    for (const F of S.forms) if (F.active && !F.dead) { const starve = F.isolated && F.stock < F.cap * .15; for (const u of F.subs) if (u.active && !u.dead && u.cls !== 'hq' && u.mv !== 'ship' && (F.isolated || (u.cut && u.ammo < .3))) { if (!starve && (AIRB.test(F.n) || F.xp >= 1.15) && F.isoT != null && S.t - F.isoT < 2880) continue; hurt(u, starve ? .0003 : .00007, 'iso'); if (starve) u.coh = Math.max(0, u.coh - .004); } }   // sick and wounded who cannot be evacuated: about 1% a day while stocks last, 4% when starving; airborne and veteran troops hold the first two days
    for (const F of S.forms) {
      if (!F.active || F.dead) continue; const hq = F.hq && !F.hq.dead ? F.hq : null, hx = hq ? hq.x : F.cx, hy = hq ? hq.y : F.cy;
      for (const u of F.subs) if (u.active && !u.dead && !u.cut && Math.hypot(u.x - hx, u.y - hy) < (u.fm ? 20 : 9)) {
        let take = Math.min(1 - u.ammo, u.cls === 'art' ? AMMO.refillArt : AMMO.refill), cost = take * u.size * (u.cls === 'art' ? 1.5 : 1); if (take > .01 && F.stock >= cost) { u.ammo += take; F.stock -= cost; }
        if (u.mv !== 'foot') { take = Math.min(1 - u.fuel, .2); cost = take * u.size * .6; if (take > .01 && F.stock >= cost) { u.fuel += take; F.stock -= cost; } }
      }
      if (F.stock < F.cap * (F.post === 'rest' ? .9 : .55) && !F.convoy && S.t >= F.convT) {
        // supply priority by army (the France campaign's lever for Eisenhower): a low-priority army leaves a source's last third to the others and gets smaller loads
        const pr = S.supPrio(F), bad = F.badSrc && S.t < F.badSrc.until ? F.badSrc.src : null, list = S.src[F.s].filter(q => !q.captured && q.stock >= (pr < 0 ? Math.max(1, q.cap * .35) : 1) && S.t >= q.t * 60).sort((a, b) => (a === bad) - (b === bad) || Math.hypot(a.x - hx, a.y - hy) - Math.hypot(b.x - hx, b.y - hy));
        let sent = false;
        // a headquarters within 3 km of its own beach or depot draws straight from it
        for (const q of list.slice(0, 3)) { const p = Math.hypot(q.x - hx, q.y - hy) < 3 ? [[q.x, q.y], [hx, hy]] : map.findPath(1, q.x, q.y, hx, hy, { block: S.zoc[F.s], grad: 3, road: q.air ? 0 : ROADBIAS, comp: colComp(F.s) }); if (p) { const off = q.air ? 0 : p.off || 0, rm = off <= OFFFREE ? 1 : Math.max(OFFMIN, 1 - OFFSLOPE * (off - OFFFREE)); F.offRd = off; F.offMul = rm;   // the last stretch off the road cuts what a column can carry
            if (rm >= 1) F.offMsgR = null; else if (S.t > (F.offMsgT || 0) && (F.offMsgR == null || rm < F.offMsgR - .1)) { F.offMsgT = S.t + 720; F.offMsgR = rm; say(F, 'Supply columns must drive ' + Math.round(off) + ' km off the road to reach us. Loads are down to ' + Math.round(rm * 100) + ' percent.', 1); }
            const load = Math.min(q.stock, F.cap - F.stock, 10 * rm * (pr > 0 ? 1.3 : pr < 0 ? .7 : 1)); q.stock -= load; F.supPath = p; const c = { id: S.nid++, s: F.s, F, src: q, path: p, pi: 1, x: p[0][0], y: p[0][1], hx: 1, hy: 0, load, load0: load, st: 'out', dead: false, trail: [] }; S.convoys.push(c); F.convoy = c; sent = true; break; } }
        F.convT = S.t + (sent ? 20 : 60);
        if (!sent) { F.isoN = (F.isoN || 0) + 1; if (F.isoN >= 2 && (!F.isoRep || S.t > F.isoMsgT)) { F.isoRep = true; F.isoMsgT = S.t + 1440; say(F, list.length ? 'We are cut off. No supply route is open to ' + nearTown(hx, hy) + '.' : 'No supplies available at any depot.', 2); } F.isolated = F.isoN >= 2; } else { if (F.isoRep) say(F, 'A supply road is open to us again.', 1); F.isolated = false; F.isoN = 0; F.isoRep = false; }   // one failed attempt may be the fighting on the road; the second makes it isolation
      }
    }
    for (const c of S.convoys) if (!c.dead) for (const e of S.subs) if (e.s !== c.s && e.active && !e.dead && e.cls !== 'hq' && Math.hypot(e.x - c.x, e.y - c.y) < .9) { killConvoy(c, 'ambushed'); break; }
    // interdiction on the road: a column turns back from a known enemy block on its route, and enemy guns shell any column their units can see
    for (const c of S.convoys) { if (c.dead || c.st !== 'out') continue; let blk = null;
      for (let k = c.pi; k < Math.min(c.path.length, c.pi + 8) && !blk; k++) { const p = c.path[k]; for (const e of S.subs) if (e.s !== c.s && e.active && !e.dead && e.coh > .3 && e.cls !== 'hq' && e.cls !== 'art' && e.mv !== 'ship' && S.t - e.seenT < 15 && Math.hypot(e.x - p[0], e.y - p[1]) < 1.4) { blk = e; break; } }
      if (blk && c.haul) { c.st = 'back'; c.pi = Math.max(0, c.pi - 1); say(c.F, 'The trucks carrying ' + c.haul.nm + ' turned back: the road is blocked by the enemy ' + nearTown(blk.x, blk.y) + '.', 2, blk.x, blk.y); continue; }
      if (blk) { c.st = 'back'; c.pi = Math.max(0, c.pi - 1); const src = c.src; if (src && !src.captured) src.stock += c.load; c.load = 0; if (c.F.convoy === c) c.F.convoy = null; c.F.convT = S.t + 30; c.F.badSrc = { src, until: S.t + 360 }; S.supCut = (S.supCut || 0) + 1; if (supNote(c.F, 'back')) say(c.F, 'Supply column turned back: the road is blocked by the enemy ' + nearTown(blk.x, blk.y) + '. The staff will look for another route.', 2, blk.x, blk.y); continue; }
      let seen = false; for (const e of S.subs) if (e.s !== c.s && e.active && !e.dead && e.cls !== 'hq' && Math.hypot(e.x - c.x, e.y - c.y) < 3) { seen = true; break; } c.seen = seen; if (!seen) continue;
      for (const g of S.subs) if (g.s !== c.s && g.active && !g.dead && g.k.ir && g.mv !== 'ship' && g.ammo > .1 && Math.hypot(g.x - c.x, g.y - c.y) < g.k.ir && rnd() < .2) { c.load *= .6; g.ammo = Math.max(0, g.ammo - .01); S.ev.push({ k: 'shell', x: c.x, y: c.y }); if (c.load < 1) killConvoy(c, 'destroyed by shellfire'); else if (S.t > (c.F.shellMsgT || 0)) { c.F.shellMsgT = S.t + 120; say(c.F, 'Supply column under shellfire ' + nearTown(c.x, c.y) + '. Part of the load is lost.', 1, c.x, c.y); } break; } }
    S.zones = S.zones.filter(z => z.until > S.t);
  }
  function killConvoy(c, how) { c.dead = true; if (c.haul) { const a = c.haul; a.st = 'lost'; a.n = 0; a.haul = null; S.ev.push({ k: 'convoyLost', x: c.x, y: c.y }); say(c.F, 'The trucks carrying ' + a.nm + ' were ' + how + ' ' + nearTown(c.x, c.y) + '. The equipment is lost.', 2, c.x, c.y); return; } if (c.st === 'out') S.supLost = (S.supLost || 0) + 1; S.ev.push({ k: 'convoyLost', x: c.x, y: c.y }); if (c.F.convoy === c) c.F.convoy = null; if (c.st === 'out') { const F = c.F; F.convT = Math.max(F.convT, S.t + 90); F.badSrc = { src: c.src, until: S.t + 360 }; const n = supNote(F, 'lost'); if (n) say(F, 'Supply column ' + how + ' ' + nearTown(c.x, c.y) + '.' + (n > 1 ? ' ' + n + ' columns lost in the last six hours.' : ''), 2, c.x, c.y); } }
  // supply troubles are reported once every six hours per formation and kind; the count says how many happened since
  function supNote(F, k) { const N = F.supN || (F.supN = {}), T = F.supT || (F.supT = {}); N[k] = (N[k] || 0) + 1; if (S.t < (T[k] || 0)) return 0; T[k] = S.t + (k === 'back' ? 720 : 360); const n = N[k]; N[k] = 0; return n; }
  function moveConvoys(dt) {
    for (const c of S.convoys) {
      if (c.dead) continue; let sp = 24 / 60 * Math.max(.1, map.fac[1][map.idx(c.x, c.y)]) * WXMOVE[S.wx] * (S.night ? .8 : 1);
      for (const z of S.zones) if (z.s !== c.s && Math.hypot(z.x - c.x, z.y - c.y) < z.r) sp *= .5;
      let rem = sp * dt;
      while (rem > 0 && c.pi >= 0 && c.pi < c.path.length) { const p = c.path[c.pi], dx = p[0] - c.x, dy = p[1] - c.y, d = Math.hypot(dx, dy); if (d < 1e-4) { c.pi += c.st === 'out' ? 1 : -1; continue; } const st = Math.min(d, rem); c.x += dx / d * st; c.y += dy / d * st; c.hx = dx / d; c.hy = dy / d; rem -= st; if (st >= d - 1e-6) c.pi += c.st === 'out' ? 1 : -1; }
      if (c.st === 'out' && c.pi >= c.path.length && c.haul) { const a = c.haul; a.st = 'site'; a.x = c.x; a.y = c.y; a.haul = null; c.dead = true; say(c.F, a.nm + (a.k === 'boats' ? ' have' : ' has') + ' reached the crossing site on the ' + (a.site ? a.site.n : 'river') + '.', 1, c.x, c.y); continue; }
      if (c.st === 'out' && c.pi >= c.path.length) { c.F.stock = Math.min(c.F.cap, c.F.stock + c.load); c.load = 0; c.st = 'back'; c.pi = c.path.length - 2; if (c.F.convoy === c) c.F.convoy = null; }
      else if (c.st === 'back' && c.pi < 0) { c.dead = true; if (c.haul) { const a = c.haul; a.st = 'park'; a.x = c.x; a.y = c.y; a.haul = null; } }
    }
    if (S.convoys.length > 40 || S.convoys.some(c => c.dead)) S.convoys = S.convoys.filter(c => !c.dead);
  }

  // ---------- air ----------
  function flyable() { const h = S.hourOf(S.t); if (h < S.dayA || h > S.dayB) return 0; return S.wx === 'clear' ? 1 : S.wx === 'cloud' ? .7 : 0; }
  S.flyable = flyable;
  function launch(g, tgt, role) {
    const A = S.air[g.s], b = A.bases[g.base]; const r = g.ac[1]; const n = Math.min(g.avail, tgt.type === 'rec' ? 2 : r === 'HB' ? 18 : r === 'B' ? 12 : 8); if (n < 2) return null;
    g.avail -= n; const fl = { id: S.nid++, s: g.s, g, ac: g.ac, key: g.key, n, n0: n, x: b.x, y: b.y, bx: b.x, by: b.y, hd: Math.atan2(tgt.y - b.y, tgt.x - b.x), st: 'out', tgt, role: role || r, icp: false, atkT: 0 };
    S.flights.push(fl); return fl;
  }
  function airTick() {
    const fly = flyable();
    for (let s = 0; s < 2; s++) {
      const A = S.air[s]; A.cas = A.cas.filter(q => S.t - q.t < 50 && q.u && !q.u.dead);
      A.strat = A.strat.filter(q => !(q.type === 'bridge' && !q.ref.intact) && !(q.type === 'ship' && q.ref.dead));
      for (const g of A.groups) {
        for (let i = g.pend.length - 1; i >= 0; i--) if (S.t >= g.pend[i].t) { g.avail += g.pend[i].n; g.pend.splice(i, 1); }
        if (!fly || S.t < g.next || g.avail < 4) continue; if (fly < 1 && rnd() < .4) continue;
        if (g.mission === 'cas' && A.cas.length) { const q = A.cas.shift(); if (launch(g, { type: 'cas', u: q.u, x: q.u.x, y: q.u.y, F: q.F })) { g.next = S.t + 25; say(q.F, g.n + ' (' + g.ac[0] + ') inbound in support.', 0, q.u.x, q.u.y); } }
        else if (g.mission === 'int' && A.int.length) { const z = A.int[A.ri++ % A.int.length]; if (launch(g, { type: 'int', x: z.x, y: z.y, z })) g.next = S.t + 50; }
        else if (g.mission === 'rec') { let z = A.rec.length ? A.rec[A.rci++ % A.rec.length] : null;
          if (!z) { const foes = S.forms.filter(F => F.s !== s && F.active && !F.dead); if (foes.length) { const F = foes[(A.rci++ * 7) % foes.length]; z = { x: F.cx, y: F.cy, auto: 1 }; } }
          if (z && launch(g, { type: 'rec', x: z.x, y: z.y, z })) g.next = S.t + 35; }
        else if (g.mission === 'strat' && A.strat.length) { const q = A.strat[A.si++ % A.strat.length]; if (launch(g, { type: 'strat', x: q.x, y: q.y, q })) g.next = S.t + 90; }
      }
      // weather report for refused CAS
      if (!fly && A.cas.length) { const q = A.cas[0]; if (S.t > q.F.airMsgT) { q.F.airMsgT = S.t + 360; say(q.F, 'Air support requested but none can fly: ' + (S.night ? 'darkness' : WXNAME[S.wx].toLowerCase()) + '.', 1); } A.cas.length = 0; }
    }
    if (fly) for (const f of S.flights) if (f.st === 'out' && !f.icp && f.role !== 'I') { const E = S.air[1 - f.s]; const g = E.groups.find(q => q.mission === 'cap' && q.avail >= 4); if (g && rnd() < .3 * fly) { f.icp = true; launch(g, { type: 'icp', fl: f, x: f.x, y: f.y }, 'I'); } }
  }
  S.aaRole = function (F, i, on) { const u = F.subs[i]; if (!u || !u.k.aa || u.dead) return false; u.aaRole = on == null ? !u.aaRole : !!on; return true; };
  function flakTick(dt) {
    const night = S.night ? .4 : 1, cl = S.wx === 'cloud' ? .8 : 1;
    for (const f of S.flights) { if (f.st === 'gone' || f.n <= 0) continue; const low = f.role === 'F' || f.role === 'FB' || f.role === 'I' || f.ac[1] === 'T' || (f.tgt && f.tgt.type === 'rec');
      for (const u of S.subs) { if (u.s === f.s || !u.aaRole || !u.k.aa || !u.active || u.dead || u.broken || u.coh < .3 || u.ammo < .05) continue; const a = u.k.aa; if (Math.hypot(u.x - f.x, u.y - f.y) > a.r) continue;
        const p = (low ? a.lo : a.hi) * .012 * u.str * night * cl * dt * (f.ac[1] === 'T' ? 1.3 : 1); u.ammo = Math.max(0, u.ammo - .0008 * dt); u.rptT = S.t; u.rpx = u.x; u.rpy = u.y; u.rpBy = f.s; u.fireT = S.t;
        if (rnd() < f.n * p) { f.n--; f.g.total = Math.max(0, f.g.total - 1); f.flakL = (f.flakL || 0) + 1; u.aaK = (u.aaK || 0) + 1; S.ev.push({ k: 'flakhit', x: f.x, y: f.y }); if (f.n <= 0) { f.st = 'gone'; say(f.s, f.g.n + ': the whole flight was shot down by flak ' + nearTown(f.x, f.y) + '.', 2, f.x, f.y); break; } } } }
  }
  function moveFlights(dt) {
    flakTick(dt);
    for (const f of S.flights) {
      if (f.st === 'gone') continue; const sp = f.ac[2] * 1.609 / 60 * .5 * (f.role === 'I' ? 1.25 : 1);
      let tx, ty;
      if (f.st === 'out') { if (f.tgt.type === 'icp') { const q = f.tgt.fl; if (q.st === 'gone' || q.st === 'rtb') { f.st = 'rtb'; continue; } tx = q.x; ty = q.y; } else if (f.tgt.type === 'cas' && f.tgt.u && !f.tgt.u.dead) { tx = f.tgt.u.x; ty = f.tgt.u.y; f.tgt.x = tx; f.tgt.y = ty; } else { tx = f.tgt.x; ty = f.tgt.y; } }
      else if (f.st === 'attack') { if (S.t >= f.atkT) f.st = 'rtb'; const a = (S.t - f.atkT) * .9 + f.id; tx = f.tgt.x + Math.cos(a) * 1.6; ty = f.tgt.y + Math.sin(a) * 1.6; }
      else { tx = f.bx; ty = f.by; }
      const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy); const want = Math.atan2(dy, dx); let dh = want - f.hd; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; const mt = 1.1 * dt; f.turn = clamp(dh, -mt, mt); f.hd += f.turn;
      const st = sp * dt; f.x += Math.cos(f.hd) * st; f.y += Math.sin(f.hd) * st;
      if (f.st === 'out' && d < Math.max(1.2, st * 1.2)) { if (f.tgt.type === 'icp') dogfight(f); else attack(f); }
      else if (f.st === 'rtb' && d < Math.max(1.5, st * 1.2)) { f.st = 'gone'; if (f.n > 0) f.g.pend.push({ t: S.t + 70, n: f.n }); if (f.flakL && !S.ai[f.s]) say(f.s, f.g.n + ' lost ' + f.flakL + ' aircraft to flak on this sortie.', 1); }
    }
    if (S.flights.some(f => f.st === 'gone')) S.flights = S.flights.filter(f => f.st !== 'gone');
  }
  function dogfight(I) {
    const f = I.tgt.fl; const esc = S.air[f.s].groups.some(g => g.mission === 'cap' && g.avail >= 4) ? .55 : 1;
    const lf = Math.min(f.n, Math.round(I.n * I.ac[4] * .22 * esc * (.5 + rnd()) / Math.max(.6, f.ac[4] + .3))), li = Math.min(I.n, Math.round(f.n * f.ac[4] * .1 * (.5 + rnd())));
    f.n -= lf; I.n -= li; f.g.total -= lf; I.g.total -= li; S.ev.push({ k: 'dogfight', x: f.x, y: f.y, a: I.id, b: f.id, lf, li });
    if (f.n <= 0) f.st = 'gone'; else if (f.ac[1] !== 'F' && rnd() < .4 * esc) { f.st = 'rtb'; say(f.s, f.g.n + ' intercepted and turned back ' + nearTown(f.x, f.y) + '.', 0, f.x, f.y); }
    I.st = I.n > 0 ? 'rtb' : 'gone';
  }
  function hitSub(f, e, mul) {
    const cov = Math.sqrt(COVER[map.tAt(e.x, e.y)] * (1 - .5 * e.ent) * (e.moving ? 1.5 : 1)); const w = f.ac[3] / 1000 * f.n * .0032 * mul * cov * (e.k.arm > 20 ? .6 : 1) / Math.max(.3, e.size);
    hurt(e, w, 'air'); e.dC += .1 * mul + w * 3; e.hitT = S.t; e.seenT = S.t; e.mor = Math.max(0, e.mor - .02 * mul);
    for (const o of S.subs) if (o !== e && o.s === e.s && o.active && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < .8) o.dC += .04;
  }
  function attack(f) {
    if (f.tgt.type === 'rec') { f.st = 'attack'; f.atkT = S.t + 6; const tg = f.tgt, es = 1 - f.s, R0 = 7; let n = 0, nc = 0, flak = 0;
      for (const e of S.subs) if (e.s === es && e.active && !e.dead && e.mv !== 'ship' && Math.hypot(e.x - tg.x, e.y - tg.y) < R0) { if (e.k.aa && e.aaRole) flak += .03 * e.k.aa.lo; else if (e.cls === 'at') flak += .005; const tc = map.t[map.idx(e.x, e.y)], p = CONCEAL[tc] * (e.moving ? 1.3 : .8) * (e.ent > .5 ? .7 : 1); if (rnd() < Math.min(.95, p)) { e.rptT = S.t; e.rpx = e.x + (rnd() - .5) * .6; e.rpy = e.y + (rnd() - .5) * .6; e.rpBy = f.s; n++; } }
      for (const c of S.convoys) if (!c.dead && c.s === es && Math.hypot(c.x - tg.x, c.y - tg.y) < R0) { c.rptT = S.t; c.rpBy = f.s; nc++; }
      for (const q of S.src[es]) if (Math.hypot(q.x - tg.x, q.y - tg.y) < R0 + 2) (q.known || (q.known = [0, 0]))[f.s] = 1;
      if (rnd() < flak) { f.n = Math.max(0, f.n - 1); }
      if (!S.ai[f.s]) say(f.s, 'Air reconnaissance ' + nearTown(tg.x, tg.y) + ': ' + (n ? n + ' enemy unit' + (n > 1 ? 's' : '') + ' reported' : 'no enemy seen') + (nc ? ', ' + nc + ' supply column' + (nc > 1 ? 's' : '') + ' on the roads' : '') + '.', n ? 1 : 0, tg.x, tg.y);
      return; }
    f.st = 'attack'; f.atkT = S.t + 5; const tg = f.tgt, es = 1 - f.s; let flak = .015, kind = f.ac[1] === 'FB' || f.ac[1] === 'F' ? (f.key === 'typhoon' ? 'rocket' : 'bomb') : 'carpet', what = '';
    for (const e of S.subs) if (e.s === es && e.active && !e.dead && Math.hypot(e.x - tg.x, e.y - tg.y) < 4) { e.seenT = S.t; if (e.k.aa && e.aaRole) flak += .05 * (f.ac[1] === 'F' || f.ac[1] === 'FB' ? e.k.aa.lo : e.k.aa.hi); else flak += .004; }
    if (tg.type === 'cas') {
      let e = tg.u && !tg.u.dead && Math.hypot(tg.u.x - f.x, tg.u.y - f.y) < 5 ? tg.u : null;
      if (!e) { let bd = 3.5; for (const q of S.subs) if (q.s === es && q.active && !q.dead) { const d = Math.hypot(q.x - tg.x, q.y - tg.y); if (d < bd) { bd = d; e = q; } } }
      if (e) { tg.x = e.x; tg.y = e.y; hitSub(f, e, 1); what = e.n; say(tg.F, f.g.n + ' struck ' + e.n + ' ' + nearTown(e.x, e.y) + '.', 0, e.x, e.y); } else kind = 'none';
    } else if (tg.type === 'int') {
      let hits = 0; for (const c of S.convoys) if (!c.dead && c.s === es && Math.hypot(c.x - tg.x, c.y - tg.y) < 5) { c.rptT = S.t; c.rpBy = f.s; if (rnd() < .65) { killConvoy(c, 'destroyed from the air'); S.supAir = (S.supAir || 0) + 1; if (!S.ai[f.s]) say(f.s, f.g.n + ' caught an enemy supply column ' + nearTown(c.x, c.y) + ' and destroyed it.', 1, c.x, c.y); hits++; tg.x = c.x; tg.y = c.y; } }
      const cand = S.subs.filter(e => e.s === es && e.active && !e.dead && Math.hypot(e.x - tg.z.x, e.y - tg.z.y) < 5 && (e.moving || CONCEAL[map.tAt(e.x, e.y)] >= .9)).sort((a, b) => (b.moving ? 1 : 0) - (a.moving ? 1 : 0)).slice(0, 2);
      for (const e of cand) { hitSub(f, e, .6); hits++; if (!what) { tg.x = e.x; tg.y = e.y; what = e.n; } }
      S.zones.push({ s: f.s, x: tg.z.x, y: tg.z.y, r: 4, until: S.t + 100 });
      if (hits) say(f.s, f.g.n + ' interdiction ' + nearTown(tg.x, tg.y) + ': ' + hits + ' target' + (hits > 1 ? 's' : '') + ' hit.', 0, tg.x, tg.y);
    } else if (tg.type === 'strat') {
      const q = tg.q;
      if (q.type === 'bridge') { const ph = f.ac[1] === 'HB' ? .03 : f.ac[1] === 'B' ? .045 : .05; if (q.ref.intact && rnd() < 1 - Math.pow(1 - ph, f.n)) { map.setBridge(q.ref, false); q.ref.wired = 0; S.ev.push({ k: 'bridge', b: q.ref, blown: true }); say(-1, 'The ' + q.ref.name + ' has been destroyed by bombing.', 2, q.ref.x, q.ref.y); } }
      else if (q.type === 'source') { q.ref.stock *= 1 - Math.min(.5, f.n * .025); say(f.s, f.g.n + ' bombed ' + q.ref.n + '.', 0, q.x, q.y); S.ev.push({ k: 'townfire', x: q.x, y: q.y }); }
      else if (q.type === 'base') { for (const g of S.air[es].groups) if (g.base === q.ref) { const l = Math.min(g.avail, Math.round(f.n * .15 * rnd() * 2)); g.avail -= l; g.total -= l; g.next = Math.max(g.next, S.t + 90); } flak += .04; say(f.s, f.g.n + ' struck the airfields at ' + S.air[es].bases[q.ref].n + '.', 0, q.x, q.y); }
      else if (q.type === 'ship') { if (rnd() < .2 + f.n * .05) { q.ref.silT = S.t + 180; say(q.ref.f, q.ref.n + ' hit by air attack and out of action for three hours.', 2, q.x, q.y); S.ev.push({ k: 'townfire', x: q.x, y: q.y }); } flak += .05; }
      else if (q.type === 'town') { q.ref.fire = 1; S.ev.push({ k: 'townfire', x: q.x, y: q.y }); for (const e of S.subs) if (e.s === es && e.active && !e.dead && Math.hypot(e.x - q.x, e.y - q.y) < 1.2) hitSub(f, e, .5); }
    }
    const lost = Math.min(f.n, Math.round(f.n * flak * (.4 + rnd() * 1.4))); f.n -= lost; f.g.total -= lost;
    S.ev.push({ k: 'air', f, x: tg.x, y: tg.y, kind, n: f.n0 });
  }
  S.addRec = (s, x, y) => { const A = S.air[s]; if (A.rec.length >= 4) A.rec.shift(); A.rec.push({ x, y }); return true; };
  S.addInt = (s, x, y) => { const A = S.air[s]; if (A.int.length >= 4) A.int.shift(); A.int.push({ x, y }); };
  S.findStrat = function (s, x, y) {
    let best = null, bd = 2.6; const t = (o, type, ref, n) => { const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; best = { type, ref, x: o.x, y: o.y, n }; } };
    for (const b of map.bridges) if (b.intact) t(b, 'bridge', b, b.name); for (const q of S.src[1 - s]) t(q, 'source', q, q.n);
    S.air[1 - s].bases.forEach((b, i) => t(b, 'base', i, b.n)); for (const u of S.subs) if (u.s !== s && u.active && !u.dead && u.mv === 'ship') t(u, 'ship', u, u.n); for (const tw of map.towns) t(tw, 'town', tw, tw.name); return best;
  };
  S.addStrat = (s, q) => { const A = S.air[s]; if (A.strat.some(o => o.ref === q.ref && o.type === q.type)) return; if (A.strat.length >= 4) A.strat.shift(); A.strat.push(q); };

  // ---------- bridges, VP, arrivals ----------
  function bridgeTick() {
    for (const b of map.bridges) { if (b.gone) continue;
      if (b.intact) { if (b.wired > 0 && !b.rolled) { for (const e of S.subs) if (e.active && !e.dead && e.s !== b.own && e.cls !== 'hq' && e.cls !== 'art' && Math.hypot(e.x - b.x, e.y - b.y) < 1) { b.rolled = true; if (rnd() < b.wired) { map.setBridge(b, false); S.ev.push({ k: 'bridge', b, blown: true }); say(e.f, 'The enemy has blown the ' + b.name + ' in our faces.', 2, b.x, b.y); say(b.own, 'The ' + b.name + ' has been demolished.', 1, b.x, b.y); for (const u of S.subs) if (u.goal) u.needPath = true; } else if (b.wired > .3) say(e.f, 'The ' + b.name + ' is in our hands intact.', 1, b.x, b.y); break; } } }
      else { let eng = null, enemy = false; for (const u of S.subs) if (u.active && !u.dead && Math.hypot(u.x - b.x, u.y - b.y) < 1.2) { if (u.cls === 'eng' && !eng) eng = u; } if (eng) { for (const u of S.subs) if (u.active && !u.dead && u.s !== eng.s && u.cls !== 'hq' && Math.hypot(u.x - b.x, u.y - b.y) < 1) enemy = true; if (!enemy) { b.work += 5 / (b.repairH * 60) * (.4 + .6 * eng.str); if (b.work >= 1) { map.setBridge(b, true); b.wired = 0; S.ev.push({ k: 'bridge', b, blown: false }); say(eng.f, 'The ' + b.name + ' is open to traffic.', 2, b.x, b.y); for (const u of S.subs) { u.noPath = false; u.detour = 0; if (u.goal) u.needPath = true; } for (const F of S.forms) if (F.bridge === b) { F.bridge = null; F.halt = false; if (F.order) F.order.bestT = S.t; } } } } }
    }
  }
  function vpTick() {
    for (const v of S.vp) { let a = false, b = false, ha = false, hb = false, hold = false; for (const u of S.subs) if (u.active && !u.dead && u.coh > .3 && u.mv !== 'ship') { const d = Math.hypot(u.x - v.x, u.y - v.y); if (v.cells ? d < v.cellR && (d < S.urban.centreKm || v.cells.has(map.idx(u.x, u.y))) : d < 1.2) {   /* a town with a built-up area: troops in the town (urban module) */ if (u.cls === 'hq') { if (u.s === 0) ha = true; else hb = true; } else if (u.s === 0) a = true; else b = true; } else if (!v.cells && d < v.capR && u.s === v.own && u.cls !== 'hq') hold = true; } if ((a && hb) || (b && ha)) { v.capN = 0; continue; } if (a === b) v.capN = 0; else { const o = a ? 0 : 1; if (o === v.own || hold) v.capN = 0; else if ((v.capN = (v.capN || 0) + 1) >= 3) { v.capN = 0; if (!v.first) { v.first = [null, null]; v.lost = [null, null]; v.chg = []; } v.chg.push([S.t / 60, o]); if (v.first[o] == null) v.first[o] = S.t / 60; if ((v.own === 0 || v.own === 1) && v.lost[v.own] == null) v.lost[v.own] = S.t / 60; v.own = o; disc(v.x, v.y, 1, c => { OW.a[c] = o; }); for (const u of S.subs) if (u.s === o && u.active && !u.dead && Math.hypot(u.x - v.x, u.y - v.y) < 3) u.mor = Math.min(1, u.mor + .05); say(-1, v.n + ' taken by ' + (sc.labels || ['Allied', 'Axis'])[o] + ' forces.', 2, v.x, v.y); } } }
    if (S.relN === undefined) { const g = typeof GUIDE !== 'undefined' && GUIDE[sc.id]; S.relN = g ? g.deadlines.filter(d => d.relieve).map(d => d.n) : []; }   // encirclement record for relief deadlines
    if (S.relN.length && Math.floor(S.t / 60) !== Math.floor((S.t - 10) / 60)) for (const v of S.vp) if (S.relN.includes(v.n) && (v.own === 0 || v.own === 1)) {
      const s = v.own, cut = !S.src[s].some(q => !q.air && !q.captured && S.t >= (q.t || 0) * 60 && map.findPath(1, q.x, q.y, v.x, v.y, { block: S.zoc[s], grad: 3 }));
      if (v.relS !== s) { v.relS = s; v.cutN = 0; v.conN = 0; }   // counts restart when the objective changes hands
      v.cutN = cut ? (v.cutN || 0) + 1 : 0; v.conN = cut ? 0 : (v.conN || 0) + 1;   // hours in a row cut off, or connected
      if (v.cutN >= 3 && v.cutT == null) { v.cutT = S.t / 60 - 2; v.cutS = s; } if (v.conN >= 6 && v.cutT != null && v.cutS === s && v.relT == null) v.relT = S.t / 60 - 5; if (v.conN >= 6) { if (!v.linkT) v.linkT = [null, null]; if (v.linkT[s] == null) v.linkT[s] = S.t / 60 - 5; } }
    for (const tw of map.towns) if (tw.fire > 0) tw.fire = Math.max(0, tw.fire - 1 / 70);
  }
  S.score = () => { const r = [0, 0]; for (const v of S.vp) r[v.own] += v.pts; return r; };
  function arrivals() {
    for (const F of S.forms) if (F.arr && !F.active && !F.dead) {
      if (!F.trans && F.arr.mode === 'air') {
        if (S.t >= F.arrT - 20) { const why = F.hold ? 'held' : ['fog', 'rain', 'snow', 'dust'].indexOf(S.wx) >= 0 ? WXNAME[S.wx].toLowerCase() : (!F.arr.night && S.night ? 'darkness' : ''); if (why) { F.arrT = S.t + 80; if (!F.hold && S.t > (F.postT || 0)) { F.postT = S.t + 360; say(F, 'Lift postponed: ' + why + ' over the drop zone.', 1, F.x, F.y); } F.status = F.hold ? 'Lift held on your order' : 'Lift postponed: ' + why; continue; } }
        F.status = (F.hold ? 'Lift held. ' : '') + 'Drops ' + S.clock(F.arrT);
      }
      if (!F.trans && F.arr.mode !== 'road' && S.t >= F.arrT - 20) { F.trans = true; F.status = F.arr.mode === 'air' ? 'In the air' : 'Running in'; S.ev.push({ k: 'transit', mode: F.arr.mode, from: F.arr.from, x: F.x, y: F.y, nat: F.nat, s: F.s, t0: S.t, dur: 20, glider: /Glider|Airlanding/.test(F.n) }); }
      if (S.t >= F.arrT) activate(F);
    }
  }

  // ---------- operational AI ----------
  // a planned move that depends on the situation: cond { vp: name, own: side } runs only if that objective is held by that side then
  function aiCond(c) { const v = S.vp.find(q => q.n === c.vp || q.n.startsWith(c.vp + ' ')); return !!v && v.own === c.own; }
  function autoOrder(F, tx, ty, useThreat, oo) {
    if (S.phaseBlock(F, tx, ty)) return false;
    const L = leads(F); if (!L.length) return false; let k = 0; for (const u of L) if (u.mvi > k) k = u.mvi; let threat = null;
    if (useThreat) { threat = new Float32Array(N); const r = Math.ceil(3 / map.cs); for (const e of S.subs) if (e.s !== F.s && e.active && !e.dead && known(e)) { const ci = Math.floor(e.x / map.cs), cj = Math.floor(e.y / map.cs); for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < map.W && j < map.H && di * di + dj * dj <= r * r) threat[j * map.W + i] += 3; } } }
    centroid(F); let p = map.findPath(k, F.cx, F.cy, tx, ty, { threat }); if (!p) return false;
    const thin = p => { const o = []; let acc = 0; for (let i = 1; i < p.length; i++) { acc += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (acc >= 3) { o.push(p[i]); acc = 0; } } return o; };
    let path = thin(p);
    // march table: a staff route that would cut across another column's advance tries a way round it first, and otherwise waits for the column to pass
    { const X = S.crossings(F, [[F.cx, F.cy], ...path, [tx, ty]]); if (X.length) { const pen = threat ? threat.slice() : new Float32Array(N), r = Math.ceil(1 / map.cs);
        for (const q of X) { const O = q.G.order; let acc = 0; for (let j = 1; j < O.path.length; j++) { const a = O.path[j - 1], b = O.path[j], l = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let t = 0; t <= l; t += map.cs) { if (acc + t < O.prog) continue; const x = a[0] + (b[0] - a[0]) * t / (l || 1), y = a[1] + (b[1] - a[1]) * t / (l || 1), ci = Math.floor(x / map.cs), cj = Math.floor(y / map.cs); for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = ci + di, jj = cj + dj; if (i >= 0 && jj >= 0 && i < map.W && jj < map.H) pen[jj * map.W + i] += 6; } } acc += l; } }
        const p2 = map.findPath(k, F.cx, F.cy, tx, ty, { threat: pen }); const path2 = p2 ? thin(p2) : null;
        if (path2 && !S.crossings(F, [[F.cx, F.cy], ...path2, [tx, ty]]).length) { p = p2; path = path2; }
        else if (!(oo && oo.urgent)) { F.marchT = S.t; return false; } } }
    const e = p[p.length - 1], b = p[Math.max(0, p.length - 4)]; let dx = e[0] - b[0], dy = e[1] - b[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; const hw = Math.max(1.2, L.length * .6);
    S.issueOrder(F, path, [[tx - dy * hw, ty + dx * hw], [tx + dy * hw, ty - dx * hw]], oo); return true;
  }
  S.autoOrder = autoOrder;
  // an encircled formation breaks out: the last move of its plan, which leads out of the pocket, or the nearest friendly formation that still has a supply road
  function breakout(F, mine) {
    if (F.ai && F.aiI < F.ai.length && !AIRB.test(F.n)) { const a = F.ai[F.ai.length - 1]; F.aiI = F.ai.length; S.issueOrder(F, a.path, a.line, { free: true, stretch: true }); say(F, 'We are encircled ' + nearTown(F.cx, F.cy) + '. Breaking out now.', 2); return true; }
    let best = null, bd = AIRB.test(F.n) ? 10 : 40; for (const G of mine) if (G !== F && !G.isolated) { const d = Math.hypot(G.cx - F.cx, G.cy - F.cy); if (d > 3 && d < bd) { bd = d; best = G; } }
    if (best && autoOrder(F, best.cx, best.cy, false)) { say(F, 'We are encircled ' + nearTown(F.cx, F.cy) + '. Breaking out toward ' + best.n + '.', 2); return true; }
    return false;
  }
  // a scenario boundary that some formations may not cross before a set hour (Falaise: XV Corps held at Argentan, 13 August)
  // phase lines a scenario sets for the AI: until the hour given, staff-run formations of that side take no objective beyond the line
  // (y greater than the line at that x). The France campaign uses them to hold the AI army groups to the lodgment battle.
  S.phaseBlock = function (F, x, y) { const P = sc.phaseLines; if (!P || (F.s === player && !F.staff)) return false;
    for (const q of P) { if (q.s !== F.s || S.t >= q.until * 60) continue; const L = q.line; let ly = L[L.length - 1][1]; if (x <= L[0][0]) ly = L[0][1]; else for (let i = 1; i < L.length; i++) if (x <= L[i][0]) { ly = L[i - 1][1] + (L[i][1] - L[i - 1][1]) * (x - L[i - 1][0]) / (L[i][0] - L[i - 1][0]); break; } if (q.north ? y < ly : y > ly) return true; }
    return false; };
  // supply priority: S.supPri[side] maps a command node's id to 1 (high) or -1 (low); a division takes the setting of its nearest commanding node that has one
  S.supPri = [{}, {}]; S.supPrio = F => { for (let n = F.parent; n; n = n.parent) { const v = S.supPri[F.s][n.id]; if (v) return v; } return 0; };
  S.setSupPri = function (s, node, v) { if (!node) return false; S.supPri[s][node.id] = v | 0; say(s, 'Supply priority for ' + node.n + ': ' + (v > 0 ? 'high' : v < 0 ? 'low' : 'normal') + '.', 1); return true; };
  S.haltBlock = function (F, x, y) { const h = sc.halt; return !!(h && F.s === h.s && S.t < h.until * 60 && new RegExp(h.re).test(F.n) && y < h.y); };
  // the staff follows the formation's plan from here on, and picks its own objectives when the plan runs out
  S.setStaff = function (F, on) { if (!F || F.s !== player) return false; F.staff = !!on; F.idleT = 0; if (on && F.ai) { let i = 0; while (i < F.ai.length && F.ai[i].t * 60 < S.t - 30) i++; F.aiI = Math.max(F.aiI, i); } if (on && F.order && F.order.st === 'done') F.order.doneT = -1e9; return true; };
  // two hours after an attack starts, its commander draws the lesson; the rest of his side hears of it at half strength; lessons fade over about a day
  function lessonTick() {
    for (const F of S.forms) { for (const k in F.led) { const b0 = F.ledBase && F.ledBase[k] || 0; F.led[k] = b0 + (F.led[k] - b0) * .985; } const q = F.att; if (!q || !F.active || F.dead || S.t - q.t < 120) continue; F.att = null;
      let s1 = 0, e1 = 0; for (const u of q.L) if (!u.dead) s1 += u.str * u.size; for (const e of q.en) if (!e.dead) e1 += e.str * e.size; const ol = 1 - s1 / Math.max(q.s0, .01), el = 1 - e1 / Math.max(q.e0, .01), gain = (F.order ? F.order.prog || 0 : 0) - q.prog;
      // after-action report: what the attack cost each side and what did the damage
      { const top = (a, b) => { let best = null, bv = 0; for (const c in a) { const v = a[c] - (b[c] || 0); if (v > bv) { bv = v; best = c; } } return best; }, cu = top(lbSum(q.L), q.lbL), ce = top(lbSum(q.en), q.lbE), hh = t => S.clock(t).slice(-8, -4);
        say(F, 'After action, attack ' + (q.where || '') + ' ' + hh(q.t) + ' to ' + hh(S.t) + ' hrs: our losses about ' + Math.round(Math.max(0, ol) * 100) + ' percent, enemy about ' + Math.round(Math.max(0, el) * 100) + ' percent' + (gain > .5 ? ', ' + gain.toFixed(1) + ' km gained' : '') + '.' + (cu ? ' Most of our losses to ' + CAUSE[cu] + '.' : '') + (ce ? ' Most of his to ' + CAUSE[ce] + '.' : ''), 1); }
      if (!S.learn) continue;
      const bad = ol > .05 && ol > el * .9 && gain < 2, win = !bad && ((el > ol * 1.6 && el > .06) || gain > 2.5); if (!win && !bad) continue;   // an indecisive action teaches nothing
      const base = (bad ? .13 * clamp(.5 + q.r / 2, .6, 1.5) : .05 * clamp(1.7 - q.r / 1.5, .15, 1)) * (.6 + .8 * F.cmd.sk) * (bad ? 1.4 - .8 * F.cmd.ag : .6 + .8 * F.cmd.ag) * (bad ? 1 : -1),   // a mistake teaches more than a success, and a surprise more than the expected result
      mine = F.s === player; let told = null;
      for (const k of q.tags) { const d = base * (k === 'gen' ? .4 : 1), w0 = F.led[k] || 0; F.led[k] = clamp(w0 + d, -.4, .4); const c = F.ledN[k] || (F.ledN[k] = [0, 0]); c[bad ? 1 : 0]++; if (k !== 'gen' && Math.abs(F.led[k]) >= .12 && Math.abs(w0) < .12) told = k;
        for (const G of S.forms) if (G !== F && G.s === F.s && G.active && !G.dead && Math.hypot(G.cx - F.cx, G.cy - F.cy) < 15) G.led[k] = clamp((G.led[k] || 0) + d * .5, -.4, .4); }
      S.staff[F.s][bad ? 'lost' : 'won'] = (S.staff[F.s][bad ? 'lost' : 'won'] || 0) + 1; F.lastRes = { t: S.t, bad };
      if (told && mine) say(F, bad ? 'That attack cost us too much. I will want better odds before ' + LESSON[told] + ' again.' : 'That went well. I am ready to take more risk ' + LESSON[told] + '.', 1); }
    // the army staff notes which objectives the opponent goes for; recent events count for more
    if (S.learn && S.t >= (S.heatT || 0)) { S.heatT = S.t + 60; for (let s = 0; s < 2; s++) for (const v of S.vp) { if (!v.heat) { v.heat = [0, 0]; v.thrOn = [false, false]; } v.heat[s] *= .97; if (v.orig !== s && v.own !== s) continue; let thr = v.own !== s; if (!thr) for (const u of S.subs) if (u.s !== s && u.active && !u.dead && LEADCLS[u.cls] && Math.hypot(u.x - v.x, u.y - v.y) < 3) { thr = true; break; } if (thr && !v.thrOn[s]) { v.heat[s] += 1; for (const w of S.vp) if (w !== v && w.own === s && Math.hypot(w.x - v.x, w.y - v.y) < 15) { if (!w.heat) { w.heat = [0, 0]; w.thrOn = [false, false]; } w.heat[s] += .5; } } v.thrOn[s] = thr; } }
  }
  S.lessons = F => Object.keys(F.led).filter(k => k !== 'gen' && Math.abs(F.led[k]) >= .08).sort((a, b) => Math.abs(F.led[b]) - Math.abs(F.led[a])).map(k => ({ k, w: F.led[k], txt: (F.led[k] > 0 ? 'Wary of ' : 'Confident ') + LESSON[k], n: F.ledN[k] || [0, 0], base: !!(F.ledBase && F.ledBase[k]) }));
  // fighting power of a side near a point (enemy: only units seen in the last hour), of a formation, and whether a formation is already in a fight
  function powNear(s, x, y, r, seen, skip) { let p = 0; for (const u of S.subs) if (u.s === s && u.active && !u.dead && u.cls !== 'hq' && u.mv !== 'ship' && (!skip || u.f !== skip) && (!seen || S.t - u.seenT < 60) && Math.hypot(u.x - x, u.y - y) < r) p += defPow(u); return p; }
  function formPow(F) { let p = 0; for (const u of F.subs) if (u.active && !u.dead && u.cls !== 'hq' && u.mv !== 'ship') p += pow(u); return p; }
  function engaged(F, r) { for (const u of S.subs) if (u.s !== F.s && u.active && !u.dead && u.cls !== 'hq' && known(u) && Math.hypot(u.x - F.cx, u.y - F.cy) < r) return true; return false; }
  // alternative plans: at the start the attacking computer side picks the historical plan or an alternative, which sends some formations against a neighbouring objective
  function altTarget(F, a) { const s = F.s; if (!S.planV) S.planV = [0, 1].map(q => S.ai[q] && sc.sides[q].posture === 'attack' ? (rnd() < .5 ? 1 : 0) : 0);
    if (!S.planV[s] || F.stay || F.hold || AIRB.test(F.n) || !a.line || a.line.length < 2) return null;
    const m = polyAt(a.line, polyLen(a.line) / 2); let v0 = null; for (const v of S.vp) if (v.own !== s && Math.hypot(v.x - m.x, v.y - m.y) < 4) { v0 = v; break; } if (!v0) return null;
    F.altV = F.altV || {}; if (F.altV[v0.n] !== undefined) return F.altV[v0.n]; if (rnd() < .4) return (F.altV[v0.n] = null);
    let best = null, bd = 1e9; for (const v of S.vp) { if (v === v0 || v.own === s) continue; const d = Math.hypot(v.x - v0.x, v.y - v0.y); if (d < 20 && Math.hypot(v.x - F.cx, v.y - F.cy) < 35 && d < bd) { bd = d; best = v; } }
    return (F.altV[v0.n] = best); }
  function aiTick() {
    lessonTick();   // after-action reports always; learning only when it is on
    for (let s = 0; s < 2; s++) {
      const side = !!S.ai[s], mine = S.forms.filter(F => F.s === s && F.active && !F.dead), run = side ? mine : mine.filter(F => F.staff);
      for (const F of mine) if (F.isolated) { if (F.isoT == null) F.isoT = S.t; } else F.isoT = null;
      for (const F of run) {
        if (F.stayUntil && F.stay && (S.t >= F.stayUntil * 60 || (F.stayMinStr && S.strength(F) < F.stayMinStr))) { F.stay = false; F.stayUntil = 0; }   // stayMinStr: a worn-out division gives up its stand   // a standing order to hold that lapses at a set hour (France: Hitler's no-withdrawal orders)
        if (F.ai && (side || F.staff)) while (F.aiI < F.ai.length && S.t >= F.ai[F.aiI].t * 60) { const a = F.ai[F.aiI++]; if (a.cond && !aiCond(a.cond)) continue; const alt = side && !a.cond ? altTarget(F, a) : null; if (!(alt && autoOrder(F, alt.x, alt.y, false, { free: true, stretch: true }))) S.issueOrder(F, a.path, a.line, { free: true, stretch: true, then: a.then }); }
        // a main effort stalled for twelve hours shifts to the objective where the known enemy is weakest
        if (side && sc.sides[s].posture === 'attack' && F.order && F.order.st === 'active' && F.order.bestT != null && S.t - F.order.bestT > 720 && S.t > (F.replT || 0) && !F.stay && !F.hold && !AIRB.test(F.n)) { F.replT = S.t + 720; let best = null, bs = 1e9;
          for (const v of S.vp) { if (v.own === s) continue; const d = Math.hypot(v.x - F.cx, v.y - F.cy); if (d < 2 || d > 25) continue; const sc0 = powNear(1 - s, v.x, v.y, 4, true) * 3 + d * .15 - v.pts * .05; if (sc0 < bs) { bs = sc0; best = v; } }
          if (best && autoOrder(F, best.x, best.y, false, { free: true })) { F.aiI = F.ai ? F.ai.length : 0; say(F, 'The attack has stalled. The main effort shifts toward ' + best.n + '.', 1); } }
        // encircled for six hours and running short: break out now instead of waiting for the planned withdrawal
        const pk = sc.sides[s].pocket; if ((side || S.staffOpt[s].commit) && pk && F.isolated && S.t - F.isoT >= 360 && S.t >= (F.boT || 0) && !F.stay && F.stock < F.cap * .5 && (sc.sides[s].posture !== 'attack' || S.strength(F) < .45 || F.stock < F.cap * .25) && (!AIRB.test(F.n) || S.strength(F) < .35)) { F.boT = S.t + 360; if (breakout(F, mine)) continue; }
        const O = F.order; const scripted = (side || F.staff) && F.ai && F.aiI < F.ai.length;
        if (O && O.st === 'refused') { if (/no fighting units|combat ineffective/.test(O.why) || (O.ref = (O.ref || 0) + 1) > 12) { F.order = null; F.spent = true; F.status = 'Combat ineffective'; } else if (S.t - O.t0 > 150) { O.st = 'pending'; O.t0 = S.t; } }
        if (F.halt && S.t - F.haltT > 300 && S.t > F.rerouteT && O && O.st === 'active') { F.rerouteT = S.t + 420; F.shift = (F.shift || 0) === 0 ? (rnd() < .5 ? 2.2 : -2.2) : -F.shift; F.halt = false; O.bestT = S.t; }
        // an objective about to be overrun calls in any free formation within 20 km, even one still waiting for its next planned move
        if ((side || S.staffOpt[s].commit) && !F.hold && !F.stay && !F.spent && S.t > (F.urgT || 0) && (!O || O.st === 'done') && S.strength(F) > .5 && !engaged(F, 5)) { F.urgT = S.t + 60; let uv = null, ub = 1e9;
          for (const v of S.vp) { if (v.own !== s) continue; const d = Math.hypot(v.x - F.cx, v.y - F.cy); if (d < 2 || d > 20 || mine.filter(G => G !== F && G.tgtVP === v && G.order && G.order.st !== 'done').length >= 2) continue; const E = powNear(1 - s, v.x, v.y, 8, true), D = powNear(s, v.x, v.y, 4, false, F); if (E > .5 && E > D * 1.5 && d - v.pts * .5 < ub) { ub = d - v.pts * .5; uv = v; } }
          if (uv && autoOrder(F, uv.x, uv.y, false, { urgent: true })) { F.tgtVP = uv; F.urgT = S.t + 240; say(F, 'Moving to reinforce ' + uv.n + ' against the enemy attack.', 1); continue; } }
        if (!scripted && S.t > F.idleT && (F.staff || S.t >= F.freeT) && (!O || (O.st === 'done' && S.t - (O.doneT || 0) > (sc.sides[s].restH || 3) * 60))) {   // restH: hours a staff-run formation waits after one objective before the next (a set-piece rhythm)
          F.idleT = S.t + 300 * dfS(s).react; if (S.strength(F) < .4 || S.cohesion(F) < .5 || F.stock < F.cap * plan[s].stk) continue;
          let tgt = null, bd = 1e9, pre = null; const atk = sc.sides[s].posture === 'attack';
          // the staff weighs each objective: known enemy strength within 8 km against our own within 4 km. A formation free to move goes where the balance is worst, and counterattacks a lost objective it can retake
          const free = !F.hold && !F.stay && !F.spent && S.strength(F) > .5 && !engaged(F, 5), fp = free ? formPow(F) : 0;
          if (free) for (const v of S.vp) { const d = Math.hypot(v.x - F.cx, v.y - F.cy); if (d < 1.5 || d > 30 || mine.filter(G => G !== F && G.tgtVP === v && G.order && G.order.st !== 'done').length >= 2) continue;
            const E = powNear(1 - s, v.x, v.y, 8, true), D = powNear(s, v.x, v.y, 4, false, F);
            if (v.own === s && E > .3 && E > D * 1.1) { const sc0 = d - 22 - v.pts * .5 - Math.min(8, (E - D) * 2); if (sc0 < bd) { bd = sc0; tgt = v; pre = null; } }
            else if (v.own !== s && v.orig === s && !atk && d < 15) { const E3 = powNear(1 - s, v.x, v.y, 3, true); if (fp > E3 * 1.3) { const sc0 = d - 18 - v.pts * .5; if (sc0 < bd) { bd = sc0; tgt = v; pre = null; } } } }
          for (const v of S.vp) { const d = Math.hypot(v.x - F.cx, v.y - F.cy);
            if (v.own !== s) { if (F.spent || F.hold || F.stay || S.phaseBlock(F, v.x, v.y)) continue; const ok = atk ? (S.strength(F) > .55 && d < (sc.sides[s].aiRng || plan[s].rng)) : (F.res && v.orig === s && d < 22); if (ok && mine.filter(G => G !== F && G.tgtVP === v && G.order && G.order.st !== 'done').length < (sc.sides[s].aiPerVP || 2) && d - v.pts * .3 < bd) { bd = d - v.pts * .3; tgt = v; } }
            else if (F.res || !O || (S.learn && !F.hold && !F.stay && !F.spent)) { const preOnly = !(F.res || !O); let thr = false, held = false; for (const u of S.subs) if (u.active && !u.dead) { const dd = Math.hypot(u.x - v.x, u.y - v.y); if (u.s !== s && known(u) && dd < 4) thr = true; if (u.s === s && u.f !== F && LEADCLS[u.cls] && dd < 2) held = true; } if (!preOnly && thr && !held && d < 25 && d - 20 < bd && d > 1.5) { bd = d - 20; tgt = v; pre = null; } else if (S.learn && !thr && !held && d < 25 && d > 1.5 && v.heat && v.heat[s] >= 1.2 && d - 6 - v.heat[s] * 4 < bd) { bd = d - 6 - v.heat[s] * 4; tgt = v; pre = v; } } }
          // a formation with a supply road goes to the relief of an encircled neighbour within 30 km
          let rel = null; if (sc.sides[s].pocket && !F.isolated && !F.hold && !F.stay && !F.spent && S.strength(F) > .55) for (const G of mine) if (G !== F && G.isolated && S.t - G.isoT >= 120 && mine.filter(H => H.relG === G && H.order && H.order.st !== 'done').length < 2) { const d = Math.hypot(G.cx - F.cx, G.cy - F.cy); if (d > 6 && d < 30 && d - 25 < bd) { bd = d - 25; rel = G; tgt = null; } }
          if (rel) { if (autoOrder(F, rel.cx, rel.cy, false)) { F.tgtVP = null; F.relG = rel; say(F, 'Attacking to open a way to ' + rel.n + ', encircled ' + nearTown(rel.cx, rel.cy) + '.', 1); } }
          else if (tgt && Math.hypot(tgt.x - F.cx, tgt.y - F.cy) > 1.5 && !S.haltBlock(F, tgt.x, tgt.y)) { if (autoOrder(F, tgt.x, tgt.y, false)) { F.relG = null; F.tgtVP = tgt; if (pre === tgt) { S.staff[s].pre++; say(F, 'Moving to cover ' + tgt.n + '. The staff expects the enemy there next.', 0); } } }
        }
      }
      // attachments (on the player's side only to formations run by the staff, and only engineers they ask for)
      const avail = S.pool[s].filter(it => S.t >= it.t * 60 && !it.F && (side || S.staffOpt[s].pool || (KIND[it.k].cls === 'eng' && run.some(F => F.needEng))));
      if (avail.length && run.length) {
        const it = avail[0]; let best = null, bs = -1e9;
        for (const F of run) { if (!leads(F).length) continue; let v = (F.halt ? 5 : 0) + (F.order && F.order.st === 'active' ? 2 : 0) - Math.hypot(F.cx - it.x, F.cy - it.y) * (it.k.startsWith('nav') ? .02 : .12) - F.subs.filter(u => u.pool).length * 1.5; if (KIND[it.k].cls === 'eng' && F.needEng) v += 20; for (const u of F.subs) if (S.t - u.hitT < 20) { v += 2; break; } if (v > bs) { bs = v; best = F; } }
        if (best) S.attach(best, it);
      }
      if (!side) continue;   // air tasking stays with the player
      // air tasking
      const A = S.air[s]; if (S.t >= (A.planT || 0)) {
        A.planT = S.t + 180; A.int.length = 0; A.strat.length = 0; const foes = S.forms.filter(F => F.s !== s && F.active && !F.dead);
        for (let i = 0; i < 3 && foes.length; i++) { const F = foes[Math.floor(rnd() * foes.length)]; const r = sc.sides[F.s].rear; const hq = F.hq && !F.hq.dead ? F.hq : { x: F.cx, y: F.cy }; A.int.push({ x: clamp(hq.x + r[0] * 5, 1, map.w - 1), y: clamp(hq.y + r[1] * 5, 1, map.h - 1) }); }
        const srcs = S.src[1 - s].filter(q => !q.captured && S.t >= q.t * 60); if (srcs.length) { const q = srcs[Math.floor(rnd() * srcs.length)]; A.strat.push({ type: 'source', ref: q, x: q.x, y: q.y, n: q.n }); }
        const ships = S.subs.filter(u => u.s !== s && u.active && !u.dead && u.mv === 'ship'); if (ships.length && rnd() < .7) { const u = ships[Math.floor(rnd() * ships.length)]; A.strat.push({ type: 'ship', ref: u, x: u.x, y: u.y, n: u.n }); }
        if (S.air[1 - s].bases.length && rnd() < .4) { const i = Math.floor(rnd() * S.air[1 - s].bases.length), b = S.air[1 - s].bases[i]; A.strat.push({ type: 'base', ref: i, x: b.x, y: b.y, n: b.n }); }
      }
    }
  }

  // ---------- breaching minefields ----------
  // engineers clear a lane through a minefield along the line the player chooses. Rate: about 200 m an hour for a battalion working in parallel parties
  // (detector-equipped sappers at Alamein crossed minefields at about 200 m an hour); work stops under direct fire, and by day an enemy within 1.5 km stops it.
  S.lanes = [];
  const MINE = c => sc.mines && map.t[c] === T.MARSH && !map.road[c];
  S.breachLine = function (F, x, y) {
    if (!sc.mines) return null; const cs = map.cs, W = map.W; let mc = -1, bd = 2;
    const ci = Math.floor(x / cs), cj = Math.floor(y / cs), rr = Math.ceil(2 / cs);
    for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= W || j >= map.H) continue; const c = j * W + i; if (!MINE(c) || map.lane[c]) continue; const d = Math.hypot((i + .5) * cs - x, (j + .5) * cs - y); if (d < bd) { bd = d; mc = c; } }
    if (mc < 0) return null; centroid(F);
    const mx = (mc % W + .5) * cs, my = (((mc / W) | 0) + .5) * cs; let dx = mx - F.cx, dy = my - F.cy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const walk = sg => { const cells = []; let px = mx, py = my, k = 0; while (k++ < 80) { const c = map.idx(px, py); if (!MINE(c)) return { cells, x: px, y: py }; if (!cells.includes(c)) cells.push(c); px += dx * sg * cs * .25; py += dy * sg * cs * .25; if (px < 0 || py < 0 || px > map.w || py > map.h) return null; } return null; };
    const a = walk(-1), b = walk(1); if (!a || !b) return null;
    const raw = a.cells.reverse().concat(b.cells.filter(c => !a.cells.includes(c))), cells = [];
    for (const c of raw) { const q = cells[cells.length - 1]; if (q != null && q % W !== c % W && ((q / W) | 0) !== ((c / W) | 0)) { const o1 = ((q / W) | 0) * W + c % W, o2 = ((c / W) | 0) * W + q % W; cells.push(MINE(o1) ? o1 : o2); } if (!cells.includes(c)) cells.push(c); }
    if (cells.length > 10) return null;
    const pts = cells.map(c => [(c % W + .5) * cs, (((c / W) | 0) + .5) * cs]); let len = 0; const cum = [0]; for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(len); } len += cs;
    return { cells, pts, cum, len, entry: [a.x, a.y], exit: [b.x, b.y], dir: [dx, dy] };
  };
  S.breach = function (F, x, y) {
    if (!sc.mines) return 'nomines'; if (S.lanes.some(Z => Z.F === F && !Z.done)) return 'busy';
    const E = F.subs.filter(u => u.active && !u.dead && u.cls === 'eng'); if (!E.length) return 'noeng';
    const L = S.breachLine(F, x, y); if (!L) return 'nofield';
    const Z = Object.assign({ id: S.lanes.length, s: F.s, F, prog: 0, done: false, msgT: 0, t0: S.t }, L);
    Z.go = S.t + (S.planning ? 0 : (25 + 70 * (1 - F.cmd.sk)) * (DOCT[F.nat] || DOCT.US).delay);
    let k = 0; for (const u of E) { const q = map.snap(u.mvi, L.entry[0] - L.dir[0] * .3 + (k++) * .25 * -L.dir[1], L.entry[1] - L.dir[1] * .3 + (k - 1) * .25 * L.dir[0], 4) || L.entry; u.det = { x: q[0], y: q[1] }; u.goal = null; u.slot = null; u.path = null; u.needPath = true; u.noPath = false; }
    S.lanes.push(Z); say(F, 'Engineers ordered to breach the minefield: a lane about ' + (L.len).toFixed(1) + ' km deep, roughly ' + Math.round(L.len * 1000 / 200) + ' hours of work.', 1, L.pts[0][0], L.pts[0][1]); return Z;
  };
  function laneTick() {
    for (const Z of S.lanes) { if (Z.done) continue; const F = Z.F, s = Z.s;
      if (S.t < Z.go) continue;
      const cleared = Z.cum.filter(c => c + map.cs <= Z.prog).length, head = Z.pts[Math.min(Z.pts.length - 1, cleared)];
      let eng = null; for (const u of S.subs) if (u.s === s && u.active && !u.dead && u.cls === 'eng' && Math.hypot(u.x - head[0], u.y - head[1]) < 1.6 + map.cs) { eng = u; break; }
      if (!eng) { if (!F.subs.some(u => u.cls === 'eng' && u.active && !u.dead)) { Z.done = true; for (const u of F.subs) u.breach = false; say(F, 'The breach is abandoned: no engineers left.', 2); } continue; }
      // our engineers follow the lane head forward; sappers prodding their own lane are not counted as blundering into the field
      for (const u of F.subs) if (u.cls === 'eng' && u.det && u.active && !u.dead) { u.breach = true; const q = map.snap(u.mvi, head[0] - Z.dir[0] * .4, head[1] - Z.dir[1] * .4, 3); if (q && Math.hypot(q[0] - u.det.x, q[1] - u.det.y) > .5) { u.det = { x: q[0], y: q[1] }; u.needPath = true; u.goal = null; } }
      let fire = false, shell = false; const rFire = S.night ? .8 : 1.5;
      for (const e of S.subs) { if (e.s === s || !e.active || e.dead || e.coh < .3 || e.cls === 'hq' || e.mv === 'ship') continue; const d = Math.hypot(e.x - head[0], e.y - head[1]); if (e.cls === 'art') { if (e.ammo > .1 && d <= e.k.ir) shell = true; } else if (d < rFire) fire = true; }
      if (shell) { shell = false; for (const e of S.subs) if (e.s !== s && e.active && !e.dead && e.cls !== 'hq' && e.cls !== 'art' && e.mv !== 'ship' && Math.hypot(e.x - head[0], e.y - head[1]) < 2.5) { shell = true; break; } }
      if (fire) { if (S.t > Z.msgT) { Z.msgT = S.t + 120; say(eng.f, 'Breaching has stopped: the lane head is under enemy fire' + (S.night ? '.' : '. Work may go on after dark.'), 1, head[0], head[1]); } continue; }
      if (!Z.prog && S.t > Z.msgT) { Z.msgT = S.t + 60; say(eng.f, 'Engineers are clearing a lane through the minefield.', 1, head[0], head[1]); }
      Z.prog += .2 * (5 / 60) * (.4 + .6 * eng.str) * (shell ? .5 : 1);
      let ch = false; for (let k = 0; k < Z.cells.length; k++) if (Z.cum[k] + map.cs <= Z.prog && !map.lane[Z.cells[k]]) { map.lane[Z.cells[k]] = 1; ch = true; }
      if (Z.prog >= Z.len) { for (const c of Z.cells) map.lane[c] = 1; ch = true; Z.done = true; for (const u of F.subs) u.breach = false; say(eng.f, 'Lane open through the minefield. The engineers stay at the lane until told to rejoin.', 2, Z.exit[0], Z.exit[1]); }
      if (ch) { map.calcFac(); map.ver = (map.ver || 0) + 1; for (const u of S.subs) if (u.goal) { u.needPath = true; u.noPath = false; } }
    }
  }

  // ---------- river crossings: assault boats, the lodgement, floating bridges ----------
  // river widths in metres. Waal at the 504th's crossing site, about 300 m; Wilhelmina Canal at Son 30 m; Zuid-Willemsvaart at Veghel 20 m;
  // Neder Rijn at Arnhem about 120 m (the road bridge's span over the water). The rest are estimates; Cane River is fictional.
  const RIVW = { Waal: 300, 'Neder Rijn': 120, 'Wilhelmina Canal': 30, 'Zuid-Willemsvaart': 20, Maas: 250, 'Maas-Waal Canal': 60, 'Maas-Schelde Canal': 40, 'Cane River': 90, Sele: 60, Sure: 30, Ourthe: 30, Orne: 40, Sarthe: 40, Mayenne: 40, Simeto: 50, Salso: 40, Anapo: 20 };
  const BOATMEN = 13, BNMEN = 800, SETFT = 1000;   // one squad to a boat, men to a battalion, feet of bridge one set spans
  const XCLS = { inf: 1, cdo: 1, rec: 1 };
  // who can cross in assault boats: foot troops, and armored or motorized infantry, who leave their vehicles on the near bank and fight on foot until a bridge is in
  const boatLift = u => (XCLS[u.cls] && u.mv === 'foot') || u.cls === 'inf' || u.cls === 'mech';
  function riverAt(x, y) { let best = null, bd = 1e9, dir = [1, 0]; for (const r of map.riverLines) if (r.cls === 1) for (let i = 1; i < r.pts.length; i++) { const p = r.pts[i], d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = r.name; dir = [p[0] - r.pts[i - 1][0], p[1] - r.pts[i - 1][1]]; } } const l = Math.hypot(dir[0], dir[1]) || 1; return { n: best, tx: dir[0] / l, ty: dir[1] / l }; }
  // the crossing line: the river cells between the near bank (the formation's side) and the far bank, four-connected so a bridge can carry traffic
  function crossLine(F, x, y) {
    const cs = map.cs, W = map.W; let rc = -1, bd = 1.6;
    const ci = Math.floor(x / cs), cj = Math.floor(y / cs), rr = Math.ceil(1.6 / cs);
    for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= W || j >= map.H) continue; const c = j * W + i; if (map.t[c] !== T.RIVER || map.riv[c] !== 1) continue; const d = Math.hypot((i + .5) * cs - x, (j + .5) * cs - y); if (d < bd) { bd = d; rc = c; } }
    if (rc < 0) return null;
    const rx = (rc % W + .5) * cs, ry = (((rc / W) | 0) + .5) * cs, R = riverAt(rx, ry); let nx = -R.ty, ny = R.tx; if ((rx - F.cx) * nx + (ry - F.cy) * ny < 0) { nx = -nx; ny = -ny; }
    const walk = sg => { const cells = []; let px = rx, py = ry, k = 0; while (k++ < 60) { const c = map.idx(px, py); if (map.t[c] !== T.RIVER) return { cells, x: px, y: py, c }; if (!cells.includes(c)) cells.push(c); px += nx * sg * cs * .25; py += ny * sg * cs * .25; } return null; };
    const a = walk(-1), b = walk(1); if (!a || !b) return null;
    if (map.t[a.c] === T.SEA || map.t[b.c] === T.SEA || map.fac[0][a.c] <= 0 || map.fac[0][b.c] <= 0) return null;
    const raw = a.cells.reverse().concat(b.cells.filter(c => !a.cells.includes(c))), cells = [];
    for (const c of raw) { const l = cells[cells.length - 1]; if (l != null && l % W !== c % W && ((l / W) | 0) !== ((c / W) | 0)) { const o1 = ((l / W) | 0) * W + c % W, o2 = ((c / W) | 0) * W + l % W; cells.push(map.t[o1] === T.RIVER ? o1 : o2); } if (!cells.includes(c)) cells.push(c); }
    if (cells.length > 8) return null;
    const off = (px, py, d) => map.snap(0, px + nx * d, py + ny * d, 4) || [px + nx * d, py + ny * d];
    return { n: R.n || 'river', w: RIVW[R.n] || 50, cells, nx, ny, near: [a.x, a.y], far: [b.x, b.y], asm: off(a.x, a.y, -.5), land: off(b.x, b.y, .5), mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
  }
  // fire on the boats: enemy troops covering the far bank and guns with an observer, against our fire from the near bank and from men already across
  function boatFire(s, L, known_only, landed) {
    let fe = 0, sp = 0, obs = false; const fx = L.land[0], fy = L.land[1], mx = L.mid[0], my = L.mid[1];
    for (const e of S.subs) if (e.s !== s && e.active && !e.dead && e.cls !== 'hq' && e.cls !== 'art' && e.mv !== 'ship' && Math.hypot(e.x - mx, e.y - my) < 2 && (!known_only || known(e))) { obs = true; break; }
    for (const e of S.subs) { if (e.s === s || !e.active || e.dead || e.coh < .3 || e.cls === 'hq' || e.mv === 'ship' || (known_only && !known(e))) continue; const d = Math.hypot(e.x - fx, e.y - fy);
      if (e.cls === 'art') { if (obs && e.ammo > .1 && Math.hypot(e.x - mx, e.y - my) <= e.k.ir) fe += .15 * pow(e); } else if (d < 1.6) fe += pow(e) * (d < .8 ? 1 : .6); }
    for (const u of S.subs) { if (u.s !== s || !u.active || u.dead || u.coh < .3 || u.cls === 'hq' || u.mv === 'ship' || u.xs != null) continue; const dn = Math.hypot(u.x - L.near[0], u.y - L.near[1]), df = Math.hypot(u.x - fx, u.y - fy);
      if (u.cls === 'art') { if (df <= u.k.ir) sp += .3 * pow(u); } else if (dn < 1.6 || (landed && df < 1.6)) sp += .5 * pow(u); }
    const v = (S.night ? .35 : 1) * WXVIS[S.wx], eff = fe * v / (1 + .6 * sp);
    return { fe, sp, loss: Math.min(.85, 1 - Math.exp(-.45 * eff)) };
  }
  function freeAsset(s, k, x, y) { let best = null, bd = 1e9; for (const a of S.assets[s]) if (a.k === k && a.n > 0 && a.st === 'park' && !a.site && S.t >= a.t * 60) { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } } return best; }
  function haul(a, X, tx, ty) {
    if (Math.hypot(a.x - tx, a.y - ty) < 1) { a.st = 'site'; a.site = X; return true; }
    const p = map.findPath(1, a.x, a.y, tx, ty, { block: S.zoc[a.s], grad: 4, road: ROADBIAS }); if (!p) return false;
    const c = { id: S.nid++, s: a.s, F: X.F, src: null, path: p, pi: 1, x: p[0][0], y: p[0][1], hx: 1, hy: 0, load: 10, load0: 10, st: 'out', dead: false, trail: [], haul: a };
    S.convoys.push(c); a.st = 'road'; a.haul = c; a.site = X; return true;
  }
  S.crossLine = (F, x, y) => crossLine(F, x, y);
  // what the staff expects of a crossing at this point, from what our troops can see
  S.crossEst = function (F, x, y) {
    const L = crossLine(F, x, y); if (!L) return null; const a = freeAsset(F.s, 'boats', L.near[0], L.near[1]); const lift = F.subs.filter(u => u.active && !u.dead && !u.det && boatLift(u));
    const need = lift.reduce((t, u) => t + u.size, 0), cap = a ? a.n * BOATMEN / BNMEN : 0, f = boatFire(F.s, L, true, false);
    return { L, a, lift: lift.length, cap, trips: cap ? Math.ceil(need / cap - 1e-6) : 0, loss: f.loss, sets: Math.ceil(L.w * 3.28 / SETFT) };
  };
  S.cross = function (F, x, y) {
    if (S.xings.some(X => X.F === F && !X.done)) return 'busy';
    const L = crossLine(F, x, y); if (!L) return 'nowater';
    const lift = F.subs.filter(u => u.active && !u.dead && !u.det && boatLift(u)); if (!lift.length) return 'nofoot';
    const a = freeAsset(F.s, 'boats', L.near[0], L.near[1]); if (!a) return 'noboats';
    const X = Object.assign({ id: S.xings.length, s: F.s, F, boats: a, q: lift.slice(), landed: [], trip: null, bh: false, clearT: null, fail: false, sets: [], bridge: null, prog: 0, t0: S.t, rehaulT: 0, msgT: 0, done: false }, L);
    X.go = S.t + (S.planning ? 0 : (25 + 70 * (1 - F.cmd.sk)) * (DOCT[F.nat] || DOCT.US).delay);
    let open = haul(a, X, L.near[0], L.near[1]); if (!open) { a.site = X; X.rehaulT = S.t + 60; }   // no road yet: the staff keeps trying every hour
    const nSet = Math.ceil(L.w * 3.28 / SETFT); for (let i = 0; i < nSet; i++) { const b = freeAsset(F.s, 'bridge', L.near[0], L.near[1]); if (!b) break; if (!haul(b, X, L.near[0], L.near[1])) b.site = X; X.sets.push(b); }
    let k = 0; for (const u of lift) { const ang = k++ * 2.1, r = .25; u.det = { x: L.asm[0] + Math.cos(ang) * r, y: L.asm[1] + Math.sin(ang) * r }; u.xs = X.id; u.xc = 0; u.goal = null; u.slot = null; u.path = null; u.needPath = true; u.noPath = false; }
    for (const u of F.subs) if (u.active && !u.dead && !u.det && u.cls === 'eng') { const q = map.snap(u.mvi, L.asm[0] - L.ny * .4, L.asm[1] + L.nx * .4, 4) || L.asm; u.det = { x: q[0], y: q[1] }; u.goal = null; u.slot = null; u.path = null; u.needPath = true; u.noPath = false; }   // the engineers go to the bank to work the boats and the bridge
    S.xings.push(X); say(F, 'Assault crossing of the ' + X.n + ' ordered. The battalions assemble on the near bank' + (open ? ' and ' + a.nm + ' are on the way.' : ', but no road is open yet to bring up ' + a.nm + '.'), open ? 1 : 2, L.mid[0], L.mid[1]); return X;
  };
  S.liftBridge = function (X) { if (!X || !X.bridge || X.bridge.gone || X.liftT) return false; X.liftT = S.t + 120; say(X.F, 'Engineers are taking up the bridge over the ' + X.n + '. It closes in two hours.', 1, X.mid[0], X.mid[1]); return true; };
  function land(X, u) {
    let p = null; for (let k = 0; k < 6 && !p; k++) { const ang = (X.landed.length * 2.1 + k) % 6.3, q = map.snap(0, X.land[0] + Math.cos(ang) * .3, X.land[1] + Math.sin(ang) * .3, 3); if (q && (q[0] - X.mid[0]) * X.nx + (q[1] - X.mid[1]) * X.ny > 0) p = q; }
    if (!p) p = [X.far[0] + X.nx * .2, X.far[1] + X.ny * .2];
    u.x = p[0]; u.y = p[1]; u.det = { x: p[0], y: p[1] }; u.goal = null; u.path = null; u.slot = null; u.state = 'ok'; u.coh = Math.max(.2, u.coh - (S.night ? .25 : .15)); u.hitT = S.t;
    if (!X.landed.includes(u)) X.landed.push(u);
    if (u.mv !== 'foot') { u.mv0 = u.mv; u.mvi0 = u.mvi; u.mv = 'foot'; u.mvi = MVI.foot; }
    if (X.landed.length === 1) say(X.F, 'First wave ashore on the far bank of the ' + X.n + '. It is fighting to hold the landing.', 2, p[0], p[1]);
  }
  // a finished crossing hands back its boats, and any bridge set not laid, for use elsewhere
  function release(X) { const fr = a => { if (a.st === 'lost' || a.site !== X) return; if (a.haul) { a.x = a.haul.x; a.y = a.haul.y; a.haul.dead = true; a.haul = null; } a.st = 'park'; a.site = null; }; fr(X.boats); if (!X.bridge) for (const b of X.sets) fr(b); }
  function xingTick() {
    for (const X of S.xings) {
      if ((X.bridge && X.bridge.intact) || X.done) for (const u of X.landed) if (u.mv0) { u.mv = u.mv0; u.mvi = u.mvi0; u.mv0 = null; u.needPath = true; }   // the vehicles rejoin over the bridge, or by road once the crossing is closed
      if (X.done && !X.bridge) continue; const F = X.F, a = X.boats, s = X.s;
      if (X.liftT && S.t >= X.liftT) { map.removeBridge(X.bridge); S.ev.push({ k: 'bridge', b: X.bridge, blown: false }); for (const b of X.sets) { b.st = 'park'; b.site = null; b.x = X.near[0]; b.y = X.near[1]; } say(F, 'The bridge over the ' + X.n + ' is taken up. The set is ready to be used again.', 1, X.mid[0], X.mid[1]); X.bridge = null; X.liftT = 0; X.done = true; for (const u of S.subs) if (u.goal) u.needPath = true; continue; }
      X.q = X.q.filter(u => u.active && !u.dead); for (const u of S.subs) if (u.xs === X.id && (u.dead || !X.q.includes(u))) u.xs = null;
      if (!X.done) {
        if (F.dead && !X.q.length) { X.done = true; release(X); }
        // twelve hours with no wave landed and no bridging progress: the staff calls the crossing off and the boats and bridge sets go back to the pool
        { const sig = X.landed.length + ':' + X.q.length + ':' + Math.floor((X.prog || 0) * 20); if (sig !== X.sig) { X.sig = sig; X.stallT = S.t; } }
        if (!X.done && S.t - X.stallT >= 720 && !X.bridge) { X.done = true; for (const u of X.q) { u.det = null; u.xs = null; u.goal = null; u.needPath = true; } X.q = []; release(X); say(F, 'The crossing of the ' + X.n + ' has made no progress for twelve hours and is called off. The boats and bridge sets go back to the pool.', 2, X.mid[0], X.mid[1]); continue; }
        if (a.st === 'park' && !a.haul && X.q.length && S.t >= X.rehaulT) { X.rehaulT = S.t + 60; if (!haul(a, X, X.near[0], X.near[1])) { a.site = X; if (S.t > X.msgT) { X.msgT = S.t + 720; say(F, 'No road is open to bring ' + a.nm + ' up to the ' + X.n + '.', 2); } } }
        for (const b of X.sets) if (b.st === 'park' && !b.haul && S.t >= (b.rehaulT || 0)) { b.rehaulT = S.t + 60; haul(b, X, X.near[0], X.near[1]); }
        // boat trips: load at the assembly point, run the gauntlet, land, and come back for the next wave
        if (a.st === 'site' && a.n > 0 && S.t >= X.go && X.q.length) {
          const T1 = (4 + X.w / 25) * (S.night ? 1.3 : 1);
          // a battalion already part-way across goes first
          if (!X.trip) { const ready = X.q.filter(u => u.ashore || (u.det && Math.hypot(u.x - u.det.x, u.y - u.det.y) < .9 && u.state !== 'retreat')).sort((p, q) => (q.ashore ? 1 : 0) - (p.ashore ? 1 : 0)); if (ready.length) { let cap = a.n * BOATMEN / BNMEN; const units = []; for (const u of ready) { const take = Math.min(u.size - u.xc, cap); if (take <= 1e-6) break; u.xt = take; cap -= take; units.push(u); } X.trip = { st: 'out', t: S.t, T: T1, units, n: a.n }; } }
          else if (X.trip.st === 'out' && S.t >= X.trip.t + X.trip.T) {
            const f = boatFire(s, X, false, X.landed.some(u => u.active && !u.dead)); let lost = 0; for (let i = 0; i < a.n; i++) if (rnd() < f.loss) lost++; const fr = a.n ? lost / a.n : 0; a.n -= lost;
            // each wave lands at once and fights; a battalion grows on the far bank as its later waves arrive
            for (const u of X.trip.units) { if (!u.active || u.dead) continue; const p = u.xt / u.size, rf = 1 - u.xc / u.size;
              if (!u.ashore) { const st = u.str; u.xrest = st * (1 - p); land(X, u); u.ashore = true; u.str = st * p * (1 - fr * .6); S.losses[s] += st * p * fr * .6 * u.size; }
              else { const ps = (u.xrest || 0) * Math.min(1, p / Math.max(1e-6, rf)); u.xrest -= ps; u.str = Math.min(1, u.str + ps * (1 - fr * .6)); S.losses[s] += ps * fr * .6 * u.size; }
              u.coh = Math.max(.2, u.coh - fr * .2); u.hitT = S.t; u.xc += u.xt;
              if (u.xc >= u.size - 1e-6) { u.str = Math.min(1, u.str + (u.xrest || 0)); u.xrest = 0; u.xs = null; X.q = X.q.filter(v => v !== u); } }
            if (lost && S.t > X.msgT) { X.msgT = S.t + 30; say(F, 'Boats under fire on the ' + X.n + ': ' + lost + ' of ' + X.trip.n + ' lost on this trip.', fr > .3 ? 2 : 1, X.mid[0], X.mid[1]); }
            if (a.n <= 0 && X.q.length) say(F, 'Every boat at the ' + X.n + ' crossing is lost. ' + X.q.length + (X.q.length === 1 ? ' battalion is' : ' battalions are') + ' still on the near bank.', 2, X.mid[0], X.mid[1]);
            X.trip.st = 'back'; X.trip.t = S.t;
          } else if (X.trip.st === 'back' && S.t >= X.trip.t + X.trip.T) { const f = boatFire(s, X, false, true); let lost = 0; for (let i = 0; i < a.n; i++) if (rnd() < f.loss * .25) lost++; a.n -= lost; X.trip = null; }
        }
        // once a bridge is open, the battalions still waiting walk across it
        if (X.bridge && X.bridge.intact && X.q.length) { for (const u of X.q) { if (u.ashore) { u.str = Math.min(1, u.str + (u.xrest || 0)); u.xrest = 0; u.xs = null; u.xc = 0; continue; } u.det = { x: X.land[0] + (rnd() - .5) * .6, y: X.land[1] + (rnd() - .5) * .6 }; u.goal = null; u.path = null; u.needPath = true; u.noPath = false; u.xs = null; u.xc = 0; X.landed.push(u); } X.q = []; }
        if (!X.q.length) { X.trip = null; if (!X.allT && X.landed.some(u => u.active && !u.dead)) { X.allT = S.t; say(F, 'All battalions are across the ' + X.n + '. They hold the bridgehead until told to rejoin' + (X.bridge ? ', and the rest of the formation can follow over the bridge.' : '.'), 1, X.land[0], X.land[1]); } }
        const alive = X.landed.filter(u => u.active && !u.dead && u.str > .2);
        if (X.landed.length && !alive.length && !X.fail) { X.fail = true; X.bh = false; say(F, 'The landing across the ' + X.n + ' has been wiped out.', 2, X.land[0], X.land[1]); if (!X.q.length || a.n <= 0) { X.done = true; release(X); } }
        if (alive.length) { X.fail = false; let en = false; for (const e of S.subs) if (e.s !== s && e.active && !e.dead && e.cls !== 'hq' && e.coh > .45 && e.mv !== 'ship' && Math.hypot(e.x - X.land[0], e.y - X.land[1]) < 1.5) { en = true; break; }
          if (!en) { if (X.clearT == null) X.clearT = S.t; if (!X.bh && S.t - X.clearT >= 30) { X.bh = true; say(F, 'Bridgehead secured across the ' + X.n + '.', 2, X.land[0], X.land[1]); } } else X.clearT = null; }
        // the bridge: every set on site, an engineer battalion at the near bank, and the far bank in our hands or clear of the enemy
        if (!X.bridge && X.sets.length && X.sets.every(b => b.st === 'site') && X.sets.length * SETFT >= X.w * 3.28) {
          let eng = null; for (const u of S.subs) if (u.s === s && u.active && !u.dead && u.cls === 'eng' && Math.hypot(u.x - X.near[0], u.y - X.near[1]) < 1.5) { eng = u; break; }
          let farClear = X.bh; if (!farClear) { farClear = true; for (const e of S.subs) if (e.s !== s && e.active && !e.dead && e.cls !== 'hq' && e.coh > .3 && e.mv !== 'ship' && Math.hypot(e.x - X.land[0], e.y - X.land[1]) < 1.5) { farClear = false; break; } }
          if (eng && farClear) {
            let fire = false, shell = false; for (const e of S.subs) { if (e.s === s || !e.active || e.dead || e.coh < .3 || e.cls === 'hq' || e.mv === 'ship') continue; if (e.cls === 'art') { if (e.ammo > .1 && Math.hypot(e.x - X.mid[0], e.y - X.mid[1]) <= e.k.ir) shell = true; } else if (Math.min(Math.hypot(e.x - X.near[0], e.y - X.near[1]), Math.hypot(e.x - X.land[0], e.y - X.land[1])) < 1.6) fire = true; }
            if (shell) { shell = false; for (const e of S.subs) if (e.s !== s && e.active && !e.dead && e.cls !== 'hq' && e.cls !== 'art' && e.mv !== 'ship' && Math.hypot(e.x - X.mid[0], e.y - X.mid[1]) < 3) { shell = true; break; } }
            const Tb = 1.25 * (1 + X.w * 3.28 / 216) * (S.night ? 1.5 : 1);   // TM 5-272 rates (216 ft in 2 h, 864 ft in 5 h by day), slowed for field conditions
            if (!fire) { if (!X.prog && S.t > X.msgT) { X.msgT = S.t + 60; say(eng.f, 'Engineers have started bridging the ' + X.n + '. About ' + Math.round(Tb) + ' hours to finish.', 1, X.mid[0], X.mid[1]); } X.prog += 5 / (Tb * 60) * (.4 + .6 * eng.str) * (shell ? .5 : 1); }
            else if (S.t > X.msgT) { X.msgT = S.t + 120; say(eng.f, 'Bridging on the ' + X.n + ' has stopped: the site is under enemy fire.', 1, X.mid[0], X.mid[1]); }
            if (X.prog >= 1) { X.bridge = map.addBridge(X.cells, X.mid[0], X.mid[1], X.n + ' ' + (X.sets[0].nm.includes('Bailey') ? 'Bailey bridge' : 'floating bridge'), s, [X.nx, X.ny]); S.ev.push({ k: 'bridge', b: X.bridge, blown: false }); say(eng.f, 'The bridge over the ' + X.n + ' is open to traffic.', 2, X.mid[0], X.mid[1]); for (const u of S.subs) { u.noPath = false; u.detour = 0; if (u.goal) u.needPath = true; } }
          }
        }
        if (!X.q.length && (X.bridge || !X.sets.length || X.fail)) X.done = true;
        if (X.done) release(X);
      }
      // enemy guns with an observer can break a floating bridge; engineers mend it in two hours
      const b = X.bridge; if (b && b.intact && !b.gone) { let obs = false; for (const e of S.subs) if (e.s !== s && e.active && !e.dead && e.cls !== 'hq' && e.cls !== 'art' && e.mv !== 'ship' && Math.hypot(e.x - b.x, e.y - b.y) < 2) { obs = true; break; }
        if (obs) for (const e of S.subs) if (e.s !== s && e.active && !e.dead && e.cls === 'art' && e.ammo > .1 && Math.hypot(e.x - b.x, e.y - b.y) <= e.k.ir && rnd() < .03 / 12) { map.setBridge(b, false); S.ev.push({ k: 'bridge', b, blown: true }); say(s, 'Shellfire has broken the ' + b.name + '. Engineers are repairing it.', 2, b.x, b.y); say(1 - s, 'Our guns have broken the enemy bridge over the ' + X.n + '.', 1, b.x, b.y); for (const u of S.subs) if (u.goal) u.needPath = true; break; } }
    }
  }

  // ---------- main step ----------
  let tC = 0, tSup = 3, tAir = 2, tAi = 0, tBr = 1, tVp = 4, acc = 0;
  // time spent in each part of the step, in milliseconds (S.TT), for tuning; performance.now is cheap at this rate
  const TT = S.TT = {}, _T = (k, t) => { TT[k] = (TT[k] || 0) + performance.now() - t; };
  function step(dt) {
    S.t += dt; S.lastDt = dt; { const _h = performance.now(); if (S.cmdHook) S.cmdHook(); _T('hooks', _h); } const h = S.hourOf(S.t); S.night = h < S.dayA || h > S.dayB;
    const wi = Math.min(weather.length - 1, Math.floor(S.t / 720)); if (weather[wi] !== S.wx) { S.wx = weather[wi]; say(-1, 'Weather: ' + WXNAME[S.wx] + (S.wx === 'clear' || S.wx === 'cloud' ? '. Aircraft can fly.' : '. Air operations suspended.'), 1); }
    let _t = performance.now(); moveSubs(dt); moveConvoys(dt); moveFlights(dt); _T('move', _t);
    const war = !sc.hHour || S.t >= sc.hHour * 60;   // before H-hour (sc.hHour, hours) neither side fires or flies missions
    _t = performance.now(); if (S.t >= tC) { tC += 1; if (war) combatTick(); arrivals(); } _T('combat', _t);
    _t = performance.now(); for (const F of S.forms) if (S.t >= F.nextT) { F.nextT += 5; cmdTick(F); } _T('cmdTick', _t);
    _t = performance.now(); if (S.t >= tSup) { tSup += sc.supplyMin || 10; supplyTick(); } _T('supply', _t);
    _t = performance.now(); if (S.t >= tAir) { tAir += 5; if (war) airTick(); } _T('air', _t);
    _t = performance.now(); if (S.t >= tBr) { tBr += 5; bridgeTick(); xingTick(); laneTick(); } _T('bridge', _t);
    if (Math.floor(S.t / 60) !== Math.floor((S.t - dt) / 60)) S.lossH.push([Math.round(S.t / 60), S.losses[0], S.losses[1]]);   // hourly record for the end-screen timeline
    _t = performance.now(); if (S.t >= tVp) { tVp += 10; vpTick(); ownTick(Math.floor(S.t / 60) !== Math.floor((S.t - 10) / 60)); } _T('own', _t);
    _t = performance.now(); if (S.t >= tAi) { tAi += 30; aiTick(); } _T('ai', _t);
    if (S.t >= sc.hours * 60 && !S.over) { S.over = true; say(-1, 'Scenario time has expired.', 2); }
  }
  S.advance = function (gameMin, fixed) { if (S.over) return; S.planning = false; acc += gameMin; const dt = fixed || (gameMin > 2 ? 1 : gameMin > .6 ? .5 : .25); let n = 0; while (acc >= dt && n++ < 600 && !S.over) { S.pb = 40; step(dt); acc -= dt; } if (n >= 600) acc = 0; };
  S.stepOnce = function (dt) { if (S.over) return; S.planning = false; S.pb = 40; step(dt); };
  // ---------- ground ownership: every half-kilometre cell of the map belongs to one side ----------
  // Start: each cell goes to the side of the nearest unit on the map, held objective or depot.
  // Occupation (every 10 min): a unit in fighting order claims the ground within 1.5 km (artillery 0.8 km) unless enemy troops in fighting order stand within 1.2 km of it.
  // Objectives: whoever takes an objective takes the ground within 1 km of it.
  // Consolidation (every hour): ground no one stands on goes to the side holding most of the ground around it, so bypassed pockets and salients fill in.
  const OW = (() => { const cw = sc.ownCell || .5, gw = Math.ceil(map.w / cw), gh = Math.ceil(map.h / cw); return { cw, gw, gh, a: new Uint8Array(gw * gh), pres: [new Uint8Array(gw * gh), new Uint8Array(gw * gh)] }; })();
  // map cell -> ownership cell, built once: lets map-wide loops read the owner of every map cell without a function call per cell
  let M2O = null; const m2o = () => M2O || (M2O = (() => { const z = new Int32Array(map.N); for (let c = 0; c < map.N; c++) { const x = (c % map.W + .5) * map.cs, y = (((c / map.W) | 0) + .5) * map.cs; z[c] = clamp(Math.floor(y / OW.cw), 0, OW.gh - 1) * OW.gw + clamp(Math.floor(x / OW.cw), 0, OW.gw - 1); } return z; })());
  S.own = OW; S.ownAt = (x, y) => OW.a[clamp(Math.floor(y / OW.cw), 0, OW.gh - 1) * OW.gw + clamp(Math.floor(x / OW.cw), 0, OW.gw - 1)];
  function disc(x, y, r, fn) { const c = OW.cw, i0 = Math.max(0, Math.floor((x - r) / c)), i1 = Math.min(OW.gw - 1, Math.floor((x + r) / c)), j0 = Math.max(0, Math.floor((y - r) / c)), j1 = Math.min(OW.gh - 1, Math.floor((y + r) / c)); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (Math.hypot((i + .5) * c - x, (j + .5) * c - y) <= r) fn(j * OW.gw + i); }
  const formed = u => u.active && !u.dead && u.coh > .3 && u.cls !== 'hq' && u.mv !== 'ship' && u.state !== 'retreat' && !(u.f.arr && !u.f.active);
  function initOwn() {
    const pts = []; for (const u of S.subs) if (u.active && !u.dead && u.mv !== 'ship') pts.push([u.x, u.y, u.s]); for (const v of S.vp) if (v.own === 0 || v.own === 1) pts.push([v.x, v.y, v.own]); for (let s = 0; s < 2; s++) for (const q of S.src[s]) if (!q.air) pts.push([q.x, q.y, s]);
    const fr = sc.front; if (fr) { for (let j = 0; j < OW.gh; j++) for (let i = 0; i < OW.gw; i++) { const x = (i + .5) * OW.cw, y = (j + .5) * OW.cw; OW.a[j * OW.gw + i] = fr.all != null ? fr.all : (fr.polys.some(p => inPoly(x, y, p)) ? fr.side : 1 - fr.side); } return; }
    for (let j = 0; j < OW.gh; j++) for (let i = 0; i < OW.gw; i++) { const x = (i + .5) * OW.cw, y = (j + .5) * OW.cw; let bd = 1e9, bs = 0; for (const p of pts) { const d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y); if (d < bd) { bd = d; bs = p[2]; } } OW.a[j * OW.gw + i] = bs; }
  }
  function ownTick(hourly) {
    // each cell within reach of troops in fighting order goes to the side whose troops are nearest (artillery reaches 0.8 km, other units 1.5 km)
    // only cells within reach of a unit can change, so the work runs over those cells alone: the cells touched last time are reset,
    // this time's are listed as they are reached (same results as clearing and scanning the whole grid)
    const NC = OW.a.length, P = OW.pres, D = OW.dist || (OW.dist = [new Float32Array(NC).fill(99), new Float32Array(NC).fill(99)]), TL = OW.tl || (OW.tl = new Int32Array(NC)), MK = OW.mk || (OW.mk = new Uint8Array(NC));
    for (let k = 0; k < (OW.nt || 0); k++) { const c = TL[k]; D[0][c] = 99; D[1][c] = 99; P[0][c] = 0; P[1][c] = 0; MK[c] = 0; }
    let nt = 0; const R0 = sc.ownR || 1.5, cw = OW.cw, gw = OW.gw, gh = OW.gh;   // R0: reach of a unit's hold on the ground (km); division-scale scenarios set more (game setting)
    for (const u of S.subs) if (formed(u)) { const r = u.cls === 'art' ? R0 * .55 : R0, dd = D[u.s], pp = P[u.s], lead = LEADCLS[u.cls] || u.cls === 'at' || u.cls === 'eng', x = u.x, y = u.y;
      const i0 = Math.max(0, Math.floor((x - R0) / cw)), i1 = Math.min(gw - 1, Math.floor((x + R0) / cw)), j0 = Math.max(0, Math.floor((y - R0) / cw)), j1 = Math.min(gh - 1, Math.floor((y + R0) / cw));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const hd = Math.hypot((i + .5) * cw - x, (j + .5) * cw - y); if (hd > R0) continue;
        const c = j * gw + i, d = hd + R0 - r; if (!MK[c]) { MK[c] = 1; TL[nt++] = c; } if (d < dd[c]) dd[c] = d; if (lead && d < 1.2) pp[c] = 1; } }
    OW.nt = nt; const SEA0 = OW.sea;
    for (let k = 0; k < nt; k++) { const c = TL[k], a = D[0][c], b = D[1][c]; if (Math.min(a, b) <= R0 && a !== b && !(SEA0 && SEA0[c])) OW.a[c] = a < b ? 0 : 1; }
    if (!hourly) return; const g = OW.gw, h = OW.gh;
    if (sc.ownMax) frontTick(g, h);
    const b = OW.a.slice();
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < g - 1; i++) { const c = j * g + i; if (P[0][c] || P[1][c]) continue; let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && b[c + dj * g + di] !== b[c]) n++; if (n >= 6) OW.a[c] = 1 - b[c]; }
    // empty pockets close in: a connected region of one side's ground that holds none of its troops and none of its supply sources
    // gives up its outer ring of cells to the other side each hour, until the surrounding side owns all of it
    const N = g * h, lab = OW.lab || (OW.lab = new Int32Array(N)), q = OW.q || (OW.q = new Int32Array(N)); lab.fill(0); const keep = [false], has = new Uint8Array(N);
    const cellOf = (x, y) => clamp(Math.floor(y / OW.cw), 0, h - 1) * g + clamp(Math.floor(x / OW.cw), 0, g - 1);
    for (const u of S.subs) if (u.active && !u.dead) { const c = cellOf(u.x, u.y); if (OW.a[c] === u.s) has[c] = 1; }
    for (let sd = 0; sd < 2; sd++) for (const so of S.src[sd]) if (!so.captured) { const c = cellOf(so.x, so.y); if (OW.a[c] === sd) has[c] = 1; }
    // sea cells belong to no pocket: they would otherwise join every coastal pocket to the rest of that side's ground
    const SEA = OW.sea || (OW.sea = (() => { const z = new Uint8Array(N); for (let c = 0; c < N; c++) { const x = (c % g + .5) * OW.cw, y = (((c / g) | 0) + .5) * OW.cw; z[c] = map.t[Math.min(map.H - 1, Math.floor(y / map.cs)) * map.W + Math.min(map.W - 1, Math.floor(x / map.cs))] === T.SEA ? 1 : 0; } return z; })());
    const same = (c, sd) => OW.a[c] === sd && !SEA[c];
    let nl = 0; for (let c0 = 0; c0 < N; c0++) { if (lab[c0]) continue; const sd = OW.a[c0]; let qh = 0, qt = 0, k = !!SEA[c0]; lab[c0] = ++nl; q[qt++] = c0;
      if (!SEA[c0]) while (qh < qt) { const c = q[qh++], i = c % g; if (has[c]) k = true; if (i > 0 && !lab[c - 1] && same(c - 1, sd)) { lab[c - 1] = nl; q[qt++] = c - 1; } if (i < g - 1 && !lab[c + 1] && same(c + 1, sd)) { lab[c + 1] = nl; q[qt++] = c + 1; } if (c >= g && !lab[c - g] && same(c - g, sd)) { lab[c - g] = nl; q[qt++] = c - g; } if (c < N - g && !lab[c + g] && same(c + g, sd)) { lab[c + g] = nl; q[qt++] = c + g; } }
      keep.push(k); }
    const b2 = OW.a.slice(), edge = c => !SEA[c] && b2[c] !== b2[c0x]; let c0x = 0; for (let c = 0; c < N; c++) { if (keep[lab[c]]) continue; const i = c % g; c0x = c; if ((i > 0 && edge(c - 1)) || (i < g - 1 && edge(c + 1)) || (c >= g && edge(c - g)) || (c < N - g && edge(c + g))) OW.a[c] = 1 - b2[c]; }
  }
  // front-line ground model (scenarios that set ownMax, in km): each hour every land cell within ownMax of formed troops goes to the
  // side whose troops are nearer, measured over land, so the line between two armies lies halfway between them and ground behind an
  // advance changes hands with it. Cells beyond ownMax of everyone keep their owner. Game setting for division-scale scenarios.
  function frontTick(g, h) {
    const N = g * h, cw = OW.cw, SEA = OW.sea || (OW.sea = (() => { const z = new Uint8Array(N); for (let c = 0; c < N; c++) { const x = (c % g + .5) * cw, y = (((c / g) | 0) + .5) * cw; z[c] = map.t[Math.min(map.H - 1, Math.floor(y / map.cs)) * map.W + Math.min(map.W - 1, Math.floor(x / map.cs))] === T.SEA ? 1 : 0; } return z; })());
    const D = OW.fd || (OW.fd = [new Float32Array(N), new Float32Array(N)]), d1 = cw, d2 = cw * Math.SQRT2, cell = (x, y) => clamp(Math.floor(y / cw), 0, h - 1) * g + clamp(Math.floor(x / cw), 0, g - 1);
    for (let s = 0; s < 2; s++) { const d = D[s]; d.fill(1e9);
      // a cut-off formation's hold weakens as its supply and strength run down: its troops count as farther away, so the encircling
      // side takes the pocket's outer ground hour by hour while the defenders keep the ground they stand on (isoShrinkKm, game setting)
      const K = sc.isoShrinkKm || 0;
      for (const u of S.subs) if (u.s === s && u.active && !u.dead && u.mv !== 'ship' && u.coh > .2 && u.cls !== 'hq') { const F = u.f, off = K && F && F.isolated ? K * (1 - Math.min(1, F.stock / Math.max(1, F.cap))) * .7 + K * (1 - Math.min(1, u.str)) * .3 : 0, c = cell(u.x, u.y); if (off < d[c]) d[c] = off; }
      // two-pass chamfer distance; sea cells pass nothing on
      for (let j = 0; j < h; j++) for (let i = 0; i < g; i++) { const c = j * g + i; if (SEA[c]) continue; let v = d[c];
        if (i > 0 && d[c - 1] + d1 < v) v = d[c - 1] + d1; if (j > 0) { if (d[c - g] + d1 < v) v = d[c - g] + d1; if (i > 0 && d[c - g - 1] + d2 < v) v = d[c - g - 1] + d2; if (i < g - 1 && d[c - g + 1] + d2 < v) v = d[c - g + 1] + d2; } d[c] = v; }
      for (let j = h - 1; j >= 0; j--) for (let i = g - 1; i >= 0; i--) { const c = j * g + i; if (SEA[c]) continue; let v = d[c];
        if (i < g - 1 && d[c + 1] + d1 < v) v = d[c + 1] + d1; if (j < h - 1) { if (d[c + g] + d1 < v) v = d[c + g] + d1; if (i < g - 1 && d[c + g + 1] + d2 < v) v = d[c + g + 1] + d2; if (i > 0 && d[c + g - 1] + d2 < v) v = d[c + g - 1] + d2; } d[c] = v; } }
    const M = sc.ownMax; for (let c = 0; c < N; c++) { if (SEA[c]) continue; const a = D[0][c], b = D[1][c]; if (Math.min(a, b) > M || Math.abs(a - b) < .5) continue; OW.a[c] = a < b ? 0 : 1; }
  }
  const own0At = (x, y) => S.own0[clamp(Math.floor(y / OW.cw), 0, OW.gh - 1) * OW.gw + clamp(Math.floor(x / OW.cw), 0, OW.gw - 1)];
  S.setup = function () { S.mkBenches(); arrivals(); aiTick(); for (const F of S.forms) cmdTick(F); combatTick(); initOwn(); if (!sc.front) ownTick(false); S.own0 = OW.a.slice(); 
    // step 3 modules a scenario asks for (the France campaign: road and rail moves, the air war); the older scenarios run without them
    for (const m of sc.modules || []) { const fn = { transport: typeof attachTransport === 'function' && attachTransport, air: typeof attachAir === 'function' && attachAir, command: typeof attachCommand === 'function' && attachCommand, politics: typeof attachPolitics === 'function' && attachPolitics, theater: typeof attachTheater === 'function' && attachTheater, repl: typeof attachRepl === 'function' && attachRepl, urban: typeof attachUrban === 'function' && attachUrban, doctrine: typeof attachDoctrine === 'function' && attachDoctrine, intel: typeof attachIntel === 'function' && attachIntel }[m]; if (fn) fn(S); } };
  return S;
}
