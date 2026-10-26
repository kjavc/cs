import fs from 'fs';
import path from 'path';
import { meetingsPerWeekday, generateSchedule, parseTimeToMinutes } from './scheduleGenerator';
import { computeBlockFit, BlockFitResult } from './blockFit';
import { blockScheduleFor, blockOptionsFor, familiesIn, familyFor, weeklyHoursOf } from './blockSchedule';
import { parseAttendanceAccountingRules } from './ruleParser';
import { academicCalendar } from '../types/calendar';
import { RuleAndTermContext } from '../types';

const rules = parseAttendanceAccountingRules(
    fs.readFileSync(path.join(__dirname, '../data/attendance-method.md'), 'utf8')
);
const term = (id: string) => academicCalendar.find(t => t.id === id)!;
const session = (termId: string, id: string) => term(termId).sessions.find(s => s.id === id)!;
const meetings = (termId: string, sessionId: string) => meetingsPerWeekday(term(termId), session(termId, sessionId), rules);

const fit = (r: ReturnType<typeof computeBlockFit>): BlockFitResult => {
    if ('error' in r) throw new Error(r.error);
    return r;
};

test('DFST 101 (3.5 lec / 0.5 lab) in MW 8:00-10:30, Fall 2026 full term', () => {
    const r = fit(computeBlockFit(3.5, 0.5, ['Mon', 'Wed'], '08:00', '10:30', meetings('fa2026', 'full-term')));
    expect(r.lectureHoursPerDay).toEqual({ Mon: 2.7, Wed: 1.0 });
    expect(r.labHoursPerDay).toEqual({ Wed: 1.6 });
    expect(r.perDay.map(d => d.endTime)).toEqual(['10:25', '10:20']);
    expect(r.overrunMinutes).toBe(0);
    expect(r.meetingPatterns).toBe(3);

    const schedule = generateSchedule(
        { lectureUnits: 3.5, lectureDays: r.lectureDays, labUnits: 0.5, labDays: r.labDays, lecTbaHours: 0, labTbaHours: 0 },
        { contactHourRules: {}, attendanceRules: rules, term: term('fa2026'), session: session('fa2026', 'full-term') } as RuleAndTermContext,
        '08:00', null, { lectureHoursPerDay: r.lectureHoursPerDay, labHoursPerDay: r.labHoursPerDay }
    );
    const spans = schedule.scheduleBlocks.reduce<Record<string, string>>((acc, b) => {
        const key = `${b.type} ${b.dayOfWeek}`;
        acc[key] = acc[key] ? `${acc[key].split('-')[0]}-${b.endTime}` : `${b.startTime}-${b.endTime}`;
        return acc;
    }, {});
    expect(spans).toEqual({ 'lecture Mon': '08:00-10:25', 'lecture Wed': '08:00-08:50', 'lab Wed': '09:00-10:20' });
});

test('reports the closest it can get when nothing fits', () => {
    // 18 CH over 17 Mondays needs 1.1 CH (65 min) a week; the block is 50 minutes
    const r = fit(computeBlockFit(1, 0, ['Mon'], '08:00', '08:50', meetings('fa2026', 'full-term')));
    expect(r.lectureHoursPerDay).toEqual({ Mon: 1.1 });
    expect(r.overrunMinutes).toBe(15);
    expect(r.perDay[0]).toMatchObject({ endTime: '09:05', overrunMinutes: 15 });
});

test('explains a course too small for every day of the block', () => {
    // 18 CH over 19 winter meetings is under 1.0 CH a meeting
    const r = computeBlockFit(1, 0, ['Mon', 'Tue', 'Wed', 'Thu'], '08:00', '08:50', meetings('wi2027', 'full-term'));
    expect(r).toEqual({ error: 'Not enough hours to meet on all 4 days (1.0 CH minimum per meeting).' });
});

test('weekly hours and family', () => {
    expect(weeklyHoursOf(3.5, 0.5)).toBe(5);
    expect(familyFor(3.5, 0.5)).toBe(5);
    expect(familyFor(2, 0.5)).toBe(4); // 3.5 rounds up
    expect(familyFor(3, 1)).toBe(6);
});

test('sessions map to the right sheet', () => {
    const sheetFor = (t: string, s: string) => blockScheduleFor(term(t), session(t, s))?.id ?? null;
    expect(sheetFor('fa2026', 'full-term')).toBe('16wk');
    expect(sheetFor('sp2027', 'late-12')).toBe('12wk');
    expect(sheetFor('fa2026', 'first-8')).toBe('8wk');
    expect(sheetFor('fa2026', 'late-15')).toBeNull();
    expect(sheetFor('fa2026', 'late-14')).toBeNull();
    expect(sheetFor('su2027', 'full-8')).toBe('8wk');
    expect(sheetFor('su2027', 'second-6')).toBe('6wk');
    expect(sheetFor('su2027', 'first-4')).toBeNull();
    expect(sheetFor('wi2027', 'full-term')).toBe('5wk');
});

test('6-hour lecture/lab courses get the lec/lab windows in place of standard MW/TR', () => {
    const sheet = blockScheduleFor(term('fa2026'), session('fa2026', 'full-term'))!;
    const starts = (opts: ReturnType<typeof blockOptionsFor>, code: string) =>
        Array.from(new Set(opts.filter(o => o.daysCode === code).map(o => o.start)));
    const mixed = blockOptionsFor(sheet, 6, true);
    expect(starts(mixed, 'MW|TR')).toContain('13:00');
    expect(starts(mixed, 'MW|TR')).not.toContain('12:30');
    expect(starts(mixed, 'MTWR').length).toBeGreaterThan(0);
    const lectureOnly = blockOptionsFor(sheet, 6, false);
    expect(starts(lectureOnly, 'MW|TR')).toContain('12:30');
});

test('every block option produces a schedule the generator accepts, ending where reported', () => {
    const terms = ['fa2026', 'sp2027', 'wi2027', 'su2027'];
    let checked = 0;
    for (const t of terms) {
        for (const s of term(t).sessions) {
            const sheet = blockScheduleFor(term(t), s);
            if (!sheet) continue;
            const context = { contactHourRules: {}, attendanceRules: rules, term: term(t), session: s } as RuleAndTermContext;
            const m = meetingsPerWeekday(term(t), s, rules);
            for (const h of familiesIn(sheet)) {
                for (const lab of [0, 0.5, 1, 1.5, 2]) {
                    const lec = h - lab * 3;
                    if (lec < 0) continue;
                    for (const o of blockOptionsFor(sheet, h, lec > 0 && lab > 0)) {
                        const r = computeBlockFit(lec, lab, o.days, o.start, o.end, m);
                        if ('error' in r) continue;
                        const schedule = generateSchedule(
                            { lectureUnits: lec, lectureDays: r.lectureDays, labUnits: lab, labDays: r.labDays, lecTbaHours: 0, labTbaHours: 0 },
                            context, o.start, null, { lectureHoursPerDay: r.lectureHoursPerDay, labHoursPerDay: r.labHoursPerDay }
                        );
                        expect(schedule.warnings.filter(w => w.startsWith('ERROR'))).toEqual([]);
                        for (const d of r.perDay) {
                            const last = Math.max(...schedule.scheduleBlocks.filter(b => b.dayOfWeek === d.day).map(b => parseTimeToMinutes(b.endTime)));
                            expect(last).toBe(parseTimeToMinutes(d.endTime));
                            expect(d.overrunMinutes).toBe(Math.max(0, last - parseTimeToMinutes(o.end)));
                        }
                        checked++;
                    }
                }
            }
        }
    }
    expect(checked).toBeGreaterThan(2000);
});
