// src/utils/blockFit.ts
// Block Fit: place a course's lecture and lab inside one block-schedule window
// (e.g. MW 8:00-10:30) using the existing contact hour rules. Each component's term hours
// land in the Block Fit range (src/utils/blockHours.ts), as close to its target as possible.

import { calculateTimeMetrics, parseTimeToMinutes, formatMinutes } from './scheduleGenerator';
import { blockHoursRange, HoursRange } from './blockHours';

export interface BlockFitDay {
    day: string;
    lectureCH: number;
    labCH: number;
    endTime: string;
    overrunMinutes: number;
}

export interface BlockFitResult {
    lectureDays: string[];
    labDays: string[];
    lectureHoursPerDay: Record<string, number>;
    labHoursPerDay: Record<string, number>;
    perDay: BlockFitDay[];
    // Minutes past the block's end on the worst day; 0 = fits
    overrunMinutes: number;
    meetingPatterns: number;
    // Scheduled term contact hours vs the Block Fit target and the catalog's, per component
    lectureHours: number;
    labHours: number;
    lectureTarget: number;
    labTarget: number;
    lectureCatalog: number;
    labCatalog: number;
}

export interface BlockFitError {
    error: string;
}

// Furthest past the block end we'll still offer a "closest we can get"
const MAX_OVERRUN = 120;
// Lecture and lab on the same day are separated by one break (same as the generator)
const COMPONENT_GAP = 10;

const clockCache: number[] = [];
function clockMinutes(tenths: number): number {
    if (clockCache[tenths] === undefined) clockCache[tenths] = calculateTimeMetrics(tenths / 10).totalClockMinutes;
    return clockCache[tenths];
}

// Per-day CH in tenths; 0 = no meeting that day
type Vector = number[];

interface Candidate {
    v: Vector;
    clocks: number[];
    distinct: number; // distinct meeting lengths (x.1 and x.2 CH run the same length)
    deviation: number;
    shortfall: number;
}

// Same arithmetic, in the same order, as the generator's Block Fit check, so anything
// accepted here is accepted there
function inRange(v: Vector, meetings: number[], range: HoursRange): boolean {
    let total = 0;
    for (let i = 0; i < v.length; i++) {
        if (v[i]) total += (Math.round(v[i]) / 10) * meetings[i];
    }
    return total >= range.min - 1e-6 && total <= range.max + 1e-6;
}

function scheduledTotal(v: Vector, meetings: number[]): number {
    return v.reduce((s, t, i) => s + t / 10 * meetings[i], 0);
}

// Every way to land in `range` on these days using at most two distinct per-day values
// (more than that is more meeting patterns than anyone wants). Values are ≥ 1.0 CH and at most
// `capTenths`.
function componentCandidates(range: HoursRange, meetings: number[], capTenths: number): Vector[] {
    const n = meetings.length;
    if (range.target <= 0) return [new Array(n).fill(0)];
    const out: Vector[] = [];
    const seen = new Set<string>();
    const tryVector = (v: Vector) => {
        const key = v.join(',');
        if (seen.has(key)) return;
        seen.add(key);
        if (inRange(v, meetings, range)) out.push(v);
    };

    for (let mask = 1; mask < (1 << n); mask++) {
        const S: number[] = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) S.push(i);
        const sumM = S.reduce((s, i) => s + meetings[i], 0);

        // E = days on the second value; |E| ≤ |S|/2 covers every split once
        for (let eMask = 0; eMask < (1 << S.length); eMask++) {
            const E = S.filter((_, k) => eMask & (1 << k));
            if (E.length > Math.floor(S.length / 2)) continue;
            const A = S.filter((_, k) => !(eMask & (1 << k)));
            const mA = A.reduce((s, i) => s + meetings[i], 0);
            const mE = sumM - mA;
            const build = (a: number, b: number) => {
                const v = new Array(n).fill(0);
                for (const i of A) v[i] = a;
                for (const i of E) v[i] = b;
                return v;
            };

            if (E.length === 0) {
                const lo = Math.max(10, Math.floor(range.min / sumM * 10));
                const hi = Math.min(capTenths, Math.ceil(range.max / sumM * 10));
                for (let a = lo; a <= hi; a++) tryVector(build(a, 0));
                continue;
            }

            for (let a = 10; a <= capTenths; a++) {
                const lo = Math.max(10, Math.floor((range.min - a / 10 * mA) / mE * 10));
                const hi = Math.min(capTenths, Math.ceil((range.max - a / 10 * mA) / mE * 10));
                for (let b = lo; b <= hi; b++) {
                    if (b !== a) tryVector(build(a, b));
                }
            }
        }
    }
    return out;
}

// Lower is better, compared in order
type Score = [number, number, number, number, number, number, number];

function better(a: Score, b: Score): boolean {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] < b[i];
    }
    return false;
}

interface Solution {
    lec: Vector;
    lab: Vector;
    overrun: number;
    patterns: number;
}

// Best lecture/lab placement for a window of `window` minutes. Depends only on the window's
// length, not its start, so every block of the same length shares one answer.
function solve(lecRange: HoursRange, labRange: HoursRange, meetings: number[], window: number): Solution | null {
    // Search with short meetings first. A best answer that overruns by no more than `extra`
    // is the overall best: anything better overruns less, so all its meetings are in this pass.
    for (const extra of [0, 30, 60, MAX_OVERRUN]) {
        const found = solveWithin(lecRange, labRange, meetings, window, window + extra);
        if (found && found.overrun <= extra) return found;
        if (extra === MAX_OVERRUN) return found;
    }
    return null;
}

function solveWithin(lecRange: HoursRange, labRange: HoursRange, meetings: number[], window: number, maxMeetingMinutes: number): Solution | null {
    const n = meetings.length;
    let capTenths = 10;
    while (clockMinutes(capTenths + 1) <= maxMeetingMinutes) capTenths++;

    const prepare = (vectors: Vector[], range: HoursRange): Candidate[] => vectors.map(v => {
        const total = scheduledTotal(v, meetings);
        return {
            v,
            clocks: v.map(t => t ? clockMinutes(t) : 0),
            distinct: new Set(v.filter(t => t > 0).map(clockMinutes)).size,
            deviation: Math.round(Math.abs(total - range.target) * 100),
            shortfall: Math.round(Math.max(0, range.target - total) * 100)
        };
    // Simplest first, so a good answer turns up early and prunes the rest
    }).sort((a, b) => a.distinct - b.distinct || Math.max(...a.clocks) - Math.max(...b.clocks));
    const lecCands = prepare(componentCandidates(lecRange, meetings, capTenths), lecRange);
    const labCands = prepare(componentCandidates(labRange, meetings, capTenths), labRange);

    let best: { score: Score; lec: Vector; lab: Vector } | null = null;

    for (const lec of lecCands) {
        if (best && Math.max(...lec.clocks) - window > best.score[0]) continue;
        for (const lab of labCands) {
            // Each meeting length is at least one pattern; once something fits, skip what can't beat it
            if (best && best.score[0] === 0 && lec.distinct + lab.distinct > best.score[2]) break;

            let maxOver = 0;
            let totalOver = 0;
            let latest = 0;
            let earliest = Infinity;
            let viable = true;
            for (let i = 0; i < n; i++) {
                // Every day of the block gets used
                if (!lec.v[i] && !lab.v[i]) { viable = false; break; }
                const length = lec.clocks[i] + (lec.v[i] && lab.v[i] ? COMPONENT_GAP : 0) + lab.clocks[i];
                const over = Math.max(0, length - window);
                if (best && over > best.score[0]) { viable = false; break; }
                if (over > maxOver) maxOver = over;
                totalOver += over;
                if (length > latest) latest = length;
                if (length < earliest) earliest = length;
            }
            if (!viable) continue;

            // Meeting patterns = distinct start/end times per component
            const lecPatterns = new Set<number>();
            const labPatterns = new Set<string>();
            for (let i = 0; i < n; i++) {
                if (lec.v[i]) lecPatterns.add(lec.clocks[i]);
                if (lab.v[i]) labPatterns.add(`${lec.clocks[i]}-${lab.clocks[i]}`);
            }
            // Last resort: lecture earlier in the week (how these usually get built by hand)
            let lecOrder = 0;
            for (let i = 0; i < n; i++) lecOrder = lecOrder * 100 + (99 - lec.v[i]);

            const score: Score = [maxOver, totalOver, lecPatterns.size + labPatterns.size, lec.deviation + lab.deviation, lec.shortfall + lab.shortfall, latest - earliest, lecOrder];
            if (!best || better(score, best.score)) best = { score, lec: lec.v, lab: lab.v };
        }
    }

    return best && { lec: best.lec, lab: best.lab, overrun: best.score[0], patterns: best.score[2] };
}

const solveCache = new Map<string, Solution | null>();

export function computeBlockFit(
    lectureUnits: number,
    labUnits: number,
    days: string[],
    blockStart: string,
    blockEnd: string,
    meetingsByDay: Record<string, number>,
    // Full-term fall/spring targets the catalog hours; shorter sessions target a week less
    fullSemester: boolean
): BlockFitResult | BlockFitError {
    if (days.length === 0) return { error: 'This block has no days.' };
    if (lectureUnits <= 0 && labUnits <= 0) return { error: 'Enter lecture or lab units to fit a block.' };
    const missingDay = days.find(d => !meetingsByDay[d]);
    if (missingDay) return { error: `${missingDay} has no meetings in this session.` };

    const start = parseTimeToMinutes(blockStart);
    const window = parseTimeToMinutes(blockEnd) - start;
    const meetings = days.map(d => meetingsByDay[d]);
    const lecCatalog = lectureUnits * 18;
    const labCatalog = labUnits * 54;
    const lecRange = blockHoursRange(lecCatalog, fullSemester);
    const labRange = blockHoursRange(labCatalog, fullSemester);

    const key = `${lectureUnits}|${labUnits}|${meetings.join(',')}|${window}|${fullSemester}`;
    if (!solveCache.has(key)) solveCache.set(key, solve(lecRange, labRange, meetings, window));
    const best = solveCache.get(key);

    if (!best) {
        // Explain the usual cause: too few hours to give every day a 1.0 CH meeting
        const totalMeetings = meetings.reduce((s, m) => s + m, 0);
        if (lecRange.max + labRange.max < totalMeetings) {
            return { error: `Not enough hours to meet on all ${days.length} days (1.0 CH minimum per meeting).` };
        }
        const short = [lecCatalog > 0 && lecRange.max < Math.min(...meetings) ? 'lecture' : '', labCatalog > 0 && labRange.max < Math.min(...meetings) ? 'lab' : ''].filter(Boolean);
        if (short.length) {
            return { error: `The ${short.join(' and ')} can't reach the 1.0 CH minimum for even one meeting a week.` };
        }
        return { error: `Doesn't fit, even running ${MAX_OVERRUN} minutes over.` };
    }

    const lectureHoursPerDay: Record<string, number> = {};
    const labHoursPerDay: Record<string, number> = {};
    const perDay: BlockFitDay[] = days.map((day, i) => {
        const lecCH = best.lec[i] / 10;
        const labCH = best.lab[i] / 10;
        if (lecCH) lectureHoursPerDay[day] = lecCH;
        if (labCH) labHoursPerDay[day] = labCH;
        const length = (lecCH ? clockMinutes(best.lec[i]) : 0) + (lecCH && labCH ? COMPONENT_GAP : 0) + (labCH ? clockMinutes(best.lab[i]) : 0);
        return { day, lectureCH: lecCH, labCH, endTime: formatMinutes(start + length), overrunMinutes: Math.max(0, length - window) };
    });

    const lectureHoursTotal = Math.round(scheduledTotal(best.lec, meetings) * 10) / 10;
    const labHoursTotal = Math.round(scheduledTotal(best.lab, meetings) * 10) / 10;

    return {
        lectureDays: days.filter(d => lectureHoursPerDay[d] !== undefined),
        labDays: days.filter(d => labHoursPerDay[d] !== undefined),
        lectureHoursPerDay,
        labHoursPerDay,
        perDay,
        lectureHours: lectureHoursTotal,
        labHours: labHoursTotal,
        lectureTarget: Math.round(lecRange.target * 10) / 10,
        labTarget: Math.round(labRange.target * 10) / 10,
        lectureCatalog: lecCatalog,
        labCatalog,
        overrunMinutes: best.overrun,
        meetingPatterns: best.patterns
    };
}
