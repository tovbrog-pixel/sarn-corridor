// ===== RENDERER CORE: terrain, map texture, camera, static scenery =====
const NATCOL = { US: '#5d6b3d', UK: '#a58a55', GE: '#6d7479', IT: '#3f7f86' };
function createRenderer(S, glCanvas, ovCanvas, opt) {
  opt = opt || {}; const map = S.map, sc = S.sc, theme = sc.theme, cs = map.cs, year = S.d0.getUTCFullYear();
  const R = { S, map, sc, theme, t: 0, speed: 0, sel: null, draw: null, showAll: true, pings: [], hover: null };
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0x191a18);
  renderer.shadowMap.enabled = !opt.noShadow; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .2, 600);
  R.renderer = renderer; R.scene = scene; R.camera = camera;
  // ---- fine elevation grid
  const FW = map.W * 2 + 1, FH = map.H * 2 + 1, fine = new Float32Array(FW * FH), fs = cs / 2; let maxEl = 1;
  for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) { const x = Math.min(map.w - .01, i * fs), y = Math.min(map.h - .01, j * fs), t = map.tAt(x, y); let e = t === T.SEA ? -70 : Math.max(1, map.elevAt(x, y)); if (t === T.BEACH) e = Math.min(e, 3); if (t === T.RIVER) e = Math.max(1, e - 6); fine[j * FW + i] = e; if (e > maxEl) maxEl = e; }
  // smooth the coastline: blur the sea mask and blend elevations across it
  if (sc.sea || sc.raster) { let mk = new Float32Array(FW * FH); for (let c = 0; c < FW * FH; c++) mk[c] = fine[c] < 0 ? 1 : 0; for (let k = 0; k < 3; k++) { const o = new Float32Array(FW * FH); for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) { let a = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const x = i + di, y = j + dj; if (x >= 0 && y >= 0 && x < FW && y < FH) { a += mk[y * FW + x]; n++; } } o[j * FW + i] = a / n; } mk = o; }
    for (let c = 0; c < FW * FH; c++) { const b = mk[c]; if (b > .5) fine[c] = -70 * (b - .5) * 2 - .5; else if (b > 0) fine[c] = Math.max(1, Math.max(1, fine[c]) * (1 - 2 * b) + 2); } }
  // carve river valleys and wadis into the relief (visual only; the simulation grid is unchanged)
  (function carve() {
    const INF = 1e6, run = (cls, depth, rad) => {
      const d = new Float32Array(FW * FH).fill(INF); let any = false;
      for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) { const c = map.idx(Math.min(map.w - .01, i * fs), Math.min(map.h - .01, j * fs)); if (map.riv[c] === cls) { d[j * FW + i] = 0; any = true; } }
      if (!any) return;
      for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) { const c = j * FW + i; let v = d[c]; if (i) v = Math.min(v, d[c - 1] + 1); if (j) { v = Math.min(v, d[c - FW] + 1); if (i) v = Math.min(v, d[c - FW - 1] + 1.414); if (i < FW - 1) v = Math.min(v, d[c - FW + 1] + 1.414); } d[c] = v; }
      for (let j = FH - 1; j >= 0; j--) for (let i = FW - 1; i >= 0; i--) { const c = j * FW + i; let v = d[c]; if (i < FW - 1) v = Math.min(v, d[c + 1] + 1); if (j < FH - 1) { v = Math.min(v, d[c + FW] + 1); if (i < FW - 1) v = Math.min(v, d[c + FW + 1] + 1.414); if (i) v = Math.min(v, d[c + FW - 1] + 1.414); } d[c] = v; }
      const R0 = rad / fs; for (let c = 0; c < FW * FH; c++) if (fine[c] > 0 && d[c] < R0) { const q = 1 - d[c] / R0; fine[c] = Math.max(1, fine[c] - depth * q * q * Math.min(1, fine[c] / 40 + .35)); }
    };
    run(1, 34, 1.8); run(2, 18, 1.1);
  })();
  maxEl = 1; for (let c = 0; c < FW * FH; c++) if (fine[c] > maxEl) maxEl = fine[c];
  const VEX = clamp(Math.max(map.w, map.h) * .045 / (maxEl / 1000), 3, 10) / 1000; R.VEX = VEX;
  const elAt = (x, y) => { const fx = clamp(x / fs, 0, FW - 1.001), fy = clamp(y / fs, 0, FH - 1.001), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, c = j * FW + i; return fine[c] * (1 - u) * (1 - v) + fine[c + 1] * u * (1 - v) + fine[c + FW] * (1 - u) * v + fine[c + FW + 1] * u * v; };
  R.hy = (x, z) => Math.max(0, elAt(x, z)) * VEX; R.elAt = elAt;

  // ---- tactical map texture
  const ppk = Math.floor((opt.texSize || 4096) / Math.max(map.w, map.h)), TW = Math.round(map.w * ppk), TH = Math.round(map.h * ppk);
  const tex = document.createElement('canvas'); tex.width = TW; tex.height = TH; const tc = tex.getContext('2d');
  const PAL = {
    temperate: { 0: [222, 226, 190], 1: [196, 214, 164], 2: [168, 196, 142], 3: [224, 214, 172], 4: [203, 182, 140], 5: [217, 210, 178], 6: [233, 217, 169], 7: [140, 180, 120], 8: [240, 228, 184], 9: [205, 224, 208], 10: [214, 198, 184], 11: [204, 184, 170], 12: [184, 214, 230], 13: [150, 196, 222], 14: [222, 226, 190] , 15: [196, 210, 158] },
    med: { 0: [228, 226, 184], 1: [204, 214, 160], 2: [174, 196, 138], 3: [226, 210, 164], 4: [204, 180, 138], 5: [220, 208, 172], 6: [233, 217, 169], 7: [140, 180, 120], 8: [243, 232, 190], 9: [200, 222, 206], 10: [218, 200, 182], 11: [208, 186, 168], 12: [176, 212, 232], 13: [146, 194, 222], 14: [228, 226, 184] , 15: [196, 210, 158] },
    desert: { 0: [232, 216, 170], 1: [208, 208, 152], 2: [180, 190, 134], 3: [222, 196, 142], 4: [198, 164, 116], 5: [222, 200, 148], 6: [234, 218, 172], 7: [140, 180, 120], 8: [240, 228, 184], 9: [205, 224, 208], 10: [226, 210, 180], 11: [214, 196, 168], 12: [184, 214, 230], 13: [150, 196, 222], 14: [224, 206, 160] , 15: [196, 210, 158] },
    snow: { 0: [240, 243, 240], 1: [214, 226, 212], 2: [182, 204, 184], 3: [230, 232, 224], 4: [210, 208, 200], 5: [226, 228, 222], 6: [240, 243, 240], 7: [140, 180, 120], 8: [240, 228, 184], 9: [214, 226, 228], 10: [222, 216, 210], 11: [208, 200, 194], 12: [184, 214, 230], 13: [170, 204, 224], 14: [236, 240, 240] , 15: [196, 210, 158] },
  }[theme];
  (function paint() {
    const bw = Math.ceil(TW / 2), bh = Math.ceil(TH / 2), img = tc.createImageData(bw, bh), d = img.data, ci = maxEl > 500 ? 100 : maxEl > 180 ? 50 : 10, k = 2 / ppk;
    const row = new Float32Array(bw + 1); let prev = new Float32Array(bw + 1);
    for (let j = 0; j < bh; j++) {
      for (let i = 0; i <= bw; i++) row[i] = elAt(i * k, j * k);
      for (let i = 0; i < bw; i++) {
        const x = i * k, y = j * k, e = row[i], jx = (vnoise(x * 2.3, y * 2.3, 5) - .5) * cs * 1.1, jy = (vnoise(x * 2.3 + 40, y * 2.3, 9) - .5) * cs * 1.1;
        let t = map.tAt(clamp(x + jx, 0, map.w - .01), clamp(y + jy, 0, map.h - .01)); if (e < 0) t = T.SEA; else if (t === T.SEA) t = sc.base === 'desert' ? T.DESERT : T.OPEN; if (t === T.RIVER || t === T.STREAM) t = sc.base === 'desert' ? T.DESERT : T.OPEN;
        const p = PAL[t] || PAL[0]; let r = p[0], g = p[1], b = p[2];
        if (t !== T.SEA) {
          const ex = row[i + 1] - e, ey = j ? e - prev[i] : 0, sh = clamp(1 + (-ex - ey) * VEX * 1000 / (k * 1000) * .32, .7, 1.24); r *= sh; g *= sh; b *= sh;
          const c0 = Math.floor(e / ci), c1 = Math.floor(row[i + 1] / ci), c2 = j ? Math.floor(prev[i] / ci) : c0;
          if (c0 !== c1 || c0 !== c2) { const idxc = Math.max(c0, c1, c2) % 5 === 0 ? .55 : .3; r += (128 - r) * idxc; g += (88 - g) * idxc; b += (52 - b) * idxc; }
          if (t === T.ROUGH || t === T.DESERT || t === T.BEACH) { if (hash2(i, j, 3) < (t === T.ROUGH ? .09 : .035)) { r *= .8; g *= .8; b *= .78; } }
          if (t === T.MARSH && sc.mines) { r = r * .5 + 112; g = g * .5 + 92; b = b * .5 + 70; if (hash2(i, j, 4) < .06) { r = 176; g = 44; b = 34; } } else if (t === T.MARSH && j % 6 === 0 && hash2(i >> 3, j, 4) < .45) { r = 120; g = 170; b = 200; }
        } else { const dd = Math.min(1, (-e) / 70); r -= 14 * (1 - dd); g -= 6 * (1 - dd); if (((j + Math.floor(vnoise(x, y, 2) * 6)) % 14) === 0) { r -= 10; g -= 6; } }
        const n = (hash2(i, j, 1) - .5) * 7, o = (j * bw + i) * 4; d[o] = r + n; d[o + 1] = g + n; d[o + 2] = b + n; d[o + 3] = 255;
      }
      const tmp = prev; prev = row.slice(); void tmp;
    }
    const b = document.createElement('canvas'); b.width = bw; b.height = bh; b.getContext('2d').putImageData(img, 0, 0); tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high'; tc.drawImage(b, 0, 0, TW, TH);
    const line = (pts, w, col, dash) => { tc.beginPath(); tc.lineWidth = w; tc.strokeStyle = col; tc.lineJoin = 'round'; tc.lineCap = 'round'; tc.setLineDash(dash || []); pts.forEach((p, i) => i ? tc.lineTo(p[0] * ppk, p[1] * ppk) : tc.moveTo(p[0] * ppk, p[1] * ppk)); tc.stroke(); tc.setLineDash([]); };
    for (const r of map.riverLines) { const w = r.cls === 1 ? (/Canal|vaart/.test(r.name) ? .13 : .26) : .07; line(r.pts, w * ppk + 2, '#4d86ad'); line(r.pts, w * ppk, '#9ccbe6'); }
    for (const t of map.towns) { tc.fillStyle = 'rgba(70,60,55,.5)'; const n = t.size >= 3 ? 60 : t.size === 2 ? 22 : 8, rr = t.size >= 3 ? 1.6 : t.size === 2 ? .85 : .4; for (let i = 0; i < n; i++) { const a = hash2(i, 7, t.x * 10 | 0) * 6.28, q = Math.sqrt(hash2(i, 9, t.y * 10 | 0)) * rr; tc.fillRect((t.x + Math.cos(a) * q) * ppk - 3, (t.y + Math.sin(a) * q) * ppk - 2, 4 + hash2(i, 1, 2) * 5, 3 + hash2(i, 2, 3) * 4); } }
    for (const r of map.roadLines) if (r.cls === 1) line(r.pts, 1.6, '#5b4a38', [7, 5]);
    for (const r of map.roadLines) if (r.cls === 2) { line(r.pts, 4.2, '#3b3530'); line(r.pts, 2.2, '#efe9d6'); }
    for (const r of map.roadLines) if (r.cls === 3) { line(r.pts, 5.6, '#3b2a24'); line(r.pts, 3.4, '#c0503f'); }
    tc.strokeStyle = 'rgba(30,30,30,.33)'; tc.fillStyle = 'rgba(30,30,30,.6)'; tc.lineWidth = 1.2; tc.font = 'bold ' + Math.round(ppk * .55) + 'px "Courier New",monospace';
    for (let x = 10; x < map.w; x += 10) { tc.beginPath(); tc.moveTo(x * ppk, 0); tc.lineTo(x * ppk, TH); tc.stroke(); tc.fillText(String(x).padStart(2, '0'), x * ppk + 4, ppk * .7); tc.fillText(String(x).padStart(2, '0'), x * ppk + 4, TH - ppk * .3); }
    for (let y = 10; y < map.h; y += 10) { tc.beginPath(); tc.moveTo(0, y * ppk); tc.lineTo(TW, y * ppk); tc.stroke(); tc.fillText(String(y).padStart(2, '0'), 4, y * ppk - 4); tc.fillText(String(y).padStart(2, '0'), TW - ppk * .9, y * ppk - 4); }
    tc.strokeStyle = '#2a2622'; tc.lineWidth = 6; tc.strokeRect(3, 3, TW - 6, TH - 6);
    tc.fillStyle = 'rgba(40,36,30,.75)'; tc.font = 'bold ' + Math.round(ppk * .8) + 'px "Courier New",monospace'; tc.fillText(sc.title.toUpperCase() + '  1:' + (theme === 'desert' ? '200,000' : '100,000'), ppk * .6, TH - ppk * 1.4);
    tc.fillRect(ppk * .6, TH - ppk * 1.1, ppk * 5, ppk * .12); tc.font = Math.round(ppk * .5) + 'px "Courier New",monospace'; tc.fillText('5 KM', ppk * 5.8, TH - ppk * .85);
  })();
  const texture = new THREE.CanvasTexture(tex); texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (THREE.sRGBEncoding) { texture.encoding = THREE.sRGBEncoding; renderer.outputEncoding = THREE.sRGBEncoding; }
  // ---- terrain mesh
  (function terrain() {
    const pos = new Float32Array(FW * FH * 3), uv = new Float32Array(FW * FH * 2), idx = new Uint32Array((FW - 1) * (FH - 1) * 6);
    for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) { const c = j * FW + i, e = fine[c]; pos[c * 3] = i * fs; pos[c * 3 + 1] = e < 0 ? -.12 : e * VEX; pos[c * 3 + 2] = j * fs; uv[c * 2] = i * fs / map.w; uv[c * 2 + 1] = 1 - j * fs / map.h; }
    let q = 0; for (let j = 0; j < FH - 1; j++) for (let i = 0; i < FW - 1; i++) { const a = j * FW + i, b = a + 1, c = a + FW, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: texture })); m.receiveShadow = true; m.castShadow = true; scene.add(m); R.terrain = m;
    // a coarser triangle set over the same vertices, every second point, for Low graphics: a quarter of the triangles
    { const W2 = Math.floor((FW - 1) / 2), H2 = Math.floor((FH - 1) / 2), lo = new Uint32Array(W2 * H2 * 6); let k = 0; for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) { const a = 2 * j * FW + 2 * i, b = a + 2, c = a + 2 * FW, d = c + 2; lo[k++] = a; lo[k++] = c; lo[k++] = b; lo[k++] = b; lo[k++] = c; lo[k++] = d; }
      R.terrIdx = [g.index, new THREE.BufferAttribute(lo, 1)]; }
    // held ground: every cell of the map tinted blue (Allied) or red (Axis) from the sim's ownership grid, as far as the player's staff knows it, with the front line traced between them
    { const O = S.own, gw = O.gw, gh = O.gh, cw = O.cw, data = new Uint8Array(gw * gh * 4), tex = new THREE.DataTexture(data, gw, gh, THREE.RGBAFormat); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
      const geo = g.clone(), uvs = geo.attributes.uv; for (let k = 0; k < uvs.count; k++) { uvs.setX(k, uvs.getX(k) * map.w / (gw * cw)); uvs.setY(k, 1 - (1 - uvs.getY(k)) * map.h / (gh * cw)); }
      const om = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); om.renderOrder = 1; scene.add(om);
      const sea = new Uint8Array(gw * gh); for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) sea[j * gw + i] = map.tAt(Math.min(map.w - .01, (i + .5) * cw), Math.min(map.h - .01, (j + .5) * cw)) === T.SEA ? 1 : 0;
      const view = O.a.slice(), fld = new Float32Array(gw * gh);
      R.own = { on: true, t: -99, mesh: om, front: [], view };
      R.updOwn = function (force) {
        om.visible = R.own.on; if (!R.own.on || (!force && Math.abs(S.t - R.own.t) < 4)) return; R.own.t = S.t; const P = S.player;
        // the staff map shows true ownership near your troops, near objectives and where reconnaissance has looked; elsewhere it keeps the last picture
        if (P < 0) view.set(O.a); else { const look = (x, y, r) => { const i0 = Math.max(0, Math.floor((x - r) / cw)), i1 = Math.min(gw - 1, Math.floor((x + r) / cw)), j0 = Math.max(0, Math.floor((y - r) / cw)), j1 = Math.min(gh - 1, Math.floor((y + r) / cw)); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = j * gw + i; view[c] = O.a[c]; } };
          for (const u of S.subs) if (u.s === P && u.active && !u.dead && u.mv !== 'ship') look(u.x, u.y, 4); for (const v of S.vp) look(v.x, v.y, 1); for (const u of S.subs) if (u.s !== P && u.rpBy === P && S.t - u.rptT < 10) look(u.x, u.y, 2.5); }
        for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const c = j * gw + i, o = ((gh - 1 - j) * gw + i) * 4; if (P >= 0 && O.a[c] === P) view[c] = P;   /* ground you hold shows as yours: no stale enemy patches behind your own line */ const s0 = view[c] === 0; if (sea[c]) { data[o + 3] = 0; continue; }
          data[o] = s0 ? 52 : 210; data[o + 1] = s0 ? 40 : 55; data[o + 2] = s0 ? 150 : 40; data[o + 3] = s0 ? 74 : 64; }
        tex.needsUpdate = true;
        // front line: marching squares at the half-way level of a lightly smoothed ownership field
        for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { let a = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue; a += view[jj * gw + ii]; n++; } fld[j * gw + i] = a / n - .5; }
        const fr = [];
        for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) { const c0 = j * gw + i, c1 = c0 + 1, c2 = c0 + gw, c3 = c2 + 1; if (sea[c0] && sea[c1] && sea[c2] && sea[c3]) continue;
          const v = [fld[c0], fld[c1], fld[c3], fld[c2]], Pp = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], pts = [];
          for (let k = 0; k < 4; k++) { const a = v[k], b = v[(k + 1) % 4]; if ((a > 0) !== (b > 0)) { const t = a / (a - b), p = Pp[k], q = Pp[(k + 1) % 4]; pts.push([((p[0] + (q[0] - p[0]) * t) + .5) * cw, ((p[1] + (q[1] - p[1]) * t) + .5) * cw]); } }
          if (pts.length >= 2) fr.push([pts[0], pts[1]]); if (pts.length === 4) fr.push([pts[2], pts[3]]); }
        R.own.front = fr; };
    }
    if (sc.sea || sc.raster) { const w = new THREE.Mesh(new THREE.PlaneGeometry(map.w, map.h), new THREE.MeshPhongMaterial({ color: 0x92c6ea, transparent: true, opacity: .7, shininess: 12, specular: 0x1a2630, emissive: 0x16304a })); w.rotation.x = -Math.PI / 2; w.position.set(map.w / 2, 0, map.h / 2); scene.add(w); }
    const tb = new THREE.Mesh(new THREE.PlaneGeometry(map.w + 400, map.h + 400), new THREE.MeshLambertMaterial({ color: 0x24221e })); tb.rotation.x = -Math.PI / 2; tb.position.set(map.w / 2, -.2, map.h / 2); tb.receiveShadow = true; scene.add(tb);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(map.w + 1.2, .14, map.h + 1.2), new THREE.MeshLambertMaterial({ color: 0x3a3229 })); fr.position.set(map.w / 2, -.13, map.h / 2); scene.add(fr);
  })();
  // ---- ribbons (roads, rivers)
  function ribbon(lines, width, color, yoff) {
    const p = [], ix = []; let base = 0;
    for (const pts of lines) { for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; const x = pts[i][0], z = pts[i][1], w2 = .06 + fs * .5; let h = R.hy(x, z); for (let q = 0; q < 8; q++) { const an = q * .785; h = Math.max(h, R.hy(clamp(x + Math.cos(an) * w2, 0, map.w), clamp(z + Math.sin(an) * w2, 0, map.h))); } h += yoff; p.push(x - dy * width / 2, h, z + dx * width / 2, x + dy * width / 2, h, z - dx * width / 2); if (i) { const q = base + i * 2; ix.push(q - 2, q - 1, q, q - 1, q + 1, q); } } base += pts.length * 2; }
    if (!p.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 - yoff * 60, polygonOffsetUnits: -2 - yoff * 200 })); scene.add(m); return m;
  }
  const rl = c => map.roadLines.filter(r => r.cls === c).map(r => r.pts);
  ribbon(map.riverLines.filter(r => r.cls === 1 && !/Canal|vaart/.test(r.name)).map(r => r.pts), .26, 0x86b9d8, .014);
  ribbon(map.riverLines.filter(r => r.cls === 1 && /Canal|vaart/.test(r.name)).map(r => r.pts), .13, 0x86b9d8, .014);
  ribbon(map.riverLines.filter(r => r.cls === 2).map(r => r.pts), .07, 0x8fc1dc, .014);
  // railways: a ballast bed, sleepers across it and two rails, so the line reads as track at every zoom
  if (map.sc.rails && map.sc.rails.length) { const RL = map.sc.rails.filter(l => l.length > 1);
    const shift = (pts, d) => pts.map((q, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; return [clamp(q[0] - dy / l * d, 0, map.w), clamp(q[1] + dx / l * d, 0, map.h)]; });
    ribbon(RL, .1, 0x8a8172, .05);
    { const p = [], ix = [], gap = .32, half = .062, thick = .022; let n = 0;   // sleepers
      for (const pts of RL) { let carry = gap / 2; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy); if (l < 1e-6) continue; dx /= l; dy /= l;
          let d = carry; for (; d < l; d += gap) { const x = a[0] + dx * d, z = a[1] + dy * d, h = R.hy(clamp(x, 0, map.w), clamp(z, 0, map.h)) + .056;
            p.push(x - dy * half - dx * thick, h, z + dx * half - dy * thick, x + dy * half - dx * thick, h, z - dx * half - dy * thick, x - dy * half + dx * thick, h, z + dx * half + dy * thick, x + dy * half + dx * thick, h, z - dx * half + dy * thick);
            ix.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); n += 4; } carry = d - l; } }
      if (n) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x3a2c20, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -14 }))); } }
    ribbon(RL.map(l => shift(l, .03)), .014, 0x1b1b1d, .062); ribbon(RL.map(l => shift(l, -.03)), .014, 0x1b1b1d, .062); }
  ribbon(rl(1), .035, 0x6a5a45, .024); ribbon(rl(2), .075, 0x39342e, .028); ribbon(rl(2), .045, 0xe6dfcb, .034); ribbon(rl(3), .1, 0x3a2a24, .038); ribbon(rl(3), .062, 0xb34b3b, .044);

  // ---- lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8576, .62), sun = new THREE.DirectionalLight(0xfff4e0, .78); scene.add(hemi); scene.add(sun); scene.add(sun.target);
  sun.castShadow = !opt.noShadow; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0012; sun.shadow.normalBias = .06; R.sun = sun; R.hemi = hemi;
  // ---- materials & static scenery
  const matV = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 5, specular: 0x222222 }); R.matV = matV;
  const SCN = buildScenery(theme); R.SCN = SCN; const dummy = new THREE.Object3D();
  function inst(geo, cap, m, shadow, colored) { const im = new THREE.InstancedMesh(geo, m || matV, cap); im.cap = cap; if (colored) im.setColorAt(0, _c.set(0xffffff)); im.count = 0; im.frustumCulled = false; im.castShadow = shadow !== false; scene.add(im); return im; }
  R.inst = inst;
  function place(im, x, z, rot, s, y, col) { dummy.position.set(x, y != null ? y : R.hy(x, z), z); dummy.rotation.set(0, rot, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); if (im.count >= im.cap) return -1; im.setMatrixAt(im.count, dummy.matrix); if (col != null) im.setColorAt(im.count, _c.set(col)); return im.count++; }
  (function trees() {
    const con = [], brd = [], scr = [], plm = [];
    for (let c = 0; c < map.N; c++) {
      const t = map.t[c]; if (map.road[c]) continue; const i = c % map.W, j = (c / map.W) | 0; let n = 0, kind = null;
      if (t === T.HF) n = 5; else if (t === T.LF) n = 2; else if (t === T.JUNGLE) n = 6; else if ((t === T.ROUGH || t === T.DESERT) && hash2(i, j, 17) < (t === T.ROUGH ? .22 : .04)) { n = 1; kind = scr; } else if (t === T.HILL && theme !== 'desert' && hash2(i, j, 18) < .12) n = 1;
      n = Math.round(n * (cs / .5) * (cs / .5) * .8) || (n ? 1 : 0);
      for (let q = 0; q < n; q++) { const x = (i + hash2(i * 7 + q, j, 21)) * cs, z = (j + hash2(i, j * 7 + q, 22)) * cs, h = hash2(i + q, j + q, 23); if (map.tAt(x, z) === T.SEA) continue; const arr = kind || (theme === 'desert' ? (h < .35 ? plm : scr) : t === T.JUNGLE ? brd : (h < (theme === 'snow' ? .7 : theme === 'med' ? .12 : .38) ? con : brd)); arr.push([x, z, h]); }
    }
    // trees go in a scattered order, so Medium and Low graphics can draw the first part of the list and thin every wood evenly
    const fr = a => { const v = Math.sin(a[0] * 12.9898 + a[1] * 78.233) * 43758.5453; return v - Math.floor(v); }; R.trees = [];
    const mk = (geo, arr, s) => { if (!arr.length) return; arr.sort((p, q) => fr(p) - fr(q)); const im = inst(geo, arr.length); for (const a of arr) place(im, a[0], a[1], a[2] * 6.28, MS * s * (.75 + a[2] * .5)); im.instanceMatrix.needsUpdate = true; im.receiveShadow = false; R.trees.push(im); };
    mk(SCN.conifer, con, .95); mk(SCN.broad, brd, .95); mk(SCN.scrub, scr, 1.1); mk(SCN.palm, plm, .9);
  })();
  const WALLS = { temperate: [0xb8a48c, 0xa88f78, 0xc9bca5, 0x9a7b66], med: [0xe2d6ba, 0xd9c6a0, 0xe9dfcd, 0xcfb590], desert: [0xe9e0c8, 0xdccfae, 0xf0e9d6], snow: [0xa69a8c, 0x8f857a, 0xb9afa2] }[theme], ROOFS = { temperate: [0x8f4a35, 0x7a3f30, 0x5a5550], med: [0xa5553a, 0xb0603f, 0x96503a], desert: [0xe2d8be, 0xd6c9a8], snow: [0xdfe3e2, 0xcfd4d4, 0x70706c] }[theme];
  (function towns() {
    let n = 0; for (const t of map.towns) n += t.size >= 3 ? 46 : t.size === 2 ? 18 : 7;
    const matW = new THREE.MeshLambertMaterial({ vertexColors: true }); const walls = inst(SCN.wall, n, matW, true, true), roofs = inst(SCN.roof, n, matW, true, true), ch = inst(SCN.church, map.towns.length, matW, true, true); walls.receiveShadow = true;
    for (const t of map.towns) {
      const cnt = t.size >= 3 ? 46 : t.size === 2 ? 18 : 7, rr = t.size >= 3 ? 1.5 : t.size === 2 ? .8 : .36; t.h0 = walls.count; t.pts = [];
      place(ch, t.x + .05, t.y + .04, hash2(t.x * 9 | 0, 3, 4) * 6.28, MS * .8, null, WALLS[0]);
      for (let i = 0; i < cnt; i++) { const a = hash2(i, 31, t.x * 10 | 0) * 6.28, q = (.25 + .75 * Math.sqrt(hash2(i, 33, t.y * 10 | 0))) * rr, x = t.x + Math.cos(a) * q, z = t.y + Math.sin(a) * q, tt = map.tAt(clamp(x, 0, map.w - .1), clamp(z, 0, map.h - .1)); if (tt === T.SEA || tt === T.RIVER) continue; const rot = Math.round(hash2(i, 35, 7) * 4) * Math.PI / 2 + (hash2(i, 36, 7) - .5) * .5, s = MS * (.62 + hash2(i, 37, 8) * .4); place(walls, x, z, rot, s, null, WALLS[i % WALLS.length]); place(roofs, x, z, rot, s, null, ROOFS[i % ROOFS.length]); t.pts.push([x, z]); }
      t.h1 = walls.count;
    }
    walls.instanceMatrix.needsUpdate = roofs.instanceMatrix.needsUpdate = ch.instanceMatrix.needsUpdate = true; walls.instanceColor.needsUpdate = roofs.instanceColor.needsUpdate = ch.instanceColor.needsUpdate = true; R.walls = walls; R.roofs = roofs;
  })();
  R.charTown = function (t) { for (let i = t.h0; i < t.h1; i++) if (hash2(i, 5, 5) < .6) { R.walls.setColorAt(i, _c.set(0x3a342e)); R.roofs.setColorAt(i, _c.set(0x2a2622)); } R.walls.instanceColor.needsUpdate = R.roofs.instanceColor.needsUpdate = true; t.charred = true; };
  (function depots() {
    // depots on the map show as dumps of crates and fuel drums, sized by the stock they hold; sources on the map edge are roads in from off the map
    const all = []; for (let s = 0; s < 2; s++) for (const q of S.src[s]) { q.edge = Math.min(q.x, q.y, map.w - q.x, map.h - q.y) < 2.6 && !q.air; if (!q.edge) all.push(q); }
    const im = inst(SCN.dump, Math.max(1, all.length)); im.count = all.length; R.depots = { im, all, t: -99 };
    R.updDepots = function () { if (Math.abs(S.t - R.depots.t) < 10) return; R.depots.t = S.t; all.forEach((q, i) => { const f = q.captured || S.t < q.t * 60 ? 0 : Math.max(.35, Math.min(1, q.stock / Math.max(1, q.cap))); dummy.position.set(q.x, R.hy(q.x, q.y), q.y); dummy.rotation.set(0, i * 1.3, 0); dummy.scale.setScalar(MS * 1.6 * f + 1e-5); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); }); im.instanceMatrix.needsUpdate = true; };
    R.updDepots();
    for (let s = 0; s < 2; s++) for (const b of S.air[s].bases) { const g = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .14), new THREE.MeshBasicMaterial({ color: 0x55524a })); g.rotation.x = -Math.PI / 2; g.rotation.z = .5; g.position.set(b.x, R.hy(b.x, b.y) + .03, b.y); scene.add(g); }
  })();
  R.bridgeMesh = [];
  for (const b of map.bridges) { if (b.fl) continue;
    let best = null, bd = 1e9; for (const r of map.roadLines) for (let i = 1; i < r.pts.length; i++) { const d = segDist(b.x, b.y, r.pts[i - 1][0], r.pts[i - 1][1], r.pts[i][0], r.pts[i][1]); if (d < bd) { bd = d; best = [r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]]; } }
    const m = new THREE.Mesh(SCN.bridge, matV); m.position.set(b.x, R.hy(b.x, b.y) + .05, b.y); m.rotation.y = -Math.atan2(best[1], best[0]); m.scale.set(MS * .9, MS * .9, MS * .9); m.castShadow = true; scene.add(m); R.bridgeMesh[b.id] = m; m.userData.y0 = m.position.y;
  }
  // floating bridges built in play: a dark deck laid across the water on the crossing line
  const floatMat = new THREE.MeshLambertMaterial({ color: 0x3e3a33 });
  function floatMesh(b) { const len = Math.max(1, b.cells.length) * map.cs + .5, m = new THREE.Mesh(new THREE.BoxGeometry(len, .03, .14), floatMat), d = b.dir || [0, 1]; m.position.set(b.x, R.hy(b.x, b.y) + .04, b.y); m.rotation.y = -Math.atan2(d[1], d[0]); scene.add(m); m.userData.y0 = m.position.y; return m; }
  R.syncBridges = function () { for (const b of map.bridges) { let m = R.bridgeMesh[b.id]; if (!m) m = R.bridgeMesh[b.id] = floatMesh(b); if (b.gone) { m.visible = false; continue; } if (b.intact) { m.rotation.z = 0; m.position.y = m.userData.y0; m.visible = true; } else { m.rotation.z = .32; m.position.y = m.userData.y0 - .07; } } };
  R.syncBridges();

  // ---- camera
  const cam = R.cam = { tx: map.w / 2, tz: map.h / 2, dist: Math.max(map.w, map.h) * 1.25, pitch: 1.05, yaw: 0 };
  R.maxDist = Math.max(map.w, map.h) * 1.7;
  R.updateCamera = function () {
    cam.pitch = clamp(cam.pitch, .5, 1.53); cam.dist = clamp(cam.dist, 2.4, R.maxDist); cam.tx = clamp(cam.tx, 0, map.w); cam.tz = clamp(cam.tz, 0, map.h);
    const ty = R.hy(cam.tx, cam.tz), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(cam.tx + cam.dist * cp * Math.sin(cam.yaw), ty + cam.dist * sp, cam.tz + cam.dist * cp * Math.cos(cam.yaw)); camera.lookAt(cam.tx, ty, cam.tz);
    camera.near = Math.max(.05, cam.dist * .02); camera.far = cam.dist * 4 + 300; camera.updateProjectionMatrix();
    const ext = clamp(cam.dist * .75, 3, 45); const sc0 = sun.shadow.camera; sc0.left = -ext; sc0.right = ext; sc0.top = ext; sc0.bottom = -ext; sc0.near = 1; sc0.far = 260; sc0.updateProjectionMatrix();
    sun.target.position.set(cam.tx, ty, cam.tz); sun.position.set(cam.tx - 55, ty + 95, cam.tz - 38);
  };
  R.gfx = 0; R.gfxNames = ['High', 'Medium', 'Low'];
  R.setGfx = function (q) {
    q = Math.max(0, Math.min(2, q)); R.gfx = q; R.prCap = [2, 1.5, 1][q]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, R.prCap));
    if (R.terrIdx && R.terrain) R.terrain.geometry.setIndex(R.terrIdx[q === 2 ? 1 : 0]);
    for (const im of R.trees || []) im.count = Math.max(1, Math.ceil(im.cap * [1, .65, .35][q]));
    const sh = q === 0 && !opt.noShadow; if (renderer.shadowMap.enabled !== sh) { renderer.shadowMap.enabled = sh; sun.castShadow = sh; scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } }); }
    sun.shadow.mapSize.set(q === 0 ? 2048 : 1024, q === 0 ? 2048 : 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    if (R.W) R.resize();
  };
  R.resize = function () { const w = glCanvas.clientWidth, h = glCanvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); const dpr = Math.min(window.devicePixelRatio || 1, R.prCap || 2); ovCanvas.width = w * dpr; ovCanvas.height = h * dpr; R.W = w; R.H = h; R.dpr = dpr; };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  R.pick = function (sx, sy) { // screen -> ground km
    ndc.set(sx / R.W * 2 - 1, -(sy / R.H) * 2 + 1); ray.setFromCamera(ndc, camera); const o = ray.ray.origin, d = ray.ray.direction; if (d.y >= -1e-4) return null;
    let h = R.hy(cam.tx, cam.tz), x = 0, z = 0; for (let i = 0; i < 5; i++) { const t = (h - o.y) / d.y; x = o.x + d.x * t; z = o.z + d.z * t; h = R.hy(clamp(x, 0, map.w), clamp(z, 0, map.h)); }
    return { x, y: z };
  };
  const pv = new THREE.Vector3();
  R.project = function (x, z, up) { pv.set(x, R.hy(x, z) + (up || 0), z).project(camera); if (pv.z > 1 || pv.z < -1) return null; return [(pv.x + 1) / 2 * R.W, (1 - pv.y) / 2 * R.H, pv.z]; };
  R.project3 = function (x, y, z) { pv.set(x, y, z).project(camera); if (pv.z > 1) return null; return [(pv.x + 1) / 2 * R.W, (1 - pv.y) / 2 * R.H]; };
  // camera moves glide over about half a second, so the eye can follow where the view went
  R.glide = null;
  R.jump = function (x, y, d) { R.glide = { tx: x, tz: y, dist: d ? Math.min(cam.dist, d) : cam.dist }; };
  R.glideTo = function (x, y, dist, pitch) { R.glide = { tx: x, tz: y, dist, pitch }; };
  // the glide runs on real time, so a slow frame does not stretch the move
  let glT = 0; R.stepGlide = function () { const now = performance.now(), el = Math.min(1, Math.max(0, (now - (glT || now)) / 1000)); glT = now; const g = R.glide; if (!g) return; const k = 1 - Math.exp(-el * 8); cam.tx += (g.tx - cam.tx) * k; cam.tz += (g.tz - cam.tz) * k; cam.dist = Math.exp(Math.log(cam.dist) + (Math.log(clamp(g.dist, 2.4, R.maxDist)) - Math.log(cam.dist)) * k); if (g.pitch != null) cam.pitch += (g.pitch - cam.pitch) * k;
    if (Math.hypot(g.tx - cam.tx, g.tz - cam.tz) < .05 && Math.abs(cam.dist - g.dist) < .05 * g.dist && (g.pitch == null || Math.abs(cam.pitch - g.pitch) < .01)) R.glide = null; };
  // the whole map in view, seen from high and steep; the zoom limit grows to allow it in a short window
  R.fitAll = function () { const pitch = 1.32, c0 = { tx: cam.tx, tz: cam.tz, dist: cam.dist, pitch: cam.pitch }, m = 6, W = R.W || 1, H = R.H || 1;
    const fits = d => { cam.tx = map.w / 2; cam.tz = map.h / 2; cam.pitch = pitch; cam.dist = d; const mx = R.maxDist; R.maxDist = 1e5; R.updateCamera(); R.camera.updateMatrixWorld(); R.maxDist = mx; for (const q of [[0, 0], [map.w, 0], [0, map.h], [map.w, map.h]]) { const p = R.project(q[0], q[1], 0); if (!p || p[0] < m || p[1] < m + 70 || p[0] > W - m || p[1] > H - m) return false; } return true; };
    let lo = 5, hi = Math.max(map.w, map.h) * 8; for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    Object.assign(cam, c0); R.updateCamera(); R.camera.updateMatrixWorld(); R.maxDist = Math.max(R.maxDist, hi * 1.05); R.glideTo(map.w / 2, map.h / 2, hi, pitch); };
  R.place = place; R.dummy = dummy;
  initDynamic(R, year); initOverlay(R, ovCanvas);
  R.resize(); R.updateCamera();
  return R;
}
