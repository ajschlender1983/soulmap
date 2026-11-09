# hdcalc — Human Design + Gene Keys calculator (offline CLI)

Given birth date, local time, IANA timezone and lat/lon, prints one JSON chart.
No network calls at runtime. Ephemeris: `pyswisseph` with the bundled Moshier
model (no ephemeris files needed). Tropical longitudes, true lunar node.

```
cd soul-map/analysis/hdcalc
uv run hdcalc --date 1990-05-12 --time 14:35 --tz America/Los_Angeles --lat 34.05 --lon -118.24
uv run hdcalc ... --compact        # single-line JSON
```

Layout: `hdcalc/core.py` (pure functions), `hdcalc/tables.py` (all lookup
tables), `hdcalc/__main__.py` (argparse CLI). `compute_chart()` is importable.

## What is computed

- **Personality** = positions at birth. **Design** = positions when the Sun was
  exactly 88.0° of solar longitude earlier (solved by Newton iteration on the
  Sun's longitude, converges to <1e-9°).
- Bodies: Sun, Earth (Sun+180°), Moon, North/South Node (true node), Mercury,
  Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto.
- Longitude → gate/line/color/tone/base. Wheel starts at 302.0° (2°00' Aquarius,
  gate 41); 64 gates × 5.625°, 6 lines × 0.9375°, half-open intervals.
- Defined gates, the 36 channels, 9 centers, Type, Strategy, Signature,
  Not-self theme, Authority, Profile, Definition (single/split/triple/quad/none),
  Incarnation Cross (angle from profile; gate quartet; full names for all 16
  Right Angle crosses).
- Gene Keys: Activation, Venus and Pearl sequences with Shadow/Gift/Siddhi for
  all 64 keys.

### Rules used

- Type: Sacral defined → Generator, or Manifesting Generator if a motor
  (Sacral/Heart/Solar Plexus/Root) is connected to the Throat through defined
  channels. No Sacral: motor-to-Throat → Manifestor; any definition → Projector;
  none → Reflector.
- Authority, in priority order: Solar Plexus → Emotional; Sacral → Sacral;
  Spleen → Splenic; Heart → Ego; G → Self-Projected; otherwise Mental
  (Environmental); Reflector → Lunar.
- Cross angle: 1/3 1/4 2/4 2/5 3/5 3/6 4/6 = Right Angle; 4/1 = Juxtaposition;
  5/1 5/2 6/2 6/3 = Left Angle.

### Gene Keys sphere mapping (source: genekeys.com)

From https://genekeys.com/resource/astrology/ (corroborated by
kellyharringtonrd.com and beyonduality.com, which quote the same table):

| Sequence | Sphere | Planet |
|---|---|---|
| Activation | Life's Work | Personality Sun |
| | Evolution | Personality Earth |
| | Radiance | Design Sun |
| | Purpose | Design Earth |
| Venus | Attraction | Design Moon |
| | IQ | Personality Venus |
| | EQ | Personality Mars |
| | SQ | Design Venus |
| | Core Wound | Design Mars |
| Pearl | Vocation | Design Mars (same key as Core Wound) |
| | Culture | Design Jupiter |
| | Brand | Personality Sun (same key as Life's Work) |
| | Pearl | Personality Jupiter |

Note: the task brief guessed EQ = Design Venus and SQ = Personality Mars; the
published Gene Keys table has EQ = Personality Mars and SQ = Design Venus, which
is what this code uses.

## Validation

`uv run python validate.py` runs five public charts against published expectations.
Every asserted field matched.

| Chart | Birth data (public) | Source of expected values | Fields matched |
|---|---|---|---|
| Ra Uru Hu | 1948-04-09 00:05, Montreal, America/Toronto | pejtr/humandesignchart and Unforced-Dev/natalengine test suites (both cite humandesignsystem.com archive chart) | Type Manifestor, Profile 5/1, Authority Splenic, Single Definition, channels 23-43 20-57 10-20 10-57 25-51, cross gates 51/57/61/62 Left Angle, defined centers Ajna/Throat/G/Heart/Spleen |
| Oprah Winfrey | 1954-01-29 04:30 CST, Kosciusko MS | Mr-Mastrianni/cipher test fixture ("26 activations match the published table") | All 26 gate.line activations (13 personality + 13 design), Generator, 2/4, Emotional, Triple Split, channels 19-49 24-61 29-46 34-57, 7 defined centers, RAX of the Four Ways 19.2/33.2 \| 44.4/24.4 |
| Donald Trump | 1946-06-14 10:54 EDT, Queens NY | same fixture | All 26 activations, Manifesting Generator, 1/3, Emotional, Single, channels 17-62 21-45 35-36 6-59, RAX of Eden 12.1/11.1 \| 36.3/6.3 |
| SharpAstrology README sample | 2024-01-01 00:00 UTC | CReizner/SharpAstrology.HumanDesign README | Generator, 1/3, Emotional, Split, channels 29-46 39-55, RAX of Tension |
| Albert Einstein | 1879-03-14 11:30, Ulm (LMT via Europe/Berlin) | pejtr/humandesignchart test | Generator, 1/4, Emotional, Split, RAX of Eden |

Not validated (no reference data found): color/tone/base sub-line values,
Left Angle and Juxtaposition cross *names* (only gate lists are emitted for
those; the Right Angle names are validated via Oprah/Trump/Tension), and the
Gene Keys sphere output beyond the planet mapping itself (it is a direct
lookup of validated gate.line values).

Known limits: cross names for Left Angle / Juxtaposition are emitted as
"Left Angle Cross of 51/57/61/62" rather than "of the Clarion"; the variant
number on Right Angle crosses (e.g. "Eden 2") is omitted. Births during the
first/last minute of a gate boundary are sensitive to the exact time, as in
every HD calculator.
