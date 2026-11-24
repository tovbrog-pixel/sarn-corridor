// Summarises a batch of AI-vs-AI corridor runs (tools/scenario-corridor.js result files).
// node tools/batch-summary.js <dir of run-*.json> <out.md>
const fs = require('fs'), path = require('path');
const dir = process.argv[2], out = process.argv[3];
const runs = fs.readdirSync(dir).filter(f => /^run-\d+\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).sort((a, b) => a.seed - b.seed);
const wins = runs.filter(r => r.corridor).length, count = {};
for (const r of runs) for (const n of r.held) count[n] = (count[n] || 0) + 1;
let md = '# AI-vs-AI batch, ' + runs.length + ' runs of ' + (runs[0] ? runs[0].hours : '?') + ' game hours\n\nAuthor: Tov Binyamin Brog. Built by `tools/batch-summary.js` from `tools/scenario-corridor.js` runs.\n\n';
md += '**Corridor taken by Valdenmark:** ' + wins + ' of ' + runs.length + ' runs.\n\n| Objective | Held by Valdenmark at the end (runs) |\n| --- | --- |\n';
for (const [n, c] of Object.entries(count).sort((a, b) => b[1] - a[1])) md += '| ' + n + ' | ' + c + ' |\n';
md += '\n| Seed | Variant | Corridor | Losses V / S+K (battalion-equivalents) |\n| --- | --- | --- | --- |\n';
for (const r of runs) md += '| ' + r.seed + ' | ' + (r.variantName || '') + ' | ' + (r.corridor ? 'taken' : 'held') + ' | ' + r.losses.map(v => v.toFixed(1)).join(' / ') + ' |\n';
fs.writeFileSync(out, md); console.log(md);
