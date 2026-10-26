import { AcademicTerm, TermSession } from '../types/calendar';
import { getSessionDates } from '../utils/dateUtils';
import { parseFlexDate } from './parseTsv';
import { CatalogHierarchy } from '../hooks/useCatalog';
import { catalogForTerm, latestCatalog } from '../utils/catalogForTerm';

// Term holding the most section start dates, or null if none fall in a known term.
export function detectTerm(
    startDates: string[],
    calendar: AcademicTerm[]
): AcademicTerm | null {
    const termCounts = new Map<string, number>();

    for (const dateStr of startDates) {
        const d = parseFlexDate(dateStr);
        if (!d) continue;

        for (const term of calendar) {
            const termStart = new Date(term.startDate + 'T00:00:00');
            const termEnd = new Date(term.endDate + 'T00:00:00');
            if (d >= termStart && d <= termEnd) {
                termCounts.set(term.id, (termCounts.get(term.id) || 0) + 1);
                break;
            }
        }
    }

    // Find the term with the most sections
    let topTerm = '';
    let topCount = 0;
    termCounts.forEach((count, termId) => {
        if (count > topCount) {
            topTerm = termId;
            topCount = count;
        }
    });

    return calendar.find(t => t.id === topTerm) ?? null;
}

export function determineCatalog(startDates: string[], calendar: AcademicTerm[]): CatalogHierarchy {
    const term = detectTerm(startDates, calendar);
    return term ? catalogForTerm(term.id).catalog : latestCatalog();
}

export interface TermSessionMatch {
    term: AcademicTerm;
    session: TermSession;
    weeks: number;
}

export function matchTermSession(
    sDateStr: string,
    eDateStr: string,
    calendar: AcademicTerm[]
): TermSessionMatch | null {
    const sDate = parseFlexDate(sDateStr);
    const eDate = parseFlexDate(eDateStr);
    if (!sDate || !eDate) return null;

    let bestMatch: TermSessionMatch | null = null;
    let bestScore = Infinity;

    for (const term of calendar) {
        for (const session of term.sessions) {
            const { startDate, endDate } = getSessionDates(term, session);
            const sessStart = new Date(startDate + 'T00:00:00');
            const sessEnd = new Date(endDate + 'T00:00:00');

            const startDiff = Math.abs(sDate.getTime() - sessStart.getTime());
            const endDiff = Math.abs(eDate.getTime() - sessEnd.getTime());
            const score = startDiff + endDiff;

            if (score < bestScore) {
                bestScore = score;
                bestMatch = { term, session, weeks: session.weeks };
            }
        }
    }

    return bestMatch;
}
