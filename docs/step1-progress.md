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
