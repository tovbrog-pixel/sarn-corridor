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
