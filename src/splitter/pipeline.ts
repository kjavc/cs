import { CRNGroup, COL, ReviewSummary, SplitterResults, OutputRow } from './types';
import { parseTsv, groupByCRN } from './parseTsv';
import { buildCatalogIndex, lookupCourse } from './catalogLookup';
import { determineCatalog, matchTermSession } from './termMatcher';
import { classifyCRNGroup } from './classifier';
import { validateCrosslists, buildCrosslistMap } from './crosslistValidator';
import { generateOutputRows, generateCrosslistSiblingRows } from './rowGenerator';
import { meetingsPerWeekday, uniformMeetings } from '../utils/scheduleGenerator';
import { AttendanceAccountingRules } from '../types/rules';
import { academicCalendar } from '../types/calendar';

export function buildGroups(crnMap: Map<string, import('./types').SpreadsheetRow[]>): CRNGroup[] {
    const groups: CRNGroup[] = [];
    crnMap.forEach((rows, crn) => {
        const first = rows[0].cells;
        groups.push({
            crn,
            rows,
            sub: first[COL.SUB]?.trim() || '',
            num: first[COL.NUM]?.trim() || '',
            xlistCode: first[COL.XLIST]?.trim() || ''
        });
    });
    return groups;
}

export function parseAndGroup(raw: string): { groups: CRNGroup[]; parseWarnings: string[] } {
    const { rows, warnings } = parseTsv(raw);
    const crnMap = groupByCRN(rows);
    const groups = buildGroups(crnMap);
    return { groups, parseWarnings: warnings };
}

export function classifyGroups(groups: CRNGroup[], attendanceRules: AttendanceAccountingRules): ReviewSummary {
    const calendar = academicCalendar;

    // Determine catalog year from section dates
    const startDates = groups.flatMap(g => g.rows.map(r => r.cells[COL.S_DATE]));
    const catalog = determineCatalog(startDates, calendar);
    const catalogIndex = buildCatalogIndex(catalog);

    // Classify each CRN group
    const classifications = new Map<string, import('./types').SectionClassification>();
    let toSplit = 0, alreadySplit = 0, passThrough = 0, tba = 0, errors = 0;
    const errorDetails: ReviewSummary['errorDetails'] = [];

    // Validate crosslists
    const crosslistErrors = validateCrosslists(groups, catalogIndex);
    const crosslistErrorCRNs = new Set<string>();
    for (const err of crosslistErrors) {
        for (const crn of err.crns) {
            crosslistErrorCRNs.add(crn);
        }
    }

    for (const group of groups) {
        // Check if this CRN is part of a crosslist error
        if (crosslistErrorCRNs.has(group.crn)) {
            const err = crosslistErrors.find(e => e.crns.includes(group.crn));
            const classification = { type: 'error' as const, message: err?.message || 'Crosslist validation error.' };
            classifications.set(group.crn, classification);
            errors++;
            errorDetails.push({ crn: group.crn, sub: group.sub, num: group.num, message: classification.message });
            continue;
        }

        const catalogMatch = lookupCourse(catalogIndex, group.sub, group.num);

        // Get weeks from term/session matching
        const firstRow = group.rows[0];
        const termMatch = matchTermSession(
            firstRow.cells[COL.S_DATE],
            firstRow.cells[COL.E_DATE],
            calendar
        );
        const weeks = termMatch?.weeks ?? 17; // fallback to full term
        const meetingsByDay = termMatch
            ? meetingsPerWeekday(termMatch.term, termMatch.session, attendanceRules)
            : uniformMeetings(weeks);

        const classification = classifyCRNGroup(group, catalogMatch, weeks, meetingsByDay);
        classifications.set(group.crn, classification);

        switch (classification.type) {
            case 'split': toSplit++; break;
            case 'already-split': alreadySplit++; break;
            case 'pass-through': passThrough++; break;
            case 'tba': tba++; break;
            case 'error':
                errors++;
                errorDetails.push({ crn: group.crn, sub: group.sub, num: group.num, message: classification.message });
                break;
        }
    }

    return {
        totalSections: groups.length,
        toSplit,
        alreadySplit,
        passThrough,
        tba,
        errors,
        errorDetails,
        classifications,
        crnGroups: groups
    };
}

export function processGroups(
    groups: CRNGroup[],
    summary: ReviewSummary
): SplitterResults {
    const crosslistMap = buildCrosslistMap(groups);
    const groupByCRN = new Map<string, CRNGroup>();
    for (const g of groups) groupByCRN.set(g.crn, g);

    // Track which CRNs have been processed (for crosslist siblings)
    const processedCRNs = new Set<string>();
    const primaryResults = new Map<string, OutputRow[]>();
    const allOutputRows: OutputRow[] = [];

    let totalInputRows = 0;
    let splitCount = 0, alreadySplitCount = 0, passThroughCount = 0, tbaCount = 0, errorCount = 0;

    // Process in original paste order
    const sortedGroups = [...groups].sort((a, b) => {
        const aIdx = a.rows[0]?.rowIndex ?? 0;
        const bIdx = b.rows[0]?.rowIndex ?? 0;
        return aIdx - bIdx;
    });

    for (const group of sortedGroups) {
        totalInputRows += group.rows.length;

        if (processedCRNs.has(group.crn)) continue;
        processedCRNs.add(group.crn);

        const classification = summary.classifications.get(group.crn);
        if (!classification) continue;

        // Check if this is a crosslist sibling (not the primary)
        const isPrimary = !group.xlistCode || crosslistMap.get(group.xlistCode) === group.crn;

        let rows: OutputRow[];

        if (!isPrimary && classification.type === 'split') {
            // Crosslist sibling — copy from primary
            const primaryCRN = crosslistMap.get(group.xlistCode)!;
            const primaryRows = primaryResults.get(primaryCRN);
            if (primaryRows) {
                rows = generateCrosslistSiblingRows(primaryRows, group);
            } else {
                rows = generateOutputRows(group, classification);
            }
        } else {
            rows = generateOutputRows(group, classification);
            if (isPrimary && group.xlistCode) {
                primaryResults.set(group.crn, rows);
            }
        }

        for (const row of rows) {
            switch (row.status) {
                case 'split': splitCount++; break;
                case 'already-split': alreadySplitCount++; break;
                case 'pass-through': passThroughCount++; break;
                case 'tba': tbaCount++; break;
                case 'error': errorCount++; break;
            }
        }

        allOutputRows.push(...rows);
    }

    return {
        outputRows: allOutputRows,
        summary: {
            totalInputRows,
            totalOutputRows: allOutputRows.length,
            splitCount,
            alreadySplitCount,
            passThroughCount,
            tbaCount,
            errorCount
        }
    };
}

/**
 * Quote a cell the way Excel does when copying: any cell containing a tab,
 * newline, CR, or double quote is wrapped in quotes with inner quotes doubled.
 * Without this, Excel's paste parser treats a leading `"` as the start of a
 * quoted field and swallows subsequent tabs/newlines, merging many rows.
 */
export function escapeTsvCell(cell: string): string {
    return /[\t\n\r"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function outputToTsv(results: SplitterResults): string {
    return results.outputRows
        .map(row => row.cells.map(escapeTsvCell).join('\t'))
        .join('\n');
}
