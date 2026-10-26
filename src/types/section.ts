// src/types/section.ts

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type TimeMode = 'shared' | 'perDay';
export type SplitMode = 'even' | 'custom';

// Total contact hours for courses the catalog lists in hours (lecHours/labHours) instead of units.
// Each component meets once, on a single day, regardless of the term calendar.
export interface FixedHours {
    lec: number;
    lab: number;
}

export interface SavedSection {
    id: string;
    name: string;
    lectureUnits: number;
    lectureDays: string[];
    lecTbaHours?: number;
    labUnits: number;
    labDays: string[];
    labTbaHours?: number;
    startTime: string;
    labStartTime: string | null;
    selectedTermId: string;
    selectedSessionId: string;
    timestamp: number;

    // v2 additive fields. Missing = legacy (shared start time, even split).
    schemaVersion?: 2;
    lectureTimeMode?: TimeMode;
    labTimeMode?: TimeMode;
    lectureSplitMode?: SplitMode;
    labSplitMode?: SplitMode;
    lectureTimesPerDay?: Partial<Record<DayOfWeek, string>>;
    labTimesPerDay?: Partial<Record<DayOfWeek, string>>;
    lectureHoursPerDay?: Partial<Record<DayOfWeek, number>>;
    labHoursPerDay?: Partial<Record<DayOfWeek, number>>;

    // Room assignment (per-component)
    lectureBuildingId?: string;
    lectureRoomId?: string;
    labBuildingId?: string;
    labRoomId?: string;

    // Fixed-hours course (e.g. WELD 900). Missing = units-based.
    fixedHours?: FixedHours;
}
