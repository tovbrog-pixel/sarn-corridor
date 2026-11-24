# Sarn Corridor Campaign Game: Design Document

Tov Binyamin Brog

23 November 2026

## Concept and scope

The game pits two invented great powers against each other on an invented continent, with five neutral states between them. It follows the pattern of Avalon Hill's Blitzkrieg (1965) and runs as a stand-alone desktop game on the Lines of Advance engine and rules, at division level.

- **Scale:** divisions are the maneuver units; regiments and brigades are the sub-units the player sees deployed.
- **Command:** the player gives army and corps orders, with drill-down to single divisions.
- **Sides:** the player commands Valdenmark or Korovia, and an AI theater commander runs the other power.
- **Ending:** every full war runs until one power surrenders, with no time limit.

**Original work.** The continent, nations, cities and names are invented. The design borrows the Blitzkrieg pattern of two powers, five neutrals and a corridor, and takes nothing from the Avalon Hill map, counters or names.

**Why this setting.** An invented continent removes the order-of-battle research a historical campaign needs. Its simpler terrain and transport net cost less to build and run faster in tests, and both powers start equally playable.

## The continent

The Sarn Corridor continent measures 1,400 by 900 km. The Western Ocean bounds it on the west, the Varn Sea on the north and the Inner Sea on the south, and Korovia's interior runs off the eastern edge. It has no islands. The sample map holds 29 cities, 8 of them ports, joined by 30 rail lines and 19 roads, with 24 bridges where they cross rivers.

| **Nation** | **Side** | **Capital** | **Ground** |
| --- | --- | --- | --- |
| Valdenmark | Western power | Halden | Industrial west around Halden. Ports on the Varn Sea and the Western Ocean; wooded Hollerwald on the eastern frontier. |
| Ostval | Western power (province) | Ostrand | Valdenmark province of forest and lakes, reached by land only on the Sarn rail line through Port Vesna. |
| Sarn | Neutral | Sarnow | Owns the corridor and the port at the Vesna mouth; open plain from the Vesna to Drovia. |
| Altenay | Neutral | Vellach | Central plain. Vellach is the hub where 4 rail lines meet. |
| Drovia | Neutral | Drovsk | Forest and the Drovian Marshes along the Pripa, across the main west-east line. |
| Tavia | Neutral | Tavianne | Mountain kingdom. One railway crosses the Tavian Alps at Sennen Pass. |
| Bressa | Neutral | Bressane | Dry plateau and the Bressan Waste; Inner Sea beaches at Port Aurel. |
| Korovia | Eastern power | Korograd | Largest power. Korograd sits behind the Kor, with the Kamen Range on the eastern edge. |

Key features:

- **The Sarn corridor:** Sarn's strip of land reaches the Varn Sea at Port Vesna and separates Valdenmark from Ostval.
- **Obstacles:** the Tavian Alps, the Hollerwald, the Drovian Marshes and the Kor River.
- **Open ground:** the Altenay and Sarn plains in the center favor armor.
- **Landing coasts:** beaches along the Inner Sea and part of the Western Ocean coast.

**Map choice.** The hand-tuned Sarn Corridor map is the default. An option generates a new continent for each game, and fairness checks confirm that both powers get comparable rail nets, ports, defensible ground and production before play starts.

## Command model

The command model carries over from Lines of Advance and the France 1944-45 design. The player draws lines of advance and objective lines for armies or corps, and AI commanders below divide the work.

- On-arrival instructions (hold, dig in, rest and refit, exploit, delay, reserve) with a time limit.
- Crossing lines of advance disrupts and delays both units.
- Each order shows on the map as a slightly transparent symbol.
- Commanders can refuse orders they cannot carry out; the player can relieve them, at a disruption cost that depends on timing.

Invented commanders carry personality types that drive the lessons ledger and the relief rules. A replacement may prove better and brings his own lessons.

## Victory and national will

Each power has a national will meter, and a power surrenders when its will reaches zero. Capturing a capital costs heavy will without ending the war by itself.

| **Cause** | **Effect on will** |
| --- | --- |
| Lost cities | Each city carries a value. Capitals count most, then production cities and ports. |
| Destroyed or encircled divisions | A pocket costs more will than the same losses spread along a front. |
| Strategic bombing and blockade | A slow drain that adds up over months. |
| War weariness | A small monthly loss for both powers. |
| Victories and captured or liberated cities | Restore some will. |

- **The clock against Valdenmark:** Valdenmark starts with better forces, and its will erodes faster each month. Korovia starts with more will and mobilizes more divisions over time. With no time limit, Korovia wins a long war unless Valdenmark breaks it early or slows its own erosion, for example by taking Korovian production cities.
- **Ostval:** losing the province costs Valdenmark heavily, which makes the corridor worth fighting for from the first day.
- **Surrender only:** a full war has no negotiated peace and no time limit.
- **Grading:** a win scores by the time it took and what it cost, so a quick victory scores higher than a war of attrition.
- **Enemy will:** shown as an intelligence estimate whose range narrows with reconnaissance and captured cities.
- **Short scenarios:** each sets its own objectives and deadline, scored by margin. Examples: Valdenmark takes the Sarn corridor in three weeks; Korovia holds the Kor line through autumn; Valdenmark lands at Port Aurel and secures Bressa; Korovia cuts off and takes Ostval.

**Government interference.** When will drops, a power's government issues directives: halt orders, no-retreat demands, pressure to take cities and demands to relieve a commander. The player may obey or defy each one at a cost in will and standing.

## The neutrals

Sarn, Altenay, Drovia, Tavia and Bressa carry most of the politics.

- **Alignment meter:** invasion, overflight, nearby victories and aid move each neutral toward one power, and it joins that power past a threshold.
- **Diplomacy:** production points buy aid and influence that move alignment.
- **Allied command:** a neutral that joins keeps its own AI commander, who follows the player's requests within limits and brings coalition friction.
- **Occupation:** partisans grow under harsh occupation and thin garrisons, and they attack rail lines and supply.

Holding a neutral's capital adds will and production. Invading a neutral costs reputation with the others, and bombing one shifts all of them.

## Forces and production

- **Doctrine:** quality against mass. Valdenmark fields armor and air power; Korovia fields masses of infantry and artillery in depth.
- **Equipment generations:** new models of tanks, aircraft, artillery and anti-tank guns arrive on a schedule, and production can bring them sooner.
- **Era:** the war opens with 1939-40 equipment and can advance to late-war types.
- **Arrivals:** a hybrid model. A fixed schedule delivers each power's core divisions, and cities generate production points at regular intervals for the player to spend.

| **Purchase** | **Appears at** | **Delay** |
| --- | --- | --- |
| Replacements | Worn divisions in rest or reserve | Short |
| New divisions | Depots in home cities | Training time |
| Aircraft groups | Airfields | Build time |
| Shipping | Ports | Build time |

- **Captured cities:** produce for the captor at reduced output after repair.
- **Korovian mobilization:** a fixed ramp-up that speeds up when Korovia loses territory or will.

## Supply

- **Rail plus trucks:** depots sit at railheads, truck columns carry supply forward, and every kilometre past the railhead costs tonnage.
- **Gauge break:** captured Korovian track needs conversion before Valdenmark trains run on it, so a deep advance slows.
- **Separate fuel:** a fuel shortage stops armor and aircraft while infantry fights on with ammunition.
- **Cut-off units:** lose strength and movement daily and surrender after a set time unless relieved or supplied by air. A surrounded region with no enemy troops in it contracts gradually until it all belongs to the surrounding force.

Port capacity limits sea-borne supply. A defender about to lose a port can wreck it, and engineers then need weeks to restore it.

## Seasons and weather

- **Mud:** the spring thaw and autumn rains slow off-road movement and close grass airfields.
- **Winter:** harsher in Korovia, with frostbite and vehicle breakdowns; the west stays milder.
- **Frozen rivers:** deep winter freezes rivers such as the Kor, which then lose their value as defensive lines.
- **Winter equipment:** production buys gear that cuts cold-weather losses. Korovia starts the war equipped.

Storms limit landings and flying in any season.

## Invasion fleets

**Status:** proposed by Claude on 23 Nov 2026 and included at Tov's request, pending his review.

An invasion is one order from the player. A naval commander handles the ships the way division commanders handle their regiments.

- **Shipping pool:** each power keeps transports, landing craft, gunfire ships and escorts in its ports. The naval commander draws a task force from the pool, and it shows as one fleet on the map with its ship counts in a tooltip. Each division needs a set number of transport points, armor more than infantry, and landing craft cap the first wave on a beach.
- **The order:** the player draws a sea arrow from the loading port to a target port or stretch of beach, picks the divisions and sets a landing date. On-arrival instructions apply: secure a beachhead, take the port, dig in or exploit. The naval commander may postpone for weather.
- **Embarking:** units load in the port's staging area out of contact. Loading time depends on port size and unit weight. Enemy reconnaissance raises an alert meter for likely targets, and deception lowers it. Troops aboard cannot fight and lose readiness while they wait.
- **At sea:** the fleet moves at convoy speed and faces enemy aircraft in range, enemy surface ships and submarines, mines off defended coasts, and rough seas. Escorts and air cover cut losses; a sunk transport takes its battalion with it.

- **Landing in a port:** everything comes ashore at the port's full rate, armor and heavy guns included. The port must be in friendly hands or undefended.
- **Landing on a beach:** allowed on beach terrain only. Assault infantry lands first, limited by landing craft, and armor and artillery follow as the craft shuttle back. Units land disrupted and short of supply. Casualties depend on the defenses, the preliminary bombardment, naval gunfire and surprise. The beachhead works as a small temporary port that weather can shut, so taking a real port becomes every landing's first objective.

## The naval war

- **Sea zones:** fleets are assigned to the Varn Sea and the Inner Sea, and control is resolved by zone.
- **Blockade:** sea control over an enemy port cuts its capacity and drains will and production.
- **Submarines:** they sink transports and convoys by zone, and escorts reduce the losses.
- **Fleet strikes:** aircraft attack task forces in range of their airfields.

## Air power

**Status:** proposed by Claude on 23 Nov 2026 and included at Tov's request, pending his review.

The Lines of Advance split stays: the player decides where the air effort goes, and commanders call in close support. Airfields, range and air superiority are new.

| **Group type** | **Missions** |
| --- | --- |
| Fighters | Air superiority and escort |
| Ground attack | Close support and interdiction |
| Bombers | Interdiction, strategic bombing, fleet strikes and airfield attacks |
| Transports | Airborne drops and air supply, with recovery time after each drop |

- **Airfields:** each field's size caps its groups, and the map draws range rings from it. Rebasing costs a day of flying. Engineers build forward strips, captured fields work after repair, bombing craters a field and cuts its sorties, and overrun fields lose any aircraft that cannot fly out.
- **Air superiority:** the map divides into air zones, and each zone gets a control value from the fighters both sides commit. That value scales bomber losses, close support, reconnaissance and fleet strikes in the zone.
- **Who orders what:** the player sets superiority priority by zone and draws interdiction areas over rail lines, roads, bridges and depots; the player also marks strategic targets and fleet strikes. Commanders request close support from their assigned ground-attack groups. Reconnaissance runs automatically, clears fog of war and feeds the invasion alert meter.
- **Sorties and wear:** daily sorties depend on readiness, fuel and bombs delivered by rail, pilot quality and weather. Losses wear groups down. Replacements arrive on a schedule, and rest restores readiness. Low cloud grounds close support.

Flying over a neutral turns its opinion against the intruder, and bombing one also shifts the other neutrals.

## Map, terrain and rendering

- **Map:** one continuous 3D map of 1,400 by 900 km. The player can zoom and tilt but never drops to ground level.
- **Terrain:** the Lines of Advance set: clear, hills, mountains, forest, marsh, desert, beach, lakes and rivers, with towns, roads, railways and bridges.
- **Detail by zoom:** unit symbols at theater zoom; deployed sub-units, vehicles, aircraft and effects near the camera, at the Lines of Advance visual standard.
- **Data:** map.json holds borders, rivers, cities, rail, roads and bridges in kilometres; the terrain raster runs at 2 pixels per km.

**Proposed:** a few hard terrain rules keep ground worth fighting for, such as armor penalties in forest and marsh, and mountain passes as choke points. Trains drawn as real track with a locomotive and troop cars, and the situational soundtrack, would carry over from the France 1944-45 design.

## AI

- **Theater commander:** an AI commander runs the power the player does not hold and reacts to the battle.
- **Neutral governments:** each neutral's AI weighs its alignment meter and decides when to join a side or resist.
- **Commanders:** invented personalities with the lessons ledger; enemy lessons stay hidden until the end of the war.
- **Risk:** as in the France 1944-45 design, the AI work is the largest risk.

## Package and technical architecture

The game ships as a desktop installer: the web engine in a Tauri shell, with data, map, audio, manuals and saves in separate files. The simulation runs apart from the graphics, so tests can run it alone at high speed.

| **Folder** | **Holds** | **Format** |
| --- | --- | --- |
| app | Executable and desktop shell | Tauri |
| engine | Simulation core and renderer modules | JavaScript |
| data | Orders of battle, commanders, production, equipment generations, neutral events, scenarios | JSON |
| map | Terrain raster and map.json; the continent generator | Image tiles, JSON |
| audio | Music and ambient sound; short effects | OGG; WAV |
| docs | Manuals | PDF |
| User folder | Saves and settings, stamped with the data version | JSON |

- **Builds:** GitHub Actions produces the Windows installer.
- **Players:** AI only for now, with the save format ready for two-player games later.

## Testing approach

- AI-vs-AI batches of 20 runs on GitHub Actions, with both powers under AI, compare will curves and surrender dates. A balanced batch splits wins close to evenly between the powers.
- Each short scenario doubles as a test fixture.
- Generated continents pass the fairness checks before testing or play.
- Difficulty levels and randomness get tuned from the batch results.

## Build plan (proposed)

- **Design review:** Tov marks up this document.
- **Engine:** start from the France 1944-45 engine fork, which already adds corps and army echelons.
- **Map:** convert the Sarn Corridor sample map to engine terrain tiles.
- **First slice:** the corridor crisis scenario and a tutorial, then AI-vs-AI testing; the full war follows.

## Open questions

Resolved in Tov's choices on 23 Nov 2026; each decision sits in its section:

- ☒ Victory: surrender only, no time limit, grading by speed and cost, enemy will as an estimate (Victory)
- ☒ Production: hybrid arrivals, four purchase types, captured cities, Korovian mobilization (Forces and production)
- ☒ Neutrals: alignment meter, diplomacy, allied command, partisans (The neutrals)
- ☒ Forces: divisions, quality against mass, equipment generations, 1939-45 range (Forces and production)
- ☒ Supply: rail plus trucks, gauge break, separate fuel, cut-off units (Supply)
- ☒ Seasons: mud, eastern winter, frozen rivers, winter equipment (Seasons and weather)
- ☒ Home front and naval war: government interference, sea zones, blockade, submarines (Victory; The naval war)
- ☒ Map, sides, players and package (The continent; Package)

Still open:

- ☐ Review of the invasion fleet and air power designs
- ☐ Personality types for the invented commanders
- ☐ Training scenario and manual format (France 1944-45 uses the Tennessee maneuvers and FM 101-5 operations orders)
- ☐ Difficulty levels and the range of randomness
- ☐ Target play length for a full war and the game-time rate
- ☐ Final game title (working title: Sarn Corridor)
- ☐ A Western Ocean sea zone for Westerkai and the west coast
- ☐ One shared engine fork with France 1944-45, or a separate copy

## Source trace and inferences

Every design decision in this document comes from Tov's direction in chat on 23 November 2026. The continent and all names are invented.

| **Passage** | **Source** | **Status** |
| --- | --- | --- |
| Victory model, production, neutrals, forces, supply, seasons, home front, naval war, map choice, sides, players, package | Tov's choices in chat, 23 Nov 2026 | Decided |
| Grading by speed and cost; scenario deadlines | Claude's suggestion, confirmed by Tov, 23 Nov 2026 | Decided |
| No islands; Ostrand on the gulf shore | Tov's direction on the sample map, 23 Nov 2026 | Decided |
| Invasion fleets; air power | Claude's proposals in chat, 23 Nov 2026 | Pending review |
| Blitzkrieg pattern: two powers, five neutrals, a corridor, simulated neutral reactions, combined naval task forces | [grognard.com review of Blitzkrieg](https://grognard.com/reviews1/blitz.txt); [Wikipedia, Blitzkrieg (game)](https://en.wikipedia.org/wiki/Blitzkrieg_(game)) | Sourced |
| Map size, city, port, rail, road and bridge counts | Sample map data (map.json), 23 Nov 2026 | Computed |
| Port demolition at Cherbourg, 1944; German gauge conversion in Russia, 1941 | General history | To verify |
| Hasbro's ownership of Avalon Hill | General knowledge | To verify |

**Inferences, labeled:**

- Will values, drain rates, thresholds, lift and loading values: starting values for balance testing.
- Hard terrain rules, the build plan, engine reuse, and the carry-over of troop trains and soundtrack: Claude's proposals.
- Fleet strikes as a naval-war item: drawn from the air power proposal.
- Commander personalities: design intent, untested.
