// ===== ASSESSMENT: how higher command judges the battle (reads GUIDE in guidance.js) =====
// Index I is Allied-positive and measures the battle against history; O = history + I is the outcome. Numbers stay internal.
const ASSESS = (function () {
  const W = { ground: .35, dl: .45, cost: .3, pol: .3, trap: .35 }, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const g = S => (typeof GUIDE !== 'undefined' && GUIDE[S.sc.id]) || null;
  function strength0(S) { if (S._s0) return S._s0; const r = [0, 0];
    for (const f of S.sc.forms) for (const q of f.sub) { const a = q.split('|'); if (!/^hq_|^nav/.test(a[0])) r[f.s] += a[2] ? +a[2] : 1; }
    S.sc.sides.forEach((sd, s) => { for (const p of sd.pool || []) if (!/^nav|^hq_/.test(p.k)) r[s] += p.size || 1; });
    return (S._s0 = r.map(v => Math.max(1, v))); }
  const lossFrac = (S, s) => S.losses[s] / strength0(S)[s];
  function trapFrac(S) { let t = S.losses[1]; for (const F of S.forms) if (F.s === 1 && F.isolated && !F.dead) for (const u of F.subs) if (!u.dead && u.cls !== 'hq') t += u.str * u.size; return t / strength0(S)[1]; }
  // deadline value in [-1, 1]; final=false gives the value so far (0 while still pending)
  function dlVal(S, d, final) { const v = S.vp.find(q => q.n === d.n); if (!v) return { d: 0 }; const now = S.t / 60, lost = v.lost || [null, null], end = v.own === d.s;
    if (d.relieve) { const mine = v.cutT != null && v.cutS === d.s, rt = mine ? v.relT : v.linkT ? v.linkT[d.s] : null;   // relieved: held and joined by road to a ground depot
      if (!mine && v.orig === d.s && v.own === d.s) return { d: final || now > d.by ? 1 : 0, v, ok: true, nocut: true };
      if (rt != null) { let x = rt <= d.by ? 1 : Math.max(-.5, 1 - 1.5 * (rt - d.by) / Math.max(12, d.by * .5)); if (final && !end) x = Math.min(x, -.5); return { d: x, tk: rt, v, ok: rt <= d.by && (!final || end), rel: 1 }; }
      return { d: final || now > d.by ? -1 : 0, v, ok: false, rel: 1, pending: !final && now <= d.by }; }
    if (d.hold) { const lt = v.orig === d.s ? lost[d.s] : null; if (v.orig !== d.s) return { d: 0, v };
      if (lt == null || lt >= d.by) return { d: final && !end ? .5 : 1, lt, v, ok: lt == null || lt >= d.by };
      let x = -1 + 1.2 * (lt / d.by); if (end) x += .6; return { d: clamp(x, -1, 1), lt, v, ok: false }; }
    const chg = v.chg || [], ownAt = T => { let w = v.orig, at = 0; for (const c of chg) if (c[0] <= T) { w = c[1]; at = c[0]; } return [w, at]; };
    let tk = null; if (now >= d.by || final) { const a = ownAt(d.by); if (a[0] === d.s) tk = a[1]; else { const c = chg.find(c => c[0] > d.by && c[1] === d.s); if (c) tk = c[0]; } }
    else { const a = ownAt(now); if (a[0] === d.s && (v.orig !== d.s || a[1] > 0)) tk = a[1]; }
    if (tk == null) return { d: final || now > d.by ? -1 : 0, v, pending: !final && now <= d.by };
    let x = tk <= d.by ? 1 : Math.max(-.5, 1 - 1.5 * (tk - d.by) / Math.max(12, d.by * .5)); if (final && !end) x = Math.min(x, -.25);
    return { d: x, tk, v, ok: tk <= d.by }; }
  function dlHist(d) { if (d.relieve) { const tk = d.at; if (tk == null) return -1; return tk <= d.by ? 1 : Math.max(-.5, 1 - 1.5 * (tk - d.by) / Math.max(12, d.by * .5)); }
    if (d.hold) { const lt = d.at; if (lt == null || lt >= d.by) return d.end === 0 ? .5 : 1; let x = -1 + 1.2 * (lt / d.by); if (d.end) x += .6; return clamp(x, -1, 1); }
    const tk = d.at; if (tk == null) return -1; let x = tk <= d.by ? 1 : Math.max(-.5, 1 - 1.5 * (tk - d.by) / Math.max(12, d.by * .5)); if (d.end === 0) x = Math.min(x, -.25); return x; }
  const cstOf = r => r <= 1 ? (1 - r) * .3 : -Math.min(1.5, r - 1);
  function evalAll(S) { const G = g(S); if (!G) return null; const sc = S.score(), tot = Math.max(1, sc[0] + sc[1]), share = sc[0] / tot;
    const f = { ground: clamp((share - G.par) * 3, -1, 1) * W.ground };
    const dls = G.deadlines.map(d => Object.assign({ q: d }, dlVal(S, d, true))); f.dl = dls.reduce((a, x) => a + (x.q.s === 0 ? 1 : -1) * (x.d - dlHist(x.q)), 0) * W.dl / Math.max(1, dls.length);
    const lf = [lossFrac(S, 0), lossFrac(S, 1)], ratio = lf.map((x, s) => x / G.sides[s].budget), cst = ratio.map((r, s) => cstOf(r) - cstOf(G.sides[s].hr || 1));
    f.cost = (cst[0] - cst[1]) * W.cost / 1.5;
    const pol = G.political.map(p => { const v = S.vp.find(q => q.n === p.n); return { p, held: !!v && v.own === p.s }; }); f.pol = pol.reduce((a, x) => a + (x.p.s === 0 ? 1 : -1) * ((x.held ? 1 : 0) - (x.p.h ? 1 : 0)), 0) * W.pol / Math.max(1, pol.length);
    let tf = null; if (G.trap != null) { tf = trapFrac(S); f.trap = clamp((tf - G.trap) * 4, -1, 1) * W.trap; } else f.trap = 0;
    const I = f.ground + f.dl + f.cost + f.pol + f.trap, O = clamp(G.hist + I, -1, 1);
    return { G, I, O, f, share, dls, lf, ratio, pol, tf, sc }; }
  const OUT = ['a severe defeat', 'a failure', 'indecisive', 'a success', 'a decisive success'];
  function band(o) { return o >= .45 ? 4 : o >= .15 ? 3 : o > -.15 ? 2 : o > -.45 ? 1 : 0; }
  function qual(A, s) { const r = A.ratio[s]; return r > 1.7 ? 'Pyrrhic' : r > 1.25 ? 'costly' : ''; }
  function verdict(S, A) { const lab = S.sc.labels || ['Allied', 'Axis'], b = band(A.O); if (b === 2) return 'Indecisive';
    const w = A.O > 0 ? 0 : 1, q = qual(A, w), dec = b === 4 || b === 0; return q === 'Pyrrhic' ? 'Pyrrhic ' + lab[w] + ' victory' : q ? (dec ? 'Decisive but costly ' : 'Costly ') + lab[w] + ' victory' : (dec ? 'Decisive ' : '') + lab[w] + ' victory'; }
  function sideOutcome(A, s) { const b = band(s === 0 ? A.O : -A.O); let t = OUT[b]; if (b >= 3) { const q = qual(A, s); if (q) t = (q === 'Pyrrhic' ? 'a Pyrrhic' : 'a costly') + ' success'; } return t; }
  const year = S => S.sc.start.slice(0, 4);
  function lines(S, A, s) { const G = A.G, out = [], hh = h => S.clock(h * 60).replace(/ \d{4} /, ' ').replace(/  /, ' ');
    for (const x of A.dls) { if (x.q.s !== s) { if (x.ok && !x.q.hold && !x.q.relieve) out.push(x.tk > 0 ? 'The enemy took ' + x.q.n + ' on schedule, by ' + hh(x.tk) + '.' : 'The enemy still held ' + x.q.n + ' at ' + hh(x.q.by) + ', as his orders required.'); continue; }
      if (x.q.relieve) { out.push(x.nocut ? x.q.n + ' was never cut off.' : x.tk == null ? (x.v && x.v.cutT != null && x.v.cutS === s ? x.q.n + ' was never relieved.' : 'The corridor never reached ' + x.q.n + '.') + ' Relief was due by ' + hh(x.q.by) + '.' : x.q.n + ' was relieved at ' + hh(x.tk) + (x.v && x.v.own !== s ? ', but fell afterwards.' : x.ok ? ', on schedule.' : ', against a deadline of ' + hh(x.q.by) + '.')); continue; }
      if (x.q.hold) { if (x.ok == null) continue; out.push(x.ok ? x.q.n + ' was held as ordered.' : x.q.n + ' was lost on ' + hh(x.lt) + (x.v && x.v.own === s ? ', and retaken.' : '.')); }
      else if (x.tk == null) out.push(x.q.n + ' was never taken. It was due by ' + hh(x.q.by) + '.');
      else if (x.ok) out.push(x.tk > 0 ? x.q.n + ' was taken on schedule, at ' + hh(x.tk) + '.' : x.q.n + ' was in our hands at ' + hh(x.q.by) + ', as ordered.');
      else out.push(x.q.n + ' was taken late, at ' + hh(x.tk) + ', against a deadline of ' + hh(x.q.by) + (x.v && x.v.own !== s ? ', and lost again.' : '.')); }
    for (const p of A.pol) if (p.p.s === s) out.push(p.held ? p.p.held : p.p.lost);
    if (A.tf != null) out.push(s === 0 ? 'About ' + Math.round(A.tf * 100) + ' percent of the German strength was destroyed or trapped.' : 'About ' + Math.round((1 - A.tf) * 100) + ' percent of the army\'s strength came out of the pocket.');
    const r = A.ratio[s], cap = G.sides[s].capital; out.push(r <= .8 ? 'Losses were light, well within what ' + cap + ' will accept.' : r <= 1.1 ? 'Losses were within what ' + cap + ' will accept.' : r <= 1.5 ? 'Losses were heavy and will draw questions in ' + cap + '.' : 'Losses were ruinous. ' + cap + ' will ask whether the result was worth them.');
    const hr = G.sides[s].hr; if (hr && hr !== 1) { if (r < hr * .85) out.push('That is lighter than our losses in ' + year(S) + '.'); else if (r > hr * 1.15) out.push('That is heavier than our losses in ' + year(S) + '.'); }
    if (A.ratio[1 - s] > 1.25) out.push('The enemy lost more than he could afford.');
    const d = A.share - G.par; if (Math.abs(d) > .06) out.push((s === 0 ? d > 0 : d < 0) ? 'We hold more of the field than our side did in ' + year(S) + '.' : 'We hold less of the field than our side did in ' + year(S) + '.');
    return out; }
  function compare(S, A, s) { const i = s === 0 ? A.I : -A.I; return i > .12 ? 'Better than the historical result.' : i < -.12 ? 'Worse than the historical result.' : 'About as it went in ' + year(S) + '.'; }
  // live mood for side s: dominant concern, worded as the higher headquarters' view
  function mood(S, s) { const G = g(S); if (!G) return null; const hq = G.sides[s].hq, now = S.t / 60, hrs = S.sc.hours, clockH = h => S.clock(h * 60).replace(/ \d{4} /, ' ').replace(/  /, ' ');
    const issues = []; for (const d of G.deadlines) { const x = dlVal(S, d, false);
      if (d.s === s && d.relieve) { if (x.tk == null && !x.nocut) { const cut = x.v && x.v.cutS === s && x.v.own === s; if (now > d.by) issues.push([.5, 'the relief of ' + d.n + ' was due by ' + clockH(d.by)]); else if (cut) issues.push([.2, d.n + ' is cut off']); } continue; }
      if (d.s === s) { if (d.hold) { if (x.ok === false && !(x.v && x.v.own === s)) issues.push([.5, d.n + ' has been lost']); }
        else if (x.tk == null && now > d.by) issues.push([.45, d.n + ' was due by ' + clockH(d.by)]);
        else if (x.tk == null && d.by - now < 6 && d.by - now > 0) issues.push([.15, d.n + ' is due by ' + clockH(d.by)]); }
      else if (!d.hold && !d.relieve && x.tk != null && x.tk <= d.by && x.v && x.v.own === d.s) issues.push([.35, 'the enemy has taken ' + d.n]); }
    const lf = lossFrac(S, s), exp = G.sides[s].budget * Math.min(1, .25 + now / hrs), r = lf / Math.max(.01, exp);
    if (r > 1.6) issues.push([.55, 'losses are far beyond what was expected']); else if (r > 1.2) issues.push([.3, 'losses are running high']);
    for (const p of G.political) if (p.s === s) { const v = S.vp.find(q => q.n === p.n), later = G.deadlines.some(d => d.s === s && d.n === p.n && !d.hold && !d.relieve && d.by > now); if (v && v.orig === s && v.own !== s && !later) issues.push([.5, p.n + ' is in enemy hands']); }
    const met = G.deadlines.filter(d => d.s === s && !d.hold && dlVal(S, d, false).ok).length;
    const sev = issues.reduce((a, x) => a + x[0], 0), top = issues.sort((a, b) => b[0] - a[0])[0];
    const word = sev >= 1 ? 'is losing confidence' : sev >= .5 ? 'is concerned' : sev >= .3 ? 'is impatient' : sev > 0 ? 'is watching closely' : met ? 'is pleased' : 'is satisfied';
    return { hq, word, why: top ? top[1] : met ? 'objectives are being taken on schedule' : 'the battle is going to plan', sev }; }
  // why the verdict came out as it did: it starts from the historical result and moves with each way this battle differs from it
  function why(S, A, s) { const sg = s === 0 ? 1 : -1, lab = (S.sc.labels || ['Allied', 'Axis'])[s], tot = A.sc[0] + A.sc[1], par = Math.round((s === 0 ? A.G.par : 1 - A.G.par) * tot);
    const NM = { ground: 'ground held at the end', dl: 'objectives taken or held on time', cost: 'losses on both sides', pol: 'the places that mattered politically', trap: 'enemy strength destroyed or trapped' }, up = [], dn = [];
    for (const k of Object.keys(NM)) { const v = (A.f[k] || 0) * sg; if (v >= .04) up.push(NM[k]); else if (v <= -.04) dn.push(NM[k]); }
    return 'Higher command starts from the result in ' + year(S) + ' (' + OUT[band(sg * A.G.hist)] + ' for the ' + lab + ' side) and judges how this battle differs from it. In ' + year(S) + ' the ' + lab + ' side held about ' + par + ' of the ' + tot + ' points at the end; this time it held ' + A.sc[s] + '.' + (up.length ? ' Better than history: ' + up.join('; ') + '.' : '') + (dn.length ? ' Worse than history: ' + dn.join('; ') + '.' : ''); }
  // where this result sits among computer-versus-computer runs of the same scenario (G.base: their history indexes, Allied-positive)
  function rank(S, A, s) { const b = A.G.base; if (!b || !b.length) return null; const sg = s === 0 ? 1 : -1, v = A.I * sg; return { k: b.filter(x => x * sg < v).length, n: b.length }; }
  return { rank, evalAll, verdict, sideOutcome, lines, compare, mood, lossFrac, trapFrac, why };
})();
