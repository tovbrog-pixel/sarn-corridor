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
