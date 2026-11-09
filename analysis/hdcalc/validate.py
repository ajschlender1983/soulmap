import json, sys
sys.path.insert(0, ".")
from hdcalc.core import compute_chart

def act(ch, side):
    return {k: f"{v['gate']}.{v['line']}" for k, v in ch[side].items()}

cases = [
 ("Ra Uru Hu 1948-04-09 00:05 Montreal", dict(date="1948-04-09", time="00:05", tz="America/Toronto", lat=45.5017, lon=-73.5673),
   dict(type="Manifestor", profile="5/1", authority="Splenic", definition="Single Definition",
        channels={"23-43","20-57","10-20","10-57","25-51"}, cross_gates=[51,57,61,62], angle="Left Angle",
        centers={"Ajna","Throat","G","Heart","Spleen"})),
 ("Oprah 1954-01-29 04:30 CST", dict(date="1954-01-29", time="04:30", tz="America/Chicago", lat=33.06, lon=-89.59),
   dict(type="Generator", profile="2/4", authority="Emotional", definition="Triple Split Definition",
        channels={"19-49","24-61","29-46","34-57"}, cross="19.2/33.2 | 44.4/24.4", cross_name="Right Angle Cross of the Four Ways", ncenters=7,
        design={"Sun":"44.4","Earth":"24.4","Moon":"18.4","North Node":"60.2","South Node":"56.2","Mercury":"34.1","Venus":"57.6","Mars":"46.4","Jupiter":"12.4","Saturn":"50.6","Uranus":"62.3","Neptune":"32.4","Pluto":"29.1"},
        personality={"Sun":"19.2","Earth":"33.2","Moon":"34.5","North Node":"61.4","South Node":"62.4","Mercury":"49.1","Venus":"19.2","Mars":"43.6","Jupiter":"35.6","Saturn":"44.2","Uranus":"53.6","Neptune":"32.6","Pluto":"4.6"})),
 ("Trump 1946-06-14 10:54 EDT", dict(date="1946-06-14", time="10:54", tz="America/New_York", lat=40.73, lon=-73.79),
   dict(type="Manifesting Generator", profile="1/3", authority="Emotional", definition="Single Definition",
        channels={"17-62","21-45","35-36","6-59"}, cross="12.1/11.1 | 36.3/6.3", cross_name="Right Angle Cross of Eden",
        design={"Sun":"36.3","Earth":"6.3","Moon":"59.6","North Node":"12.4","South Node":"11.4","Mercury":"21.1","Venus":"17.2","Mars":"53.2","Jupiter":"32.6","Saturn":"53.4","Uranus":"35.3","Neptune":"18.4","Pluto":"33.3"},
        personality={"Sun":"12.1","Earth":"11.1","Moon":"26.5","North Node":"45.5","South Node":"26.5","Mercury":"52.6","Venus":"62.6","Mars":"29.3","Jupiter":"57.3","Saturn":"62.4","Uranus":"45.1","Neptune":"18.3","Pluto":"33.3"})),
 ("SharpAstrology 2024-01-01 00:00 UTC", dict(date="2024-01-01", time="00:00", tz="UTC", lat=0, lon=0),
   dict(type="Generator", profile="1/3", authority="Emotional", definition="Split Definition",
        channels={"29-46","39-55"}, cross_name="Right Angle Cross of Tension")),
 ("Einstein 1879-03-14 11:30 Ulm", dict(date="1879-03-14", time="11:30", tz="Europe/Berlin", lat=48.3985, lon=9.9912),
   dict(type="Generator", profile="1/4", authority="Emotional", definition="Split Definition", cross_name="Right Angle Cross of Eden")),
]
fails = 0
for label, inp, exp in cases:
    ch = compute_chart(**inp)
    got = dict(type=ch["type"], profile=ch["profile"]["value"], authority=ch["authority"], definition=ch["definition"],
               channels={f"{a}-{b}" for a, b in (c["gates"] for c in ch["channels"])},
               cross=ch["incarnation_cross"]["notation"], cross_name=ch["incarnation_cross"]["name"],
               cross_gates=ch["incarnation_cross"]["gates"], angle=ch["incarnation_cross"]["angle"],
               centers={c for c, v in ch["centers"].items() if v["defined"]},
               ncenters=sum(v["defined"] for v in ch["centers"].values()),
               design=act(ch, "design"), personality=act(ch, "personality"))
    print(f"\n== {label}  (birth {ch['times']['birth_utc']}, design {ch['times']['design_utc']})")
    for k, v in exp.items():
        g = got[k]
        if k == "cross_gates": ok = sorted(g) == sorted(v)
        elif k == "cross_name": ok = g.startswith(v)
        elif k == "centers": ok = set(v) <= g
        elif isinstance(v, dict): ok = all(g[p] == v[p] for p in v); diff = {p: (g[p], v[p]) for p in v if g[p] != v[p]}
        else: ok = g == v
        fails += not ok
        print(f"  {'OK  ' if ok else 'FAIL'} {k}: got {diff if (isinstance(v, dict) and not ok) else g}" + ("" if ok or isinstance(v, dict) else f"  expected {v}"))
print("\nFAILS:", fails)
