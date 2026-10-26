// src/utils/spreadsheetExport.ts
import { SavedSection, AcademicTerm, AttendanceAccountingRules, TermSession, RuleAndTermContext } from '../types';

import { getSessionDates } from './dateUtils';
import { calculateComponentFields, meetingsPerWeekday, uniformMeetings, generateSchedule, ComponentFields } from './scheduleGenerator';

// One exported row: a component on the days that share the same times and hours
interface PatternRow {
    days: string[];
    startTime: string;
    fields: ComponentFields;
}

// Days don't all meet the same way when the split is custom, start times are per-day, or the lab
// follows lecture on shared days (no separate lab time). Those export one row per meeting pattern.
function hasMeetingPatterns(section: SavedSection): boolean {
    if (section.fixedHours) return false;
    if (section.lectureSplitMode === 'custom' || section.labSplitMode === 'custom') return true;
    if (section.lectureTimeMode === 'perDay' || section.labTimeMode === 'perDay') return true;
    return !section.labStartTime && section.lectureUnits > 0 && section.labUnits > 0
        && section.lectureDays.some(d => section.labDays.includes(d));
}

// Meeting-pattern rows built from the generator's blocks, so times and hours match the grid.
// Null if the section doesn't generate cleanly (the caller falls back to one row per component).
function patternRows(
    section: SavedSection,
    term: AcademicTerm,
    session: TermSession,
    attendanceRules: AttendanceAccountingRules,
    meetingsByDay: Record<string, number>
): { lecture: PatternRow[]; lab: PatternRow[] } | null {
    const context = { attendanceRules, term, session } as RuleAndTermContext;
    const schedule = generateSchedule(
        {
            lectureUnits: section.lectureUnits, lectureDays: section.lectureDays, lecTbaHours: section.lecTbaHours || 0,
            labUnits: section.labUnits, labDays: section.labDays, labTbaHours: section.labTbaHours || 0
        },
        context, section.startTime, section.labStartTime,
        {
            lectureTimesPerDay: section.lectureTimeMode === 'perDay' ? section.lectureTimesPerDay : undefined,
            labTimesPerDay: section.labTimeMode === 'perDay' ? section.labTimesPerDay : undefined,
            lectureHoursPerDay: section.lectureSplitMode === 'custom' ? section.lectureHoursPerDay : undefined,
            labHoursPerDay: section.labSplitMode === 'custom' ? section.labHoursPerDay : undefined,
            hoursRule: section.hoursRule,
        }
    );
    if (schedule.warnings.some(w => w.startsWith('ERROR')) || schedule.scheduleBlocks.length === 0) return null;

    const build = (type: 'lecture' | 'lab', days: string[], tbaHours: number): PatternRow[] => {
        const rows: PatternRow[] = [];
        for (const day of days) {
            const blocks = schedule.scheduleBlocks.filter(b => b.type === type && b.dayOfWeek === day);
            if (blocks.length === 0) continue;
            const start = blocks[0].startTime;
            const end = blocks[blocks.length - 1].endTime;
            const ch = Math.round(blocks.reduce((sum, b) => sum + b.instructionalMinutes, 0) / 50 * 10) / 10;
            const row = rows.find(r => r.startTime === start && r.fields.endTime === end && r.fields.hrsPerDay === ch.toFixed(1));
            if (row) row.days.push(day);
            else rows.push({ days: [day], startTime: start, fields: { endTime: end, hrsPerDay: ch.toFixed(1), hrsPerWeek: '', hrsTotal: '' } });
        }
        rows.forEach((row, i) => {
            const ch = parseFloat(row.fields.hrsPerDay);
            const meetings = row.days.reduce((sum, d) => sum + (meetingsByDay[d] || 0), 0);
            row.fields.hrsPerWeek = (ch * row.days.length).toFixed(1);
            // TBA hours ride on the component's first row, as in the single-row export
            row.fields.hrsTotal = (ch * meetings + (i === 0 ? tbaHours : 0)).toFixed(1);
        });
        return rows;
    };
    return {
        lecture: build('lecture', section.lectureDays, section.lecTbaHours || 0),
        lab: build('lab', section.labDays, section.labTbaHours || 0),
    };
}

/**
 * Generates a Tab-Separated Values (TSV) string formatted for a specific
 * registrar spreadsheet layout (26 columns, A-Z).
 * 
 * Column Mapping:
 * D (3): sub
 * E (4): #
 * F (5): sec
 * G (6): days
 * H (7): s time
 * I (8): e time
 * N (13): s date
 * O (14): e date
 * P (15): hrs/d
 * Q (16): hrs/wk
 * R (17): hrs/ttl
 * X (23): Type (Lecture/Lab)
 * 
 * All other columns (A-C, J-M, S-W, Y-Z) are padded with empty strings.
 */
export function exportForSpreadsheet(
    sections: SavedSection[],
    calendar: AcademicTerm[],
    attendanceRules: AttendanceAccountingRules | null
): string {
    const rows: string[][] = [];

    sections.forEach(section => {
        const term = calendar.find(t => t.id === section.selectedTermId) || calendar[0];
        const session = term.sessions.find(s => s.id === section.selectedSessionId) || term.sessions[0];
        // Fixed-hours courses meet on one date the app doesn't track: leave dates for the user to fill in
        const { startDate, endDate } = section.fixedHours ? { startDate: '', endDate: '' } : getSessionDates(term, session);
        // Holiday-aware meeting counts, same as the schedule generator
        const meetingsByDay = attendanceRules ? meetingsPerWeekday(term, session, attendanceRules) : uniformMeetings(session.weeks);

        // Attempt to parse sub/no/sec from the name if it follows the "SUB NO XX" pattern
        const nameParts = section.name.split(' ');
        const sub = nameParts[0] || '';
        const no = nameParts[1] || '';
        const secNo = nameParts[2] || '';

        const pushRow = (pattern: PatternRow, type: string) => {
            const row = new Array(26).fill('');
            row[3] = sub;             // D: sub
            row[4] = no;              // E: #
            row[5] = secNo;           // F: sec
            row[6] = pattern.days.join(''); // G: days
            row[7] = pattern.startTime; // H: s time
            row[8] = pattern.fields.endTime; // I: e time
            row[13] = startDate;      // N: s date
            row[14] = endDate;        // O: e date
            row[15] = pattern.fields.hrsPerDay;  // P: hrs/d
            row[16] = pattern.fields.hrsPerWeek; // Q: hrs/wk
            row[17] = pattern.fields.hrsTotal;   // R: hrs/ttl
            row[23] = type;           // X: Type (comments column)
            rows.push(row);
        };

        // Uneven days: one row per meeting pattern
        const patterns = attendanceRules && hasMeetingPatterns(section)
            ? patternRows(section, term, session, attendanceRules, meetingsByDay)
            : null;
        if (patterns) {
            patterns.lecture.forEach((p, i) => pushRow(p, `Lecture${i === 0 && section.lecTbaHours ? ` (+${section.lecTbaHours} TBA hrs)` : ''}`));
            patterns.lab.forEach((p, i) => pushRow(p, `Lab${i === 0 && section.labTbaHours ? ` (+${section.labTbaHours} TBA hrs)` : ''}`));
            return;
        }

        // 1. Lecture Row
        if (section.lectureUnits > 0) {
            const lec = calculateComponentFields(
                section.lectureUnits,
                false,
                section.lectureDays,
                section.startTime,
                meetingsByDay,
                section.lecTbaHours || 0,
                section.fixedHours?.lec
            );

            const row = new Array(26).fill('');
            row[3] = sub;             // D: sub
            row[4] = no;              // E: #
            row[5] = secNo;           // F: sec
            row[6] = section.lectureDays.join(''); // G: days
            row[7] = section.startTime; // H: s time
            row[8] = lec.endTime;     // I: e time
            row[13] = startDate;      // N: s date
            row[14] = endDate;        // O: e date
            row[15] = lec.hrsPerDay;  // P: hrs/d
            row[16] = lec.hrsPerWeek; // Q: hrs/wk
            row[17] = lec.hrsTotal;   // R: hrs/ttl
            row[23] = `Lecture${section.lecTbaHours ? ` (+${section.lecTbaHours} TBA hrs)` : ''}`;      // X: Type (comments column)

            rows.push(row);
        }

        // 2. Lab Row
        if (section.labUnits > 0) {
            const labStart = section.labStartTime || section.startTime;
            const lab = calculateComponentFields(
                section.labUnits,
                true,
                section.labDays,
                labStart,
                meetingsByDay,
                section.labTbaHours || 0,
                section.fixedHours?.lab
            );

            const row = new Array(26).fill('');
            row[3] = sub;             // D: sub
            row[4] = no;              // E: #
            row[5] = secNo;           // F: sec
            row[6] = section.labDays.join(''); // G: days
            row[7] = labStart;        // H: s time
            row[8] = lab.endTime;     // I: e time
            row[13] = startDate;      // N: s date
            row[14] = endDate;        // O: e date
            row[15] = lab.hrsPerDay;  // P: hrs/d
            row[16] = lab.hrsPerWeek; // Q: hrs/wk
            row[17] = lab.hrsTotal;   // R: hrs/ttl
            row[23] = `Lab${section.labTbaHours ? ` (+${section.labTbaHours} TBA hrs)` : ''}`;          // X: Type (comments column)

            rows.push(row);
        }
    });

    // Join rows with tabs and then with newlines
    return rows.map(r => r.join('\t')).join('\n');
}
