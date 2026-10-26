// src/splitter/roll.ts
// Schedule roll: copy a term's sections into the same season of a later year.
// Spec: docs/spec-schedule-roll.md
import { CRNGroup, COL, SplitterStatus, SectionClassification, DAY_CHAR_TO_FULL, DAY_ORDER } from './types';
import { buildCatalogIndex, lookupCourse, CatalogMatch, getFixedUnits, getUnitRange } from './catalogLookup';
import { matchTermSession, detectTerm } from './termMatcher';
import {
    classifyCRNGroup, classifyFixedHours, resolveUnits, parseDaysFromRow, hasTBADays,
    sumHrsTotal, collectAllDays, getCommonStartTime
} from './classifier';
import { generateOutputRows } from './rowGenerator';
import { parseFlexDate } from './parseTsv';
import { escapeTsvCell } from './pipeline';
import { AcademicTerm, TermSession } from '../types/calendar';
import { AttendanceAccountingRules } from '../types/rules';
import { Course, fixedHoursOf } from '../hooks/useCatalog';
import { FixedHours } from '../types/section';
import { meetingsPerWeekday, calculateComponentFields, countMeetings } from '../utils/scheduleGenerator';
import { getSessionDates, addDays, getDateString } from '../utils/dateUtils';
import { catalogForTerm, formatAy, termSeason, termYear, TermCatalog } from '../utils/catalogForTerm';

export type RollFlag = 'UNITS' | 'HOURS' | 'CONFLICT';

interface RollNote {
    tag?: RollFlag;
    text: string;
}

export interface RollOutputRow {
    cells: string[];          // A–Z data, AA status, AB roll notes
    status: SplitterStatus;
    statusDetail: string;
    flags: RollFlag[];
    notes: RollNote[];
    changedCols: number[];    // cells recomputed by the roll (highlighted)
    conflictCols: number[];   // cells involved in a room/instructor overlap
    sourceCRN: string;
    xlistCode: string;
}

export interface CantRollRow {
    cells: string[];          // A–Z as pasted (source dates), AA reason
    crn: string;
    sub: string;
    num: string;
    reason: string;
}

export interface RollSummary {
    sections: number;
    inputRows: number;
    outputRows: number;
    split: number;
    unitsChanged: number;
    hoursChanged: number;
    conflicts: number;
    errors: number;
    cantRoll: number;
}

export interface RollResults {
    sourceTerm: AcademicTerm;
    targetTerm: AcademicTerm;
    sourceCatalog: TermCatalog;
    targetCatalog: TermCatalog;
    outputRows: RollOutputRow[];
    cantRoll: CantRollRow[];
    errorDetails: Array<{ crn: string; sub: string; num: string; message: string }>;
    summary: RollSummary;
}

export const ROLL_NOTES_COL = 27; // AB

const SEASON_NAMES: Record<string, string> = { fa: 'Fall', wi: 'Winter', sp: 'Spring', su: 'Summer' };
export const seasonName = (termId: string) => SEASON_NAMES[termSeason(termId)] ?? termSeason(termId);

// ---------------------------------------------------------------------------
// Term pairing

// Like-to-like only: same season, later year, earliest first.
export function rollTargetsFor(source: AcademicTerm, calendar: AcademicTerm[]): AcademicTerm[] {
    return calendar
        .filter(t => termSeason(t.id) === termSeason(source.id) && termYear(t.id) > termYear(source.id))
        .sort((a, b) => termYear(a.id) - termYear(b.id));
}

export function detectSourceTerm(groups: CRNGroup[], calendar: AcademicTerm[]): AcademicTerm | null {
    return detectTerm(groups.flatMap(g => g.rows.map(r => r.cells[COL.S_DATE])), calendar);
}

// ---------------------------------------------------------------------------
// Formatting helpers

const toMinutes = (t: string): number | null => {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
};

export function formatTime12(t: string): string {
    const total = toMinutes(t);
    if (total === null) return t;
    const nextDay = total >= 1440;
    const mins = total % 1440;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}${nextDay ? ' (next day)' : ''}`;
}

const fmtUnits = (n: number) => String(Math.round(n * 100) / 100);
const fmtRange = (r: { min: number; max: number }) => `${fmtUnits(r.min)}–${fmtUnits(r.max)}`;

// Write a date in the same style as the pasted value (ISO, or M/D/YY with the same padding/year width).
function formatDateLike(original: string, d: Date): string {
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    const day = d.getDate();
    const s = original.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const parts = s.split('/');
    const pad = (n: number, like: string | undefined) => like && like.length === 2 ? String(n).padStart(2, '0') : String(n);
    const yearStr = parts[2] && parts[2].length === 4 ? String(y) : String(y % 100).padStart(2, '0');
    return `${pad(mo, parts[0])}/${pad(day, parts[1])}/${yearStr}`;
}

const dayDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86400000);
const isoToDate = (iso: string) => new Date(iso + 'T00:00:00');

// ---------------------------------------------------------------------------
// Dates

interface SessionMatch {
    sourceSession: TermSession;
    targetSession: TermSession;
}

function matchSessions(
    group: CRNGroup,
    sourceTerm: AcademicTerm,
    targetTerm: AcademicTerm
): SessionMatch | { error: string } {
    const first = group.rows[0].cells;
    const start = parseFlexDate(first[COL.S_DATE]);
    if (!start || !parseFlexDate(first[COL.E_DATE])) {
        return { error: 'Missing or unreadable start/end date.' };
    }
    // Start must fall in the source term (a week's slack for early starts)
    const termStart = isoToDate(sourceTerm.startDate);
    const termEnd = isoToDate(sourceTerm.endDate);
    if (dayDiff(start, termStart) < -7 || dayDiff(start, termEnd) > 0) {
        return { error: `Start date ${first[COL.S_DATE]} isn't in ${sourceTerm.name}.` };
    }
    const match = matchTermSession(first[COL.S_DATE], first[COL.E_DATE], [sourceTerm]);
    if (!match) return { error: `No ${sourceTerm.name} session matches these dates.` };
    const targetSession = targetTerm.sessions.find(s => s.id === match.session.id);
    if (!targetSession) {
        return { error: `${targetTerm.name} has no "${match.session.name}" session.` };
    }
    return { sourceSession: match.session, targetSession };
}

// Shift a row's dates by keeping their offset from the session's start/end.
function rollRowDates(
    cells: string[],
    m: SessionMatch,
    sourceTerm: AcademicTerm,
    targetTerm: AcademicTerm
): { cells: string[]; startOffset: number; endOffset: number } {
    const src = getSessionDates(sourceTerm, m.sourceSession);
    const tgt = getSessionDates(targetTerm, m.targetSession);
    const out = [...cells];
    let startOffset = 0, endOffset = 0;

    const s = parseFlexDate(cells[COL.S_DATE]);
    if (s) {
        startOffset = dayDiff(s, isoToDate(src.startDate));
        out[COL.S_DATE] = formatDateLike(cells[COL.S_DATE], addDays(isoToDate(tgt.startDate), startOffset));
    }
    const e = parseFlexDate(cells[COL.E_DATE]);
    if (e) {
        endOffset = dayDiff(e, isoToDate(src.endDate));
        out[COL.E_DATE] = formatDateLike(cells[COL.E_DATE], addDays(isoToDate(tgt.endDate), endOffset));
    }
    return { cells: out, startOffset, endOffset };
}

// ---------------------------------------------------------------------------
// Units

interface TargetUnits {
    lecUnits: number;
    labUnits: number;
    changed: boolean;
    notes: RollNote[];
}

function targetUnitsFor(
    sourceUnits: { lecUnits: number; labUnits: number } | null,
    sourceCourse: Course | null,
    targetCourse: Course,
    totalHours: number,
    targetAyLabel: string
): TargetUnits | { error: string } {
    const notes: RollNote[] = [];
    let changed = false;

    // Source units unknown (e.g. variable units whose hours didn't resolve): derive from target
    let fallback: { lecUnits: number; labUnits: number } | null = null;
    if (!sourceUnits) {
        const r = resolveUnits(targetCourse, totalHours);
        if ('error' in r) return { error: r.error };
        fallback = r;
    }

    const pick = (comp: 'lec' | 'lab'): number => {
        const label = comp === 'lec' ? 'Lec' : 'Lab';
        const tgtVal = targetCourse[comp];
        const srcVal = sourceUnits ? (comp === 'lec' ? sourceUnits.lecUnits : sourceUnits.labUnits) : null;
        const fixed = getFixedUnits(tgtVal);

        if (srcVal === null) return comp === 'lec' ? fallback!.lecUnits : fallback!.labUnits;

        if (fixed !== null) {
            if (Math.abs(fixed - srcVal) > 0.001) {
                changed = true;
                notes.push({ tag: 'UNITS', text: `${label} units ${fmtUnits(srcVal)} → ${fmtUnits(fixed)}` });
            }
            return fixed;
        }

        // Variable units in target: keep the section's units if still allowed
        const range = getUnitRange(tgtVal);
        if (srcVal >= range.min - 0.001 && srcVal <= range.max + 0.001) {
            const srcRange = sourceCourse ? getUnitRange(sourceCourse[comp]) : null;
            if (srcRange && (srcRange.min !== range.min || srcRange.max !== range.max)) {
                notes.push({ text: `${label} unit range ${fmtRange(srcRange)} → ${fmtRange(range)} (kept ${fmtUnits(srcVal)})` });
            }
            return srcVal;
        }
        const clamped = Math.round(Math.max(range.min, Math.min(range.max, srcVal)) * 4) / 4;
        changed = true;
        notes.push({ tag: 'UNITS', text: `${label} units ${fmtUnits(srcVal)} → ${fmtUnits(clamped)} (outside ${targetAyLabel} range ${fmtRange(range)})` });
        return clamped;
    };

    const lecUnits = pick('lec');
    const labUnits = pick('lab');
    return { lecUnits, labUnits, changed, notes };
}

// ---------------------------------------------------------------------------
// Row building

function makeRow(
    cells: string[],
    group: CRNGroup,
    status: SplitterStatus,
    statusDetail = '',
    notes: RollNote[] = []
): RollOutputRow {
    const data = cells.slice(0, 26);
    while (data.length < 26) data.push('');
    return {
        cells: data, status, statusDetail, notes: [...notes],
        flags: notes.filter(n => n.tag).map(n => n.tag!),
        changedCols: [], conflictCols: [], sourceCRN: group.crn, xlistCode: group.xlistCode
    };
}

const hrsDiffer = (a: string, b: string) => {
    const x = parseFloat(a), y = parseFloat(b);
    if (isNaN(x) || isNaN(y)) return a.trim() !== b.trim();
    return Math.abs(x - y) > 0.05;
};

type Component = 'lec' | 'lab' | null;

function componentForRow(mt: string, targetCourse: Course): Component {
    if (mt === 'L') return 'lec';
    if (mt === 'B') return 'lab';
    if (mt === 'A') {
        const hasLec = getUnitRange(targetCourse.lec).max > 0;
        const hasLab = getUnitRange(targetCourse.lab).max > 0;
        if (hasLec && !hasLab) return 'lec';
        if (hasLab && !hasLec) return 'lab';
    }
    return null; // passthrough MT (G/Y/I/C/O/W) or ambiguous — dates only
}

// Recompute end time + hrs for each lecture/lab row, keeping its days and start time.
// A component spread over several rows shares one daily CH (even split across all its days).
function recomputeRows(
    sourceGroup: CRNGroup,
    rolledCells: string[][],
    targetCourse: Course,
    units: TargetUnits,
    meetingsByDay: Record<string, number>,
    status: SplitterStatus,
    targetAyLabel: string
): RollOutputRow[] | { error: string } {
    const comps = sourceGroup.rows.map(r => componentForRow(r.cells[COL.MT].trim().toUpperCase(), targetCourse));
    const rows: RollOutputRow[] = [];

    const dailyFor: Partial<Record<'lec' | 'lab', { daily: number; days: string[] }>> = {};
    for (const comp of ['lec', 'lab'] as const) {
        const idxs = comps.map((c, i) => c === comp ? i : -1).filter(i => i >= 0);
        if (idxs.length === 0) continue;
        const compUnits = comp === 'lec' ? units.lecUnits : units.labUnits;
        if (compUnits <= 0) {
            return { error: `${targetAyLabel} catalog has no ${comp === 'lec' ? 'lecture' : 'lab'} units for this course.` };
        }
        const daySet = new Set<string>();
        idxs.forEach(i => parseDaysFromRow(sourceGroup.rows[i].cells[COL.DAYS]).forEach(d => daySet.add(d)));
        const days = DAY_ORDER.filter(d => daySet.has(d));
        const fields = calculateComponentFields(compUnits, comp === 'lab', days, '00:00', meetingsByDay);
        if (!fields.hrsPerDay) {
            return { error: `Meeting days (${days.join('')}) don't occur in the target session.` };
        }
        const daily = parseFloat(fields.hrsPerDay);
        if (daily < 1.0) {
            return { error: `${comp === 'lec' ? 'Lecture' : 'Lab'} would be ${daily.toFixed(1)} CH per meeting on ${days.join('')} — below the 1.0 CH minimum. Use fewer days.` };
        }
        dailyFor[comp] = { daily, days };
    }

    sourceGroup.rows.forEach((srcRow, i) => {
        const cells = [...rolledCells[i]];
        const row = makeRow(cells, sourceGroup, status);
        const comp = comps[i];
        const info = comp ? dailyFor[comp] : undefined;
        const start = cells[COL.S_TIME];
        if (comp && info && start) {
            const rowDays = parseDaysFromRow(cells[COL.DAYS]);
            const compUnits = comp === 'lec' ? units.lecUnits : units.labUnits;
            const fields = calculateComponentFields(compUnits, comp === 'lab', info.days, start, meetingsByDay);
            const updates: Array<[number, string]> = [
                [COL.E_TIME, fields.endTime],
                [COL.HRS_D, info.daily.toFixed(1)],
                [COL.HRS_WK, (info.daily * rowDays.length).toFixed(1)],
                [COL.HRS_TTL, (info.daily * countMeetings(rowDays, meetingsByDay)).toFixed(1)],
            ];
            for (const [col, value] of updates) {
                const differs = col === COL.E_TIME ? value !== srcRow.cells[col].trim() : hrsDiffer(value, srcRow.cells[col]);
                row.cells[col] = value;
                if (differs) row.changedCols.push(col);
            }
            if (row.changedCols.includes(COL.E_TIME)) {
                row.notes.push({ tag: units.changed ? 'UNITS' : 'HOURS', text: `End ${formatTime12(srcRow.cells[COL.E_TIME])} → ${formatTime12(fields.endTime)}` });
            } else if (row.changedCols.includes(COL.HRS_TTL)) {
                row.notes.push({ tag: units.changed ? 'UNITS' : 'HOURS', text: `Hrs ${srcRow.cells[COL.HRS_TTL] || '—'} → ${row.cells[COL.HRS_TTL]}` });
            }
        }
        rows.push(row);
    });
    return rows;
}

const SPLIT_CHANGED_COLS = [COL.DAYS, COL.S_TIME, COL.E_TIME, COL.SES_NUM, COL.HRS_D, COL.HRS_WK, COL.HRS_TTL, COL.LHE, COL.MT];

// ---------------------------------------------------------------------------
// Conflicts

const NON_ROOMS = /^(TBA|TBD|ONLINE|ONLN|ONL|WEB|OL|ARR|ARRANGED|N\/?A|VIRTUAL|ZOOM|OFF ?SITE|-+)$/i;
const NON_FACULTY = /^(TBA|TBD|STAFF|N\/?A|-+)$/i;

interface Slot {
    row: RollOutputRow;
    days: Set<string>;
    start: number;
    end: number;
    from: Date;
    to: Date;
}

function detectConflicts(rows: RollOutputRow[]): void {
    const slots: Slot[] = [];
    for (const row of rows) {
        const days = new Set(Array.from(row.cells[COL.DAYS].trim().toUpperCase()).filter(c => DAY_CHAR_TO_FULL[c]));
        const start = toMinutes(row.cells[COL.S_TIME]);
        const end = toMinutes(row.cells[COL.E_TIME]);
        const from = parseFlexDate(row.cells[COL.S_DATE]);
        const to = parseFlexDate(row.cells[COL.E_DATE]);
        if (days.size === 0 || start === null || end === null || end <= start || !from || !to) continue;
        slots.push({ row, days, start, end, from, to });
    }

    const buckets = (keyOf: (s: Slot) => string | null) => {
        const map = new Map<string, Slot[]>();
        for (const s of slots) {
            const k = keyOf(s);
            if (!k) continue;
            const list = map.get(k);
            if (list) list.push(s); else map.set(k, [s]);
        }
        return map;
    };

    const describe = (s: Slot) =>
        `${s.row.cells[COL.DAYS]} ${formatTime12(s.row.cells[COL.S_TIME])}–${formatTime12(s.row.cells[COL.E_TIME])}`;

    const check = (map: Map<string, Slot[]>, label: string, cols: number[]) => {
        map.forEach(list => {
            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    const a = list[i], b = list[j];
                    if (a.row.sourceCRN === b.row.sourceCRN) continue;
                    if (a.row.xlistCode && a.row.xlistCode === b.row.xlistCode) continue;
                    if (!Array.from(a.days).some(d => b.days.has(d))) continue;
                    if (!(a.start < b.end && b.start < a.end)) continue;
                    if (!(a.from <= b.to && b.from <= a.to)) continue;
                    for (const [x, y] of [[a, b], [b, a]] as const) {
                        const text = `${label} overlap with CRN ${y.row.sourceCRN} (${describe(y)})`;
                        if (!x.row.notes.some(n => n.text === text)) x.row.notes.push({ tag: 'CONFLICT', text });
                        if (!x.row.flags.includes('CONFLICT')) x.row.flags.push('CONFLICT');
                        for (const c of [...cols, COL.S_TIME, COL.E_TIME]) {
                            if (!x.row.conflictCols.includes(c)) x.row.conflictCols.push(c);
                        }
                    }
                }
            }
        });
    };

    check(buckets(s => {
        const bldg = s.row.cells[COL.BLDG].trim().toUpperCase();
        const rm = s.row.cells[COL.RM].trim().toUpperCase();
        if (!rm || NON_ROOMS.test(rm) || NON_ROOMS.test(bldg)) return null;
        return `${bldg}|${rm}`;
    }), 'Room', [COL.BLDG, COL.RM]);

    check(buckets(s => {
        const fac = s.row.cells[COL.FACULTY].trim().toUpperCase();
        return !fac || NON_FACULTY.test(fac) ? null : fac;
    }), 'Instructor', [COL.FACULTY]);
}

// ---------------------------------------------------------------------------
// Fixed-hours courses (catalog lecHours/labHours, e.g. WELD 900)
//
// These meet once on a single date outside the session calendar, so they skip session
// matching: the date moves by the gap between term starts, then snaps to the same weekday.

function rollSingleDate(cell: string, sourceTerm: AcademicTerm, targetTerm: AcademicTerm): { cell: string; date: Date } | null {
    const d = parseFlexDate(cell);
    if (!d) return null;
    const shifted = addDays(d, dayDiff(isoToDate(targetTerm.startDate), isoToDate(sourceTerm.startDate)));
    let delta = (d.getDay() - shifted.getDay() + 7) % 7;
    if (delta > 3) delta -= 7;
    const date = addDays(shifted, delta);
    return { cell: formatDateLike(cell, date), date };
}

function rollFixedHours(
    group: CRNGroup,
    fixed: FixedHours,
    sourceFixed: FixedHours | undefined,
    sourceTerm: AcademicTerm,
    targetTerm: AcademicTerm
): { rows: RollOutputRow[]; split: boolean; unitsChanged: boolean } | { error: string; cells: string[][] } {
    const label = `${group.sub} ${group.num}`;
    const first = group.rows[0].cells;
    const start = parseFlexDate(first[COL.S_DATE]);
    if (!start) return { error: 'Missing or unreadable start date.', cells: group.rows.map(r => r.cells) };
    if (dayDiff(start, isoToDate(sourceTerm.startDate)) < -7 || dayDiff(start, isoToDate(sourceTerm.endDate)) > 0) {
        return { error: `Start date ${first[COL.S_DATE]} isn't in ${sourceTerm.name}.`, cells: group.rows.map(r => r.cells) };
    }

    const notes: RollNote[] = [];
    const rolledCells = group.rows.map(r => {
        const out = [...r.cells];
        for (const col of [COL.S_DATE, COL.E_DATE]) {
            const rolled = rollSingleDate(r.cells[col], sourceTerm, targetTerm);
            if (!rolled) continue;
            out[col] = rolled.cell;
            const iso = getDateString(rolled.date);
            const text = targetTerm.holidays.includes(iso)
                ? `${rolled.cell} is a holiday`
                : (iso < targetTerm.startDate || iso > targetTerm.endDate) ? `${rolled.cell} is outside ${targetTerm.name}` : '';
            if (text && !notes.some(n => n.text === text)) notes.push({ tag: 'CONFLICT', text });
        }
        return out;
    });
    const rolledGroup: CRNGroup = { ...group, rows: group.rows.map((r, i) => ({ ...r, cells: rolledCells[i] })) };

    const hoursChanged = !!sourceFixed && (sourceFixed.lec !== fixed.lec || sourceFixed.lab !== fixed.lab);
    if (hoursChanged) {
        notes.unshift({ tag: 'UNITS', text: `Hours ${sourceFixed!.lec} lec + ${sourceFixed!.lab} lab → ${fixed.lec} lec + ${fixed.lab} lab` });
    }

    const cls = hasTBADays(group) ? { type: 'tba' as const } : classifyFixedHours(rolledGroup, fixed, label, false);
    if (cls.type === 'error') return { error: cls.message, cells: rolledCells };
    if (cls.type === 'tba' || cls.type === 'pass-through') {
        return { rows: rolledCells.map(c => makeRow(c, group, cls.type === 'tba' ? 'tba' : 'pass-through', '', notes)), split: false, unitsChanged: hoursChanged };
    }
    if (cls.type === 'split') {
        const generated = generateOutputRows(rolledGroup, cls);
        if (generated.some(r => r.status === 'error')) return { error: generated[0].statusDetail, cells: rolledCells };
        const rows = generated.map(r => {
            const row = makeRow(r.cells, group, 'split', r.statusDetail, notes);
            row.changedCols = [...SPLIT_CHANGED_COLS];
            return row;
        });
        rows[0].notes.push({ text: `Split into lecture + lab (${rows.length} rows)` });
        return { rows, split: true, unitsChanged: hoursChanged };
    }

    // Already L + B: recompute each row's end time and hours from the target catalog
    const rows = group.rows.map((srcRow, i) => {
        const row = makeRow(rolledCells[i], group, 'already-split', '', notes);
        const mt = srcRow.cells[COL.MT].trim().toUpperCase();
        const hours = mt === 'L' ? fixed.lec : mt === 'B' ? fixed.lab : 0;
        const start = row.cells[COL.S_TIME];
        if (!hours || !start) return row;
        const days = parseDaysFromRow(row.cells[COL.DAYS]);
        const fields = calculateComponentFields(0, mt === 'B', days, start, {}, 0, hours);
        const updates: Array<[number, string]> = [
            [COL.E_TIME, fields.endTime], [COL.HRS_D, fields.hrsPerDay],
            [COL.HRS_WK, fields.hrsPerWeek], [COL.HRS_TTL, fields.hrsTotal],
        ];
        for (const [col, value] of updates) {
            const differs = col === COL.E_TIME ? value !== srcRow.cells[col].trim() : hrsDiffer(value, srcRow.cells[col]);
            row.cells[col] = value;
            if (differs) row.changedCols.push(col);
        }
        if (row.changedCols.includes(COL.E_TIME)) {
            row.notes.push({ tag: hoursChanged ? 'UNITS' : 'HOURS', text: `End ${formatTime12(srcRow.cells[COL.E_TIME])} → ${formatTime12(fields.endTime)}` });
        } else if (row.changedCols.includes(COL.HRS_TTL)) {
            row.notes.push({ tag: hoursChanged ? 'UNITS' : 'HOURS', text: `Hrs ${srcRow.cells[COL.HRS_TTL] || '—'} → ${row.cells[COL.HRS_TTL]}` });
        }
        return row;
    });
    return { rows, split: false, unitsChanged: hoursChanged };
}

// ---------------------------------------------------------------------------
// Main

export function rollGroups(
    groups: CRNGroup[],
    sourceTerm: AcademicTerm,
    targetTerm: AcademicTerm,
    attendanceRules: AttendanceAccountingRules
): RollResults {
    const sourceCatalog = catalogForTerm(sourceTerm.id);
    const targetCatalog = catalogForTerm(targetTerm.id);
    const srcIndex = buildCatalogIndex(sourceCatalog.catalog);
    const tgtIndex = buildCatalogIndex(targetCatalog.catalog);
    const srcAy = formatAy(sourceCatalog.catalogAy);
    const tgtAy = formatAy(targetCatalog.catalogAy);

    const outputRows: RollOutputRow[] = [];
    const cantRoll: CantRollRow[] = [];
    const errorDetails: RollResults['errorDetails'] = [];
    let split = 0, unitsChanged = 0, hoursChanged = 0, inputRows = 0;

    const sorted = [...groups].sort((a, b) => (a.rows[0]?.rowIndex ?? 0) - (b.rows[0]?.rowIndex ?? 0));

    for (const group of sorted) {
        inputRows += group.rows.length;
        const fail = (message: string, cellsList: string[][], notes: RollNote[] = []) => {
            const rows = cellsList.map(c => makeRow(c, group, 'error', message, notes));
            errorDetails.push({ crn: group.crn, sub: group.sub, num: group.num, message });
            return rows;
        };

        // Fixed-hours courses meet on one date outside the session calendar
        const fixedMatch = lookupCourse(tgtIndex, group.sub, group.num);
        const fixed = fixedMatch ? fixedHoursOf(fixedMatch.course) : undefined;
        if (fixed) {
            const srcFixedMatch = lookupCourse(srcIndex, group.sub, group.num);
            const result = rollFixedHours(group, fixed, srcFixedMatch ? fixedHoursOf(srcFixedMatch.course) : undefined, sourceTerm, targetTerm);
            if ('error' in result) {
                outputRows.push(...fail(result.error, result.cells));
                continue;
            }
            const late = result.rows.find(r => (toMinutes(r.cells[COL.E_TIME]) ?? 0) >= 1440);
            if (late) {
                outputRows.push(...fail(`Recomputed end time crosses midnight (${formatTime12(late.cells[COL.E_TIME])}); old times kept.`, group.rows.map(r => r.cells)));
                continue;
            }
            result.rows.forEach(r => { r.flags = Array.from(new Set(r.notes.filter(n => n.tag).map(n => n.tag!))); });
            if (result.split) split++;
            if (result.unitsChanged) unitsChanged++;
            else if (result.rows.some(r => r.flags.includes('HOURS'))) hoursChanged++;
            outputRows.push(...result.rows);
            continue;
        }

        const sessions = matchSessions(group, sourceTerm, targetTerm);
        if ('error' in sessions) {
            outputRows.push(...fail(sessions.error, group.rows.map(r => r.cells)));
            continue;
        }

        const rolled = group.rows.map(r => rollRowDates(r.cells, sessions, sourceTerm, targetTerm));
        const rolledCells = rolled.map(r => r.cells);
        const rolledGroup: CRNGroup = { ...group, rows: group.rows.map((r, i) => ({ ...r, cells: rolledCells[i] })) };

        const baseNotes: RollNote[] = [];
        const { startOffset, endOffset } = rolled[0];
        // A day or two of slack is normal (e.g. ending Friday when the term ends Saturday)
        if (Math.abs(startOffset) > 2 || Math.abs(endOffset) > 2) {
            const parts = [];
            if (startOffset !== 0) parts.push(`start ${startOffset > 0 ? '+' : ''}${startOffset}d`);
            if (endOffset !== 0) parts.push(`end ${endOffset > 0 ? '+' : ''}${endOffset}d`);
            baseNotes.push({ text: `Dates offset from ${sessions.sourceSession.name} (${parts.join(', ')})` });
        }

        const srcMatch = lookupCourse(srcIndex, group.sub, group.num);
        const tgtMatch = lookupCourse(tgtIndex, group.sub, group.num);

        if (!tgtMatch) {
            if (srcMatch) {
                const reason = `Not in ${tgtAy} catalog`;
                for (const r of group.rows) {
                    cantRoll.push({ cells: [...r.cells.slice(0, 26), reason], crn: group.crn, sub: group.sub, num: group.num, reason });
                }
            } else {
                outputRows.push(...fail(`${group.sub} ${group.num} not found in ${srcAy} or ${tgtAy} catalog.`, rolledCells, baseNotes));
            }
            continue;
        }

        if (hasTBADays(group)) {
            outputRows.push(...rolledCells.map(c => makeRow(c, group, 'tba', '', baseNotes)));
            continue;
        }

        if (!srcMatch) baseNotes.push({ text: `Not in ${srcAy} catalog — units taken from ${tgtAy}` });
        const structureMatch: CatalogMatch = srcMatch ?? tgtMatch;
        const srcMeetings = meetingsPerWeekday(sourceTerm, sessions.sourceSession, attendanceRules);
        const tgtMeetings = meetingsPerWeekday(targetTerm, sessions.targetSession, attendanceRules);
        const totalHours = sumHrsTotal(group);

        // What the section is today, judged against the source catalog
        const srcClass = classifyCRNGroup(group, structureMatch, sessions.sourceSession.weeks, srcMeetings);
        let sourceUnits: { lecUnits: number; labUnits: number } | null = null;
        if (srcClass.type === 'split') {
            sourceUnits = { lecUnits: srcClass.lecUnits, labUnits: srcClass.labUnits };
        } else {
            const r = resolveUnits(structureMatch.course, totalHours);
            if (!('error' in r)) sourceUnits = r;
        }

        const units = targetUnitsFor(sourceUnits, srcMatch?.course ?? null, tgtMatch.course, totalHours, tgtAy);
        if ('error' in units) {
            outputRows.push(...fail(units.error, rolledCells, baseNotes));
            continue;
        }
        const notes = [...units.notes, ...baseNotes];

        // Decide how to rebuild: split a combined section, or recompute each component row
        let plan: 'split' | 'recompute' = 'recompute';
        let recomputeStatus: SplitterStatus = 'pass-through';
        if (srcClass.type === 'split') {
            plan = 'split';
        } else if (srcClass.type === 'already-split') {
            recomputeStatus = 'already-split';
        } else if (srcClass.type === 'error') {
            // Source hours didn't line up — fall back to judging the rolled rows against the target
            notes.push({ text: `Source hours didn't match ${srcAy} catalog` });
            const tgtClass = classifyCRNGroup(rolledGroup, tgtMatch, sessions.targetSession.weeks, tgtMeetings);
            if (tgtClass.type === 'split') plan = 'split';
            else if (tgtClass.type === 'already-split') recomputeStatus = 'already-split';
            else if (tgtClass.type === 'error') {
                outputRows.push(...fail(srcClass.message, rolledCells, notes));
                continue;
            }
        }
        if (plan === 'split' && (units.lecUnits <= 0 || units.labUnits <= 0)) plan = 'recompute';

        let rows: RollOutputRow[];
        if (plan === 'split') {
            const cls: SectionClassification = {
                type: 'split',
                lecUnits: units.lecUnits,
                labUnits: units.labUnits,
                weeks: sessions.targetSession.weeks,
                meetingsByDay: tgtMeetings,
                startTime: getCommonStartTime(group),
                days: collectAllDays(group),
            };
            const generated = generateOutputRows(rolledGroup, cls);
            if (generated.some(r => r.status === 'error')) {
                outputRows.push(...fail(generated[0].statusDetail, rolledCells, notes));
                continue;
            }
            rows = generated.map(r => {
                const row = makeRow(r.cells, group, 'split', r.statusDetail, notes);
                row.changedCols = [...SPLIT_CHANGED_COLS];
                return row;
            });
            rows[0].notes.push({ text: `Split into lecture + lab (${rows.length} rows)` });
            split++;
        } else {
            const result = recomputeRows(group, rolledCells, tgtMatch.course, units, tgtMeetings, recomputeStatus, tgtAy);
            if ('error' in result) {
                outputRows.push(...fail(result.error, rolledCells, notes));
                continue;
            }
            rows = result;
            rows.forEach(r => r.notes.unshift(...notes));
            if (units.changed) {
                rows.forEach(r => {
                    if (r.cells[COL.LHE].trim()) {
                        r.cells[COL.LHE] = '';
                        r.changedCols.push(COL.LHE);
                        r.notes.push({ text: 'LHE needs update' });
                    }
                });
            }
        }

        // A recomputed end time past midnight can't be scheduled: keep the old times
        const late = rows.find(r => (toMinutes(r.cells[COL.E_TIME]) ?? 0) >= 1440);
        if (late) {
            outputRows.push(...fail(`Recomputed end time crosses midnight (${formatTime12(late.cells[COL.E_TIME])}); old times kept.`, rolledCells, notes));
            continue;
        }

        rows.forEach(r => { r.flags = Array.from(new Set(r.notes.filter(n => n.tag).map(n => n.tag!))); });
        if (units.changed) unitsChanged++;
        else if (rows.some(r => r.flags.includes('HOURS'))) hoursChanged++;
        outputRows.push(...rows);
    }

    detectConflicts(outputRows);

    for (const row of outputRows) {
        const statusText = row.status === 'error' ? `Error: ${row.statusDetail}` :
            row.status === 'split' ? 'Split' :
                row.status === 'tba' ? 'TBA' : 'OK';
        row.cells = [...row.cells.slice(0, 26), statusText, formatNotes(row.notes)];
    }

    return {
        sourceTerm, targetTerm, sourceCatalog, targetCatalog,
        outputRows, cantRoll, errorDetails,
        summary: {
            sections: groups.length,
            inputRows,
            outputRows: outputRows.length,
            split,
            unitsChanged,
            hoursChanged,
            conflicts: outputRows.filter(r => r.flags.includes('CONFLICT')).length,
            errors: errorDetails.length,
            cantRoll: new Set(cantRoll.map(r => r.crn)).size,
        },
    };
}

// Flagged notes first, e.g. "UNITS: Lab units 0.75 → 2.5; UNITS: End 1:35 PM → 4:10 PM; LHE needs update"
function formatNotes(notes: RollNote[]): string {
    const order: Array<RollFlag | undefined> = ['UNITS', 'HOURS', 'CONFLICT', undefined];
    return [...notes]
        .sort((a, b) => order.indexOf(a.tag) - order.indexOf(b.tag))
        .map(n => n.tag ? `${n.tag}: ${n.text}` : n.text)
        .join('; ');
}

// ---------------------------------------------------------------------------
// Output

export function rollToTsv(rows: Array<{ cells: string[] }>): string {
    return rows.map(r => r.cells.map(escapeTsvCell).join('\t')).join('\n');
}

const HIGHLIGHT = { changed: '#fff2cc', conflict: '#fce5cd', error: '#f4cccc' };

const escapeHtml = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // Plain <br> makes Excel split the cell into extra rows and merge the row's other cells across them
    .replace(/\r?\n/g, '<br style="mso-data-placement:same-cell">');

// HTML table for rich paste (Sheets/Excel keep cell background colors).
export function rollToHtml(rows: RollOutputRow[]): string {
    const body = rows.map(row => {
        const tds = row.cells.map((cell, col) => {
            let bg = '';
            if (row.status === 'error') bg = HIGHLIGHT.error;
            else if (row.conflictCols.includes(col)) bg = HIGHLIGHT.conflict;
            else if (row.changedCols.includes(col)) bg = HIGHLIGHT.changed;
            if (col === ROLL_NOTES_COL && cell && !bg) {
                bg = row.flags.includes('CONFLICT') ? HIGHLIGHT.conflict : row.flags.length ? HIGHLIGHT.changed : '';
            }
            const style = bg ? ` style="background-color:${bg}"` : '';
            return `<td${style}>${escapeHtml(cell)}</td>`;
        }).join('');
        return `<tr>${tds}</tr>`;
    }).join('');
    return `<table><tbody>${body}</tbody></table>`;
}
