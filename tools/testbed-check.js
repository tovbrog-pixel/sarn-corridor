// Smoke test of the testbed map in the engine: loads data/testbed through sarnMap, places one division per nation side
// near its capital, runs 24 game hours and reports terrain counts, bridges and any error.
// node tools/testbed-check.js
const E = require('./load-engine')(), sarnMap = require('./sarnmap');
const m = sarnMap({ set: 'testbed' }), M = sarnMap.load('testbed').map, city = n => M.cities.find(c => c.name === n);
const hist = {}; for (const v of m.raster.t) hist[v] = (hist[v] || 0) + 1;
const h = city('Halden'), k = city('Korograd');
const base = E.SCENARIOS.find(s => s.id === 'falaise');
const side = (n, c, s) => Object.assign({}, base.sides[s], { n, name: n, rear: s ? [1, 0] : [-1, 0], posture: s ? 'defend' : 'attack', assets: [], sources: [{ n: c.name + ' depot', x: c.x, y: c.y, stock: 300, rate: 12 }], pool: [], bases: [], transport: { aircraft: 0 }, groups: [] });
const sides = [side('Valdenmark', h, 0), side('Korovia', k, 1)];
const forms = [E.divForm({ tpl: 'vd_inf', s: 0, n: '1st Infantry Division', cmd: 'Gen. A', regs: ['1st', '2nd', '3rd'], x: h.x + 10, y: h.y }),
               E.divForm({ tpl: 'ko_inf', s: 1, n: '1st Rifle Division', cmd: 'Gen. B', regs: ['1st', '2nd', '3rd'], x: k.x - 10, y: k.y })];
const sc = Object.assign({ id: 'testbed', title: 'Testbed check', hours: 48, start: '1940-06-01T04:00', seed: 3, weather: Array(10).fill('clear'), sides, forms,
  vp: M.cities.map(c => [c.name, c.x, c.y, c.kind === 'capital' ? 20 : 5, c.nation === 'K' ? 1 : c.nation === 'V' || c.nation === 'O' ? 0 : -1]), src: [[], []] }, m);
const S = E.createSim(sc, -1, 3, {}); S.setup(); const t0 = Date.now(); for (let i = 0; i < 24; i++) S.advance(60);
console.log('testbed ' + m.w + ' x ' + m.h + ' km; cells by code ' + JSON.stringify(hist));
console.log('engine: bridges ' + S.map.bridges.length + ', towns ' + S.map.towns.length + ', units ' + S.subs.length + '; 24 h in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
console.log('nations ' + M.nations.map(n => n.name).join(', ') + '; airfields ' + M.airfields.length + '; sea zones ' + M.sea_zones.map(z => z.name).join(', ') + '; gauge breaks ' + M.gauge_breaks.length + '; frozen-river candidates ' + M.rivers.filter(r => r.freezes).map(r => r.name).join(', '));
