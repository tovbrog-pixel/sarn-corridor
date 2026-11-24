// ===== BALANCE TABLE: tuning applied on top of the scenario data, one block per scenario =====
// side.free / form.free: hours before an AI staff may send a formation after objectives of its own choosing (scripted moves still run)
// mul: strength multiplier on a formation's battalions; ag/sk: commander ratings; drop: remove named battalions
(function () {
  // ---- front lines at the start of each scenario (side: whose ground lies inside the polygons; all: one side holds everything)
  const FRONT = {
    // Kasserine, 19 Feb 1943 04:00: the Axis holds Kasserine, Sbeitla, Feriana and Thelepte; II Corps and 6th Armoured Division hold the pass, Thala, Sbiba, Djebel el Hamra and Bou Chebka
    kasserine: { side: 0, polys: [[[0, 0], [90, 0], [90, 30], [80, 32], [72, 38], [62, 46], [56.5, 50], [54.5, 55.5], [48, 57], [38, 60], [30, 62], [20, 64], [0, 66]]] },
    // Salerno, 9 Sep 1943 03:30, and Sicily, 10 Jul 1943 02:45: the assault has not landed; the Axis holds all the land
    salerno: { all: 1 }, sicily: { all: 1 },
    // Market Garden, 17 Sep 1944 13:00: XXX Corps holds the Meuse-Escaut canal and the Joe's Bridge bridgehead at Neerpelt; everything north is German until the airborne lands
    marketgarden: { side: 0, polys: [[[0, 94.6], [11, 94.4], [12.6, 91.4], [17.8, 91.4], [19.5, 94.2], [62, 94.6], [62, 98], [0, 98]]] },
    // Bastogne, 19 Dec 1944 06:00: German spearheads at Noville, Longvilly, Mageret and Neffe east of the town and at Wiltz; Bastogne, its villages and VIII Corps' rear to the west and south still American
    bastogne: { side: 0, polys: [[[0, 0], [40, 0], [36, 10], [35, 14], [38, 18], [38.5, 22], [36.5, 26.8], [36.5, 30], [40, 36], [42, 44], [44, 60], [0, 60]]] },
    // Falaise, 12 Aug 1944 06:00: the German pocket, from the Canadian front north of Falaise round the British and US fronts in the west to US VII and XV Corps in the south, open to the east
    falaise: { side: 1, polys: [[[38, 17.2], [40, 17.6], [43, 15.8], [46, 14.2], [48, 13.8], [51, 13.6], [55, 13.6], [58, 13.1], [63, 13.1], [66, 12.6], [68.5, 11.8], [70, 10.6], [73, 10.4], [78, 10.6], [103, 9.5], [103, 70], [88, 71], [78, 74], [70, 79], [58, 82], [45, 81], [32, 80], [22, 72], [17, 63], [15, 58], [11.6, 55], [11.4, 50], [11, 48], [11, 43], [12.6, 39], [12.8, 35], [14, 34], [17.6, 31.6], [20.5, 28.6], [23.5, 26.5], [26.5, 24.6], [29.5, 22.2], [35.5, 20.6], [37.5, 18.4]]] },
    // Gazala, 26 May 1942 18:00: the Gazala Line from the coast to Bir Hakeim; Axis infantry facing it and the armour assembling to the south-west
    gazala: { side: 0, polys: [[[20, 0], [120, 0], [120, 85], [40, 85], [37, 75], [35.5, 62], [33, 50], [29.5, 41], [26.5, 34], [23.5, 26], [21, 19], [20.5, 11]]] },
    // Tutorial: Red holds the north bank of the Cane River; Blue holds the south bank and everything south of it round Camp Hollister
    tutorial: { side: 0, polys: [[[0, 17.6], [10, 16.8], [14, 16.6], [22, 16], [30, 16.6], [38, 17.4], [44, 16.6], [44, 32], [0, 32]]] },
  };
  const T = {
    // Market Garden: 9. SS was down to about 2,500 men in nineteen alarm companies (warhistory.org, II SS Panzer Corps at Arnhem); the 406. Division and
    // von Tettau's division were scratch formations of training, convalescent and depot troops (Pegasus Archive; GEN); KG Henke had about 750 older men
    // II SS Panzer Corps was down to about 6,500-7,000 men in all (warhistory.org); KG Henke at Nijmegen was about 750 mostly older men with flak batteries (weaponsandwarfare.com)
    marketgarden: { forms: [[/Spindler|SS-Pz.Gren.A.u.E/, { side: 1, mul: .75 }], [/Korps Feldt|von Tettau/, { side: 1, mul: .75 }], [/Kampfgruppe Reinhold|10\. SS-Panzer-Division|Kampfgruppe Brinkmann/, { side: 1, mul: .8 }], [/Kampfgruppe Henke/, { side: 1, mul: .55 }]] },
    // Gazala: Rommel's armour struck as a concentrated mass while Eighth Army committed its armoured brigades piecemeal
    gazala: { sides: [{ free: 96 }], forms: [[/Panzer|leichte|Ariete|Corazzata/, { side: 1, mul: 1.3, xp: 1.1 }], [/1st Free French Brigade/, { side: 0, mul: 1.3, stay: 1 }]] },   // Bir Hakeim held from 26 May to 10-11 June behind deep minefields
    // Sicily: the Italian coastal divisions largely dissolved on the first day
    sicily: { forms: [[/Costier/, { side: 1, mul: .8 }]] },
    // Bastogne: McAuliffe ran the defence from the division command post in the town (Cole ch. XIX); the 81st AA/AT and 326th Engineers were divisional troops there (GEN)
    // Cole ch. XIX: Roberts built Team SNAFU from stragglers and CCR 9th Armored remnants under Col. Gilbreth; the 705th TD arrived separately late on 19 Dec
    // the 101st and CCB 10th Armored kept a closed perimeter round the town and did not sortie to outlying villages
    // Panzer Lehr on 15 Dec 1944: only the reconnaissance battalion was at full strength (Wikipedia, Panzer Lehr Division)
    bastogne: { forms: [[/50[126](st|nd|th) Parachute|327th Glider|CCB, 10th Armored|Team SNAFU|CCR 9th/, { stay: 1 }], [/Panzer-Lehr|Kampfgruppe 901/, { side: 1, mul: .8 }],
      // 2. Panzer and the main body of Panzer Lehr drove west for the Meuse; they bypassed Bastogne and left the siege to the 26. VGD and KG 901 (Cole ch. XIX; warhistory.org)
      [/^2\. Panzer-Division|^Panzer-Lehr-Division/, { side: 1, stay: 1 }]],
      src: [{ stock: 1.6, rate: 1.4 }], addForms: [{ s: 0, nat: 'US', n: '101st Airborne Division (command post, Bastogne)', cmd: 'Brig. Gen. Anthony McAuliffe', ag: .4, sk: .9, xp: 1.2, x: 27.8, y: 24.3, dug: 1, stay: 1, hold: 1, line: [[27.4, 24], [28.4, 24.6]], sub: ['us_aaaw|81st Airborne AA/AT Bn', 'us_eng|326th Airborne Engineer Bn|.7'] }, { s: 0, nat: 'US', n: 'Team SNAFU (Bastogne garrison)', cmd: 'Col. Joseph H. Gilbreth', ag: .3, sk: .6, xp: .9, x: 28, y: 24, dug: 1, stay: 1, line: [[27.3, 23.5], [28.7, 24.5]], sub: ['us_inf|Team SNAFU (stragglers)|.8', 'us_tk_m4|CCR 9th Armored (remnants)|.35'] }], poolDrop: [['Team SNAFU', 'CCR 9th Armored (remnants)', '326th Airborne Engineer Bn']] },
    // Salerno: Fifth Army spent 9-12 September consolidating the beachhead; Eboli and the Sele corridor stayed German
    salerno: { sides: [{ free: 135 }], forms: [[/Hermann Goering|KG Stroh|29. Pz.Gren|26. Panzer/, { res: 1 }], [/./, { side: 1, mul: 1.55, xp: 1.15 }]] },
    // Falaise: XV Corps was held at Argentan from 13 August (Bradley's halt); the pocket closed only on 19-21 August
    falaise: { sides: [{ free: 160 }], src: [null, { rate: 2, stock: 1.4 }], forms: [[/5th Armored|2e DB|90th Div|79th Div/, { free: 170 }], [/./, { side: 1, mul: 2.0, xp: 1.1 }]] },
  };
  for (const sc of SCENARIOS) { // every side gets corps light flak in its support pool
    for (let s = 0; s < 2; s++) { const sd = sc.sides[s], q = (sd.sources || [])[0], nat = (sc.forms.find(f => f.s === s) || {}).nat; if (!q) continue; const k = s === 0 ? (nat === 'UK' ? 'uk_laa' : 'us_aaaw') : 'ge_flak20', n = s === 0 ? (nat === 'UK' ? 'Corps LAA Regt RA' : 'Corps AAA AW Bn') : nat === 'IT' ? 'Gruppo contraereo da 20mm' : 'Corps le. Flak-Abt'; sd.pool = (sd.pool || []).concat([{ k, n, x: q.x, y: q.y, t: 0 }]); } }
  for (const sc of SCENARIOS) if (FRONT[sc.id]) sc.front = FRONT[sc.id];
  for (const sc of SCENARIOS) { const t = T[sc.id]; if (!t) continue;
    if (t.sides) t.sides.forEach((o, s) => Object.assign(sc.sides[s], o || {}));
    if (t.vp) for (const [n, o] of t.vp) { const v = sc.vp.find(q => q[0] === n); if (v) Object.assign(v, o); }
    if (t.forms) for (const [re, o] of t.forms) for (const fs of sc.forms) if (re.test(fs.n) && (o.side == null || o.side === fs.s)) { if (o.free != null) fs.free = o.free; if (o.ag != null) fs.ag = o.ag; if (o.sk != null) fs.sk = o.sk; if (o.xp != null) fs.xp = o.xp; if (o.arr != null && fs.arr) fs.arr = Object.assign({}, fs.arr, o.arr); if (o.dug != null) fs.dug = o.dug; if (o.res != null) fs.res = o.res; if (o.hold != null) fs.hold = o.hold; if (o.stay != null) fs.stay = o.stay; if (o.add) fs.sub = fs.sub.concat(o.add); if (o.mul) fs.sub = fs.sub.map(q => { const a = q.split('|'); return a[0] + '|' + a[1] + '|' + ((a[2] ? +a[2] : 1) * o.mul).toFixed(2); }); }
    if (t.addForms) for (const o of t.addForms) sc.forms.push(Object.assign({}, o));
    if (t.poolDrop) t.poolDrop.forEach((o, s) => { if (o) sc.sides[s].pool = sc.sides[s].pool.filter(q => !o.includes(q.n)); });
    if (t.pool) t.pool.forEach((o, s) => { if (o) sc.sides[s].pool = (sc.sides[s].pool || []).concat(o); });
    if (t.src) t.src.forEach((o, s) => { if (o) for (const q of sc.sides[s].sources) Object.assign(q, { stock: q.stock * (o.stock || 1), rate: q.rate * (o.rate || 1) }); });
  }
  (typeof window !== 'undefined' ? window : globalThis).BAL = T;
})();
