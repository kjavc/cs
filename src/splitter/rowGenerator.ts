import { CRNGroup, SectionClassification, OutputRow, SplitterStatus, COL,
    DAY_FULL_TO_CHAR, DAY_CHAR_TO_FULL, DAY_ORDER, OUTPUT_COL_COUNT } from './types';
import { computeSmartSplit } from '../utils/smartSplit';
import { calculateComponentFields } from '../utils/scheduleGenerator';
import { instructorsOf, meetingPatternKey } from './classifier';

export function daysToCharCodes(days: string[]): string {
    return DAY_ORDER
        .filter(d => days.includes(d))
        .map(d => DAY_FULL_TO_CHAR[d] || '')
        .join('');
}

export function charCodesToDays(codes: string): string[] {
    const days: string[] = [];
    for (const ch of codes) {
        const full = DAY_CHAR_TO_FULL[ch];
        if (full && !days.includes(full)) days.push(full);
    }
    return days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

function detectSesFormat(group: CRNGroup): (n: number) => string {
    const sample = group.rows[0]?.cells[COL.SES_NUM]?.trim() || '1';
    if (sample.match(/^0\d+$/)) {
        const width = sample.length;
        return (n: number) => String(n).padStart(width, '0');
    }
    return (n: number) => String(n);
}

function makeOutputRow(
    cells: string[],
    status: SplitterStatus,
    statusDetail: string,
    sourceCRN: string,
    originalRowIndex: number
): OutputRow {
    const out = [...cells];
    while (out.length < OUTPUT_COL_COUNT - 1) out.push('');
    const statusText = status === 'error' ? `Error: ${statusDetail}` :
        status === 'split' ? 'Split' :
            status === 'already-split' ? 'OK' :
                status === 'tba' ? 'TBA' : 'OK';
    out.push(statusText);
    return { cells: out, status, statusDetail, sourceCRN, originalRowIndex };
}

export function generateOutputRows(
    group: CRNGroup,
    classification: SectionClassification
): OutputRow[] {
    if (classification.type !== 'split') {
        const status: SplitterStatus = classification.type === 'error' ? 'error' :
            classification.type === 'tba' ? 'tba' :
                classification.type === 'already-split' ? 'already-split' : 'pass-through';
        const detail = classification.type === 'error' ? classification.message :
            classification.type === 'pass-through' ? classification.reason : '';

        return group.rows.map(row =>
            makeOutputRow(row.cells, status, detail, group.crn, row.rowIndex)
        );
    }

    // Split target
    const { lecUnits, labUnits, weeks, meetingsByDay, startTime, days, fixedHours } = classification;
    // Fixed-hours courses: lecture then lab on the one day
    const result = fixedHours
        ? { lectureDays: fixedHours.lec > 0 ? days : [], labDays: fixedHours.lab > 0 ? days : [] }
        : computeSmartSplit(lecUnits, labUnits, days, weeks, meetingsByDay);

    if ('error' in result) {
        return group.rows.map(row =>
            makeOutputRow(row.cells, 'error', result.error, group.crn, row.rowIndex)
        );
    }

    const templateRow = group.rows[0].cells;
    const formatSes = detectSesFormat(group);
    const outputRows: OutputRow[] = [];
    let sesCounter = 1;
    // One output row per instructor on the section (Banner lists each instructor separately)
    const instructors = instructorsOf(group);
    const pushForEachInstructor = (cells: string[], detail: string) => {
        for (const inst of instructors) {
            const copy = [...cells];
            copy[COL.ID] = inst.id;
            copy[COL.FACULTY] = inst.faculty;
            outputRows.push(makeOutputRow(copy, 'split', detail, group.crn, inst.rowIndex));
        }
    };

    // Lecture row
    if (lecUnits > 0 && result.lectureDays.length > 0) {
        const lecDaysStr = daysToCharCodes(result.lectureDays);
        const lecFields = calculateComponentFields(lecUnits, false, result.lectureDays, startTime, meetingsByDay, 0, fixedHours?.lec);

        const lecCells = [...templateRow];
        lecCells[COL.DAYS] = lecDaysStr;
        lecCells[COL.S_TIME] = startTime;
        lecCells[COL.E_TIME] = lecFields.endTime;
        lecCells[COL.SES_NUM] = formatSes(sesCounter++);
        lecCells[COL.HRS_D] = lecFields.hrsPerDay;
        lecCells[COL.HRS_WK] = lecFields.hrsPerWeek;
        lecCells[COL.HRS_TTL] = lecFields.hrsTotal;
        lecCells[COL.LHE] = '';
        lecCells[COL.MT] = 'L';

        pushForEachInstructor(lecCells, 'lecture');
    }

    // Lab row — starts after lecture ends + 10 min passing time
    if (labUnits > 0 && result.labDays.length > 0) {
        const labDaysStr = daysToCharCodes(result.labDays);

        let labStart = startTime;
        if (lecUnits > 0 && result.lectureDays.length > 0) {
            const lecEnd = calculateComponentFields(lecUnits, false, result.lectureDays, startTime, meetingsByDay, 0, fixedHours?.lec).endTime;
            const [eh, em] = lecEnd.split(':').map(Number);
            const labStartMin = eh * 60 + em + 10;
            labStart = `${String(Math.floor(labStartMin / 60)).padStart(2, '0')}:${String(labStartMin % 60).padStart(2, '0')}`;
        }

        const labFields = calculateComponentFields(labUnits, true, result.labDays, labStart, meetingsByDay, 0, fixedHours?.lab);

        const labCells = [...templateRow];
        labCells[COL.DAYS] = labDaysStr;
        labCells[COL.S_TIME] = labStart;
        labCells[COL.E_TIME] = labFields.endTime;
        labCells[COL.SES_NUM] = formatSes(sesCounter++);
        labCells[COL.HRS_D] = labFields.hrsPerDay;
        labCells[COL.HRS_WK] = labFields.hrsPerWeek;
        labCells[COL.HRS_TTL] = labFields.hrsTotal;
        labCells[COL.LHE] = '';
        labCells[COL.MT] = 'B';

        pushForEachInstructor(labCells, 'lab');
    }

    return outputRows;
}

export function generateCrosslistSiblingRows(
    primaryRows: OutputRow[],
    siblingGroup: CRNGroup
): OutputRow[] {
    // The primary may carry one row per instructor; the sibling gets each meeting pattern
    // once per *its* instructors instead.
    const seen = new Set<string>();
    const patterns = primaryRows.filter(r => {
        const key = meetingPatternKey(r.cells);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const sibRow = siblingGroup.rows[0]?.cells;
    const instructors = instructorsOf(siblingGroup);
    if (instructors.length === 0) instructors.push({ id: '', faculty: '', rowIndex: siblingGroup.rows[0]?.rowIndex ?? 0 });
    const out: OutputRow[] = [];
    for (const primaryRow of patterns) {
        for (const inst of instructors) {
            const cells = [...primaryRow.cells];
            // Replace CRN-specific fields with sibling's values
            if (sibRow) {
                cells[COL.CRN] = sibRow[COL.CRN];
                cells[COL.SUB] = sibRow[COL.SUB];
                cells[COL.NUM] = sibRow[COL.NUM];
                cells[COL.SEC] = sibRow[COL.SEC];
                cells[COL.MAX] = sibRow[COL.MAX];
                cells[COL.WAIT] = sibRow[COL.WAIT];
            }
            cells[COL.ID] = inst.id;
            cells[COL.FACULTY] = inst.faculty;
            out.push({ ...primaryRow, cells, sourceCRN: siblingGroup.crn, originalRowIndex: inst.rowIndex });
        }
    }
    return out;
}
