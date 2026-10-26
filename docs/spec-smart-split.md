# Spec: Smart Split Mode

**Date:** 2026-05-15
**Status:** Shipped (iterating)

---

## Summary

Smart Split is a scheduling mode that automatically distributes a course's lecture and lab contact hours across user-selected days as evenly as possible, adhering to all existing contact hour rules. It replaces the current manual workflow of separately configuring lecture days, lab days, and custom hour splits with a single unified interface.

### Why

Currently, users must manually assign lecture and lab to separate day sets, then optionally use custom splits to balance time across days. This is tedious and error-prone, especially for courses with mixed lecture/lab units. In practice, many courses are scheduled as block schedules (e.g., "MonWed 8-11:30 AM") where lecture and lab time are combined across the same days. Smart Split automates this pattern while properly labeling the lecture and lab components for catalog compliance.

---

## Concepts

### Smart Split as a Mode

Smart Split is a **mode**, not a one-time action. When active, it transforms the configuration UI and takes ownership of day assignment and hour distribution. The user can toggle between two modes:

- **Manual** (default, current behavior): Separate lecture/lab day pickers, optional custom splits, full manual control.
- **Smart Split**: Unified day picker, automatic hour distribution, simplified UI.

### Lecture + Lab on Same Day

Lecture and lab time may appear on the same day. Instructors have academic freedom at the college level — the scheduled component labels (lecture vs. lab) indicate contact hour type for compliance purposes, not pedagogical constraints.

---

## Prerequisites

Smart Split requires **both lecture and lab units > 0**. For lecture-only or lab-only courses, the Smart Split toggle is **grayed out / disabled** — the existing manual and custom split controls already handle single-component distribution, and there's nothing to "smartly" combine.

If the user is already in Smart Split mode and a unit change causes one component to become 0 (e.g., setting lab to 0, or selecting a lecture-only course from catalog), Smart Split **auto-deactivates to Manual** with a toast: "Smart Split requires both lecture and lab — switching to Manual mode."

---

## Algorithm

The algorithm uses a **two-pass approach** because the total clock time per day depends on whether that day has both lecture and lab (mixed days incur an extra 10-minute inter-component break), and that isn't known until after the initial distribution.

Given a course's lecture units, lab units, the selected term, and the user's chosen days:

### Pass 1 — Distribute Instructional Minutes

1. **Compute weekly instructional minutes** for lecture and lab separately using existing rules:
   - Lecture: units x 18 contact hours / term weeks = weekly CH x 50 min = weekly instructional minutes
   - Lab: units x 54 contact hours / term weeks = weekly CH x 50 min = weekly instructional minutes
2. **Sum into a total weekly instructional minute budget** (breaks not yet included).
3. **Divide by the number of selected days** to get the target per-day instructional minutes.
4. **Snap to 5-minute increments** (existing rule).
5. **Fill lecture first, then lab.** Walk through each day chronologically:
   - Assign lecture instructional minutes until the lecture weekly budget is exhausted.
   - Continue with lab instructional minutes for the remainder of each day's allocation.
   - This means some days may be all-lecture, some may be mixed, and some may be all-lab, depending on the ratio.
   - The lecture-first ordering is a convention for reporting compliance, not a pedagogical constraint — instructors have academic freedom over how scheduled time is used in the classroom.
6. **Handle remainders.** If total instructional minutes don't divide evenly:
   - Distribute the remainder across days, adding 5-minute increments to earlier days first.
   - Accept small imbalances (a few minutes difference is fine — the goal is "as close as possible," not "identical").

### Pass 2 — Add Breaks and Validate

7. **Compute clock time per day.** For each day, add breaks to the instructional minutes:
   - Internal breaks: 10 minutes per clock hour within each component (existing rule, handled by the generator).
   - Inter-component break: **10 minutes** between lecture and lab on mixed days (days that have both).
8. **Enforce the 1.0 CH minimum per meeting (per block, not per day).** Each individual block — each lecture block and each lab block — must independently meet the 1.0 CH minimum (state regulation). On a mixed day, this means both the lecture block and the lab block must each be at least 1.0 CH. If any block falls below this threshold, the split is invalid for that number of days.
9. **Re-balance if needed.** If adding inter-component breaks to mixed days creates a meaningful clock-time imbalance across days (e.g., mixed days are noticeably longer), redistribute instructional minutes slightly to compensate. This is an edge case — for most splits the imbalance is minor.

### Validation & Feedback

When a day selection can't produce a valid split, display specific guidance:

- **Too many days:** "Can't split across 5 days — one or more meetings would be below the 1 contact hour minimum. Try 2 or 3 days."
- **Too few days:** Not typically an error, but warn if a single day produces an unusually long block (e.g., > 5 hours).
- **Success with imbalance:** Show the per-day breakdown and note the difference: "Mon: 2h 25m / Wed: 2h 10m (15 min difference)."

---

## UI Changes

### Mode Toggle (ConfigBar, top — Option 2)

- **Location:** Top of ConfigBar, before Row 1 (session/times/catalog). First thing visible when config is expanded.
- **Control:** Segmented control pill — `[ Manual | Smart Split ]`.
- **Default:** Manual (preserves current behavior for existing users).
- **Mobile:** Same position at top of MobileConfig.

### Smart Split Mode Active — ConfigBar Transforms

When Smart Split is toggled on:

| Area | Manual Mode (current) | Smart Split Mode |
|---|---|---|
| **Row 1 — Session/Term** | Session and weeks selectors | **No change** — term length is needed for Smart Split math |
| **Row 1 — Course Catalog** | CoursePicker dropdown | **No change** — catalog selection still works normally |
| **Row 2 — Day Pickers** | Two separate DayPickers (lecture days, lab days) | **Single unified DayPicker** — "Select meeting days" |
| **Row 2 — Units** | Lecture units + Lab units (independent) | Lecture units + Lab units (still visible and editable) |
| **Row 2 — TBA Hours** | Optional TBA hours inputs for lecture/lab | **Hidden** — TBA is a hyper-specific use case, don't blur with Smart Split |
| **Row 3 — Custom Split** | Shows when 2+ days and enough units | **Hidden entirely** — Smart Split owns the distribution |
| **Start Time** | Shared or per-day time pickers | **Single shared start time only** (kept simple) |
| **Time Mode Toggle** | Shared / Per-Day toggle visible | **Hidden** — single start time enforced |

The units selectors remain visible because the user still needs to set or verify the lecture/lab unit breakdown. Smart Split only takes over the *day assignment* and *hour distribution*.

### Toggling On (Manual -> Smart Split)

When the user switches to Smart Split mode:

- **Day selection resets to empty.** The unified day picker starts with no days selected, and the user must pick their days fresh. This avoids confusing merges of potentially incompatible lecture/lab day sets.
- Units are preserved (lecture and lab unit values carry over).
- Start time is preserved.
- TBA hours, custom split values, and per-day time overrides are cleared.

### Toggling Off (Smart Split -> Manual)

When the user switches back to Manual mode:

- **Persist the computed values.** The day assignments and per-day hours that Smart Split calculated carry over into the manual controls. The user can tweak from there rather than starting from scratch.
- Lecture days, lab days, and any custom split values are populated from the Smart Split result.
- The separate day pickers and custom split row reappear with these values pre-filled.

---

## Schedule Grid Rendering

Smart Split blocks render **identically to manual splits** — separate lecture and lab blocks with their existing colors, with the standard 10-minute break gap between them when both appear on the same day. There is no special "unified block" visual. This is consistent with the rest of the app and avoids introducing a new rendering concept.

---

## MinimalSummary Display

The MinimalSummary (at the top of the schedule display) lists **each day individually per component** rather than collapsing into a single time range. This avoids misleading ranges when per-day durations differ (e.g., showing "8:00 - 10:25" when that only applies to one of the days).

```
Lecture: Mon (8:00 - 10:25)
Lecture: Wed (8:00 - 8:50)
Lab: Wed (9:00 - 10:20)
```

This applies to both Smart Split and manual custom splits — any time per-day blocks differ, each gets its own line. When all days of a component are identical, they can still be collapsed into one line (e.g., "Lecture: Mon/Wed (8:00 - 10:25)").

---

## InfoCard / Details Display Fix

**This is a separate but related fix.** The current InfoCard in ScheduleDisplay shows single averaged values ("Contact Hours Per Day: 4.5", "Time Block Per Day: 4h 50m") that are misleading when days aren't uniform — whether from manual custom splits or Smart Split.

### Current (broken for splits)

```
Contact Hours Per Day:  4.5
Time Block Per Day:     4h 50m
```

### Updated (per-day breakdown when days differ)

When all days are identical, keep the current single-line display. When days differ, show per-day:

```
Mon:  2h 25m  (2.5 CH lecture)
Wed:  2h 10m  (1.0 CH lecture + 1.5 CH lab)
```

This fix should apply regardless of whether Smart Split is active — manual custom splits should also display correctly.

---

## Data Model

Smart Split mode state is **workspace-only** (ephemeral). When a section is saved, it is saved as a standard manual split with concrete per-day values. There is no Smart Split flag in the saved section schema. This keeps saved sections, shareable URLs, and sidebar items simple — they already handle manual splits with per-day values, so no changes are needed to persistence or sharing.

### Workspace State (new, ephemeral)

- **`smartSplit`** (boolean): Whether Smart Split mode is active in the current workspace.
- **`smartSplitDays`** (`Day[]`): The unified day selection when in Smart Split mode.
- Both are managed by `useWorkspace` and included in `clearWorkspace` resets.

### Saved Section Output (no schema changes)

When Smart Split computes the distribution, it writes results into the existing per-day fields:
- `lectureTimesPerDay` / `labTimesPerDay` (start times derived from the single shared start time)
- `lectureHoursPerDay` / `labHoursPerDay` (the computed per-day contact hours)
- `lectureDays` / `labDays` (set to whichever days have lecture/lab time allocated)

When a Smart Split section is saved, these concrete values are persisted. Loading a saved section always opens in Manual mode with the per-day values pre-filled — there is no "resume Smart Split" state.

### Save Toast

When saving a section while Smart Split is active, show a toast: **"Section saved. Smart Split sections save as fixed schedules — edits will use Manual mode."** This sets expectations upfront so users aren't surprised when the loaded section opens in Manual mode.

---

## Scope & Non-Goals

**In scope:**
- Mode toggle UI in ConfigBar and MobileConfig
- Smart Split algorithm (two-pass: distribute instructional minutes, then add breaks and validate)
- Unified day picker in Smart Split mode
- Validation with user-friendly error messages
- InfoCard per-day breakdown (fixes manual splits too)
- MinimalSummary per-day lines when blocks differ (fixes manual splits too)
- Workspace state (`smartSplit`, `smartSplitDays`) with `clearWorkspace` reset
- Saved sections store concrete per-day values only (no Smart Split flag persisted)

**Not in scope (for now):**
- Per-day start times in Smart Split mode (single start time only)
- Smart Split suggestions ("we recommend MW for this course") — just compute what the user asks for
- Room assignment interaction — Smart Split is purely about time distribution

---

## Decided Questions

1. **Drag-to-move interaction:** Dragging any block in Smart Split mode has two behaviors depending on direction:
   - **Vertical drag (time change):** Moves **all blocks as a unit** — changes the shared start time while preserving the computed distribution. Smart Split stays active.
   - **Horizontal drag (day change):** Replaces only the dragged block's day. E.g., dragging the Monday block to Tuesday on a Mon/Wed split changes the days to Tue/Wed. The unified day picker updates to reflect the new days, and Smart Split recomputes the distribution for the new day set. Smart Split stays active. Dragging to a day already in the set is a **no-op** (block snaps back). (If users expect the entire set to shift rather than just the dragged day, revisit this decision.)
2. **Catalog-selected courses:** Smart Split defaults to **Manual**. Users must actively choose Smart Split. No auto-activation on catalog selection.

---

## Changelog

### 2026-05-15 — Algorithm rework (v2)

**Shipped changes:**

1. **Even-split happy path:** Before any fancy allocation, check if both lecture and lab weekly CH divide evenly (at 0.1 CH resolution) across all selected days with each per-day value >= 1.0 CH. If so, every day gets identical CH — same schedule, same end time. No balancing needed.

2. **Day-count-based fallback:** When even split isn't possible, determine how many days each component needs via `floor(weeklyCH / 1.0)`. Lecture fills the first N days, lab fills the last M days (overlap in the middle). Each component is distributed evenly across its assigned days.

3. **Clock-time balancing:** After initial allocation, iteratively shift 0.1 CH (lecture first, then lab) from the heaviest day to the lightest to minimize wall-clock spread. Stops when spread <= 5 minutes or no shift improves things.

4. **Relaxed sum validation in schedule generator:** Custom-split sum tolerance changed from fixed 0.05 to `max(0.05, numDays * 0.05)` to accommodate rounding error inherent in 0.1 CH resolution across multiple days.

**Known issue — per-day CH rounding vs. block schedule expectations:**

When term weeks don't divide cleanly (e.g., Fall 2026 Full Term = 17 weeks), the per-day CH after rounding may overshoot the "natural" block schedule. Example: INT 203 (2 lec units, 1 lab unit) on MW at 17 weeks gives `2 × 18 / 17 = 2.1176` weekly lecture CH → `roundCH(2.1176 / 2) = 1.1` CH per day → 35.2 total hours over the term. But the typical block schedule would use 1.0 CH per day (34.0 hours), since instructors think in whole units per day (2 units / 2 days = 1 unit/day = 1.0 CH/day).

This may require additional rules — possibly a "unit-based split" path that divides units first, then derives CH from per-day units, to match how block schedules are actually built. Flagged for future revisit; current behavior is technically correct per contact hour math but doesn't match practitioner expectations in all cases.
