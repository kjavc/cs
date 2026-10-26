// src/types/rules.ts

export interface ContactHourRule {
    MIN: number;
    MAX: number;
    CONTACT_HOURS: number;
}

export interface ContactHourCalculationRules {
    [key: string]: ContactHourRule;
}

export type AttendanceMethod = 'IGNORE_HOLIDAYS' | 'COUNT_HOLIDAYS';

export interface AttendanceAccountingRules {
    [key: string]: {
        METHOD: AttendanceMethod;
        DESCRIPTION: string;
    };
}
