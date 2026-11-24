// First slice: the corridor crisis. Valdenmark invades neutral Sarn to take the corridor that cuts it off from Ostval,
// with three weeks before the war widens. Sarn appeals to Korovia, whose first divisions reach the Ostval frontier from day 5.
// Every force, position, date and rate here is invented game design (Sarn Corridor design document v1); nothing is historical.
// node tools/scenario-corridor.js [hours] [seed] [out.json]     AI against AI, headless
const E = require('./load-engine')(), { createSim, SCENARIOS, divForm } = E;
const sarnMap = require('./sarnmap');
const fs = require('fs');
const WIN = { x0: 200, y0: 0, w: 760, h: 380 };
const START = '1940-06-01T04:00', DAYS = 21;
const W = (x, y) => [+(x - WIN.x0).toFixed(2), +(y - WIN.y0).toFixed(2)];   // continent km -> window km
const C = n => { const c = sarnMap.city(n); return W(c.x, c.y); };

// ---- forces: [template, division, regiments, commander, continent x, y, corps, arrival hour]
const VALDEN = [
  ['vd_pz', '1st Panzer Division', ['1st', '2nd', '1st'], 'Gen. Arno Velten', 430, 150, 'vd-pzk'],
  ['vd_pz', '2nd Panzer Division', ['3rd', '4th', '2nd'], 'Gen. Kurt Hallwig', 432, 198, 'vd-pzk'],
  ['vd_inf', '5th Infantry Division', ['13th', '14th', '15th'], 'Gen. Otto Brann', 445, 108, 'vd-pzk'],
  ['vd_pz', '4th Panzer Division', ['7th', '8th', '4th'], 'Gen. Willem Sarto', 420, 252, 'vd-xi'],
  ['vd_inf', '3rd Infantry Division', ['7th', '8th', '9th'], 'Gen. Ernst Lindau', 442, 290, 'vd-xi'],
  ['vd_inf', '7th Infantry Division', ['19th', '20th', '21st'], 'Gen. Paul Rehm', 435, 335, 'vd-xi'],
  ['vd_inf', '11th Infantry Division', ['31st', '32nd', '33rd'], 'Gen. Fritz Ostmann', 640, 168, 'vd-ost'],
  ['vd_inf', '12th Infantry Division', ['34th', '35th', '36th'], 'Gen. Hans Corell', 838, 150, 'vd-ost'],
  ['vd_inf', '8th Infantry Division', ['22nd', '23rd', '24th'], 'Gen. Rudolf Amsel', 440, 66, 'vd-pzk'],
  ['vd_pz', '3rd Panzer Division', ['5th', '6th', '3rd'], 'Gen. Konrad Weil', 400, 282, 'vd-xi'],
  ['vd_inf', '6th Infantry Division', ['16th', '17th', '18th'], 'Gen. Gustav Pell', 422, 372, 'vd-xi'],
  ['vd_inf', '10th Infantry Division', ['28th', '29th', '30th'], 'Gen. Leo Harding', 330, 150, 'vd-pzk', 24],
  ['vd_inf', '9th Infantry Division', ['25th', '26th', '27th'], 'Gen. Max Thiel', 300, 250, 'vd-xi', 48],
  ['vd_inf', '14th Infantry Division', ['40th', '41st', '42nd'], 'Gen. Erich Dorn', 300, 200, 'vd-pzk', 96],
];
const SARN = [
  ['sa_inf', '1st (Vesna) Division', ['1st', '2nd', '1st'], 'Gen. Pavel Koral', 527, 42, 'sa-i'],
  ['sa_inf', '2nd Division', ['3rd', '4th', '2nd'], 'Gen. Anton Rusek', 515, 118, 'sa-i'],
  ['sa_inf', '3rd Division', ['5th', '6th', '3rd'], 'Gen. Jan Medved', 512, 200, 'sa-i'],
  ['sa_inf', '4th Division', ['7th', '8th', '4th'], 'Gen. Milan Sokol', 482, 288, 'sa-ii'],
  ['sa_inf', '5th Division', ['9th', '10th', '5th'], 'Gen. Viktor Hrad', 500, 350, 'sa-ii'],
  ['sa_inf', '6th (Frontier) Division', ['11th', '12th', '6th'], 'Gen. Oto Brezina', 655, 255, 'sa-ii'],
  ['sa_inf', '7th Division', ['14th', '15th', '7th'], 'Gen. Ivo Danek', 520, 160, 'sa-i'],
  ['sa_inf', '8th Division', ['16th', '17th', '8th'], 'Gen. Rudolf Mach', 522, 372, 'sa-ii'],
  ['sa_inf', '9th Division', ['18th', '19th', '9th'], 'Gen. Petr Zeman', 600, 200, 'sa-i'],
  ['sa_mot', '1st Motorized Division', ['1st', '13th'], 'Gen. Karel Vlk', 650, 300, 'sa-ii'],
  ['sa_mot', '2nd Motorized Division', ['2nd', '20th'], 'Gen. Josef Hora', 565, 250, 'sa-i'],
];
const KOROV = [   // enter from the Korovian frontier at the window's east edge
  ['ko_inf', '21st Rifle Division', ['61st', '62nd', '63rd'], 'Gen. Ilya Strelin', 955, 160, 'ko-w', 120],
  ['ko_inf', '22nd Rifle Division', ['64th', '65th', '66th'], 'Gen. Fyodor Lagin', 955, 205, 'ko-w', 132],
  ['ko_tk', '1st Tank Division', ['1st', '2nd', '1st'], 'Gen. Boris Kamen', 955, 182, 'ko-w', 144],
  ['ko_inf', '23rd Rifle Division', ['67th', '68th', '69th'], 'Gen. Pyotr Orel', 955, 245, 'ko-w', 168],
  ['ko_tk', '2nd Tank Division', ['3rd', '4th', '2nd'], 'Gen. Semyon Grach', 955, 170, 'ko-w', 192],
  ['ko_inf', '24th Rifle Division', ['70th', '71st', '72nd'], 'Gen. Oleg Panin', 955, 225, 'ko-w', 180],
];
const STYLE = { vd: { ag: .6, sk: .65, xp: 1.05 }, sa: { ag: .35, sk: .5, xp: .85 }, ko: { ag: .55, sk: .5, xp: .9 } };   // quality against mass (game settings)
// opening objective lines for AI-run divisions, continent km (game design)
const PLAN = { '11th Infantry Division': [[565, 110], [580, 140]] };
// corps objective lines, continent km: each corps commander splits his line among his divisions (game design)
const CORPS_PLAN = [{ t: .5, c: 'vd-pzk', line: [[527, 17], [515, 205]] }, { t: .5, c: 'vd-xi', line: [[528, 240], [550, 345]] },   // through Port Vesna, Vesna crossing, Lisno and Corridor south; through Brodek and Tarnek
  { t: 196, c: 'ko-w', line: [[800, 135], [815, 255]] }];
// villages: intermediate objectives along the roads and rail lines of Sarn, 5 points each (invented names and places, game design)
const VILLAGES = [['Lisno', 515, 175], ['Korvik', 600, 128], ['Dolna', 625, 330], ['Hradek', 590, 245], ['Velka', 760, 270], ['Brodek', 528, 280], ['Mostin', 490, 120]];

function makeCorridor() {
  const base = SCENARIOS.find(s => s.id === 'falaise');
  const m = sarnMap(WIN), forms = [], hrs = d => d * 24;
  const mk = (row, s, k) => { const [tpl, n, regs, cmd, x, y, corps, t] = row, p = W(x, y);
    const f = divForm(Object.assign({ tpl, s, n, cmd, regs, x: p[0], y: p[1] }, STYLE[k])); f.corps = corps; f.power = k;
    if (t) f.arr = { t, mode: 'road' };
    if (PLAN[n]) f.ai = [{ t: (t || 0) + .5, path: [], line: PLAN[n].map(q => W(q[0], q[1])) }];
    forms.push(f); return f; };
  VALDEN.forEach(r => mk(r, 0, 'vd'));
  for (const r of SARN) { const f = mk(r, 1, 'sa');
    if (/Motorized/.test(f.n)) continue;                                        // the mobile reserve stays free
    const hw = 10; f.line = [[f.x, f.y - hw], [f.x, f.y + hw]]; f.dug = 1; f.stay = 1; f.stayMinStr = .45; }   // border divisions dig in facing west (game setting)
  const f6 = forms.find(f => /Frontier/.test(f.n)); if (f6) f6.line = [[f6.x - 7, f6.y], [f6.x + 7, f6.y]];   // the frontier division faces north toward Ostval
  KOROV.forEach(r => mk(r, 1, 'ko'));

  // ---- corps (game design)
  const corps = [['vd-army', 0, 'Valdenmark Army of the North', 'Gen. Dietrich Asch', .65, 'army'], ['ko-army', 1, 'Korovian Western Front', 'Gen. Mikhail Rudin', .6, 'army'], ['vd-pzk', 0, 'Valdenmark Panzer Corps', 'Gen. Arno Velten', .7], ['vd-xi', 0, 'Valdenmark XI Corps', 'Gen. Henrik Morr', .55], ['vd-ost', 0, 'Ostval Corps', 'Gen. Lothar Eisen', .45],
    ['sa-i', 1, 'Sarn I Corps', 'Gen. Tomas Varga', .3], ['sa-ii', 1, 'Sarn II Corps', 'Gen. Emil Kresta', .35], ['ko-w', 1, 'Korovian Western Group', 'Gen. Andrei Volkov', .6]];
  const commands = corps.map(([id, s, n, c, ag, lv]) => ({ id, s, level: lv || 'corps', n, cmd: { n: c, ag, sk: .6 } }));
  const cmdPlan = forms.map(f => ({ t: 0, f: f.n, c: f.corps })).concat(['vd-pzk', 'vd-xi', 'vd-ost'].map(c => ({ t: 0, f: 'cmd:' + c, c: 'vd-army' })), [{ t: 0, f: 'cmd:ko-w', c: 'ko-army' }]);
  const corpsPlan = CORPS_PLAN.map(q => ({ t: q.t, c: q.c, line: q.line.map(p => W(p[0], p[1])) }));

  // ---- objectives [name, x, y, points, owner at start]
  const vp = [['Port Vesna', 30, 1], ['Tarnek', 20, 1], ['Sarnow', 25, 1], ['Ostrand', 25, 0], ['Varnholm', 15, 0], ['Freyburg', 15, 0], ['Saarholt', 10, 0], ['Halden', 30, 0], ['Brennhaven', 10, 0]]
    .map(([n, pts, own]) => { const p = C(n); return [n, p[0], p[1], pts, own]; });
  for (const [n, x, y, pts] of [['Vesna crossing', 515, 95, 10], ['Corridor south', 520, 205, 10]]) { const p = W(x, y); vp.push([n, p[0], p[1], pts, 1]); }   // the corridor itself (game design)
  for (const [n, x, y] of VILLAGES) { const p = W(x, y); vp.push([n, p[0], p[1], 5, 1]); m.towns.push([n, p[0], p[1], 1]); }

  // ---- supply: depots and ports, stocks and rates are game settings
  const src = (n, at, stock, rate, t) => { const p = typeof at === 'string' ? C(at) : W(at[0], at[1]); return Object.assign({ n, x: p[0], y: p[1], stock, rate }, t ? { t } : {}); };
  const vSrc = [src('Halden depots', 'Halden', 80, 3), src('Freyburg railhead', 'Freyburg', 60, 3), src('Brennhaven port', 'Brennhaven', 40, 2), src('Ostrand port (Ostval)', 'Ostrand', 30, 1.5), src('Varnholm depot', 'Varnholm', 15, 1)];
  const sSrc = [src('Sarnow depots', 'Sarnow', 60, 3), src('Port Vesna', 'Port Vesna', 30, 2), src('Tarnek depot', 'Tarnek', 30, 2), src('Korovian railhead at the frontier', [955, 190], 60, 3, 110)];
  const pv = C('Port Vesna'), ports = [{ vp: 'Port Vesna', s: 0, n: 'Port Vesna port', x: pv[0], y: pv[1], rate: 3, stock: 20, clear: 72 }];   // usable by Valdenmark three days after capture

  // ---- air (game settings; aircraft types are stand-ins until each power has its own)
  const fld = (n, at) => { const p = C(at); return { n, x: p[0] + 3, y: p[1] + 3, kind: 'field' }; };
  const vBases = [fld('Freyburg airfield', 'Freyburg'), fld('Halden airfield', 'Halden'), fld('Ostrand airfield', 'Ostrand')];
  const sBases = [fld('Sarnow airfield', 'Sarnow'), fld('Tarnek airfield', 'Tarnek'), { n: 'Korovian fields beyond the frontier', x: WIN.w - 4, y: 190, kind: 'offmap' }];
  const vGroups = [['1st Fighter Wing', 'bf109f', 36, 0, 'cap'], ['2nd Dive Bomber Wing', 'ju87', 30, 0, 'cas'], ['3rd Bomber Wing', 'ju88', 24, 0, 'int']];
  const sGroups = [['Sarn Air Corps', 'mc202', 24, 0, 'cap'], ['Korovian Western Air Army', 'hurri', 30, 1, 'cas']];

  // ---- weather: 12-hour periods of early summer from a fixed seed (game setting)
  const weather = []; let r = 11; for (let i = 0; i < DAYS * 2 + 2; i++) { r = (r * 16807) % 2147483647; const u = r / 2147483647; weather.push(u < .6 ? 'clear' : u < .85 ? 'cloud' : u < .95 ? 'overcast' : 'rain'); }

  const front = { side: 0, polys: ['V', 'O'].map(id => sarnMap.nation(id).poly.map(p => W(p[0], p[1]))) };   // Valdenmark and Ostval start as side 0's ground; everything else as side 1's
  const sides = base.sides.map((sd, s) => Object.assign({}, sd, {
    name: s ? 'Sarn, with Korovia from day 5' : 'Valdenmark: Army of the North',
    rear: s ? [1, 0] : [-1, 0], pocket: s ? true : undefined, restH: s ? 4 : 8, aiPerVP: s ? 2 : 3, aiRng: s ? 0 : 120, posture: s ? 'defend' : 'attack',
    assets: [], sources: s ? sSrc : vSrc, pool: [], bases: s ? sBases : vBases, transport: { aircraft: 0 }, groups: s ? sGroups : vGroups }));

  return Object.assign({}, base, m, { id: 'corridor', title: 'Corridor Crisis', sub: 'Valdenmark against Sarn, 1 to 21 June', start: START, hours: hrs(DAYS),
    ownCell: 1, ownR: 5, ownMax: 25, aiExact: 1, labels: ['Valdenmark', 'Sarn'], divScale: [22, 70], commands, cmdPlan, corpsPlan, armyAI: { only: ['vd-army', 'ko-army'], from: 30, frontKm: 5, reachKm: 70, cadenceH: 18, waitH: 30, supply: .3 }, detourKm: 30, view: { x: 330, y: 150, dist: 150, pitch: 1.3 }, playerSides: [0, 1, -1],
    modules: ['transport', 'air', 'command', 'repl'],
    repl: { pools: [{ k: 'vd', n: 'Valdenmark depots', s: 0, nat: ['GE'], perDay: [{ from: 0, n: 1.2 }], xp: .85 },
      { k: 'sa', n: 'Sarn reserves', s: 1, nat: ['IT'], perDay: [{ from: 0, n: .5 }], xp: .75 },
      { k: 'ko', n: 'Korovian drafts', s: 1, nat: ['UK'], perDay: [{ from: 120, n: .8 }], xp: .8 }] },
    forest: [], rough: [], marsh: [], bridges: [], vp, ports, weather, sides, forms, front, thin: undefined, halt: undefined, mines: undefined, beach: [], phaseLines: [], fieldPlan: [],
    brief: ['Sarn has refused passage across the corridor that cuts Valdenmark off from Ostval. Take Port Vesna and the corridor rail line within three weeks, and link up with the Ostval Corps before Korovia can bring its weight to bear on the Ostval frontier.',
      'Valdenmark has crossed the frontier. Hold Port Vesna and the corridor along the Vesna, keep the motorized reserve for the breakthrough, and hold on until the Korovian Western Group arrives from day 5 to strike Ostval.'],
    hist: 'An invented war: the Sarn Corridor design document, first slice. Valdenmark wins the scenario by holding Port Vesna and both corridor objectives at the end of day 21.' });
}
module.exports = makeCorridor; module.exports.WIN = WIN; module.exports.START = START;

if (require.main === module) {
  const hours = +(process.argv[2] || 72), seed = +(process.argv[3] || 12345);
  const t0 = Date.now(), sc = makeCorridor(), S = createSim(sc, -1, seed, {}); S.setup();
  console.log('Corridor: ' + sc.w + ' x ' + sc.h + ' km; roads ' + sc.roads.length + ', rail ' + sc.rails.length + ', towns ' + sc.towns.length + ', objectives ' + sc.vp.length + ', bridges ' + S.map.bridges.length);
  console.log('  ' + sc.forms.filter(f => f.s === 0).length + ' Valdenmark and ' + sc.forms.filter(f => f.s === 1).length + ' Sarn and Korovian divisions, ' + S.subs.length + ' battalions; setup ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  const held = () => S.vp.filter(v => v.own === 0).map(v => v.n), CORR = ['Port Vesna', 'Vesna crossing', 'Corridor south'];
  let g = 0; const t1 = Date.now();
  while (!S.over && g < hours * 60) { S.advance(60); g += 60;
    if (g % (24 * 60) === 0) { const act = S.forms.filter(F => F.active && !F.dead); console.log('  ' + S.clock(S.t).slice(0, 16) + ' | ' + ((Date.now() - t1) / 1000).toFixed(0) + ' s | on map V ' + act.filter(F => F.s === 0).length + ' S/K ' + act.filter(F => F.s === 1).length + ' | losses ' + S.losses.map(v => v.toFixed(0)).join(' / ') + ' | Valdenmark holds ' + held().join(', ')); } }
  const win = CORR.every(n => held().includes(n));
  console.log('Result: ' + (g / 60) + ' game h in ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s; corridor ' + (win ? 'TAKEN' : 'not taken') + '; Valdenmark holds ' + held().join(', '));
  if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify({ seed, hours: g / 60, held: held(), corridor: win, losses: S.losses }));
}
