# Implementation Plan: Rooms Feature + UI Tightening

**Date:** 2026-04-16
**Status:** Planned
**Horizon:** ~12-18 months before potential enterprise replacement

---

## Context & Architecture Decisions

- Stay on GitHub Pages, localStorage, static JSON. No database, no backend.
- Room data: new JSON file, division-scoped, 12-24 rooms per division.
- Single-user per division. No multi-user, no accounts.
- Room assignment is a scheduling aid, not a room management system. Users fill rooms with sections; the app shows conflicts visually.
- Per-component room assignment (lecture and lab can be in different rooms).
- Room types are labels only, not constraints.
- Capacity stored in data but NOT displayed yet (build support, hide UI until users request it).
- Week-range overlap detection using 16 classroom weeks for semesters (not 17 — the 17th week is faculty PD, used only for contact hour math).
- Intersession terms use their actual weeks (no PD week concept).

---

## Phase 1 — UI Tightening (no room logic, quick wins)

### 1A. Day Preset Buttons
- Add a row of quick-select buttons above the day pills in `CourseInput.tsx`: `MW`, `TTh`, `MWF`, `TThF`, `MTWTh`
- Clicking a preset sets the days array for that component. Clicking individual pills still works for custom combos.
- Academic shorthand labels. Compact styling — small pill-shaped buttons.
- Both desktop (`ConfigBar`) and mobile (`MobileConfig`).

Day mappings:
- MW → Mon, Wed
- TTh → Tue, Thu
- MWF → Mon, Wed, Fri
- TThF → Tue, Thu, Fri
- MTWTh → Mon, Tue, Wed, Thu

### 1B. Auto-Collapse Config Bar
- After the first schedule generates (detected via `generatedSchedule` transitioning from null to non-null), auto-collapse the config bar.
- Only on the first generate per workspace session — don't re-collapse after every change.
- User can still manually expand/collapse as before.

### 1C. Compact Section Pills
- Tighten sidebar section items to: name + compact one-line summary (e.g., "MW 8a, Full Term").
- Full details on hover tooltip or on click/load.

**Checkpoint:** Ship Phase 1, get user feedback before Phase 2.

---

## Phase 2 — Room Data Model + JSON

### 2A. Room JSON Structure

```json
{
  "divisions": {
    "AHUM": {
      "name": "Arts & Humanities",
      "buildings": [
        {
          "id": "bldg-a",
          "code": "A",
          "name": "Building A",
          "rooms": [
            {
              "id": "a-101",
              "number": "101",
              "type": "lecture",
              "capacity": 35
            },
            {
              "id": "a-205",
              "number": "205",
              "type": "computer-lab",
              "capacity": 24
            }
          ]
        }
      ]
    }
  }
}
```

### 2B. Type Definitions

```ts
interface Building {
  id: string;
  code: string;
  name: string;
  rooms: Room[];
}

interface Room {
  id: string;
  number: string;
  type: string;    // label only, no constraints
  capacity: number; // stored, not displayed yet
}

interface Division {
  name: string;
  buildings: Building[];
}
```

### 2C. Extend SavedSection

New optional fields (additive, backward-compatible):

```ts
lectureRoomId?: string;
labRoomId?: string;
lectureBuildingId?: string;
labBuildingId?: string;
```

### 2D. Week-Range Utility

Compute classroom week ranges from session metadata:

| Session | Method | Weeks | Range (16-wk semester) |
|---------|--------|-------|----------------------|
| Full term | FULL_TERM | 17* | Weeks 1-16 |
| First 8-week | EARLY_START | 8 | Weeks 1-8 |
| Second 8-week | LATE_START | 8 | Weeks 9-16 |
| Late-start 12 | LATE_START | 12 | Weeks 5-16 |
| Late-start 14 | LATE_START | 14 | Weeks 3-16 |
| Late-start 15 | LATE_START | 15 | Weeks 2-16 |

*Full term uses 17 weeks for CH math but 16 for room occupancy.

Formula:
- EARLY_START: `startWeek = 1`, `endWeek = session.weeks`
- LATE_START: `startWeek = totalClassroomWeeks - session.weeks + 1`, `endWeek = totalClassroomWeeks`
- FULL_TERM: `startWeek = 1`, `endWeek = totalClassroomWeeks`

Where `totalClassroomWeeks = 16` for semesters, `session.weeks` for intersession terms.

### 2E. Division Selector

- Add a division selector to Settings (persisted in localStorage).
- Determines which rooms are available throughout the app.
- One division at a time. Simple dropdown in the Settings panel.

**Checkpoint:** Data layer done, no UI for room assignment yet. Verify JSON structure with a sample division before building UI.

---

## Phase 3 — Room Assignment UI

### 3A. Room Selector in Config Bar

New row in config bar (after times, before custom split):
- Building dropdown → Room dropdown, filtered by selected division.
- Per-component: one for lecture, one for lab (following existing per-component toggle pattern).
- If lecture and lab are in the same room, a lock/link button (mirroring the existing time lock pattern).
- Collapsed summary bar shows room: "MW 8a Room A-101 / Lab TTh Room B-205".

### 3B. Room Context Overlay on Grid

When a room is selected for a component:
- All other saved sections assigned to that room (with overlapping week ranges) appear as ghost blocks on the grid.
- Ghost blocks show section name (e.g., "BIOL 101 01") and week range ("Wk 1-8").
- Visual style: similar to existing overlay ghosts but with a distinct muted color to differentiate from manually-toggled section overlays.
- Toggle between lecture room context and lab room context (if different rooms assigned).
- No room selected = no room ghosts (current behavior preserved).

### 3C. Overlap/Conflict Detection

When the user's current section would overlap an existing section in the selected room (same day, overlapping time, overlapping week range):
- Warning badge on the status indicator.
- Warning added to the status popover: "Room A-101 conflict: CHEM 201 01 on MW 8:00-9:15 (Wk 1-16)".
- Conflicting blocks visually flagged (red border or highlight).

Overlap logic: two sections conflict in a room when ALL three conditions are true:
1. Same room ID
2. Week ranges intersect (e.g., Wk 1-16 and Wk 1-8 intersect; Wk 1-8 and Wk 9-16 do not)
3. Same day of week AND time ranges overlap

**Checkpoint:** Room assignment works, conflicts detected. No room view yet.

---

## Phase 4 — Room View + Sidebar Enhancements

### 4A. Sidebar Sections | Rooms Toggle

- Segmented control or tab toggle at top of sidebar.
- **Sections tab:** current section list with new grouping dropdown:
  - By Course (grouped by subject/course number)
  - By Room (grouped by assigned room; unassigned sections under "No Room" group)
  - Alphabetical (flat A-Z list)
- **Rooms tab:** division's rooms listed by building. Each room shows a count of assigned sections. Clicking a room opens the room view overlay.

### 4B. Room View Modal Overlay

- Full-screen or near-full-screen modal.
- Weekly grid (reusing `ScheduleDisplay` component) showing ALL sections in that room for the selected term.
- Each section block shows: name, time, week range label ("Full", "Wk 1-8", "Wk 9-16").
- Color-coded by section or by component type (lecture vs lab).
- Room header: building name, room number, type label.
- Close button returns to scheduling view.

### 4C. Room Info in Hover Popover

- Existing block hover popover gains: room assignment ("Room A-101"), week range ("Wk 1-16").
- Capacity deliberately omitted from display per user decision (data exists but is hidden until requested).

**Checkpoint:** Full room workflow complete. Gather user feedback.

---

## Phase Dependencies

| Phase | Scope | Dependencies |
|-------|-------|-------------|
| 1 | UI tightening (presets, auto-collapse, compact pills) | None |
| 2 | Room data model, JSON, types, week-range util, division selector | None |
| 3 | Room assignment UI, grid context overlay, conflict detection | Phase 2 |
| 4 | Room view overlay, sidebar enhancements, grouping | Phase 2 + 3 |

Phases 1 and 2 are independent and can be done in parallel.
Phases 3 and 4 are sequential.

---

## Key Constraints (DO NOT CHANGE without explicit confirmation)

- Contact hour calculation logic in `scheduleGenerator.ts` is validated against state/local regulations. Do not modify existing math.
- 17 weeks for CH calculation, 16 weeks for room occupancy (semesters only).
- No Sunday holidays in any term.
- Per-component toggles: lecture and lab always get independent controls.
- Capacity data: stored but not displayed until user requests it.

---

## Deferred / Future Considerations

- Start time quick-picks: waiting for user feedback on drag-to-move usability.
- Multi-sort/delete in sidebar: waiting for user feedback on need.
- Database migration: only if tool outlives 18-month window and becomes multi-user.
- Room capacity display: built but hidden; enable when users request.
- Group-by-term in sidebar: deferred unless users schedule across multiple terms simultaneously.
