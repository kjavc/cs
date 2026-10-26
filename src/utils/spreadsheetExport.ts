// src/utils/spreadsheetExport.ts
import { SavedSection, AcademicTerm, AttendanceAccountingRules } from '../types';

import { getSessionDates } from './dateUtils';
import { calculateComponentFields, meetingsPerWeekday, uniformMeetings } from './scheduleGenerator';

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
