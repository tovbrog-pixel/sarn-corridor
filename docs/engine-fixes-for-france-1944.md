# Engine fixes for france-1944, from the Sarn Corridor build

Tov Binyamin Brog · 24 November 2026 (version 3: the patch now carries fixes 1 to 6 only)

Instructions for the france-1944 build. Apply the patch at the end of this document (also at https://raw.githubusercontent.com/tovbrog-pixel/sarn-corridor/main/docs/engine-fixes-for-france-1944.patch). It changes `engine/src/sim.js`, `engine/src/command.js`, `engine/src/map.js` and `engine/src/ui.js` and adds `engine/src/doctrine.js`. The Sarn Corridor build also has H-hour, pre-war intelligence and deployment variants; they are left out here because the France campaign uses historical deployments. Then make the three loader edits, set the scenario values below and test. The patch was checked against france-1944 commit 5c5182b with `git apply --check`; if the files have changed since, apply the changes by hand from the descriptions.

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

### 6. Divisions advance as separate clumps instead of a line

Corps orders went to divisions as destinations, and each division found its own route, mostly by road. Large units in the Second World War advanced in zones along a front, left the roads near the enemy, kept contact with their neighbours, and guarded the flanks of armoured penetrations.

**What the manuals say (sources in the trace at the end):**
- In an advance the corps commander ordinarily prescribes a zone of advance for each division; the road net within the zone shapes march formations and supply (FM 100-5, 1941, ch. 15).
- Close to strong enemy forces, troops leave the road and develop the column into parallel columns, each with its own objective; cross-country marches are likely in the development and approach march (FM 100-5, 1941, pars. 364-366).
- Column commanders report when the main body reaches designated phase lines (par. 355); German practice also advanced by bounds.
- Main attacks take narrow zones with deep reserves; secondary attacks take wide zones with minimal reserves (pars. 456-457).
- In 1940 Kleist ordered Guderian to halt so the motorised infantry could catch up, and the panzer group lined its corridor with infantry; in 1941 the gaps between panzer groups and infantry armies widened.

**Fix:** a new module, `engine/src/doctrine.js`, switched on by adding `'doctrine'` to a scenario's `modules`. Without it the engine behaves as before.
1. **Development.** A division within `devKm` (15 km) of known enemy, or standing on ground the enemy holds, leaves the roads: its battalions path and move with cross-country movement factors (`map.facX`, the terrain without the road bonus; bridges still needed). Rear movement by road and rail is unchanged, and the transport module already releases columns short of known enemy.
2. **Alignment by bounds.** In a corps attack, a division more than `alignKm` (8 km) ahead of its slower neighbour halts until the flank comes up, unless it is in contact. Mobile divisions in a main-effort attack are exempt and follow rule 3.
3. **Guarded corridors.** An armoured or motorised division measures how far back along its axis its flanks stand on enemy-held ground. Its infantry and reconnaissance battalions can guard `guardKm0 + guardKmPerBn` per battalion (10 km plus 4 km each); past that it halts and reports the open flank, and its corps sends an infantry division in reserve or finished with its task to dig in along the open side.
4. **Main effort.** The AI army commander gives the corps with the best objective a narrow zone (0.7 times `frontKm` per division) and a reserve, and the others wide zones (1.4 times) without one. `sc.corpsPlan` entries accept `opt: { main: true, reserve: true }`.

These rules also apply to the player's corps orders, since the corps and division commanders carry them out.

**Defence as a line** is scenario data: give each defending division a sector line (`f.line`) along the position, about 8 to 12 km per division by Soviet norms, and the engine deploys it there. A front wider than the divisions can hold shows as gaps.

**Loader edits** (the tool files differ between the repositories, so make these by hand):
- `tools/load-engine.js`: add `'doctrine.js'` to the file list after `'replace.js'`, and `attachDoctrine` to the `__api` object.
- `tools/build-app.js`: add `'doctrine.js'` to `engineFiles` after `'replace.js'`.
- `tools/build-preview.js`: add `'doctrine.js'` to `order` after `'replace.js'`, and `'corpsPlan'` to the `keep` list.

## Scenario settings to try for Overlord

All values are starting points for balance testing. Each is a game setting; none comes from a source. Add them to the scenario object in `tools/scenario-overlord.js`:

```js
ownR: 3, ownMax: 15, isoShrinkKm: 12,
modules: [/* existing modules */ 'doctrine'],
armyAI: { /* existing values */ frontKm: 4, pocketBonus: 2 },
```

Add `'ownR', 'ownMax', 'isoShrinkKm', 'corpsPlan'` to the `keep` list in `tools/build-preview.js` so the page carries them. Sarn Corridor uses `ownR: 5, ownMax: 25, isoShrinkKm: 20, frontKm: 5, pocketBonus: 2.5` on a 760 by 380 km map with 31 divisions; Normandy's denser front suggests the smaller values above.

## Steps

1. Save the patch below as `engine-fixes.patch` in the repository root and run `git apply engine-fixes.patch`.
2. Make the three loader edits in section 6, then add the Overlord settings and the `keep` entries.
3. Run `node tools/regress.js record` to record new baselines, since the pocket fix changes results.
4. Run the 20-game AI-vs-AI batch on GitHub Actions and compare front lines and capture dates with the last batch.
5. Look at the held-ground layer (key T) in the game around the Cotentin, Brest and the Falaise pocket, where coastal and inland pockets form.
6. Watch a corps attack: divisions should leave the roads near the enemy, halt at bounds for lagging neighbours, and Third Army's armoured divisions should halt and call infantry forward when their flanks open too far.

## Patch

```diff
--- a/engine/src/command.js	2026-11-23 22:24:53.573579233 -0500
+++ b/engine/src/command.js	2026-11-24 00:07:18.272873867 -0500
@@ -115,6 +115,10 @@
   function planTick() { while (pi < plan.length && plan[pi].t * 60 <= S.t) { const q = plan[pi++], F = q.f.startsWith('cmd:') ? byId[q.f.slice(4)] : fByN[q.f], C = byId[q.c];   // 'cmd:<id>' moves a corps between armies if (!F || !C || F.parent === C) continue;
       if (F.parent && F.parent.forms) { const i = F.parent.forms.indexOf(F); if (i >= 0) F.parent.forms.splice(i, 1); } C.forms.push(F); F.parent = C; if (S.t > 0) S.say(F.s, F.n + ' now under ' + C.n + '.', 0); } }
   planTick();
+  // scheduled corps orders for the side the computer plays (sc.corpsPlan: { t: hours, c: command id, line: [[x, y], [x, y]], path }):
+  // the corps commander splits the objective line among his divisions, as when the player orders the whole corps
+  const cplan = (sc.corpsPlan || []).slice().sort((a, b) => a.t - b.t); let ci = 0;
+  function corpsPlanTick() { while (ci < cplan.length && cplan[ci].t * 60 <= S.t) { const q = cplan[ci++], C = byId[q.c]; if (!C || C.s === S.player || !live(C)) continue; S.issueCommandOrder(C, q.path || [], q.line, q.opt || {}); report(C, 'ordered forward on the corps objective.', 0); } }
   // AI army commanders (sc.armyAI): on the side the computer plays, each army gives its corps objectives in turn. The commander's
   // aggression sets the rhythm: a cautious one (Montgomery's armies) waits longer between attacks and for fuller supply; a bold one
   // (Patton) attacks more often and reaches farther. All values are starting values for balance testing.
@@ -122,19 +126,23 @@
   function armyTick() { if (!sc.armyAI) return;
     const cfg = typeof sc.armyAI === 'object' ? sc.armyAI : {};   // { only: [army keys], from: hours } limits the AI armies and when they start; cadenceH, waitH, supply and reachKm replace the values above for a pursuit
     for (const A of nodes) { if (A.level !== 'army' || A.s === S.player || S.t < (A.nextPlan || 0) || (cfg.only && !cfg.only.includes(A.key)) || S.t < (cfg.from || 0) * 60) continue; const ag = A.cmd ? A.cmd.ag : .5, k = Math.max(0, Math.min(1, (ag - .4) / .5));
-      const lerp = a => a[0] + (a[1] - a[0]) * k; A.nextPlan = S.t + 60 * (cfg.cadenceH || lerp(ARMYAI.cadenceH)) * (.85 + S.rnd() * .3); const taken = new Set();
+      const lerp = a => a[0] + (a[1] - a[0]) * k; A.nextPlan = S.t + 60 * (cfg.cadenceH || lerp(ARMYAI.cadenceH)) * (.85 + S.rnd() * .3); const taken = new Set(), picks = [];
       for (const C of A.forms) { if (!C.forms || !live(C)) continue; if (C.order && C.order.st !== 'issued' && C.order.st !== 'done') continue;
         if (C.order && C.order.st === 'issued' && !C.order.doneSaid && S.t - C.order.t0 < (cfg.waitH || 48) * 60) continue;   // a corps attack still under way runs to its end, or 48 hours
         const kids = C.forms.filter(F => !F.forms && F.active && !F.dead); if (!kids.length) continue;
         if (kids.reduce((a, F) => a + F.stock / Math.max(1, F.cap), 0) / kids.length < (cfg.supply || lerp(ARMYAI.supply))) continue;
         const p = pos(C); if (!p) continue; let best = null, bs = -1e9;
-        for (const v of S.vp) { if (v.own === C.s || taken.has(v)) continue; const d = Math.hypot(v.x - p[0], v.y - p[1]); if (d > (cfg.reachKm || lerp(ARMYAI.reachKm)) || (S.phaseBlock && S.phaseBlock(kids[0], v.x, v.y))) continue; const sc0 = v.pts / (d + 6); if (sc0 > bs) { bs = sc0; best = v; } }
-        if (!best) continue; taken.add(best);
-        const dx = best.x - p[0], dy = best.y - p[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl, half = ARMYAI.frontKm * kids.length / 2, cx = best.x + ux, cy = best.y + uy;
-        S.issueCommandOrder(C, [], [[cx - uy * half, cy + ux * half], [cx + uy * half, cy - ux * half]], {}); C.aiTgt = best;
-        report(A, C.n + ' to attack toward ' + best.n + '.', 0); } } }
+        for (const v of S.vp) { if (v.own === C.s || taken.has(v)) continue; const d = Math.hypot(v.x - p[0], v.y - p[1]); if (d > (cfg.reachKm || lerp(ARMYAI.reachKm)) || (S.phaseBlock && S.phaseBlock(kids[0], v.x, v.y))) continue; const sc0 = v.pts / (d + 6) * (cfg.pocketBonus && S.ownAt(v.x, v.y) === C.s ? cfg.pocketBonus : 1); if (sc0 > bs) { bs = sc0; best = v; } }   // pocketBonus: an enemy-held objective standing on our ground is a bypassed pocket to reduce
+        if (!best) continue; taken.add(best); picks.push({ C, best, bs, p, kids }); }
+      // doctrine (sc.modules has 'doctrine'): the corps with the best objective makes the main effort on a narrow zone with a reserve;
+      // the others attack on wide zones without one (FM 100-5, 1941, pars. 456-457). Without doctrine every corps attacks alike.
+      const doc = (sc.modules || []).includes('doctrine'), mainC = doc && picks.length > 1 ? picks.reduce((a, q) => q.bs > a.bs ? q : a, picks[0]).C : null;
+      for (const { C, best, p, kids } of picks) { const isMain = C === mainC, fk = (cfg.frontKm || ARMYAI.frontKm) * (doc ? (isMain ? .7 : 1.4) : 1);
+        const dx = best.x - p[0], dy = best.y - p[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl, half = fk * kids.length / 2, cx = best.x + ux, cy = best.y + uy;
+        S.issueCommandOrder(C, [], [[cx - uy * half, cy + ux * half], [cx + uy * half, cy - ux * half]], doc ? (isMain ? { main: true, reserve: true } : { reserve: false }) : {}); C.aiTgt = best;
+        report(A, C.n + (isMain ? ' to make the main effort toward ' : ' to attack toward ') + best.n + '.', 0); } } }
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
--- a/engine/src/map.js	2026-11-23 22:24:53.573579233 -0500
+++ b/engine/src/map.js	2026-11-24 00:07:18.271459442 -0500
@@ -92,14 +92,16 @@
     for (const q of cells) m.br[q] = b.id; m.bridges.push(b);
   }
   for (const o of sc.bridges || []) { let best = null, bd = 2.5; for (const b of m.bridges) { const d = Math.hypot(b.x - o[0], b.y - o[1]); if (d < bd) { bd = d; best = b; } } if (best) Object.assign(best, o[2]); else if (typeof console !== 'undefined') console.warn('bridge override not matched', o); }
+  m.facX = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
   m.calcFac = function () {
     for (let c = 0; c < N; c++) {
       const t = m.t[c], r = m.road[c];
       for (let k = 0; k < 3; k++) {
         let f = t === T.MARSH && sc.mines && m.lane[c] ? TFAC[T.OPEN][k] : TFAC[t][k];   // a lane cleared through a minefield drives like open ground
         if (t === T.RIVER) { const b = m.br[c] >= 0 ? m.bridges[m.br[c]] : null; f = b && b.intact && (r || b.fl) ? RFAC[r || 2][k] : 0; }   // a floating bridge carries traffic where no road crosses
-        else if (r) { let rf = RFAC[r][k]; if (t === T.MTN) rf *= .6; else if (t === T.HF || t === T.HILL || t === T.JUNGLE) rf *= .85; f = Math.max(f, rf); }
-        m.fac[k][c] = f;
+        const fx = f;   // cross-country factor: the terrain alone (doctrine: a developed formation leaves the roads)
+        if (t !== T.RIVER && r) { let rf = RFAC[r][k]; if (t === T.MTN) rf *= .6; else if (t === T.HF || t === T.HILL || t === T.JUNGLE) rf *= .85; f = Math.max(f, rf); }
+        m.fac[k][c] = f; m.facX[k][c] = t === T.RIVER ? f : fx;
       }
     }
   };
@@ -138,7 +140,7 @@
   const offRoad = c => !m.road[c] && m.t[c] !== T.DESERT && m.t[c] !== T.TOWN && m.t[c] !== T.CITY && m.t[c] !== T.BEACH && m.t[c] !== T.RIVER;
   m.pathCount = 0;
   m.findPath = function (k, sx, sy, gx, gy, opt) {
-    m.pathCount++; opt = opt || {}; const fac = m.fac[k], block = opt.block, threat = opt.threat, rb = opt.road || 0;   // rb: extra cost on ground with no road (supply columns)
+    m.pathCount++; opt = opt || {}; const fac = (opt.cross ? m.facX : m.fac)[k], block = opt.block, threat = opt.threat, rb = opt.road || 0;   // rb: extra cost on ground with no road (supply columns)
     const s0 = m.snap(k, sx, sy, 3), g0 = m.snap(k, gx, gy, opt.grad || 4); if (!s0 || !g0) return null;
     const sc0 = idx(s0[0], s0[1]), gc = idx(g0[0], g0[1]), gi = gc % W, gj = (gc / W) | 0;
     if (sc0 === gc) return [[g0[0], g0[1]]];
--- a/engine/src/sim.js	2026-11-23 22:24:53.573579233 -0500
+++ b/engine/src/sim.js	2026-11-24 00:46:50.464796795 -0500
@@ -498,7 +498,7 @@
       // a battalion holding a line faces the enemy side of it once it stops shooting
       if (!u.goal) { if (u.face && S.t - (u.fireT || -99) > 15) { u.hx = u.face[0]; u.hy = u.face[1]; } continue; }
       if (u.needPath && S.pb > 0 && S.t - u.pathT > (u.noPath ? 30 : .5)) {
-        S.pb--; u.pathT = S.t; const p = map.findPath(u.mvi, u.x, u.y, u.goal[0], u.goal[1]);
+        S.pb--; u.pathT = S.t; const p = map.findPath(u.mvi, u.x, u.y, u.goal[0], u.goal[1], u.f.dev && !u.det && u.state !== 'retreat' ? { cross: 1 } : undefined);   // doctrine: a developed formation moves across country
         // a formation crosses as one body: a route far longer than the direct line (a blown bridge sends everyone round by the next crossing) is refused and reported
         let far = false; if (p && !u.det && u.state !== 'retreat' && u.slot && u.goal === u.slot) { let L = 0, px = u.x, py = u.y; for (const q of p) { L += Math.hypot(q[0] - px, q[1] - py); px = q[0]; py = q[1]; } const d0 = Math.hypot(u.goal[0] - u.x, u.goal[1] - u.y); if (d0 > 1.2 && L > d0 * 1.9 + (sc.detourKm || 5)) far = true; }
         if (far) { u.noPath = true; u.path = null; u.detour = S.t; u.needPath = true; }
@@ -511,7 +511,7 @@
       // an enemy in fighting order within 1.2 km blocks the way: close with him, fight through on an assault, or fall back, but do not drive past
       let zf = 1; if (!ret && u.ze && u.pi < u.path.length) { const q = u.path[u.pi], qx = q[0] - u.x, qy = q[1] - u.y, ql = Math.hypot(qx, qy) || 1, rr = sc.sides[u.s].rear || [0, 0], back = (qx * rr[0] + qy * rr[1]) / ql > .3;
         if (!back) { const toward = (qx * (u.ze.x - u.x) + qy * (u.ze.y - u.y)) / ql > .15 * u.zd; if (u.assault) zf = .35; else if (!toward || u.zd < .5) { if (u.ze.seenT < S.t - 6) u.ze.seenT = S.t; continue; } else zf = .5; } }
-      const c = map.idx(u.x, u.y); let sp = zf * baseSpeed(u) * (u.fat > .5 ? 1 - .6 * (u.fat - .5) : 1) * (!ret && !u.det && !u.fm && !INDEP[u.cls] && u.f.pace && !u.f.contact && u.f.order && u.f.order.st === 'active' ? Math.min(1, u.f.pace / baseSpeed(u)) : 1) * Math.max(.05, map.fac[u.mvi][c]) * wm * (S.t - u.hitT < 3 && !ret ? .5 : 1) * (ret ? 1.15 : 1) * (1 - .5 * u.f.dis);
+      const c = map.idx(u.x, u.y); let sp = zf * baseSpeed(u) * (u.fat > .5 ? 1 - .6 * (u.fat - .5) : 1) * (!ret && !u.det && !u.fm && !INDEP[u.cls] && u.f.pace && !u.f.contact && u.f.order && u.f.order.st === 'active' ? Math.min(1, u.f.pace / baseSpeed(u)) : 1) * Math.max(.05, (u.f.dev && !u.det ? map.facX : map.fac)[u.mvi][c]) * wm * ((u.f.alignHold || u.f.flankHold) && !ret && !u.det && !u.f.contact && u.state !== 'retreat' ? 0 : 1) * (S.t - u.hitT < 3 && !ret ? .5 : 1) * (ret ? 1.15 : 1) * (1 - .5 * u.f.dis);
       let rem = sp * dt;
       while (rem > 0 && u.pi < u.path.length) {
         const p = u.path[u.pi], dx = p[0] - u.x, dy = p[1] - u.y, d = Math.hypot(dx, dy);
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
@@ -1238,14 +1241,35 @@
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
     // step 3 modules a scenario asks for (the France campaign: road and rail moves, the air war); the older scenarios run without them
-    for (const m of sc.modules || []) { const fn = { transport: typeof attachTransport === 'function' && attachTransport, air: typeof attachAir === 'function' && attachAir, command: typeof attachCommand === 'function' && attachCommand, politics: typeof attachPolitics === 'function' && attachPolitics, theater: typeof attachTheater === 'function' && attachTheater, repl: typeof attachRepl === 'function' && attachRepl }[m]; if (fn) fn(S); } };
+    for (const m of sc.modules || []) { const fn = { transport: typeof attachTransport === 'function' && attachTransport, air: typeof attachAir === 'function' && attachAir, command: typeof attachCommand === 'function' && attachCommand, politics: typeof attachPolitics === 'function' && attachPolitics, theater: typeof attachTheater === 'function' && attachTheater, repl: typeof attachRepl === 'function' && attachRepl, doctrine: typeof attachDoctrine === 'function' && attachDoctrine }[m]; if (fn) fn(S); } };
   return S;
 }
--- /dev/null
+++ b/engine/src/doctrine.js
@@ -0,0 +1,64 @@
+// ===== DOCTRINE: how large units deploy and advance along a front =====
+// Field-manual practice for division and corps operations (FM 100-5, 1941, chapters 8 and 9; German practice as reported in
+// US intelligence bulletins), turned into engine rules. A scenario switches it on with modules: ['doctrine'] and may tune DOCTRINE
+// through sc.doctrine. All numbers are starting values for balance testing (game settings).
+//  1. Development: a division within devKm of known enemy, or on ground the enemy holds, leaves the roads and moves across
+//     country in its deployed formation (cross-country movement factors; the road bonus is ignored).
+//  2. Alignment by bounds: in a corps attack, a division that gets more than alignKm ahead of its slowest neighbour halts at
+//     the bound until the flank comes up. Mobile divisions in a main-effort attack are exempt and follow rule 3 instead.
+//  3. Guarded corridors: an armoured or motorised division pushing ahead of the front measures how far back along its
+//     axis its flanks stand on enemy ground. Its own infantry and reconnaissance battalions can guard a length of flank
+//     (guardKmPerBn each, plus guardKm0); past that it halts until the flanks are covered, and its corps sends an infantry
+//     division forward to line the open flank.
+//  4. Main effort: the army commander gives the corps with the best objective a narrow zone and a reserve; the others attack
+//     on wide zones without one (command.js, armyTick).
+const DOCTRINE = { devKm: 15, alignKm: 8, guardKm0: 10, guardKmPerBn: 4, flankOff: 7, sampleKm: 4, tickMin: 30 };
+function attachDoctrine(S) {
+  const sc = S.sc, D = Object.assign({}, DOCTRINE, sc.doctrine || {});
+  const fighting = u => u.active && !u.dead && u.cls !== 'hq' && u.mv !== 'ship';
+  const centre = F => { let x = 0, y = 0, k = 0; for (const u of F.subs) if (fighting(u)) { x += u.x; y += u.y; k++; } return k ? [x / k, y / k] : null; };
+  // a mobile division: most of its leading battalions ride in vehicles (armour, mechanised, or motorised infantry and reconnaissance)
+  const mobile = F => { const L = F.subs.filter(u => fighting(u) && LEADCLS[u.cls]); return L.length && L.filter(u => u.cls === 'arm' || u.cls === 'mech' || u.mv !== 'foot').length / L.length > .6; };
+  S.isMobile = mobile;
+  const guardBns = F => F.subs.filter(u => fighting(u) && (u.cls === 'inf' || u.cls === 'mech' || u.cls === 'rec')).length;
+
+  // 1. development: hourly flag per formation
+  function devTick() {
+    for (const F of S.forms) { if (!F.active || F.dead) { F.dev = false; continue; } const p = centre(F); if (!p) continue;
+      let near = S.ownAt(p[0], p[1]) !== F.s;
+      if (!near) for (const e of S.subs) if (e.s !== F.s && e.active && !e.dead && e.mv !== 'ship' && S.t - e.seenT < 60 && Math.hypot(e.x - p[0], e.y - p[1]) < D.devKm) { near = true; break; }
+      if (near !== !!F.dev) { F.dev = near; for (const u of F.subs) if (u.goal) u.needPath = true; } } }
+
+  // 2 and 3: alignment and corridors, for every command node with an attack under way
+  function frontTick() {
+    for (const F of S.forms) { F.alignHold = null; F.flankHold = null; }
+    for (const C of S.commands || []) {
+      const O = C.order; if (!O || O.st !== 'issued' || !O.plan || C.forms.some(c => c.forms)) continue;   // divisions under a corps only
+      if (O.p0 == null) O.p0 = O.plan.map(q => centre(q.child)).filter(Boolean).reduce((a, p, i, A) => [a[0] + p[0] / A.length, a[1] + p[1] / A.length], [0, 0]);
+      const L = polyLen(O.line), m = polyAt(O.line, L / 2); let ax = m.x - O.p0[0], ay = m.y - O.p0[1]; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al; const px = -ay, py = ax;
+      const fwd = O.plan.filter(q => !q.reserve && !q.child.dead && centre(q.child)).map(q => { const p = centre(q.child); return { q, F: q.child, p, prog: (p[0] - O.p0[0]) * ax + (p[1] - O.p0[1]) * ay, lat: (p[0] - O.p0[0]) * px + (p[1] - O.p0[1]) * py }; }).sort((a, b) => b.lat - a.lat);
+      fwd.forEach((o, i) => {
+        const F = o.F, mob = mobile(F), free = mob && (O.opt.main || O.opt.exploit);
+        // 2. alignment with the neighbours to left and right
+        if (!free && fwd.length > 1) { const nb = [fwd[i - 1], fwd[i + 1]].filter(Boolean), lag = nb.reduce((a, n) => n.prog < a.prog ? n : a, nb[0]);
+          if (lag && o.prog - lag.prog > D.alignKm && !F.contact) F.alignHold = 'Halted at the bound, waiting for ' + lag.F.n + ' to come up on the flank'; }
+        // 3. a mobile spearhead's open flanks: sample back along the axis on both sides
+        if (mob) { const cap = D.guardKm0 + D.guardKmPerBn * guardBns(F); let open = [0, 0];
+          for (let s = 0; s < 2; s++) { const sg = s ? -1 : 1; for (let d = 0; d < Math.max(0, o.prog) - 2; d += D.sampleKm) { const x = o.p[0] - ax * d + px * sg * D.flankOff, y = o.p[1] - ay * d + py * sg * D.flankOff; if (x < 0 || y < 0 || x > S.map.w || y > S.map.h) break; if (S.ownAt(x, y) === F.s) break; open[s] = d + D.sampleKm; } }
+          const worst = Math.max(open[0], open[1]);
+          if (worst > cap) { const s = open[0] >= open[1] ? 0 : 1, sg = s ? -1 : 1; F.flankHold = 'Halted: ' + Math.round(worst) + ' km of open flank, more than our ' + guardBns(F) + ' guard battalions can cover; waiting for infantry';
+            // the corps sends an infantry division that is in reserve or finished with its task to line the open flank
+            if (!O.flankSent || S.t - O.flankSent > 240) { const inf = O.plan.map(q => q.child).filter(c => c !== F && !c.dead && !mobile(c) && c.active && (O.plan.find(q => q.child === c).reserve || !c.order || c.order.st === 'done'))
+                .sort((a, b) => { const pa = centre(a), pb = centre(b); return (pa ? Math.hypot(pa[0] - o.p[0], pa[1] - o.p[1]) : 1e9) - (pb ? Math.hypot(pb[0] - o.p[0], pb[1] - o.p[1]) : 1e9); })[0];
+              if (inf) { const dmid = Math.min(worst, o.prog) / 2, cx = o.p[0] - ax * dmid + px * sg * D.flankOff, cy = o.p[1] - ay * dmid + py * sg * D.flankOff, hw = Math.min(10, worst / 2);
+                S.issueOrder(inf, [], [[cx - ax * hw, cy - ay * hw], [cx + ax * hw, cy + ay * hw]], { then: 'dig' }); O.flankSent = S.t;
+                S.say(C.s, C.n + ': ' + inf.n + ' sent forward to cover the open flank of ' + F.n + '.', 1); } } } }
+      });
+    }
+    for (const F of S.forms) { const why = F.flankHold || F.alignHold; if (why && F.status !== why && !F.contact) F.status = why; }
+  }
+  let last = -1e9, lastDev = -1e9;
+  const prev = S.cmdHook; S.cmdHook = function () { if (prev) prev(); if (S.t - lastDev >= 60) { lastDev = S.t; devTick(); } if (S.t - last >= D.tickMin) { last = S.t; frontTick(); } };
+  return S;
+}
+
```

## Source trace

- **Problems 1 to 5:** found in the Sarn Corridor build on 23 Nov 2026, from Tov's review of screenshots and from AI-vs-AI runs of the corridor scenario.
- **Patch:** a diff of the Sarn Corridor engine files against france-1944 commit 5c5182b, plus the new `doctrine.js`, with the H-hour, intelligence and variant code removed; the France version saves stop settings under `f44_stop`. Checked with `git apply --check` on 24 Nov 2026.
- **Doctrine sources:** [FM 100-5, 1941, ch. 8](https://ibiblio.org/hyperwar/USA/ref/FM/FM100-5/FM-100-5-8.html) (pars. 355, 364-366), [ch. 9](https://ibiblio.org/hyperwar/USA/ref/FM/FM100-5/FM-100-5-9.html) (pars. 456-457, 475), [ch. 15](https://ibiblio.org/hyperwar/USA/ref/FM/FM100-5/FM-100-5-15.html); German practice: [Lone Sentry, Basic Infantry Tactics](https://lonesentry.com/articles/intelligence-report/basic-infantry-tactics.html) and [German Infantry Tactics 1932-1945](https://www.miniatures.de/tactics-1932-german-infantry.html); Soviet division sector: [Glantz, CSI](https://webharvest.gov/peth04/20041015022815/http://www.cgsc.army.mil/carl/download/csipubs/glantz2.pdf); 1940 and 1941 corridors: [WarHistory, Sickle Cut III](https://warhistory.org/article/sickle-cut-through-france-iii), [With the Ghost Division](https://warhistory.org/de/article/with-the-ghost-division?amp=0), [Armored Forces of Barbarossa II](https://warhistory.org/article/armored-forces-of-barbarossa-ii?amp=0), [Kamenir, Smolensk](https://warfarehistorynetwork.com/article/operation-barbarossa-holding-the-line-at-smolensk/), all read 24 Nov 2026.
- **Inference:** problem 1 almost certainly exists in france-1944, since the code is the same, but this has not been tested on the Overlord map. All setting values, including the doctrine distances (15 km development, 8 km bounds, 10 km plus 4 km per battalion of flank guard), are game settings for balance testing drawn from the doctrine above, untested on the Overlord map.
