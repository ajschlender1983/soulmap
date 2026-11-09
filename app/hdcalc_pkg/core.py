"""Pure chart computation. Everything here is deterministic and offline (Moshier ephemeris)."""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import swisseph as swe

from . import tables as T

FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED
PLANET_IDS = [
    ("Sun", swe.SUN), ("Moon", swe.MOON), ("North Node", swe.TRUE_NODE),
    ("Mercury", swe.MERCURY), ("Venus", swe.VENUS), ("Mars", swe.MARS),
    ("Jupiter", swe.JUPITER), ("Saturn", swe.SATURN), ("Uranus", swe.URANUS),
    ("Neptune", swe.NEPTUNE), ("Pluto", swe.PLUTO),
]
PLANET_ORDER = ["Sun", "Earth", "Moon", "North Node", "South Node", "Mercury", "Venus",
                "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]
DESIGN_ARC = 88.0


# ---------------------------------------------------------------- time helpers
def local_to_utc(date: str, time: str, tz: str) -> datetime:
    local = datetime.fromisoformat(f"{date}T{time}").replace(tzinfo=ZoneInfo(tz))
    return local.astimezone(timezone.utc)


def utc_to_jd(dt: datetime) -> float:
    h = dt.hour + dt.minute / 60 + dt.second / 3600 + dt.microsecond / 3.6e9
    return swe.julday(dt.year, dt.month, dt.day, h, swe.GREG_CAL)


def jd_to_utc(jd: float) -> datetime:
    y, m, d, h = swe.revjul(jd, swe.GREG_CAL)
    secs = round(h * 3600)
    return datetime(y, m, d, tzinfo=timezone.utc).replace(
        hour=secs // 3600, minute=(secs % 3600) // 60, second=secs % 60)


# ---------------------------------------------------------------- ephemeris
def _lon_speed(jd: float, body: int) -> tuple[float, float]:
    xx, _ = swe.calc_ut(jd, body, FLAGS)
    return xx[0] % 360.0, xx[3]


def sun_longitude(jd: float) -> float:
    return _lon_speed(jd, swe.SUN)[0]


def design_jd(birth_jd: float) -> float:
    """Julian day when the Sun was exactly DESIGN_ARC degrees behind its birth longitude."""
    target = (sun_longitude(birth_jd) - DESIGN_ARC) % 360.0
    jd = birth_jd - DESIGN_ARC  # ~1 deg/day first guess
    for _ in range(50):
        lon, speed = _lon_speed(jd, swe.SUN)
        diff = (lon - target + 180.0) % 360.0 - 180.0
        if abs(diff) < 1e-9:
            break
        jd -= diff / speed
    return jd


def positions(jd: float) -> dict[str, float]:
    """Tropical ecliptic longitudes for all 13 Human Design bodies."""
    out = {name: _lon_speed(jd, body)[0] for name, body in PLANET_IDS}
    out["Earth"] = (out["Sun"] + 180.0) % 360.0
    out["South Node"] = (out["North Node"] + 180.0) % 360.0
    return {k: out[k] for k in PLANET_ORDER}


# ---------------------------------------------------------------- wheel mapping
def gate_line(lon: float) -> dict:
    """Longitude -> gate, line, color, tone, base (half-open intervals, floor never round)."""
    x = (lon - T.WHEEL_START) % 360.0
    idx = int(x // T.GATE_ARC)
    rem = x - idx * T.GATE_ARC
    line = int(rem // T.LINE_ARC)
    rem -= line * T.LINE_ARC
    color = int(rem // (T.LINE_ARC / 6))
    rem -= color * (T.LINE_ARC / 6)
    tone = int(rem // (T.LINE_ARC / 36))
    rem -= tone * (T.LINE_ARC / 36)
    base = int(rem // (T.LINE_ARC / 180))
    return {"gate": T.GATE_ORDER[idx], "line": line + 1, "color": color + 1,
            "tone": tone + 1, "base": base + 1}


def activations(jd: float) -> dict[str, dict]:
    out = {}
    for name, lon in positions(jd).items():
        gl = gate_line(lon)
        out[name] = {"longitude": round(lon, 6), **gl,
                     "name": T.GATE_NAMES[gl["gate"]],
                     "center": T.GATE_CENTER[gl["gate"]]}
    return out


# ---------------------------------------------------------------- body graph
def defined_channels(gates: set[int]) -> list[tuple[int, int]]:
    return [pair for pair in T.CHANNELS if pair[0] in gates and pair[1] in gates]


def center_graph(channels: list[tuple[int, int]]) -> dict[str, set[str]]:
    graph: dict[str, set[str]] = {}
    for a, b in channels:
        ca, cb = T.GATE_CENTER[a], T.GATE_CENTER[b]
        graph.setdefault(ca, set()).add(cb)
        graph.setdefault(cb, set()).add(ca)
    return graph


def components(graph: dict[str, set[str]]) -> list[set[str]]:
    seen: set[str] = set()
    comps = []
    for start in graph:
        if start in seen:
            continue
        comp, stack = set(), [start]
        while stack:
            n = stack.pop()
            if n in comp:
                continue
            comp.add(n)
            stack.extend(graph[n] - comp)
        seen |= comp
        comps.append(comp)
    return comps


def definition_label(n: int) -> str:
    return {0: "No Definition", 1: "Single Definition", 2: "Split Definition",
            3: "Triple Split Definition", 4: "Quadruple Split Definition"}[n]


def hd_type(graph: dict[str, set[str]], comps: list[set[str]]) -> str:
    defined = set(graph)
    if not defined:
        return "Reflector"
    throat_comp = next((c for c in comps if "Throat" in c), set())
    motor_to_throat = bool(throat_comp & T.MOTORS)
    if "Sacral" in defined:
        return "Manifesting Generator" if motor_to_throat else "Generator"
    if motor_to_throat:
        return "Manifestor"
    return "Projector"


def authority(defined: set[str], hd_type_: str) -> str:
    if hd_type_ == "Reflector":
        return "Lunar"
    for center, label in [("Solar Plexus", "Emotional"), ("Sacral", "Sacral"),
                          ("Spleen", "Splenic"), ("Heart", "Ego"), ("G", "Self-Projected")]:
        if center in defined:
            return label
    return "Mental (Environmental)"


def cross_angle(profile: str) -> str:
    if profile in T.RIGHT_ANGLE_PROFILES:
        return "Right Angle"
    if profile in T.JUXTAPOSITION_PROFILES:
        return "Juxtaposition"
    return "Left Angle"


# ---------------------------------------------------------------- full chart
def compute_chart(date: str, time: str, tz: str, lat: float, lon: float) -> dict:
    birth_utc = local_to_utc(date, time, tz)
    bjd = utc_to_jd(birth_utc)
    djd = design_jd(bjd)
    pers, des = activations(bjd), activations(djd)

    p_gates = {a["gate"] for a in pers.values()}
    d_gates = {a["gate"] for a in des.values()}
    all_gates = p_gates | d_gates
    channels = defined_channels(all_gates)
    graph = center_graph(channels)
    comps = components(graph)
    defined = set(graph)
    type_ = hd_type(graph, comps)
    strategy, signature, not_self = T.TYPE_INFO[type_]

    profile = f"{pers['Sun']['line']}/{des['Sun']['line']}"
    angle = cross_angle(profile)
    cross_gates = [pers["Sun"]["gate"], pers["Earth"]["gate"], des["Sun"]["gate"], des["Earth"]["gate"]]
    cross_str = (f"{pers['Sun']['gate']}.{pers['Sun']['line']}/{pers['Earth']['gate']}.{pers['Earth']['line']}"
                 f" | {des['Sun']['gate']}.{des['Sun']['line']}/{des['Earth']['gate']}.{des['Earth']['line']}")
    ra_name = T.RA_CROSS_BY_SUN_GATE[pers["Sun"]["gate"]] if angle == "Right Angle" else None
    cross_name = (f"Right Angle Cross of {ra_name}" if ra_name
                  else f"{angle} Cross of {'/'.join(map(str, cross_gates))}")

    def sphere(side, planet):
        a = (pers if side == "personality" else des)[planet]
        sh, gi, si = T.GENE_KEYS[a["gate"]]
        return {"key": a["gate"], "line": a["line"], "label": f"{a['gate']}.{a['line']}",
                "source": f"{side} {planet}", "shadow": sh, "gift": gi, "siddhi": si}

    gene_keys = {seq: {name: sphere(side, planet) for name, side, planet in spheres}
                 for seq, spheres in T.GENE_KEY_SPHERES.items()}

    return {
        "input": {"date": date, "time": time, "tz": tz, "lat": lat, "lon": lon},
        "times": {"birth_utc": birth_utc.isoformat(), "design_utc": jd_to_utc(djd).isoformat(),
                  "birth_jd": round(bjd, 6), "design_jd": round(djd, 6),
                  "design_arc_deg": DESIGN_ARC, "ephemeris": "Swiss Ephemeris (Moshier), tropical, true node"},
        "type": type_, "strategy": strategy, "signature": signature, "not_self_theme": not_self,
        "authority": authority(defined, type_),
        "profile": {"value": profile, "name": T.PROFILES.get(profile, "non-harmonic")},
        "definition": definition_label(len(comps)),
        "incarnation_cross": {"name": cross_name, "angle": angle, "gates": cross_gates,
                              "notation": cross_str},
        "centers": {c: {"defined": c in defined, "keynote": T.CENTER_KEYNOTES[c],
                        "gates": sorted(all_gates & set(gs))} for c, gs in T.CENTERS.items()},
        "channels": [{"gates": list(pair), "name": T.CHANNELS[pair],
                      "centers": [T.GATE_CENTER[pair[0]], T.GATE_CENTER[pair[1]]]} for pair in channels],
        "gates": {"defined": sorted(all_gates), "personality": sorted(p_gates), "design": sorted(d_gates),
                  "names": {g: T.GATE_NAMES[g] for g in sorted(all_gates)}},
        "personality": pers,
        "design": des,
        "gene_keys": gene_keys,
    }
