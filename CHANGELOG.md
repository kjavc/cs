# Change Log & Handoff

Newest first. Each entry: what changed, why, and anything left open. Read the **Handoff** section first when picking up work in a new session.

---

## Handoff (current state)

- **Branches:** `main` holds everything. `gh-pages` serves the live app and is only updated by `npm run deploy` (builds and publishes `build/` via the `gh-pages` package). Merging to `main` does **not** update the live site.
- **Project notes:** `CLAUDE.md` (architecture, rules, conventions). Specs live in `docs/` (`spec-block-fit.md`, `spec-smart-split.md`, `spec-schedule-splitter.md`, `spec-schedule-roll.md`).
- **Tests:** `CI=true npx react-scripts test --watchAll=false`. `src/App.test.tsx` is the CRA boilerplate test and fails (`window.matchMedia` isn't defined in jsdom). It failed before Block Fit; everything else passes.
- **Lockfile:** `npm ci` fails because `package-lock.json` is out of sync (`yaml@2.9.1` missing). `npm install` works; the lockfile hasn't been regenerated in these changes.

### Open items
1. **Block schedule, 12-week 4-hour MTWR early slot.** Sheet says 6:45–7:45; scheduling said 6:45–7:50, but that's 65 min in a 75-min column (8:00–9:15, …). Left out of `block-schedule.json` (`excluded`) until settled — likely 6:30–7:45 or 6:45–8:00.
2. **"1.5 weeks under" for short sessions** is measured from the target (catalog − 1 week), giving 54 hrs → 46.5–52.5. If it should be measured from the catalog total instead (→ 49.5–52.5), change `SHORT_UNDER_WEEKS` handling in `src/utils/blockHours.ts`.
3. **Block sheets are marked DRAFT** (revised 2022–2026). When scheduling publishes a new version, update `src/data/block-schedule.json` (format notes in `docs/spec-block-fit.md`).
4. **Sidebar end-time labels** assume an even split, so custom-split sections (Smart Split, Block Fit, manual custom) show approximate end times there. Pre-existing.
5. Manual / Smart Split still use the standard generator tolerance (±0.05 CH per meeting day per week), which can allow a component a few percent over catalog hours on a full term. Left as-is on purpose; Block Fit has its own range.

---

## 2026-10-26 — Block Fit mode

**Added**
- **Block Fit**, a third scheduling mode (Manual | Smart Split | Block Fit), desktop and mobile. Pick a block from the college's block schedule (e.g. MW 8:00–10:30) and the app places lecture and lab inside it. Every block shows ✓ (fits), `+Nm` (closest fit runs over), or ✕ (can't). Spec: `docs/spec-block-fit.md`.
  - Block data `src/data/block-schedule.json`, converted from `16_12_8_and_6_week_block_schedule.xlsx` (16-, 12-, 8-, 6-week and winter intersession sheets). Session → sheet mapping: full term → 16-week, late-12 → 12-week, fall/spring 8-week and summer 8-week → 8-week, summer 6-week → 6-week, winter → intersession. 15/14-week late starts and summer 4-week have no blocks.
  - Corrections confirmed by scheduling: intersession 1-hr 2:30–2:20 → 2:30–3:20; 12-week 5-hr MTWR 3:30–5:15 → 3:30–5:05 and 12:45–3:20 → 12:45–2:20; evening 6:30–7:20 PM → 6:30–7:50 PM on every sheet. 6-hour lec/lab columns on the 16-week sheet use 1:00 / 2:30 / 6:00 / 7:00 PM starts.
  - DFST 101 (3.5 lec / 0.5 lab) in MW 8:00–10:30, Fall full term reproduces the hand-built schedule: lecture Mon 8:00–10:25, Wed 8:00–8:50; lab Wed 9:00–10:20.
- **Block Fit hours range** (`src/utils/blockHours.ts`), per component, a week = catalog hrs / 18:
  - full-term fall/spring: catalog ± 1 week;
  - shorter sessions: target catalog − 1 week, accept 1.5 weeks under to 0.5 week over that target.
- `SavedSection.hoursRule: 'blockFit'` (optional). The generator checks custom splits of those sections against the Block Fit range; all other sections keep the standard check.
- Help entry "How do I fit a course into the block schedule?".

**Fixed**
- **Spreadsheet export** wrote uneven sections (custom split, per-day times, or lab following lecture on shared days) as one even row per component, with the lab at the lecture's start time. They now export one row per meeting pattern, matching the grid.

**Tests**
- `src/utils/blockFit.test.ts`: DFST 101 case, closest fit, short-session targets, hours ranges, generator rule, export rows, and a sweep of every block option × sample course mixes (generator accepts each result; reported end times match).
