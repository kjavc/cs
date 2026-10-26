import fs from 'fs';
import path from 'path';
import { meetingsPerWeekday, generateSchedule, parseTimeToMinutes } from './scheduleGenerator';
import { computeBlockFit, BlockFitResult } from './blockFit';
import { blockHoursRange, isFullSemester, withinRange } from './blockHours';
import { exportForSpreadsheet } from './spreadsheetExport';
import { SavedSection } from '../types';
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
    const r = fit(computeBlockFit(3.5, 0.5, ['Mon', 'Wed'], '08:00', '10:30', meetings('fa2026', 'full-term'), true));
    expect(r.lectureHoursPerDay).toEqual({ Mon: 2.7, Wed: 1.0 });
    expect(r.labHoursPerDay).toEqual({ Wed: 1.6 });
    expect(r.perDay.map(d => d.endTime)).toEqual(['10:25', '10:20']);
    expect(r.overrunMinutes).toBe(0);
    expect(r.meetingPatterns).toBe(3);
    expect(r).toMatchObject({ lectureHours: 62.9, lectureTarget: 63, labHours: 27.2, labTarget: 27 });

    const schedule = generateSchedule(
        { lectureUnits: 3.5, lectureDays: r.lectureDays, labUnits: 0.5, labDays: r.labDays, lecTbaHours: 0, labTbaHours: 0 },
        { contactHourRules: {}, attendanceRules: rules, term: term('fa2026'), session: session('fa2026', 'full-term') } as RuleAndTermContext,
        '08:00', null, { lectureHoursPerDay: r.lectureHoursPerDay, labHoursPerDay: r.labHoursPerDay, hoursRule: 'blockFit' }
    );
    const spans = schedule.scheduleBlocks.reduce<Record<string, string>>((acc, b) => {
        const key = `${b.type} ${b.dayOfWeek}`;
        acc[key] = acc[key] ? `${acc[key].split('-')[0]}-${b.endTime}` : `${b.startTime}-${b.endTime}`;
        return acc;
    }, {});
    expect(spans).toEqual({ 'lecture Mon': '08:00-10:25', 'lecture Wed': '08:00-08:50', 'lab Wed': '09:00-10:20' });
});

test('reports the closest it can get when nothing fits', () => {
    // DFST 101's lab needs at least 25.5 hrs (1.5 CH a week = 75 min on one day); the block is 65 minutes
    const r = fit(computeBlockFit(3.5, 0.5, ['Mon', 'Tue', 'Wed', 'Thu'], '08:00', '09:05', meetings('fa2026', 'full-term'), true));
    expect(r.overrunMinutes).toBe(10);
    expect(r.labHoursPerDay).toEqual({ Thu: 1.5 });
    expect(r.perDay[3]).toMatchObject({ day: 'Thu', endTime: '09:15', overrunMinutes: 10 });
});

test('full term: 1 lecture unit fits a 50-minute block at 17 hrs (within a week of 18)', () => {
    const r = fit(computeBlockFit(1, 0, ['Mon'], '08:00', '08:50', meetings('fa2026', 'full-term'), true));
    expect(r).toMatchObject({ overrunMinutes: 0, lectureHours: 17, lectureHoursPerDay: { Mon: 1.0 } });
});

test('short sessions target a week under the catalog hours', () => {
    // 8-week 5-hour block MTWR 8:00-10:25; DFST 101 targets 59.5 lecture / 25.5 lab
    const r = fit(computeBlockFit(3.5, 0.5, ['Mon', 'Tue', 'Wed', 'Thu'], '08:00', '10:25', meetings('fa2026', 'first-8'), false));
    expect(r.overrunMinutes).toBe(0);
    expect(r).toMatchObject({ lectureTarget: 59.5, labTarget: 25.5 });
    expect(withinRange(r.lectureHours, blockHoursRange(63, false))).toBe(true);
    expect(withinRange(r.labHours, blockHoursRange(27, false))).toBe(true);
});

test('Block Fit hours range', () => {
    expect(blockHoursRange(54, true)).toEqual({ target: 54, min: 51, max: 57 });
    expect(blockHoursRange(54, false)).toEqual({ target: 51, min: 46.5, max: 52.5 });
    expect(isFullSemester(term('fa2026'), session('fa2026', 'full-term'))).toBe(true);
    expect(isFullSemester(term('fa2026'), session('fa2026', 'late-12'))).toBe(false);
    expect(isFullSemester(term('wi2027'), session('wi2027', 'full-term'))).toBe(false);
    expect(isFullSemester(term('su2027'), session('su2027', 'full-8'))).toBe(false);
});

test('generator applies the Block Fit range only to Block Fit sections', () => {
    // 8-week lecture-only, 3 units (54 hrs; Block Fit 46.5–52.5): 1.6 CH × 31 meetings (Labor Day) = 49.6 hrs
    const m = meetings('fa2026', 'first-8');
    const days = ['Mon', 'Tue', 'Wed', 'Thu'];
    const hours = { Mon: 1.6, Tue: 1.6, Wed: 1.6, Thu: 1.6 };
    const request = { lectureUnits: 3, lectureDays: days, labUnits: 0, labDays: [], lecTbaHours: 0, labTbaHours: 0 };
    const context = { contactHourRules: {}, attendanceRules: rules, term: term('fa2026'), session: session('fa2026', 'first-8') } as RuleAndTermContext;
    expect(days.reduce((s, d) => s + 1.6 * m[d], 0)).toBeCloseTo(49.6);
    const standard = generateSchedule(request, context, '08:00', null, { lectureHoursPerDay: hours });
    expect(standard.warnings.some(w => w.startsWith('ERROR'))).toBe(true);
    const block = generateSchedule(request, context, '08:00', null, { lectureHoursPerDay: hours, hoursRule: 'blockFit' });
    expect(block.warnings.filter(w => w.startsWith('ERROR'))).toEqual([]);
});

test('spreadsheet export writes one row per meeting pattern', () => {
    const section: SavedSection = {
        id: '1', name: 'DFST 101 01', timestamp: 0,
        lectureUnits: 3.5, lectureDays: ['Mon', 'Wed'], labUnits: 0.5, labDays: ['Wed'],
        startTime: '08:00', labStartTime: null, selectedTermId: 'fa2026', selectedSessionId: 'full-term',
        schemaVersion: 2, lectureTimeMode: 'shared', labTimeMode: 'shared', lectureTimesPerDay: {}, labTimesPerDay: {},
        lectureSplitMode: 'custom', labSplitMode: 'custom',
        lectureHoursPerDay: { Mon: 2.7, Wed: 1.0 }, labHoursPerDay: { Wed: 1.6 }, hoursRule: 'blockFit'
    };
    const rows = exportForSpreadsheet([section], academicCalendar, rules).split('\n').map(r => r.split('\t'));
    const pick = (r: string[]) => [r[6], r[7], r[8], r[15], r[16], r[17], r[23]];
    expect(rows.map(pick)).toEqual([
        ['Mon', '08:00', '10:25', '2.7', '2.7', '45.9', 'Lecture'],
        ['Wed', '08:00', '08:50', '1.0', '1.0', '17.0', 'Lecture'],
        ['Wed', '09:00', '10:20', '1.6', '1.6', '27.2', 'Lab'],
    ]);
});

test('spreadsheet export keeps one row per component for even, separate-day sections', () => {
    const section: SavedSection = {
        id: '2', name: 'ENGL 101 01', timestamp: 0,
        lectureUnits: 3, lectureDays: ['Mon', 'Wed'], labUnits: 0, labDays: [],
        startTime: '08:00', labStartTime: null, selectedTermId: 'fa2026', selectedSessionId: 'full-term'
    };
    const rows = exportForSpreadsheet([section], academicCalendar, rules).split('\n');
    expect(rows).toHaveLength(1);
    expect(rows[0].split('\t')[6]).toBe('MonWed');
});

test('prefers hours closest to target', () => {
    // 2.8 + 1.0 lecture would also fit MW 8:00-10:30, but 64.6 is further from 63 than 62.9
    const r = fit(computeBlockFit(3.5, 0.5, ['Mon', 'Wed'], '08:00', '10:30', meetings('fa2026', 'full-term'), true));
    expect(r.lectureHours).toBe(62.9);
});

test('explains a course too small for every day of the block', () => {
    // 18 CH over 19 winter meetings is under 1.0 CH a meeting
    const r = computeBlockFit(1, 0, ['Mon', 'Tue', 'Wed', 'Thu'], '08:00', '08:50', meetings('wi2027', 'full-term'), false);
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
                        const r = computeBlockFit(lec, lab, o.days, o.start, o.end, m, isFullSemester(term(t), s));
                        if ('error' in r) continue;
                        const schedule = generateSchedule(
                            { lectureUnits: lec, lectureDays: r.lectureDays, labUnits: lab, labDays: r.labDays, lecTbaHours: 0, labTbaHours: 0 },
                            context, o.start, null, { lectureHoursPerDay: r.lectureHoursPerDay, labHoursPerDay: r.labHoursPerDay, hoursRule: 'blockFit' }
                        );
                        expect(schedule.warnings.filter(w => w.startsWith('ERROR'))).toEqual([]);
                        const full = isFullSemester(term(t), s);
                        if (lec > 0) expect(withinRange(r.lectureHours, blockHoursRange(lec * 18, full))).toBe(true);
                        if (lab > 0) expect(withinRange(r.labHours, blockHoursRange(lab * 54, full))).toBe(true);
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
