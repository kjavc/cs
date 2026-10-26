import fs from 'fs';
import path from 'path';
import { generateSchedule, calculateComponentFields, meetingsPerWeekday } from './scheduleGenerator';
import { parseAttendanceAccountingRules } from './ruleParser';
import { academicCalendar } from '../types/calendar';
import { catalogForTerm } from './catalogForTerm';
import { buildCatalogIndex, lookupCourse } from '../splitter/catalogLookup';
import { fixedHoursOf } from '../hooks/useCatalog';

const attendanceRules = parseAttendanceAccountingRules(
    fs.readFileSync(path.join(__dirname, '../data/attendance-method.md'), 'utf8')
);
const term = academicCalendar.find(t => t.id === 'fa2026')!;
const session = term.sessions.find(s => s.id === 'full-term')!;
const context = { contactHourRules: {} as any, attendanceRules, term, session };
const WELD = { lec: 1, lab: 9 };
const request = (lectureDays: string[], labDays: string[]) => ({
    lectureUnits: 1 / 18, lectureDays, labUnits: 9 / 54, labDays, fixedHours: WELD,
});

test('WELD 900/901 are 1 lec + 9 lab hours in both catalogs', () => {
    for (const t of ['fa2025', 'fa2026']) {
        const index = buildCatalogIndex(catalogForTerm(t).catalog);
        for (const no of ['900', '901']) {
            expect(fixedHoursOf(lookupCourse(index, 'WELD', no)!.course)).toEqual(WELD);
        }
    }
});

test('fixed-hours section meets once on its day, ignoring the term calendar', () => {
    const s = generateSchedule(request(['Sat'], ['Sat']), context, '08:00', null);
    expect(s.warnings).toEqual([]);
    expect(s.lectureInfo).toMatchObject({ contactHoursForTerm: 1, actualMeetingDays: 1, contactHoursPerDay: 1 });
    expect(s.labInfo).toMatchObject({ contactHoursForTerm: 9, actualMeetingDays: 1, contactHoursPerDay: 9 });
    const lec = s.scheduleBlocks.filter(b => b.type === 'lecture');
    const lab = s.scheduleBlocks.filter(b => b.type === 'lab');
    expect([lec[0].startTime, lec[lec.length - 1].endTime]).toEqual(['08:00', '08:50']);
    expect(lab[0].startTime).toBe('09:00');
    expect(lab[lab.length - 1].endTime).toBe(calculateComponentFields(0, true, ['Sat'], '09:00', {}, 0, 9).endTime);
});

test('fixed-hours section rejects more than one day', () => {
    const s = generateSchedule(request(['Sat'], ['Fri', 'Sat']), context, '08:00', null);
    expect(s.scheduleBlocks).toEqual([]);
    expect(s.warnings.join(' ')).toMatch(/meets once/);
});

test('fixed-hours component fields: one meeting, full total', () => {
    const m = meetingsPerWeekday(term, session, attendanceRules);
    expect(calculateComponentFields(0, false, ['Sat'], '08:00', m, 0, 1))
        .toEqual({ endTime: '08:50', hrsPerDay: '1.0', hrsPerWeek: '1.0', hrsTotal: '1.0' });
    expect(calculateComponentFields(0, true, ['Sat'], '09:00', m, 0, 9).hrsTotal).toBe('9.0');
});
