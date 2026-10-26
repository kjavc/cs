# Schedule Roll — Implementation Spec

**Status:** implemented 2026-10-08 — `src/splitter/roll.ts`, `RollSetup.tsx`, `RollReviewStage.tsx`, `RollResultsStage.tsx`, `src/utils/catalogForTerm.ts`. Tests: `roll.test.ts`, `SplitterView.roll.test.tsx`. See "Implementation notes" at the end for where the build differs from the plan below.

## Context

Planning a term usually starts by copying ("rolling") the same term from the prior year — e.g. Summer 2026 → Summer 2027. Dates have to shift to the new term, and every section has to be re-checked against the **target** term's catalog, because units can change between catalog years (35 courses differed between the AY25-26 and AY26-27 catalog files — though some were data errors in AY25-26; AERO 120/121 were fixed 2026-10-06).

The roll is an option inside the Schedule Splitter (`src/splitter/`, see `docs/spec-schedule-splitter.md`). It reuses the splitter's paste/parse, catalog lookup, classification, smart split, and Excel-quoted TSV output. Destination is **Google Sheets** (planning only — not a direct Banner import).

Pipeline: Paste → **Roll setup** → Review → Results.

---

## Decisions (confirmed with user)

| Topic | Decision |
|---|---|
| Destination | Google Sheets |
| Unit/hour changes | **Flag and recompute** |
| Recompute strategy | Keep days + start time; move **end time only** |
| CRNs | Keep as-is |
| Term pairing | Like-to-like only (Fall→Fall, Winter→Winter, Spring→Spring, Summer→Summer) |
| Dropped courses | Moved to a separate **Can't roll** list |
| Flags column | New column on the far right (after status) |
| Conflict checks | Midnight crossing, room overlap, instructor overlap (no earlier cutoff) |
| Holidays | Must be counted — recompute uses holiday-aware meeting days per `attendance-method.md` |
| Variable units | Keep if still in target range (note only); else flag + clamp to nearest allowed |
| New-in-catalog list | Out of scope |
| Missing target catalog | Prominent warning (expected every fall roll — next AY's catalog is always in progress) |

---

## Roll Setup

- Toggle on the Paste stage: **Split only** (current behavior) / **Roll to another term**.
- **Source term**: auto-detected from the pasted start dates (plurality, as `determineCatalogYear` does today), shown in a dropdown so the user can correct it.
- **Target term**: dropdown limited to the same season as the source and a later year. Season comes from the term id prefix (`fa`/`wi`/`sp`/`su`); `type` (`semester`/`intersession`) can't tell Fall from Spring or Winter from Summer.
- Rows whose start date falls outside the source term → Error, not rolled.

## Catalog Selection

- Source catalog = catalog for the source term; target catalog = catalog for the target term.
- Today the term → catalog mapping is duplicated in `useCatalog.ts` and `termMatcher.ts`. Replace both with one helper:
  ```
  catalogForTerm(termId): { key: 'courses_2526' | 'courses_2627'; ay: string; isFallback: boolean }
  ```
  `isFallback` is true when the term's AY has no catalog of its own (currently every AY27-28 term: fa2027, wi2028, sp2028, su2028).
- Summer belongs to the AY it ends: su2026 → AY25-26, su2027 → AY26-27, su2028 → AY27-28.

### Fallback warning
When the target catalog `isFallback`:
- A banner at the top of Review and Results: **"AY27-28 catalog not available yet — unit changes can't be detected. Rows were checked against AY26-27."**
- The copy-to-clipboard toast repeats it in one line.
- The roll still runs; recompute and calendar/holiday flags still apply.

---

## Date Mapping

- Match each row's s date / e date to the closest **source** session with `matchTermSession` (restricted to the source term).
- Map to the session with the same `id` in the target term (`first-6` → `first-6`). If the target term has no such session → Error.
- New dates keep the row's offset from its session:
  - `newStart = targetSession.start + (rowStart − sourceSession.start)`
  - `newEnd   = targetSession.end   + (rowEnd   − sourceSession.end)`
  - Like-to-like terms start on the same weekday, so weekdays stay put.
- A non-zero offset (row didn't line up exactly with its session) → note only: `Dates offset from session by N days`.
- Output dates use the same format as the input (M/D/YY vs ISO).

---

## Per-Row Processing

After re-dating, each CRN group goes through the normal splitter classification against the **target catalog**, with these additions.

### Not in target catalog
- In source catalog, missing from target → **Can't roll** list (`Dropped from AY26-27 catalog`).
- Missing from both → Error in the main output (same as the splitter today).

### Units comparison (source catalog vs target catalog)
- Lecture or lab units differ → flag `UNITS`, note `Lab units 0.75 → 2.5`.
- Variable units: keep the section's current units if they're inside the target range (note only, no flag); otherwise flag `UNITS` and clamp to the nearest allowed value (0.25 steps).

### Recompute
For every rolled row (changed or not), recompute end time and hrs/d, hrs/wk, hrs/ttl for the target session, keeping days and start time. Meeting-day counts are holiday-aware (see Prerequisite):
- mt=A combined → normal smart split with target units (status `Split`, plus roll notes).
- Already split L+B → recompute each component on its own.
- mt=L / mt=B (single component) → recompute that component.
- Pass-through MTs (G/Y/I/C/O/W) and TBA → dates rolled, times untouched.
- If the units changed, blank LHE (same as on split) and note `LHE needs update`.

Recompute result vs. the source row:
- End time or hrs/ttl changed but units didn't → flag `HOURS` (calendar/holiday driven), note `End 1:35 PM → 1:40 PM (holidays)`.
- Source row's hours didn't match the source catalog to begin with → note `Source hours didn't match AY25-26 catalog` so a pre-existing problem isn't blamed on the roll.

### Conflict checks (run after recompute, across the whole paste)
| Check | Severity | Times written |
|---|---|---|
| End time crosses midnight | Error | Old times kept |
| Same room (bldg + rm) overlaps another row | Conflict flag | New times kept |
| Same instructor overlaps another row | Conflict flag | New times kept |

Overlap = shared day + overlapping time + overlapping date range. Skip: rows in the same crosslist group (they share room/time by design), and blank/`TBA`/online rooms and blank/`TBA`/`STAFF` faculty. Conflict notes name the other CRN: `Room overlap with CRN 40123 (MW 4:00 PM)`.

---

## Output

### Columns
- A–Z unchanged; s date / e date / times / hrs rewritten as above.
- AA `status` — unchanged meaning (Split / OK / TBA / Error: …).
- **AB `roll notes`** — new, far right. `; `-separated, flags first, e.g.
  `UNITS: Lab 0.75 → 2.5; End 1:35 PM → 4:10 PM; Room overlap with CRN 40123`
  Empty when nothing changed.

### Highlighting
- Copy writes both `text/plain` (Excel-quoted TSV via `escapeTsvCell`) and `text/html` (a table with inline `background-color`) using `ClipboardItem`.
- Changed cells: yellow. Error rows: red. Conflict cells: orange.
- **Verify before building on it:** that a Sheets paste keeps the inline background colors. If not, ship plain TSV only; the notes column carries everything.

### Can't roll list
- A separate copy block on Results: same A–Z columns (original source dates) plus AA `reason`.
- Count shown in the Review summary.

### Review summary additions
Rolled · Units changed · Hours changed · Conflicts · Errors · Can't roll — plus the fallback banner when it applies.

---

## Prerequisite: Holiday-Aware Hours in the Splitter — DONE 2026-10-06

`rowGenerator.ts` used to call `calculateOfficialEndTime`, which counted meeting days as `weeks × days` and ignored holidays. That was wrong for any session `attendance-method.md` marks COUNT_HOLIDAYS (all intersession — Winter/Summer — and non-full-term semester sessions). The main scheduler (`scheduleGenerator.ts`) already counts holidays correctly.

Fixed (confirmed by user 2026-10-06): the splitter now computes meeting days, end times, and hrs fields with the same holiday-aware counting as `scheduleGenerator.ts` (reuse that logic; no new rules). This changes split-mode output for affected sessions and lands **before** the roll, so holiday-driven `HOURS` flags work (Summer 2026 loses Fri 7/3; Summer 2027 loses Fri 6/18 and Mon 7/5).

## Open Items

1. **AY25-26 catalog data quality.** AERO 120/121 were wrong in `courses_2526.json` (lab 0.75; actual 5 lec / 2.5 lab) — fixed 2026-10-06. Other suspicious AY25-26 values (lab 0.67, 2.17; AJ 111 0 lec / 1 lab vs 1.5 / 1.5 in AY26-27) may be the same kind of error. Spot-check before trusting `UNITS` flags on rolls out of AY25-26.

---

## Files

New:
- `src/splitter/roll.ts` — date mapping, unit comparison, notes assembly
- `src/splitter/conflicts.ts` — room/instructor overlap and midnight checks
- `src/splitter/RollSetup.tsx` — source/target pickers (or folded into `PasteStage.tsx`)
- `src/utils/catalogForTerm.ts` — single term → catalog mapping with `isFallback`

Modified:
- `src/hooks/useCatalog.ts`, `src/splitter/termMatcher.ts` — use `catalogForTerm`
- `src/splitter/types.ts` — `ROLL_NOTES` column (AB), roll flag types, Can't-roll rows
- `src/splitter/pipeline.ts` — roll path, TSV + HTML output, Can't-roll output
- `src/splitter/ReviewStage.tsx`, `ResultsStage.tsx`, `SplitterView.tsx` — summary counts, banner, second copy block

## Verification

- Summer 2026 → Summer 2027 with AERO 120 (MTWRF 8:00a–1:35p) and AERO 121 (MTWRF 4:00p–9:35p), mt=A:
  - dates 6/15/26–8/7/26 → 6/14/27–8/6/27 (or session-aligned equivalent)
  - `UNITS` flag on both (lab 0.75 → 2.5), split with recomputed end times
  - no `UNITS` flag (catalogs now agree: 5 lec / 2.5 lab); recomputed times land close to the originals, with an `HOURS` flag only if the holiday shift changes the end time
- A course dropped between catalogs lands in Can't roll, not the main output.
- Fall 2026 → Fall 2027 shows the AY27-28 fallback banner and no `UNITS` flags.
- Winter → Summer pairing isn't offered.
- Paste the output into Google Sheets: row count matches, notes column lands in AB, colors (if supported) appear.
- `npx tsc --noEmit` passes.

---

## Implementation notes (2026-10-08)

- **Structure comes from the source catalog.** Each CRN is first classified against the *source* catalog with source dates (what the section is today), then rebuilt with *target* units: combined → split; L/B rows → recompute each component; mt=A on a lecture-only or lab-only course → recompute as that component; passthrough MTs and TBA → dates only. If the source hours didn't match the source catalog, the rolled rows are judged against the target catalog instead and noted `Source hours didn't match AY25-26 catalog`.
- **Multi-row components** share one daily CH (target hours ÷ meetings across all that component's days); each row keeps its own start time, and its hrs/wk and hrs/ttl are its share.
- **1.0 CH minimum** is enforced on recomputed rows (Error if a unit drop would make a meeting shorter).
- **Date offsets** are noted only when more than 2 days (ending Friday when the term ends Saturday is normal).
- **LHE** is blanked (with a note) only when units changed.
- **Notes column (AB)** lists tagged notes first: `UNITS: …`, `HOURS: …`, `CONFLICT: …`, then plain notes.
- **Copy**: "Copy with highlights" writes TSV + an HTML table (cell colors); "Copy plain" writes TSV only. Rich paste into Google Sheets is not yet confirmed — if colors don't come through, the notes column still has everything.
- **Can't roll** copy: original rows (source dates) + reason in AA.
- **Catalog per term** lives in `catalogForTerm()` (AY from term id; Summer belongs to the AY it ends). `useCatalog` and the splitter's catalog detection use it too.
- **Crosslisted sections** are rolled independently (no sibling copying); the overlap check skips rows sharing a crosslist code.

