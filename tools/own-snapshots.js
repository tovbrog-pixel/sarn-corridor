// Writes pictures of held ground and division positions at set days, for checking how the front moves.
// node tools/own-snapshots.js <outDir> [seed] [days, comma-separated]
const E = require('./load-engine')(), mk = require('./scenario-corridor'), fs = require('fs'), path = require('path');
const out = process.argv[2] || '/tmp/own', seed = +(process.argv[3] || 1), days = (process.argv[4] || '2,4,7,10,14').split(',').map(Number);
fs.mkdirSync(out, { recursive: true });
const sc = mk(), S = E.createSim(sc, -1, seed, {}); S.setup();
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
for (const F of S.forms) if (F.s === 0 && F.subs[0] && !sc.front.polys.some(p => inPoly(F.subs[0].x, F.subs[0].y, p))) console.log('start outside Valdenmark ground: ' + F.n);
let h = 0;
for (const d of days) { S.advance((d * 24 - h) * 60); h = d * 24;
  const O = S.own, W = O.gw, H = O.gh, buf = Buffer.alloc(W * H * 3), t = S.map.t;
  for (let c = 0; c < W * H; c++) { const sea = t[Math.min(S.map.N - 1, c)] === 12, o = O.a[c]; const col = sea ? [150, 180, 205] : o === 0 ? [120, 150, 200] : [225, 185, 150]; buf[c * 3] = col[0]; buf[c * 3 + 1] = col[1]; buf[c * 3 + 2] = col[2]; }
  for (const u of S.subs) if (u.active && !u.dead) { const i = Math.round(u.x), j = Math.round(u.y); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const o = (jj * W + ii) * 3, col = u.s ? [170, 20, 20] : [10, 30, 120]; buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2]; } }
  for (const v of S.vp) { const i = Math.round(v.x), j = Math.round(v.y); for (let a = -3; a <= 3; a++) { for (const [ii, jj] of [[i + a, j], [i, j + a]]) { if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const o = (jj * W + ii) * 3; buf[o] = 255; buf[o + 1] = 230; buf[o + 2] = 0; } } }
  fs.writeFileSync(path.join(out, 'day' + String(d).padStart(2, '0') + '.ppm'), Buffer.concat([Buffer.from('P6 ' + W + ' ' + H + ' 255\n'), buf]));
  console.log('day ' + d + ': Valdenmark holds ' + S.vp.filter(v => v.own === 0).map(v => v.n).join(', ')); }
