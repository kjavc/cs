# Spec: Block Fit Mode

**Date:** 2026-10-26
**Status:** Shipped. Hours rule revised 2026-10-26 (week-based ranges, below)

---

## Summary

Block Fit is a third scheduling mode next to Manual and Smart Split. The user picks a window from the college's published block schedule (e.g. "MW 8:00–10:30"), and the app places the course's lecture and lab inside it using the existing contact hour rules. Every block in the list shows up front whether the course fits.

### Why

The block schedule is built for whole weekly-hour classes, but this app splits lecture and lab units, so a block rarely applies as-is. Fitting a split course into a block by hand is slow trial and error. Example, DFST 101 (3.5 lec + 0.5 lab) in MW 8:00–10:30, Fall full term:

```
Lecture  Mon 8:00–10:25  (2.7 CH)
Lecture  Wed 8:00–8:50   (1.0 CH)
Lab      Wed 9:00–10:20  (1.6 CH)
```

Block Fit produces exactly this.

---

## Block schedule data

- Source: `16_12_8_and_6_week_block_schedule.xlsx` (all sheets marked DRAFT), converted to `src/data/block-schedule.json`. Times are 24h, `"HH:MM-HH:MM"`.
- Each sheet lists **families** by weekly hours (1–6). Weekly hours = catalog hours ÷ 18 = `lec + 3 × lab`. Fractional hours use the next family up (3.5 → 4).
- Day codes: `SGL` (any one weekday M–F), `MW|TR`, `MWF|TRF`, `MTWR`, `MTWRF`. "Sgl Session or Lab" = `SGL`; "Lab 2/wk" = `MW|TR`; the 12-week 1-hour column has no day label and is `SGL` (its hours only work out for one day a week).
- `kind: "lecLab"`: the 6-hour **Lecture/Lab** columns. These are unadvertised but standard for 6-hour lec/lab courses (DM, ART). For a course with both lecture and lab, they replace the standard column with the same days. On the 16-week sheet the lec/lab starts are 1:00 PM (not 12:30), 2:30 PM (not 2:00), and 6:00 or 7:00 PM (not 5:00), per scheduling.
- `excluded`: sheet errors confirmed by scheduling; never offered.
- Fixes applied (confirmed): intersession 1-hour "2:30 - 2:20" → 2:30–3:20; 12-week 5-hour MTWR "3:30 - 5:15" → 3:30–5:05 and "12:45 - 3:20" → 12:45–2:20; evening "6:30 - 7:20" PM → 6:30–7:50 PM on every sheet.
- Removed (sheet error, confirmed): 12-week 4-hour MTWR "6:45 - 7:45" — the slot doesn't exist and would conflict with other blocks.

### Session → sheet

| Sheet | Applies to |
|---|---|
| 16-week | Fall/Spring Full Term (16 student weeks + 1 PD week = the app's 17) |
| 12-week | Fall/Spring Late Start (12 wks) |
| 8-week | Fall/Spring First/Second 8-Week; Summer Full Session (8 wks) |
| 6-week | Summer First/Second 6-Week |
| 5-week intersession | Winter |

Late Start 15/14 weeks and Summer 4-week sessions have no blocks; the picker says so. The mapping lives in `block-schedule.json` (`appliesTo`), read by `blockScheduleFor` in `src/utils/blockSchedule.ts`.

---

## Algorithm (`src/utils/blockFit.ts`)

Inputs: lecture/lab units, the block's days, start, end, and meetings per weekday (`meetingsPerWeekday`, so holidays count wherever the attendance rules say they do).

1. **Hours range** (`src/utils/blockHours.ts`). Block Fit output is an estimate, so each component (lecture, lab) only has to land near a target. A *week* = 1/18 of that component's catalog hours (`units × 18` / `units × 54`).

   | Session | Target | Accepted |
   |---|---|---|
   | Full-term fall/spring (`semester` + `FULL_TERM`) | catalog hours | target ± 1 week |
   | Everything shorter (late start, 8/6-week, winter, summer) | catalog − 1 week | target − 1.5 weeks … target + 0.5 week |

   E.g. 54 hrs: full term 51–57 (aim 54); short session 46.5–52.5 (aim 51). The "1.5 weeks under" is measured from the target (chosen in the absence of a firmer rule — it's one constant in `blockHours.ts`).
2. **Candidates per component.** Every way to land in the range on any subset of the block's days, using at most two distinct per-day values (more is more meeting patterns than anyone wants). Each meeting is ≥ 1.0 CH.
3. **Pairing.** Lecture runs first from the block start; on a day with both, the lab follows after the usual 10-minute break (same as the generator). Every block day must be used.
4. **Ranking** (lower is better, in order):
   1. minutes past the block end on the worst day,
   2. total minutes past the end,
   3. meeting patterns (distinct start/end per component),
   4. distance from the target hours,
   5. hours short of the target,
   6. spread between the days' end times,
   7. lecture earlier in the week (how these are built by hand).
5. **Doesn't fit:** the best answer is still returned, with its overrun ("closest fit"), up to 120 minutes over. Beyond that, or when the course can't meet the 1.0 CH minimum on every block day, an error explains why.

Speed: the search runs with short meetings first (fits only, then +30, +60, +120 min), and results are cached by window length + meetings + full-term flag, since the answer doesn't depend on the block's start time. Worst case across every block and sample course is ~0.4 s; typical is a few ms. Across Fall 2026 / Winter 2027 / Summer 2027 and sample course mixes: 1,725 block options fit, 135 run over, 108 can't (course too small to meet 1.0 CH on every block day).

---

## UI

- **Mode toggle:** `[ Manual | Smart Split | Block Fit ]`, desktop and mobile. Block Fit needs lecture or lab units (single-component courses are fine) and is disabled for fixed-hours courses.
- **Config:** units stay editable; start time shows "Set by block"; day pickers, TBA, custom split are hidden. A block panel lists the course's family (chips to view other families), grouped by day pattern. Each day variant shows ✓ (fits), `+Nm` (closest fit runs N min over), or ✕ (can't; hover for why).
- **Selected block:** a result line says fits / doesn't fit (with which days run over), each day's end time, the meeting-pattern count, and each component's hours vs its target and catalog hours. An overrun also adds a warning, so the status reads "Adjusted". The panel header says which target applies (full term vs short session).
- **Drag:** disabled in Block Fit (toast says to switch to Manual).
- **Switching to Manual** keeps the fitted days, per-day hours, and start time in the manual controls, and keeps the Block Fit hours rule (the custom-split footer shows the Block Fit range). Switching to Smart Split starts Smart Split fresh.

## Data model

Workspace-only mode state, like Smart Split: `blockFit` and `blockSelection` in `useWorkspace`, reset by `clearWorkspace`, course selection, and section load. Saved sections store the result as a fixed manual split (`lectureSplitMode`/`labSplitMode: 'custom'` + per-day hours) plus **`hoursRule: 'blockFit'`** (optional, additive; missing = standard). Toast on save: "Block Fit sections save as fixed schedules — edits will use Manual mode."

`hoursRule` travels with the section: workspace state `hoursRule` (set on load, or when leaving Block Fit for Manual), `GenerateScheduleOverrides.hoursRule`, and every place that regenerates a saved section (App, load, overlays, room context, spreadsheet export). The generator's custom-split check uses the Block Fit range when it's set and the standard ±0.05 CH/day/week otherwise; the even-split path and Manual/Smart Split are unchanged.

## Spreadsheet export

Sections whose days don't all meet the same way — custom split, per-day start times, or a lab that follows lecture on shared days without its own start time — export **one row per meeting pattern**, built from the generator's blocks (times, hrs/d, hrs/wk, hrs/ttl via `meetingsPerWeekday`). Everything else keeps the original one-row-per-component export. Before this, such sections exported as an even split with the lab at the lecture's start time.

---

## Known limits / notes

- Some blocks still run over, e.g. every 16-week MTWR 5-hour block is +10 min for DFST 101: its lab needs at least 25.5 hrs (1.5 CH = 75 min on one day) and the block is 65 min.
- Winter MTWR 1-hour blocks can't hold a 1-unit lecture: 19 meetings × 1.0 CH minimum = 19 hrs, above the 17.5 max.
- The sidebar's end-time labels still assume an even split (pre-existing, all custom splits).
- The 16-week 5-hour column lists 20-minute breaks (a manual extra 10 minutes). Block Fit ignores that and uses the standard break rules.
- Lab is always placed after lecture on shared days. Lab-first never changes how long a day runs, so it doesn't affect fit.
