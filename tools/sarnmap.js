// Sarn Corridor terrain for the engine: reads data/terrain (1 km grid from tools/mapgen/gen.py) and data/map.json,
// and returns the map fields of a scenario (w, h, cs, raster, rivers, roads, rails, towns) for any window of the continent.
// Usage: const sarnMap = require('./sarnmap'); Object.assign(sc, sarnMap({ x0: 180, y0: 0, w: 820, h: 420 }));
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..', 'data');
let G = null;
function load() {
  if (G) return G;
  const d = path.join(ROOT, 'terrain'), grid = JSON.parse(fs.readFileSync(path.join(d, 'grid.json'), 'utf8'));
  const rd = (f, C) => { const b = zlib.gunzipSync(fs.readFileSync(path.join(d, f))); return new C(b.buffer, b.byteOffset, b.byteLength / C.BYTES_PER_ELEMENT); };
  G = { grid, t: rd('terrain.u8.gz', Uint8Array), el: rd('elev.i16.gz', Int16Array), map: JSON.parse(fs.readFileSync(path.join(ROOT, 'map.json'), 'utf8')) };
  return G;
}
function clipLine(pts, x0, y0, w, h) {
  const out = []; let cur = []; const inside = p => p[0] >= x0 && p[0] <= x0 + w && p[1] >= y0 && p[1] <= y0 + h;
  const cl = p => [+Math.max(0, Math.min(w, p[0] - x0)).toFixed(2), +Math.max(0, Math.min(h, p[1] - y0)).toFixed(2)];
  for (let i = 0; i < pts.length; i++) { const p = pts[i];
    if (inside(p)) cur.push(cl(p));
    else { if (cur.length) { cur.push(cl(p)); if (cur.length > 1) out.push(cur); cur = []; } else if (i + 1 < pts.length && inside(pts[i + 1])) cur.push(cl(p)); } }
  if (cur.length > 1) out.push(cur); return out;
}
// a road beside each railway, about 1 km off the track: main roads follow the rail corridors (game setting, inference)
function besideRail(pts) { return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [p[0] - dy / L * .9, p[1] + dx / L * .9]; }); }
function sarnMap(o) {
  const g = load(), GW = g.grid.w, GH = g.grid.h, M = g.map;
  const x0 = o.x0 || 0, y0 = o.y0 || 0, w = o.w || GW - x0, h = o.h || GH - y0, cs = o.cs || 1;
  const W = Math.round(w / cs), H = Math.round(h / cs), t = new Uint8Array(W * H), el = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const gi = Math.min(GW - 1, Math.floor(x0 + (i + .5) * cs)), gj = Math.min(GH - 1, Math.floor(y0 + (j + .5) * cs)), q = gj * GW + gi;
    t[j * W + i] = g.t[q]; el[j * W + i] = g.el[q]; }
  const out = { w: W * cs, h: H * cs, cs, realLines: true, raster: { w: W, h: H, t, el }, rivers: [], roads: [], rails: [], towns: [], sea: undefined, elev: undefined };
  for (const r of M.rivers) for (const p of clipLine(r.pts, x0, y0, w, h)) out.rivers.push([r.name, r.order >= 3 ? 1 : 2, p]);   // order 3-4 stops vehicles without a bridge
  for (const l of M.rail) { for (const p of clipLine(l.pts, x0, y0, w, h)) out.rails.push(p); for (const p of clipLine(besideRail(l.pts), x0, y0, w, h)) out.roads.push([3, p]); }
  for (const l of M.roads) for (const p of clipLine(l.pts, x0, y0, w, h)) out.roads.push([2, p]);
  for (const c of M.cities) if (c.x >= x0 && c.x <= x0 + w && c.y >= y0 && c.y <= y0 + h) out.towns.push([c.name, +(c.x - x0).toFixed(2), +(c.y - y0).toFixed(2), c.kind === 'capital' ? 3 : c.size]);
  return out;
}
sarnMap.load = load;
sarnMap.nation = id => load().map.nations.find(n => n.id === id);
sarnMap.city = n => load().map.cities.find(c => c.name === n);
module.exports = sarnMap;
if (require.main === module) { const m = sarnMap({ x0: 180, y0: 0, w: 820, h: 420 }), hist = {}; for (const v of m.raster.t) hist[v] = (hist[v] || 0) + 1;
  console.log(m.w + ' x ' + m.h + ' km; terrain ' + JSON.stringify(hist) + '; rivers ' + m.rivers.length + ', roads ' + m.roads.length + ', rail ' + m.rails.length + ', towns ' + m.towns.length); }
