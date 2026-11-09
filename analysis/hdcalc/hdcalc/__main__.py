"""CLI: uv run hdcalc --date 1990-05-12 --time 14:35 --tz America/Los_Angeles --lat 34.05 --lon -118.24"""

import argparse
import json
import sys

from .core import compute_chart


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="hdcalc", description="Human Design + Gene Keys chart as JSON (offline).")
    p.add_argument("--date", required=True, help="Birth date, YYYY-MM-DD (local)")
    p.add_argument("--time", required=True, help="Birth time, HH:MM or HH:MM:SS (local)")
    p.add_argument("--tz", default="UTC", help="IANA timezone of the birth place, e.g. America/Los_Angeles")
    p.add_argument("--lat", type=float, default=0.0, help="Birth latitude (recorded in output only)")
    p.add_argument("--lon", type=float, default=0.0, help="Birth longitude (recorded in output only)")
    p.add_argument("--compact", action="store_true", help="Single-line JSON")
    a = p.parse_args(argv)
    try:
        chart = compute_chart(a.date, a.time, a.tz, a.lat, a.lon)
    except Exception as e:  # noqa: BLE001
        print(f"hdcalc: {e}", file=sys.stderr)
        return 1
    print(json.dumps(chart, indent=None if a.compact else 2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
