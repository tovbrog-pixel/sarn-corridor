// ===== POLITICS: Eisenhower's standing with the four Allied capitals =====
// Design document, "Political score": standing with Washington, London, Paris and Moscow, each 0 to 100. The composite weights
// Washington 40%, London 30%, Paris 15%, Moscow 15%. At each phase review a composite under 40, or any capital under 20, brings a
// warning; still under 40 at the next review, or under 25 at any time, brings relief. Every change is logged with its cause.
// All starting values, rates and thresholds below are game settings for balance testing.
const POL = {
  start: { Washington: 60, London: 60, Paris: 50, Moscow: 60 }, weights: { Washington: .4, London: .3, Paris: .15, Moscow: .15 },
  warn: 40, warnOne: 20, relieve: 25,
  weekGainPts: 15, gainPerDay: .6,              // a week with 15 or more objective points taken by a nation's troops raises its capital
  weekLossBn: 12, weekPoorPts: 10, lossPerDay: .8,   // a week costing over 12 battalion-equivalents for under 10 points lowers it
  events: [   // objectives whose capture moves a capital, once
    { vp: 'Cherbourg', aud: { Washington: 6 }, why: 'Cherbourg taken: the first major port' },
    { vp: 'Caen', aud: { London: 8 }, why: 'Caen taken at last' },
    { vp: 'Paris', aud: { Paris: 25, Washington: 4, London: 3 }, why: 'Paris liberated', french: { Paris: 10, why: 'French troops first into Paris' } },
    { vp: 'Brest', aud: { Washington: 3 }, why: 'Brest taken' }],
  bypass: { vp: 'Paris', ring: ['Chartres', 'Orléans', 'Rouen', 'Versailles'], perDay: 1, why: 'Paris left in German hands while the armies pass it by' }
};
function attachPolitics(S) {
  const sc = S.sc, P = sc.politics; if (!P) return S;
  const st = { aud: Object.assign({}, POL.start, P.start || {}), log: [], warned: false, relieved: false, done: {}, prevStr: new Map(), week: [], lastDay: -1, reviews: (P.reviews || []).slice().sort((a, b) => a - b), ri: 0 };
  S.pol = st;
  const clamp100 = v => Math.max(0, Math.min(100, v));
  S.polComposite = () => Object.keys(POL.weights).reduce((a, k) => a + POL.weights[k] * st.aud[k], 0);
  function move(k, d, why) { if (!d) return; const was = st.aud[k]; st.aud[k] = clamp100(was + d); st.log.push({ t: S.t, k, d: st.aud[k] - was, why }); if (Math.abs(d) >= 2) S.say(0, 'Standing in ' + k + (d > 0 ? ' rises' : ' falls') + ' (' + (d > 0 ? '+' : '') + Math.round(d) + '): ' + why + '.', Math.abs(d) >= 5 ? 1 : 0); }
  const natOf = F => F.nat === 'US' ? 'US' : 'UK';   // British, Canadian and Polish troops answer to London; American and French equipment to Washington
  const capital = n => n === 'US' ? 'Washington' : 'London';
  const vpOwn = new Map(S.vp.map(v => [v, v.own])); st.taker = new Map();
  function nearestAllied(v) { let b = null, bd = 1e9; for (const F of S.forms) if (F.s === 0 && F.active && !F.dead) { const d = Math.hypot(F.cx - v.x, F.cy - v.y); if (d < bd) { bd = d; b = F; } } return b; }
  function dayTick() {
    const today = { loss: { US: 0, UK: 0 }, pts: { US: 0, UK: 0 } };
    for (const u of S.subs) { if (u.s !== 0 || !u.active) continue; const now = u.dead ? 0 : u.str * u.size, was = st.prevStr.has(u) ? st.prevStr.get(u) : now; if (was > now) today.loss[natOf(u.f)] += was - now; st.prevStr.set(u, now); }
    for (const v of S.vp) { const was = vpOwn.get(v); if (was !== v.own) { vpOwn.set(v, v.own); if (v.own === 0) { const F = nearestAllied(v); if (F) today.pts[natOf(F)] += v.pts; st.taker.set(v, F); } continue; }
      // a capital's event fires once the objective has stayed in Allied hands from one day to the next
      if (v.own !== 0) continue; const E = POL.events.find(e => v.n === e.vp || v.n.startsWith(e.vp + ' ')); if (!E || st.done[E.vp]) continue; st.done[E.vp] = 1; const F = st.taker.get(v);
      for (const k in E.aud) move(k, E.aud[k], E.why); if (E.french && F && /2e|Blind|French/.test(F.n)) for (const k in E.french) if (k !== 'why') move(k, E.french[k], E.french.why); }
    st.week.push(today); if (st.week.length > 7) st.week.shift();
    for (const n of ['US', 'UK']) { const L = st.week.reduce((a, d) => a + d.loss[n], 0), G = st.week.reduce((a, d) => a + d.pts[n], 0);
      if (G >= POL.weekGainPts) move(capital(n), POL.gainPerDay, 'steady advance by ' + (n === 'US' ? 'American' : 'British and Canadian') + ' troops');
      else if (L > POL.weekLossBn && G < POL.weekPoorPts) move(capital(n), -POL.lossPerDay, 'heavy ' + (n === 'US' ? 'American' : 'British and Canadian') + ' losses for little ground'); }
    const B = POL.bypass, pv = S.vp.find(v => v.n === B.vp); if (pv && pv.own === 1 && B.ring.some(n => { const v = S.vp.find(q => q.n === n); return v && v.own === 0; })) move('Paris', -B.perDay, B.why);
  }
  function review() {
    const c = S.polComposite(), low = Object.keys(st.aud).filter(k => st.aud[k] < POL.warnOne);
    if (c < POL.warn || low.length) { if (st.warned) return relieve('still under ' + POL.warn + ' at the second review'); st.warned = true; S.say(0, 'Phase review: the Combined Chiefs warn General Eisenhower. Standing ' + Math.round(c) + (low.length ? '; ' + low.join(' and ') + ' below ' + POL.warnOne : '') + '.', 2); }
    else { st.warned = false; S.say(0, 'Phase review: the Combined Chiefs are satisfied. Standing ' + Math.round(c) + '.', 1); }
  }
  function relieve(why) { if (st.relieved) return; st.relieved = true; S.say(0, 'General Eisenhower is relieved of command (' + why + ').', 2); if (S.player === 0) { S.over = true; S.overWhy = 'relieved'; } }
  const prev = S.cmdHook;
  S.cmdHook = function () { if (prev) prev(); const day = Math.floor(S.t / 1440); if (day !== st.lastDay) { st.lastDay = day; if (S.t > 0) dayTick(); }
    while (st.ri < st.reviews.length && S.t >= st.reviews[st.ri] * 60) { st.ri++; review(); }
    if (!st.relieved && S.polComposite() < POL.relieve) relieve('standing under ' + POL.relieve); };
  return S;
}
