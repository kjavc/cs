# Spec: Block Fit Mode

**Date:** 2026-10-26
**Status:** Shipped (first version)

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
- `excluded`: windows whose length doesn't match the rest of their column (probable typos), left out until confirmed.
- Fixes applied: intersession 1-hour "2:30 - 2:20" → 2:30–3:20 (confirmed).

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

1. **Candidates per component.** Every way to meet the term's contact hours (`units × 18` / `units × 54`) on any subset of the block's days, using at most two distinct per-day values (more is more meeting patterns than anyone wants). Each meeting is ≥ 1.0 CH. A candidate is kept only if the generator's custom-split check accepts it — the same arithmetic, so nothing Block Fit offers is rejected later.
2. **Pairing.** Lecture runs first from the block start; on a day with both, the lab follows after the usual 10-minute break (same as the generator). Every block day must be used.
3. **Ranking** (lower is better, in order):
   1. minutes past the block end on the worst day,
   2. total minutes past the end,
   3. meeting patterns (distinct start/end per component),
   4. distance from the required hours,
   5. hours short of required,
   6. spread between the days' end times,
   7. lecture earlier in the week (how these are built by hand).
4. **Doesn't fit:** the best answer is still returned, with its overrun ("closest fit"), up to 120 minutes over. Beyond that, or when the course can't meet the 1.0 CH minimum on every block day, an error explains why.

Speed: the search runs with short meetings first (fits only, then +30, +60, +120 min), and results are cached by window length + meetings, since the answer doesn't depend on the block's start time. Worst case across every block and sample course is ~0.3 s; typical is a few ms.

---

## UI

- **Mode toggle:** `[ Manual | Smart Split | Block Fit ]`, desktop and mobile. Block Fit needs lecture or lab units (single-component courses are fine) and is disabled for fixed-hours courses.
- **Config:** units stay editable; start time shows "Set by block"; day pickers, TBA, custom split are hidden. A block panel lists the course's family (chips to view other families), grouped by day pattern. Each day variant shows ✓ (fits), `+Nm` (closest fit runs N min over), or ✕ (can't; hover for why).
- **Selected block:** a result line says fits / doesn't fit (with which days run over), each day's end time, and the meeting-pattern count. An overrun also adds a warning, so the status reads "Adjusted".
- **Drag:** disabled in Block Fit (toast says to switch to Manual).
- **Switching to Manual** keeps the fitted days, per-day hours, and start time in the manual controls. Switching to Smart Split starts Smart Split fresh.

## Data model

Workspace-only, like Smart Split: `blockFit` and `blockSelection` in `useWorkspace`, reset by `clearWorkspace`, course selection, and section load. Saved sections store the result as a fixed manual split (`lectureSplitMode`/`labSplitMode: 'custom'` + per-day hours); no schema change. Toast on save: "Block Fit sections save as fixed schedules — edits will use Manual mode."

---

## Known limits / notes

- The block sheets were built for 16 student weeks and come in slightly under catalog hours in places (e.g. 16-week 5-hour = 88.4 hrs vs 90; 4-hour = 71.4 vs 72; 1-hour = 17 vs 18). The app keeps the full catalog hours (existing rules, unchanged), so some blocks show a small overrun — e.g. every 16-week MTWR 5-hour block is +15 min for DFST 101.
- The 16-week 5-hour column lists 20-minute breaks (a manual extra 10 minutes). Block Fit ignores that and uses the standard break rules.
- Lab is always placed after lecture on shared days. Lab-first never changes how long a day runs, so it doesn't affect fit.
