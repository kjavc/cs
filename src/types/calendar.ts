import academicCalendarData from '../data/academic-calendar.json';

export interface TermSession {
  id: string;
  name: string;
  weeks: number;
  method: 'FULL_TERM' | 'LATE_START' | 'EARLY_START';
}

export interface AcademicTerm {
  id: string;
  name: string;
  type: 'semester' | 'intersession';
  startDate: string;
  endDate: string;
  holidays: string[];
  sessions: TermSession[];
}

// Explicitly type and sort the imported JSON
export const academicCalendar: AcademicTerm[] = (academicCalendarData as AcademicTerm[]).sort((a, b) => 
  new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
);

export const LOCAL_STORAGE_KEY = 'cs-app-settings';
