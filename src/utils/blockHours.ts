// src/utils/blockHours.ts
// Hours target for Block Fit sections. These are scheduling estimates, so each component
// (lecture, lab) only needs to land near its target. A "week" is 1/18 of the component's
// catalog contact hours (the standard 18-week semester).
//
// - Full-term fall/spring: target the catalog hours, ±1 week.
// - Every shorter session (late start, 8/6-week, winter, summer): target one week short,
//   accepting 1.5 weeks under that target to 0.5 week over (still short of the catalog hours).
//
// Only sections saved from Block Fit (SavedSection.hoursRule === 'blockFit') use this;
// Manual and Smart Split keep the generator's standard check.

import { AcademicTerm, TermSession } from '../types/calendar';

export interface HoursRange {
    target: number;
    min: number;
    max: number;
}

const FULL_TERM_WEEKS = 1;
const SHORT_TARGET_WEEKS = 1;
const SHORT_UNDER_WEEKS = 1.5;
const SHORT_OVER_WEEKS = 0.5;

export function isFullSemester(term: AcademicTerm, session: TermSession): boolean {
    return term.type === 'semester' && session.method === 'FULL_TERM';
}

export function blockHoursRange(catalogHours: number, fullSemester: boolean): HoursRange {
    const week = catalogHours / 18;
    if (fullSemester) {
        return { target: catalogHours, min: catalogHours - FULL_TERM_WEEKS * week, max: catalogHours + FULL_TERM_WEEKS * week };
    }
    const target = catalogHours - SHORT_TARGET_WEEKS * week;
    return { target, min: target - SHORT_UNDER_WEEKS * week, max: target + SHORT_OVER_WEEKS * week };
}

export function withinRange(hours: number, range: HoursRange): boolean {
    return hours >= range.min - 1e-6 && hours <= range.max + 1e-6;
}
