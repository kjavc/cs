// src/utils/dateUtils.ts
import { AcademicTerm, TermSession } from '../types/calendar';

export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const addWeeks = (date: Date, weeks: number): Date => {
    // To span exactly X weeks, we add (X * 7) - 1 days.
    // e.g. Start Monday, add 6 days = Sunday (1 week span)
    return addDays(date, (weeks * 7) - 1);
};

// Timezone-safe YYYY-MM-DD string from local Date object
export const getDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export function getSessionDates(term: AcademicTerm, session: TermSession) {
    const termStartDate = new Date(term.startDate + 'T00:00:00');
    const termEndDate = new Date(term.endDate + 'T00:00:00');
    let sessionStartDate = termStartDate;
    let sessionEndDate = termEndDate;

    if (session.method === 'EARLY_START') {
        sessionEndDate = addWeeks(sessionStartDate, session.weeks);
    } else if (session.method === 'LATE_START') {
        sessionStartDate = addDays(addWeeks(termEndDate, -session.weeks), 1);
    }

    return {
        startDate: getDateString(sessionStartDate),
        endDate: getDateString(sessionEndDate)
    };
}
