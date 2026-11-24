"""Sample continent generator for a Blitzkrieg-pattern campaign map.
Map units are kilometres; 1400 x 900 km. Raster at PX px per km.
Outputs: out/terrain.jpg, out/nations.png, out/map.json, out/preview.png
"""
import json, math, os
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw

W_KM, H_KM, PX = 1400, 900, 2
W, H = W_KM * PX, H_KM * PX
OUT = os.path.join(os.path.dirname(__file__), "out")   # preview rasters for the map page
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1940)

# ---------- noise ----------
def fbm(octaves=6, res=4, pers=0.5, seed=0, shape=(H, W)):
    r = np.random.default_rng(seed)
    out = np.zeros(shape, np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        ry, rx = res * (2 ** o), int(res * (2 ** o) * shape[1] / shape[0])
        g = r.random((ry + 3, rx + 3)).astype(np.float32)
        z = ndimage.zoom(g, (shape[0] / ry, shape[1] / rx), order=3)
        out += amp * z[: shape[0], : shape[1]]
        tot += amp
        amp *= pers
    return out / tot

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
X = (xx + 0.5) / PX
Y = (yy + 0.5) / PX

def gauss(cx, cy, rx, ry=None):
    ry = ry or rx
    return np.exp(-(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2))

def seg_dist(pts, XX=None, YY=None):
    XX = X if XX is None else XX
    YY = Y if YY is None else YY
    d = np.full((H, W), 1e9, np.float32)
    for (x1, y1), (x2, y2) in zip(pts[:-1], pts[1:]):
        vx, vy = x2 - x1, y2 - y1
        t = np.clip(((XX - x1) * vx + (YY - y1) * vy) / (vx * vx + vy * vy), 0, 1)
        d = np.minimum(d, np.hypot(XX - (x1 + t * vx), YY - (y1 + t * vy)))
    return d

# ---------- land ----------
n_coast = fbm(7, 3, 0.6, seed=11)
wa, wb = fbm(4, 3, 0.5, seed=12), fbm(4, 3, 0.5, seed=13)
Xw, Yw = X + (wa - 0.5) * 150, Y + (wb - 0.5) * 110

def g2(cx, cy, rx, ry):
    return np.exp(-(((Xw - cx) / rx) ** 2 + ((Yw - cy) / ry) ** 2))

sea = np.zeros((H, W), np.float32)
sea += 1 / (1 + np.exp(np.clip((Xw - 60) / 26, -50, 50)))      # Western Ocean
sea += 1 / (1 + np.exp(np.clip((Yw - 55) / 24, -50, 50)))      # Varn Sea (north)
sea += 1.7 * g2(700, 10, 120, 140)                             # Gulf of Ostrand
sea += 1.4 * g2(800, 975, 430, 190)                            # Inner Sea
sea += 1.2 * g2(40, 960, 300, 170)                             # southwest bight
sea += 1.3 * g2(60, 170, 140, 120)                             # Skarholm Sound
sea += 0.9 * g2(1400, 960, 120, 120)
sea -= 1.4 * gauss(965, 835, 60, 55)                           # Bressan peninsula
sea -= 1.0 * gauss(520, 40, 45, 35)                            # corridor coast
land_f = 1 - sea + 0.9 * (n_coast - 0.5) + 0.7 * (fbm(5, 22, 0.55, seed=14) - 0.5)
land = land_f > 0.5
land = ndimage.binary_opening(land, iterations=2)
lab, n = ndimage.label(land)
sizes = ndimage.sum(land, lab, range(1, n + 1))
land = lab == (int(np.argmax(sizes)) + 1)   # one continent, no islands

# ---------- elevation ----------
n_hill = fbm(6, 4, 0.5, seed=21)
n_ridge = 1 - np.abs(fbm(6, 6, 0.55, seed=22) * 2 - 1)
elev = 0.16 * n_hill + 0.55 * np.clip(fbm(6, 5, 0.55, seed=23) - 0.55, 0, 1)
Xr, Yr = X + (wa - 0.5) * 70, Y + (wb - 0.5) * 70
ridges = [
    ([(430, 655), (520, 628), (600, 640), (668, 682), (700, 745)], 42, 1.05),  # Tavian Alps
    ([(372, 375), (418, 465), (402, 560)], 38, 0.42),                          # Hollerwald
    ([(1345, 90), (1318, 340), (1358, 600), (1325, 830)], 38, 0.85),           # Kamen Range
    ([(85, 240), (125, 410)], 48, 0.38),                                       # Valden uplands
    ([(770, 625), (905, 600)], 55, 0.38),                                      # Bressan plateau
]
for pts, w, h in ridges:
    d = seg_dist(pts, Xr, Yr)
    wv = w * (0.7 + 0.8 * n_hill)
    elev += h * np.exp(-((d / wv) ** 2)) * (0.45 + 0.8 * n_ridge)
elev *= land

# ---------- regional fields ----------
n_f = fbm(6, 8, 0.6, seed=31)
n_m = fbm(5, 10, 0.6, seed=32)
n_d = fbm(6, 7, 0.55, seed=33)
n_l = fbm(5, 14, 0.55, seed=34)
forest_bias = (0.55 * gauss(860, 430, 150, 120) + 0.45 * gauss(400, 470, 90, 120)
               + 0.42 * gauss(710, 150, 120, 90) + 0.45 * gauss(1200, 170, 230, 120)
               + 0.30 * gauss(560, 600, 160, 70) + 0.25 * gauss(200, 520, 120, 120))
forest = land & (n_f + forest_bias > 0.86) & (elev < 0.62)
marsh_bias = 0.6 * gauss(960, 480, 150, 55) + 0.25 * gauss(820, 455, 90, 60)
marsh = land & (n_m + marsh_bias > 0.92) & (elev < 0.3)
desert_bias = 0.7 * gauss(860, 730, 150, 110) + 0.55 * gauss(1110, 800, 170, 100)
desert = land & (desert_bias + 1.1 * (n_d - 0.5) > 0.45) & (elev < 0.6)
lake_bias = 0.42 * gauss(690, 205, 140, 70)
lakes = land & (n_l + lake_bias > 0.9) & (elev < 0.3)
lakes |= land & (gauss(1150, 560, 34, 18) + 0.3 * (n_l - 0.5) > 0.55)   # Lake Morava
lakes = ndimage.binary_opening(lakes, iterations=1)
forest &= ~desert & ~lakes
marsh &= ~lakes

water = ~land | lakes
dist_sea = ndimage.distance_transform_edt(land) / PX          # km from sea
dist_land = ndimage.distance_transform_edt(~land) / PX
beach_bias = (gauss(820, 820, 200, 70) + gauss(520, 800, 90, 50) + gauss(40, 520, 50, 140)
              + gauss(1080, 840, 110, 60))
beach = land & (dist_sea < 3.2) & (beach_bias > 0.35) & (elev < 0.3)

# ---------- colour ----------
def hexc(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)

img = np.zeros((H, W, 3), np.float32)
img[:] = hexc("#e3e5cc")
hill = land & (elev > 0.33)
mtn = land & (elev > 0.6)
t = np.clip((elev - 0.33) / 0.3, 0, 1)[..., None]
img = np.where(hill[..., None], img * (1 - t) + hexc("#d2c7a2") * t, img)
t2 = np.clip((elev - 0.6) / 0.45, 0, 1)[..., None]
img = np.where(mtn[..., None], hexc("#c7b08c") * (1 - t2) + hexc("#a88f6c") * t2, img)
img = np.where((land & (elev > 1.0))[..., None], hexc("#efebe2"), img)
img = np.where(desert[..., None], hexc("#ecd9a6") * (0.94 + 0.12 * n_l[..., None]), img)
speck = (fbm(3, 120, 0.6, seed=41) > 0.55)[..., None]
img = np.where(forest[..., None], np.where(speck, hexc("#8faa78"), hexc("#a6bd8c")), img)
dash = ((yy.astype(int) // 3) % 4 == 0) & ((xx.astype(int) // 6 + (yy.astype(int) // 12)) % 3 != 0)
img = np.where(marsh[..., None], np.where(dash[..., None], hexc("#6f9fb0"), hexc("#cfdcc4")), img)
img = np.where(beach[..., None], hexc("#f1e2b2"), img)
# hillshade
gy, gx = np.gradient(ndimage.gaussian_filter(elev, 1.5) * 180)
lam = np.clip((-gx * 0.7 - gy * 0.7 + 1) / np.sqrt(gx ** 2 + gy ** 2 + 1), 0, 1.4)
shade = 0.9 + 0.12 * lam
img = np.where(land[..., None], img * shade[..., None], img)
# contours
step = 0.11
lvl = np.floor(np.maximum(elev - 0.3, 0) / step)
edge = (lvl != np.roll(lvl, 1, 0)) | (lvl != np.roll(lvl, 1, 1))
img = np.where((edge & land & (elev > 0.3))[..., None], img * 0.82, img)
# water
depth = np.clip(dist_land / 40, 0, 1)[..., None]
seacol = hexc("#bcd6e0") * (1 - depth) + hexc("#8db2c6") * depth
img = np.where((~land)[..., None], seacol, img)
img = np.where(lakes[..., None], hexc("#a9cbd8"), img)
coast = land & (ndimage.binary_dilation(water, iterations=1)) & ~lakes
img = np.where(coast[..., None], hexc("#5f8496"), img)
lakeedge = lakes & ndimage.binary_dilation(land & ~lakes, iterations=1)
img = np.where(lakeedge[..., None], hexc("#5f8496"), img)
# paper grain
img *= (0.97 + 0.06 * fbm(2, 300, 0.5, seed=51))[..., None]
Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(os.path.join(OUT, "terrain.jpg"), quality=84, optimize=True)

# ---------- vector helpers ----------
def is_land(x, y):
    i, j = int(y * PX), int(x * PX)
    return 0 <= i < H and 0 <= j < W and bool(land[i, j]) and not bool(lakes[i, j])

def displace(pts, amp, depth, seed):
    r = np.random.default_rng(seed)
    pts = [tuple(p) for p in pts]
    for _ in range(depth):
        new = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy) or 1
            off = (r.random() - 0.5) * amp * L
            new += [(mx - dy / L * off, my + dx / L * off), b]
        pts = new
        amp *= 0.85
    return pts

def warp_field(seed, scale=26):
    r = np.random.default_rng(seed)
    gx = ndimage.zoom(r.random((24, 36)) - 0.5, (H_KM / 24, W_KM / 36), order=3)
    gy = ndimage.zoom(r.random((24, 36)) - 0.5, (H_KM / 24, W_KM / 36), order=3)
    gx2 = ndimage.zoom(r.random((70, 110)) - 0.5, (H_KM / 70, W_KM / 110), order=3) * 0.35
    gy2 = ndimage.zoom(r.random((70, 110)) - 0.5, (H_KM / 70, W_KM / 110), order=3) * 0.35
    return (gx + gx2) * scale * 2, (gy + gy2) * scale * 2

WX, WY = warp_field(61)

def warp(p):
    x, y = p
    i, j = min(max(int(y), 0), H_KM - 1), min(max(int(x), 0), W_KM - 1)
    return (x + float(WX[i, j]), y + float(WY[i, j]))

def densify(poly, step=3):
    out = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        k = max(1, int(L / step))
        out += [(a[0] + (b[0] - a[0]) * t / k, a[1] + (b[1] - a[1]) * t / k) for t in range(k)]
    return out

# ---------- nations ----------
NATIONS = [
    dict(id="V", name="Valdenmark", side="west", tint="#3f6fb0",
         poly=[(-50, -50), (470, -50), (470, 270), (440, 420), (450, 560), (430, 640), (380, 720), (300, 960), (-50, 960)]),
    dict(id="O", name="Ostval", side="west", note="Valdenmark province, cut off by the Sarn corridor", tint="#3f6fb0",
         poly=[(560, -50), (905, -50), (900, 120), (870, 245), (565, 235)]),
    dict(id="S", name="Sarn", side="neutral", tint="#c9a64a",
         poly=[(470, -50), (560, -50), (565, 235), (870, 245), (830, 330), (700, 350), (540, 360), (445, 415), (470, 270)]),
    dict(id="A", name="Altenay", side="neutral", tint="#8a9a4a",
         poly=[(445, 415), (540, 360), (700, 350), (720, 520), (640, 560), (470, 575), (450, 560), (440, 420)]),
    dict(id="D", name="Drovia", side="neutral", tint="#5f8f6a",
         poly=[(870, 245), (950, 380), (960, 560), (820, 570), (720, 520), (700, 350), (830, 330)]),
    dict(id="T", name="Tavia", side="neutral", tint="#9a7aa0",
         poly=[(450, 560), (470, 575), (640, 560), (690, 640), (680, 760), (600, 960), (300, 960), (380, 720), (430, 640)]),
    dict(id="B", name="Bressa", side="neutral", tint="#c4834a",
         poly=[(640, 560), (720, 520), (820, 570), (960, 560), (980, 760), (1010, 960), (600, 960), (680, 760), (690, 640)]),
    dict(id="K", name="Korovia", side="east", tint="#b0463f",
         poly=[(905, -50), (1450, -50), (1450, 960), (1010, 960), (980, 760), (960, 560), (950, 380), (870, 245), (900, 120)]),
]
nat_img = Image.new("L", (W_KM, H_KM), 0)
dr = ImageDraw.Draw(nat_img)
for k, nt in enumerate(NATIONS):
    wp = [warp(p) for p in densify(nt["poly"])]
    nt["wpoly"] = wp
    dr.polygon(wp, fill=k + 1)
nat = np.array(nat_img)
nat_big = np.array(nat_img.resize((W, H), Image.NEAREST))
rgba = np.zeros((H, W, 4), np.uint8)
for k, nt in enumerate(NATIONS):
    m = (nat_big == k + 1) & land & ~lakes
    rgba[m, :3] = hexc(nt["tint"]).astype(np.uint8)
    rgba[m, 3] = 70
Image.fromarray(rgba).resize((W_KM, H_KM), Image.BILINEAR).save(os.path.join(OUT, "nations.png"), optimize=True)

def nation_at(x, y):
    i, j = min(max(int(y), 0), H_KM - 1), min(max(int(x), 0), W_KM - 1)
    k = int(nat[i, j])
    return NATIONS[k - 1]["id"] if k else None

# borders: polygon edges on land between different nations
borders = []
for nt in NATIONS:
    run = []
    wp = nt["wpoly"] + nt["wpoly"][:1]
    for p in wp:
        ok = is_land(*p) or (0 < p[0] < W_KM and 0 < p[1] < H_KM and bool(lakes[int(p[1] * PX), int(p[0] * PX)]))
        if ok and 2 < p[0] < W_KM - 2 and 2 < p[1] < H_KM - 2:
            run.append((round(p[0], 1), round(p[1], 1)))
        else:
            if len(run) > 2: borders.append(run)
            run = []
    if len(run) > 2: borders.append(run)

# ---------- rivers ----------
RIVERS = [
    ("Aller", 3, [(330, 505), (300, 400), (285, 250), (265, 120), (255, 10)]),
    ("Vesna", 3, [(470, 615), (455, 500), (470, 380), (500, 260), (515, 140), (518, 10)]),
    ("Drova", 3, [(860, 600), (840, 470), (790, 350), (760, 230), (720, 120), (690, 20)]),
    ("Kor", 4, [(1180, 60), (1160, 200), (1150, 330), (1170, 470), (1140, 620), (1110, 760), (1090, 900)]),
    ("Pripa", 2, [(800, 450), (900, 470), (1010, 480), (1100, 470), (1165, 455)]),
    ("Tavine", 2, [(600, 695), (620, 770), (640, 900)]),
    ("Sennach", 2, [(335, 560), (250, 600), (140, 610), (20, 620)]),
    ("Selva", 2, [(1320, 470), (1260, 420), (1170, 380)]),
    ("Ost", 2, [(1300, 700), (1220, 760), (1140, 700)]),
]
rivers = []
for k, (nm, order, pts) in enumerate(RIVERS):
    p = displace(pts, 0.35, 5, seed=100 + k)
    out = []
    for q in p:
        out.append(q)
        if len(out) > 8 and not is_land(*q) and not lakes[min(int(q[1] * PX), H - 1), min(int(q[0] * PX), W - 1)]:
            break
    rivers.append(dict(name=nm, order=order, pts=[(round(a, 1), round(b, 1)) for a, b in out]))

# ---------- cities ----------
CITIES = [
    # name, x, y, nation-hint, kind (capital|city|port), pop-class 1..3
    ("Halden", 220, 330, "capital", 3), ("Brennhaven", 258, 52, "port", 2), ("Westerkai", 62, 560, "port", 2),
    ("Ulmsted", 320, 560, "city", 2), ("Freyburg", 375, 210, "city", 2), ("Kessling", 165, 720, "city", 1),
    ("Saarholt", 405, 300, "city", 1),
    ("Ostrand", 695, 75, "port", 2), ("Varnholm", 820, 175, "city", 1),
    ("Port Vesna", 517, 56, "port", 2), ("Sarnow", 690, 300, "capital", 2), ("Tarnek", 548, 330, "city", 1),
    ("Vellach", 590, 455, "capital", 2), ("Pellin", 505, 520, "city", 1),
    ("Drovsk", 880, 420, "capital", 2), ("Mirovo", 760, 395, "city", 1),
    ("Tavianne", 560, 712, "capital", 2), ("Calder", 520, 790, "port", 1),
    ("Bressane", 805, 690, "capital", 2), ("Port Aurel", 760, 818, "port", 1), ("Zerin", 925, 640, "city", 1),
    ("Korograd", 1225, 380, "capital", 3), ("Severomark", 1110, 46, "port", 2), ("Yuzhny", 1072, 848, "port", 2),
    ("Belov", 1040, 250, "city", 2), ("Rodnik", 1020, 600, "city", 1), ("Tverdin", 1265, 640, "city", 2),
    ("Volzhin", 1190, 720, "city", 1), ("Lesnaya", 1260, 170, "city", 1),
]
cities = []
for nm, x, y, kind, pc in CITIES:
    if kind == "port":   # snap to coast: nearest land pixel within 2 km of sea
        best = None
        for r_ in range(0, 160):
            for a in np.linspace(0, 2 * np.pi, 24, endpoint=False):
                qx, qy = x + r_ * math.cos(a), y + r_ * math.sin(a)
                if is_land(qx, qy) and dist_sea[int(qy * PX), int(qx * PX)] < 2.5:
                    best = (qx, qy); break
            if best: break
        if not best: raise SystemExit(f"port {nm} found no coast")
        x, y = best
    elif not is_land(x, y):
        raise SystemExit(f"city {nm} is in water")
    cities.append(dict(name=nm, x=round(x, 1), y=round(y, 1), kind=kind, size=pc, nation=nation_at(x, y)))
C = {c["name"]: c for c in cities}

RAIL = [
    ("Brennhaven", "Freyburg"), ("Freyburg", "Halden"), ("Halden", "Westerkai"), ("Halden", "Ulmsted"),
    ("Halden", "Saarholt"), ("Saarholt", "Tarnek"), ("Tarnek", "Sarnow"),
    ("Sarnow", "Varnholm"), ("Varnholm", "Ostrand"), ("Freyburg", "Port Vesna"), ("Port Vesna", "Ostrand"),
    ("Ulmsted", "Pellin"), ("Pellin", "Vellach"), ("Vellach", "Mirovo"), ("Mirovo", "Drovsk"),
    ("Drovsk", "Belov"), ("Belov", "Korograd"), ("Belov", "Severomark"), ("Korograd", "Lesnaya"),
    ("Korograd", "Tverdin"), ("Tverdin", "Volzhin"), ("Volzhin", "Yuzhny"), ("Rodnik", "Korograd"),
    ("Zerin", "Rodnik"), ("Bressane", "Zerin"), ("Bressane", "Port Aurel"), ("Vellach", "Tavianne"),
    ("Tavianne", "Calder"), ("Sarnow", "Vellach"), ("Varnholm", "Belov"),
]
ROADS = [
    ("Halden", "Kessling"), ("Westerkai", "Kessling"), ("Ulmsted", "Tavianne"), ("Pellin", "Tavianne"),
    ("Saarholt", "Freyburg"), ("Tarnek", "Port Vesna"), ("Tarnek", "Vellach"), ("Mirovo", "Sarnow"),
    ("Drovsk", "Zerin"), ("Drovsk", "Rodnik"), ("Vellach", "Bressane"), ("Tavianne", "Bressane"),
    ("Rodnik", "Volzhin"), 
    ("Varnholm", "Drovsk"), ("Belov", "Sarnow"), ("Tverdin", "Lesnaya"), ("Zerin", "Yuzhny"),
    ("Ostrand", "Sarnow"), ("Brennhaven", "Halden"),
]

VIA = {("Port Vesna", "Ostrand"): [(565, 105), (625, 112)]}

def route(a, b, seed, amp=0.12):
    pts = [(C[a]["x"], C[a]["y"])] + VIA.get((a, b), []) + [(C[b]["x"], C[b]["y"])]
    return [(round(x, 1), round(y, 1)) for x, y in displace(pts, amp, 4 if len(pts) == 2 else 3, seed)]

rails = [dict(a=a, b=b, pts=route(a, b, 300 + k)) for k, (a, b) in enumerate(RAIL)]
FERRY_VIA = {}
ferries = []
for (a, b), via in FERRY_VIA.items():
    pts = [(C[a]["x"], C[a]["y"])] + via + [(C[b]["x"], C[b]["y"])]
    dense = displace(pts, 0.05, 2, 900)
    wet = [p for p in dense[2:-2] if is_land(*p)]
    if wet: print("WARN ferry over land", a, b, wet[:3])
    ferries.append(dict(a=a, b=b, pts=[(round(x, 1), round(y, 1)) for x, y in dense]))
roads = [dict(a=a, b=b, pts=route(a, b, 500 + k, 0.2)) for k, (a, b) in enumerate(ROADS)]

def seg_x(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-9: return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    if 0 <= t <= 1 and 0 <= u <= 1:
        return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))

bridges = []
for kind, lines in (("rail", rails), ("road", roads)):
    for ln in lines:
        for rv in rivers:
            for p1, p2 in zip(ln["pts"][:-1], ln["pts"][1:]):
                for p3, p4 in zip(rv["pts"][:-1], rv["pts"][1:]):
                    q = seg_x(p1, p2, p3, p4)
                    if q:
                        ang = math.degrees(math.atan2(p2[1] - p1[1], p2[0] - p1[0]))
                        bridges.append(dict(x=round(q[0], 1), y=round(q[1], 1), kind=kind, river=rv["name"],
                                            line=f'{ln["a"]}-{ln["b"]}', angle=round(ang, 1)))

# terrain under each rail segment, for warnings
for ln in rails + roads:
    for x, y in ln["pts"]:
        if not is_land(x, y):
            print("WARN line over water", ln["a"], ln["b"], x, y); break

LABELS = dict(
    seas=[("Western Ocean", 26, 380, 90), ("Varn Sea", 400, 22, 0), ("Gulf of Ostrand", 660, 30, 0),
          ("Inner Sea", 790, 872, 0)],
    features=[("Tavian Alps", 575, 655, 8), ("Hollerwald", 395, 430, 70), ("Kamen Range", 1345, 480, 86),
              ("Drovian Marshes", 965, 505, 0), ("Bressan Waste", 870, 755, 0), ("Ostval Lakes", 690, 210, 0),
              ("Sarn Corridor", 518, 175, 90), ("Lake Morava", 1150, 588, 0),
              ("Red Steppe", 1120, 805, 0)],
    nations=[("VALDENMARK", 190, 450), ("OSTVAL", 760, 130), ("SARN", 640, 270), ("ALTENAY", 600, 410),
             ("DROVIA", 830, 515), ("TAVIA", 535, 590), ("BRESSA", 860, 600), ("KOROVIA", 1150, 300)],
)
passes = [dict(name="Sennen Pass", x=None, y=None)]
# pass = where Vellach-Tavianne rail crosses highest ground
best = (0, None)
for x, y in rails[[r["a"] + r["b"] for r in rails].index("VellachTavianne")]["pts"]:
    e = float(elev[int(y * PX), int(x * PX)])
    if e > best[0]: best = (e, (x, y))
passes[0]["x"], passes[0]["y"] = best[1]

terrain_area = {k: round(float(v.sum()) / PX / PX) for k, v in dict(
    land=land, forest=forest, marsh=marsh, desert=desert, lakes=lakes, mountains=mtn, hills=hill & ~mtn).items()}

data = dict(
    title="Sample continent", units="km", width=W_KM, height=H_KM,
    rasters=dict(terrain="terrain.jpg", nations="nations.png", px_per_km=PX),
    terrain_classes=["sea", "lake", "clear", "hills", "mountains", "forest", "marsh", "desert", "beach"],
    terrain_area_km2=terrain_area,
    nations=[dict(id=n["id"], name=n["name"], side=n["side"], tint=n["tint"], note=n.get("note", ""),
                  poly=[(round(x, 1), round(y, 1)) for x, y in n["wpoly"][::2]],
                  capital=next((c["name"] for c in cities if c["nation"] == n["id"] and c["kind"] == "capital"), None))
             for n in NATIONS],
    borders=borders, rivers=rivers, cities=cities, rail=rails, roads=roads, ferries=ferries, bridges=bridges, passes=passes,
    labels=LABELS,
)
with open(os.path.join(OUT, "map.json"), "w") as f:
    json.dump(data, f, separators=(",", ":"))
print("bridges", len(bridges), "borders", len(borders), "area", terrain_area)
print({c["name"]: c["nation"] for c in cities})

# ---------- engine export: 1 km cells, the France engine's terrain codes ----------
# Codes as in engine/src/map.js: OPEN 0, LF 1, HF 2, HILL 3, MTN 4, DESERT 6, BEACH 8, MARSH 9, SEA 12, RIVER 13 (lakes: impassable water)
import gzip
ENG = os.path.join(os.path.dirname(__file__), "..", "..", "data", "terrain")
os.makedirs(ENG, exist_ok=True)
code = np.zeros((H, W), np.uint8)                                        # OPEN
code[land & (elev > 0.33)] = 3                                          # HILL
heavy = forest & (n_f + forest_bias > 1.0)
code[forest] = 1; code[heavy] = 2                                       # LF, HF
code[land & (elev > 0.6)] = 4                                           # MTN
code[desert] = 6; code[marsh] = 9; code[beach] = 8
code[lakes] = 13; code[~land] = 12
def down(a, how):
    b = a.reshape(H // PX, PX, W // PX, PX).transpose(0, 2, 1, 3).reshape(H // PX, W // PX, PX * PX)
    return how(b)
def mode_cell(b):
    out = np.zeros(b.shape[:2], np.uint8)
    sea_n = (b == 12).sum(-1); lake_n = (b == 13).sum(-1)
    best = np.zeros(b.shape[:2], np.int32) - 1; bestv = np.zeros(b.shape[:2], np.uint8)
    for v in (0, 1, 2, 3, 4, 6, 8, 9):
        n = (b == v).sum(-1)
        sel = n > best; best[sel] = n[sel]; bestv[sel] = v
    out[:] = bestv
    out[lake_n * 2 > PX * PX] = 13
    out[sea_n * 2 >= PX * PX] = 12
    return out
tc = down(code, mode_cell)
el_m = np.where(land, 30 + elev * 1400, -8).astype(np.float32)
ec = down(el_m, lambda b: b.mean(-1)).round().astype(np.int16)
with gzip.open(os.path.join(ENG, "terrain.u8.gz"), "wb") as f: f.write(tc.tobytes())
with gzip.open(os.path.join(ENG, "elev.i16.gz"), "wb") as f: f.write(ec.tobytes())
names = {0: "OPEN", 1: "LF", 2: "HF", 3: "HILL", 4: "MTN", 6: "DESERT", 8: "BEACH", 9: "MARSH", 12: "SEA", 13: "RIVER"}
hist = {names[int(k)]: int(v) for k, v in zip(*np.unique(tc, return_counts=True))}
with open(os.path.join(ENG, "grid.json"), "w") as f:
    json.dump(dict(w=W_KM, h=H_KM, cs=1, codes="engine/src/map.js T", elev="metres, int16; sea -8", hist=hist), f)
with open(os.path.join(ENG, "..", "map.json"), "w") as f:
    json.dump(data, f, separators=(",", ":"))
print("engine grid", tc.shape, hist)
