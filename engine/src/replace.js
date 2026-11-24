// ===== REPLACEMENTS =====
// Each nation draws on a pool that fills at a daily rate (sc.repl.pools). A battalion out of the fight draws men from its pool and
// regains strength. The new men are less experienced than the men they join, so the battalion's experience falls toward the
// replacement level and its cohesion dips until the unit settles. Experience grows back slowly in combat.
// A battalion that has been destroyed is not rebuilt. Rates below are game settings unless a scenario comment cites a source.
const REPL = {
  quietH: 12,          // hours since the battalion was last under fire
  contactKm: 4,        // no enemy battalion this close
  perDay: .1,          // strength one battalion can absorb in a day
  dip: .5,             // cohesion lost: this share of the fraction of the battalion that is new
  growDay: .012, growCap: 1.35,   // experience gained per day in action, and its ceiling
  stockDays: 12,       // a pool holds at most this many days of its intake
  minNote: .4          // battalion-equivalents in a day that earn a report from the division
};
function attachRepl(S) {
  const sc = S.sc, cfg = Object.assign({}, REPL, (sc.repl && sc.repl.set) || {}), pools = ((sc.repl && sc.repl.pools) || []).map(p => Object.assign({ stock: p.stock0 || 0, given: 0, day: 0 }, p));
  S.repl = { pools, given: [0, 0] };
  const poolOf = F => pools.find(p => p.s === F.s && (!p.nat || p.nat.includes(F.nat)));
  const rateOf = p => { let r = 0; for (const q of p.perDay) if (S.t >= q.from * 60) r = q.n; return r; };
  let nextT = 60; const prevHook = S.cmdHook;
  S.cmdHook = function () { if (prevHook) prevHook(); if (S.t < nextT) return; const hrs = Math.max(1, Math.round((S.t - (nextT - 60)) / 60)); nextT = S.t + 60;
    for (const p of pools) { const r = rateOf(p); p.stock = Math.min(r * cfg.stockDays, p.stock + r * hrs / 24); }
    // seasoning: a battalion under fire in the last hour learns
    for (const u of S.subs) if (u.active && !u.dead && u.cls !== 'hq' && u.str > .3 && S.t - u.hitT < 60 && u.xp < cfg.growCap) u.xp = Math.min(cfg.growCap, u.xp + cfg.growDay * hrs / 24);
    // who can take men now
    const foes = S.subs.filter(e => e.active && !e.dead && e.cls !== 'hq' && e.mv !== 'ship');
    const want = new Map();   // pool -> [[u, strength wanted]]
    for (const F of S.forms) { if (!F.active || F.dead || F.isolated || F.transit) continue; const p = poolOf(F); if (!p || p.stock <= 0) continue;
      for (const u of F.subs) { if (!u.active || u.dead || u.cls === 'hq' || u.mv === 'ship' || u.str >= .995 || u.str <= 0 || S.t - u.hitT < cfg.quietH * 60) continue;
        let near = false; for (const e of foes) if (e.s !== u.s && Math.abs(e.x - u.x) < cfg.contactKm && Math.hypot(e.x - u.x, e.y - u.y) < cfg.contactKm) { near = true; break; } if (near) continue;
        const d = Math.min(1 - u.str, cfg.perDay * hrs / 24); if (!want.has(p)) want.set(p, []); want.get(p).push([u, d]); } }
    for (const [p, L] of want) { let need = 0; for (const [u, d] of L) need += d * u.size; const share = Math.min(1, p.stock / need);
      for (const [u, d0] of L) { const d = d0 * share; if (d <= 0) continue; const ns = u.str + d, ox = u.xp;
        u.xp = (u.str * u.xp + d * (p.xp || .85)) / ns; if (u.mor0 != null) u.mor0 = Math.max(.2, u.mor0 + .45 * (u.xp - ox));
        u.coh = Math.max(.25, u.coh * (1 - cfg.dip * d / ns)); u.str = ns; const be = d * u.size; p.stock -= be; p.given += be; S.repl.given[u.s] += be; u.f.replDay = (u.f.replDay || 0) + be; u.f.replAll = (u.f.replAll || 0) + be; }
      p.stock = Math.max(0, p.stock); }
    // once a day each division that took in a fair number reports it
    if (Math.floor(S.t / 1440) !== Math.floor((S.t - 60 * hrs) / 1440)) for (const F of S.forms) { if (F.replDay >= cfg.minNote) S.say(F, 'Took in about ' + Math.round(F.replDay * 800 / 50) * 50 + ' replacements today. The new men need time to settle in.', 0); F.replDay = 0; }
  };
  // average experience of a formation's fighting battalions, weighted by strength
  S.experience = function (F) { let a = 0, n = 0; for (const u of F.subs) if (!u.dead && u.cls !== 'hq') { a += u.xp * u.str * u.size; n += u.str * u.size; } return n ? a / n : F.xp || 1; };
  return S;
}
if (typeof module !== 'undefined') module.exports = { attachRepl, REPL };
