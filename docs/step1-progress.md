# Step 1 progress: the corridor crisis slice

Tov Binyamin Brog · 23 Nov 2026

## What runs

- **Engine:** a copy of the france-1944 engine as of commit 5c5182b (23 Nov 2026), with division templates added for the three powers.
- **Map:** `tools/mapgen/gen.py` writes the continent as a 1 km grid in the engine's terrain codes (`data/terrain`) plus `data/map.json`. `tools/sarnmap.js` cuts a scenario window from it.
- **Scenario:** `tools/scenario-corridor.js`, the corridor crisis, 1 to 21 June, on a 760 by 380 km window: 10 Valdenmark divisions (3 panzer), 7 Sarn divisions, 4 Korovian divisions entering from day 5. 331 battalions, 52 bridges, 11 objectives.
- **Page:** `node tools/build-preview.js <dir> corridor menu` builds the playable single page; `npm run build` builds the desktop app.

## First AI-vs-AI run (seed 101, 504 game hours)

Valdenmark took Tarnek on day 2, Port Vesna on day 8 and the southern corridor on day 9, and held all three to the end. Korovia took Varnholm on day 9. The run took 486 s, about 1,040 times real time. One seed proves the scenario runs; balance needs the 20-run batch.

## Game settings and stand-ins (inference, game design)

- Battalions borrow existing equipment and 3D models: Valdenmark German early-war kinds, Sarn Italian kinds, Korovia British early-war kinds. Unit kind names in the interface still show those originals.
- A main road follows every railway about 1 km off the track, and local road crossings stand every 20 km on major rivers, so the engine finds bridges there.
- Everything outside Valdenmark and Ostval starts as Sarn's ground, including Altenay and Drovia; neutral territory is not modelled yet.

## Known issues, next work

- Supply trucks drive up to 52 km off-road: the sample map's road net is too sparse for the engine's supply model. Next: a secondary road network in the generator.
- National will, neutral alignment and the Korovian entry decision are not built; Korovia enters on a fixed schedule.
- Air groups use stand-in aircraft types; the 4th field of each group follows the engine's existing format.
- The Windows build runs only by hand (workflow_dispatch), once fixes and tests are finished.

## Fixes after Tov's first look, 23 Nov 2026

- **Pockets now contract.** The pocket rule flooded through sea cells, so every coastal pocket joined the rest of its side's ground across the water and never closed. Sea cells now belong to no pocket (`engine/src/sim.js`, `ownTick`). The France engine has the same rule and likely the same fault.
- **Front-line ground model.** Each hour every land cell within `ownMax` km of formed troops goes to the side whose troops are nearer, measured over land (`frontTick`). The line between armies lies halfway between them, ground behind an advance changes hands, and bypassed divisions end up in pockets. The corridor sets `ownMax: 25` and a 5 km hold radius (`ownR`). Game settings.
- **Corps orders and an AI army.** Opening orders now go to corps (`sc.corpsPlan`), whose commanders split one objective line among their divisions; from hour 30 the Army of the North and the Korovian Western Front give their corps objectives in turn (`armyAI`, frontage set by `frontKm`).
- **More divisions:** 14 Valdenmark, 11 Sarn, 6 Korovian; seven villages as 5-point objectives along Sarn's roads and rail.
- **Supply convoys** already could not route across enemy-held ground; the convoy in the screenshot drove on ground Sarn still held between two Valdenmark advances. The front-line model removes those gaps.
- **Reports no longer pause the clock or move the camera** by default. The Stop-the-clock settings box can turn either back on, saved per game (`sc_stop`).

## Open: the Valdenmark AI bypasses strongpoints

In a 14-day run Valdenmark took only the Vesna crossing. Its divisions pass between Sarn's dug-in divisions, which keep Port Vesna and the corridor towns from inside their pockets. Next: AI corps that reduce bypassed pockets, and cut-off divisions that weaken and surrender as the design document sets out.

## Pockets that starve and shrink, AI that reduces them (23 Nov 2026, later)

- **Shrinking pockets.** A cut-off formation's troops count as up to `isoShrinkKm` km farther away as its supply and strength run down (`frontTick`), so the encircling side takes a pocket's outer ground while the defenders keep the ground they stand on. The engine's existing rules then weaken cut-off units (about 1 percent a day, 4 percent with falling cohesion once stocks are gone) and make them surrender when shattered, out of ammunition and outnumbered. The corridor sets 20 km (game setting).
- **Ports.** A pocket holding a working port is a pocket with a supply source, so it stays open and supplied at the port's rate. Sea control and blockade, which should cut such ports, come with the sea zones.
- **AI reduces pockets.** `armyAI.pocketBonus` (2.5 here) raises the score of an enemy-held objective standing on the army's own ground.

**Run, seed 101, 504 game hours:** Valdenmark took Tarnek, Sarnow, the Vesna crossing, the southern corridor and six of seven villages; losses 17 against 36 battalion-equivalents. Port Vesna held out to the end, supplied through its port, so the corridor victory was not met. Korovia took Varnholm. 602 s, 485 battalions.

`docs/engine-fixes-for-france-1944.md` and `.patch` carry the engine fixes to the France build.

## Doctrine module (24 Nov 2026)

Tov asked for divisions and corps to advance as a line, over open ground near the enemy, with armoured spearheads guarding their flanks. `engine/src/doctrine.js` (module `'doctrine'`) adds development off the roads within 15 km of known enemy or on enemy ground, alignment by bounds (8 km), guarded corridors for mobile divisions (10 km plus 4 km per guard battalion, then halt and call an infantry division to the open flank), and a main effort chosen by the AI army (narrow zone and reserve; wide zones for the rest). Sarn now holds the east bank of the Vesna in seven divisional sectors and the Ostval frontier with two. Sources and settings: `docs/engine-fixes-for-france-1944.md`, section 6.

**Run, seed 101, 504 game hours:** Valdenmark took Tarnek, the Vesna crossing, the southern corridor and five villages; Port Vesna and Sarnow held. Losses 36 Valdenmark against 13 Sarn battalion-equivalents, most of Valdenmark's in the last week against dug-in sectors. Korovia took Varnholm. 735 s.

**Finding:** seven Sarn divisions cannot hold 370 km of river at doctrinal frontages (8 to 12 km a division), so Sarn's line shows as separated sectors. A continuous front on this map needs several times the divisions, or a smaller theatre.

## Fronts that match the forces; tension, intelligence and thick and thin lines (24 Nov 2026)

- **Forces sized to the front:** Valdenmark 30 divisions (16 infantry on the frontier, two panzer corps of two panzer and one motorized division each, 4 in Ostval, 4 arriving), Sarn 22 (14 on the Vesna, 4 thin on the Ostval frontier, 4 in reserve), Korovia 8 from day 3 of the war. 948 battalions.
- **Period of tension:** the game opens 48 hours before H-hour (`sc.hHour`); before it no side fires, flies missions or crosses the frontier, and both can redeploy.
- **Pre-war intelligence** (module `'intel'`): each side starts knowing most enemy front-line divisions and fewer rear ones, placed with errors and sometimes unidentified, drawn as faded symbols with a question mark; contact updates them, and they keep last known positions with the report's age.
- **Thick and thin deployments:** Sarn spreads its Vesna divisions by where it expects the attack (corridor, balanced or south); Valdenmark masses its infantry and both panzer corps on its chosen axis. Six variants pair the two, mostly with Valdenmark attacking where Sarn is thin, and the engine draws one from the game seed (`sc.variants`).
- **France 1944:** the fix document carries fixes 1 to 6 only; these features stay in this game, since the France campaign uses historical deployments.

**Early results (full runs in progress):** variant 0 (Sarn expects the corridor; Valdenmark's main effort south) had Valdenmark holding Tarnek, Sarnow and both corridor objectives by day 9 of the war; variant 5 (Sarn expects the south; main effort north) had Port Vesna and both corridor objectives by day 7.

## Deployment display fixes (24 Nov 2026)

- Valdenmark's 16 first-echelon infantry divisions now start on one line of departure. The line runs 6 km inside the frontier from y 32 to y 372, smoothed over 30 km. Each division holds a sector of it and stretches across the whole sector (`stretch: 1` on the formation; engine/src/sim.js now reads `fs.stretch`). Motorized and panzer divisions form the second echelon behind it.
- Division and regiment labels skip any label that would overlap one already drawn (engine/src/render3.js).
- The camera has no zoom-out limit (R.maxDist about 1,300 km). R.jump only zooms in; use R.glideTo or R.fitAll for the theatre view.
- Sarn's thin-sector regex now reaches the browser build as source strings.
- Check run, variant 0, seed 101, 168 h: Valdenmark took Tarnek on 5 Jun (day 4 of the war) and the Vesna crossing on 6 Jun. Losses V 26, S 29.

## Regiment-level test (24 Nov 2026)

- **Engine:** a unit can stand for several battalions. Sub spec `kind|name|mul|bns`: `mul` sets fire and toughness as before, `bns` sets frontage in line slots, the army AI's frontage weight, the doctrine flank-guard count and column length. Combat distance is measured from the unit's edge, (bns - 1) x 0.75 km to each side. Units with no `bns` behave as before; `node tools/regress.js` matches the baseline.
- **Templates:** `vd_inf_r`, `vd_pz_r`, `vd_mot_r`, `sa_inf_r`, `sa_mot_r`, `ko_inf_r`, `ko_tk_r`: one unit per regiment or brigade, one artillery unit per division, division troops unchanged. `SC_LEVEL=reg` builds Corridor Crisis from them. Differences from the battalion templates: the 2nd panzer regiment is all Pz III type, and artillery merges its medium battalion into the field type.
- **Supply speed-up:** supply read the owner of every map cell through a function call, four times per 10-minute tick; it now reads a cached index. Same results; about half the run time.
- **Run, seed 101, variant 0, 288 h, both levels at once on 2 cores:**
  - Units: 948 battalion-level, 480 regiment-level.
  - Time to 4 Jun 0400: battalion 176 s before the supply fix, 94 s after; regiment 70 s after.
  - Captures (battalion / regiment): Vesna crossing 6 Jun / 4 Jun; Corridor south 7 Jun / 6 Jun; Sarnow 11 Jun / 9 Jun; Port Vesna by neither.
  - Losses at 12 Jun (V / S): battalion 70 / 44; regiment 33 / 74.
- **Profile after the fix (regiment level):** ownership tick 22%, path finding 20%, step 13%, supply flood 12%, combat 5%. Map-wide work costs more than unit count.

## Speed work, step 2 (24 Nov 2026)

Exact changes (results identical: `node tools/regress.js` matches, and the corridor run of seed 101 matches line for line):
- **Held ground:** the 10-minute update works only on cells within reach of a unit, listed as it goes, instead of clearing and scanning the whole grid.
- **Supply columns:** before a route search, a check of whether the depot can reach the headquarters at all. Each side's reachable regions are labelled once per supply tick, by the search's own move rules. 386 of 547 column searches had been failing, and each failure searched every reachable cell.
- **Path finder:** the A* estimate reads a table of the same `Math.hypot` values.
- **Supply flood:** a typed stack and inline neighbour tests.
- **Timing:** `S.TT` holds the milliseconds spent in each part of the step.

Corridor, 120 h, seed 101, run alone: 79.5 s before, 55.7 s after.

Continent load test (`SC_WIN=full`: the same battle on the whole 1,400 x 900 km map), 120 h: 154 s before, 103 s after.

Coarser settings, tested on four seeds over 288 h:
- **`ownCell: 2`** (held ground on 2 km cells): plays like the default. Seeds 202 and 303: losses 36 / 68 and 37 / 63, against 31 / 66 and 34 / 56 by default, with similar capture dates. Safe to use on the continent.
- **`supplyMin: 30`** (supply checked every 30 minutes instead of 10): Valdenmark losses drop to 18-26 and Sarn's to 45-48. It changes the battle, so it stays off.

## Town and city fighting (24 Nov 2026)

Applied from france-1944 (`docs/town-and-city-fighting-for-sarn-corridor.md` and its patch): `engine/src/urban.js`, the capture rule, the town-fire multipliers, the corps commander's handling of towns and the general's warning, plus the four hand edits (module table, loader, app builder, page builder with `urban`, `districts` and `capBig` kept). Corridor Crisis lists the `urban` module. No districts: no Sarn Corridor city is large enough at 1 km cells.

- `node tools/regress.js`: all scenarios match.
- **Built-up areas at start:**
  - Sarnow 12 cells and Halden 12.
  - Port Vesna 6, Freyburg 4 and Brennhaven 4.
  - Every other objective, Tarnek and Ostrand included, keeps the 1.2 km rule. Towns of size 1 cover one or two cells, and Ostrand loses cells to the sea.
- **Corps test:** two infantry divisions and the 1st Panzer, with an objective line across Sarnow.
  - Default order: the panzer division goes to reserve, with the note "Sarnow is infantry work".
  - With `reserve: false`: 3rd Infantry takes the town's stretch and the panzer division keeps 1.5 km beside it.
- **The general's warning** appeared when the 1st Panzer was ordered into Sarnow alone.
- **Four seeds, 288 h, with the rules against without:** seeds 101 and 202 identical; 303 and 404 differ by one or two loss points; capture dates unchanged. The rules hardly fire, because the towns are small on this map: a size-2 town is drawn with a 0.95 km radius, a size-1 town 0.4 km.

## Bigger towns (24 Nov 2026, Tov's decision)

- **Sizes:** the Sarn map draws built-up areas with radii by size: capitals 3.0 km (about 6 km across), size-2 cities 1.75 km and size-1 towns 1.0 km. The radii are in `TOWN_R` in `tools/sarnmap.js`; the corridor villages get 1.0 km too.
- **Engine change:** towns take an optional radius as their fifth field, so France 1944 and the old scenarios are unchanged (`node tools/regress.js` matches).
- **Built-up cells:**
  - Sarnow 32 and Halden 32.
  - Port Vesna 14, Freyburg 12 and Brennhaven 11.
  - Ostrand 5.
  - Tarnek, Varnholm, Saarholt and the villages 4 each.
  - Lisno has none, since its point lies off built-up ground.
- **Four seeds, 288 h, bigger towns with the rules on:**
  - Sarnow fell in 2 of 4 battles (10 Jun twice), where it fell in all 4 with the small towns.
  - Seed 101 took neither Corridor south nor Sarnow.
  - Losses stayed in the same range: 78 / 42, 27 / 67, 33 / 64 and 29 / 56.
- **Bigger towns with the rules off, two seeds:** Sarnow fell in 1 of 2; losses 25 / 75 and 34 / 63. Two seeds can't separate the effect of the rules from the effect of the town size.
- **In play (seed 202):** the corps rule fired once. II Panzer Corps gave Hradek to the 16th Motorized and sent the 4th Panzer beside it. The general's warning did not come up.

## Testbed map (24 Nov 2026)

- **Generator:** `tools/mapgen/testbed.py` writes `data/testbed/` (1 km engine grid and `map.json`) and a preview, `tools/mapgen/out/testbed-preview.png`. `sarnMap({ set: 'testbed' })` loads it. `node tools/testbed-check.js` places one division per side and runs 24 game hours, which took 1.9 s.
- **Size:** 600 x 400 km, the same five nations as the continent.
- **Ostval and the corridor:** Ostval is cut off by a Sarn corridor 35 km wide, which reaches the North Sea at Port Vesna.
- **Neutrals:** Sarn holds the central plain. Tavia holds the Tavian Alps, crossed by one railway at Sennen Pass (hills, no mountain cells on the line), and a dry plateau with beaches near Port Aurel.
- **Korovia:** behind the Kor, an order-4 river marked `freezes`, with marsh in front of it, forest on the Ostval border and the Kamen Range on the east edge.
- **Seas:** the North Sea (Brennhaven, Port Vesna, Ostrand, Severomark) and the South Sea (Westerkai, Port Aurel, Yuzhny), as sea zones in `map.json`.
- **Cities and transport:** 17 cities with production values, 18 railways and 7 roads.
  - Korovian track is broad gauge, with gauge breaks on the Sarnow-Belov and Varnholm-Belov lines.
  - 9 airfields, sized 1 to 3.
- **Terrain cells:** open 182,976; light forest 5,686; heavy forest 1,065; hills 8,721; mountains 14,024; desert 3,147; beach 556; marsh 2,480; sea 20,584; river and lake 761.

## Army orders (24 Nov 2026, from Tov's first play)

Tov ordered the whole army forward on a short objective line, and the army collapsed onto one point: the commander had split a 16 km line among 26 divisions, 0.9 km each. Fixed in `engine/src/command.js`, `planCommandOrder`:
- **Axis:** the axis of advance runs square to the objective line, away from our side of it. One far-off corps, such as the Ostval Corps attacking from the east, no longer pulls it aside.
- **Width:**
  - An army order's objective line runs on along its own direction to cover the front the army holds, so the flank corps go straight ahead and the corps facing the objective take it.
  - Any order's line runs on to at least the room the divisions need to attack, 0.45 km per leading battalion.
  - A corps keeps the narrow line it is given beyond that, so concentration still works when the player orders a corps.
- **Second echelon:** children standing more than 15 km behind the median depth follow behind the main effort, halting 10 km short, and the commander can commit them like a reserve. They no longer take sectors in the line and cut across the leading divisions' routes.
- **Messages:** the commander reports the widening and the second echelon in his messages.

Test (seed 101, Valdenmark played, the army ordered onto 16 km at Corridor south):
- **Before:** 26 divisions on 16 km.
- **After:** objectives from y 114 to 347 km, the line widened to 259 km, both panzer corps in second echelon, and one day later the army on the Vesna as a line.
- **Checks:** `node tools/regress.js` matches. An AI-against-AI run on seed 202 gives similar dates and losses: Tarnek 4 Jun, Vesna crossing 4 Jun, Corridor south 7 Jun, losses 29 / 60.

## Second play round (24 Nov 2026 evening)

From Tov's screenshots: crossing routes, no river assault, brown islands behind the line, divisions entraining and detraining at once.
- **River assaults:**
  - Equipment: Valdenmark has four assault-boat companies (Freyburg and Saarholt) and three pontoon columns; Sarn has one of each.
  - The doctrine module's `xingTick`: a division whose objective lies across a river, with no intact bridge within 8 km of its axis and the river within 6 km, goes over in boats. The AI side, divisions with the staff, and divisions under corps or army orders (`byCmd`) do this themselves; a division under the player's direct order waits for the Cross order.
- **Reserves:**
  - A reserve waits behind its own stretch of the line.
  - A relieved division rests where it stands (relief in place) and cannot be committed again for 12 hours.
  - A division waiting at a river, or halted on purpose for its neighbours or its flank, no longer counts as stalled.
  - A division counts as arrived when its own order is complete, or within 2.5 km of the objective.
- **Second echelon:** its route runs behind the line of departure to the centre before going forward.
- **Route crossings:** two routes within 35 degrees of the same direction (columns sharing a road) no longer count as crossing. This changes results in every scenario, so the regression baseline was recorded again.
- **Rail:** trains unload at least 15 km from enemy-held ground (`railFrontKm`), so moves toward battle end by road or on foot. The double entraining and detraining labels came from fresh orders arriving mid-move during the reserve swapping.
- **Staff map:** ground the player holds always shows as his. The brown islands were stale cells from the start of the game in the gaps between divisions.

Test: Tov's two army orders, seed 101, variant 1, 36 hours.
- **Route-crossing warnings:** 63 and 156 before, 11 and 6 after.
- **Reserve commitments:** 12 before, 2 to 4 after, none in the first day.
- **Assault crossings:** 5 started, 2 completed in each.
- **Rail moves toward the front:** none.
- **With the long objective:** 26 battalions across the Vesna by 36 hours.

AI-against-AI, seed 202: Tarnek 4 Jun, Corridor south 7 Jun, Sarnow 10 Jun, losses 33 / 65.

## Third play round (24 Nov 2026 night)

From Tov's save of 22 Jun 1940 (seed 2237), replayed order by order on the engine he played (6c310b3).
- **Why divisions reversed and took far orders:** in the first 200 hours the corps commanders gave 205 orders of their own (93 rest, 88 hold, 24 reserve) and divisions turned back 30 times. Every stalled attack brought a relief: the reserve came forward, the relieved division went back, and 12 hours later the pair swapped again.
- **Relief policy:** a commander now commits the reserve only when a forward division is spent or lost. A division held up short of its objective keeps its sector, and the commander reports the stall once. A relieved division rests 24 hours. On Tov's replay: 205 orders became 51 to 71, and 30 reversals became 2 to 5. The far orders left (over 40 km) all follow Tov's own corps orders within the hour.
- **Ostval Corps:** a corps standing more than 15 km beyond the army's objective line keeps its present orders when the army is ordered forward. Its route to the line crossed the whole Sarn rear. The order note tells the player.
- **Stale intelligence:** a reported enemy position is struck off when our troops stand within 3 km of it and the division is not within 4 km, or when the spot has been on our ground for 24 hours. Older reports fade with age. On Tov's replay, markers inside our lines fell from 3 to 5 to 0 to 2.
- **Railways over the sea:** the Gulf of Ostrand grew in the terrain pass after the railway waypoints were set, so the Port Vesna to Ostrand line ran 89 km over water and Varnholm to Ostrand 125 km. The generator now tests every railway and road against the engine's own 1 km sea and lake cells, sends any wet line along a land-only route (A* on 1 km cells, a little off the shore, then thinned without leaving land) and stops with an error if any line still touches water. Six lines changed (five railways, the Westerkai to Kessling road), 4 to 25 km longer each. Terrain and elevation are byte-identical.
- **Map drawing:**
  - Trains: a two-car glyph when the camera is over 150 km out, four cars from 60 to 150 km, the full rake closer in.
  - Supply convoys: closer than 8 km the trucks show as models and the map symbol gives way to the load label.
  - Corps highlight: selecting a division outlines the other divisions of its corps in a softer yellow.

Checks: regression matches the baseline. AI-against-AI seeds 11 to 13 at 200 hours on this build and on 6c310b3: the same objectives fall, losses within 5 points, one more corridor win (seed 13).

## One engine for both games (25 Nov 2026)

- **Merge:** `engine/src` is the merged engine: France 1944's at 01917bd plus Sarn's opt-in parts. France 1944 with it matches its own regression, command tests, tutorial run, rail test and a 96 h Overlord run. Sarn's regression results now equal France's on every shared scenario.
- **Game settings:** each game's name and wording come from `game.json`, which `tools/build-preview.js` puts on the page as `GAMECFG`.
- **Square axis for corps orders:** on Tov's 22 Jun replay, France's corps axis (centre to objective) gave 14 turn-backs in 200 hours; the square axis gave 2, with 36 commander orders. The square axis now applies to corps orders in both games.
- **France tutorial:** the 1st Armored Division starts at 24, 34, behind II Corps, so the square axis keeps Hale's plan winning on all five seeds (70-10, 80-0, 70-10, 50-30, 80-0). Only `tutorial-tn` changes in the regression. Overlord computer-against-computer runs are identical, since the computer's corps lines are already square.
- **Shared repository:** the engine and its README and change log are ready in a local repository for tovbrog-pixel/lines-of-advance-engine, waiting for the empty repository on GitHub.

**Batch on the merged engine** (`docs/tests/batch-20261125-1627-merged-engine.md`, commit 869b601, 20 runs of 552 hours), against the bigger-towns batch of 24 Nov (`batch-20261124-2358-towns-big.md`):
- Corridor taken by Valdenmark in 13 of 20 runs (8 before). With the main effort north: 8 of 9 (8 of 9 before); south: 2 of 7 (0 of 7); center: 3 of 4 (0 of 4).
- Median losses: Valdenmark 56 battalion-equivalents (81 before), Sarn and Korovia 103 (88 before).
- Held by Valdenmark at the end: Sarnow in 7 runs (6), Port Vesna 14 (9), Dolna 16 (7), Tarnek 15 (9). Korvik slips to 17 (20).
