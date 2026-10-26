// src/types/schedule.ts
import { AcademicTerm, TermSession } from './calendar';
import { ContactHourCalculationRules, AttendanceAccountingRules } from './rules';

export type ExportType = 'simple' | 'detailed' | 'spreadsheet';


export interface ScheduleBlock {
    dayOfWeek: string;
    type: 'lecture' | 'lab';
    startTime: string;
    endTime: string;
    durationMinutes: number;
    instructionalMinutes: number;
    breakMinutes: number;
}

export interface ScheduleInfo {
    contactHoursForTerm: number;
    weeklyContactHours: number;
    totalScheduledContactHours: number;
    contactHoursPerDay: number;
    totalBreakMinutesPerDay: number;
    actualMeetingDays: number;
}

export interface GeneratedSchedule {
    lectureInfo: ScheduleInfo;
    labInfo: ScheduleInfo;
    scheduleBlocks: ScheduleBlock[];
    warnings: string[];
}

export interface RuleAndTermContext {
    contactHourRules: ContactHourCalculationRules;
    attendanceRules: AttendanceAccountingRules;
    term: AcademicTerm;
    session: TermSession;
}
