import { AcademicTerm, TermSession } from '../types/calendar';

export interface WeekRange {
    startWeek: number;
    endWeek: number;
}

export function getClassroomWeeks(term: AcademicTerm): number {
    return term.type === 'semester' ? 16 : term.sessions[0]?.weeks ?? 1;
}

export function getWeekRange(session: TermSession, term: AcademicTerm): WeekRange {
    const totalWeeks = getClassroomWeeks(term);

    if (session.method === 'FULL_TERM') {
        return { startWeek: 1, endWeek: totalWeeks };
    }

    if (session.method === 'EARLY_START') {
        return { startWeek: 1, endWeek: Math.min(session.weeks, totalWeeks) };
    }

    // LATE_START
    const startWeek = totalWeeks - session.weeks + 1;
    return { startWeek: Math.max(1, startWeek), endWeek: totalWeeks };
}

export function weekRangesOverlap(a: WeekRange, b: WeekRange): boolean {
    return a.startWeek <= b.endWeek && b.startWeek <= a.endWeek;
}

export function formatWeekRange(range: WeekRange, totalWeeks: number): string {
    if (range.startWeek === 1 && range.endWeek === totalWeeks) return 'Full';
    return `Wk ${range.startWeek}-${range.endWeek}`;
}
