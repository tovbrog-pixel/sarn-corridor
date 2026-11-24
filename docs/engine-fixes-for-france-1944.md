# Engine fixes for france-1944, from the Sarn Corridor build

Tov Binyamin Brog · 23 November 2026

Instructions for the france-1944 build. Apply the patch at the end of this document to `engine/src/sim.js`, `engine/src/command.js` and `engine/src/ui.js`, then set the scenario values below and test. The patch was checked against france-1944 commit 5c5182b with `git apply --check`; if the files have changed since, apply the changes by hand from the descriptions.

## Problems and fixes

### 1. Coastal pockets never close

The empty-pocket rule in `ownTick` floods through every cell a side owns, and sea cells carry an owner too. Every coastal pocket joins the rest of its side's ground across the water, so it never counts as surrounded and never contracts.

**Fix:** sea cells belong to no pocket. The flood skips them and the contraction ignores them. A pocket that holds a working port stays open, because ports are supply sources and a pocket with a supply source is kept. This fix is always on and changes results, so record the regression baselines again afterwards.

### 2. No front line at division scale

Each unit holds only the ground within 1.5 km of it. At division scale, advancing divisions leave narrow fingers of held ground with the enemy's ground between them, and the map shows isolated divisions instead of a front.

**Fix:** an optional front-line model (`frontTick`). Every game hour, each land cell within `ownMax` km of formed troops goes to the side whose troops are nearer, measured over land with a chamfer distance that the sea blocks. The line between two armies falls halfway between them, ground behind an advance changes hands, and bypassed formations end up in pockets. A second setting, `ownR`, widens the radius each unit holds directly (default 1.5 km, as before).

### 3. Pockets with troops in them hold their size forever

Under the front-line model, a pocket with defenders shrinks to the ground nearest them and then stays that size however weak they get.

**Fix:** `isoShrinkKm`. A cut-off formation's troops count as farther away as its supply and strength run down, by up to `isoShrinkKm` km. The encircling side takes the pocket's outer ground hour by hour while the defenders keep the ground they stand on. The engine's existing attrition and surrender rules for cut-off units do the rest.

### 4. AI divisions run around alone

When the AI gives each division its own objective, divisions move as separate columns. The AI army commander also spreads a corps attack 4 km per division, so the flank divisions miss the objective.

**Fix:**
- `sc.corpsPlan`: scheduled corps orders for the side the computer plays, as `{ t: hours, c: command id, line: [[x, y], [x, y]] }`. The corps commander splits the line among his divisions, as when the player orders the whole corps.
- `armyAI.frontKm`: frontage per division for AI army attacks. The default stays 4.
- `armyAI.pocketBonus`: a multiplier on the score of an enemy-held objective standing on the army's own ground, a bypassed pocket. The AI then sends corps back to reduce pockets.

### 5. Reports pause the clock and move the camera

Every "Stop the clock on" option was on by default, so reports kept pausing the game and jumping the camera to units.

**Fix:** all options, the camera move included, start off. The player can turn them on in the Stop-the-clock box. The France build saves the choice under its own key, `f44_stop`.

## Scenario settings to try for Overlord

All values are starting points for balance testing. Each is a game setting; none comes from a source. Add them to the scenario object in `tools/scenario-overlord.js`:

```js
ownR: 3, ownMax: 15, isoShrinkKm: 12,
armyAI: { /* existing values */ frontKm: 4, pocketBonus: 2 },
```

Add `'ownR', 'ownMax', 'isoShrinkKm', 'corpsPlan'` to the `keep` list in `tools/build-preview.js` so the page carries them. Sarn Corridor uses `ownR: 5, ownMax: 25, isoShrinkKm: 20, frontKm: 5, pocketBonus: 2.5` on a 760 by 380 km map with 31 divisions; Normandy's denser front suggests the smaller values above.

## Steps

1. Save the patch below as `engine-fixes.patch` in the repository root and run `git apply engine-fixes.patch`.
2. Add the Overlord settings and the `keep` entries.
3. Run `node tools/regress.js record` to record new baselines, since the pocket fix changes results.
4. Run the 20-game AI-vs-AI batch on GitHub Actions and compare front lines and capture dates with the last batch.
5. Look at the held-ground layer (key T) in the game around the Cotentin, Brest and the Falaise pocket, where coastal and inland pockets form.

## Patch

```diff
--- a/engine/src/sim.js	2026-11-23 22:24:53.573579233 -0500
+++ b/engine/src/sim.js	2026-11-23 23:35:47.767100125 -0500
@@ -1227,10 +1227,13 @@
   }
   function ownTick(hourly) {
     // each cell within reach of troops in fighting order goes to the side whose troops are nearest (artillery reaches 0.8 km, other units 1.5 km)
-    const P = OW.pres, D = OW.dist || (OW.dist = [new Float32Array(OW.a.length), new Float32Array(OW.a.length)]); P[0].fill(0); P[1].fill(0); D[0].fill(9); D[1].fill(9);
-    for (const u of S.subs) if (formed(u)) { const r = u.cls === 'art' ? .8 : 1.5, dd = D[u.s], pp = P[u.s], lead = LEADCLS[u.cls] || u.cls === 'at' || u.cls === 'eng'; disc(u.x, u.y, 1.5, c => { const i = c % OW.gw, j = (c / OW.gw) | 0, d = Math.hypot((i + .5) * OW.cw - u.x, (j + .5) * OW.cw - u.y) + 1.5 - r; if (d < dd[c]) dd[c] = d; if (lead && d < 1.2) pp[c] = 1; }); }
-    for (let c = 0; c < OW.a.length; c++) { const a = D[0][c], b = D[1][c]; if (Math.min(a, b) <= 1.5 && a !== b) OW.a[c] = a < b ? 0 : 1; }
-    if (!hourly) return; const g = OW.gw, h = OW.gh, b = OW.a.slice();
+    const P = OW.pres, D = OW.dist || (OW.dist = [new Float32Array(OW.a.length), new Float32Array(OW.a.length)]); P[0].fill(0); P[1].fill(0); D[0].fill(99); D[1].fill(99);
+    const R0 = sc.ownR || 1.5;   // reach of a unit's hold on the ground (km); division-scale scenarios set more (game setting)
+    for (const u of S.subs) if (formed(u)) { const r = u.cls === 'art' ? R0 * .55 : R0, dd = D[u.s], pp = P[u.s], lead = LEADCLS[u.cls] || u.cls === 'at' || u.cls === 'eng'; disc(u.x, u.y, R0, c => { const i = c % OW.gw, j = (c / OW.gw) | 0, d = Math.hypot((i + .5) * OW.cw - u.x, (j + .5) * OW.cw - u.y) + R0 - r; if (d < dd[c]) dd[c] = d; if (lead && d < 1.2) pp[c] = 1; }); }
+    for (let c = 0; c < OW.a.length; c++) { const a = D[0][c], b = D[1][c]; if (Math.min(a, b) <= R0 && a !== b && !(OW.sea && OW.sea[c])) OW.a[c] = a < b ? 0 : 1; }
+    if (!hourly) return; const g = OW.gw, h = OW.gh;
+    if (sc.ownMax) frontTick(g, h);
+    const b = OW.a.slice();
     for (let j = 1; j < h - 1; j++) for (let i = 1; i < g - 1; i++) { const c = j * g + i; if (P[0][c] || P[1][c]) continue; let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && b[c + dj * g + di] !== b[c]) n++; if (n >= 6) OW.a[c] = 1 - b[c]; }
     // empty pockets close in: a connected region of one side's ground that holds none of its troops and none of its supply sources
     // gives up its outer ring of cells to the other side each hour, until the surrounding side owns all of it
@@ -1238,10 +1241,31 @@
     const cellOf = (x, y) => clamp(Math.floor(y / OW.cw), 0, h - 1) * g + clamp(Math.floor(x / OW.cw), 0, g - 1);
     for (const u of S.subs) if (u.active && !u.dead) { const c = cellOf(u.x, u.y); if (OW.a[c] === u.s) has[c] = 1; }
     for (let sd = 0; sd < 2; sd++) for (const so of S.src[sd]) if (!so.captured) { const c = cellOf(so.x, so.y); if (OW.a[c] === sd) has[c] = 1; }
-    let nl = 0; for (let c0 = 0; c0 < N; c0++) { if (lab[c0]) continue; const sd = OW.a[c0]; let qh = 0, qt = 0, k = false; lab[c0] = ++nl; q[qt++] = c0;
-      while (qh < qt) { const c = q[qh++], i = c % g; if (has[c]) k = true; if (i > 0 && !lab[c - 1] && OW.a[c - 1] === sd) { lab[c - 1] = nl; q[qt++] = c - 1; } if (i < g - 1 && !lab[c + 1] && OW.a[c + 1] === sd) { lab[c + 1] = nl; q[qt++] = c + 1; } if (c >= g && !lab[c - g] && OW.a[c - g] === sd) { lab[c - g] = nl; q[qt++] = c - g; } if (c < N - g && !lab[c + g] && OW.a[c + g] === sd) { lab[c + g] = nl; q[qt++] = c + g; } }
+    // sea cells belong to no pocket: they would otherwise join every coastal pocket to the rest of that side's ground
+    const SEA = OW.sea || (OW.sea = (() => { const z = new Uint8Array(N); for (let c = 0; c < N; c++) { const x = (c % g + .5) * OW.cw, y = (((c / g) | 0) + .5) * OW.cw; z[c] = map.t[Math.min(map.H - 1, Math.floor(y / map.cs)) * map.W + Math.min(map.W - 1, Math.floor(x / map.cs))] === T.SEA ? 1 : 0; } return z; })());
+    const same = (c, sd) => OW.a[c] === sd && !SEA[c];
+    let nl = 0; for (let c0 = 0; c0 < N; c0++) { if (lab[c0]) continue; const sd = OW.a[c0]; let qh = 0, qt = 0, k = !!SEA[c0]; lab[c0] = ++nl; q[qt++] = c0;
+      if (!SEA[c0]) while (qh < qt) { const c = q[qh++], i = c % g; if (has[c]) k = true; if (i > 0 && !lab[c - 1] && same(c - 1, sd)) { lab[c - 1] = nl; q[qt++] = c - 1; } if (i < g - 1 && !lab[c + 1] && same(c + 1, sd)) { lab[c + 1] = nl; q[qt++] = c + 1; } if (c >= g && !lab[c - g] && same(c - g, sd)) { lab[c - g] = nl; q[qt++] = c - g; } if (c < N - g && !lab[c + g] && same(c + g, sd)) { lab[c + g] = nl; q[qt++] = c + g; } }
       keep.push(k); }
-    const b2 = OW.a.slice(); for (let c = 0; c < N; c++) { if (keep[lab[c]]) continue; const i = c % g, sd = b2[c]; if ((i > 0 && b2[c - 1] !== sd) || (i < g - 1 && b2[c + 1] !== sd) || (c >= g && b2[c - g] !== sd) || (c < N - g && b2[c + g] !== sd)) OW.a[c] = 1 - sd; }
+    const b2 = OW.a.slice(), edge = c => !SEA[c] && b2[c] !== b2[c0x]; let c0x = 0; for (let c = 0; c < N; c++) { if (keep[lab[c]]) continue; const i = c % g; c0x = c; if ((i > 0 && edge(c - 1)) || (i < g - 1 && edge(c + 1)) || (c >= g && edge(c - g)) || (c < N - g && edge(c + g))) OW.a[c] = 1 - b2[c]; }
+  }
+  // front-line ground model (scenarios that set ownMax, in km): each hour every land cell within ownMax of formed troops goes to the
+  // side whose troops are nearer, measured over land, so the line between two armies lies halfway between them and ground behind an
+  // advance changes hands with it. Cells beyond ownMax of everyone keep their owner. Game setting for division-scale scenarios.
+  function frontTick(g, h) {
+    const N = g * h, cw = OW.cw, SEA = OW.sea || (OW.sea = (() => { const z = new Uint8Array(N); for (let c = 0; c < N; c++) { const x = (c % g + .5) * cw, y = (((c / g) | 0) + .5) * cw; z[c] = map.t[Math.min(map.H - 1, Math.floor(y / map.cs)) * map.W + Math.min(map.W - 1, Math.floor(x / map.cs))] === T.SEA ? 1 : 0; } return z; })());
+    const D = OW.fd || (OW.fd = [new Float32Array(N), new Float32Array(N)]), d1 = cw, d2 = cw * Math.SQRT2, cell = (x, y) => clamp(Math.floor(y / cw), 0, h - 1) * g + clamp(Math.floor(x / cw), 0, g - 1);
+    for (let s = 0; s < 2; s++) { const d = D[s]; d.fill(1e9);
+      // a cut-off formation's hold weakens as its supply and strength run down: its troops count as farther away, so the encircling
+      // side takes the pocket's outer ground hour by hour while the defenders keep the ground they stand on (isoShrinkKm, game setting)
+      const K = sc.isoShrinkKm || 0;
+      for (const u of S.subs) if (u.s === s && u.active && !u.dead && u.mv !== 'ship' && u.coh > .2 && u.cls !== 'hq') { const F = u.f, off = K && F && F.isolated ? K * (1 - Math.min(1, F.stock / Math.max(1, F.cap))) * .7 + K * (1 - Math.min(1, u.str)) * .3 : 0, c = cell(u.x, u.y); if (off < d[c]) d[c] = off; }
+      // two-pass chamfer distance; sea cells pass nothing on
+      for (let j = 0; j < h; j++) for (let i = 0; i < g; i++) { const c = j * g + i; if (SEA[c]) continue; let v = d[c];
+        if (i > 0 && d[c - 1] + d1 < v) v = d[c - 1] + d1; if (j > 0) { if (d[c - g] + d1 < v) v = d[c - g] + d1; if (i > 0 && d[c - g - 1] + d2 < v) v = d[c - g - 1] + d2; if (i < g - 1 && d[c - g + 1] + d2 < v) v = d[c - g + 1] + d2; } d[c] = v; }
+      for (let j = h - 1; j >= 0; j--) for (let i = g - 1; i >= 0; i--) { const c = j * g + i; if (SEA[c]) continue; let v = d[c];
+        if (i < g - 1 && d[c + 1] + d1 < v) v = d[c + 1] + d1; if (j < h - 1) { if (d[c + g] + d1 < v) v = d[c + g] + d1; if (i < g - 1 && d[c + g + 1] + d2 < v) v = d[c + g + 1] + d2; if (i > 0 && d[c + g - 1] + d2 < v) v = d[c + g - 1] + d2; } d[c] = v; } }
+    const M = sc.ownMax; for (let c = 0; c < N; c++) { if (SEA[c]) continue; const a = D[0][c], b = D[1][c]; if (Math.min(a, b) > M || Math.abs(a - b) < .5) continue; OW.a[c] = a < b ? 0 : 1; }
   }
   const own0At = (x, y) => S.own0[clamp(Math.floor(y / OW.cw), 0, OW.gh - 1) * OW.gw + clamp(Math.floor(x / OW.cw), 0, OW.gw - 1)];
   S.setup = function () { S.mkBenches(); arrivals(); aiTick(); for (const F of S.forms) cmdTick(F); combatTick(); initOwn(); if (!sc.front) ownTick(false); S.own0 = OW.a.slice(); 
--- a/engine/src/command.js	2026-11-23 22:24:53.573579233 -0500
+++ b/engine/src/command.js	2026-11-23 23:35:47.767505442 -0500
@@ -115,6 +115,10 @@
   function planTick() { while (pi < plan.length && plan[pi].t * 60 <= S.t) { const q = plan[pi++], F = q.f.startsWith('cmd:') ? byId[q.f.slice(4)] : fByN[q.f], C = byId[q.c];   // 'cmd:<id>' moves a corps between armies if (!F || !C || F.parent === C) continue;
       if (F.parent && F.parent.forms) { const i = F.parent.forms.indexOf(F); if (i >= 0) F.parent.forms.splice(i, 1); } C.forms.push(F); F.parent = C; if (S.t > 0) S.say(F.s, F.n + ' now under ' + C.n + '.', 0); } }
   planTick();
+  // scheduled corps orders for the side the computer plays (sc.corpsPlan: { t: hours, c: command id, line: [[x, y], [x, y]], path }):
+  // the corps commander splits the objective line among his divisions, as when the player orders the whole corps
+  const cplan = (sc.corpsPlan || []).slice().sort((a, b) => a.t - b.t); let ci = 0;
+  function corpsPlanTick() { while (ci < cplan.length && cplan[ci].t * 60 <= S.t) { const q = cplan[ci++], C = byId[q.c]; if (!C || C.s === S.player || !live(C)) continue; S.issueCommandOrder(C, q.path || [], q.line, {}); report(C, 'ordered forward on the corps objective.', 0); } }
   // AI army commanders (sc.armyAI): on the side the computer plays, each army gives its corps objectives in turn. The commander's
   // aggression sets the rhythm: a cautious one (Montgomery's armies) waits longer between attacks and for fuller supply; a bold one
   // (Patton) attacks more often and reaches farther. All values are starting values for balance testing.
@@ -128,13 +132,13 @@
         const kids = C.forms.filter(F => !F.forms && F.active && !F.dead); if (!kids.length) continue;
         if (kids.reduce((a, F) => a + F.stock / Math.max(1, F.cap), 0) / kids.length < (cfg.supply || lerp(ARMYAI.supply))) continue;
         const p = pos(C); if (!p) continue; let best = null, bs = -1e9;
-        for (const v of S.vp) { if (v.own === C.s || taken.has(v)) continue; const d = Math.hypot(v.x - p[0], v.y - p[1]); if (d > (cfg.reachKm || lerp(ARMYAI.reachKm)) || (S.phaseBlock && S.phaseBlock(kids[0], v.x, v.y))) continue; const sc0 = v.pts / (d + 6); if (sc0 > bs) { bs = sc0; best = v; } }
+        for (const v of S.vp) { if (v.own === C.s || taken.has(v)) continue; const d = Math.hypot(v.x - p[0], v.y - p[1]); if (d > (cfg.reachKm || lerp(ARMYAI.reachKm)) || (S.phaseBlock && S.phaseBlock(kids[0], v.x, v.y))) continue; const sc0 = v.pts / (d + 6) * (cfg.pocketBonus && S.ownAt(v.x, v.y) === C.s ? cfg.pocketBonus : 1); if (sc0 > bs) { bs = sc0; best = v; } }   // pocketBonus: an enemy-held objective standing on our ground is a bypassed pocket to reduce
         if (!best) continue; taken.add(best);
-        const dx = best.x - p[0], dy = best.y - p[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl, half = ARMYAI.frontKm * kids.length / 2, cx = best.x + ux, cy = best.y + uy;
+        const dx = best.x - p[0], dy = best.y - p[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl, half = (cfg.frontKm || ARMYAI.frontKm) * kids.length / 2, cx = best.x + ux, cy = best.y + uy;
         S.issueCommandOrder(C, [], [[cx - uy * half, cy + ux * half], [cx + uy * half, cy - ux * half]], {}); C.aiTgt = best;
         report(A, C.n + ' to attack toward ' + best.n + '.', 0); } } }
   // called once per simulation step
   const prevHook = S.cmdHook;
-  let armyT = -1e9; S.cmdHook = function () { if (prevHook) prevHook(); planTick(); if (S.t - armyT >= 60) { armyT = S.t; armyTick(); } for (const C of nodes) { if (!C.order) continue; if (C.order.st === 'pending' && S.t >= C.order.t0) release(C); else if (C.order.st === 'issued' && S.t >= C.order.nextReview) review(C); } };
+  let armyT = -1e9; S.cmdHook = function () { if (prevHook) prevHook(); planTick(); corpsPlanTick(); if (S.t - armyT >= 60) { armyT = S.t; armyTick(); } for (const C of nodes) { if (!C.order) continue; if (C.order.st === 'pending' && S.t >= C.order.t0) release(C); else if (C.order.st === 'issued' && S.t >= C.order.nextReview) review(C); } };
   return S;
 }
--- a/engine/src/ui.js	2026-11-23 22:24:53.573579233 -0500
+++ b/engine/src/ui.js	2026-11-23 23:26:58.246049517 -0500
@@ -104,7 +104,7 @@
   function nextEvent() { if (!S || S.over || S.player < 0) return; runEv = true; setSpeed(4); toast('Running to the next report that needs you.'); }
   $('nextev').addEventListener('click', nextEvent); $('mapbtn').addEventListener('click', () => R && R.fitAll());
   $('pausebar').addEventListener('click', e => { if (e.target.dataset.resume) setSpeed(speed ? lastSpFast : lastSp); else if (e.target.dataset.pbx) { pauseWhy = ''; pauseBar(); } });
-  let slowC = true, cardMin = false, logK = '', inC = new Set(), alertI = 0; let cardHold = 0; document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('#card, #panel')) cardHold = performance.now() + 1500; }); window.addEventListener('mouseup', () => { cardHold = 0; });
+  let slowC = false, cardMin = false, logK = '', inC = new Set(), alertI = 0; let cardHold = 0; document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('#card, #panel')) cardHold = performance.now() + 1500; }); window.addEventListener('mouseup', () => { cardHold = 0; });
   let lastLog = null, lastPing = null; const detSel = new Set(); let detSelF = null; let fpsT = 0, fpsN = 0, lowN = 0, grace = 0, fpsOn = false, autoWarned = false;
   function setGfx(q, quiet) { R.setGfx(q); $('gfxbtn').textContent = 'Graphics: ' + R.gfxNames[R.gfx]; if (!quiet) { try { localStorage.setItem('loa_gfx', R.gfx); } catch (e) { } toast('Graphics ' + R.gfxNames[R.gfx] + '. Press G to change.'); } }
   function autosave() {
@@ -161,7 +161,7 @@
     return m.length ? '<div>' + m.map(q => '<i class="xmark xm-' + q[0] + '" title="' + esc(q[2]) + '">' + q[1] + '</i>').join('') + '</div>' : ''; }
   // which reports stop the clock; contact only slows it to 1x, as before
   const STOPK = [['contact', 'contact (slow to 1x)'], ['bridge', 'bridge blown or broken'], ['cut', 'formation cut off'], ['refused', 'order refused'], ['obj', 'objective changes hands'], ['xing', 'crossing under fire']];
-  let stopOn = { contact: 1, bridge: 1, cut: 1, refused: 1, obj: 1, xing: 1, cam: 1, away: 1 }; const NEAR = 40; try { const q = JSON.parse(localStorage.getItem('loa_stop') || 'null'); if (q && typeof q === 'object') for (const k in stopOn) if (k in q) stopOn[k] = q[k] ? 1 : 0; } catch (e) { }
+  let stopOn = { contact: 0, bridge: 0, cut: 0, refused: 0, obj: 0, xing: 0, cam: 0, away: 0 }; const NEAR = 40; try { const q = JSON.parse(localStorage.getItem('f44_stop') || 'null'); if (q && typeof q === 'object') for (const k in stopOn) if (k in q) stopOn[k] = q[k] ? 1 : 0; } catch (e) { }
   function stopBox() { return '<div id="stopon"><b>Stop the clock on:</b>' + STOPK.map(q => '<label><input type="checkbox" data-stop="' + q[0] + '"' + (stopOn[q[0]] ? ' checked' : '') + '> ' + q[1] + '</label>').join('') + '<b>When it stops or slows:</b><label><input type="checkbox" data-stop="cam"' + (stopOn.cam ? ' checked' : '') + '> move the camera to the place</label><label><input type="checkbox" data-stop="away"' + (stopOn.away ? ' checked' : '') + '> pause when I leave the window</label></div>'; }
   function evKind(l) { const t = l.txt; if (/blown the|has been demolished|has broken the|has been destroyed by bombing/.test(t)) return 'bridge'; if (/cut off/.test(t)) return 'cut'; if (/Cannot comply|refused/.test(t)) return 'refused'; if (/ taken by .* forces/.test(t)) return 'obj'; if (/Boats under fire|First wave ashore|wiped out|Bridgehead secured|Every boat/.test(t)) return 'xing'; return null; }
   // new reports that stop the clock, and the Next event run
@@ -296,7 +296,7 @@
     if (t.dataset && t.dataset.gstaff != null) { const g = t.dataset.gstaff, L = S.forms.filter(F => mineF(F) && !F.dead && (shownG[F.id] != null ? shownG[F.id] : groupOf(F)) === g), on = !L.every(F => F.staff); for (const F of L) if (!!F.staff !== on) cmd('staff', [F.id, on ? 1 : 0]); toast(on ? L.length + ' formations handed to the staff. Each follows its plan from here.' : L.length + ' formations back under your command.'); hud(true); return; }
     { const g = t.closest('.fgrp'); if (g && !t.closest('button')) { const k = g.dataset.g; if (foldG.has(k)) foldG.delete(k); else foldG.add(k); hud(true); return; } }
     if (t.id === 'socommit' || t.id === 'sopool') { cmd('staffopt', [t.id === 'socommit' ? 'commit' : 'pool', t.checked]); return; }
-    if (t.id === 'showall') { R.showAll = t.checked; return; } if (t.id === 'showown') { R.own.on = t.checked; R.updOwn(true); return; } if (t.dataset && t.dataset.stop) { stopOn[t.dataset.stop] = t.checked ? 1 : 0; slowC = !!stopOn.contact; try { localStorage.setItem('loa_stop', JSON.stringify(stopOn)); } catch (e) { } return; }
+    if (t.id === 'showall') { R.showAll = t.checked; return; } if (t.id === 'showown') { R.own.on = t.checked; R.updOwn(true); return; } if (t.dataset && t.dataset.stop) { stopOn[t.dataset.stop] = t.checked ? 1 : 0; slowC = !!stopOn.contact; try { localStorage.setItem('f44_stop', JSON.stringify(stopOn)); } catch (e) { } return; }
     if (f) { const F = S.forms[+f.dataset.f]; select(F); if (F.active) frameF(F); else if (F.arr && F.arr.mode !== 'road') R.jump(F.x, F.y, 40); return; }
     if (t.dataset.m) { cmd('mission', [+t.dataset.g, t.dataset.m]); } else if (t.dataset.act === 'addrec') setMode(mode === 'rec' ? null : 'rec'); else if (t.dataset.delrec) cmd('delrec', [+t.dataset.delrec]); else if (t.dataset.act === 'addint') setMode(mode === 'int' ? null : 'int'); else if (t.dataset.act === 'addstrat') setMode(mode === 'strat' ? null : 'strat');
     else if (t.dataset.delint) cmd('delint', [+t.dataset.delint]); else if (t.dataset.delstrat) cmd('delstrat', [+t.dataset.delstrat]);
```

## Source trace

- **Problems 1 to 5:** found in the Sarn Corridor build on 23 Nov 2026, from Tov's review of screenshots and from AI-vs-AI runs of the corridor scenario.
- **Patch:** a diff of the Sarn Corridor engine files against france-1944 commit 5c5182b; the France version saves stop settings under `f44_stop`.
- **Inference:** problem 1 almost certainly exists in france-1944, since the code is the same, but this has not been tested on the Overlord map. All setting values are game settings for balance testing.
