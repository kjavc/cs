import fs from 'fs';
import path from 'path';
import { parseAndGroup, classifyGroups, processGroups } from './pipeline';
import { rollGroups, rollTargetsFor, detectSourceTerm, rollToTsv, rollToHtml, ROLL_NOTES_COL } from './roll';
import { COL } from './types';
import { parseAttendanceAccountingRules } from '../utils/ruleParser';
import { academicCalendar } from '../types/calendar';

const rules = parseAttendanceAccountingRules(
    fs.readFileSync(path.join(__dirname, '../data/attendance-method.md'), 'utf8')
);
const term = (id: string) => academicCalendar.find(t => t.id === id)!;

interface R { crn: string; sub: string; num: string; days: string; s: string; e: string; ttl: string; mt: string;
    fac?: string; id?: string; bldg?: string; rm?: string; sd?: string; ed?: string; lhe?: string; ses?: string }
const tsv = (rows: R[]) => rows.map(r => {
    const c = new Array(26).fill('');
    c[COL.ID] = r.id ?? ''; c[COL.FACULTY] = r.fac ?? ''; c[COL.CRN] = r.crn; c[COL.SUB] = r.sub; c[COL.NUM] = r.num; c[COL.SEC] = '01';
    c[COL.DAYS] = r.days; c[COL.S_TIME] = r.s; c[COL.E_TIME] = r.e; c[COL.SES_NUM] = r.ses ?? '01';
    c[COL.BLDG] = r.bldg ?? ''; c[COL.RM] = r.rm ?? ''; c[COL.S_DATE] = r.sd ?? '6/15/26'; c[COL.E_DATE] = r.ed ?? '8/7/26';
    c[COL.HRS_TTL] = r.ttl; c[COL.LHE] = r.lhe ?? ''; c[COL.MT] = r.mt;
    return c.join('\t');
}).join('\n');

const roll = (rows: R[], from = 'su2026', to = 'su2027') =>
    rollGroups(parseAndGroup(tsv(rows)).groups, term(from), term(to), rules);
const byCrn = (res: ReturnType<typeof roll>, crn: string) => res.outputRows.filter(r => r.sourceCRN === crn);

test('targets are like-to-like, later years only', () => {
    expect(rollTargetsFor(term('su2026'), academicCalendar).map(t => t.id)).toEqual(['su2027', 'su2028']);
    expect(rollTargetsFor(term('fa2026'), academicCalendar).map(t => t.id)).toEqual(['fa2027']);
    expect(rollTargetsFor(term('su2028'), academicCalendar)).toEqual([]);
});

test('source term detected from dates', () => {
    const { groups } = parseAndGroup(tsv([{ crn: '1', sub: 'ENGL', num: '101', days: 'MW', s: '10:00', e: '13:10', ttl: '54.4', mt: 'L' }]));
    expect(detectSourceTerm(groups, academicCalendar)?.id).toBe('su2026');
});

test('combined section re-dated and split, catalogs agree', () => {
    const res = roll([{ crn: '100', sub: 'AERO', num: '120', days: 'MTWRF', s: '08:00', e: '13:35', ttl: '224.2', mt: 'A' }]);
    const rows = byCrn(res, '100');
    expect(rows.map(r => [r.cells[COL.MT], r.cells[COL.S_TIME], r.cells[COL.E_TIME], r.cells[COL.S_DATE], r.cells[COL.E_DATE]])).toEqual([
        ['L', '08:00', '10:10', '6/14/27', '8/6/27'],
        ['B', '10:20', '13:40', '6/14/27', '8/6/27'],
    ]);
    expect(rows[0].flags).toEqual([]);
    expect(rows[0].cells[COL.STATUS]).toBe('Split');
    expect(res.summary.split).toBe(1);
});

test('unit change flagged and recomputed, LHE blanked', () => {
    const res = roll([
        { crn: '200', sub: 'ANDI', num: '115', days: 'MTWR', s: '08:00', e: '09:25', ttl: '54.4', mt: 'L', ses: '01', lhe: '3.2' },
        { crn: '200', sub: 'ANDI', num: '115', days: 'MW', s: '09:35', e: '11:40', ttl: '36.8', mt: 'B', ses: '02', lhe: '1.1' },
    ]);
    const [lec, lab] = byCrn(res, '200');
    expect(lab.cells[COL.E_TIME]).toBe('11:05');
    expect(lab.flags).toContain('UNITS');
    expect(lab.cells[ROLL_NOTES_COL]).toContain('UNITS: Lab units 0.67 → 0.5');
    expect(lab.cells[ROLL_NOTES_COL]).toContain('End 11:40 AM → 11:05 AM');
    expect(lab.cells[COL.LHE]).toBe('');
    expect(lec.cells[COL.E_TIME]).toBe('09:25');
    expect(lec.cells[COL.HRS_TTL]).toBe('52.7'); // Mon 7/5 holiday: 31 meetings
    expect(res.summary.unitsChanged).toBe(1);
});

test('holiday shift flags HOURS; room overlap flags CONFLICT on both', () => {
    const res = roll([
        { crn: '300', sub: 'ENGL', num: '102', days: 'MW', s: '10:00', e: '13:10', ttl: '54.4', mt: 'L', bldg: 'TA', rm: '100' },
        { crn: '200', sub: 'ANDI', num: '115', days: 'MTWR', s: '08:00', e: '09:25', ttl: '54.4', mt: 'L', bldg: 'TA', rm: '100' },
        { crn: '200', sub: 'ANDI', num: '115', days: 'MW', s: '09:35', e: '11:40', ttl: '36.8', mt: 'B', ses: '02', bldg: 'TA', rm: '100' },
    ]);
    const engl = byCrn(res, '300')[0];
    expect(engl.cells[COL.E_TIME]).toBe('13:20');
    expect(engl.flags).toEqual(expect.arrayContaining(['HOURS', 'CONFLICT']));
    expect(engl.cells[ROLL_NOTES_COL]).toContain('CONFLICT: Room overlap with CRN 200');
    const andiLab = byCrn(res, '200')[1];
    expect(andiLab.cells[ROLL_NOTES_COL]).toContain('Room overlap with CRN 300');
    expect(byCrn(res, '200')[0].flags).not.toContain('CONFLICT'); // lecture ends 9:25
    expect(res.summary.hoursChanged).toBe(1);
});

test('instructor overlap across rooms', () => {
    const res = roll([
        { crn: '400', sub: 'ENGL', num: '102', days: 'MW', s: '10:00', e: '13:10', ttl: '54.4', mt: 'L', fac: 'Lee', rm: '1' },
        { crn: '401', sub: 'ENGL', num: '101', days: 'W', s: '12:00', e: '13:00', ttl: '54.4', mt: 'L', fac: 'Lee', rm: '2' },
    ]);
    expect(byCrn(res, '400')[0].cells[ROLL_NOTES_COL]).toContain('Instructor overlap with CRN 401');
});

test('real catalog change: ENGL 101 3 → 4 units', () => {
    const res = roll([{ crn: '310', sub: 'ENGL', num: '101', days: 'MW', s: '10:00', e: '13:10', ttl: '54.4', mt: 'L' }]);
    const [row] = byCrn(res, '310');
    expect(row.cells[ROLL_NOTES_COL]).toBe('UNITS: Lec units 3 → 4; UNITS: End 1:10 PM → 2:30 PM');
});

test('dropped course goes to Can\'t roll', () => {
    const res = roll([{ crn: '500', sub: 'ART', num: '101', days: 'MW', s: '10:00', e: '13:10', ttl: '54.4', mt: 'L' }]);
    expect(byCrn(res, '500')).toEqual([]);
    expect(res.cantRoll[0].reason).toBe('Not in AY26-27 catalog');
    expect(res.cantRoll[0].cells[COL.S_DATE]).toBe('6/15/26'); // source dates untouched
});

test('end time past midnight is an error, old times kept', () => {
    const res = roll([{ crn: '600', sub: 'AERO', num: '121', days: 'MTWRF', s: '20:00', e: '23:55', ttl: '224.2', mt: 'A' }]);
    const [row] = byCrn(res, '600');
    expect(row.status).toBe('error');
    expect(row.cells[COL.STATUS]).toMatch(/crosses midnight/);
    expect([row.cells[COL.S_TIME], row.cells[COL.E_TIME], row.cells[COL.S_DATE]]).toEqual(['20:00', '23:55', '6/14/27']);
});

test('row outside source term is an error; online rows only get dates', () => {
    const res = roll([
        { crn: '700', sub: 'ENGL', num: '101', days: 'MW', s: '10:00', e: '13:10', ttl: '54.4', mt: 'L', sd: '9/1/26', ed: '12/5/26' },
        { crn: '701', sub: 'ENGL', num: '101', days: 'MW', s: '10:00', e: '13:10', ttl: '54.4', mt: 'I' },
    ]);
    expect(byCrn(res, '700')[0].cells[COL.STATUS]).toMatch(/isn't in Summer 2026/);
    const online = byCrn(res, '701')[0];
    expect([online.cells[COL.E_TIME], online.cells[COL.S_DATE], online.cells[COL.STATUS]]).toEqual(['13:10', '6/14/27', 'OK']);
});

test('fall to fall uses a stand-in catalog', () => {
    const res = roll([{ crn: '800', sub: 'ENGL', num: '101', days: 'MW', s: '10:00', e: '11:25', ttl: '54.0', mt: 'L', sd: '8/17/26', ed: '12/5/26' }], 'fa2026', 'fa2027');
    expect(res.targetCatalog).toMatchObject({ ay: '2728', catalogAy: '2627', isFallback: true });
    expect(byCrn(res, '800')[0].cells[COL.S_DATE]).toBe('8/16/27');
});

test('output has 28 columns; html highlights changed cells', () => {
    const res = roll([
        { crn: '200', sub: 'ANDI', num: '115', days: 'MTWR', s: '08:00', e: '09:25', ttl: '54.4', mt: 'L' },
        { crn: '200', sub: 'ANDI', num: '115', days: 'MW', s: '09:35', e: '11:40', ttl: '36.8', mt: 'B', ses: '02' },
    ]);
    expect(rollToTsv(res.outputRows).split('\n').map(l => l.split('\t').length)).toEqual([28, 28]);
    expect(rollToHtml(res.outputRows)).toContain('background-color:#fff2cc');
});

test('html keeps multi-line cells in one spreadsheet row', () => {
    const html = rollToHtml([{ cells: ['a\nb', 'OK'], status: 'ok', statusDetail: '', notes: [], flags: [], changedCols: [], conflictCols: [] } as any]);
    expect(html).toContain('a<br style="mso-data-placement:same-cell">b');
    expect(html.match(/<tr>/g)).toHaveLength(1);
});

describe('fixed-hours courses (WELD 900: 1 lec + 9 lab hrs, one day)', () => {
    const weld = (over: Partial<R> = {}): R => ({ crn: '900', sub: 'WELD', num: '900', days: 'S', s: '08:00', e: '17:50', ttl: '10.0', mt: 'A', sd: '10/17/26', ed: '10/17/26', ...over });
    const cols = (r: { cells: string[] }) => [r.cells[COL.MT], r.cells[COL.DAYS], r.cells[COL.S_TIME], r.cells[COL.E_TIME], r.cells[COL.HRS_TTL], r.cells[COL.S_DATE]];

    test('splitter splits a single-day row into 1 hr lecture + 9 hr lab', () => {
        const { groups } = parseAndGroup(tsv([weld()]));
        const summary = classifyGroups(groups, rules);
        const rows = processGroups(groups, summary).outputRows;
        expect(rows.map(cols)).toEqual([
            ['L', 'S', '08:00', '08:50', '1.0', '10/17/26'],
            ['B', 'S', '09:00', '17:50', '9.0', '10/17/26'],
        ]);
    });

    test('splitter rejects more than one day', () => {
        const { groups } = parseAndGroup(tsv([weld({ days: 'FS' })]));
        expect(classifyGroups(groups, rules).classifications.get('900')).toMatchObject({ type: 'error', message: expect.stringMatching(/single day/) });
    });

    test('roll moves the date to the same weekday and splits', () => {
        const res = roll([weld()], 'fa2026', 'fa2027');
        expect(byCrn(res, '900').map(cols)).toEqual([
            ['L', 'S', '08:00', '08:50', '1.0', '10/16/27'],
            ['B', 'S', '09:00', '17:50', '9.0', '10/16/27'],
        ]);
        expect(byCrn(res, '900')[0].cells[COL.STATUS]).toBe('Split');
    });

    test('roll keeps a correct L + B section as is', () => {
        const res = roll([
            weld({ mt: 'L', e: '08:50', ttl: '1.0' }),
            weld({ mt: 'B', s: '09:00', e: '17:50', ttl: '9.0', ses: '02' }),
        ], 'fa2026', 'fa2027');
        const rows = byCrn(res, '900');
        expect(rows.map(cols)).toEqual([
            ['L', 'S', '08:00', '08:50', '1.0', '10/16/27'],
            ['B', 'S', '09:00', '17:50', '9.0', '10/16/27'],
        ]);
        expect(rows.flatMap(r => r.flags)).toEqual([]);
        expect(rows[0].cells[COL.STATUS]).toBe('OK');
    });

    test('roll fixes old unit-based hours on an L + B section', () => {
        const res = roll([
            weld({ mt: 'L', e: '08:50', ttl: '18.0' }),
            weld({ mt: 'B', s: '09:00', e: '11:40', ttl: '162.0', ses: '02' }),
        ], 'fa2026', 'fa2027');
        const [lec, lab] = byCrn(res, '900');
        expect(lec.cells[COL.HRS_TTL]).toBe('1.0');
        expect(lab.cells[COL.E_TIME]).toBe('17:50');
        expect(lab.flags).toContain('HOURS');
    });

    test('roll flags a date that lands on a holiday', () => {
        const res = roll([weld({ sd: '11/28/26', ed: '11/28/26' })], 'fa2026', 'fa2027');
        const row = byCrn(res, '900')[0];
        expect(row.cells[COL.S_DATE]).toBe('11/27/27');
        expect(row.cells[ROLL_NOTES_COL]).toContain('CONFLICT: 11/27/27 is a holiday');
    });
});

// Banner lists one row per instructor on a meeting pattern. Hours count once per pattern.
test('two instructors on one mt=A pattern: hours counted once, split emitted per instructor', () => {
    const ftw = (id: string, fac: string): R => ({
        id, fac, crn: '78811', sub: 'FTW', num: '223', days: 'MW', s: '08:00', e: '10:30', ttl: '88.4', mt: 'A',
        bldg: 'DL', rm: '110', sd: '8/17/2026', ed: '12/5/2026', ses: '1',
    });
    const res = roll([ftw('900160691', 'Gilroy, Lori D.'), ftw('900211125', 'Sharp, Charles T.')], 'fa2026', 'fa2027');
    const rows = byCrn(res, '78811');
    expect(rows.every(r => r.status !== 'error')).toBe(true);
    expect(rows.map(r => [r.cells[COL.MT], r.cells[COL.FACULTY]])).toEqual([
        ['L', 'Gilroy, Lori D.'], ['L', 'Sharp, Charles T.'],
        ['B', 'Gilroy, Lori D.'], ['B', 'Sharp, Charles T.'],
    ]);
    expect(rows[0].cells[COL.ID]).toBe('900160691');
    expect(rows[1].cells[COL.ID]).toBe('900211125');
    expect(rows[0].cells).toEqual(expect.arrayContaining([rows[1].cells[COL.E_TIME]]));
    expect(rows[0].flags).not.toContain('CONFLICT');
    expect(res.summary.split).toBe(1);
});

test('duplicated L rows plus A rows (VN 120): recomputed per row, no error', () => {
    const base = { crn: '79025', sub: 'VN', num: '120', bldg: 'CH', rm: '202' };
    const res = roll([
        { ...base, id: '900218740', fac: 'Parkinson, Elinda S.', days: 'MT', s: '08:00', e: '12:50', ses: '1', sd: '8/17/2026', ed: '11/30/2026', ttl: '145', mt: 'L' },
        { ...base, id: '900227692', fac: 'Watters, Katrina A.', days: 'MT', s: '08:00', e: '12:50', ses: '1', sd: '8/17/2026', ed: '11/30/2026', ttl: '145', mt: 'L' },
        { ...base, id: '900227692', fac: 'Watters, Katrina A.', days: 'F', s: '08:00', e: '11:20', ses: '2', sd: '12/4/2026', ed: '12/4/2026', ttl: '3.6', mt: 'L' },
        { ...base, id: '900218740', fac: 'Parkinson, Elinda S.', days: 'WR', s: '06:50', e: '18:40', ses: '3', bldg: 'HOSP', rm: '', sd: '9/30/2026', ed: '11/26/2026', ttl: '192', mt: 'A' },
    ], 'fa2026', 'fa2027');
    const rows = byCrn(res, '79025');
    expect(rows).toHaveLength(4);
    expect(rows.every(r => r.status !== 'error')).toBe(true);
    expect(rows.map(r => r.cells[COL.FACULTY])).toEqual([
        'Parkinson, Elinda S.', 'Watters, Katrina A.', 'Watters, Katrina A.', 'Parkinson, Elinda S.',
    ]);
    expect(rows[0].cells[COL.E_TIME]).toBe(rows[1].cells[COL.E_TIME]);
    expect(rows[0].cells[COL.HRS_TTL]).toBe(rows[1].cells[COL.HRS_TTL]);
});

test('splitter (not roll) also counts duplicated instructor rows once', () => {
    const ftw = (id: string, fac: string): R => ({
        id, fac, crn: '78811', sub: 'FTW', num: '223', days: 'MW', s: '08:00', e: '10:30', ttl: '88.4', mt: 'A',
        bldg: 'DL', rm: '110', sd: '8/17/2026', ed: '12/5/2026', ses: '1',
    });
    const { groups } = parseAndGroup(tsv([ftw('900160691', 'Gilroy, Lori D.'), ftw('900211125', 'Sharp, Charles T.')]));
    const summary = classifyGroups(groups, rules);
    expect(summary.classifications.get('78811')).toMatchObject({ type: 'split', lecUnits: 3.5, labUnits: 0.5 });
    const rows = processGroups(groups, summary).outputRows;
    expect(rows.map(r => [r.cells[COL.MT], r.cells[COL.ID]])).toEqual([
        ['L', '900160691'], ['L', '900211125'], ['B', '900160691'], ['B', '900211125'],
    ]);
});
