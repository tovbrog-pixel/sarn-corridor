// ===== COMMANDER RATINGS FROM THE HISTORICAL RECORD =====
// [aggression, skill, basis]. Applied after the balance table, so these override the scenario defaults.
// Commanders not listed keep the scenario's default rating: no performance record was found for them.
// Source keys in comments: HOWE = Howe, Northwest Africa; BLUM = Blumenson, Salerno to Cassino; COLE = Cole, The Ardennes;
// GS = Garland & Smyth, Sicily and the Surrender of Italy; WP = Wikipedia battle/OOB pages; PEG = Pegasus Archive; GEN = general published record, not re-checked in this pass.
(function () {
  const C = {
    // ---- Kasserine
    'Col. Alexander Stark': [.35, .4, 'His force lost Kasserine Pass on 20 February after one day.'], // HOWE
    'Brig. Gen. Paul Robinett': [.6, .85, 'CCB stopped the Afrika Korps drive at Djebel el Hamra on 21-22 February.'], // HOWE
    'Brig. Cameron Nicholson': [.55, .8, 'Nickforce held the Thala ridge on 21-22 February with a scratch force.'], // HOWE
    'Brig. Charles Dunphie': [.6, .7, '26th Armoured Brigade delayed 10. Panzer before Thala at a heavy cost in tanks.'], // HOWE
    'Gen.Maj. Karl Buelowius': [.75, .7, 'KG DAK forced the pass on 20 February, then stalled before Djebel el Hamra.'], // HOWE
    'Gen.Maj. Fritz von Broich': [.8, .8, '10. Panzer reached Thala and was stopped there on 21-22 February.'], // HOWE
    'Gen. Welvert': [.45, .6, 'Held Dernaia and the Tebessa approaches with a mixed French-American force.'], // HOWE
    // ---- Salerno
    'Col. William Darby': [.85, .9, 'Led the Rangers at Gela and held the Chiunzi Pass at Salerno.'], // GEN
    'Lt. Col. William Darby': [.85, .9, 'Led the Rangers at Gela and held the Chiunzi Pass at Salerno.'], // GEN
    'Brig. Robert Laycock': [.8, .85, 'His commandos held the Vietri and La Molina passes at Salerno.'], // GEN
    'Col. William Martin': [.5, .5, 'A battalion of the 143rd was overrun in the Sele-Calore corridor on 13 September.'], // BLUM
    'Generalmajor Wilhelm Schmalz': [.75, .85, 'His group held the Eighth Army before Catania for three weeks in 1943.'], // GS
    'Oberst Wilhelm Schmalz': [.75, .85, 'His group held the Eighth Army before Catania for three weeks.'], // GS
    'Col. James Gavin': [.9, .9, 'Gathered scattered paratroopers to hold Biazzo Ridge against the Hermann Goering Division.'], // GS ch. VIII
    // ---- Market Garden
    'Lt. Col. John Frost': [.85, .95, 'Held the north end of Arnhem bridge for three days and nights.'], // PEG, GEN
    'Brig. Gerald Lathbury': [.8, .7, 'Took Primosole bridge in 1943; wounded at Arnhem, where his brigade broke up.'], // GEN
    'Brig. John Hackett': [.75, .85, 'Fought 4th Parachute Brigade through to Oosterbeek against heavy odds.'], // GEN
    'Brig. Philip Hicks': [.5, .7, 'Held the landing zones, then led the division while Urquhart was cut off.'], // GEN
    'Maj. Gen. Stanislaw Sosabowski': [.7, .85, 'Crossed at Driel under fire; later removed after clashing with Browning.'], // GEN
    'Lt. Col. Roy Lindquist': [.45, .55, 'Slow to send a battalion for Nijmegen bridge on 17 September.'], // GEN
    'Lt. Col. Howard Johnson': [.9, .75, 'Hard-driving; the 501st held Veghel against repeated attacks.'], // GEN
    'Lt. Col. Reuben Tucker': [.85, .9, 'Led the 504th across the Waal in daylight on 20 September.'], // GEN
    'Col. Reuben Tucker': [.85, .9, 'Led the 504th at Salerno, and across the Waal in 1944.'], // GEN
    'SS-Hstuf. Viktor Graebner': [.95, .55, 'Killed leading a costly armoured rush across Arnhem bridge on 18 September.'], // GEN
    'SS-Stubaf. Sepp Krafft': [.6, .85, 'His training battalion delayed 1st Parachute Brigade west of Arnhem on 17 September.'], // GEN
    'SS-Ostubaf. Ludwig Spindler': [.7, .85, 'Built the blocking line that kept 1st Airborne from the bridge.'], // GEN
    'SS-Brigf. Heinz Harmel': [.75, .9, 'Held Nijmegen and blocked XXX Corps at Elst in September 1944.'], // GEN
    'Gen.Lt. Hans von Tettau': [.4, .5, 'His scratch division attacked slowly and piecemeal at Oosterbeek.'], // GEN
    'Major Berndt-Joachim von Maltzahn': [.8, .6, '107. Panzer-Brigade cut the corridor briefly but failed at Son.'], // GEN
    'Oberst Fritz Henke': [.5, .6, 'About 750 older men and flak gunners held the Nijmegen bridges until 10. SS arrived.'], // GEN
    // ---- Bastogne
    'Brig. Gen. Anthony McAuliffe': [.4, .9, 'Held the Bastogne perimeter as acting division commander and answered the surrender demand with "Nuts".'], // COLE
    'Col. William Roberts': [.6, .85, 'Pushed CCB teams out to Noville, Longvilly and Wardin, and built Team SNAFU.'], // COLE
    'Col. Julian Ewell': [.75, .85, 'Met Panzer Lehr head-on at Neffe on 19 December.'], // COLE
    'Lt. Col. Steve Chappuis': [.65, .85, 'The 502nd broke the Christmas Day attack at Champs.'], // COLE
    'Col. Joseph Harper': [.6, .8, 'Held the south and west of the perimeter; carried the "Nuts" reply.'], // COLE
    'Col. Robert Sink': [.7, .85, 'Led the 506th from Normandy through Holland and Bastogne.'], // GEN
    'Col. Wendell Blanchard': [.85, .85, 'CCR broke through to Bastogne on 26 December.'], // COLE
    'Brig. Gen. Herbert Earnest': [.7, .75, 'CCA was held up at Martelange and Warnach.'], // COLE
    'Brig. Gen. Holmes Dager': [.7, .75, 'CCB stalled at Chaumont on 23 December.'], // COLE
    'Lt. Col. Ralph Palladino': [.4, .6, 'III Corps reported troops of the 104th "very timid" on 23 December.'], // Rendezvous with Eagles
    'Col. Joseph H. Gilbreth': [.4, .6, 'His CCR roadblocks were cut to pieces on 18 December; wounded on the 22nd.'], // COLE ch. XIII, XIX
    'Gen.Lt. Fritz Bayerlein': [.55, .65, 'Luettwitz berated him for taking a muddy track to Mageret on 19 December.'], // GEN (warhistory.org)
    'Oberst Meinrad von Lauchert': [.85, .85, 'Drove 2. Panzer past Bastogne to within reach of the Meuse.'], // GEN
    'Oberst Kurt Groeschke': [.6, .8, 'Heilmann rated FJR 15 the best regiment in his division.'], // erenow (Ardennes 1944-1945)
    'Oberst Wolfgang Maucke': [.75, .65, 'His Christmas Day attack broke into the perimeter and was destroyed.'], // COLE
    'Oberst Hans-Joachim Kahler': [.6, .55, 'Wounded before his brigade\'s first action; it attacked without him.'], // COLE ch. XXI
    // ---- Falaise
    'SS-Oberf. Kurt Meyer': [.75, .95, 'Held the Caen-Falaise road against two Canadian offensives.'], // GEN
    'Gen.Lt. Edgar Feuchtinger': [.4, .45, 'Was away from his division on D-Day; later court-martialled.'], // GEN
    'Brig. Leslie Booth': [.6, .55, 'His brigade lost its way in Totalize; killed on 14 August.'], // GEN
    'Brig. Harry Foster': [.65, .8, 'Promoted to command 4th Canadian Armoured Division on 22 August.'], // GEN
    'Gen.Lt. Kurt Chill': [.55, .8, 'Later stabilised a front in Belgium as Kampfgruppe Chill.'], // GEN
    'SS-Staf. Otto Baum': [.8, .85, 'Fought Das Reich out of the Roncey pocket in July.'], // GEN
    'Gen.Lt. Heinrich von Luettwitz': [.7, .85, 'Led 2. Panzer at Mortain and out of the pocket.'], // GEN
    'Col. Louis Dio': [.85, .8, 'His groupement took the Ecouves forest and Carrouges on 12-13 August.'], // unabcc; D-Day Overlord
    'Col. Warabiot': [.75, .75, 'Took Ecouche with the 501e RCC on 13 August, without an artillery preparation.'], // D-Day Overlord
    // ---- Gazala
    'Gen. Marie-Pierre Koenig': [.7, .95, 'Held Bir Hakeim until 10 June; about 2,700 men broke out.'], // WP
    'Maj. Gen. H.B. Klopper': [.35, .45, 'Surrendered Tobruk on 21 June after one day of assault.'], // GEN
    'Brig. C.W. Haydon': [.6, .8, '150th Brigade held at Sidi Muftah until destroyed on 30-31 May; killed.'], // WP
    'Brig. W.G. Carr': [.6, .6, '22nd Armoured Brigade lost 60 of 156 tanks on 5-6 June.'], // WP
    'Brig. A.C. Willison': [.6, .6, '32nd Army Tank Brigade lost 50 of 70 tanks on 5 June.'], // WP
    'Brig. A.A.E. Filose': [.5, .55, '3rd Indian Motor Brigade was overrun on the morning of 27 May.'], // WP
    'Brig. J.C.O. Marriott': [.55, .8, 'Held Knightsbridge until 13 June.'], // GEN; WP gives his command to 17 June
    'Gen.Lt. Gustav von Vaerst': [.8, .85, 'Wounded on 27 May; Crasemann led 15. Panzer from the 28th.'], // WP
    'Gen. Giuseppe de Stefanis': [.7, .75, 'Ariete\'s IX Tank Battalion made the costly attack on Bir Hakeim on 27 May.'], // WP
    // ---- Sicily
    'Gen.Maj. Paul Conrath': [.75, .55, 'Attacked at Gela without contacting Livorno, then broke off and ignored von Senger.'], // GS ch. VIII
    'Ten. Col. Davide Conti': [.75, .55, 'Mobile Group E counterattacked Gela with R35 tanks on 10 July.'], // GS
    'Oberstlt. Ludwig Heilmann': [.75, .9, 'Held the Primosole sector against 50th Division.'], // GEN
    'Lt. Col. John Durnford-Slater': [.85, .9, 'No. 3 Commando landed at Cassibile, then struck at Agnone three days later.'], // weaponsandwarfare
    'Amm. Priamo Leonardi': [.2, .3, 'Augusta fell on 13 July without a serious defence.'], // GEN
  };
  for (const sc of SCENARIOS) for (const fs of sc.forms) { const r = C[fs.cmd]; if (r) { fs.ag = r[0]; fs.sk = r[1]; fs.why = r[2]; } }
  (typeof window !== 'undefined' ? window : globalThis).CMDR = C;
})();
