// src/utils/blockFit.ts
// Block Fit: place a course's lecture and lab inside one block-schedule window
// (e.g. MW 8:00-10:30) using the existing contact hour rules.

import { calculateTimeMetrics, parseTimeToMinutes, formatMinutes } from './scheduleGenerator';

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
    // Scheduled term contact hours vs the catalog's, per component
    lectureHours: number;
    labHours: number;
    lectureRequired: number;
    labRequired: number;
    // False when no placement lands both components inside the preferred hours range
    hoursInRange: boolean;
}

export interface BlockFitError {
    error: string;
}

// Furthest past the block end we'll still offer a "closest we can get"
const MAX_OVERRUN = 120;
// Lecture and lab on the same day are separated by one break (same as the generator)
const COMPONENT_GAP = 10;
// Preferred range for each component's term hours around the catalog's: e.g. 54 → 52.9–54.5.
// Over by more is pushing what's legally allowed; under is acceptable but closer is better.
const HOURS_OVER = 0.01;
const HOURS_UNDER = 0.02;

export function hoursInRange(scheduled: number, required: number): boolean {
    return scheduled <= required * (1 + HOURS_OVER) + 1e-9 && scheduled >= required * (1 - HOURS_UNDER) - 1e-9;
}

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
    inRange: boolean;
}

// The generator's custom-split acceptance check, with the same arithmetic in the same order,
// so anything accepted here is accepted there.
function generatorAccepts(v: Vector, meetings: number[], required: number): boolean {
    let total = 0;
    let n = 0;
    let sumMeetings = 0;
    for (let i = 0; i < v.length; i++) {
        if (!v[i]) continue;
        total += (Math.round(v[i]) / 10) * meetings[i];
        sumMeetings += meetings[i];
        n++;
    }
    const avgWeeks = sumMeetings / n;
    const tolerance = Math.max(0.05, n * 0.05);
    return Math.abs(total / avgWeeks - required / avgWeeks) <= tolerance;
}

function scheduledTotal(v: Vector, meetings: number[]): number {
    return v.reduce((s, t, i) => s + t / 10 * meetings[i], 0);
}

// Every way to meet `required` term CH on these days using at most two distinct per-day values
// (more than that is more meeting patterns than anyone wants). Values are ≥ 1.0 CH and at most
// `capTenths`.
function componentCandidates(required: number, meetings: number[], capTenths: number): Vector[] {
    const n = meetings.length;
    if (required <= 0) return [new Array(n).fill(0)];
    const out: Vector[] = [];
    const seen = new Set<string>();
    const tryVector = (v: Vector) => {
        const key = v.join(',');
        if (seen.has(key)) return;
        seen.add(key);
        if (generatorAccepts(v, meetings, required)) out.push(v);
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
                const base = Math.round(required / sumM * 10);
                for (const a of [base - 1, base, base + 1]) {
                    if (a >= 10 && a <= capTenths) tryVector(build(a, 0));
                }
                continue;
            }

            for (let a = 10; a <= capTenths; a++) {
                const bExact = (required - a / 10 * mA) / mE * 10;
                for (const b of [Math.floor(bExact), Math.ceil(bExact)]) {
                    if (b !== a && b >= 10 && b <= capTenths) tryVector(build(a, b));
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
function solve(lecRequired: number, labRequired: number, meetings: number[], window: number): Solution | null {
    // Hours inside the preferred range come first, even if that means running past the block;
    // only when no placement manages that do we fall back to anything the generator accepts.
    for (const rangeOnly of [true, false]) {
        // Search with short meetings first. A best answer that overruns by no more than `extra`
        // is the overall best: anything better overruns less, so all its meetings are in this pass.
        for (const extra of [0, 30, 60, MAX_OVERRUN]) {
            const found = solveWithin(lecRequired, labRequired, meetings, window, window + extra, rangeOnly);
            if (found && found.overrun <= extra) return found;
            if (extra === MAX_OVERRUN && found) return found;
        }
    }
    return null;
}

function solveWithin(lecRequired: number, labRequired: number, meetings: number[], window: number, maxMeetingMinutes: number, rangeOnly: boolean): Solution | null {
    const n = meetings.length;
    let capTenths = 10;
    while (clockMinutes(capTenths + 1) <= maxMeetingMinutes) capTenths++;

    const prepare = (vectors: Vector[], required: number): Candidate[] => vectors.map(v => {
        const total = scheduledTotal(v, meetings);
        return {
            v,
            clocks: v.map(t => t ? clockMinutes(t) : 0),
            distinct: new Set(v.filter(t => t > 0).map(clockMinutes)).size,
            deviation: Math.round(Math.abs(total - required) * 100),
            shortfall: Math.round(Math.max(0, required - total) * 100),
            inRange: required <= 0 || hoursInRange(total, required)
        };
    // Simplest first, so a good answer turns up early and prunes the rest
    }).filter(c => !rangeOnly || c.inRange).sort((a, b) => a.distinct - b.distinct || Math.max(...a.clocks) - Math.max(...b.clocks));
    const lecCands = prepare(componentCandidates(lecRequired, meetings, capTenths), lecRequired);
    const labCands = prepare(componentCandidates(labRequired, meetings, capTenths), labRequired);

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
    meetingsByDay: Record<string, number>
): BlockFitResult | BlockFitError {
    if (days.length === 0) return { error: 'This block has no days.' };
    if (lectureUnits <= 0 && labUnits <= 0) return { error: 'Enter lecture or lab units to fit a block.' };
    const missingDay = days.find(d => !meetingsByDay[d]);
    if (missingDay) return { error: `${missingDay} has no meetings in this session.` };

    const start = parseTimeToMinutes(blockStart);
    const window = parseTimeToMinutes(blockEnd) - start;
    const meetings = days.map(d => meetingsByDay[d]);
    const lecRequired = lectureUnits * 18;
    const labRequired = labUnits * 54;

    const key = `${lectureUnits}|${labUnits}|${meetings.join(',')}|${window}`;
    if (!solveCache.has(key)) solveCache.set(key, solve(lecRequired, labRequired, meetings, window));
    const best = solveCache.get(key);

    if (!best) {
        // Explain the usual cause: too few hours to give every day a 1.0 CH meeting
        const totalMeetings = meetings.reduce((s, m) => s + m, 0);
        if (lecRequired + labRequired < totalMeetings) {
            return { error: `Not enough hours to meet on all ${days.length} days (1.0 CH minimum per meeting).` };
        }
        const short = [lecRequired > 0 && lecRequired < Math.min(...meetings) ? 'lecture' : '', labRequired > 0 && labRequired < Math.min(...meetings) ? 'lab' : ''].filter(Boolean);
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
        lectureRequired: lecRequired,
        labRequired,
        hoursInRange: (lecRequired <= 0 || hoursInRange(lectureHoursTotal, lecRequired)) && (labRequired <= 0 || hoursInRange(labHoursTotal, labRequired)),
        overrunMinutes: best.overrun,
        meetingPatterns: best.patterns
    };
}
