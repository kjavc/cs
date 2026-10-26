import { useMemo } from 'react';
import { SavedSection } from '../types/section';
import { AcademicTerm } from '../types/calendar';
import { GeneratedSchedule, RuleAndTermContext } from '../types/schedule';
import { ContactHourCalculationRules, AttendanceAccountingRules } from '../types/rules';
import { generateSchedule } from '../utils/scheduleGenerator';
import { getWeekRange, weekRangesOverlap, formatWeekRange, getClassroomWeeks } from '../utils/weekRange';
import { RoomContextSchedule } from '../components/ScheduleDisplay';

interface UseRoomContextParams {
    savedSections: SavedSection[];
    currentSectionId: string | null;
    lectureRoomId: string;
    labRoomId: string;
    selectedTermId: string;
    selectedSessionId: string;
    calendar: AcademicTerm[];
    contactHourRules: ContactHourCalculationRules | null;
    attendanceRules: AttendanceAccountingRules | null;
}

export function useRoomContext({
    savedSections, currentSectionId,
    lectureRoomId, labRoomId,
    selectedTermId, selectedSessionId,
    calendar, contactHourRules, attendanceRules
}: UseRoomContextParams): RoomContextSchedule[] {
    return useMemo(() => {
        if (!contactHourRules || !attendanceRules) return [];
        if (!lectureRoomId && !labRoomId) return [];

        const currentTerm = calendar.find(t => t.id === selectedTermId);
        if (!currentTerm) return [];
        const currentSession = currentTerm.sessions.find(s => s.id === selectedSessionId) || currentTerm.sessions[0];
        const currentWeekRange = getWeekRange(currentSession, currentTerm);

        const roomIds = new Set<string>();
        if (lectureRoomId) roomIds.add(lectureRoomId);
        if (labRoomId) roomIds.add(labRoomId);

        const results: RoomContextSchedule[] = [];
        const seen = new Set<string>();

        for (const section of savedSections) {
            if (section.id === currentSectionId) continue;

            // Check if this section shares a room with the current one
            const sectionLecRoom = section.lectureRoomId;
            const sectionLabRoom = section.labRoomId;
            const sharesRoom = (sectionLecRoom && roomIds.has(sectionLecRoom)) ||
                               (sectionLabRoom && roomIds.has(sectionLabRoom));
            if (!sharesRoom) continue;

            // Check if same term
            if (section.selectedTermId !== selectedTermId) continue;

            // Check week range overlap
            const sectionTerm = calendar.find(t => t.id === section.selectedTermId);
            if (!sectionTerm) continue;
            const sectionSession = sectionTerm.sessions.find(s => s.id === section.selectedSessionId) || sectionTerm.sessions[0];
            const sectionWeekRange = getWeekRange(sectionSession, sectionTerm);

            if (!weekRangesOverlap(currentWeekRange, sectionWeekRange)) continue;

            if (seen.has(section.id)) continue;
            seen.add(section.id);

            // Generate the schedule for this section
            const context: RuleAndTermContext = { contactHourRules, attendanceRules, term: sectionTerm, session: sectionSession };
            const request = {
                lectureUnits: section.lectureUnits,
                lectureDays: section.lectureDays,
                lecTbaHours: section.lecTbaHours || 0,
                labUnits: section.labUnits,
                labDays: section.labDays,
                labTbaHours: section.labTbaHours || 0,
                fixedHours: section.fixedHours
            };
            const overrides = {
                lectureTimesPerDay: section.lectureTimeMode === 'perDay' ? (section.lectureTimesPerDay as Record<string, string>) : undefined,
                labTimesPerDay: section.labTimeMode === 'perDay' ? (section.labTimesPerDay as Record<string, string>) : undefined,
                lectureHoursPerDay: section.lectureSplitMode === 'custom' ? (section.lectureHoursPerDay as Record<string, number>) : undefined,
                labHoursPerDay: section.labSplitMode === 'custom' ? (section.labHoursPerDay as Record<string, number>) : undefined,
            };

            const schedule = generateSchedule(request, context, section.startTime, section.labStartTime, overrides);
            const totalWeeks = getClassroomWeeks(sectionTerm);
            const weekLabel = formatWeekRange(sectionWeekRange, totalWeeks);

            results.push({
                id: section.id,
                name: section.name,
                schedule,
                weekLabel
            });
        }

        return results;
    }, [savedSections, currentSectionId, lectureRoomId, labRoomId, selectedTermId, selectedSessionId, calendar, contactHourRules, attendanceRules]);
}
