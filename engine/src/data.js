// ===== DATA: unit kinds, aircraft, commander names =====
// Kind fields: n name, cls class, mv move class (foot/wheel/track/ship), spd road km/h, sa soft attack,
// ha hard attack, pen penetration mm @500 m, arm frontal armour mm (0 = soft), rng direct range km,
// ir indirect range km, size toughness (1 = full battalion), vis visual elements, eq equipment note.
function kd(n, cls, mv, spd, sa, ha, pen, arm, rng, ir, size, vis, eq) { return { n, cls, mv, spd, sa, ha, pen, arm, rng, ir, size, vis, eq }; }
const KIND = {
  // ---- United States
  us_inf: kd('Infantry Bn', 'inf', 'foot', 4.5, 1.0, .15, 81, 0, 1.0, 0, 1, { s: 16 }, 'M1 Garand, BAR, M1919A4, 81mm mortar; 57mm M1 AT (81mm pen); bazooka'),
  us_para: kd('Parachute Inf Bn', 'inf', 'foot', 4.5, 1.0, .1, 80, 0, .9, 0, .8, { s: 14 }, 'M1 Garand, M1A1 carbine, M1919A6, 60mm mortar, bazooka'),
  us_glider: kd('Glider Inf Bn', 'inf', 'foot', 4.5, .95, .15, 81, 0, .9, 0, .85, { s: 14 }, 'M1 Garand, BAR, 57mm AT, 81mm mortar'),
  us_ranger: kd('Ranger Bn', 'cdo', 'foot', 5, .95, .1, 80, 0, .9, 0, .6, { s: 10 }, 'M1 Garand, BAR, 60mm mortar, bazooka; assault trained'),
  us_arminf: kd('Armored Infantry Bn', 'mech', 'track', 72, 1.2, .25, 81, 8, 1.0, 0, 1, { s: 10, v: ['m3ht', 4] }, 'M3 half-track (72 km/h, 13mm), .50 cal, 57mm AT x9, bazooka'),
  us_eng: kd('Combat Engineer Bn', 'eng', 'wheel', 40, .7, .08, 80, 0, .8, 0, .8, { s: 10, v: ['truck_us', 2] }, 'Bridging, demolitions, mines; fights as infantry'),
  us_tk_m4: kd('Tank Bn (M4 Sherman)', 'arm', 'track', 38, 1.3, 1.0, 68, 85, 1.5, 0, 1, { v: ['sherman', 6] }, 'M4/M4A1 x53: 75mm M3 (68mm pen @500m), hull 51mm @56 deg, 38 km/h; M5A1 x17'),
  us_tk_m4b: kd('Tank Bn (M4 75/76mm)', 'arm', 'track', 40, 1.3, 1.0, 88, 88, 1.5, 0, 1, { v: ['sherman76', 6] }, 'M4A3 75mm and M4A3(76)W (76mm M1: 98mm pen, the 3-inch M7 projectile), 42 km/h; M5A1 light tanks'),
  us_tk_m3: kd('Tank Bn (M3 Lee / M4)', 'arm', 'track', 39, 1.2, .9, 62, 65, 1.4, 0, 1, { v: ['lee', 6] }, 'M3 Lee: 75mm M2 hull gun (60mm pen), 37mm turret, 51mm armour, 39 km/h'),
  us_td_m10: kd('Tank Destroyer Bn (M10)', 'at', 'track', 48, .4, 1.0, 98, 55, 1.6, 0, .7, { v: ['m10', 5] }, 'M10 GMC x36: 3-inch M7 (98mm pen), 38mm sloped armour, open turret'),
  us_td_m18: kd('Tank Destroyer Bn (M18)', 'at', 'track', 80, .4, 1.0, 98, 20, 1.6, 0, .7, { v: ['m18', 5] }, 'M18 Hellcat x36: 76mm M1 (98mm pen, same projectile as the 3-inch M7), 13mm armour, 80 km/h'),
  us_td_m3: kd('Tank Destroyer Bn (M3 GMC)', 'at', 'track', 72, .4, .8, 60, 10, 1.3, 0, .7, { v: ['m3gmc', 5] }, 'M3 75mm GMC half-track: M1897A4 gun (60mm pen), 16mm shield'),
  us_fa105: kd('Field Artillery Bn (105mm)', 'art', 'wheel', 40, 1.5, 0, 0, 0, 0, 11.2, .6, { g: ['how105', 4], s: 8, v: ['truck_us', 2] }, 'M2A1 105mm howitzer x12, range 11.2 km'),
  us_fa155: kd('Field Artillery Bn (155mm)', 'art', 'wheel', 35, 2.2, 0, 0, 0, 0, 14.6, .6, { g: ['how155', 4], s: 8, v: ['truck_us', 2] }, 'M1 155mm howitzer x12, range 14.6 km'),
  us_afa: kd('Armored FA Bn (M7 Priest)', 'art', 'track', 39, 1.8, 0, 0, 12, 0, 11.2, .6, { v: ['priest', 4] }, 'M7 105mm HMC x18, range 11.2 km, 39 km/h'),
  us_gfa105: kd('Glider FA Bn (105mm M3)', 'art', 'wheel', 30, 1.2, 0, 0, 0, 0, 7.3, .5, { g: ['how105', 4], s: 8 }, 'M3 105mm short howitzer x12 on the pack-howitzer carriage, range about 7.3 km'),
  us_pfa: kd('Parachute FA Bn (75mm pack)', 'art', 'wheel', 30, .9, 0, 0, 0, 0, 8.8, .5, { g: ['pack75', 4], s: 8 }, 'M1A1 75mm pack howitzer x12, range 8.8 km'),
  us_mort: kd('Chemical Mortar Bn (4.2-in)', 'art', 'wheel', 35, 1.2, 0, 0, 0, 0, 4.0, .5, { g: ['mortar', 4], s: 8 }, 'M2 4.2-inch mortar x36, range 4.0 km, HE and WP'),
  us_rec: kd('Cavalry Recon Sqn', 'rec', 'wheel', 88, .6, .3, 53, 15, 1.0, 0, .6, { v: ['m8', 4] }, 'M8 Greyhound: 37mm M6 (53mm pen), 19mm armour, 88 km/h'),
  // ---- United Kingdom
  uk_inf: kd('Infantry Bn', 'inf', 'foot', 4.5, .95, .15, 81, 0, 1.0, 0, 1, { s: 16 }, 'No.4 rifle, Bren, Vickers MMG, 3-in mortar; 6-pdr AT (81mm pen); PIAT'),
  uk_mot: kd('Motor Bn', 'mech', 'track', 48, 1.05, .2, 81, 8, 1.0, 0, .9, { s: 10, v: ['carrier', 4] }, 'Universal Carrier (48 km/h, 10mm), M5 half-track, Bren, 6-pdr AT'),
  uk_para: kd('Parachute Bn', 'inf', 'foot', 4.5, 1.0, .1, 75, 0, .9, 0, .75, { s: 13 }, 'No.4 rifle, Sten, Bren, 3-in mortar, PIAT'),
  uk_airldg: kd('Airlanding Bn', 'inf', 'foot', 4.5, 1.0, .25, 100, 0, 1.0, 0, .95, { s: 15 }, 'Glider infantry: Bren, Vickers, 3-in mortar, 6-pdr and 17-pdr AT'),
  uk_cdo: kd('Commando', 'cdo', 'foot', 5, .9, .08, 75, 0, .8, 0, .5, { s: 9 }, 'No.4 rifle, Thompson, Bren, 3-in mortar; assault trained'),
  uk_tk_sher: kd('Armoured Regt (Sherman V / Firefly)', 'arm', 'track', 40, 1.3, 1.05, 90, 85, 1.5, 0, 1, { v: ['sherman', 4, 'firefly', 2] }, 'Sherman V 75mm (68mm pen) x3 per troop + Firefly 17-pdr (140mm pen) x1'),
  uk_tk_sher3: kd('Armoured Regt (Sherman III)', 'arm', 'track', 40, 1.3, 1.0, 68, 85, 1.5, 0, 1, { v: ['sherman', 6] }, 'Sherman III (M4A2): 75mm M3 (68mm pen), 51mm hull, 40 km/h'),
  uk_tk_crom: kd('Armd Recce Regt (Cromwell)', 'arm', 'track', 61, 1.25, .95, 66, 76, 1.5, 0, 1, { v: ['cromwell', 6] }, 'Cromwell IV: 75mm QF (66mm pen), 76mm armour, 61 km/h'),
  uk_tk_val: kd('Armoured Regt (Valentine / Crusader)', 'arm', 'track', 30, 1.0, .9, 62, 60, 1.2, 0, .9, { v: ['valentine', 4, 'crusader', 2] }, 'Valentine III 2-pdr (53mm pen, 65mm armour, 24 km/h); Crusader III 6-pdr (81mm pen)'),
  uk_rec: kd('Armoured Car Regt', 'rec', 'wheel', 80, .6, .3, 53, 16, 1.0, 0, .6, { v: ['daimler', 4] }, 'Daimler armoured car: 2-pdr (53mm pen), 16mm armour, 80 km/h'),
  uk_fd25: kd('Field Regt RA (25-pdr)', 'art', 'wheel', 40, 1.9, 0, 0, 0, 0, 12.3, .7, { g: ['pdr25', 4], s: 8, v: ['truck_uk', 2] }, 'Ordnance QF 25-pdr x24, range 12.3 km'),
  uk_sexton: kd('Field Regt RA (Sexton SP)', 'art', 'track', 40, 1.9, 0, 0, 12, 0, 12.3, .7, { v: ['sexton', 4] }, 'Sexton 25-pdr SP x24, range 12.3 km'),
  uk_med55: kd('Medium Regt RA (5.5-in)', 'art', 'wheel', 30, 2.4, 0, 0, 0, 0, 14.8, .6, { g: ['med55', 4], s: 8, v: ['truck_uk', 2] }, 'BL 5.5-inch gun x16, range 14.8 km'),
  uk_ltbty: kd('Airlanding Light Regt (75mm)', 'art', 'wheel', 30, .9, 0, 0, 0, 0, 8.8, .5, { g: ['pack75', 4], s: 8 }, 'M1A1 75mm pack howitzer x24, range 8.8 km'),
  uk_at: kd('Anti-Tank Bty RA', 'at', 'wheel', 40, .1, .9, 110, 0, 1.5, 0, .35, { g: ['pdr17', 3], s: 6 }, '6-pdr (81mm pen) and 17-pdr (140mm pen) towed AT guns'),
  uk_re: kd('Field Coy RE', 'eng', 'wheel', 40, .5, .05, 75, 0, .7, 0, .5, { s: 8, v: ['truck_uk', 2] }, 'Bailey bridging, assault boats, demolitions'),
  // ---- Germany
  ge_inf: kd('Grenadier-Btl', 'inf', 'foot', 4.5, 1.0, .15, 96, 0, 1.0, 0, .9, { s: 15 }, 'Kar 98k, MG 34/42, 8cm GrW 34; 7.5cm PaK 40 (96mm pen); Panzerfaust'),
  ge_vg: kd('Volksgrenadier-Btl', 'inf', 'foot', 4.5, .95, .12, 96, 0, .9, 0, .75, { s: 13 }, 'StG 44, MG 42, Panzerschreck, Panzerfaust; reduced establishment'),
  ge_fj: kd('Fallschirmjaeger-Btl', 'inf', 'foot', 4.5, 1.05, .12, 96, 0, 1.0, 0, .85, { s: 14 }, 'FG 42, MG 42, 8cm GrW, Panzerschreck, Panzerfaust'),
  ge_pzgr: kd('Panzergrenadier-Btl (mot)', 'inf', 'wheel', 60, 1.15, .15, 96, 0, 1.0, 0, .9, { s: 13, v: ['truck_ge', 3] }, 'Opel Blitz lorried: MG 34/42 x2 per squad, 8cm GrW, 7.5cm PaK 40'),
  ge_pzgr_spw: kd('Panzergrenadier-Btl (gep)', 'mech', 'track', 52, 1.3, .25, 96, 10, 1.0, 0, .9, { s: 10, v: ['sdkfz251', 4] }, 'SdKfz 251 (52 km/h, 14.5mm), MG 42, 251/9 7.5cm, 251/2 mortar'),
  ge_krad: kd('Aufklaerungs-Abt', 'rec', 'wheel', 70, .75, .3, 59, 12, 1.0, 0, .7, { v: ['sdkfz234', 4] }, 'SdKfz 222/231/234 armoured cars: 2cm KwK 38 and 5cm KwK 39 (59mm pen)'),
  ge_pz3: kd('Panzer-Abt (Pz III L/N)', 'arm', 'track', 40, 1.1, .9, 59, 70, 1.3, 0, .9, { v: ['pz3', 6] }, 'Pz III L: 5cm KwK 39 L/60 (59mm pen), 50+20mm armour, 40 km/h'),
  ge_pz4e: kd('Panzer-Abt (Pz IV G / Pz III)', 'arm', 'track', 40, 1.2, 1.0, 82, 62, 1.5, 0, .9, { v: ['pz4', 3, 'pz3', 3] }, 'Pz IV F2/G: 7.5cm KwK 40 L/43 (91mm pen), 50mm armour; Pz III L/N'),
  ge_pz4: kd('Panzer-Abt (Pz IV H)', 'arm', 'track', 38, 1.2, 1.0, 96, 80, 1.6, 0, .9, { v: ['pz4', 6] }, 'Pz IV H: 7.5cm KwK 40 L/48 (96mm pen), 80mm armour, 38 km/h'),
  ge_pan: kd('Panzer-Abt (Panther)', 'arm', 'track', 46, 1.2, 1.1, 124, 140, 1.9, 0, .9, { v: ['panther', 6] }, 'Panther G: 7.5cm KwK 42 L/70 (124mm pen), 80mm @55 deg glacis, 46 km/h'),
  ge_tig: kd('schwere Panzer-Kp (Tiger I)', 'arm', 'track', 38, 1.2, 1.1, 110, 100, 1.9, 0, .3, { v: ['tiger', 3] }, 'Tiger I: 8.8cm KwK 36 L/56 (110mm pen), 100mm armour, 38 km/h'),
  ge_ktig: kd('schwere Panzer-Abt (Tiger II)', 'arm', 'track', 38, 1.2, 1.1, 185, 200, 2.0, 0, .6, { v: ['ktiger', 4] }, 'Tiger II: 8.8cm KwK 43 L/71 (185mm pen), 150mm @50 deg, 38 km/h'),
  ge_stug: kd('Sturmgeschuetz-Abt', 'arm', 'track', 40, 1.0, 1.0, 96, 80, 1.5, 0, .6, { v: ['stug', 4] }, 'StuG III G: 7.5cm StuK 40 L/48 (96mm pen), 80mm armour, 40 km/h'),
  ge_jpz: kd('Panzerjaeger-Abt', 'at', 'track', 40, .5, 1.0, 110, 70, 1.6, 0, .5, { v: ['jpz4', 4] }, 'Jagdpanzer IV / Marder III / Hetzer: 7.5cm PaK 39/40 (96-124mm pen)'),
  ge_jpan: kd('s. Panzerjaeger-Abt (Jagdpanther)', 'at', 'track', 46, .6, 1.1, 185, 140, 2.0, 0, .4, { v: ['jagdpanther', 3] }, 'Jagdpanther: 8.8cm PaK 43/3 L/71 (185mm pen), 80mm @55 deg, 46 km/h'),
  ge_pak: kd('Panzerjaeger-Kp (PaK 40)', 'at', 'wheel', 40, .1, .9, 96, 0, 1.5, 0, .35, { g: ['pak40', 3], s: 6 }, '7.5cm PaK 40 towed AT gun (96mm pen @500m)'),
  ge_88: kd('Flak-Abt (8.8cm)', 'at', 'wheel', 35, .4, 1.0, 110, 0, 2.0, 0, .4, { g: ['flak88', 3], s: 6 }, '8.8cm Flak 36/37: 110mm pen @500m; dual AA/AT role', ),
  ge_art105: kd('Artillerie-Abt (10.5cm)', 'art', 'wheel', 35, 1.5, 0, 0, 0, 0, 10.7, .6, { g: ['lefh18', 4], s: 8, v: ['truck_ge', 2] }, '10.5cm leFH 18 x12, range 10.7 km'),
  ge_art150: kd('schwere Artillerie-Abt (15cm)', 'art', 'wheel', 30, 2.2, 0, 0, 0, 0, 13.3, .6, { g: ['sfh18', 4], s: 8, v: ['truck_ge', 2] }, '15cm sFH 18 x12, range 13.3 km'),
  ge_wespe: kd('Panzer-Artillerie-Abt (Wespe/Hummel)', 'art', 'track', 40, 1.9, 0, 0, 12, 0, 12, .6, { v: ['wespe', 4] }, 'Wespe 10.5cm (10.7 km) and Hummel 15cm (13.3 km) SP howitzers'),
  ge_neb: kd('Werfer-Abt (Nebelwerfer)', 'art', 'wheel', 40, 2.4, 0, 0, 0, 0, 6.9, .5, { g: ['nebel', 4], s: 8, v: ['truck_ge', 2] }, '15cm Nebelwerfer 41 x18 (six tubes each), range 6.9 km'),
  ge_pio: kd('Pionier-Btl', 'eng', 'wheel', 40, .8, .1, 96, 0, .7, 0, .6, { s: 9, v: ['truck_ge', 2] }, 'Assault engineers: flamethrowers, demolitions, bridging'),
  ge_cdo: kd('Brandenburg-Kp', 'cdo', 'foot', 5, .8, .08, 96, 0, .8, 0, .35, { s: 7 }, 'Special-purpose raiders: MP 40, MG 42, demolitions'),
  // ---- 1942 desert additions
  uk_tk_grant: kd('Armoured Regt (Grant / Stuart)', 'arm', 'track', 39, 1.3, 1.0, 60, 57, 1.5, 0, 1, { v: ['grant', 4, 'honey', 2] }, 'M3 Grant: 75mm M2 (60mm pen @500m), 51mm armour, 39 km/h; M3 Stuart "Honey" 37mm'),
  uk_tk_cru: kd('Armoured Regt (Crusader)', 'arm', 'track', 43, 1.0, .9, 53, 45, 1.1, 0, 1, { v: ['crusader', 6] }, 'Crusader II: 2-pdr (53mm pen @500m), 49mm armour, 43 km/h'),
  uk_tk_mat: kd('Army Tank Bn (Matilda / Valentine)', 'arm', 'track', 24, 1.0, .9, 53, 72, 1.1, 0, 1, { v: ['matilda', 3, 'valentine', 3] }, 'Matilda II: 2-pdr, 78mm armour, 24 km/h; Valentine II: 2-pdr, 65mm armour'),
  uk_at2: kd('Anti-Tank Bty RA (2-pdr / 6-pdr)', 'at', 'wheel', 40, .1, .8, 62, 0, 1.2, 0, .35, { g: ['pdr17', 3], s: 6 }, '2-pdr (53mm pen) portee and the first 6-pdrs (81mm pen)'),
  ge_pz42: kd('Panzer-Abt (Pz III J / Pz IV F)', 'arm', 'track', 40, 1.2, 1.0, 52, 55, 1.3, 0, 1, { v: ['pz3', 4, 'pz4', 2] }, 'Pz III J: 5cm KwK L/42 (47mm pen) and L/60 "Special" (59mm), 50mm armour; Pz IV F: 7.5cm L/24'),
  ge_pak38: kd('Panzerjaeger-Abt (5cm PaK 38 / 7.62cm)', 'at', 'wheel', 40, .1, .9, 68, 0, 1.4, 0, .5, { g: ['pak40', 3], s: 6 }, '5cm PaK 38 (59mm pen) and captured 7.62cm PaK 36(r) (98mm pen)'),
  it_inf: kd('Battaglione Fanteria', 'inf', 'foot', 4.5, .8, .08, 43, 0, .9, 0, .8, { s: 14 }, 'Carcano M91, Breda 30 and 37, 81mm mortar, 47/32 AT gun (43mm pen)'),
  it_bers: kd('Battaglione Bersaglieri (mot)', 'inf', 'wheel', 50, .95, .1, 43, 0, .9, 0, .8, { s: 12, v: ['truck_it', 3] }, 'Lorried light infantry: Breda 30/37, 81mm mortar, 47/32 AT gun'),
  it_tk: kd('Battaglione Carri (M13/40, M14/41)', 'arm', 'track', 33, .9, .8, 43, 36, 1.0, 0, .9, { v: ['m14', 6] }, 'M14/41: 47/32 gun (43mm pen @500m), 30-42mm riveted armour, 33 km/h'),
  it_semo: kd('Gruppo Semoventi (75/18)', 'arm', 'track', 32, 1.0, .9, 70, 50, 1.2, 0, .35, { v: ['semo', 3] }, 'Semovente da 75/18: 75mm howitzer with EP hollow charge (70mm pen), 50mm armour'),
  it_art75: kd('Gruppo Artiglieria (75/27)', 'art', 'wheel', 35, 1.1, 0, 0, 0, 0, 10.2, .5, { g: ['it75', 4], s: 8, v: ['truck_it', 2] }, 'Cannone da 75/27 x12, range 10.2 km'),
  it_art100: kd('Gruppo Artiglieria (100/17, 105/28)', 'art', 'wheel', 30, 1.5, 0, 0, 0, 0, 11, .5, { g: ['it100', 4], s: 8, v: ['truck_it', 2] }, 'Obice da 100/17 (9.3 km) and cannone da 105/28 (13.2 km)'),
  it_at: kd('Compagnia Controcarro (47/32)', 'at', 'wheel', 40, .1, .7, 43, 0, .9, 0, .3, { g: ['it47', 3], s: 6 }, 'Cannone da 47/32 (43mm pen @500m)'),
  it_rec: kd('Gruppo Esplorante (AB41)', 'rec', 'wheel', 78, .6, .25, 30, 9, .8, 0, .5, { v: ['ab41', 4] }, 'Autoblinda AB41: 20mm Breda, 78 km/h'),
  it_eng: kd('Battaglione Genio', 'eng', 'wheel', 40, .6, .05, 43, 0, .7, 0, .5, { s: 8, v: ['truck_it', 2] }, 'Engineers: mine clearing, demolitions'),
  hq_it: kd('Comando e servizi', 'hq', 'wheel', 40, .15, 0, 0, 0, .5, 0, .5, { s: 4, v: ['truck_it', 2, 'car_it', 1] }, 'Divisional command, signals, supply column'),
  // ---- shared
  nav6: kd('Naval gunfire (cruisers)', 'art', 'ship', 0, 3.0, 0, 0, 0, 0, 23, 2, { ship: 1 }, '6-inch cruiser batteries, range 23 km'),
  nav15: kd('Naval gunfire (battleships)', 'art', 'ship', 0, 4.5, 0, 0, 0, 0, 30, 3, { ship: 2 }, '15-inch battleship batteries, range 30 km'),
  hq_us: kd('HQ & trains', 'hq', 'wheel', 40, .15, 0, 0, 0, .5, 0, .5, { s: 4, v: ['truck_us', 2, 'jeep', 1] }, 'Command post, signals, supply trains'),
  hq_uk: kd('HQ & echelon', 'hq', 'wheel', 40, .15, 0, 0, 0, .5, 0, .5, { s: 4, v: ['truck_uk', 2, 'jeep', 1] }, 'Tactical HQ, signals, B echelon'),
  hq_ge: kd('Stab & Tross', 'hq', 'wheel', 40, .15, 0, 0, 0, .5, 0, .5, { s: 4, v: ['truck_ge', 2, 'kubel', 1] }, 'Gefechtsstand, Nachrichten, Tross'),
  hq_us_abn: kd('Airborne command post', 'hq', 'foot', 4.5, .15, 0, 0, 0, .5, 0, .4, { s: 6 }, 'Regimental command group and signals, on foot'),
  hq_uk_abn: kd('Airborne brigade HQ', 'hq', 'foot', 4.5, .15, 0, 0, 0, .5, 0, .4, { s: 6 }, 'Brigade headquarters and signals, on foot'),
  hq_ge_abn: kd('Fallschirm-Gefechtsstand', 'hq', 'foot', 4.5, .15, 0, 0, 0, .5, 0, .4, { s: 6 }, 'Regimental command group, on foot'),
};
// units with two main guns: guns = [[share of the unit's guns, penetration mm @500 m], ...]; each fires at its own chance against armour
KIND.uk_tk_sher.guns = [[.75, 68], [.25, 140]];   // one Firefly (17-pdr) per troop of four, Normandy 1944
KIND.us_tk_m4b.guns = [[.7, 68], [.3, 98]];      // about 30% of 12th Army Group Shermans carried the 76mm by December 1944
KIND.uk_at.guns = [[.33, 81], [.67, 140]];        // infantry division battery 1944: two troops of 17-pdrs, one of 6-pdrs
KIND.uk_tk_val.guns = [[.67, 53], [.33, 81]];     // Valentine 2-pdr x4, Crusader III 6-pdr x2 (as modelled)
KIND.ge_pz4e.guns = [[.5, 91], [.5, 59]];         // Pz IV F2/G x3, Pz III L x3 (as modelled)
// side armour, effective mm (frontal 'arm' is effective too, slope included). A shot from outside the front arc meets this plate.
{ const SIDE = { us_tk_m4: 38, us_tk_m4b: 38, uk_tk_sher: 38, uk_tk_sher3: 38, us_tk_m3: 38, uk_tk_grant: 38, us_td_m10: 25, us_td_m18: 13, us_rec: 10, uk_tk_crom: 32, uk_tk_val: 50, uk_tk_cru: 28, uk_tk_mat: 65,
    ge_pz3: 30, ge_pz4e: 30, ge_pz4: 30, ge_pz42: 30, ge_pan: 45, ge_tig: 80, ge_ktig: 85, ge_stug: 30, ge_jpz: 30, ge_jpan: 55, it_tk: 25, it_semo: 25 };
  for (const k in SIDE) KIND[k].side = SIDE[k]; }
// anti-aircraft units: r = umbrella radius (km); lo = effect on low-flying fighter-bombers, recce and transports; hi = effect on medium and heavy bombers
Object.assign(KIND, {
  ge_flak20: kd('le. Flak-Abt (2cm / 3.7cm)', 'at', 'wheel', 45, .7, .3, 35, 0, 1.2, 0, .4, { g: ['flak88', 3], s: 6 }, '2cm Flak 38 Flakvierling and 3.7cm Flak 36/43: rapid fire against low aircraft and soft targets'),
  us_aaaw: kd('AAA AW Bn (M16 / 40mm Bofors)', 'at', 'track', 60, .8, .2, 30, 6, 1.0, 0, .5, { v: ['m3gmc', 4] }, 'M16 quad .50 half-tracks and towed 40mm Bofors'),
  uk_laa: kd('LAA Regt RA (40mm Bofors)', 'at', 'wheel', 40, .5, .2, 40, 0, 1.2, 0, .45, { g: ['pdr17', 3], s: 6 }, '40mm Bofors L/60 towed light AA guns'),
  us_aa90: kd('AAA Gun Bn (90mm)', 'at', 'wheel', 35, .4, 1.0, 120, 0, 2.0, 0, .45, { g: ['flak88', 3], s: 6 }, '90mm M1A1 AA guns: heavy AA with a strong anti-tank capability'),
});
KIND.ge_88.aa = { r: 5, lo: .35, hi: 1 }; KIND.ge_flak20.aa = { r: 2, lo: 1, hi: .3 }; KIND.us_aaaw.aa = { r: 2, lo: 1, hi: .3 }; KIND.uk_laa.aa = { r: 2.2, lo: 1, hi: .35 }; KIND.us_aa90.aa = { r: 5, lo: .35, hi: 1 };
for (const k in KIND) KIND[k].key = k;

// Aircraft: name, role (F fighter, FB fighter-bomber, B medium bomber, HB heavy), max speed mph, bomb load lb, air-combat rating, visual model
const AC = {
  p40: ['P-40F Warhawk', 'FB', 364, 1000, .9, 'p40'], p39: ['P-39 Airacobra', 'FB', 376, 500, .8, 'p39'],
  a20: ['A-20 Havoc', 'B', 339, 2000, .3, 'a20'], spit: ['Spitfire Vc', 'F', 371, 500, 1.1, 'spit'],
  spit9: ['Spitfire IX', 'F', 408, 1000, 1.25, 'spit'], hurri: ['Hurricane IIC', 'FB', 336, 1000, .8, 'hurri'],
  seafire: ['Seafire IIc', 'F', 342, 500, .95, 'spit'], a36: ['A-36A Apache', 'FB', 365, 1000, .9, 'p51'],
  p38: ['P-38G Lightning', 'F', 400, 2000, 1.05, 'p38'], b25: ['B-25 Mitchell', 'B', 284, 3000, .3, 'b25'],
  b26: ['B-26 Marauder', 'B', 282, 4000, .3, 'b26'], b17: ['B-17F Fortress', 'HB', 295, 6000, .4, 'b17'],
  p47: ['P-47D Thunderbolt', 'FB', 426, 2500, 1.15, 'p47'], p51: ['P-51D Mustang', 'F', 437, 1000, 1.3, 'p51'],
  typhoon: ['Typhoon IB (RP-3)', 'FB', 412, 2000, 1.0, 'typhoon'], c47: ['C-47 Skytrain', 'T', 224, 0, 0, 'c47'],
  bf109f: ['Bf 109F-4', 'F', 388, 550, 1.3, 'bf109'], kitty: ['Kittyhawk I', 'FB', 354, 1000, .9, 'kitty'], boston: ['Boston III', 'B', 338, 2000, .3, 'boston'], mc202: ['Macchi C.202 Folgore', 'F', 372, 0, 1.1, 'mc202'], cr42: ['Fiat CR.42 (assalto)', 'FB', 267, 440, .5, 'cr42'],
  bf109: ['Bf 109G-6', 'F', 386, 550, 1.15, 'bf109'], fw190: ['Fw 190A/F', 'FB', 408, 1100, 1.2, 'fw190'],
  ju87: ['Ju 87D Stuka', 'FB', 255, 3900, .4, 'ju87'], ju88: ['Ju 88A-4', 'B', 292, 4400, .4, 'ju88'],
};
const CMD_NAMES = {
  US: ['Col. Harlan Pruitt', 'Col. Walter Dennison', 'Lt. Col. Frank Mabry', 'Col. Edwin Stokes', 'Lt. Col. Ray Calloway', 'Col. Thomas Burdett', 'Col. Homer Vance', 'Lt. Col. James Tolliver'],
  UK: ['Brig. Alan Hartley-Gore', 'Lt. Col. Nigel Ashcombe', 'Brig. Rupert Fenwick', 'Lt. Col. Hugh Maitland', 'Brig. Colin Trevanion', 'Lt. Col. Peter Wyndham', 'Brig. Derek Strachan'],
  GE: ['Oberst Karl Reinecke', 'Oberstlt. Hans Albrecht', 'Oberst Wilhelm Kessler', 'Major Ernst Hollmann', 'Oberst Friedrich Lange', 'Oberstlt. Otto Brandner', 'Major Dieter Vogt'],
};
CMD_NAMES.IT = ['Gen. Carlo Bertolini', 'Col. Vittorio Sanna', 'Gen. Ettore Marchesi', 'Col. Aldo Ferrante', 'Gen. Luigi Corradini', 'Col. Paolo Rinaldi'];
const SCENARIOS = [];
