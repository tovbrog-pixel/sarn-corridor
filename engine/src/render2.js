// ===== RENDERER DYNAMIC: units, vehicles, aircraft, effects =====
function initDynamic(R, year) {
  const S = R.S, map = R.map, scene = R.scene, theme = R.theme, inst = R.inst;
  const VEH = buildVehicles(theme), GUN = buildGuns(theme), PLN = buildPlanes(year), SOL = { US: buildSoldier('US'), UK: buildSoldier('UK'), GE: buildSoldier('GE'), IT: buildSoldier('IT') }, SCN = R.SCN;
  const dyn = [], SOLS = 1.3;
  const dinst = (g, cap, m, colored) => { const im = inst(g, cap, m, true, colored); dyn.push(im); return im; };
  const sol = {}; for (const n in SOL) sol[n] = { body: dinst(SOL[n].body, 1300), l: dinst(SOL[n].leg, 1300), r: dinst(SOL[n].leg, 1300) };
  const veh = {}, gun = {};
  const vget = k => veh[k] || (veh[k] = { def: VEH[k], hull: dinst(VEH[k].hull, 90), tur: VEH[k].tur ? dinst(VEH[k].tur, 90) : null });
  const gget = k => gun[k] || (gun[k] = dinst(GUN[k], 70));
  const ring = (g, cap, m) => { const im = inst(g, cap, m); im.next = 0; im.put = function (x, z, ang, s, y, lay) { R.dummy.position.set(x, y != null ? y : R.hy(x, z), z); R.dummy.rotation.set(0, -ang, lay ? -1.5 : 0); R.dummy.scale.setScalar(s); R.dummy.updateMatrix(); im.setMatrixAt(im.next, R.dummy.matrix); im.next = (im.next + 1) % cap; im.count = Math.min(cap, im.count + 1); im.instanceMatrix.needsUpdate = true; }; return im; };
  const wreckA = ring(VEH.wreck.hull, 180), wreckT = ring(VEH.wreckT.hull, 90);
  const fallenM = new THREE.MeshLambertMaterial({ color: 0x8a8672, vertexColors: true });
  const fallen = { US: ring(SOL.US.body, 260, fallenM), UK: ring(SOL.UK.body, 200, fallenM), GE: ring(SOL.GE.body, 260, fallenM), IT: ring(SOL.IT.body, 200, fallenM) };
  for (const n in fallen) fallen[n].castShadow = false;
  const cg = new THREE.CircleGeometry(1, 10); cg.rotateX(-Math.PI / 2); const crater = ring(cg, 320, new THREE.MeshBasicMaterial({ color: 0x1c1915, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -8 })); crater.castShadow = false;
  const chuteI = dinst(SCN.chute, 260, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), true), lcvp = dinst(SCN.lcvp, 60);
  const planes = {}, pUse = {}; let gliders = [];
  function plane(key, x, y, z, hd, roll, pitch) { const a = planes[key] || (planes[key] = []); const i = pUse[key] = (pUse[key] || 0); let m = a[i]; if (!m) { m = new THREE.Mesh(PLN[key], R.matV); m.castShadow = true; m.scale.setScalar(MS); scene.add(m); a.push(m); } pUse[key] = i + 1; m.visible = true; m.position.set(x, y, z); m.rotation.set(roll, -hd, pitch, 'YZX'); return m; }
  const ships = new Map();

  // ---------- particles ----------
  function Particles(cap, additive) {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(cap * 3), col = new Float32Array(cap * 4), size = new Float32Array(cap);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('col', new THREE.BufferAttribute(col, 4)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({ uniforms: { scale: { value: 800 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute float size; attribute vec4 col; varying vec4 vCol; uniform float scale; void main(){ vCol=col; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=max(1.0,size*scale/-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec4 vCol; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.12,d); gl_FragColor=vec4(vCol.rgb,vCol.a*a); }' });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
    const P = { n: 0, vel: new Float32Array(cap * 3), life: new Float32Array(cap), max: new Float32Array(cap), s0: new Float32Array(cap), s1: new Float32Array(cap), a0: new Float32Array(cap), grav: new Float32Array(cap), mat: m };
    P.spawn = function (x, y, z, vx, vy, vz, life, s0, s1, r, gg, b, a, grav) { let i = P.n; if (i >= cap) i = (Math.random() * cap) | 0; else P.n++; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz; P.life[i] = P.max[i] = life; P.s0[i] = s0; P.s1[i] = s1; col[i * 4] = r; col[i * 4 + 1] = gg; col[i * 4 + 2] = b; P.a0[i] = a; P.grav[i] = grav || 0; };
    P.update = function (dt) {
      for (let i = 0; i < P.n; i++) {
        P.life[i] -= dt; if (P.life[i] <= 0) { const l = --P.n; if (i !== l) { for (let k = 0; k < 3; k++) { pos[i * 3 + k] = pos[l * 3 + k]; P.vel[i * 3 + k] = P.vel[l * 3 + k]; col[i * 4 + k] = col[l * 4 + k]; } P.life[i] = P.life[l]; P.max[i] = P.max[l]; P.s0[i] = P.s0[l]; P.s1[i] = P.s1[l]; P.a0[i] = P.a0[l]; P.grav[i] = P.grav[l]; i--; } continue; }
        P.vel[i * 3 + 1] -= P.grav[i] * dt; pos[i * 3] += P.vel[i * 3] * dt; pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
        const f = 1 - P.life[i] / P.max[i]; size[i] = P.s0[i] + (P.s1[i] - P.s0[i]) * f; col[i * 4 + 3] = P.a0[i] * (f < .1 ? f * 10 : 1 - (f - .1) / .9);
      }
      g.setDrawRange(0, P.n); g.attributes.position.needsUpdate = g.attributes.col.needsUpdate = g.attributes.size.needsUpdate = true;
    };
    return P;
  }
  const smoke = Particles(7000, false), glow = Particles(3500, true);
  const TR = 700, tpos = new Float32Array(TR * 6), tcol = new Float32Array(TR * 6), tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tpos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(tcol, 3));
  const tl0 = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); tl0.frustumCulled = false; scene.add(tl0);
  let tracers = [], emitters = [], timers = [], falling = [], transits = [], chutes = [];
  const rnd = Math.random, WIND = [.05, .02];
  const dustCol = theme === 'desert' ? [.78, .68, .5] : theme === 'snow' ? [.93, .95, .96] : [.55, .5, .42];
  function tracer(ax, ay, az, bx, by, bz, life, r, g, b, len) { if (tracers.length < TR) tracers.push({ a: [ax, ay, az], b: [bx, by, bz], t: 0, life, c: [r, g, b], len: len || .25 }); }
  function after(sec, fn) { timers.push({ t: R.t + sec, fn }); }
  function flash(x, y, z, s) { glow.spawn(x, y, z, 0, 0, 0, .1, s * .5, s * .9, 1, .9, .6, .9); }
  function puff(x, y, z, s, dark, life) { const c = dark ? .16 + rnd() * .1 : .55 + rnd() * .2; smoke.spawn(x, y, z, WIND[0] + (rnd() - .5) * .04, .05 + rnd() * .06, WIND[1] + (rnd() - .5) * .04, life || 2.5, s, s * 3, c, c, c, .55); }
  function explosion(x, z, s, o) {
    o = o || {}; const y = (o.y != null ? o.y : R.hy(x, z)) + .02;
    glow.spawn(x, y + .03 * s, z, 0, 0, 0, .16, .12 * s, .3 * s, 1, .85, .5, .9);
    for (let i = 0; i < 5 * s; i++) glow.spawn(x + (rnd() - .5) * .06 * s, y + rnd() * .05 * s, z + (rnd() - .5) * .06 * s, (rnd() - .5) * .25, .15 + rnd() * .3, (rnd() - .5) * .25, .35 + rnd() * .3, .07 * s, .16 * s, 1, .5 + rnd() * .3, .12, .8);
    if (!o.air) for (let i = 0; i < 9 * s; i++) { const a = rnd() * 6.28, v = (.15 + rnd() * .45) * s; smoke.spawn(x, y, z, Math.cos(a) * v * .5, .35 * s + rnd() * .6 * s, Math.sin(a) * v * .5, .9 + rnd() * .7, .04 * s, .09 * s, dustCol[0] * .6, dustCol[1] * .55, dustCol[2] * .5, .95, 1.6); }
    for (let i = 0; i < 4 * s; i++) { const c = .25 + rnd() * .3; smoke.spawn(x + (rnd() - .5) * .1 * s, y + .05, z + (rnd() - .5) * .1 * s, WIND[0] + (rnd() - .5) * .08, .08 + rnd() * .14, WIND[1] + (rnd() - .5) * .08, 3 + rnd() * 3, .1 * s, .36 * s, c, c, c, .5); }
    if (!o.air && !o.noCrater && map.tAt(clamp(x, 0, map.w - .1), clamp(z, 0, map.h - .1)) !== T.SEA) crater.put(x, z, rnd() * 6, .05 * s * (.7 + rnd() * .6), y - .005);
    if (o.fire) emitters.push({ x, y, z, until: R.t + o.fire, s: .6 * s });
  }
  function wreck(x, z, ang, truck) { (truck ? wreckT : wreckA).put(x, z, ang, MS); explosion(x, z, 1.1, { noCrater: true, fire: 35 + rnd() * 40 }); }
  R.explosion = explosion;

  // ---------- unit visuals ----------
  const vis = new Map(), tm = new THREE.Matrix4(), tl = new THREE.Matrix4(), tr = new THREE.Matrix4();
  function base(x, y, z, ang, s) { const c = Math.cos(ang) * s, n = Math.sin(ang) * s, e = tm.elements; e[0] = c; e[1] = 0; e[2] = n; e[3] = 0; e[4] = 0; e[5] = s; e[6] = 0; e[7] = 0; e[8] = -n; e[9] = 0; e[10] = c; e[11] = 0; e[12] = x; e[13] = y; e[14] = z; e[15] = 1; return tm; }
  const add = (im, m) => { if (im.count < im.cap) im.setMatrixAt(im.count++, m); };
  function soldier(nat, x, z, ang, ph, pose, moving) {
    const P = sol[nat], y = R.hy(x, z); base(x, y, z, ang, MS * SOLS);
    if (pose === 2) { tl.makeRotationZ(-1.45); tl.setPosition(.25, .22, 0); tr.multiplyMatrices(tm, tl); add(P.body, tr); tl.makeRotationZ(-1.55); tl.setPosition(-.55, .18, .1); tr.multiplyMatrices(tm, tl); add(P.l, tr); tl.setPosition(-.55, .18, -.1); tr.multiplyMatrices(tm, tl); add(P.r, tr); return; }
    const kn = pose === 1 ? .36 : 0, bob = moving ? Math.abs(Math.sin(ph)) * .05 : 0, sw = moving ? Math.sin(ph) * .65 : 0;
    tl.identity(); tl.setPosition(0, bob - kn, 0); tr.multiplyMatrices(tm, tl); add(P.body, tr);
    tl.makeRotationZ(kn ? 1.25 : sw); tl.setPosition(0, .92 - kn, .1); tr.multiplyMatrices(tm, tl); add(P.l, tr);
    tl.makeRotationZ(kn ? -.35 : -sw); tl.setPosition(0, .92 - kn, -.1); tr.multiplyMatrices(tm, tl); add(P.r, tr);
  }
  function vehicle(key, x, z, ang, turAng) { const V = vget(key), y = R.hy(x, z); base(x, y, z, ang, MS); add(V.hull, tm); if (V.tur) { tl.makeRotationY(-(turAng - ang)); tl.setPosition(V.def.tx, V.def.ty, 0); tr.multiplyMatrices(tm, tl); add(V.tur, tr); } return y; }
  const COMBATV = { arm: 1, at: 1, rec: 1 };
  function mkVis(u) {
    const k = u.k.vis, els = [], mul = Math.sqrt(u.mul || 1), cnt = n => Math.max(1, Math.round(n * mul));
    if (k.v) for (let i = 0; i < k.v.length; i += 2) for (let j = 0; j < cnt(k.v[i + 1]); j++) els.push({ t: 'v', key: k.v[i] });
    if (k.g) for (let j = 0; j < cnt(k.g[1]); j++) els.push({ t: 'g', key: k.g[0] });
    if (k.s) for (let j = 0; j < cnt(k.s); j++) els.push({ t: 's' });
    els.forEach((e, i) => { e.x = u.x + (rnd() - .5) * .2; e.z = u.y + (rnd() - .5) * .2; e.hd = Math.atan2(u.hy, u.hx); e.ta = e.hd; e.ph = rnd() * 6; e.j = rnd(); e.j2 = rnd(); e.cd = rnd() * 2; e.dead = false; e.mv = false; e.i = i; });
    const v = { els, trail: [[u.x, u.y]], hx: u.x, hz: u.y, fa: Math.atan2(u.hy, u.hx), mvT: 0, n: { v: els.filter(e => e.t === 'v').length, g: els.filter(e => e.t === 'g').length, s: els.filter(e => e.t === 's').length }, fresh: true };
    v.combatV = COMBATV[u.cls] || (u.cls === 'art' && !k.g); v.mounted = u.mv !== 'foot' && v.n.v > 0 && !v.combatV; return v;
  }
  function trailAt(v, d, out) { let px = v.hx, pz = v.hz, dx = -Math.cos(v.fa), dz = -Math.sin(v.fa); for (const p of v.trail) { const sx = p[0] - px, sz = p[1] - pz, l = Math.hypot(sx, sz); if (l > 1e-5) { dx = sx / l; dz = sz / l; if (d <= l) { out[0] = px + dx * d; out[1] = pz + dz * d; out[2] = Math.atan2(-dz, -dx); return; } d -= l; px = p[0]; pz = p[1]; } } out[0] = px + dx * d; out[1] = pz + dz * d; out[2] = Math.atan2(-dz, -dx); }
  const tp = [0, 0, 0];
  function updateSub(u, dt, gs, show) {
    let v = vis.get(u.id); if (!v) { v = mkVis(u); vis.set(u.id, v); }
    const far = Math.hypot(u.x - v.hx, u.y - v.hz) > 2.5; const kh = far || v.fresh ? 1 : 1 - Math.exp(-dt * (3 + gs * .9));
    v.hx += (u.x - v.hx) * kh; v.hz += (u.y - v.hz) * kh;
    const t0 = v.trail[0]; if (Math.hypot(v.hx - t0[0], v.hz - t0[1]) > .05) { v.trail.unshift([v.hx, v.hz]); if (v.trail.length > 70) v.trail.pop(); }
    if (far) v.trail = [[u.x, u.y]];
    if (u.moving) v.mvT = R.t + .8; const moving = v.mvT > R.t && gs > 0;
    let fa = Math.atan2(u.hy, u.hx), da = fa - v.fa; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; v.fa += da * Math.min(1, dt * 4);
    const fx = Math.cos(v.fa), fz = Math.sin(v.fa), rx = -fz, rz = fx;
    // losses -> wrecks and fallen
    for (const ty of ['v', 'g', 's']) { const want = Math.max(u.str > .12 ? (ty === 's' ? 1 : 0) : 0, Math.ceil(v.n[ty] * clamp((u.str - .1) / .9, 0, 1))); let have = 0; for (const e of v.els) if (e.t === ty && !e.dead) have++; for (let i = v.els.length - 1; i >= 0 && have > want; i--) { const e = v.els[i]; if (e.t === ty && !e.dead) { e.dead = true; have--; if (show && !v.fresh) { if (ty === 's') fallen[u.f.nat].put(e.x, e.z, rnd() * 6, MS * SOLS, R.hy(e.x, e.z) + .006, 1); else wreck(e.x, e.z, e.hd, !COMBATV[u.cls] && ty === 'v' && !v.combatV); } } } }
    const firing = gs > 0 && S.t - u.fireT < 1.3 && u.tgt && !u.tgt.dead, pinned = u.coh < .4 && S.t - u.hitT < 5, tv = firing ? vis.get(u.tgt.id) : null;
    const txx = tv ? tv.hx : (u.tgt ? u.tgt.x : 0), tzz = tv ? tv.hz : (u.tgt ? u.tgt.y : 0), tdist = firing ? Math.hypot(txx - v.hx, tzz - v.hz) : 0;
    const fr = 1 / Math.max(1, Math.sqrt(gs));
    let iv = 0, ig = 0, is = 0, col = 0; const nv = v.els.filter(e => e.t === 'v' && !e.dead).length, ng = v.els.filter(e => e.t === 'g' && !e.dead).length, ns = v.els.filter(e => e.t === 's' && !e.dead).length;
    const kk = v.fresh || far ? 1 : 1 - Math.exp(-dt * (2.4 + gs * .6));
    for (const e of v.els) {
      if (e.dead) continue; let tx, tz, th = v.fa, hide = false;
      if (moving) {
        if (e.t === 'v') { trailAt(v, col, tp); col += .2; } else if (e.t === 'g') { trailAt(v, col, tp); col += .16; } else { if (v.mounted || ng) { hide = true; tp[0] = v.hx; tp[1] = v.hz; tp[2] = v.fa; } else { trailAt(v, col + .04 + Math.floor(is / 2) * .065, tp); const sgn = is % 2 ? 1 : -1; tp[0] += -Math.sin(tp[2]) * .028 * sgn; tp[1] += Math.cos(tp[2]) * .028 * sgn; } }
        tx = tp[0]; tz = tp[1]; th = tp[2];
      } else if (e.t === 'v') { if (v.combatV) { const lat = (iv - (nv - 1) / 2) * .21; tx = v.hx + rx * lat + fx * (iv % 2 ? .05 : -.04); tz = v.hz + rz * lat + fz * (iv % 2 ? .05 : -.04); } else { const lat = (iv - (nv - 1) / 2) * .17; tx = v.hx + rx * lat - fx * (ng ? .5 : .34); tz = v.hz + rz * lat - fz * (ng ? .5 : .34); th = v.fa + (e.j - .5) * .8; } }
      else if (e.t === 'g') { const lat = (ig - (ng - 1) / 2) * .22; tx = v.hx + rx * lat; tz = v.hz + rz * lat; }
      else { if (ng) { const gi = is % ng, lat = (gi - (ng - 1) / 2) * .22 + (is < ng ? .04 : -.045); tx = v.hx + rx * lat - fx * (.07 + Math.floor(is / (ng * 2)) * .06); tz = v.hz + rz * lat - fz * (.07 + Math.floor(is / (ng * 2)) * .06); } else { const rowN = Math.ceil(ns / 2), c = is % rowN, row = Math.floor(is / rowN), lat = (c - (rowN - 1) / 2) * .08 + (e.j - .5) * .03, dep = (nv ? .16 : .04) - row * .085 + (e.j2 - .5) * .04; tx = v.hx + rx * lat + fx * dep; tz = v.hz + rz * lat + fz * dep; th = v.fa + (e.j - .5) * .5; } }
      if (e.t === 'v') iv++; else if (e.t === 'g') ig++; else is++;
      const ox = e.x, oz = e.z; e.x += (tx - e.x) * kk; e.z += (tz - e.z) * kk; const md = Math.hypot(e.x - ox, e.z - oz); e.mv = md > dt * .012 && gs > 0;
      let want = e.mv && md > 1e-5 && (e.t !== 's' || moving) ? Math.atan2(e.z - oz, e.x - ox) : th; if (e.t === 'v' && e.mv && !moving) want = e.hd; let dh = want - e.hd; while (dh > Math.PI) dh -= 6.283; while (dh < -Math.PI) dh += 6.283; e.hd += dh * Math.min(1, dt * (e.t === 's' ? 8 : 3.5));
      if (e.t === 's') e.ph += md / .045 * Math.PI; if (!show || hide) continue;
      e.cd -= dt;
      if (e.t === 's') {
        const pose = pinned ? 2 : (!e.mv && (firing || S.t - u.hitT < 6) ? (e.j < .45 ? 2 : 1) : 0); soldier(u.f.nat, e.x, e.z, e.hd, e.ph, pose, e.mv);
        if (firing && !ng && e.cd <= 0 && tdist < 1.6) { e.cd = (.5 + rnd() * 2.2) / fr; const y = R.hy(e.x, e.z) + .03, bx = txx + (rnd() - .5) * .22, bz = tzz + (rnd() - .5) * .22; glow.spawn(e.x + Math.cos(e.hd) * .03, y, e.z + Math.sin(e.hd) * .03, 0, 0, 0, .07, .035, .05, 1, .9, .55, 1); tracer(e.x, y, e.z, bx, R.hy(bx, bz) + .02, bz, .28, 1, .85, .45, .2); if (rnd() < .3) smoke.spawn(bx, R.hy(bx, bz) + .01, bz, 0, .08, 0, .5, .02, .05, dustCol[0], dustCol[1], dustCol[2], .6); }
      } else if (e.t === 'v') {
        let ta = e.hd; if (firing && v.combatV) ta = Math.atan2(tzz - e.z, txx - e.x); let d2 = ta - e.ta; while (d2 > Math.PI) d2 -= 6.283; while (d2 < -Math.PI) d2 += 6.283; e.ta += d2 * Math.min(1, dt * 3);
        const y = vehicle(e.key, e.x, e.z, e.hd, VEH[e.key].tur ? e.ta : e.hd);
        if (e.mv && rnd() < dt * (theme === 'desert' ? 9 : 4) * fr) smoke.spawn(e.x - Math.cos(e.hd) * .06, y + .015, e.z - Math.sin(e.hd) * .06, (rnd() - .5) * .03, .02 + rnd() * .03, (rnd() - .5) * .03, 1.2 + rnd(), .04, theme === 'desert' ? .22 : .12, dustCol[0], dustCol[1], dustCol[2], theme === 'desert' ? .45 : .25);
        if (firing && v.combatV && e.cd <= 0) { e.cd = (1.6 + rnd() * 3.5) / fr; const def = VEH[e.key], ga = def.tur ? e.ta : e.hd, gl = (def.gl || 3) * MS, mx = e.x + Math.cos(ga) * gl, mz = e.z + Math.sin(ga) * gl, my = y + (def.ty + .4) * MS; shot(u, mx, my, mz, txx, tzz, u.k.ir ? 2 : 1); }
      } else {
        const y = R.hy(e.x, e.z); const rc = e.rc > R.t ? (e.rc - R.t) * .08 : 0; base(e.x - Math.cos(e.hd) * rc, y, e.z - Math.sin(e.hd) * rc, e.hd, MS * 1.15); add(gget(e.key), tm);
        if (firing && e.cd <= 0) { e.cd = (u.k.ir ? 2.2 + rnd() * 3 : 1.6 + rnd() * 3) / fr; e.rc = R.t + .3; shot(u, e.x + Math.cos(e.hd) * .06, y + .05, e.z + Math.sin(e.hd) * .06, txx, tzz, u.k.ir ? (e.key === 'nebel' ? 3 : 2) : 1); }
      }
    }
    if (u.mv === 'ship' && show) { let m = ships.get(u.id); if (!m) { m = new THREE.Mesh(SCN.ship, R.matV); m.scale.setScalar(MS * .22 * (u.k.key === 'nav15' ? 1.3 : 1)); m.position.set(u.x, .0, u.y); m.rotation.y = 1; m.castShadow = true; scene.add(m); ships.set(u.id, m); } if (firing) { m.userData.cd = (m.userData.cd || 0) - dt; if (m.userData.cd <= 0) { m.userData.cd = (2.5 + rnd() * 3) / fr; shot(u, u.x + (rnd() - .5) * .4, .5, u.y + (rnd() - .5) * .4, txx, tzz, 4); } } }
    v.fresh = false;
  }
  function shot(u, mx, my, mz, tx, tz, kind) { // 1 direct gun, 2 howitzer, 3 rocket, 4 naval
    const sx = tx + (rnd() - .5) * (kind === 1 ? .2 : .45), sz = tz + (rnd() - .5) * (kind === 1 ? .2 : .45), ty = R.hy(clamp(sx, 0, map.w), clamp(sz, 0, map.h));
    flash(mx, my, mz, kind === 4 ? .5 : kind === 2 ? .2 : .14); for (let i = 0; i < (kind === 4 ? 6 : 3); i++) puff(mx + (rnd() - .5) * .04, my, mz + (rnd() - .5) * .04, kind === 4 ? .2 : .07, false, 1.6);
    if (kind === 1) { tracer(mx, my, mz, sx, ty + .03, sz, .22, 1, .7, .35, .3); after(.2, () => explosion(sx, sz, .45)); }
    else if (kind === 3) { const d = Math.hypot(sx - mx, sz - mz), n = 10; for (let i = 0; i < n; i++) after(i * .05, () => { const f = i / n; smoke.spawn(mx + (sx - mx) * f, my + Math.sin(f * Math.PI) * d * .18 + (ty - my) * f, mz + (sz - mz) * f, 0, .02, 0, 2.2, .06, .22, .8, .8, .78, .5); }); after(.7, () => explosion(sx, sz, 1.1)); }
    else after(.5 + rnd() * .6, () => explosion(sx, sz, kind === 4 ? 2.2 : 1.1));
  }

  // ---------- events ----------
  function handle(ev) {
    if (ev.k === 'air') {
      const f = ev.f, n = ev.kind === 'carpet' ? 14 : ev.kind === 'none' ? 0 : 6, ca = Math.cos(f.hd), sa = Math.sin(f.hd);
      for (let i = 0; i < n; i++) after(.2 + i * (ev.kind === 'carpet' ? .12 : .3) + rnd() * .2, () => { const along = ev.kind === 'carpet' ? (i - n / 2) * .16 : (rnd() - .5) * .5; explosion(ev.x + ca * along + (rnd() - .5) * .3, ev.y + sa * along + (rnd() - .5) * .3, ev.kind === 'carpet' ? 1.7 : 1.4, { fire: rnd() < .25 ? 20 : 0 }); });
      if (ev.kind === 'rocket') for (let i = 0; i < 8; i++) after(i * .12, () => { const y = R.hy(f.x, f.y) + .8; tracer(f.x, y, f.y, ev.x + (rnd() - .5) * .3, R.hy(ev.x, ev.y), ev.y + (rnd() - .5) * .3, .35, 1, .8, .5, .5); });
    } else if (ev.k === 'dogfight') { for (let i = 0; i < 14; i++) after(i * .12, () => { const a = rnd() * 6.28, y = R.hy(clamp(ev.x, 0, map.w), clamp(ev.y, 0, map.h)) + 1.5; tracer(ev.x + Math.cos(a) * .6, y + rnd() * .3, ev.y + Math.sin(a) * .6, ev.x - Math.cos(a) * .5, y + rnd() * .3, ev.y - Math.sin(a) * .5, .3, 1, .9, .5, .3); }); for (let i = 0; i < Math.min(3, ev.lf + ev.li); i++) after(.5 + i * .7, () => falling.push({ x: ev.x, y: R.hy(clamp(ev.x, 0, map.w), clamp(ev.y, 0, map.h)) + 1.5, z: ev.y, vx: (rnd() - .5) * 1.2, vy: -.35, vz: (rnd() - .5) * 1.2 })); }
    else if (ev.k === 'bridge') { R.syncBridges(); if (ev.blown) for (let i = 0; i < 5; i++) after(i * .15, () => explosion(ev.b.x + (rnd() - .5) * .3, ev.b.y + (rnd() - .5) * .3, 2, { noCrater: true })); R.pings.push({ x: ev.b.x, y: ev.b.y, t: R.t }); }
    else if (ev.k === 'flakhit') { explosion(ev.x, ev.y, .5, { noCrater: true }); }
    else if (ev.k === 'shell') { for (let i = 0; i < 2; i++) after(i * .2, () => explosion(ev.x + (rnd() - .5) * .5, ev.y + (rnd() - .5) * .5, .6, { noCrater: true })); }
    else if (ev.k === 'convoyLost') { for (let i = 0; i < 3; i++) wreck(ev.x + (rnd() - .5) * .3, ev.y + (rnd() - .5) * .3, rnd() * 6, true); }
    else if (ev.k === 'townfire') { for (let i = 0; i < 6; i++) after(i * .25, () => explosion(ev.x + (rnd() - .5) * .8, ev.y + (rnd() - .5) * .8, 1.6, { fire: 60 })); }
    else if (ev.k === 'transit' || ev.k === 'airdrop') { const e = Object.assign({}, ev); if (ev.k === 'airdrop') { e.mode = 'air'; e.from = [ev.x > map.w / 2 ? 0 : map.w, clamp(ev.y + 8, 0, map.h)]; e.t0 = S.t; e.dur = 14; e.drop = true; e.nat = 'US'; } e.dropped = false; transits.push(e); }
    else if (ev.k === 'dead') { const v = vis.get(ev.u.id); if (v) { const show = S.player < 0 || ev.u.s === S.player || S.t - ev.u.seenT < 8; if (show) for (const e of v.els) if (!e.dead) { if (e.t === 's') fallen[ev.u.f.nat].put(e.x, e.z, rnd() * 6, MS * SOLS, R.hy(e.x, e.z) + .006, 1); else wreck(e.x, e.z, e.hd, !v.combatV && e.t === 'v'); } vis.delete(ev.u.id); } }
  }
  const cvis = new Map();
  R.update = function (dt, gs) {
    R.t += dt; for (const ev of S.ev) handle(ev); S.ev.length = 0; if (R.updOwn) R.updOwn(); if (R.updDepots) R.updDepots();
    for (const im of dyn) im.count = 0; for (const k in pUse) pUse[k] = 0;
    for (const u of S.subs) { if (!u.active || u.dead) continue; const show = S.player < 0 || u.s === S.player || S.t - u.seenT < 8 || (u.rpBy === S.player && S.t - u.rptT < 10); u.vis = show; if (show) { u.lsx = u.x; u.lsy = u.y; u.lsT = S.t; } updateSub(u, dt, gs, show); }
    // convoys
    for (const c of S.convoys) { if (c.dead) { cvis.delete(c.id); continue; } let v = cvis.get(c.id); if (!v) { v = { trail: [[c.x, c.y]], hx: c.x, hz: c.y, fa: 0 }; cvis.set(c.id, v); } const kh = 1 - Math.exp(-dt * (3 + gs)); v.hx += (c.x - v.hx) * kh; v.hz += (c.y - v.hz) * kh; v.fa = Math.atan2(c.hy, c.hx); const t0 = v.trail[0]; if (Math.hypot(v.hx - t0[0], v.hz - t0[1]) > .05) { v.trail.unshift([v.hx, v.hz]); if (v.trail.length > 30) v.trail.pop(); } const show = S.player < 0 || c.s === S.player || (c.rpBy === S.player && S.t - c.rptT < 30); if (!show) { let seen = false; for (const u of S.subs) if (u.s !== c.s && u.active && !u.dead && Math.hypot(u.x - c.x, u.y - c.y) < 2.5) { seen = true; break; } if (!seen) continue; } const key = c.F.nat === 'US' ? 'truck_us' : c.F.nat === 'UK' ? 'truck_uk' : c.F.nat === 'IT' ? 'truck_it' : 'truck_ge'; for (let i = 0; i < 4; i++) { trailAt(v, i * .19, tp); const y = vehicle(key, tp[0], tp[1], tp[2], tp[2]); if (gs > 0 && theme === 'desert' && rnd() < dt * 5) smoke.spawn(tp[0], y + .01, tp[1], 0, .03, 0, 1.4, .04, .2, dustCol[0], dustCol[1], dustCol[2], .4); } }
    // flights
    for (const f of S.flights) {
      if (f.st === 'gone') continue; const np = clamp(Math.round(f.n / 3), 1, 4), gx = clamp(f.x, 0, map.w), gz = clamp(f.y, 0, map.h), dT = Math.hypot(f.tgt.x - f.x, f.tgt.y - f.y), low = (f.st === 'attack' || (f.st === 'out' && dT < 3)) && f.ac[1] !== 'HB' && f.ac[1] !== 'B';
      f.alt = (f.alt == null ? 1.5 : f.alt) + ((low ? .55 : f.ac[1] === 'HB' ? 2.2 : 1.5) - (f.alt == null ? 1.5 : f.alt)) * Math.min(1, dt * 1.2); const y = R.hy(gx, gz) + f.alt, roll = clamp((f.turn || 0) * 3, -1, 1), ca = Math.cos(f.hd), sa = Math.sin(f.hd);
      for (let i = 0; i < np; i++) { const bk = (i + 1 >> 1) * .32, sd = (i % 2 ? 1 : -1) * (i + 1 >> 1) * .3; plane(f.ac[5], f.x - ca * bk - sa * sd, y + (i % 2) * .05, f.y - sa * bk + ca * sd, f.hd, roll, low && f.st === 'out' ? -.25 : 0); }
      if (gs > 0 && f.st === 'attack' && low && dT < 2.2 && rnd() < dt * 5) { const bx = f.x + ca * 1.2 + (rnd() - .5) * .3, bz = f.y + sa * 1.2 + (rnd() - .5) * .3; if (bx > 0 && bz > 0 && bx < map.w && bz < map.h) { tracer(f.x, y, f.y, bx, R.hy(bx, bz), bz, .25, 1, .85, .4, .35); smoke.spawn(bx, R.hy(bx, bz) + .01, bz, 0, .1, 0, .6, .03, .08, dustCol[0], dustCol[1], dustCol[2], .7); } }
    }
    for (const k in planes) for (let i = pUse[k] || 0; i < planes[k].length; i++) planes[k][i].visible = false;
    // transits (landing craft, troop carriers)
    for (const e of transits) {
      const p = clamp((S.t - e.t0) / e.dur, 0, 1.6);
      if (e.mode === 'sea') { if (p >= 1) { e.done = true; continue; } const dx = e.x - e.from[0], dz = e.y - e.from[1], a = Math.atan2(dz, dx); for (let i = 0; i < 7; i++) { const lat = (i - 3) * .28, lag = (i % 3) * .5, q = clamp(p * 1.15 - lag * .05, 0, 1), x = e.from[0] + dx * q - Math.sin(a) * lat, z = e.from[1] + dz * q + Math.cos(a) * lat; if (map.tAt(clamp(x, 0, map.w - .1), clamp(z, 0, map.h - .1)) !== T.SEA && q < .98) continue; base(x, .0, z, a, MS * .9); add(lcvp, tm); if (gs > 0 && rnd() < dt * 6) smoke.spawn(x - Math.cos(a) * .1, .01, z - Math.sin(a) * .1, 0, .01, 0, 1.2, .05, .16, .95, .97, 1, .5); } }
      else { const dx = e.x - e.from[0], dz = e.y - e.from[1], a = Math.atan2(dz, dx), q = p / .8, gy = R.hy(e.x, e.y); if (p >= 1.6) { e.done = true; continue; }
        for (let i = 0; i < (e.drop ? 3 : 5); i++) { const bk = (i + 1 >> 1) * .5, sd = (i % 2 ? 1 : -1) * (i + 1 >> 1) * .45, x = e.from[0] + dx * q - Math.cos(a) * bk - Math.sin(a) * sd, z = e.from[1] + dz * q - Math.sin(a) * bk + Math.cos(a) * sd; plane('c47', x, gy + 1.0, z, a, 0, 0); if (e.glider && q < 1) plane('glider', x - Math.cos(a) * .6, gy + .95, z - Math.sin(a) * .6, a, 0, 0); }
        if (q >= .93 && !e.dropped) { e.dropped = true; const n = e.drop ? 14 : 36; for (let i = 0; i < n; i++) { const along = (rnd() - .5) * 2.2, lat = (rnd() - .5) * .9; chutes.push({ x: e.x + Math.cos(a) * along - Math.sin(a) * lat, z: e.y + Math.sin(a) * along + Math.cos(a) * lat, y: 1.0, t: -rnd() * 2.5, col: e.drop ? [0xd04a3a, 0xe0c040, 0x4a7ad0][i % 3] : (e.nat === 'UK' ? 0xb8a780 : 0xc9cdb4), sw: rnd() * 6 }); } if (e.glider) for (let i = 0; i < 5; i++) gliders.push({ x: e.x + (rnd() - .5) * 2, z: e.y + (rnd() - .5) * 1.6, a: a + (rnd() - .5), t: R.t }); }
      }
    }
    transits = transits.filter(e => !e.done);
    let ci = 0; for (const c of chutes) { c.t += dt * (gs > 0 ? 1 : 0); if (c.t < 0) continue; c.y -= dt * .16 * (gs > 0 ? 1 : 0); const gy = R.hy(clamp(c.x, 0, map.w), clamp(c.z, 0, map.h)); if (c.y <= 0) { c.done = true; continue; } R.dummy.position.set(c.x + Math.sin(c.t * 2 + c.sw) * .02, gy + c.y, c.z); R.dummy.rotation.set(Math.sin(c.t * 2 + c.sw) * .15, c.sw, 0); R.dummy.scale.setScalar(MS * 1.5); R.dummy.updateMatrix(); if (chuteI.count < chuteI.cap) { chuteI.setMatrixAt(chuteI.count, R.dummy.matrix); chuteI.setColorAt(chuteI.count, _c.set(c.col)); chuteI.count++; ci++; } }
    if (ci && chuteI.instanceColor) chuteI.instanceColor.needsUpdate = true; chutes = chutes.filter(c => !c.done);
    gliders = gliders.filter(g => R.t - g.t < 240); for (const g of gliders) plane('glider', g.x, R.hy(clamp(g.x, 0, map.w), clamp(g.z, 0, map.h)) + .03, g.z, g.a, 0, 0);
    // timers, emitters, falling aircraft
    if (timers.length) { const due = timers.filter(t => t.t <= R.t); timers = timers.filter(t => t.t > R.t); for (const t of due) t.fn(); }
    emitters = emitters.filter(e => e.until > R.t); if (emitters.length > 120) emitters.splice(0, emitters.length - 120);
    for (const e of emitters) { if (rnd() < dt * 14) glow.spawn(e.x + (rnd() - .5) * .07 * e.s, e.y + .02, e.z + (rnd() - .5) * .07 * e.s, WIND[0], .12 + rnd() * .12, WIND[1], .5 + rnd() * .4, .1 * e.s, .03, 1, .45 + rnd() * .3, .1, .85); if (rnd() < dt * 7) { const c = .1 + rnd() * .12; smoke.spawn(e.x, e.y + .08, e.z, WIND[0] * 2 + (rnd() - .5) * .03, .14 + rnd() * .1, WIND[1] * 2 + (rnd() - .5) * .03, 4 + rnd() * 4, .1 * e.s, .7 * e.s, c, c, c, .6); } }
    for (const t of map.towns) if (t.fire > .05 && t.pts && t.pts.length) { if (!t.charred && t.fire > .4) R.charTown(t); if (rnd() < dt * 10 * t.fire) { const p = t.pts[(rnd() * t.pts.length) | 0], y = R.hy(p[0], p[1]) + .1; glow.spawn(p[0], y, p[1], WIND[0], .15, WIND[1], .7, .16, .05, 1, .5, .12, .9); const c = .12 + rnd() * .1; smoke.spawn(p[0], y + .1, p[1], WIND[0] * 2, .16 + rnd() * .1, WIND[1] * 2, 6 + rnd() * 4, .15, 1.0, c, c, c, .6); } }
    for (const f of falling) { f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vy -= .25 * dt; const c = .15; smoke.spawn(f.x, f.y, f.z, 0, .02, 0, 2.5, .06, .3, c, c, c, .7); glow.spawn(f.x, f.y, f.z, 0, 0, 0, .15, .08, .03, 1, .6, .2, 1); const gx = clamp(f.x, 0, map.w), gz = clamp(f.z, 0, map.h); if (f.y <= R.hy(gx, gz)) { f.done = true; explosion(gx, gz, 1.6, { fire: 30 }); } }
    falling = falling.filter(f => !f.done);
    smoke.update(dt); glow.update(dt);
    // tracers
    let n = 0; for (const t of tracers) { t.t += dt; const p = t.t / t.life; if (p >= 1) continue; const p0 = p, p1 = Math.min(1, p + t.len); for (let k = 0; k < 3; k++) { tpos[n * 6 + k] = t.a[k] + (t.b[k] - t.a[k]) * p0; tpos[n * 6 + 3 + k] = t.a[k] + (t.b[k] - t.a[k]) * p1; tcol[n * 6 + k] = t.c[k] * .3; tcol[n * 6 + 3 + k] = t.c[k]; } n++; }
    tracers = tracers.filter(t => t.t < t.life); tg.setDrawRange(0, n * 2); tg.attributes.position.needsUpdate = tg.attributes.color.needsUpdate = true;
    for (const im of dyn) im.instanceMatrix.needsUpdate = true;
    // light and weather
    const night = S.night, wx = S.wx, dim = night ? .22 : wx === 'clear' ? 1 : wx === 'cloud' ? .92 : wx === 'overcast' ? .74 : .66;
    R.sun.intensity = (night ? .1 : wx === 'clear' || wx === 'cloud' ? .8 : .3) ; R.hemi.intensity = .64 * dim + (night ? .08 : 0); R.hemi.color.setHex(night ? 0x8fa2d8 : 0xffffff);
    const sc0 = R.renderer.domElement.height / (2 * Math.tan(R.camera.fov * Math.PI / 360)); smoke.mat.uniforms.scale.value = sc0; glow.mat.uniforms.scale.value = sc0;
    R.stepGlide(dt); R.updateCamera(); R.renderer.render(scene, R.camera); R.drawOverlay(dt, gs);
  };
  R.visOf = u => vis.get(u.id);
}
