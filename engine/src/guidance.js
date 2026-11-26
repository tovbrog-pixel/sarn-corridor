// ===== GUIDANCE FROM HIGHER COMMAND, AND HOW THE BATTLE IS JUDGED =====
// Each side's briefing carries a paragraph of guidance in the voice of the commander above it. The scoring in assess.js reads the
// same factors: deadlines (take or hold an objective by an hour), a casualty budget, political objectives, and for Falaise the
// share of the German army trapped. Weights and thresholds stay inside the code; the player sees only the prose.
// hist: where the battle stood historically at the scenario's last hour, as an Allied-positive index (-1 to 1).
// par: the Allied share of objective points historically held at the scenario's last hour.
// base: history indexes from computer-versus-computer runs of the current model (test/regress.js, 6 runs, normal difficulty), for grading a player against the computer.
// budget: losses, as a share of the side's whole order of battle, that its government and high command would accept. Calibrated to the
// game's own loss rates in computer-versus-computer runs, so a typical run sits near 1. hr: the historical loss ratio against that budget.
// Deadlines carry at: the historical hour (null = never; for hold, the hour it was lost) and end: 0 where it was lost again by the end.
// Political objectives carry h: whether that side held it at the end historically. The index is measured against these historical values.
// Sources per scenario in the comments: HOWE, BLUM (Salerno to Cassino), BLUM2 (Breakout and Pursuit), COLE, GS (Garland & Smyth),
// WP (Wikipedia), MITCHELL (The 101st Airborne Division's Defense of Bastogne, CGSC 1986). GEN: general published record.
(function () {
  const G = {
    // Kasserine: Comando Supremo set Le Kef as the objective and Tebessa as the western anchor; Rommel judged he had to "break through
    // quickly at all costs" on 20 Feb (HOWE ch. XXIII). Allied plan of 20-21 Feb: hold Thala and Sbiba, counterattack on the flanks,
    // "Allied tanks were to be conserved" (HOWE). II Corps' first major battle (GEN).
    // Losses 14-24 Feb, Sidi Bou Zid included: Allied 10,000 of 30,000 (6,500 American) and 183 tanks; Axis 2,000 of 22,000 and 34 tanks (Britannica).
    // The 19-23 Feb share is smaller, so hr sets the Allied side well over its budget (1.5) and the Axis well under (.5): a judgment from those totals.
    kasserine: { base: [0.009,  0.038,  0.092,  0.126,  0.129,  0.134], hist: 0, par: .76,
      sides: [{ hq: 'First Army', capital: 'Washington and London', budget: .12, hr: 1.5,
          text: 'General Anderson expects the passes of the Western Dorsal held, above all Thala, the gate to Le Kef and our rear, and the road to the Tebessa depots past Djebel el Hamra. Conserve the tanks: they are scarce, and First Army will counterattack on the flanks once the enemy has spent himself. This is II Corps\' first real test. Washington and London are watching, and another rout like Sidi Bou Zid would shake their confidence in the American army.' },
        { hq: 'Comando Supremo', capital: 'Rome and Berlin', budget: .26, hr: .5,
          text: 'Comando Supremo calls this a unique opportunity. The objective is Le Kef by way of Thala, with Tebessa as the western anchor. Time is short: Montgomery is closing on the Mareth Line, every day lets the Allies bring up reserves, and you must break through quickly. You cannot replace what you lose here, so a slow grinding fight is a defeat even if the ground is taken.' }],
      deadlines: [{ n: 'Kasserine Pass', s: 1, by: 38, at: 37 }, { n: 'Thala', s: 1, by: 62, at: null }, { n: 'Thala', s: 0, by: 96, hold: 1 }, { n: 'Djebel el Hamra', s: 0, by: 96, hold: 1 }, { n: 'Sbiba', s: 0, by: 96, hold: 1 }],
      political: [{ n: 'Thala', s: 0, h: 1, held: 'Thala held: the road to Le Kef and the Allied rear stayed shut.', lost: 'Thala fell, opening the road to Le Kef.' }] },
    // Salerno: Clark had Hewitt prepare to withdraw troops on 13 Sep, then on 14 Sep "there would be no retreat"; land-based fighters
    // were planned at Montecorvino by 10 Sep (BLUM ch. VIII). Kesselring ordered "a final effort" to drive Fifth Army into the sea for
    // political and military reasons, then a gradual withdrawal toward Rome (BLUM ch. VIII).
    salerno: { base: [-0.285,  -0.099,  0.193,  0.31,  0.38,  0.383], hist: .25, par: .56,
      sides: [{ hq: 'Fifth Army', capital: 'Washington and London', budget: .2,
          text: 'General Clark needs Salerno port and the Montecorvino airfield quickly: fighter cover from Sicily is at the limit of its range, and the plan has our own fighters flying from Montecorvino by the second day. Naples is the prize beyond. Eighth Army is far to the south and will not arrive in time. There will be no withdrawal from the beaches. An evacuation would be a disaster no communique could hide.' },
        { hq: 'Field Marshal Kesselring', capital: 'Berlin', budget: .45,
          text: 'Field Marshal Kesselring wants the landing thrown back into the sea, for political as much as military reasons. Whatever the result, Tenth Army will then withdraw north toward Rome, and it must arrive with its divisions intact. Strike while the beachhead is shallow, and do not bleed the panzer divisions white in a battle we intend to leave.' }],
      deadlines: [{ n: 'Salerno', s: 0, by: 16, at: 30 }, { n: 'Montecorvino airfield', s: 0, by: 32, at: 30 }, { n: 'Paestum', s: 0, by: 180, hold: 1 }, { n: 'Paestum', s: 1, by: 152, at: null }],
      political: [{ n: 'Paestum', s: 0, h: 1, held: 'The beachhead held at Paestum. There was no evacuation.', lost: 'Paestum was lost: the beachhead was broken.' },
        { n: 'Paestum', s: 1, h: 0, held: 'Paestum was taken: the landing was thrown back.', lost: 'The landing could not be thrown back.' }] },
    // Market Garden: timetable Eindhoven 17:00 and Veghel midnight on 17 Sep, Grave noon and Nijmegen 18:00 on 18 Sep, Arnhem 15:00 on
    // 19 Sep; 1st Airborne to be relieved by the fourth day at the latest (WP). Aim: hook round the Siegfried Line, a Rhine crossing,
    // the Ruhr (WP). The Arnhem deadline is a relief: the bridge held and joined by road to XXX Corps by 15:00 on 19 Sep; it never was. Model sent all available armour to Arnhem; Bittrich reinforced the Nijmegen bridge (WP).
    marketgarden: { base: [-0.323,  -0.28,  0.093,  0.146,  0.5,  0.671], hist: -.3, par: .66,
      sides: [{ hq: 'Second Army', capital: 'London and Washington', budget: .24,
          text: 'Field Marshal Montgomery wants a bridge over the Rhine at Arnhem and a road to the Ruhr, round the end of the Siegfried Line. The timetable is tight: Eindhoven by the evening of the first day, Grave and Nijmegen on the second, Arnhem by the afternoon of the third. 1st Airborne must be relieved by the fourth day at the latest. Every hour the road is closed costs the men at Arnhem, and a corridor that stops short of the Rhine buys nothing.' },
        { hq: 'Field Marshal Model', capital: 'Berlin', budget: .23,
          text: 'Field Marshal Model orders the airborne landing at Arnhem destroyed and the Nijmegen bridge held at any price, so the two halves of the enemy never join. Every armoured vehicle available is going to Arnhem. Cut the corridor wherever it is thin. Give up ground in the south if that keeps the Rhine bridge.' }],
      deadlines: [{ n: 'Eindhoven', s: 0, by: 6, at: 29 }, { n: 'Grave bridge', s: 0, by: 23, at: 3 }, { n: 'Nijmegen bridge', s: 0, by: 29, at: 78 }, { n: 'Arnhem bridge', s: 0, by: 50, at: null, relieve: 1 }, { n: 'Nijmegen bridge', s: 1, by: 216, hold: 1, at: 78 }],
      political: [{ n: 'Arnhem bridge', s: 0, h: 0, held: 'The Rhine was crossed at Arnhem.', lost: 'The Rhine bridge at Arnhem was not held.' },
        { n: 'Arnhem bridge', s: 1, h: 1, held: 'The Arnhem bridge stayed in German hands.', lost: 'The Arnhem bridge was lost.' }] },
    // Bastogne: relief deadline = the hour CCR 4th Armored reached the perimeter at Assenois, 16:50 on 26 Dec (scenario note).
    // Eisenhower at Verdun: holding Bastogne "essential to future offensive operations"; Third Army attack at 0600 on 22 Dec
    // "to relieve Bastogne" (COLE ch. XXI). Hitler expressly ordered Bastogne taken; Luettwitz was told it "would definitely have to be
    // taken" (MITCHELL); Manteuffel was angry it had not fallen on 18 Dec (warhistory.org).
    bastogne: { base: [-0.386,  -0.102,  -0.068,  -0.021,  0.133,  0.139], hist: .4, par: .74,
      sides: [{ hq: 'Third Army', capital: 'Washington', budget: .2,
          text: 'General Eisenhower calls the holding of Bastogne essential to every offensive that follows. The town has become a symbol to the press at home, and holding it comes first. The 101st and the armour in the town will hold a closed perimeter. Third Army attacks at 06:00 on 22 December to relieve it, and General Patton wants the advance driven through the night. Do not spend the airborne in sorties when the perimeter can hold.' },
        { hq: 'Fifth Panzer Army', capital: 'Berlin', budget: .5,
          text: 'The Fuehrer has expressly ordered Bastogne taken. General von Manteuffel wants it quickly: its roads carry everything the panzer divisions need on their way to the Meuse, and he is angry it did not fall on the 18th. If the panzers cannot take it in passing they will go round it, and the Volksgrenadiers must finish the job. Every day the town holds out, the American relief force comes closer.' }],
      deadlines: [{ n: 'Bastogne', s: 0, by: 192, hold: 1 }, { n: 'Bastogne', s: 0, by: 179, at: 179, relieve: 1 }, { n: 'Bastogne', s: 1, by: 78, at: null }],
      political: [{ n: 'Bastogne', s: 0, h: 1, held: 'Bastogne held. The press at home has its symbol.', lost: 'Bastogne fell, and every newspaper at home will say so.' },
        { n: 'Bastogne', s: 1, h: 0, held: 'Bastogne was taken, as the Fuehrer ordered.', lost: 'Bastogne was not taken, against the Fuehrer\'s express order.' }] },
    // Falaise: Bradley preferred "a solid shoulder at Argentan to a broken neck at Falaise"; on 16 Aug Montgomery proposed meeting at
    // Trun and Chambois (BLUM2 ch. XXVI). Kluge recommended evacuation through the gap on 16 Aug; Hitler's order required Falaise held
    // and the gap widened (BLUM2). About 50,000 prisoners; tens of thousands escaped (scenario note, WP).
    falaise: { base: [-0.383,  -0.17,  0.212,  0.284,  0.324,  0.406], hist: .35, par: .93, trap: .55,
      sides: [{ hq: 'Allied ground command', capital: 'London and Washington', budget: .16,
          text: 'General Montgomery and General Bradley mean to destroy the German armies in Normandy between the two jaws of a pincer: the Canadians and Poles from the north through Falaise and Trun, the Americans and French from the south. Close the gap at Chambois. Count success in German divisions destroyed or taken. Watch the boundary between the army groups: a head-on clash between Allied columns would be a calamity.' },
        { hq: 'Army Group B', capital: 'Berlin', budget: .55,
          text: 'The Fuehrer orders Falaise held and the gap widened by attack. Field Marshal von Kluge knows the armies must come out through the gap between Falaise and Argentan while it still exists. Keep Trun, Chambois and St-Lambert open as long as the columns are moving. Every division brought out of the pocket is a division that can fight on the Seine.' }],
      deadlines: [{ n: 'Falaise', s: 0, by: 108, at: 114 }, { n: 'Trun', s: 0, by: 144, at: 144 }, { n: 'Chambois', s: 0, by: 180, at: 180 }, { n: 'Falaise', s: 1, by: 108, hold: 1, at: 114 }, { n: 'Chambois', s: 1, by: 180, hold: 1, at: 180 }],
      political: [{ n: 'Chambois', s: 0, h: 1, held: 'The pocket was closed at Chambois.', lost: 'The gap at Chambois was never closed.' }] },
    // Gazala: Comando Supremo ordered Bastico and Rommel to "defeat the British armoured forces and capture Tobruk"; the advance would
    // stop at the frontier so the Luftwaffe could turn to Malta (Herkules); supply became "desperate" (WP). Churchill set "great store"
    // by Tobruk; Auchinleck did not mean to hold it "at all costs" (WP). Bir Hakeim held by the Free French until 10 June (WP).
    gazala: { base: [-0.297,  -0.291,  -0.284,  -0.28,  -0.179,  -0.156], hist: -.25, par: .78,
      sides: [{ hq: 'Eighth Army', capital: 'London', budget: .2, hr: 1.4,
          text: 'General Ritchie expects the Gazala Line held from the sea to Bir Hakeim, and Rommel\'s armour destroyed when it comes round the southern flank. The armoured brigades are the army: lose them and the line cannot stand. The Prime Minister sets great store by Tobruk, and its fall would echo far beyond the desert. The Free French at Bir Hakeim carry the honour of France, and General de Gaulle is watching.' },
        { hq: 'Panzerarmee Afrika', capital: 'Rome and Berlin', budget: .3,
          text: 'Comando Supremo orders the British armour defeated and Tobruk captured. The window is short: once Tobruk falls the Luftwaffe turns to Malta, and the supply line from Tripoli is already stretched to breaking. Swing round Bir Hakeim, cut the coast road behind the Gazala Line, and take El Adem and Tobruk before the British can concentrate. A battle of attrition in the desert is one we cannot afford.' }],
      deadlines: [{ n: 'Bir Hakeim', s: 1, by: 18, at: null }, { n: 'El Adem', s: 1, by: 30, at: null }, { n: 'Tobruk', s: 0, by: 264, hold: 1 }, { n: 'Bir Hakeim', s: 0, by: 264, hold: 1 }],
      political: [{ n: 'Tobruk', s: 0, h: 1, held: 'Tobruk still stands.', lost: 'Tobruk fell. The news will shake London.' },
        { n: 'Bir Hakeim', s: 0, h: 1, held: 'The Free French held Bir Hakeim.', lost: 'Bir Hakeim was overrun.' },
        { n: 'Tobruk', s: 1, h: 0, held: 'Tobruk was captured.', lost: 'Tobruk was not taken.' }] },
    // Sicily: Alexander's plan: Eighth Army the main effort toward Catania and Messina, Seventh Army to protect its flank and seize the
    // Licata, Ponte Olivo, Biscari and Comiso airfields; Syracuse the key port, expected soon after landing; Patton hoped to reach his
    // initial objectives in three days (GS ch. V). Kesselring ordered the Hermann Goering Division to counterattack toward Gela on
    // 11 July (GS ch. VIII).
    sicily: { base: [-0.221,  -0.152,  -0.099,  -0.094,  -0.081,  0.16], hist: .3, par: .7,
      sides: [{ hq: '15th Army Group', capital: 'Washington and London', budget: .16,
          text: 'General Alexander gives Eighth Army the main effort: Syracuse on the first day, then Augusta and Catania, and on to Messina. Seventh Army is the shield on the left: take the airfields at Licata, Ponte Olivo and Comiso, open the ports at Licata and Gela, and protect Montgomery\'s flank. General Patton wants his first objectives in three days. Washington is still counting the cost of Kasserine, and every day the Germans hold the Catania plain they gain time to bring reinforcements across from the mainland.' },
        { hq: 'Field Marshal Kesselring', capital: 'Rome and Berlin', budget: .3,
          text: 'Field Marshal Kesselring trusts only the German divisions. He orders the Hermann Goering Division to throw the Americans back into the sea at Gela. In the east, hold the Catania plain: it covers the road to Messina and the only way home. If the island cannot be held, the divisions on it must still come home.' }],
      deadlines: [{ n: 'Syracuse', s: 0, by: 18, at: 18 }, { n: 'Licata', s: 0, by: 12, at: 8 }, { n: 'Ponte Olivo airfield', s: 0, by: 72, at: 48 }, { n: 'Comiso airfield', s: 0, by: 72, at: 30 }, { n: 'Catania', s: 0, by: 105, at: null }, { n: 'Gela', s: 1, by: 39, at: null }, { n: 'Catania', s: 1, by: 200, hold: 1 }],
      political: [{ n: 'Syracuse', s: 0, h: 1, held: 'Syracuse is open to Allied shipping.', lost: 'Syracuse was not secured.' },
        { n: 'Catania', s: 1, h: 1, held: 'The Catania plain and the road to Messina stayed open.', lost: 'Catania fell, threatening the road to Messina.' }] },
  };
  (typeof window !== 'undefined' ? window : globalThis).GUIDE = G;
})();
