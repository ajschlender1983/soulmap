# Restyling the Soul Map

For a designer bringing their own style guide. You can do all of this with your own Claude (Claude Code).

## Get it running

1. Install it once with the line on https://soulmap.nextmissionsi.com (about 5 minutes). It opens at http://localhost:3355/soul.
2. To edit with live reload, work in a copy of this repo:
   ```bash
   git clone https://github.com/maximilian-dollaz/soulmap.git
   cd soulmap/app && npm install && npx next dev
   ```
   Then open http://localhost:3000/soul. Go through onboarding once so every screen has something on it.

## Where the design lives

| What | Where |
|---|---|
| Colors, fonts, type sizes, spacing, corner radii | `app/app/globals.css`, the `@theme` block at the top (the tokens) |
| Buttons, cards, chips, fields, labels | `app/app/globals.css`, the classes below the tokens (`.btn`, `.card`, `.chip`, `.field`, `.t-label` …) |
| Font loading | `app/app/layout.tsx` |
| Screens | `app/app/<screen>/page.tsx`: `onboarding`, `map`, `report`, `soul-file`, `energy`, `evidence`, `team`, `peer`; the interview is `app/components/Interview.tsx` |
| Shared pieces | `app/components/` (icons, the map drawing, pickers, sheets) |
| Website | `site/index.html` (its own small stylesheet) |

Map your style guide onto the tokens first; most of the look follows from them. A few colors are still written directly into screens (search for `#` in `app/app` and `app/components`); move them into tokens as you go.

## Keep

- Light and dark themes both work. Check every screen in both.
- Phone first: one-hand use, tap targets at least 44 px, nothing wider than the screen.
- Words on screen stay as they are unless the owner approves a change. Restyle, don't rewrite.
- Leave the logic alone: `app/lib/`, `app/app/api/`, `evidence/`, `analysis/`.

## Send it back

Work on a branch and open a pull request against `main`. With your own Claude, paste this:

> Fork and clone github.com/maximilian-dollaz/soulmap. Read STYLE.md. Apply our style guide (attached) to the Soul Map: tokens in app/app/globals.css first, then each screen in app/app and app/components. Keep both themes working and don't change any on-screen wording or anything in app/lib, app/app/api, evidence or analysis. Run it with `npx next dev` in app/ and check every screen at phone width in light and dark. Then open a pull request with before-and-after screenshots.

The owner reviews it, it is tested on a copy, and it goes live after their yes.
