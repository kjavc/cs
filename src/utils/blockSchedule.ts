// src/utils/blockSchedule.ts
// The college's published block schedule (src/data/block-schedule.json), keyed by session length.

import blockScheduleData from '../data/block-schedule.json';
import { AcademicTerm, TermSession } from '../types/calendar';

// SGL = any single weekday; "A|B" = either day set
export type BlockDaysCode = 'SGL' | 'MW|TR' | 'MWF|TRF' | 'MTWR' | 'MTWRF';

export interface BlockFamily {
    weeklyHours: number;
    // lecLab: the unadvertised 6-hour lecture/lab windows (DM, ART); replaces the standard
    // column with the same days for courses that have both lecture and lab
    kind: 'standard' | 'lecLab';
    days: BlockDaysCode;
    times: string[]; // "HH:MM-HH:MM", 24h
}

export interface BlockScheduleSheet {
    id: string;
    label: string;
    revised: string;
    appliesTo: { termType: AcademicTerm['type']; sessionIds: string[] }[];
    families: BlockFamily[];
}

// One concrete choice the user can pick: a day set and a time window
export interface BlockOption {
    weeklyHours: number;
    daysCode: BlockDaysCode;
    days: string[];
    start: string;
    end: string;
}

const sheets = (blockScheduleData as { schedules: BlockScheduleSheet[] }).schedules;

const DAY_LETTERS: Record<string, string> = { M: 'Mon', T: 'Tue', W: 'Wed', R: 'Thu', F: 'Fri' };
const SINGLE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function blockScheduleFor(term: AcademicTerm, session: TermSession): BlockScheduleSheet | null {
    return sheets.find(s => s.appliesTo.some(a => a.termType === term.type && a.sessionIds.includes(session.id))) ?? null;
}

// Catalog hours over the standard 18-week semester: lec × 18 + lab × 54, divided by 18
export function weeklyHoursOf(lectureUnits: number, labUnits: number): number {
    return Math.round((lectureUnits + labUnits * 3) * 100) / 100;
}

// The block family a course belongs to. Fractional hours round up to the next family.
export function familyFor(lectureUnits: number, labUnits: number): number {
    return Math.ceil(weeklyHoursOf(lectureUnits, labUnits) - 1e-9);
}

export function expandDays(code: BlockDaysCode): string[][] {
    if (code === 'SGL') return SINGLE_DAYS.map(d => [d]);
    return code.split('|').map(set => set.split('').map(l => DAY_LETTERS[l]));
}

export function daysLabel(days: string[]): string {
    const letters = Object.entries(DAY_LETTERS);
    return days.map(d => letters.find(([, name]) => name === d)?.[0] ?? d).join('');
}

// Block options for one family. Courses with both components get the lecture/lab windows
// in place of the standard column on the same days.
export function blockOptionsFor(sheet: BlockScheduleSheet, weeklyHours: number, hasLectureAndLab: boolean): BlockOption[] {
    const inFamily = sheet.families.filter(f => f.weeklyHours === weeklyHours);
    const families = inFamily.filter(f => {
        if (hasLectureAndLab) return f.kind === 'lecLab' || !inFamily.some(o => o.kind === 'lecLab' && o.days === f.days);
        return f.kind === 'standard';
    });
    const options: BlockOption[] = [];
    for (const f of families) {
        for (const days of expandDays(f.days)) {
            for (const t of f.times) {
                const [start, end] = t.split('-');
                options.push({ weeklyHours, daysCode: f.days, days, start, end });
            }
        }
    }
    return options;
}

export function familiesIn(sheet: BlockScheduleSheet): number[] {
    return Array.from(new Set(sheet.families.map(f => f.weeklyHours))).sort((a, b) => a - b);
}
