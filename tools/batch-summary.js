// Summarises a batch of AI-vs-AI runs (tools/scenario-overlord.js result files) against the historical capture dates.
// node tools/batch-summary.js <dir with *.json> [out.md]
const fs = require('fs'), path = require('path');
const { MILESTONES } = require('./scenario-overlord');
const dir = process.argv[2], out = process.argv[3];
const runs = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const day = s => { const d = Date.parse(s.replace(/(\d+) (\w+) (\d+)/, '$1 $2 $3') + ' UTC'); return isNaN(d) ? null : d / 864e5; };
const iso = d => new Date(d * 864e5).toISOString().slice(5, 10);
const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };
const rows = MILESTONES.map(([n, h]) => { const H = Date.parse(h + 'T00:00Z') / 864e5, got = runs.map(r => { const q = r.held || r.took; return q && q[n] ? day(q[n]) : null; }).filter(v => v != null);
  const m = med(got); return { n, h: h.slice(5), taken: got.length, med: m != null ? iso(m) : '-', early: m != null ? Math.round(H - m) : null, min: got.length ? iso(Math.min(...got)) : '-', max: got.length ? iso(Math.max(...got)) : '-' }; });
const L = runs.map(r => r.losses), lossMed = [0, 1].map(s => med(L.map(l => l[s])));
let md = '# AI-vs-AI batch, ' + runs.length + ' runs of ' + (runs[0] ? runs[0].hours : '?') + ' game hours\n\nAuthor: Tov Binyamin Brog. Built by `tools/batch-summary.js` from `tools/scenario-overlord.js` runs.\n\n';
md += '| Objective | Historical | Runs holding it at the end | Median date held from | Days early (+) or late (-) | Earliest | Latest |\n| --- | --- | --- | --- | --- | --- | --- |\n';
for (const r of rows) md += '| ' + [r.n, r.h, r.taken + ' of ' + runs.length, r.med, r.early == null ? '-' : (r.early > 0 ? '+' : '') + r.early, r.min, r.max].join(' | ') + ' |\n';
md += '\nMedian losses in battalion-equivalents: Allied ' + Math.round(lossMed[0] || 0) + ', German ' + Math.round(lossMed[1] || 0) + '.\n\nHistorical dates are general history, to verify against Blumenson and Ellis.\n';
if (out) fs.writeFileSync(out, md); console.log(md);
