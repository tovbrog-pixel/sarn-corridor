"""Testbed map for building the game's systems: 600 x 400 km, the same nations as the continent, every terrain and feature the
full design needs, at a size where a test run takes seconds.
Features: the Sarn corridor cutting Ostval off from Valdenmark, two neutrals (Sarn on the plain, Tavia in the mountains), two seas
for sea zones and blockade, ports and landing beaches, a major river in front of Korovia that freezes in winter, marsh and forest
belts, a mountain pass with one railway, a dry plateau, two or three airfields per nation, and a rail gauge break at the Korovian
frontier.
Outputs: data/testbed/terrain/{terrain.u8.gz, elev.i16.gz, grid.json}, data/testbed/map.json, tools/mapgen/out/testbed-preview.png
"""
import json, math, os, gzip
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw

W_KM, H_KM, PX = 600, 400, 2
W, H = W_KM * PX, H_KM * PX
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "out"); os.makedirs(OUT, exist_ok=True)
DATA = os.path.join(HERE, "..", "..", "data", "testbed"); os.makedirs(os.path.join(DATA, "terrain"), exist_ok=True)

def fbm(octaves=6, res=2, pers=0.5, seed=0, shape=(H, W)):
    r = np.random.default_rng(seed); out = np.zeros(shape, np.float32); amp, tot = 1.0, 0.0
    for o in range(octaves):
        ry, rx = max(1, int(res * (2 ** o))), max(1, int(res * (2 ** o) * shape[1] / shape[0]))
        g = r.random((ry + 3, rx + 3)).astype(np.float32)
        z = ndimage.zoom(g, (shape[0] / ry, shape[1] / rx), order=3)
        out += amp * z[: shape[0], : shape[1]]; tot += amp; amp *= pers
    return out / tot

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
X = (xx + 0.5) / PX; Y = (yy + 0.5) / PX
def gauss(cx, cy, rx, ry=None):
    ry = ry or rx; return np.exp(-(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2))
def seg_dist(pts, XX=None, YY=None):
    XX = X if XX is None else XX; YY = Y if YY is None else YY; d = np.full((H, W), 1e9, np.float32)
    for (x1, y1), (x2, y2) in zip(pts[:-1], pts[1:]):
        vx, vy = x2 - x1, y2 - y1; t = np.clip(((XX - x1) * vx + (YY - y1) * vy) / (vx * vx + vy * vy), 0, 1)
        d = np.minimum(d, np.hypot(XX - (x1 + t * vx), YY - (y1 + t * vy)))
    return d

# ---------- land: north sea along the top, south sea along the bottom east of Valdenmark; west and east edges run on as land ----------
wa, wb = fbm(4, 1.5, 0.5, seed=12), fbm(4, 1.5, 0.5, seed=13)
Xw, Yw = X + (wa - 0.5) * 50, Y + (wb - 0.5) * 30
sea = np.zeros((H, W), np.float32)
sea += 1 / (1 + np.exp(np.clip((Yw - 24) / 9, -50, 50)))                                   # North Sea (Varn)
south_x = 1 / (1 + np.exp(np.clip((55 - Xw) / 15, -50, 50)))                                # the south sea starts in western Valdenmark
sea += south_x / (1 + np.exp(np.clip((382 - Yw) / 9, -50, 50)))                             # South Sea (Inner)
sea += 1.2 * np.exp(-(((Xw - 285) / 40) ** 2 + ((Yw - 8) / 22) ** 2))                       # Gulf of Ostrand
sea -= 0.9 * gauss(232, 24, 14, 10)                                                          # the corridor reaches the coast
land_f = 1 - sea + 0.35 * (fbm(5, 3, 0.55, seed=14) - 0.5)
land = land_f > 0.5
land = ndimage.binary_opening(land, iterations=2)
lab, n = ndimage.label(land); sizes = ndimage.sum(land, lab, range(1, n + 1)); land = lab == (int(np.argmax(sizes)) + 1)   # no islands
lab, n = ndimage.label(~land); sizes = ndimage.sum(~land, lab, range(1, n + 1))
for k in range(1, n + 1):          # no enclosed sea pockets inland: fill small water bodies that are not the two seas
    if sizes[k - 1] < 400 * PX * PX: land[lab == k] = True

# ---------- elevation ----------
n_hill = fbm(6, 2, 0.5, seed=21); n_ridge = 1 - np.abs(fbm(6, 3, 0.55, seed=22) * 2 - 1)
elev = 0.14 * n_hill + 0.4 * np.clip(fbm(6, 2.5, 0.55, seed=23) - 0.58, 0, 1)
Xr, Yr = X + (wa - 0.5) * 20, Y + (wb - 0.5) * 20
RIDGES = [
    ([(215, 262), (265, 250), (330, 256), (390, 270)], 16, 1.15),   # Tavian Alps
    ([(160, 120), (170, 180), (162, 235)], 12, 0.42),               # Hollerwald (Valdenmark's eastern hills)
    ([(585, 40), (575, 200), (590, 360)], 14, 0.75),                # Kamen Range on the east edge
]
for pts, w, h in RIDGES:
    d = seg_dist(pts, Xr, Yr); wv = w * (0.7 + 0.8 * n_hill); elev += h * np.exp(-((d / wv) ** 2)) * (0.45 + 0.8 * n_ridge)
PASS = (300, 256)                                                                         # Sennen Pass: a saddle the railway uses
elev = np.where(gauss(*PASS, 6, 16) > 0.35, np.minimum(elev, 0.5), elev)   # the saddle stays below mountain height: hills the railway can cross
elev = np.maximum(elev, 0) * land

# ---------- regional terrain ----------
n_f, n_m, n_d, n_l = fbm(6, 4, 0.6, seed=31), fbm(5, 5, 0.6, seed=32), fbm(6, 3.5, 0.55, seed=33), fbm(5, 6, 0.55, seed=34)
forest_bias = (0.55 * gauss(400, 100, 26, 45) + 0.45 * gauss(165, 175, 22, 55) + 0.4 * gauss(320, 70, 40, 30)
               + 0.4 * gauss(520, 90, 60, 50) + 0.25 * gauss(60, 300, 45, 40))
forest = land & (n_f + forest_bias > 0.86) & (elev < 0.62)
marsh_bias = 0.75 * gauss(415, 205, 18, 45) + 0.35 * gauss(470, 255, 30, 18)               # Drovian-style marsh in front of the Kor
marsh = land & (n_m + marsh_bias > 0.92) & (elev < 0.3)
desert_bias = 0.85 * gauss(320, 345, 70, 22)                                               # dry plateau south of the Alps
desert = land & (desert_bias + 1.0 * (n_d - 0.5) > 0.45) & (elev < 0.6)
lakes = land & (n_l + 0.45 * gauss(330, 80, 35, 20) > 0.92) & (elev < 0.3)                   # Ostval lakes
lakes = ndimage.binary_opening(lakes, iterations=1)
forest &= ~desert & ~lakes; marsh &= ~lakes
water = ~land | lakes
dist_sea = ndimage.distance_transform_edt(land) / PX
dist_land = ndimage.distance_transform_edt(~land) / PX
beach_bias = gauss(330, 385, 55, 18) + gauss(100, 26, 40, 14) + gauss(470, 22, 30, 12)    # Tavian south coast, Valdenmark north coast, Korovian north coast
beach = land & (dist_sea < 3.2) & (beach_bias > 0.35) & (elev < 0.3)

# ---------- nations ----------
NATIONS = [
    dict(id="V", name="Valdenmark", side="west", tint="#3f6fb0", poly=[(-20, -20), (215, -20), (222, 140), (205, 240), (200, 420), (-20, 420)]),
    dict(id="O", name="Ostval", side="west", note="Valdenmark province, cut off by the Sarn corridor", tint="#3f6fb0", poly=[(250, -20), (405, -20), (395, 118), (252, 112)]),
    dict(id="S", name="Sarn", side="neutral", tint="#c9a64a", poly=[(215, -20), (250, -20), (252, 112), (395, 118), (405, 232), (205, 240), (222, 140)]),
    dict(id="T", name="Tavia", side="neutral", tint="#9a7aa0", poly=[(205, 240), (405, 232), (420, 420), (200, 420)]),
    dict(id="K", name="Korovia", side="east", tint="#b0463f", poly=[(405, -20), (620, -20), (620, 420), (420, 420), (405, 232), (395, 118)]),
]
def warp(p):
    x, y = p; i, j = min(max(int(y * PX), 0), H - 1), min(max(int(x * PX), 0), W - 1)
    return (x + float(wa[i, j] - 0.5) * 14, y + float(wb[i, j] - 0.5) * 14)
def densify(poly, step=3):
    out = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        L = math.hypot(b[0] - a[0], b[1] - a[1]); k = max(1, int(L / step))
        out += [(a[0] + (b[0] - a[0]) * t / k, a[1] + (b[1] - a[1]) * t / k) for t in range(k)]
    return out
nat_img = Image.new("L", (W_KM, H_KM), 0); dr = ImageDraw.Draw(nat_img)
for k, nt in enumerate(NATIONS):
    nt["wpoly"] = [warp(p) for p in densify(nt["poly"])]; dr.polygon(nt["wpoly"], fill=k + 1)
nat = np.array(nat_img)
def nation_at(x, y):
    k = int(nat[min(max(int(y), 0), H_KM - 1), min(max(int(x), 0), W_KM - 1)]); return NATIONS[k - 1]["id"] if k else None
def is_land(x, y):
    i, j = int(y * PX), int(x * PX); return 0 <= i < H and 0 <= j < W and bool(land[i, j]) and not bool(lakes[i, j])
borders = []
for nt in NATIONS:
    run = []
    for p in nt["wpoly"] + nt["wpoly"][:1]:
        if is_land(*p) and 1 < p[0] < W_KM - 1 and 1 < p[1] < H_KM - 1: run.append((round(p[0], 1), round(p[1], 1)))
        else:
            if len(run) > 2: borders.append(run)
            run = []
    if len(run) > 2: borders.append(run)

def displace(pts, amp, depth, seed):
    r = np.random.default_rng(seed); pts = [tuple(p) for p in pts]
    for _ in range(depth):
        new = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1
            off = (r.random() - 0.5) * amp * L; new += [(mx - dy / L * off, my + dx / L * off), b]
        pts = new; amp *= 0.85
    return pts

# ---------- rivers (order 3-4 need a bridge; the Kor is order 4 and freezes in deep winter) ----------
RIVERS = [
    ("Aller", 3, [(110, 330), (118, 240), (105, 140), (95, 60), (92, -5)]),
    ("Vesna", 3, [(205, 300), (214, 200), (226, 120), (231, 60), (233, -5)]),
    ("Drova", 2, [(360, 225), (352, 160), (338, 120)]),
    ("Kor", 4, [(450, -5), (442, 90), (436, 180), (445, 270), (455, 330), (462, 410)], ),
    ("Pripa", 2, [(380, 180), (405, 200), (436, 185)]),
    ("Tavine", 2, [(300, 300), (310, 350), (318, 400)]),
]
rivers = []
for k, (nm, order, pts) in enumerate(RIVERS):
    p = displace(pts, 0.25, 4, seed=100 + k); out = []
    for q in p:
        out.append(q)
        if len(out) > 6 and (q[1] < 0 or q[1] > H_KM or not is_land(*q)): break
    rivers.append(dict(name=nm, order=order, freezes=(nm == "Kor"), pts=[(round(a, 1), round(b, 1)) for a, b in out]))

# ---------- cities ----------
CITIES = [   # name, x, y, kind (capital|city|port), size 1..3, production points per turn (game setting)
    ("Halden", 85, 190, "capital", 3, 6), ("Freyburg", 150, 95, "city", 2, 4), ("Ulmsted", 140, 300, "city", 2, 4),
    ("Brennhaven", 70, 26, "port", 2, 2), ("Westerkai", 80, 392, "port", 1, 1),
    ("Ostrand", 300, 30, "port", 2, 2), ("Varnholm", 345, 92, "city", 1, 1),
    ("Port Vesna", 233, 24, "port", 2, 1), ("Sarnow", 320, 170, "capital", 2, 2), ("Tarnek", 255, 160, "city", 1, 1),
    ("Tavianne", 295, 320, "capital", 2, 2), ("Port Aurel", 335, 385, "port", 1, 1),
    ("Korograd", 535, 200, "capital", 3, 6), ("Severomark", 500, 24, "port", 2, 2), ("Yuzhny", 525, 388, "port", 2, 2),
    ("Belov", 475, 105, "city", 2, 4), ("Rodnik", 480, 300, "city", 1, 2),
]
cities = []
for nm, x, y, kind, size, prod in CITIES:
    if kind == "port":
        best = None
        for r_ in range(0, 60):
            for a in np.linspace(0, 2 * np.pi, 24, endpoint=False):
                qx, qy = x + r_ * math.cos(a), y + r_ * math.sin(a)
                if is_land(qx, qy) and dist_sea[int(qy * PX), int(qx * PX)] < 2.5: best = (qx, qy); break
            if best: break
        if not best: raise SystemExit(f"port {nm} found no coast")
        x, y = best
    elif not is_land(x, y): raise SystemExit(f"city {nm} is in water")
    cities.append(dict(name=nm, x=round(x, 1), y=round(y, 1), kind=kind, size=size, prod=prod, nation=nation_at(x, y)))
C = {c["name"]: c for c in cities}
for c in cities:
    want = {"Halden": "V", "Freyburg": "V", "Ulmsted": "V", "Brennhaven": "V", "Westerkai": "V", "Ostrand": "O", "Varnholm": "O", "Port Vesna": "S", "Sarnow": "S", "Tarnek": "S", "Tavianne": "T", "Port Aurel": "T"}.get(c["name"], "K")
    if c["nation"] != want: raise SystemExit(f'{c["name"]} landed in {c["nation"]}, expected {want}')

# ---------- railways (gauge: Korovian track is broad gauge and must be converted before western trains run on it) ----------
RAIL = [("Brennhaven", "Freyburg"), ("Freyburg", "Halden"), ("Halden", "Ulmsted"), ("Ulmsted", "Westerkai"),
        ("Freyburg", "Port Vesna"), ("Port Vesna", "Ostrand"), ("Ostrand", "Varnholm"),
        ("Halden", "Tarnek"), ("Tarnek", "Sarnow"), ("Sarnow", "Tavianne"), ("Tavianne", "Port Aurel"),
        ("Sarnow", "Belov"), ("Varnholm", "Belov"), ("Belov", "Severomark"), ("Belov", "Korograd"),
        ("Korograd", "Rodnik"), ("Rodnik", "Yuzhny"), ("Ulmsted", "Tavianne")]
ROADS = [("Halden", "Westerkai"), ("Tarnek", "Port Vesna"), ("Sarnow", "Varnholm"), ("Sarnow", "Rodnik"),
         ("Tavianne", "Rodnik"), ("Korograd", "Severomark"), ("Brennhaven", "Halden")]
VIA = {("Port Vesna", "Ostrand"): [(255, 40)], ("Ostrand", "Varnholm"): [(362, 48)], ("Sarnow", "Tavianne"): [PASS], ("Ulmsted", "Tavianne"): [(215, 300)]}
def route(a, b, seed, amp=0.1):
    pts = [(C[a]["x"], C[a]["y"])] + VIA.get((a, b), []) + [(C[b]["x"], C[b]["y"])]
    return [(round(x, 1), round(y, 1)) for x, y in displace(pts, amp, 4 if len(pts) == 2 else 3, seed)]
rails = []
for k, (a, b) in enumerate(RAIL):
    pts = route(a, b, 300 + k); g = "broad" if C[a]["nation"] == "K" and C[b]["nation"] == "K" else ("mixed" if "K" in (C[a]["nation"], C[b]["nation"]) else "standard")
    rails.append(dict(a=a, b=b, gauge=g, pts=pts))
roads = [dict(a=a, b=b, pts=route(a, b, 500 + k, 0.18)) for k, (a, b) in enumerate(ROADS)]
# where standard and broad gauge meet: the point on a mixed line where it crosses into Korovia
gauge_breaks = []
for rl in rails:
    if rl["gauge"] != "mixed": continue
    for p, q in zip(rl["pts"][:-1], rl["pts"][1:]):
        if (nation_at(*p) == "K") != (nation_at(*q) == "K"): gauge_breaks.append(dict(line=f'{rl["a"]}-{rl["b"]}', x=round((p[0] + q[0]) / 2, 1), y=round((p[1] + q[1]) / 2, 1))); break
for ln in rails + roads:
    for x, y in ln["pts"]:
        if not is_land(x, y): print("WARN line over water", ln["a"], ln["b"], x, y); break

def seg_x(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-9: return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    if 0 <= t <= 1 and 0 <= u <= 1: return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))
bridges = []
for kind, lines in (("rail", rails), ("road", roads)):
    for ln in lines:
        for rv in rivers:
            for p1, p2 in zip(ln["pts"][:-1], ln["pts"][1:]):
                for p3, p4 in zip(rv["pts"][:-1], rv["pts"][1:]):
                    q = seg_x(p1, p2, p3, p4)
                    if q: bridges.append(dict(x=round(q[0], 1), y=round(q[1], 1), kind=kind, river=rv["name"], line=f'{ln["a"]}-{ln["b"]}'))

# ---------- airfields (2-3 per nation), sea zones, labels ----------
AIRFIELDS = [("Halden airfield", "V", 95, 205, 3), ("Freyburg airfield", "V", 160, 105, 2), ("Ulmsted airfield", "V", 130, 285, 2),
             ("Ostrand airfield", "O", 310, 45, 1), ("Sarnow airfield", "S", 330, 180, 2), ("Tavianne airfield", "T", 285, 330, 1),
             ("Korograd airfield", "K", 545, 215, 3), ("Belov airfield", "K", 485, 115, 2), ("Rodnik airfield", "K", 490, 290, 2)]
airfields = []
for nm, nid, x, y, size in AIRFIELDS:
    if not is_land(x, y): raise SystemExit(f"airfield {nm} in water")
    airfields.append(dict(name=nm, nation=nid, x=x, y=y, size=size))
SEA_ZONES = [dict(name="North Sea", poly=[(0, 0), (600, 0), (600, 40), (0, 40)], ports=["Brennhaven", "Port Vesna", "Ostrand", "Severomark"]),
             dict(name="South Sea", poly=[(55, 360), (600, 360), (600, 400), (150, 400)], ports=["Westerkai", "Port Aurel", "Yuzhny"])]
LABELS = dict(seas=[("North Sea", 160, 8, 0), ("South Sea", 420, 396, 0), ("Gulf of Ostrand", 285, 6, 0)],
              features=[("Tavian Alps", 300, 262, 0), ("Sennen Pass", PASS[0], PASS[1] + 8, 0), ("Hollerwald", 165, 175, 80),
                        ("Kor Marshes", 415, 210, 0), ("Tavian Plateau", 320, 348, 0), ("Ostval Lakes", 330, 78, 0),
                        ("Sarn Corridor", 232, 80, 90), ("Kamen Range", 585, 200, 86)],
              nations=[("VALDENMARK", 90, 250), ("OSTVAL", 330, 55), ("SARN", 300, 140), ("TAVIA", 310, 300), ("KOROVIA", 520, 160)])
terrain_area = {k: round(float(v.sum()) / PX / PX) for k, v in dict(land=land, forest=forest, marsh=marsh, desert=desert, lakes=lakes, beach=beach,
                mountains=land & (elev > 0.6), hills=land & (elev > 0.33) & (elev <= 0.6)).items()}
data = dict(title="Testbed", units="km", width=W_KM, height=H_KM, terrain_area_km2=terrain_area,
            nations=[dict(id=n["id"], name=n["name"], side=n["side"], tint=n["tint"], note=n.get("note", ""),
                          poly=[(round(x, 1), round(y, 1)) for x, y in n["wpoly"][::2]],
                          capital=next((c["name"] for c in cities if c["nation"] == n["id"] and c["kind"] == "capital"), None)) for n in NATIONS],
            borders=borders, rivers=rivers, cities=cities, rail=rails, roads=roads, ferries=[], bridges=bridges,
            passes=[dict(name="Sennen Pass", x=PASS[0], y=PASS[1])], gauge_breaks=gauge_breaks, airfields=airfields, sea_zones=SEA_ZONES, labels=LABELS)

# ---------- engine grid: 1 km cells, codes as in engine/src/map.js (OPEN 0, LF 1, HF 2, HILL 3, MTN 4, DESERT 6, BEACH 8, MARSH 9, SEA 12, RIVER 13) ----------
code = np.zeros((H, W), np.uint8); code[land & (elev > 0.33)] = 3
heavy = forest & (n_f + forest_bias > 1.0); code[forest] = 1; code[heavy] = 2
code[land & (elev > 0.6)] = 4; code[desert] = 6; code[marsh] = 9; code[beach] = 8; code[lakes] = 13; code[~land] = 12
b = code.reshape(H_KM, PX, W_KM, PX).transpose(0, 2, 1, 3).reshape(H_KM, W_KM, PX * PX)
tc = np.zeros((H_KM, W_KM), np.uint8); best = np.full((H_KM, W_KM), -1, np.int32)
for v in (0, 1, 2, 3, 4, 6, 8, 9):
    nv = (b == v).sum(-1); sel = nv > best; best[sel] = nv[sel]; tc[sel] = v
tc[(b == 13).sum(-1) * 2 > PX * PX] = 13; tc[(b == 12).sum(-1) * 2 >= PX * PX] = 12
el_m = np.where(land, 30 + elev * 1400, -8).astype(np.float32)
ec = el_m.reshape(H_KM, PX, W_KM, PX).mean(axis=(1, 3)).round().astype(np.int16)
with gzip.open(os.path.join(DATA, "terrain", "terrain.u8.gz"), "wb") as f: f.write(tc.tobytes())
with gzip.open(os.path.join(DATA, "terrain", "elev.i16.gz"), "wb") as f: f.write(ec.tobytes())
names = {0: "OPEN", 1: "LF", 2: "HF", 3: "HILL", 4: "MTN", 6: "DESERT", 8: "BEACH", 9: "MARSH", 12: "SEA", 13: "RIVER"}
hist = {names[int(k)]: int(v) for k, v in zip(*np.unique(tc, return_counts=True))}
with open(os.path.join(DATA, "terrain", "grid.json"), "w") as f: json.dump(dict(w=W_KM, h=H_KM, cs=1, codes="engine/src/map.js T", elev="metres, int16; sea -8", hist=hist), f)
with open(os.path.join(DATA, "map.json"), "w") as f: json.dump(data, f, separators=(",", ":"))

# ---------- preview picture ----------
def hexc(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
COL = {0: "#e3e5cc", 1: "#a6bd8c", 2: "#8faa78", 3: "#d2c7a2", 4: "#b39a76", 6: "#ecd9a6", 8: "#f1e2b2", 9: "#9fbfb8", 12: "#9fc2d2", 13: "#7fb0c6"}
img = np.zeros((H_KM, W_KM, 3), np.float32)
for v, c in COL.items(): img[tc == v] = hexc(c)
S = 2; im = Image.fromarray(img.astype(np.uint8)).resize((W_KM * S, H_KM * S), Image.NEAREST); d = ImageDraw.Draw(im)
for bd in borders: d.line([(x * S, y * S) for x, y in bd], fill=(120, 60, 120), width=2)
for rv in rivers: d.line([(x * S, y * S) for x, y in rv["pts"]], fill=(40, 90, 170) if rv["order"] >= 3 else (90, 140, 200), width=3 if rv["order"] >= 3 else 2)
for rd in roads: d.line([(x * S, y * S) for x, y in rd["pts"]], fill=(150, 110, 60), width=2)
for rl in rails: d.line([(x * S, y * S) for x, y in rl["pts"]], fill=(160, 30, 30) if rl["gauge"] == "broad" else (30, 30, 30), width=2)
for gb in gauge_breaks: d.rectangle([gb["x"] * S - 4, gb["y"] * S - 4, gb["x"] * S + 4, gb["y"] * S + 4], outline=(200, 0, 0), width=2)
for af in airfields: d.polygon([(af["x"] * S, af["y"] * S - 6), (af["x"] * S - 5, af["y"] * S + 4), (af["x"] * S + 5, af["y"] * S + 4)], outline=(20, 20, 120))
for c in cities:
    r = 6 if c["kind"] == "capital" else 4; d.ellipse([c["x"] * S - r, c["y"] * S - r, c["x"] * S + r, c["y"] * S + r], fill=(0, 0, 0) if c["kind"] != "port" else (20, 60, 140))
    d.text((c["x"] * S + 7, c["y"] * S - 6), c["name"], fill=(0, 0, 0))
for nm, x, y in LABELS["nations"]: d.text((x * S, y * S), nm, fill=(90, 30, 30))
for nm, x, y, _ in LABELS["features"]: d.text((x * S - 20, y * S), nm, fill=(60, 60, 60))
d.text((PASS[0] * S - 4, PASS[1] * S - 4), "X", fill=(200, 0, 0))
im.save(os.path.join(OUT, "testbed-preview.png"))
print("testbed", W_KM, "x", H_KM, "km;", hist)
print("area", terrain_area); print("cities", {c["name"]: c["nation"] for c in cities})
print("bridges", len(bridges), "gauge breaks", [g["line"] for g in gauge_breaks], "borders", len(borders))
