// ===== DIVISION TEMPLATES: divisions as regiments, brigades or combat commands of battalions =====
// Structures follow the standard 1944 organizations in outline. Exact battalion counts, attachments and equipment for each
// historical division come from the order-of-battle data in step 4, with sources; these templates are the starting shape.
// {a}, {b}, {c} are replaced by the regiment or brigade designations given for each division.
const DIVTPL = {
  us_inf: { nat: 'US', regs: [
    { n: '{a} Infantry', role: 'man', sub: ['us_inf|1/{a} Infantry', 'us_inf|2/{a} Infantry', 'us_inf|3/{a} Infantry'] },
    { n: '{b} Infantry', role: 'man', sub: ['us_inf|1/{b} Infantry', 'us_inf|2/{b} Infantry', 'us_inf|3/{b} Infantry'] },
    { n: '{c} Infantry', role: 'man', sub: ['us_inf|1/{c} Infantry', 'us_inf|2/{c} Infantry', 'us_inf|3/{c} Infantry'] },
    { n: 'Division Artillery', role: 'arty', sub: ['us_fa105|105mm FA Bn', 'us_fa105|105mm FA Bn', 'us_fa105|105mm FA Bn', 'us_fa155|155mm FA Bn'] },
    { n: 'Division troops', role: 'troops', sub: ['us_eng|Engineer Combat Bn', 'us_rec|Cavalry Recon Troop|.35'] }],
    attach: ['us_tk_m4|Tank Bn (attached)', 'us_td_m10|Tank Destroyer Bn (attached)', 'us_aaaw|AAA AW Bn (attached)'] },
  us_arm: { nat: 'US', regs: [
    { n: 'CCA', role: 'man', sub: ['us_tk_m4|Tank Bn (CCA)', 'us_arminf|Armored Infantry Bn (CCA)'] },
    { n: 'CCB', role: 'man', sub: ['us_tk_m4|Tank Bn (CCB)', 'us_arminf|Armored Infantry Bn (CCB)'] },
    { n: 'CCR', role: 'man', sub: ['us_tk_m4|Tank Bn (CCR)', 'us_arminf|Armored Infantry Bn (CCR)'] },
    { n: 'Division Artillery', role: 'arty', sub: ['us_afa|Armored FA Bn', 'us_afa|Armored FA Bn', 'us_afa|Armored FA Bn'] },
    { n: 'Division troops', role: 'troops', sub: ['us_eng|Armored Engineer Bn', 'us_rec|Cavalry Recon Sqn'] }],
    attach: ['us_td_m18|Tank Destroyer Bn (attached)', 'us_aaaw|AAA AW Bn (attached)'] },
  us_abn: { nat: 'US', regs: [
    { n: '{a} Parachute Infantry', role: 'man', sub: ['us_para|1/{a} PIR', 'us_para|2/{a} PIR', 'us_para|3/{a} PIR'] },
    { n: '{b} Parachute Infantry', role: 'man', sub: ['us_para|1/{b} PIR', 'us_para|2/{b} PIR', 'us_para|3/{b} PIR'] },
    { n: '{c} Glider Infantry', role: 'man', sub: ['us_glider|1/{c} GIR', 'us_glider|2/{c} GIR'] },
    { n: 'Division Artillery', role: 'arty', sub: ['us_pfa|Parachute FA Bn', 'us_pfa|Parachute FA Bn', 'us_gfa105|Glider FA Bn'] },
    { n: 'Division troops', role: 'troops', sub: ['us_eng|Airborne Engineer Bn|.7'] }], attach: [] },
  uk_inf: { nat: 'UK', regs: [
    { n: '{a} Infantry Brigade', role: 'man', sub: ['uk_inf|Bn ({a} Bde)', 'uk_inf|Bn ({a} Bde)', 'uk_inf|Bn ({a} Bde)'] },
    { n: '{b} Infantry Brigade', role: 'man', sub: ['uk_inf|Bn ({b} Bde)', 'uk_inf|Bn ({b} Bde)', 'uk_inf|Bn ({b} Bde)'] },
    { n: '{c} Infantry Brigade', role: 'man', sub: ['uk_inf|Bn ({c} Bde)', 'uk_inf|Bn ({c} Bde)', 'uk_inf|Bn ({c} Bde)'] },
    { n: 'Royal Artillery', role: 'arty', sub: ['uk_fd25|Field Regt RA', 'uk_fd25|Field Regt RA', 'uk_fd25|Field Regt RA'] },
    { n: 'Division troops', role: 'troops', sub: ['uk_at|Anti-Tank Regt RA', 'uk_rec|Reconnaissance Regt', 'uk_re|Field Coys RE'] }],
    attach: ['uk_tk_sher|Armoured Regt (attached)'] },
  uk_arm: { nat: 'UK', regs: [
    { n: '{a} Armoured Brigade', role: 'man', sub: ['uk_tk_sher|Armoured Regt ({a} Armd Bde)', 'uk_tk_sher|Armoured Regt ({a} Armd Bde)', 'uk_tk_sher|Armoured Regt ({a} Armd Bde)', 'uk_mot|Motor Bn ({a} Armd Bde)'] },
    { n: '{b} Infantry Brigade', role: 'man', sub: ['uk_inf|Bn ({b} Bde)', 'uk_inf|Bn ({b} Bde)', 'uk_inf|Bn ({b} Bde)'] },
    { n: 'Royal Artillery', role: 'arty', sub: ['uk_sexton|Field Regt RA (SP)', 'uk_fd25|Field Regt RA'] },
    { n: 'Division troops', role: 'troops', sub: ['uk_tk_crom|Armoured Recce Regt', 'uk_at|Anti-Tank Regt RA', 'uk_re|Field Sqns RE'] }], attach: [] },
  ge_inf: { nat: 'GE', regs: [
    { n: 'Grenadier-Regiment {a}', role: 'man', sub: ['ge_inf|I./GR {a}', 'ge_inf|II./GR {a}'] },
    { n: 'Grenadier-Regiment {b}', role: 'man', sub: ['ge_inf|I./GR {b}', 'ge_inf|II./GR {b}'] },
    { n: 'Grenadier-Regiment {c}', role: 'man', sub: ['ge_inf|I./GR {c}', 'ge_inf|II./GR {c}'] },
    { n: 'Artillerie-Regiment', role: 'arty', sub: ['ge_art105|I./AR', 'ge_art105|II./AR', 'ge_art105|III./AR', 'ge_art150|IV./AR'] },
    { n: 'Divisionstruppen', role: 'troops', sub: ['ge_inf|Fuesilier-Btl|.8', 'ge_jpz|Panzerjaeger-Abt', 'ge_pio|Pionier-Btl'] }], attach: [] },
  ge_pz: { nat: 'GE', regs: [
    { n: 'Panzer-Regiment {a}', role: 'man', sub: ['ge_pan|I./PzR {a} (Panther)', 'ge_pz4|II./PzR {a} (Pz IV)'] },
    { n: 'Panzergrenadier-Regiment {b}', role: 'man', sub: ['ge_pzgr_spw|I./PzGrR {b} (gep)', 'ge_pzgr|II./PzGrR {b}'] },
    { n: 'Panzergrenadier-Regiment {c}', role: 'man', sub: ['ge_pzgr|I./PzGrR {c}', 'ge_pzgr|II./PzGrR {c}'] },
    { n: 'Panzer-Artillerie-Regiment', role: 'arty', sub: ['ge_wespe|I./PzAR (Wespe/Hummel)', 'ge_art105|II./PzAR', 'ge_art150|III./PzAR'] },
    { n: 'Divisionstruppen', role: 'troops', sub: ['ge_krad|Panzer-Aufklaerungs-Abt', 'ge_jpz|Panzerjaeger-Abt', 'ge_pio|Panzer-Pionier-Btl', 'ge_flak20|Heeres-Flak-Abt'] }], attach: [] },
  ge_fj: { nat: 'GE', regs: [
    { n: 'Fallschirmjaeger-Regiment {a}', role: 'man', sub: ['ge_fj|I./FJR {a}', 'ge_fj|II./FJR {a}', 'ge_fj|III./FJR {a}'] },
    { n: 'Fallschirmjaeger-Regiment {b}', role: 'man', sub: ['ge_fj|I./FJR {b}', 'ge_fj|II./FJR {b}', 'ge_fj|III./FJR {b}'] },
    { n: 'Fallschirmjaeger-Regiment {c}', role: 'man', sub: ['ge_fj|I./FJR {c}', 'ge_fj|II./FJR {c}', 'ge_fj|III./FJR {c}'] },
    { n: 'Fallschirm-Artillerie-Regiment', role: 'arty', sub: ['ge_art105|I./FAR', 'ge_art105|II./FAR'] },
    { n: 'Divisionstruppen', role: 'troops', sub: ['ge_pak|Fallschirm-Panzerjaeger-Abt', 'ge_pio|Fallschirm-Pionier-Btl'] }], attach: [] },
  // ----- Sarn Corridor powers, 1939-40 equipment. Until each power has its own equipment and models, the battalions borrow existing
  // kinds: Valdenmark German early-war types, Sarn Italian types, Korovia British early-war types (game design, stand-ins).
  vd_inf: { nat: 'GE', regs: [
    { n: '{a} Rifle Regiment', role: 'man', sub: ['ge_inf|I/{a} Rifles', 'ge_inf|II/{a} Rifles', 'ge_inf|III/{a} Rifles'] },
    { n: '{b} Rifle Regiment', role: 'man', sub: ['ge_inf|I/{b} Rifles', 'ge_inf|II/{b} Rifles', 'ge_inf|III/{b} Rifles'] },
    { n: '{c} Rifle Regiment', role: 'man', sub: ['ge_inf|I/{c} Rifles', 'ge_inf|II/{c} Rifles', 'ge_inf|III/{c} Rifles'] },
    { n: 'Artillery Regiment', role: 'arty', sub: ['ge_art105|I/Artillery', 'ge_art105|II/Artillery', 'ge_art105|III/Artillery', 'ge_art150|IV/Artillery (heavy)'] },
    { n: 'Division troops', role: 'troops', sub: ['ge_krad|Reconnaissance Bn|.6', 'ge_pak38|Anti-tank Bn', 'ge_pio|Engineer Bn'] }], attach: [] },
  vd_pz: { nat: 'GE', regs: [
    { n: '{a} Panzer Regiment', role: 'man', sub: ['ge_pz42|I/{a} Panzer', 'ge_pz42|II/{a} Panzer'] },
    { n: '{b} Panzer Regiment', role: 'man', sub: ['ge_pz42|I/{b} Panzer', 'ge_pz3|II/{b} Panzer'] },
    { n: '{c} Motor Rifle Regiment', role: 'man', sub: ['ge_pzgr|I/{c} Motor Rifles', 'ge_pzgr|II/{c} Motor Rifles', 'ge_pzgr|III/{c} Motor Rifles'] },
    { n: 'Panzer Artillery Regiment', role: 'arty', sub: ['ge_art105|I/Panzer Artillery', 'ge_art105|II/Panzer Artillery', 'ge_art150|III/Panzer Artillery'] },
    { n: 'Division troops', role: 'troops', sub: ['ge_krad|Panzer Reconnaissance Bn', 'ge_pak38|Anti-tank Bn', 'ge_pio|Panzer Engineer Bn', 'ge_flak20|Light Flak Bn'] }], attach: [] },
  vd_mot: { nat: 'GE', regs: [
    { n: '{a} Motor Rifle Regiment', role: 'man', sub: ['ge_pzgr|I/{a} Motor Rifles', 'ge_pzgr|II/{a} Motor Rifles', 'ge_pzgr|III/{a} Motor Rifles'] },
    { n: '{b} Motor Rifle Regiment', role: 'man', sub: ['ge_pzgr|I/{b} Motor Rifles', 'ge_pzgr|II/{b} Motor Rifles', 'ge_pzgr|III/{b} Motor Rifles'] },
    { n: 'Motorized Artillery Regiment', role: 'arty', sub: ['ge_art105|I/Motorized Artillery', 'ge_art105|II/Motorized Artillery', 'ge_art150|III/Motorized Artillery'] },
    { n: 'Division troops', role: 'troops', sub: ['ge_krad|Motorized Reconnaissance Bn', 'ge_pak38|Anti-tank Bn', 'ge_pio|Motorized Engineer Bn'] }], attach: [] },
  sa_inf: { nat: 'IT', regs: [
    { n: '{a} Infantry Regiment', role: 'man', sub: ['it_inf|I/{a} Infantry', 'it_inf|II/{a} Infantry', 'it_inf|III/{a} Infantry'] },
    { n: '{b} Infantry Regiment', role: 'man', sub: ['it_inf|I/{b} Infantry', 'it_inf|II/{b} Infantry', 'it_inf|III/{b} Infantry'] },
    { n: '{c} Frontier Regiment', role: 'man', sub: ['it_bers|I/{c} Frontier', 'it_bers|II/{c} Frontier'] },
    { n: 'Artillery Regiment', role: 'arty', sub: ['it_art75|I/Artillery', 'it_art75|II/Artillery', 'it_art100|III/Artillery'] },
    { n: 'Division troops', role: 'troops', sub: ['it_at|Anti-tank Coy', 'it_eng|Engineer Bn', 'it_rec|Cavalry Squadron|.6'] }], attach: [] },
  sa_mot: { nat: 'IT', regs: [
    { n: '{a} Armoured Regiment', role: 'man', sub: ['it_tk|I/{a} Armour', 'it_tk|II/{a} Armour'] },
    { n: '{b} Motor Rifle Regiment', role: 'man', sub: ['it_bers|I/{b} Motor Rifles', 'it_bers|II/{b} Motor Rifles', 'it_bers|III/{b} Motor Rifles'] },
    { n: 'Artillery Regiment', role: 'arty', sub: ['it_art75|I/Artillery', 'it_semo|II/Assault Guns'] },
    { n: 'Division troops', role: 'troops', sub: ['it_rec|Armoured Car Squadron', 'it_at|Anti-tank Coy', 'it_eng|Engineer Bn'] }], attach: [] },
  ko_inf: { nat: 'UK', regs: [
    { n: '{a} Rifle Brigade', role: 'man', sub: ['uk_inf|1st Bn ({a} Bde)', 'uk_inf|2nd Bn ({a} Bde)', 'uk_inf|3rd Bn ({a} Bde)'] },
    { n: '{b} Rifle Brigade', role: 'man', sub: ['uk_inf|1st Bn ({b} Bde)', 'uk_inf|2nd Bn ({b} Bde)', 'uk_inf|3rd Bn ({b} Bde)'] },
    { n: '{c} Rifle Brigade', role: 'man', sub: ['uk_inf|1st Bn ({c} Bde)', 'uk_inf|2nd Bn ({c} Bde)', 'uk_inf|3rd Bn ({c} Bde)'] },
    { n: 'Artillery', role: 'arty', sub: ['uk_fd25|1st Field Regt', 'uk_fd25|2nd Field Regt', 'uk_fd25|3rd Field Regt', 'uk_med55|Medium Regt'] },
    { n: 'Division troops', role: 'troops', sub: ['uk_at2|Anti-tank Bn', 'uk_re|Engineer Bn', 'uk_rec|Reconnaissance Bn|.6'] }], attach: [] },
  ko_tk: { nat: 'UK', regs: [
    { n: '{a} Tank Brigade', role: 'man', sub: ['uk_tk_mat|1st Tank Bn ({a} Bde)', 'uk_tk_mat|2nd Tank Bn ({a} Bde)', 'uk_mot|Motor Rifle Bn ({a} Bde)'] },
    { n: '{b} Tank Brigade', role: 'man', sub: ['uk_tk_val|1st Tank Bn ({b} Bde)', 'uk_tk_val|2nd Tank Bn ({b} Bde)', 'uk_mot|Motor Rifle Bn ({b} Bde)'] },
    { n: '{c} Motor Rifle Brigade', role: 'man', sub: ['uk_mot|1st Bn ({c} Bde)', 'uk_mot|2nd Bn ({c} Bde)', 'uk_mot|3rd Bn ({c} Bde)'] },
    { n: 'Artillery', role: 'arty', sub: ['uk_fd25|1st Field Regt', 'uk_fd25|2nd Field Regt'] },
    { n: 'Division troops', role: 'troops', sub: ['uk_rec|Reconnaissance Bn', 'uk_at2|Anti-tank Bn', 'uk_re|Engineer Bn'] }], attach: [] }
};
// ----- regiment-level versions (test of 24 Nov 2026): each regiment or brigade is one unit of N battalions ('kind|name|N|N'),
// the artillery regiment one unit of N battalions' guns, division troops unchanged. Kinds as in the battalion templates.
(function () {
  const R = (k, n, b) => k + '|' + n + '|' + b + '|' + b;
  Object.assign(DIVTPL, {
    vd_inf_r: { nat: 'GE', regs: [
      { n: '{a} Rifle Regiment', role: 'man', sub: [R('ge_inf', '{a} Rifle Regiment', 3)] },
      { n: '{b} Rifle Regiment', role: 'man', sub: [R('ge_inf', '{b} Rifle Regiment', 3)] },
      { n: '{c} Rifle Regiment', role: 'man', sub: [R('ge_inf', '{c} Rifle Regiment', 3)] },
      { n: 'Artillery Regiment', role: 'arty', sub: [R('ge_art105', 'Artillery Regiment', 4)] },
      DIVTPL.vd_inf.regs[4]], attach: [] },
    vd_pz_r: { nat: 'GE', regs: [
      { n: '{a} Panzer Regiment', role: 'man', sub: [R('ge_pz42', '{a} Panzer Regiment', 2)] },
      { n: '{b} Panzer Regiment', role: 'man', sub: [R('ge_pz3', '{b} Panzer Regiment', 2)] },
      { n: '{c} Motor Rifle Regiment', role: 'man', sub: [R('ge_pzgr', '{c} Motor Rifle Regiment', 3)] },
      { n: 'Panzer Artillery Regiment', role: 'arty', sub: [R('ge_art105', 'Panzer Artillery Regiment', 3)] },
      DIVTPL.vd_pz.regs[4]], attach: [] },
    vd_mot_r: { nat: 'GE', regs: [
      { n: '{a} Motor Rifle Regiment', role: 'man', sub: [R('ge_pzgr', '{a} Motor Rifle Regiment', 3)] },
      { n: '{b} Motor Rifle Regiment', role: 'man', sub: [R('ge_pzgr', '{b} Motor Rifle Regiment', 3)] },
      { n: 'Motorized Artillery Regiment', role: 'arty', sub: [R('ge_art105', 'Motorized Artillery Regiment', 3)] },
      DIVTPL.vd_mot.regs[3]], attach: [] },
    sa_inf_r: { nat: 'IT', regs: [
      { n: '{a} Infantry Regiment', role: 'man', sub: [R('it_inf', '{a} Infantry Regiment', 3)] },
      { n: '{b} Infantry Regiment', role: 'man', sub: [R('it_inf', '{b} Infantry Regiment', 3)] },
      { n: '{c} Frontier Regiment', role: 'man', sub: [R('it_bers', '{c} Frontier Regiment', 2)] },
      { n: 'Artillery Regiment', role: 'arty', sub: [R('it_art75', 'Artillery Regiment', 3)] },
      DIVTPL.sa_inf.regs[4]], attach: [] },
    sa_mot_r: { nat: 'IT', regs: [
      { n: '{a} Armoured Regiment', role: 'man', sub: [R('it_tk', '{a} Armoured Regiment', 2)] },
      { n: '{b} Motor Rifle Regiment', role: 'man', sub: [R('it_bers', '{b} Motor Rifle Regiment', 3)] },
      { n: 'Artillery Regiment', role: 'arty', sub: [R('it_art75', 'Artillery Regiment', 2)] },
      DIVTPL.sa_mot.regs[3]], attach: [] },
    ko_inf_r: { nat: 'UK', regs: [
      { n: '{a} Rifle Brigade', role: 'man', sub: [R('uk_inf', '{a} Rifle Brigade', 3)] },
      { n: '{b} Rifle Brigade', role: 'man', sub: [R('uk_inf', '{b} Rifle Brigade', 3)] },
      { n: '{c} Rifle Brigade', role: 'man', sub: [R('uk_inf', '{c} Rifle Brigade', 3)] },
      { n: 'Artillery', role: 'arty', sub: [R('uk_fd25', 'Division Artillery', 4)] },
      DIVTPL.ko_inf.regs[4]], attach: [] },
    ko_tk_r: { nat: 'UK', regs: [
      { n: '{a} Tank Brigade', role: 'man', sub: [R('uk_tk_mat', '{a} Tank Brigade', 2)] },
      { n: '{b} Tank Brigade', role: 'man', sub: [R('uk_tk_val', '{b} Tank Brigade', 2)] },
      { n: '{c} Motor Rifle Brigade', role: 'man', sub: [R('uk_mot', '{c} Motor Rifle Brigade', 5)] },   // the tank brigades' motor battalions folded in, so the division keeps 4 tank and 5 motor battalions
      { n: 'Artillery', role: 'arty', sub: [R('uk_fd25', 'Division Artillery', 2)] },
      DIVTPL.ko_tk.regs[4]], attach: [] }
  });
})();
// build a scenario formation from a template: o = { tpl, s, n, cmd, ag, sk, xp, x, y, regs: ['8th', '12th', '22nd'], attach: [...] }
function divForm(o) {
  const T = DIVTPL[o.tpl]; if (!T) throw new Error('unknown division template ' + o.tpl);
  const names = o.regs || [], fill = t => t.replace('{a}', names[0] || 'A').replace('{b}', names[1] || 'B').replace('{c}', names[2] || 'C');
  const sub = [], regs = [];
  for (const R of T.regs) { const idx = []; for (const sp of R.sub) { idx.push(sub.length); sub.push(fill(sp)); } regs.push({ n: fill(R.n), role: R.role, idx }); }
  const att = o.attach || T.attach || []; if (att.length) { const idx = []; for (const sp of att) { idx.push(sub.length); sub.push(fill(sp)); } regs.push({ n: 'Attached', role: 'troops', idx }); }
  const f = Object.assign({ nat: T.nat, ag: .5, sk: .6, xp: 1 }, o, { sub, regs }); delete f.tpl; delete f.attach; return f;
}
// where each regiment, brigade or combat command stands: the centre of its living battalions, for the map's middle zoom
function regCentres(F) {
  return (F.regs || []).map(R => { const us = R.subs.filter(u => u.active && !u.dead); if (!us.length) return null;
    return { n: R.n, role: R.role, reserve: F.resReg === R, x: us.reduce((s, u) => s + u.x, 0) / us.length, y: us.reduce((s, u) => s + u.y, 0) / us.length, str: us.reduce((s, u) => s + u.str * u.size, 0) / us.reduce((s, u) => s + u.size, 0) }; }).filter(Boolean);
}
