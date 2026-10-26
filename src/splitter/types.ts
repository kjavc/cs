import { FixedHours } from '../types/section';

export const COL = {
    ID: 0, FACULTY: 1, CRN: 2, SUB: 3, NUM: 4, SEC: 5,
    DAYS: 6, S_TIME: 7, E_TIME: 8, SES_NUM: 9, XLIST: 10,
    BLDG: 11, RM: 12, S_DATE: 13, E_DATE: 14,
    HRS_D: 15, HRS_WK: 16, HRS_TTL: 17,
    LHE: 18, MAX: 19, WAIT: 20, MA: 21, MT: 22,
    COMMENTS: 23, ZTC_OER: 24, INITIATIVES: 25,
    STATUS: 26
} as const;

export const INPUT_COL_COUNT = 26;
export const OUTPUT_COL_COUNT = 27;

export type MeetingType = 'A' | 'L' | 'B' | 'G' | 'Y' | 'I' | 'C' | 'O' | 'W';

export const SPLIT_TARGET_MT: MeetingType = 'A';
export const PASSTHROUGH_MTS: MeetingType[] = ['G', 'Y', 'I', 'C', 'O', 'W'];

export const DAY_CHAR_TO_FULL: Record<string, string> = {
    M: 'Mon', T: 'Tue', W: 'Wed', R: 'Thu', F: 'Fri', S: 'Sat', U: 'Sun'
};
export const DAY_FULL_TO_CHAR: Record<string, string> = {
    Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'R', Fri: 'F', Sat: 'S', Sun: 'U'
};

export const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface SpreadsheetRow {
    cells: string[];
    rowIndex: number;
}

export interface CRNGroup {
    crn: string;
    rows: SpreadsheetRow[];
    sub: string;
    num: string;
    xlistCode: string;
}

export type SectionClassification =
    | { type: 'split'; lecUnits: number; labUnits: number; weeks: number; meetingsByDay: Record<string, number>; startTime: string; days: string[]; fixedHours?: FixedHours }
    | { type: 'already-split' }
    | { type: 'pass-through'; reason: string }
    | { type: 'tba' }
    | { type: 'error'; message: string };

export interface OutputRow {
    cells: string[];
    status: SplitterStatus;
    statusDetail: string;
    sourceCRN: string;
    originalRowIndex: number;
}

export type SplitterStatus = 'split' | 'already-split' | 'pass-through' | 'tba' | 'error';

export type SplitterStage = 'paste' | 'review' | 'results';

export interface ReviewSummary {
    totalSections: number;
    toSplit: number;
    alreadySplit: number;
    passThrough: number;
    tba: number;
    errors: number;
    errorDetails: Array<{ crn: string; sub: string; num: string; message: string }>;
    classifications: Map<string, SectionClassification>;
    crnGroups: CRNGroup[];
}

export interface SplitterResults {
    outputRows: OutputRow[];
    summary: {
        totalInputRows: number;
        totalOutputRows: number;
        splitCount: number;
        alreadySplitCount: number;
        passThroughCount: number;
        tbaCount: number;
        errorCount: number;
    };
}
