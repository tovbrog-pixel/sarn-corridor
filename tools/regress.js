// Regression check: runs each scenario AI-vs-AI with a fixed seed and fingerprints the end state.
// node tools/regress.js record   -> writes tools/regress-baseline.json
// node tools/regress.js          -> compares against the baseline
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { createSim, SCENARIOS } = require('./load-engine')();
const HOURS = 48, SEED = 12345, base = path.join(__dirname, 'regress-baseline.json');
const out = {};
for (const sc of SCENARIOS) {
  const S = createSim(sc, -1, SEED, {}); S.setup(); let g = 0; const t0 = Date.now();
  while (!S.over && g < HOURS * 60) { S.advance(60); g += 60; }
  const state = S.subs.map(u => [u.id, u.dead ? 1 : 0, u.x.toFixed(3), u.y.toFixed(3), u.str.toFixed(4), u.coh.toFixed(4)].join(',')).join(';')
    + '|' + S.losses.map(v => v.toFixed(3)).join(',') + '|' + S.vp.map(v => v.own).join(',');
  out[sc.id] = crypto.createHash('sha1').update(state).digest('hex').slice(0, 16);
  console.log(sc.id.padEnd(13), out[sc.id], ((Date.now() - t0) / 1000).toFixed(1) + ' s');
}
if (process.argv[2] === 'record') { fs.writeFileSync(base, JSON.stringify(out, null, 1)); console.log('baseline recorded'); }
else { const b = JSON.parse(fs.readFileSync(base, 'utf8')); let ok = true; for (const k in b) if (b[k] !== out[k]) { ok = false; console.log('CHANGED: ' + k); } console.log(ok ? 'all scenarios match the baseline' : 'RESULTS CHANGED'); process.exitCode = ok ? 0 : 1; }
