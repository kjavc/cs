import fs from 'fs';
import path from 'path';
import { meetingsPerWeekday, calculateComponentFields, uniformMeetings } from './scheduleGenerator';
import { computeSmartSplit } from './smartSplit';
import { parseAttendanceAccountingRules } from './ruleParser';
import { academicCalendar } from '../types/calendar';

const rules = parseAttendanceAccountingRules(
    fs.readFileSync(path.join(__dirname, '../data/attendance-method.md'), 'utf8')
);
const term = (id: string) => academicCalendar.find(t => t.id === id)!;
const session = (termId: string, id: string) => term(termId).sessions.find(s => s.id === id)!;
const MTWRF = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

test('summer 2026 full session excludes 6/19, 7/3, 7/4', () => {
    const m = meetingsPerWeekday(term('su2026'), session('su2026', 'full-8'), rules);
    expect(m).toMatchObject({ Mon: 8, Tue: 8, Wed: 8, Thu: 8, Fri: 6, Sat: 7 });
});

test('summer 2027 full session excludes 6/18, 6/19, 7/5', () => {
    const m = meetingsPerWeekday(term('su2027'), session('su2027', 'full-8'), rules);
    expect(m).toMatchObject({ Mon: 7, Tue: 8, Wed: 8, Thu: 8, Fri: 7, Sat: 7 });
});

test('full-term semester ignores holidays', () => {
    const m = meetingsPerWeekday(term('fa2026'), session('fa2026', 'full-term'), rules);
    expect(m).toEqual(uniformMeetings(17));
});

test('AERO 120 (5 lec / 2.5 lab) MTWRF 8:00 in summer 2026', () => {
    const m = meetingsPerWeekday(term('su2026'), session('su2026', 'full-8'), rules);
    const lec = calculateComponentFields(5, false, MTWRF, '08:00', m);
    expect(lec).toEqual({ endTime: '10:10', hrsPerDay: '2.4', hrsPerWeek: '12.0', hrsTotal: '91.2' });
    const lab = calculateComponentFields(2.5, true, MTWRF, '10:20', m);
    expect(lab).toEqual({ endTime: '13:40', hrsPerDay: '3.6', hrsPerWeek: '18.0', hrsTotal: '136.8' });
});

test('smart split with holidays meets required hours', () => {
    const m = meetingsPerWeekday(term('su2027'), session('su2027', 'first-6'), rules);
    for (const days of [MTWRF, ['Mon', 'Wed'], ['Mon', 'Tue', 'Wed', 'Thu']]) {
        const r = computeSmartSplit(3, 1, days, 6, m);
        if ('error' in r) continue;
        const lecTotal = r.lectureDays.reduce((s, d) => s + r.lectureHoursPerDay[d] * m[d], 0);
        const labTotal = r.labDays.reduce((s, d) => s + r.labHoursPerDay[d] * m[d], 0);
        // Per-meeting rounding to 0.1 CH allows up to 0.05 CH drift per meeting
        const meetings = (ds: string[]) => ds.reduce((s, d) => s + m[d], 0);
        expect(Math.abs(lecTotal - 54)).toBeLessThanOrEqual(0.05 * meetings(r.lectureDays) + 1e-9);
        expect(Math.abs(labTotal - 54)).toBeLessThanOrEqual(0.05 * meetings(r.labDays) + 1e-9);
    }
});
