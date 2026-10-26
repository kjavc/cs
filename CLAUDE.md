# Course Scheduler App

## Architecture
- React + TypeScript, CRA-based (not Vite)
- Desktop/Mobile split: `DesktopView.tsx` / `MobileView.tsx`, toggled via `useMediaQuery` at 768px
- State: `useSettings` (persisted to localStorage), `useWorkspace` (ephemeral per-session), `useSections` (saved sections in localStorage)
- Schedule generation: `src/utils/scheduleGenerator.ts` — pure function, takes request + context + overrides, returns blocks + warnings

## Key Data Flow
- `App.tsx` runs the generator in a debounced `useEffect` whenever units/days/times/term change
- `ConfigBar.tsx` (desktop) and `MobileConfig.tsx` (mobile) are the main config UIs
- `ScheduleDisplay.tsx` renders the weekly grid with drag-to-move support
- `academic-calendar.json` defines terms, sessions, holidays
- `courses_2526.json` / `courses_2627.json` are course catalogs keyed by AY

## Contact Hour Rules (DO NOT CHANGE without explicit confirmation)
- 1 lecture unit = 18 contact hours; 1 lab unit = 54 contact hours
- 1 contact hour = 50 instructional minutes + 10 min break per clock hour
- Minimum 1.0 CH per meeting (state regulation)
- 5-minute increments for all start/end times
- Rules live in `src/data/contact_hours_rules.md`, `course_rules.md`, `attendance-method.md`
- Existing calculation logic in `scheduleGenerator.ts` and `useRules.ts` is correct and validated
- Holidays: anything that computes end times or hrs (generator, smart split, spreadsheet export, splitter, sidebar labels) must use `meetingsPerWeekday` + `calculateComponentFields` — never `weeks × days` directly. Full-term semesters ignore holidays; intersession and short sessions count them (`attendance-method.md`)

## Schema v2 (SavedSection)
Optional additive fields — missing = legacy behavior:
- `lectureTimeMode` / `labTimeMode`: `'shared'` | `'perDay'`
- `lectureSplitMode` / `labSplitMode`: `'even'` | `'custom'`
- `lectureTimesPerDay` / `labTimesPerDay`: `Record<Day, string>`
- `lectureHoursPerDay` / `labHoursPerDay`: `Record<Day, number>`

## Academic Calendar
- AY26-27: Fall 2026, Winter 2027, Spring 2027, Summer 2027 (Summer 2026 belongs to AY25-26 and uses the 2526 catalog)
- AY27-28: Fall 2027, Winter 2028, Spring 2028, Summer 2028 (uses AY26-27 catalog as fallback)
- No Sunday holidays in any term

## Fixed-Hours Courses (catalog `lecHours` / `labHours`)
- For courses the catalog lists in total contact hours instead of units (currently only WELD 900/901: 1 lec + 9 lab hrs, `lec`/`lab` units = 0). Add per course only after confirming — it's a deliberate exception
- Each component meets once on a single day; the term calendar and holidays are ignored (`singleMeeting`). Generator, `calculateComponentFields`, sidebar, export all take the optional `fixedHours`
- Workspace/`SavedSection.fixedHours` carries it; units hold hour equivalents (h/18, h/54) only so "has lecture/lab" checks work — never compute hours from them
- Splitter: `classifyFixedHours`; roll shifts the single date by the term-start gap, snapped to the same weekday, and flags holidays

## Schedule Splitter (`src/splitter/`)
- Paste → Review → Results pipeline; spec in `docs/spec-schedule-splitter.md`
- Roll mode (`roll.ts`, spec `docs/spec-schedule-roll.md`): copies a term to the same season of a later year — re-dates by session, re-checks units against the target catalog, recomputes end times, flags UNITS/HOURS/CONFLICT in column AB, dropped courses go to a separate Can't-roll list
- Term → catalog mapping lives only in `src/utils/catalogForTerm.ts` (`isFallback` when the AY has no catalog yet — every AY27-28 term today)
- Banner exports one row per instructor on a meeting pattern. Rows identical except ID/Faculty are one pattern: `uniqueMeetingRows` counts hours/days once, `instructorsOf` emits split output once per instructor. Don't sum `HRS_TTL` over raw rows.
- TSV in/out must follow Excel quoting: `splitTsvRecords` (parseTsv.ts) reads quoted cells that contain tabs/newlines/`""`; `escapeTsvCell` (pipeline.ts) quotes such cells on export. Don't replace with plain `split('\n')` / `join('\t')` — that silently drops rows on paste into Excel.

## Commands
- `npm start` — dev server on port 3000
- `npx tsc --noEmit` — typecheck
- `npm run build` — production build

## Conventions
- Per-component toggles (lecture and lab get independent controls)
- `clearWorkspace` must reset ALL state including v2 fields
- Drag-move auto-flips `timeMode` to `perDay`; day-change drags reset `splitMode` to `even`
