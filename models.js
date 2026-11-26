// ===== 3D MODELS (procedural, metres; X forward, Y up, Z right) =====
const MS = 0.02; // world km per model metre (20x exaggeration so units read from command height)
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _c = new THREE.Color();
function mat(x, y, z, rx, ry, rz, sx, sy, sz) { _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); return new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), _q.clone(), new THREE.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz)); }
class GB {
  constructor() { this.p = []; this.c = []; }
  add(g, col, m) { const ng = g.index ? g.toNonIndexed() : g, a = ng.attributes.position; _c.set(col); for (let i = 0; i < a.count; i++) { _v.fromBufferAttribute(a, i); if (m) _v.applyMatrix4(m); this.p.push(_v.x, _v.y, _v.z); this.c.push(_c.r, _c.g, _c.b); } return this; }
  box(l, h, w, col, x, y, z, rx, ry, rz) { return this.add(new THREE.BoxGeometry(l, h, w), col, mat(x, y, z, rx, ry, rz)); }
  cyl(r1, r2, len, col, x, y, z, axis, seg, rx, ry, rz) { const g = new THREE.CylinderGeometry(r1, r2, len, seg || 8); if (axis === 'x') g.rotateZ(-Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2); return this.add(g, col, mat(x, y, z, rx, ry, rz)); }
  sph(r, col, x, y, z, sx, sy, sz, seg) { return this.add(new THREE.SphereGeometry(r, seg || 8, seg ? seg - 2 : 6), col, mat(x, y, z, 0, 0, 0, sx, sy, sz)); }
  merge(o, m) { for (let i = 0; i < o.p.length; i += 3) { _v.set(o.p[i], o.p[i + 1], o.p[i + 2]); if (m) _v.applyMatrix4(m); this.p.push(_v.x, _v.y, _v.z); } for (const c of o.c) this.c.push(c); return this; }
  build() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.computeVertexNormals(); return g; }
}
const COL = { US: 0x4d5433, UKG: 0x4c5637, UKD: 0xb9a779, GET: 0x9c8d5c, GED: 0xb89c64, GEG: 0x596062, TRK: 0x262624, WHL: 0x30312b, GUN: 0x34373a, CANV_US: 0x6f6e4c, CANV_GE: 0x7a7767, CANV_UK: 0x756c4a, TYRE: 0x1c1c1b, WOOD: 0x6a5237 };

// ---------- soldiers ----------
function buildSoldier(nat) {
  const uni = nat === 'US' ? 0x5c6038 : nat === 'UK' ? 0x8a7a4d : nat === 'IT' ? 0x8f8c66 : 0x5a655f, hel = nat === 'US' ? 0x49502f : nat === 'UK' ? 0x6c6a43 : nat === 'IT' ? 0x767a58 : 0x3d4543, web = nat === 'GE' ? 0x2c2a26 : nat === 'IT' ? 0x5a4630 : 0x9b9066, skin = 0xc79a78;
  const b = new GB();
  b.box(.24, .58, .42, uni, 0, 1.2, 0); b.box(.2, .12, .36, uni, 0, .9, 0);                       // torso, hips
  b.box(.05, .5, .06, web, .1, 1.22, .1, 0, 0, .35); b.box(.05, .5, .06, web, .1, 1.22, -.1, 0, 0, -.35); // webbing
  b.box(.16, .32, .3, nat === 'GE' ? 0x4a4a3c : 0x6e6a44, -.2, 1.25, 0);                             // pack
  b.sph(.115, skin, .01, 1.63, 0); b.box(.06, .1, .12, uni, 0, 1.5, 0);
  if (nat === 'UK') { b.cyl(.2, .2, .03, hel, 0, 1.71, 0, 'y', 12); b.sph(.12, hel, 0, 1.71, 0, 1, .55, 1); }
  else if (nat === 'GE') { b.sph(.135, hel, 0, 1.68, 0, 1.05, .85, 1.05); b.cyl(.15, .165, .08, hel, -.02, 1.62, 0, 'y', 10); }
  else { b.sph(.14, hel, 0, 1.68, 0, 1.05, .8, 1); }
  b.box(.12, .34, .1, uni, .06, 1.28, .26, 0, 0, .5); b.box(.3, .09, .09, uni, .24, 1.16, .2, 0, .4, 0);   // right arm to rifle
  b.box(.12, .34, .1, uni, .06, 1.28, -.26, 0, 0, .5); b.box(.3, .09, .09, uni, .28, 1.2, -.14, 0, -.5, 0); // left arm
  b.box(.95, .05, .05, COL.WOOD, .3, 1.2, .05, 0, 0, .18); b.box(.45, .03, .03, COL.GUN, .82, 1.3, .05, 0, 0, .18); // rifle
  const l = new GB(); l.box(.15, .5, .16, uni, 0, -.25, 0); l.box(.14, .4, .14, nat === 'GE' ? 0x23221f : uni, 0, -.68, 0); l.box(.26, .09, .13, 0x221f1b, .05, -.87, 0);
  return { body: b.build(), leg: l.build() };
}

// ---------- tracked vehicles ----------
function buildTank(p) {
  const h = new GB(), col = p.col, c2 = p.c2 || col, tw = p.W * .19, th = p.th || p.H * .52, zc = p.W / 2 - tw / 2, n = p.n || 6;
  for (const s of [-1, 1]) {
    h.box(p.L * .9, th * .5, tw, COL.TRK, 0, th * .55, s * zc); h.cyl(th * .32, th * .32, tw, COL.TRK, p.L * .45, th * .62, s * zc, 'z', 8); h.cyl(th * .32, th * .32, tw, COL.TRK, -p.L * .45, th * .62, s * zc, 'z', 8);
    const wr = p.wr || th * .3; for (let i = 0; i < n; i++) { const x = -p.L * .38 + i * (p.L * .76 / (n - 1)); h.cyl(wr, wr, tw * .9, COL.WHL, x, wr + .02, s * zc, 'z', 8); h.cyl(wr * .4, wr * .4, tw * .95, col, x, wr + .02, s * (zc + .01), 'z', 6); }
    h.box(p.L * .96, .05, tw * 1.12, col, 0, th + .03, s * zc);
    if (p.skirts) for (let i = 0; i < 4; i++) h.box(p.L * .19, th * .62, .035, c2, -p.L * .3 + i * p.L * .2, th * .78, s * (p.W / 2 + .06));
  }
  const hw = p.W - 2 * tw + .12, hb = th * .35, hh = p.H - hb;
  h.box(p.L * .78, hh, hw, col, -p.L * .03, hb + hh / 2, 0);
  h.box(p.L * .26, .09, hw, col, p.L * .4, hb + hh * .68, 0, 0, 0, -(p.slope || .75));      // glacis
  h.box(p.L * .16, hh * .5, hw, col, p.L * .41, hb + hh * .3, 0, 0, 0, .5);                // lower bow
  h.box(p.L * .22, .05, hw * .78, 0x2f302c, -p.L * .3, p.H + .03, 0);                      // engine deck
  h.box(.5, .22, .3, c2, -p.L * .42, p.H + .12, hw * .3); h.cyl(.07, .07, .7, 0x3a2f28, -p.L * .46, p.H * .7, -hw * .3, 'z', 6);
  if (p.cas) { const c = p.cas; h.box(c.l, c.h, hw * (c.w || .96), col, c.x, p.H + c.h / 2, 0); h.box(c.l * .32, c.h * 1.1, hw * (c.w || .96), col, c.x + c.l * .5, p.H + c.h * .42, 0, 0, 0, -.5); if (c.open) h.box(c.l * .8, .05, hw * .8, 0x1d1d1a, c.x, p.H + c.h + .01, 0); const g = p.gun; h.cyl(g.cal * 1.6, g.cal * 2.2, .5, col, c.x + c.l * .55, p.H + c.h * (g.y || .45), g.z || 0, 'x', 8); h.cyl(g.cal, g.cal, g.len, COL.GUN, c.x + c.l * .6 + g.len / 2, p.H + c.h * (g.y || .45) + (g.el || 0) * g.len * .5, g.z || 0, 'x', 6, 0, 0, g.el || 0); if (g.brake) h.cyl(g.cal * 1.7, g.cal * 1.7, .3, COL.GUN, c.x + c.l * .6 + g.len, p.H + c.h * (g.y || .45), g.z || 0, 'x', 6); }
  if (p.spon) { h.box(1.3, .6, .7, col, p.L * .2, p.H - .25, hw * .42); h.cyl(.05, .05, 1.2, COL.GUN, p.L * .2 + 1.1, p.H - .25, hw * .42, 'x', 6); }
  if (p.star) { h.add(new THREE.CircleGeometry(.34, 5), 0xe8e6da, mat(p.L * .2, p.H + .07, 0, -Math.PI / 2)); }
  let t = null;
  if (p.tur) {
    t = new GB(); const u = p.tur, g = p.gun;
    if (u.box) { t.box(u.l, u.h, u.w, col, u.o || 0, u.h / 2, 0); t.box(u.l * .3, u.h * .9, u.w * .8, col, (u.o || 0) + u.l * .52, u.h * .48, 0, 0, 0, -.25); if (u.bin) t.box(.5, u.h * .6, u.w * .7, c2, (u.o || 0) - u.l / 2 - .25, u.h * .5, 0); }
    else { t.cyl(u.r * .86, u.r, u.h, col, u.o || 0, u.h / 2, 0, 'y', 12); if (u.bustle) t.box(u.r * .9, u.h * .7, u.r * 1.3, col, (u.o || 0) - u.r * .9, u.h * .55, 0); }
    if (u.open) t.cyl(u.box ? u.w * .36 : u.r * .66, u.box ? u.w * .36 : u.r * .66, .04, 0x1b1b19, u.o || 0, u.h + .01, 0, 'y', 10);
    else { t.cyl(.26, .28, .2, col, (u.o || 0) - .25, u.h + .1, u.box ? -u.w * .22 : -u.r * .35, 'y', 8); t.box(.42, .04, .42, c2, (u.o || 0) + .2, u.h + .03, u.box ? u.w * .2 : u.r * .3); }
    const gx = (u.box ? u.l / 2 + (u.o || 0) : u.r * .9), gy = u.h * .5;
    t.box(.35, u.h * .62, (u.box ? u.w : u.r * 2) * .5, c2, gx + .05, gy, 0);
    t.cyl(g.cal, g.cal * 1.15, g.len, COL.GUN, gx + .15 + g.len / 2, gy, 0, 'x', 6); if (g.brake) t.cyl(g.cal * 1.8, g.cal * 1.8, .32, COL.GUN, gx + .15 + g.len - .1, gy, 0, 'x', 6);
    if (p.cross) for (const s of [-1, 1]) { t.box(.5, .12, .02, 0x151515, (u.o || 0) - .1, u.h * .5, s * ((u.box ? u.w / 2 : u.r * .93) + .01)); t.box(.12, .5, .02, 0x151515, (u.o || 0) - .1, u.h * .5, s * ((u.box ? u.w / 2 : u.r * .93) + .01)); }
    if (p.star) for (const s of [-1, 1]) t.add(new THREE.CircleGeometry(.22, 5), 0xe8e6da, mat(u.o || 0, u.h * .5, s * ((u.box ? u.w / 2 : u.r * .94) + .02), 0, s > 0 ? 0 : Math.PI, 0));
  }
  return { hull: h.build(), tur: t && t.build(), tx: p.tur ? p.tur.x : 0, ty: p.H, len: p.L, gl: p.gun ? p.gun.len + (p.tur ? (p.tur.box ? p.tur.l / 2 : p.tur.r) : 1.5) : 2 };
}
function wheels(h, xs, W, r, col) { for (const x of xs) for (const s of [-1, 1]) { h.cyl(r, r, .26, COL.TYRE, x, r, s * (W / 2 - .13), 'z', 10); h.cyl(r * .5, r * .5, .28, col, x, r, s * (W / 2 - .13), 'z', 6); } }
function buildHalftrack(p) {
  const h = new GB(), col = p.col, W = p.W, L = p.L;
  wheels(h, [L * .36], W, .42, col);
  for (const s of [-1, 1]) { h.box(L * .42, .32, .3, COL.TRK, -L * .2, .4, s * (W / 2 - .15)); for (let i = 0; i < 4; i++) h.cyl(.2, .2, .28, COL.WHL, -L * .38 + i * L * .12, .26, s * (W / 2 - .15), 'z', 8); }
  h.box(L * .28, .5, W * .62, col, L * .34, .95, 0); h.box(L * .1, .4, W * .7, col, L * .47, .8, 0, 0, 0, .2);                 // hood
  if (p.sloped) { h.box(L * .6, .75, W * .9, col, -L * .12, 1.15, 0); h.box(L * .58, .5, .06, col, -L * .12, 1.7, W * .4, .35); h.box(L * .58, .5, .06, col, -L * .12, 1.7, -W * .4, -.35); h.box(L * .52, .04, W * .6, 0x1c1c1a, -L * .12, 1.56, 0); }
  else { h.box(L * .58, .25, W * .92, col, -L * .14, .85, 0); for (const s of [-1, 1]) h.box(L * .58, .6, .05, col, -L * .14, 1.3, s * W * .45); h.box(.05, .6, W * .9, col, -L * .43, 1.3, 0); h.box(.06, .75, W * .9, col, L * .16, 1.35, 0); h.box(L * .5, .04, W * .8, 0x1e1e1b, -L * .14, 1.0, 0); }
  if (p.gun) { h.box(.08, .9, 1.5, col, L * .05, 1.75, 0); h.cyl(.045, .05, 2.0, COL.GUN, L * .05 + 1.0, 1.75, 0, 'x', 6); }
  else h.cyl(.03, .03, .9, COL.GUN, L * .2, 1.8, 0, 'x', 5);
  if (p.star) h.add(new THREE.CircleGeometry(.3, 5), 0xe8e6da, mat(L * .34, 1.21, 0, -Math.PI / 2));
  return { hull: h.build(), tur: null, len: L };
}
function buildCarrier(col) { const h = new GB(); for (const s of [-1, 1]) { h.box(3.5, .4, .3, COL.TRK, 0, .35, s * .9); for (let i = 0; i < 3; i++) h.cyl(.22, .22, .28, COL.WHL, -1.1 + i * 1.1, .27, s * .9, 'z', 8); } h.box(3.6, .5, 1.6, col, 0, .8, 0); for (const s of [-1, 1]) h.box(3.4, .4, .05, col, 0, 1.2, s * .95); h.box(.08, .5, 1.9, col, 1.7, 1.2, 0, 0, 0, -.3); h.box(2.6, .04, 1.5, 0x1e1e1b, -.2, 1.07, 0); h.cyl(.03, .03, .8, COL.GUN, 1.9, 1.35, .4, 'x', 5); return { hull: h.build(), tur: null, len: 3.7 }; }
function buildTruck(p) {
  const h = new GB(), col = p.col, L = p.L, W = p.W;
  wheels(h, p.six ? [L * .36, -L * .2, -L * .36] : [L * .34, -L * .3], W, .45, col);
  h.box(L * .9, .18, W * .5, 0x2b2b27, 0, .62, 0);
  if (p.cabover) h.box(L * .24, 1.3, W * .92, col, L * .36, 1.35, 0); else { h.box(L * .22, .6, W * .6, col, L * .38, 1.0, 0); h.box(L * .17, 1.15, W * .9, col, L * .18, 1.3, 0); h.box(.03, .4, W * .7, 0x9fb0b4, L * .27, 1.6, 0); }
  h.box(L * .58, .16, W, col, -L * .2, .82, 0); for (const s of [-1, 1]) h.box(L * .58, .45, .05, col, -L * .2, 1.1, s * W * .49);
  h.box(L * .56, .75, W * .96, p.canv, -L * .2, 1.65, 0); h.cyl(W * .48, W * .48, L * .56, p.canv, -L * .2, 2.0, 0, 'x', 8, 0, 0, 0);
  return { hull: h.build(), tur: null, len: L };
}
function buildCar(p) { const h = new GB(), col = p.col; wheels(h, [1.05, -1.05], 1.6, .36, col); h.box(3.3, .5, 1.5, col, 0, .75, 0); h.box(1.0, .25, 1.4, col, 1.1, 1.05, 0); h.box(.04, .45, 1.4, 0x9fb0b4, .55, 1.3, 0, 0, 0, -.2); h.box(1.6, .04, 1.3, 0x22211e, -.45, 1.01, 0); h.box(.5, .35, 1.2, 0x3a3830, -.3, 1.15, 0); if (p.spare) h.cyl(.34, .34, .2, COL.TYRE, 1.25, 1.2, 0, 'y', 10, 0, 0, .4); else h.cyl(.34, .34, .2, COL.TYRE, -1.75, .9, 0, 'x', 10); return { hull: h.build(), tur: null, len: 3.4 }; }
function buildArmCar(p) {
  const h = new GB(), col = p.col, L = p.L, W = p.W; const xs = []; for (let i = 0; i < p.ax; i++) xs.push(-L * .36 + i * (L * .72 / (p.ax - 1))); wheels(h, xs, W, .48, col);
  h.box(L * .9, .7, W * .7, col, 0, 1.15, 0); h.box(L * .25, .08, W * .7, col, L * .38, 1.3, 0, 0, 0, -.6); h.box(L * .25, .08, W * .7, col, -L * .38, 1.3, 0, 0, 0, .6); for (const s of [-1, 1]) h.box(L * .8, .06, .3, col, 0, 1.0, s * W * .42);
  const t = new GB(); t.cyl(.62, .75, .6, col, 0, .3, 0, 'y', 8); t.cyl(.035, .04, p.g, COL.GUN, .6 + p.g / 2, .32, 0, 'x', 6); if (p.open) t.cyl(.5, .5, .03, 0x1b1b19, 0, .61, 0, 'y', 8);
  if (p.cross) for (const s of [-1, 1]) { h.box(.4, .1, .02, 0x151515, 0, 1.2, s * (W * .35 + .01)); h.box(.1, .4, .02, 0x151515, 0, 1.2, s * (W * .35 + .01)); }
  return { hull: h.build(), tur: t.build(), tx: p.tx || 0, ty: 1.5, len: L, gl: p.g + .6 };
}
function buildVehicles(theme) {
  const ge = theme === 'desert' ? COL.GED : COL.GET, ge2 = theme === 'desert' ? 0xa88c58 : 0x6b7048, uk = theme === 'desert' ? COL.UKD : COL.UKG, us = COL.US, V = {};
  V.sherman = buildTank({ L: 5.9, W: 2.65, H: 1.75, n: 6, col: us, star: 1, slope: .95, tur: { x: .35, r: 1.0, h: .78, bustle: 1 }, gun: { len: 2.0, cal: .06 } });
  V.sherman76 = buildTank({ L: 6.1, W: 2.7, H: 1.75, n: 6, col: us, star: 1, slope: .85, tur: { x: .35, r: 1.08, h: .8, bustle: 1 }, gun: { len: 3.3, cal: .06, brake: 1 } });
  V.firefly = buildTank({ L: 6.0, W: 2.65, H: 1.75, n: 6, col: COL.UKG, slope: .95, tur: { x: .35, r: 1.0, h: .78, bustle: 1 }, gun: { len: 3.9, cal: .065, brake: 1 } });
  V.stuart = buildTank({ L: 4.5, W: 2.3, H: 1.5, n: 4, col: us, star: 1, tur: { x: .1, r: .72, h: .6 }, gun: { len: 1.1, cal: .035 } });
  V.lee = buildTank({ L: 5.6, W: 2.7, H: 2.1, n: 6, col: us, star: 1, spon: 1, slope: .5, tur: { x: 0, r: .72, h: .6 }, gun: { len: 1.0, cal: .035 } });
  V.m10 = buildTank({ L: 5.9, W: 3.0, H: 1.55, n: 6, col: us, star: 1, slope: .9, tur: { x: .2, box: 1, l: 2.2, w: 2.0, h: .75, open: 1 }, gun: { len: 3.0, cal: .06 } });
  V.m18 = buildTank({ L: 5.3, W: 2.8, H: 1.35, n: 5, col: us, star: 1, tur: { x: .1, box: 1, l: 2.1, w: 1.9, h: .75, open: 1 }, gun: { len: 3.3, cal: .055, brake: 1 } });
  V.priest = buildTank({ L: 5.9, W: 2.8, H: 1.5, n: 6, col: us, star: 1, cas: { l: 3.0, h: .7, x: 0, open: 1 }, gun: { len: 1.7, cal: .08, y: .9, el: .3, z: .3 } });
  V.sexton = buildTank({ L: 5.9, W: 2.7, H: 1.5, n: 6, col: COL.UKG, cas: { l: 3.0, h: .7, x: 0, open: 1 }, gun: { len: 1.9, cal: .07, y: .9, el: .3, brake: 1 } });
  V.cromwell = buildTank({ L: 6.3, W: 2.9, H: 1.5, n: 5, wr: .4, col: COL.UKG, slope: .15, tur: { x: .4, box: 1, l: 2.0, w: 1.9, h: .75 }, gun: { len: 2.0, cal: .06, brake: 1 } });
  V.valentine = buildTank({ L: 5.4, W: 2.6, H: 1.4, n: 6, col: uk, tur: { x: .2, r: .8, h: .6 }, gun: { len: 1.2, cal: .035 } });
  V.crusader = buildTank({ L: 6.0, W: 2.6, H: 1.3, n: 5, wr: .4, col: uk, tur: { x: .3, box: 1, l: 1.9, w: 1.7, h: .6 }, gun: { len: 1.6, cal: .045 } });
  V.pz3 = buildTank({ L: 5.5, W: 2.9, H: 1.5, n: 6, col: ge, cross: 1, slope: .3, tur: { x: .2, box: 1, l: 1.9, w: 1.8, h: .7, bin: 1 }, gun: { len: 2.1, cal: .045 } });
  V.pz4 = buildTank({ L: 5.9, W: 2.9, H: 1.6, n: 8, wr: .22, col: ge, c2: ge2, cross: 1, slope: .25, skirts: theme !== 'desert', tur: { x: .2, box: 1, l: 2.2, w: 1.9, h: .75, bin: 1 }, gun: { len: 2.9, cal: .055, brake: 1 } });
  V.panther = buildTank({ L: 6.9, W: 3.3, H: 1.8, n: 8, wr: .43, col: ge, c2: ge2, cross: 1, slope: 1.0, tur: { x: .1, box: 1, l: 2.5, w: 2.0, h: .85 }, gun: { len: 4.5, cal: .06, brake: 1 } });
  V.tiger = buildTank({ L: 6.3, W: 3.6, H: 1.8, n: 8, wr: .43, col: ge, cross: 1, slope: .1, tur: { x: .1, r: 1.28, h: .85, bustle: 1 }, gun: { len: 4.0, cal: .075, brake: 1 } });
  V.ktiger = buildTank({ L: 7.3, W: 3.7, H: 1.95, n: 9, wr: .43, col: ge, c2: ge2, cross: 1, slope: 1.0, tur: { x: 0, box: 1, l: 3.3, w: 2.0, h: .9 }, gun: { len: 5.6, cal: .075, brake: 1 } });
  V.stug = buildTank({ L: 5.5, W: 2.9, H: 1.25, n: 6, col: ge, c2: ge2, skirts: theme !== 'desert', cas: { l: 2.5, h: .75, x: .2 }, gun: { len: 2.6, cal: .055, brake: 1, z: .25 } });
  V.jpz4 = buildTank({ L: 5.9, W: 2.9, H: 1.15, n: 8, wr: .22, col: ge, c2: ge2, cas: { l: 3.0, h: .7, x: .5 }, gun: { len: 3.2, cal: .055 } });
  V.jagdpanther = buildTank({ L: 6.9, W: 3.3, H: 1.6, n: 8, wr: .43, col: ge, c2: ge2, slope: 1.0, cas: { l: 3.6, h: 1.0, x: .7 }, gun: { len: 5.0, cal: .075, brake: 1 } });
  V.wespe = buildTank({ L: 4.8, W: 2.3, H: 1.35, n: 5, wr: .32, col: ge, cas: { l: 2.2, h: .9, x: -1.0, open: 1 }, gun: { len: 2.0, cal: .07, y: .8, el: .3, brake: 1 } });
  const it = 0xb39f6c;
  V.grant = buildTank({ L: 5.6, W: 2.7, H: 2.1, n: 6, col: uk, spon: 1, slope: .5, tur: { x: 0, r: .9, h: .6 }, gun: { len: 1.0, cal: .035 } });
  V.honey = buildTank({ L: 4.5, W: 2.3, H: 1.6, n: 4, col: uk, tur: { x: .1, r: .72, h: .6 }, gun: { len: 1.1, cal: .035 } });
  V.matilda = buildTank({ L: 5.6, W: 2.6, H: 1.5, n: 8, wr: .2, col: uk, skirts: 1, slope: .3, tur: { x: .2, r: .8, h: .65 }, gun: { len: 1.2, cal: .035 } });
  V.m14 = buildTank({ L: 4.9, W: 2.2, H: 1.5, n: 8, wr: .2, col: it, slope: .3, tur: { x: .2, r: .68, h: .6 }, gun: { len: 1.1, cal: .04 } });
  V.semo = buildTank({ L: 4.9, W: 2.2, H: 1.2, n: 8, wr: .2, col: it, cas: { l: 2.4, h: .6, x: .3 }, gun: { len: .9, cal: .07 } });
  V.ab41 = buildArmCar({ L: 5.2, W: 1.9, ax: 2, col: it, g: 1.0 });
  V.truck_it = buildTruck({ L: 6.4, W: 2.3, col: it, canv: 0xc4b58a, cabover: 1 }); V.car_it = buildCar({ col: it, spare: 1 });
  V.m3ht = buildHalftrack({ L: 6.2, W: 2.2, col: us, star: 1 }); V.m3gmc = buildHalftrack({ L: 6.2, W: 2.2, col: us, star: 1, gun: 1 }); V.sdkfz251 = buildHalftrack({ L: 5.8, W: 2.1, col: ge, sloped: 1 });
  V.carrier = buildCarrier(uk);
  V.truck_us = buildTruck({ L: 6.5, W: 2.3, col: us, canv: COL.CANV_US, six: 1 }); V.truck_uk = buildTruck({ L: 6.0, W: 2.3, col: uk, canv: theme === 'desert' ? 0xc2b48c : COL.CANV_UK, cabover: 1 }); V.truck_ge = buildTruck({ L: 6.0, W: 2.2, col: theme === 'desert' ? ge : COL.GEG, canv: COL.CANV_GE });
  V.jeep = buildCar({ col: us }); V.kubel = buildCar({ col: ge, spare: 1 });
  V.m8 = buildArmCar({ L: 5.0, W: 2.5, ax: 3, col: us, g: 1.2, open: 1 }); V.daimler = buildArmCar({ L: 4.0, W: 2.4, ax: 2, col: uk, g: 1.1 }); V.sdkfz234 = buildArmCar({ L: 6.0, W: 2.3, ax: 4, col: ge, g: 1.6, cross: 1, tx: .3 });
  // generic burnt wreck
  const w = new GB(); w.box(5.2, 1.0, 2.5, 0x1d1b19, 0, .7, 0); w.box(2.0, .6, 1.8, 0x23201c, .3, 1.5, 0, 0, .5, .08); w.cyl(.06, .06, 2.4, 0x181716, 1.6, 1.5, .7, 'x', 5, 0, .5, -.12); w.box(5.4, .35, .5, 0x151413, 0, .3, 1.2); w.box(4.6, .35, .5, 0x151413, -.3, .3, -1.25, 0, .06, 0); V.wreck = { hull: w.build(), len: 5.5 };
  const w2 = new GB(); w2.box(5.5, .5, 2.1, 0x1c1a18, 0, .75, 0); w2.box(1.4, .9, 2.0, 0x211e1b, 1.6, 1.3, 0, 0, 0, .1); for (let i = 0; i < 4; i++) w2.box(.08, 1.0, 2.0, 0x161514, -2.2 + i * .9, 1.5, 0, 0, 0, .15 * i); V.wreckT = { hull: w2.build(), len: 5.5 };
  return V;
}

// ---------- guns ----------
function buildGun(p) {
  const g = new GB(), col = p.col;
  if (p.type === 'mortar') { g.cyl(.06, .06, 1.3, COL.GUN, .2, .6, 0, 'x', 6, 0, 0, 1.1); g.cyl(.35, .35, .05, COL.GUN, -.1, .03, 0, 'y', 8); g.box(.04, .9, .04, COL.GUN, .5, .45, .25, .3, 0, -.2); g.box(.04, .9, .04, COL.GUN, .5, .45, -.25, -.3, 0, -.2); return g.build(); }
  if (p.type === 'flak') { for (let i = 0; i < 4; i++) g.box(2.6, .14, .22, col, Math.cos(i * Math.PI / 2) * 1.3, .2, Math.sin(i * Math.PI / 2) * 1.3, 0, -i * Math.PI / 2, 0); g.cyl(.4, .5, .9, col, 0, .7, 0, 'y', 8); g.box(1.1, .8, .9, col, -.1, 1.4, 0); g.cyl(.07, .1, 4.9, COL.GUN, 2.2, 1.9, 0, 'x', 8, 0, 0, .22); g.box(.06, 1.5, 2.0, col, .7, 1.7, 0, 0, 0, -.15); return g.build(); }
  if (p.type === 'nebel') { wheels(g, [0], 1.6, .4, col); g.box(2.4, .1, .12, col, -1.0, .35, .3, 0, .15, 0); g.box(2.4, .1, .12, col, -1.0, .35, -.3, 0, -.15, 0); for (let i = 0; i < 6; i++) g.cyl(.085, .085, 1.3, col, .3, 1.05 + Math.sin(i * Math.PI / 3) * .2, Math.cos(i * Math.PI / 3) * .2, 'x', 7, 0, 0, .5); g.box(.3, .6, .3, col, 0, .7, 0); return g.build(); }
  const wr = p.wr || .5, el = p.el || 0; wheels(g, [0], p.W || 1.9, wr, col);
  g.box(p.trail, .12, .16, col, -p.trail / 2, .32, .45, 0, .22, -.08); g.box(p.trail, .12, .16, col, -p.trail / 2, .32, -.45, 0, -.22, -.08);
  g.box(.9, .35, .6, col, 0, wr + .2, 0); g.box(.6, .3, .35, COL.GUN, -.3, wr + .45, 0);
  g.cyl(p.cal, p.cal * 1.3, p.bl, COL.GUN, Math.cos(el) * p.bl / 2, wr + .45 + Math.sin(el) * p.bl / 2, 0, 'x', 7, 0, 0, el); if (p.brake) g.cyl(p.cal * 1.9, p.cal * 1.9, .28, COL.GUN, Math.cos(el) * p.bl, wr + .45 + Math.sin(el) * p.bl, 0, 'x', 6, 0, 0, el);
  if (p.shield) { g.box(.06, p.shield[1], p.shield[0], col, .35, wr + .35 + p.shield[1] * .3, 0, 0, 0, -.2); }
  return g.build();
}
function buildGuns(theme) {
  const ge = theme === 'desert' ? COL.GED : COL.GEG, uk = theme === 'desert' ? COL.UKD : COL.UKG, us = COL.US;
  return {
    how105: buildGun({ col: us, bl: 2.4, cal: .07, el: .45, trail: 2.6, shield: [1.6, 1.1] }), how155: buildGun({ col: us, bl: 3.6, cal: .095, el: .5, trail: 3.4, wr: .6, W: 2.3 }), pack75: buildGun({ col: us, bl: 1.3, cal: .06, el: .4, trail: 1.8, wr: .4, W: 1.3 }),
    pdr25: buildGun({ col: uk, bl: 2.4, cal: .065, el: .4, trail: 2.4, shield: [1.9, 1.2], brake: 1 }), med55: buildGun({ col: uk, bl: 4.1, cal: .09, el: .5, trail: 3.6, wr: .65, W: 2.3 }), pdr17: buildGun({ col: uk, bl: 4.2, cal: .06, el: .03, trail: 3.0, shield: [2.0, 1.0], brake: 1 }),
    lefh18: buildGun({ col: ge, bl: 2.9, cal: .07, el: .45, trail: 2.8, shield: [1.7, 1.2], brake: 1 }), sfh18: buildGun({ col: ge, bl: 4.4, cal: .095, el: .5, trail: 3.6, wr: .65, W: 2.2 }), pak40: buildGun({ col: ge, bl: 3.5, cal: .055, el: .02, trail: 2.8, wr: .42, shield: [1.9, .8], brake: 1 }),
    it75: buildGun({ col: 0xb39f6c, bl: 2.0, cal: .06, el: .35, trail: 2.4, shield: [1.5, 1.0] }), it100: buildGun({ col: 0xb39f6c, bl: 1.8, cal: .08, el: .5, trail: 2.4, shield: [1.5, 1.1] }), it47: buildGun({ col: 0xb39f6c, bl: 1.6, cal: .04, el: .03, trail: 1.8, wr: .32, W: 1.2 }),
    flak88: buildGun({ col: ge, type: 'flak' }), nebel: buildGun({ col: ge, type: 'nebel' }), mortar: buildGun({ col: us, type: 'mortar' }),
  };
}

// ---------- aircraft ----------
function wingGeo(span, c0, c1, sweep, th, ellip) { const s = new THREE.Shape(); const h = span / 2; if (ellip) { s.moveTo(c0 * .5, 0); for (let i = 1; i <= 16; i++) { const a = i / 16 * Math.PI; s.lineTo(Math.cos(a * 0) * 0 + c0 * .5 * Math.cos(a) * 0 + (c0 * .5) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.sin(a) > 0 ? (i / 16 * 2 - 1) : 0, 2))) * (i <= 16 ? 1 : 1), (i / 16 * 2 - 1) * h); } const pts = []; for (let i = 0; i <= 16; i++) { const z = (i / 16 * 2 - 1) * h, w = c0 * Math.sqrt(Math.max(0.02, 1 - (z / h) * (z / h))); pts.push([w * .42, z]); } const back = pts.map(p => [-(p[0] / .42) * .58, p[1]]).reverse(); const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (const p of pts) sh.lineTo(p[0], p[1]); for (const p of back) sh.lineTo(p[0], p[1]); const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); g.rotateX(Math.PI / 2); return g; }
  s.moveTo(c0 * .45, 0); s.lineTo(c1 * .45 - sweep, h); s.lineTo(-c1 * .55 - sweep, h); s.lineTo(-c0 * .55, 0); s.lineTo(-c1 * .55 - sweep, -h); s.lineTo(c1 * .45 - sweep, -h); s.lineTo(c0 * .45, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false }); g.rotateX(Math.PI / 2); return g; }
function buildPlane(p) {
  const g = new GB(), top = p.top, und = p.und || 0x9aa3a6, L = p.len, r = p.r;
  const fus = (z, len, rr, x0) => { g.cyl(rr * .35, rr, len * .55, top, x0 - len * .22, 0, z, 'x', 10); g.cyl(rr, rr * (p.radial ? 1.0 : .7), len * .45, top, x0 + len * .28, 0, z, 'x', 10); };
  if (p.boom) { fus(0, L * .55, r, L * .1); for (const s of [-1, 1]) { g.cyl(r * .3, r * .55, L * .9, top, -L * .05, 0, s * p.span * .16, 'x', 8); g.cyl(r * .2, r * .5, .5, 0x777a7c, L * .42, 0, s * p.span * .16, 'x', 8); g.cyl(1.5, 1.5, .03, 0xb9bcbc, L * .46, 0, s * p.span * .16, 'x', 12); g.box(.9, 1.1, .08, top, -L * .47, .5, s * p.span * .16); } g.box(.8, .08, p.span * .34, top, -L * .47, .3, 0); }
  else { fus(0, L, r, 0); g.cyl(.05, r * (p.radial ? .9 : .55), .5, p.nose || 0x777a7c, L * .52, 0, 0, 'x', 8); if (!p.eng) g.cyl(1.5, 1.5, .03, 0xb9bcbc, L * .56, 0, 0, 'x', 12); }
  g.sph(r * .62, 0x8fb3c4, p.cx != null ? p.cx : L * .08, r * .72, 0, p.cl || 1.9, .8, .9);
  const wy = p.wy != null ? p.wy : -r * .35, wx = p.wx != null ? p.wx : L * .1;
  if (p.gull) { for (const s of [-1, 1]) { g.box(p.c0, .14, p.span * .16, top, wx, wy - .35, s * p.span * .08, s * .45); g.box(p.c0 * .85, .12, p.span * .36, top, wx - .1, wy - .35, s * p.span * .33, s * -.13); g.box(1.2, .9, .35, top, wx + .2, wy - 1.3, s * p.span * .15); g.cyl(.4, .4, .3, COL.TYRE, wx + .3, wy - 1.75, s * p.span * .15, 'z', 8); } }
  else g.add(wingGeo(p.span, p.c0, p.c1 != null ? p.c1 : p.c0 * .5, p.sweep || 0, .16, p.ellip), top, mat(wx, wy + .08, 0));
  if (p.bi) { g.add(wingGeo(p.span * 1.15, p.c0, p.c0 * .7, 0, .14), top, mat(wx + .4, r * 1.5, 0)); for (const s of [-1, 1]) { g.box(.08, r * 1.9, .08, 0x444444, wx + .3, r * .55, s * p.span * .3, 0, 0, .15); g.box(.08, r * 1.9, .08, 0x444444, wx - .3, r * .55, s * p.span * .3, 0, 0, -.15); } }
  if (!p.boom) { g.add(wingGeo(p.span * .34, p.c0 * .55, p.c0 * .3, 0, .1), top, mat(-L * .45, r * .1, 0)); if (p.twin) for (const s of [-1, 1]) g.box(p.c0 * .55, r * 1.5, .1, top, -L * .47, r * .6, s * p.span * .17); else g.box(p.c0 * .7, r * 1.7, .1, top, -L * .44, r * .9, 0, 0, 0, -.25); }
  if (p.eng) for (const z of p.eng) for (const s of [-1, 1]) { g.cyl(r * .5, r * .62, L * .22, top, wx + p.c0 * .35, wy + .05, s * z, 'x', 8); g.cyl(.05, r * .5, .4, 0x55585a, wx + p.c0 * .35 + L * .13, wy + .05, s * z, 'x', 8); g.cyl(1.6, 1.6, .03, 0xb9bcbc, wx + p.c0 * .35 + L * .16, wy + .05, s * z, 'x', 12); }
  const mz = p.span * .34, mx = wx - (p.sweep || 0) * .68, my = wy + .1 + (p.gull ? -.25 : 0);
  for (const s of [-1, 1]) {
    if (p.mk === 'us') { g.add(new THREE.CircleGeometry(p.c0 * .26, 14), 0x1f2f55, mat(mx, my + .01, s * mz, -Math.PI / 2)); g.add(new THREE.CircleGeometry(p.c0 * .24, 5), 0xf0efe6, mat(mx, my + .02, s * mz, -Math.PI / 2)); }
    else if (p.mk === 'uk') { g.add(new THREE.CircleGeometry(p.c0 * .27, 14), 0x1f3566, mat(mx, my + .01, s * mz, -Math.PI / 2)); g.add(new THREE.CircleGeometry(p.c0 * .11, 10), 0xa3221f, mat(mx, my + .02, s * mz, -Math.PI / 2)); }
    else if (p.mk === 'it') { g.add(new THREE.CircleGeometry(p.c0 * .26, 14), 0xf2f0e6, mat(mx, my + .01, s * mz, -Math.PI / 2)); g.box(p.c0 * .28, .02, p.c0 * .07, 0x111111, mx, my + .02, s * mz); }
    else { g.box(p.c0 * .5, .02, p.c0 * .14, 0x101010, mx, my + .02, s * mz); g.box(p.c0 * .14, .02, p.c0 * .5, 0x101010, mx, my + .02, s * mz); }
    if (p.stripes) for (let i = 0; i < 5; i++) g.box(p.c0 * .82, .02, .42, i % 2 ? 0x111111 : 0xf2f2ee, wx - .15, wy + .1, s * (p.span * .13 + i * .42));
  }
  if (p.stripes && !p.boom) for (let i = 0; i < 5; i++) g.cyl(r * .72, r * .78, .4, i % 2 ? 0x111111 : 0xf2f2ee, -L * .16 - i * .4, 0, 0, 'x', 10);
  if (p.yellow) g.cyl(r * .9, r * .92, .9, 0xd8b21c, L * .4, 0, 0, 'x', 10);
  // light underside tint: recolour vertices facing down is costly; add a belly slab instead
  g.box(L * .5, .05, r * 1.1, und, 0, -r * .93, 0);
  return g.build();
}
function buildPlanes(year) {
  const od = 0x565a3a, st = year >= 1944 ? 1 : 0, P = {};
  const us = o => Object.assign({ top: od, mk: 'us', stripes: st }, o), uk = o => Object.assign({ top: 0x5a6148, mk: 'uk', stripes: st, und: 0xa9b3b0 }, o), ge = o => Object.assign({ top: 0x646d6a, mk: 'ge', und: 0x9fb2b8, yellow: 1 }, o);
  P.p40 = buildPlane(us({ len: 9.7, span: 11.4, r: .7, c0: 2.3, top: 0x8a7a55, stripes: 0 })); P.p39 = buildPlane(us({ len: 9.2, span: 10.4, r: .65, c0: 2.1, cx: 1.6, stripes: 0 }));
  P.p47 = buildPlane(us({ len: 11, span: 12.4, r: .95, c0: 2.6, radial: 1, ellip: 1, top: year >= 1944 ? 0xa9adac : od })); P.p51 = buildPlane(us({ len: 9.8, span: 11.3, r: .68, c0: 2.4, c1: 1.3, top: year >= 1944 ? 0xb3b6b4 : od }));
  P.p38 = buildPlane(us({ len: 11.5, span: 15.8, r: .7, c0: 2.6, c1: 1.0, boom: 1, stripes: 0 })); P.a20 = buildPlane(us({ len: 14.6, span: 18.7, r: .9, c0: 3.2, c1: 1.4, eng: [3.0], wy: .2, stripes: 0 }));
  P.b25 = buildPlane(us({ len: 16.1, span: 20.6, r: 1.1, c0: 3.4, c1: 1.6, eng: [3.3], twin: 1, wy: .3, cl: 1.4, cx: 5.5 })); P.b26 = buildPlane(us({ len: 17.8, span: 21.6, r: 1.25, c0: 3.4, c1: 1.5, eng: [3.5], wy: .7, cl: 1.4, cx: 5.8, top: year >= 1944 ? 0xa9adac : od }));
  P.b17 = buildPlane(us({ len: 22.7, span: 31.6, r: 1.3, c0: 5.0, c1: 1.8, eng: [3.9, 8.2], cl: 1.5, cx: 6.5, stripes: 0 })); P.c47 = buildPlane(us({ len: 19.4, span: 29, r: 1.2, c0: 4.6, c1: 1.5, eng: [3.6], sweep: 1.2, cl: 1.2, cx: 6.5 }));
  P.spit = buildPlane(uk({ len: 9.1, span: 11.2, r: .62, c0: 2.6, ellip: 1 })); P.hurri = buildPlane(uk({ len: 9.8, span: 12.2, r: .7, c0: 2.6, c1: 1.5, stripes: 0, top: 0x8a7a55 })); P.typhoon = buildPlane(uk({ len: 9.7, span: 12.7, r: .82, c0: 2.8, c1: 1.5 }));
  P.bf109 = buildPlane(ge({ len: 9.0, span: 9.9, r: .6, c0: 2.1, c1: 1.1 })); P.fw190 = buildPlane(ge({ len: 9.0, span: 10.5, r: .74, c0: 2.3, c1: 1.2, radial: 1 }));
  P.ju87 = buildPlane(ge({ len: 11.5, span: 13.8, r: .72, c0: 3.0, gull: 1, cl: 2.6, yellow: 0 })); P.ju88 = buildPlane(ge({ len: 14.4, span: 20, r: .95, c0: 3.3, c1: 1.3, eng: [2.9], cx: 5.2, cl: 1.3, yellow: 0 }));
  P.kitty = buildPlane(uk({ len: 9.7, span: 11.4, r: .7, c0: 2.3, top: 0x9a8a5e, stripes: 0 })); P.boston = buildPlane(uk({ len: 14.6, span: 18.7, r: .9, c0: 3.2, c1: 1.4, eng: [3.0], wy: .2, top: 0x9a8a5e, stripes: 0 }));
  P.mc202 = buildPlane({ top: 0xa8955e, und: 0x9fb2b8, mk: 'it', len: 8.9, span: 10.6, r: .62, c0: 2.2, c1: 1.2 }); P.cr42 = buildPlane({ top: 0xa8955e, und: 0x9fb2b8, mk: 'it', len: 8.3, span: 8.4, r: .68, c0: 1.7, c1: 1.3, radial: 1, bi: 1, wy: -.5 });
  const gl = new GB(); gl.cyl(.5, 1.0, 14, 0x4c5136, 0, 0, 0, 'x', 8); gl.add(wingGeo(25, 3.2, 1.6, 0, .18), 0x4c5136, mat(1.5, 1.0, 0)); gl.box(2.2, 2.4, .12, 0x4c5136, -6.4, 1.2, 0); gl.box(1.6, .1, 6, 0x4c5136, -6.4, 1.0, 0); P.glider = gl.build();
  return P;
}

// ---------- scenery ----------
function buildScenery(theme) {
  const o = {};
  let g = new GB(); g.cyl(.25, .32, 1.6, 0x4a3828, 0, .8, 0, 'y', 5); g.add(new THREE.ConeGeometry(1.7, 3.2, 7), theme === 'snow' ? 0x3d5140 : 0x35523a, mat(0, 2.9, 0)); g.add(new THREE.ConeGeometry(1.25, 2.6, 7), theme === 'snow' ? 0xdfe6e4 : 0x3f6143, mat(0, 4.5, 0)); o.conifer = g.build();
  g = new GB(); g.cyl(.25, .35, 1.8, 0x4d3a29, 0, .9, 0, 'y', 5); g.add(new THREE.IcosahedronGeometry(1.9, 0), theme === 'snow' ? 0x6c665a : theme === 'med' ? 0x5c6f3d : 0x4d6e3c, mat(0, 3.1, 0, 0, 0, 0, 1, .85, 1)); g.add(new THREE.IcosahedronGeometry(1.2, 0), theme === 'snow' ? 0xd9dfdc : theme === 'med' ? 0x6c7f44 : 0x5b7d43, mat(.6, 4.0, .3)); o.broad = g.build();
  g = new GB(); g.add(new THREE.IcosahedronGeometry(.9, 0), 0x6f7446, mat(0, .5, 0, 0, 0, 0, 1.2, .6, 1.2)); g.add(new THREE.IcosahedronGeometry(.6, 0), 0x7d7c4c, mat(.9, .35, .4, 0, 0, 0, 1, .6, 1)); o.scrub = g.build();
  g = new GB(); g.cyl(.2, .3, 4.2, 0x6a5840, 0, 2.1, 0, 'y', 5, 0, 0, .08); for (let i = 0; i < 6; i++) g.box(2.6, .06, .6, 0x4f6d38, Math.cos(i * 1.05) * 1.2 + .2, 4.2, Math.sin(i * 1.05) * 1.2, 0, -i * 1.05, -.35); o.palm = g.build();
  // house: walls and roof separate so instance colours can differ
  g = new GB(); g.box(9, 5, 7, 0xffffff, 0, 2.5, 0); g.box(.3, 2.4, 1.2, 0x4a3c30, 4.45, 1.2, 0); for (const z of [-2.2, 2.2]) g.box(.2, 1.3, 1.1, 0x38424a, 4.45, 3.2, z); o.wall = g.build();
  g = new GB(); if (theme === 'desert') { g.box(9.4, .5, 7.4, 0xffffff, 0, 5.2, 0); g.box(9.4, .9, .3, 0xffffff, 0, 5.6, 3.6); g.box(9.4, .9, .3, 0xffffff, 0, 5.6, -3.6); } else { const pr = new THREE.CylinderGeometry(4.6, 4.6, 9.6, 3, 1); pr.rotateZ(Math.PI / 2); pr.rotateX(Math.PI / 6 + Math.PI / 2); g.add(pr, 0xffffff, mat(0, 6.1, 0, 0, 0, 0, 1, .62, 1)); g.box(.8, 1.6, .8, 0x4a4038, 2.5, 8.2, 1); } o.roof = g.build();
  g = new GB(); g.box(14, 8, 8, 0xffffff, 0, 4, 0); g.box(5, 15, 5, 0xffffff, 8, 7.5, 0); g.add(new THREE.ConeGeometry(4, theme === 'desert' ? 3 : 9, 4), theme === 'desert' ? 0xe9e0c8 : 0x4a4f55, mat(8, theme === 'desert' ? 16.5 : 19.5, 0, 0, Math.PI / 4, 0)); const pr2 = new THREE.CylinderGeometry(5.2, 5.2, 14.4, 3, 1); pr2.rotateZ(Math.PI / 2); pr2.rotateX(Math.PI / 6 + Math.PI / 2); g.add(pr2, theme === 'desert' ? 0xe9e0c8 : 0x5a4a45, mat(0, 9.6, 0, 0, 0, 0, 1, .6, 1)); o.church = g.build();
  // supply dump
  g = new GB(); for (let i = 0; i < 7; i++) g.box(3 + (i % 3), 2 + (i % 2), 3, i % 2 ? 0x6b5a3c : 0x5a5f3c, -8 + (i % 4) * 5, 1 + (i % 2) * .5, -4 + ((i / 4) | 0) * 7);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) for (let h = 0; h < 1 + ((r + c) % 3); h++) g.box(2.4, 1.3, 1.8, (r + c + h) % 2 ? 0x7a6440 : 0x66704a, 8 + c * 3, .65 + h * 1.35, -10 + r * 2.6);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) g.cyl(.55, .55, 1.3, r % 2 ? 0x2f3a2c : 0x4a4a40, -14 + c * 1.3, .65, 12 + r * 1.3, 'y', 7);
  for (let i = 0; i < 5; i++) g.cyl(.55, .55, 1.3, 0x3c3c34, -13 + i * 1.1 + .55, 1.95, 13.3, 'y', 7); const tent = new THREE.CylinderGeometry(4, 4, 9, 3, 1); tent.rotateZ(Math.PI / 2); tent.rotateX(Math.PI / 6 + Math.PI / 2); g.add(tent, 0x7c7a55, mat(4, 2, 9, 0, 0, 0, 1, .7, 1)); for (let i = 0; i < 6; i++) g.cyl(.9, .9, 1.8, 0x3c4a3a, -9 + i * 2, .9, 9, 'y', 8); o.dump = g.build();
  // ships
  g = new GB(); const hs = new THREE.Shape(); hs.moveTo(80, 0); hs.quadraticCurveTo(55, 9, 20, 9.5); hs.lineTo(-70, 8); hs.lineTo(-78, 0); hs.lineTo(-70, -8); hs.lineTo(20, -9.5); hs.quadraticCurveTo(55, -9, 80, 0); const hg = new THREE.ExtrudeGeometry(hs, { depth: 7, bevelEnabled: false }); hg.rotateX(-Math.PI / 2); g.add(hg, 0x6f7a80, mat(0, 0, 0)); g.box(150, .3, 14, 0x8a7f66, 0, 7.1, 0);
  g.box(34, 9, 11, 0x7b868c, 6, 11.5, 0); g.box(12, 8, 8, 0x7b868c, 12, 20, 0); g.cyl(2.6, 3, 11, 0x5b6468, -4, 18, 0, 'y', 10); g.cyl(2.6, 3, 10, 0x5b6468, -16, 17, 0, 'y', 10); g.cyl(.4, .5, 22, 0x4a5256, 16, 30, 0, 'y', 5);
  for (const x of [50, 36, -40, -54]) { g.cyl(5, 5.5, 3.5, 0x77838a, x, 9 + (x === 36 || x === -40 ? 3 : 0), 0, 'y', 10); for (const z of [-1.5, 0, 1.5]) g.cyl(.35, .4, 14, 0x3c4144, x + (x > 0 ? 8 : -8), 10 + (x === 36 || x === -40 ? 3 : 0), z, 'x', 6); } o.ship = g.build();
  g = new GB(); g.box(10, 1.6, 3.2, 0x66727a, 0, .8, 0); for (const s of [-1, 1]) g.box(10, 1.3, .2, 0x66727a, 0, 2.1, s * 1.5); g.box(.25, 2.0, 3.0, 0x59646b, 5.0, 1.9, 0, 0, 0, -.25); g.box(2.2, 1.6, 2.2, 0x59646b, -4, 2.6, 0); for (let i = 0; i < 8; i++) g.sph(.3, 0x4a5032, -1.5 + (i % 4) * 1.3, 2.0, -.6 + ((i / 4) | 0) * 1.2, 1, .7, 1); o.lcvp = g.build();
  g = new GB(); g.add(new THREE.SphereGeometry(3.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xffffff, mat(0, 6, 0, 0, 0, 0, 1, .75, 1)); g.box(.28, 1.3, .4, 0x4d5233, 0, .7, 0); for (let i = 0; i < 6; i++) g.box(.03, 6.2, .03, 0xd8d8d0, Math.cos(i * 1.05) * 1.5, 3.4, Math.sin(i * 1.05) * 1.5, Math.sin(i * 1.05) * .5, 0, -Math.cos(i * 1.05) * .5); o.chute = g.build();
  g = new GB(); g.box(30, 2, 5, 0x5d5a52, 0, 0, 0); for (const x of [-10, 10]) g.box(2.5, 9, 4.5, 0x6a665c, x, -5, 0); for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { g.box(.3, 2.2, .3, 0x4c4a44, -12.5 + i * 5, 2, s * 2.4); } for (const s of [-1, 1]) g.box(30, .3, .3, 0x4c4a44, 0, 3, s * 2.4); o.bridge = g.build();
  g = new GB(); g.box(.5, .5, 1.0, 0x30302c, 0, .25, 0); o.crate = g.build();
  return o;
}
