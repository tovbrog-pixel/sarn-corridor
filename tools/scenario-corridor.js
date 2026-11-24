// First slice: the corridor crisis. Valdenmark invades neutral Sarn to take the corridor that cuts it off from Ostval. The game opens
// 48 hours before H-hour: both sides see their pre-war intelligence and may redeploy, but neither may cross the frontier or open fire.
// Sarn spreads its divisions thick where it expects the blow and thin elsewhere; Valdenmark masses on the axis where it judges Sarn
// weakest. Six deployment variants pair a Sarn expectation with a Valdenmark choice, and the engine draws one at the start of each game.
// Korovia's first divisions reach the Ostval frontier from day 3 of the war.
// Every force, position, date and rate here is invented game design (Sarn Corridor design document v1); nothing is historical.
// node tools/scenario-corridor.js [hours] [seed] [out.json] [variant]     AI against AI, headless
const E = require('./load-engine')(), { createSim, SCENARIOS, divForm } = E;
// unit level: SC_LEVEL=reg builds every division from the regiment-level templates (one unit per regiment or brigade)
const LEVEL = process.env.SC_LEVEL || 'bn';
const sarnMap = require('./sarnmap');
const fs = require('fs');
const polyLen = l => l.reduce((a, p, i) => i ? a + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0, 0);
const polyAt = (l, d) => { let acc = 0; for (let i = 1; i < l.length; i++) { const s = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); if (acc + s >= d) { const t = s ? (d - acc) / s : 0; return { x: l[i - 1][0] + (l[i][0] - l[i - 1][0]) * t, y: l[i - 1][1] + (l[i][1] - l[i - 1][1]) * t }; } acc += s; } const e = l[l.length - 1]; return { x: e[0], y: e[1] }; };
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
// SC_WIN=full runs the same battle on the whole continent (a load test of map area)
const WIN = process.env.SC_WIN === 'full' ? { x0: 0, y0: 0, w: 1400, h: 900 } : { x0: 200, y0: 0, w: 760, h: 380 };
const START = '1940-05-30T04:00', HHOUR = 48, DAYS = 21;   // two days of tension, then three weeks of war
const W = (x, y) => [+(x - WIN.x0).toFixed(2), +(y - WIN.y0).toFixed(2)];   // continent km -> window km
const C = n => { const c = sarnMap.city(n); return W(c.x, c.y); };
const STYLE = { vd: { ag: .6, sk: .65, xp: 1.05 }, sa: { ag: .35, sk: .5, xp: .85 }, ko: { ag: .55, sk: .5, xp: .9 } };   // quality against mass (game settings)
const SURN = { vd: ['Velten', 'Hallwig', 'Brann', 'Sarto', 'Lindau', 'Rehm', 'Ostmann', 'Corell', 'Amsel', 'Weil', 'Pell', 'Harding', 'Thiel', 'Dorn', 'Kessler', 'Moritz', 'Falk', 'Behrend', 'Lotz', 'Grabe', 'Hagen', 'Ruhland', 'Seidel', 'Tamm', 'Vogt', 'Wendt', 'Zorn', 'Albers', 'Brink', 'Claus'],
  sa: ['Koral', 'Rusek', 'Medved', 'Sokol', 'Hrad', 'Brezina', 'Danek', 'Mach', 'Zeman', 'Vlk', 'Hora', 'Kubat', 'Lasek', 'Novak', 'Pesek', 'Riha', 'Smid', 'Tuma', 'Urban', 'Vesely', 'Zika', 'Blaha'],
  ko: ['Strelin', 'Lagin', 'Kamen', 'Orel', 'Grach', 'Panin', 'Sorokin', 'Belyaev'] };
const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

// ---- geometry from the map
const NAT = id => sarnMap.nation(id).poly;
const vEdge = y => { let e = 300; for (let x = 300; x < 700; x += 1) if (inPoly(x, y, NAT('V'))) e = x; return e; };          // Valdenmark's eastern frontier at latitude y
const oEdge = x => { let e = 150; for (let y = 50; y < 320; y += 1) if (inPoly(x, y, NAT('O'))) e = y; return e; };            // Ostval's southern frontier at longitude x
const ves = sarnMap.load().map.rivers.find(r => r.name === 'Vesna').pts.filter(p => p[1] >= 20 && p[1] <= 375).sort((a, b) => a[1] - b[1]);
const BANK = ves.map((p, i) => { const a = ves[Math.max(0, i - 1)], b = ves[Math.min(ves.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, sg = -dy > 0 ? 1 : -1; return [p[0] + sg * -dy / L * 2.5, p[1] + sg * dx / L * 2.5]; });   // east bank of the Vesna, continent km
// axes of attack across the Vesna: latitude bands, with the objectives behind each (game design)
const AXES = { north: { y: [15, 120], c: 60, obj: [[527, 17], [512, 110]] }, center: { y: [120, 230], c: 175, obj: [[515, 130], [520, 220]] }, south: { y: [230, 375], c: 300, obj: [[528, 245], [550, 345]] } };
// place n points along a polyline so that their spacing shrinks where weight(point) is high: thick where weight is high, thin where low
function spread(line, n, weight) { const L = polyLen(line), st = 1, cum = [0]; let acc = 0; for (let d = st; d <= L; d += st) { const q = polyAt(line, d); acc += weight(q.x, q.y); cum.push(acc); }
  const out = []; for (let i = 0; i < n; i++) { const target = acc * (i + .5) / n; let k = cum.findIndex(v => v >= target); if (k < 0) k = cum.length - 1; const q = polyAt(line, k * st); out.push({ x: q.x, y: q.y, d: k * st }); } return { pts: out, L }; }
const bandW = (y, band, w) => (y >= band[0] && y <= band[1] ? w : 1);

function buildVariant(sarnPlan, vAxis) {
  const forms = [], corpsList = [], cmdPlan = [], corpsPlan = []; const sn = { vd: 0, sa: 0, ko: 0 };
  // keep each division on its own side's ground: step west (Valdenmark) or east (Sarn) until it is
  const G = sarnMap.load(), wet = (x, y) => { const c = G.t[Math.floor(y) * G.grid.w + Math.floor(x)]; return c === 12 || c === 13; };
  const own = (s, x, y) => { const v = inPoly(x, y, NAT('V')) || inPoly(x, y, NAT('O')); return (s === 0 ? v : !v) && !wet(x, y); };
  const fix = (s, x, y, arr) => { if (arr) return [x, y]; for (let k = 0; k < 60 && !own(s, x, y); k++) x += s === 0 ? -2 : 2; return [x, y]; };
  const mk = (tpl, s, k, n, regs, x0, y0, corps, extra) => { if (LEVEL === 'reg') tpl += '_r'; const [x, y] = fix(s, x0, y0, extra && extra.arr), p = W(x, y), f = divForm(Object.assign({ tpl, s, n, cmd: 'Gen. ' + SURN[k][sn[k]++ % SURN[k].length], regs, x: p[0], y: p[1] }, STYLE[k])); f.corps = corps; f.power = k; Object.assign(f, extra || {}); forms.push(f); cmdPlan.push({ t: 0, f: n, c: corps }); return f; };
  const corps = (id, s, n, cmd, ag, army, lv) => { corpsList.push({ id, s, level: lv || 'corps', n, cmd: { n: cmd, ag, sk: .6 } }); if (army) cmdPlan.push({ t: 0, f: 'cmd:' + id, c: army }); };
  corps('vd-army', 0, 'Valdenmark Army of the North', 'Gen. Dietrich Asch', .65, null, 'army'); corps('ko-army', 1, 'Korovian Western Front', 'Gen. Mikhail Rudin', .6, null, 'army');

  // ---- Sarn: 14 divisions on the Vesna, spread by its expectation; 4 thin on the Ostval frontier; reserves behind the expected axis
  const EXPECT = { corridor: y => bandW(y, [15, 230], 2.6), balanced: y => bandW(y, [15, 120], 1.6), south: y => bandW(y, [230, 375], 2.6) }[sarnPlan];
  const sl = spread(BANK, 14, (x, y) => EXPECT(y)), sIds = ['sa-i', 'sa-i', 'sa-i', 'sa-i', 'sa-ii', 'sa-ii', 'sa-ii', 'sa-ii', 'sa-ii', 'sa-iii', 'sa-iii', 'sa-iii', 'sa-iii', 'sa-iii'];
  corps('sa-i', 1, 'Sarn I Corps', 'Gen. Tomas Varga', .3); corps('sa-ii', 1, 'Sarn II Corps', 'Gen. Emil Kresta', .35); corps('sa-iii', 1, 'Sarn III Corps', 'Gen. Pavel Dusek', .35); corps('sa-iv', 1, 'Sarn Frontier Corps', 'Gen. Jiri Mraz', .3); corps('sa-res', 1, 'Sarn General Reserve', 'Gen. Karel Benes', .45);
  sl.pts.forEach((q, i) => { const a = i ? (sl.pts[i - 1].d + q.d) / 2 : Math.max(0, q.d - 12), b = i < sl.pts.length - 1 ? (q.d + sl.pts[i + 1].d) / 2 : Math.min(sl.L, q.d + 12), seg = [];
    for (let d = a; d <= b + 1e-6; d += Math.max(1, (b - a) / 10)) { const r = polyAt(BANK, Math.min(d, sl.L)); seg.push(W(r.x, r.y)); }
    mk('sa_inf', 1, 'sa', ord(i + 1) + (i === 0 ? ' (Vesna) Division' : ' Division'), [ord(2 * i + 1), ord(2 * i + 2), ord(i + 1)], q.x, q.y, sIds[i], { line: seg, dug: 1, stay: 1, stayMinStr: .45 }); });
  [600, 680, 760, 840].forEach((x, i) => { const y = oEdge(x) + 10, seg = [W(x - 35, oEdge(x - 35) + 10), W(x, y), W(x + 35, oEdge(x + 35) + 10)]; mk('sa_inf', 1, 'sa', ord(15 + i) + ' (Frontier) Division', [ord(29 + 2 * i), ord(30 + 2 * i), ord(15 + i)], x, y, 'sa-iv', { line: seg, dug: 1, stay: 1, stayMinStr: .45 }); });
  const ex = sarnPlan === 'south' ? AXES.south : sarnPlan === 'balanced' ? AXES.center : AXES.north, ey = ex.c;
  const bx = BANK.reduce((a, p) => Math.abs(p[1] - ey) < Math.abs(a[1] - ey) ? p : a, BANK[0]);
  mk('sa_mot', 1, 'sa', '1st Motorized Division', ['1st', '13th'], bx[0] + 12, ey, 'sa-res'); mk('sa_mot', 1, 'sa', '2nd Motorized Division', ['2nd', '20th'], 565, 255, 'sa-res');   // the second mobile reserve waits at the centre of Sarn
  mk('sa_inf', 1, 'sa', '19th (Reserve) Division', ['37th', '38th', '19th'], 680, 295, 'sa-res'); mk('sa_inf', 1, 'sa', '20th (Reserve) Division', ['39th', '40th', '20th'], 600, 330, 'sa-res');

  // ---- Valdenmark: 16 infantry divisions along its frontier, thick opposite the main axis; two panzer corps massed behind it
  // line of departure: 6 km inside the frontier, smoothed over 30 km so it runs as one line; first-echelon divisions take sectors of it,
  // narrow opposite the main axis and wide elsewhere, and deploy along their sectors at the start (doctrine: assembly before H-hour)
  const MAIN = AXES[vAxis], raw = []; for (let y = 32; y <= 372; y += 5) raw.push([vEdge(y) - 6, y]);
  const vLine = raw.map((p, i) => { const w = raw.slice(Math.max(0, i - 3), i + 4); let x = Math.min(p[0], w.reduce((a, q) => a + q[0], 0) / w.length); for (let k = 0; k < 20 && !inPoly(x, p[1], NAT('V')); k++) x -= 2; return [x, p[1]]; });
  const vl = spread(vLine, 16, (x, y) => bandW(y, MAIN.y, 2.5)), vIds = ['vd-i', 'vd-i', 'vd-i', 'vd-i', 'vd-ii', 'vd-ii', 'vd-ii', 'vd-ii', 'vd-iii', 'vd-iii', 'vd-iii', 'vd-iii', 'vd-iv', 'vd-iv', 'vd-iv', 'vd-iv'];
  ['vd-i', 'vd-ii', 'vd-iii', 'vd-iv'].forEach((id, i) => corps(id, 0, 'Valdenmark ' + ['I', 'II', 'III', 'IV'][i] + ' Corps', 'Gen. ' + ['Henrik Morr', 'Ulrich Stade', 'Bernd Kolbe', 'Anton Reiss'][i], .55, 'vd-army'));
  const infNo = [3, 5, 6, 7, 8, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
  vl.pts.forEach((q, i) => { const a = i ? (vl.pts[i - 1].d + q.d) / 2 : Math.max(0, q.d - 10), b = i < vl.pts.length - 1 ? (q.d + vl.pts[i + 1].d) / 2 : Math.min(vl.L, q.d + 10), seg = [];
    for (let d = a; d <= b + 1e-6; d += Math.max(1, (b - a) / 8)) { const r = polyAt(vLine, Math.min(d, vl.L)); seg.push(W(r.x, r.y)); }
    mk('vd_inf', 0, 'vd', ord(infNo[i]) + ' Infantry Division', [ord(3 * infNo[i] - 2), ord(3 * infNo[i] - 1), ord(3 * infNo[i])], q.x, q.y, vIds[i], { line: seg, stretch: 1 }); });
  corps('vd-pza', 0, 'Valdenmark I Panzer Corps', 'Gen. Arno Velten', .75, 'vd-army'); corps('vd-pzb', 0, 'Valdenmark II Panzer Corps', 'Gen. Kurt Hallwig', .7, 'vd-army');
  const mx = vEdge(MAIN.c) - 28;
  mk('vd_pz', 0, 'vd', '1st Panzer Division', ['1st', '2nd', '1st'], mx, MAIN.c - 18, 'vd-pza'); mk('vd_pz', 0, 'vd', '2nd Panzer Division', ['3rd', '4th', '2nd'], mx, MAIN.c, 'vd-pza'); mk('vd_mot', 0, 'vd', '13th Motorized Division', ['66th', '93rd'], mx - 12, MAIN.c + 14, 'vd-pza');
  mk('vd_pz', 0, 'vd', '3rd Panzer Division', ['5th', '6th', '3rd'], mx - 35, MAIN.c - 14, 'vd-pzb'); mk('vd_pz', 0, 'vd', '4th Panzer Division', ['7th', '8th', '4th'], mx - 35, MAIN.c + 6, 'vd-pzb'); mk('vd_mot', 0, 'vd', '16th Motorized Division', ['60th', '156th'], mx - 47, MAIN.c + 20, 'vd-pzb');
  corps('vd-ost', 0, 'Ostval Corps', 'Gen. Lothar Eisen', .45, 'vd-army');
  [[640, oEdge(640) - 12, 11], [760, oEdge(760) - 12, 12], [878, 140, 15], [862, 205, 17]].forEach(([x, y, no]) => mk('vd_inf', 0, 'vd', ord(no) + ' Infantry Division', [ord(3 * no - 2), ord(3 * no - 1), ord(3 * no)], x, y, 'vd-ost'));
  corps('vd-res', 0, 'Valdenmark Army Reserve', 'Gen. Otto Krell', .5, 'vd-army');
  [[9, 330, 150, 60], [10, 300, 250, 72], [14, 330, 200, 96], [18, 300, 300, 120]].forEach(([no, x, y, t]) => mk('vd_inf', 0, 'vd', ord(no) + ' Infantry Division', [ord(3 * no - 2), ord(3 * no - 1), ord(3 * no)], x, y, 'vd-res', { arr: { t, mode: 'road' } }));

  // ---- Korovia: eight divisions reach the Ostval frontier from day 3 of the war
  corps('ko-w', 1, 'Korovian Western Group', 'Gen. Andrei Volkov', .6, 'ko-army');
  [['ko_inf', 21, 160, 0], ['ko_inf', 22, 205, 12], ['ko_tk', 1, 182, 24], ['ko_inf', 23, 245, 36], ['ko_inf', 24, 225, 48], ['ko_tk', 2, 170, 60], ['ko_inf', 25, 140, 72], ['ko_inf', 26, 260, 84]].forEach(([tpl, no, y, dt]) =>
    mk(tpl, 1, 'ko', ord(no) + (tpl === 'ko_tk' ? ' Tank Division' : ' Rifle Division'), tpl === 'ko_tk' ? [ord(2 * no - 1), ord(2 * no), ord(no)] : [ord(3 * no + 1), ord(3 * no + 2), ord(3 * no + 3)], 955, y, 'ko-w', { arr: { t: HHOUR + 72 + dt, mode: 'road' } }));

  // ---- opening orders at H-hour (game design): the main axis by I Panzer Corps, II Panzer Corps following to exploit; infantry corps
  // attack across the Vesna in their own sectors on wide zones; the Ostval Corps strikes west to meet the main effort; Korovia attacks Ostval
  const toW = l => l.map(p => W(p[0], p[1]));
  corpsPlan.push({ t: HHOUR + .5, c: 'vd-pza', opt: { main: true, reserve: false }, line: toW(MAIN.obj) });
  corpsPlan.push({ t: HHOUR + 24, c: 'vd-pzb', opt: { main: true, reserve: false }, line: toW(MAIN.obj.map(p => [p[0] + 45, p[1]])) });
  ['vd-i', 'vd-ii', 'vd-iii', 'vd-iv'].forEach(id => { const ys = forms.filter(f => f.corps === id).map(f => f.y); const y0 = Math.min(...ys), y1 = Math.max(...ys), seg = BANK.filter(p => p[1] >= y0 - 8 && p[1] <= y1 + 8).map(p => [p[0] + 10, p[1]]);
    if (seg.length >= 2) corpsPlan.push({ t: HHOUR + 1, c: id, opt: { reserve: false }, line: toW(seg) }); });
  forms.find(f => f.n === '11th Infantry Division').ai = [{ t: HHOUR + .5, path: [], line: toW([[565, 105], [580, 140]]) }];
  corpsPlan.push({ t: HHOUR + 72 + 96, c: 'ko-w', line: toW([[800, 135], [815, 255]]) });
  return { forms, commands: corpsList, cmdPlan, corpsPlan, variantName: 'Sarn expects ' + sarnPlan + '; Valdenmark main effort ' + vAxis };
}
// six variants: Sarn's expectation, and Valdenmark's choice, usually where Sarn is thin (game design)
const VARIANTS = [['corridor', 'south'], ['corridor', 'north'], ['corridor', 'south'], ['balanced', 'center'], ['balanced', 'north'], ['south', 'north']];

function makeCorridor() {
  const base = SCENARIOS.find(s => s.id === 'falaise');
  const m = sarnMap(WIN), variants = VARIANTS.map(([a, b]) => buildVariant(a, b));
  // ---- objectives [name, x, y, points, owner at start]
  const vp = [['Port Vesna', 30, 1], ['Tarnek', 20, 1], ['Sarnow', 25, 1], ['Ostrand', 25, 0], ['Varnholm', 15, 0], ['Freyburg', 15, 0], ['Saarholt', 10, 0], ['Halden', 30, 0], ['Brennhaven', 10, 0]]
    .map(([n, pts, own]) => { const p = C(n); return [n, p[0], p[1], pts, own]; });
  for (const [n, x, y, pts] of [['Vesna crossing', 515, 95, 10], ['Corridor south', 520, 205, 10]]) { const p = W(x, y); vp.push([n, p[0], p[1], pts, 1]); }
  for (const [n, x, y] of [['Lisno', 515, 175], ['Korvik', 600, 128], ['Dolna', 625, 330], ['Hradek', 590, 245], ['Velka', 760, 270], ['Brodek', 528, 280], ['Mostin', 490, 120]]) { const p = W(x, y); vp.push([n, p[0], p[1], 5, 1]); m.towns.push([n, p[0], p[1], 1, 1.0]); }   // villages drawn like other size-1 towns, about 2 km across
  if (process.env.SC_SMALLTOWNS) for (const t of m.towns) t.length = 4;   // test switch: the engine's original town sizes
  // ---- supply, ports, air (game settings; aircraft types are stand-ins)
  const src = (n, at, stock, rate, t) => { const p = typeof at === 'string' ? C(at) : W(at[0], at[1]); return Object.assign({ n, x: p[0], y: p[1], stock, rate }, t ? { t } : {}); };
  const vSrc = [src('Halden depots', 'Halden', 120, 4), src('Freyburg railhead', 'Freyburg', 90, 4), src('Saarholt railhead', 'Saarholt', 60, 3), src('Brennhaven port', 'Brennhaven', 40, 2), src('Ostrand port (Ostval)', 'Ostrand', 40, 2), src('Varnholm depot', 'Varnholm', 20, 1)];
  const sSrc = [src('Sarnow depots', 'Sarnow', 90, 4), src('Port Vesna', 'Port Vesna', 40, 2), src('Tarnek depot', 'Tarnek', 40, 2), src('Velka depot', [760, 270], 30, 2), src('Korovian railhead at the frontier', [955, 190], 80, 4, HHOUR + 60)];
  const pv = C('Port Vesna'), ports = [{ vp: 'Port Vesna', s: 0, n: 'Port Vesna port', x: pv[0], y: pv[1], rate: 3, stock: 20, clear: 72 }];
  const fld = (n, at) => { const p = C(at); return { n, x: p[0] + 3, y: p[1] + 3, kind: 'field' }; };
  const vBases = [fld('Freyburg airfield', 'Freyburg'), fld('Halden airfield', 'Halden'), fld('Saarholt airfield', 'Saarholt'), fld('Ostrand airfield', 'Ostrand')];
  const sBases = [fld('Sarnow airfield', 'Sarnow'), fld('Tarnek airfield', 'Tarnek'), { n: 'Korovian fields beyond the frontier', x: WIN.w - 4, y: 190, kind: 'offmap' }];
  const vGroups = [['1st Fighter Wing', 'bf109f', 48, 0, 'cap'], ['2nd Dive Bomber Wing', 'ju87', 36, 0, 'cas'], ['3rd Bomber Wing', 'ju88', 30, 0, 'int']];
  const sGroups = [['Sarn Air Corps', 'mc202', 30, 0, 'cap'], ['Korovian Western Air Army', 'hurri', 36, 1, 'cas']];
  const weather = []; let r = 11; for (let i = 0; i < DAYS * 2 + 8; i++) { r = (r * 16807) % 2147483647; const u = r / 2147483647; weather.push(u < .6 ? 'clear' : u < .85 ? 'cloud' : u < .95 ? 'overcast' : 'rain'); }
  const front = { side: 0, polys: ['V', 'O'].map(id => NAT(id).map(p => W(p[0], p[1]))) };
  const sides = base.sides.map((sd, s) => Object.assign({}, sd, {
    name: s ? 'Sarn, with Korovia from day 3' : 'Valdenmark: Army of the North',
    rear: s ? [1, 0] : [-1, 0], pocket: s ? true : undefined, restH: s ? 4 : 8, aiPerVP: s ? 2 : 3, aiRng: s ? 0 : 120, posture: s ? 'defend' : 'attack',
    assets: [], sources: s ? sSrc : vSrc, pool: [], bases: s ? sBases : vBases, transport: { aircraft: 0 }, groups: s ? sGroups : vGroups }));
  const v0 = variants[0];
  return Object.assign({}, base, m, { id: 'corridor', title: 'Corridor Crisis', sub: 'Valdenmark against Sarn: two days of tension, then three weeks of war', start: START, hours: HHOUR + DAYS * 24, hHour: HHOUR,
    ownCell: +(process.env.SC_OWNCELL || 1), supplyMin: process.env.SC_SUPMIN ? +process.env.SC_SUPMIN : undefined, ownR: 5, ownMax: 25, isoShrinkKm: 20, thin: [/^\d+(st|nd|rd|th) (\(\w+\) )?Division$/],   // Sarn's divisions stretch over long sectors (thin defence) aiExact: 1, labels: ['Valdenmark', 'Sarn'], divScale: [22, 70],
    forms: v0.forms, commands: v0.commands, cmdPlan: v0.cmdPlan, corpsPlan: v0.corpsPlan, variants,
    armyAI: { only: ['vd-army', 'ko-army'], from: HHOUR + 30, frontKm: 5, reachKm: 70, cadenceH: 18, waitH: 30, supply: .3, pocketBonus: 2.5 },
    detourKm: 30, view: { x: 330, y: 190, dist: 230, pitch: 1.3 }, playerSides: [0, 1, -1],
    modules: ['transport', 'air', 'command', 'repl', 'doctrine', 'intel'].concat(process.env.SC_NOURBAN ? [] : ['urban']),
    intel: { known: [.8, .6], rearMul: .55, errKm: [4, 14], named: [.6, .4], frontKm: 30 },
    repl: { pools: [{ k: 'vd', n: 'Valdenmark depots', s: 0, nat: ['GE'], perDay: [{ from: HHOUR, n: 2.5 }], xp: .85 },
      { k: 'sa', n: 'Sarn reserves', s: 1, nat: ['IT'], perDay: [{ from: HHOUR, n: 1 }], xp: .75 },
      { k: 'ko', n: 'Korovian drafts', s: 1, nat: ['UK'], perDay: [{ from: HHOUR + 72, n: 1.2 }], xp: .8 }] },
    forest: [], rough: [], marsh: [], bridges: [], vp, ports, weather, sides, front, halt: undefined, mines: undefined, beach: [], phaseLines: [], fieldPlan: [],
    brief: ['Sarn has refused passage across the corridor that cuts Valdenmark off from Ostval. You have two days before H-hour to study the intelligence picture and set your main effort; faded symbols mark Sarn divisions known only from pre-war reports. Then take Port Vesna and the corridor within three weeks, before Korovia brings its weight against Ostval.',
      'Valdenmark is massing on the frontier. You have two days before H-hour to judge where the blow will fall and thicken your line there; faded symbols mark Valdenmark divisions known only from pre-war reports. Hold Port Vesna and the corridor until the Korovian Western Group arrives from day 3 of the war.'],
    hist: 'An invented war: the Sarn Corridor design document, first slice. Valdenmark wins the scenario by holding Port Vesna and both corridor objectives at the end of day 21 of the war.' });
}
module.exports = makeCorridor; module.exports.WIN = WIN; module.exports.START = START;

if (require.main === module) {
  const hours = +(process.argv[2] || 72), seed = +(process.argv[3] || 12345), vi = process.argv[5] != null ? +process.argv[5] : undefined;
  const t0 = Date.now(), sc = makeCorridor(), S = createSim(sc, -1, seed, vi != null ? { variant: vi } : {}); S.setup();
  const V = sc.variants[S.sc.variantIndex];
  console.log('Corridor: ' + sc.w + ' x ' + sc.h + ' km; variant ' + S.sc.variantIndex + ' (' + V.variantName + '); objectives ' + sc.vp.length + ', bridges ' + S.map.bridges.length);
  console.log('  ' + S.forms.filter(f => f.s === 0).length + ' Valdenmark and ' + S.forms.filter(f => f.s === 1).length + ' Sarn and Korovian divisions, ' + S.subs.length + ' battalions; intel entries V ' + S.intel[0].length + ', S ' + S.intel[1].length + '; setup ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  const held = () => S.vp.filter(v => v.own === 0).map(v => v.n), CORR = ['Port Vesna', 'Vesna crossing', 'Corridor south'];
  let g = 0; const t1 = Date.now();
  while (!S.over && g < hours * 60) { S.advance(60); g += 60;
    if (g % (24 * 60) === 0) { const act = S.forms.filter(F => F.active && !F.dead); console.log('  ' + S.clock(S.t).slice(0, 16) + ' | ' + ((Date.now() - t1) / 1000).toFixed(0) + ' s | on map V ' + act.filter(F => F.s === 0).length + ' S/K ' + act.filter(F => F.s === 1).length + ' | losses ' + S.losses.map(v => v.toFixed(0)).join(' / ') + ' | Valdenmark holds ' + held().join(', ')); } }
  const win = CORR.every(n => held().includes(n));
  console.log('Result: ' + (g / 60) + ' game h in ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s; corridor ' + (win ? 'TAKEN' : 'not taken') + '; Valdenmark holds ' + held().join(', '));
  if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify({ seed, variant: S.sc.variantIndex, variantName: V.variantName, hours: g / 60, held: held(), corridor: win, losses: S.losses, config: (process.env.SC_SMALLTOWNS ? 'small' : 'big') + (process.env.SC_NOURBAN ? '' : '+rules'), first: Object.fromEntries(S.vp.filter(v => v.first && v.first[0] != null).map(v => [v.n, Math.round(v.first[0])])) }));   // first: game hour Valdenmark first took each objective
}
