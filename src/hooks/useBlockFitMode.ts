// src/hooks/useBlockFitMode.ts
// Block Fit mode logic shared by DesktopView and MobileView.

import { useCallback, useEffect, useMemo } from 'react';
import { useWorkspace } from './useWorkspace';
import { useSettings } from './useSettings';
import { AcademicTerm } from '../types/calendar';
import { AttendanceAccountingRules } from '../types';
import { meetingsPerWeekday } from '../utils/scheduleGenerator';
import { computeBlockFit, BlockFitResult } from '../utils/blockFit';
import { blockScheduleFor, blockOptionsFor, familiesIn, BlockOption } from '../utils/blockSchedule';

interface Args {
    workspaceAPI: ReturnType<typeof useWorkspace>;
    settingsAPI: ReturnType<typeof useSettings>;
    calendar: AcademicTerm[];
    attendanceRules: AttendanceAccountingRules | null;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const sameBlock = (a: BlockOption, b: BlockOption) =>
    a.start === b.start && a.end === b.end && a.days.join() === b.days.join() && a.weeklyHours === b.weeklyHours;

export function useBlockFitMode({ workspaceAPI, settingsAPI, calendar, attendanceRules, showToast }: Args) {
    const {
        lectureUnits, labUnits, fixedHours,
        blockFit, setBlockFit, blockSelection, setBlockSelection,
        setSmartSplit, setSmartSplitDays,
        setLectureDays, setLabDays, setLecTbaHours, setLabTbaHours
    } = workspaceAPI;
    const {
        selectedTermId, selectedSessionId, setStartTime, setLabStartTime,
        setLectureTimeMode, setLabTimeMode, setLectureTimesPerDay, setLabTimesPerDay,
        setLectureSplitMode, setLabSplitMode, setLectureHoursPerDay, setLabHoursPerDay
    } = settingsAPI;

    const term = calendar.find(t => t.id === selectedTermId) || calendar[0];
    const session = term.sessions.find(s => s.id === selectedSessionId) || term.sessions[0];
    const sheet = blockScheduleFor(term, session);
    const meetingsByDay = useMemo(
        () => attendanceRules ? meetingsPerWeekday(term, session, attendanceRules) : null,
        [term, session, attendanceRules]
    );

    const canBlockFit = (lectureUnits > 0 || labUnits > 0) && !fixedHours;

    const blockFitResult: BlockFitResult | { error: string } | null = useMemo(() => {
        if (!blockFit || !blockSelection || !meetingsByDay) return null;
        return computeBlockFit(lectureUnits, labUnits, blockSelection.days, blockSelection.start, blockSelection.end, meetingsByDay);
    }, [blockFit, blockSelection, meetingsByDay, lectureUnits, labUnits]);

    // Clear a selection the current session's sheet doesn't have (e.g. after changing session)
    useEffect(() => {
        if (!blockSelection) return;
        const stillOffered = sheet && familiesIn(sheet).some(h =>
            blockOptionsFor(sheet, h, lectureUnits > 0 && labUnits > 0).some(o => sameBlock(o, blockSelection)));
        if (!stillOffered) setBlockSelection(null);
    }, [sheet, blockSelection, lectureUnits, labUnits, setBlockSelection]);

    // Fixed-hours courses meet once, and a course needs units to fit anywhere
    useEffect(() => {
        if (blockFit && !canBlockFit) {
            setBlockFit(false);
            setBlockSelection(null);
            showToast(fixedHours ? 'Block Fit doesn\'t apply to fixed-hours courses — switching to Manual mode.' : 'Block Fit needs lecture or lab units — switching to Manual mode.', 'info');
        }
    }, [blockFit, canBlockFit, fixedHours, setBlockFit, setBlockSelection, showToast]);

    const selectBlock = useCallback((option: BlockOption) => {
        setBlockSelection(option);
        setStartTime(option.start);
    }, [setBlockSelection, setStartTime]);

    // Turning on starts clean like Smart Split; turning off keeps the fitted schedule in the manual controls
    const handleBlockFitToggle = useCallback((enabled: boolean, keepResult: boolean = true) => {
        if (enabled) {
            setSmartSplit(false);
            setSmartSplitDays([]);
            setBlockFit(true);
            setBlockSelection(null);
            setLecTbaHours(0);
            setLabTbaHours(0);
            setLectureTimesPerDay({});
            setLabTimesPerDay({});
            setLectureTimeMode('shared');
            setLabTimeMode('shared');
            setLectureSplitMode('even');
            setLabSplitMode('even');
            setLectureHoursPerDay({});
            setLabHoursPerDay({});
            setLabStartTime(null);
            return;
        }
        if (keepResult && blockSelection && blockFitResult && !('error' in blockFitResult)) {
            setLectureDays(blockFitResult.lectureDays);
            setLabDays(blockFitResult.labDays);
            setStartTime(blockSelection.start);
            setLabStartTime(null);
            setLectureSplitMode('custom');
            setLabSplitMode('custom');
            setLectureHoursPerDay(blockFitResult.lectureHoursPerDay);
            setLabHoursPerDay(blockFitResult.labHoursPerDay);
        }
        setBlockFit(false);
        setBlockSelection(null);
    }, [blockSelection, blockFitResult, setSmartSplit, setSmartSplitDays, setBlockFit, setBlockSelection, setLecTbaHours, setLabTbaHours, setLectureTimesPerDay, setLabTimesPerDay, setLectureTimeMode, setLabTimeMode, setLectureSplitMode, setLabSplitMode, setLectureHoursPerDay, setLabHoursPerDay, setLabStartTime, setLectureDays, setLabDays, setStartTime]);

    // Section fields for the fitted schedule — saved as a fixed manual split, like Smart Split
    const blockFitSectionFields = useCallback(() => {
        if (!blockFit || !blockSelection || !blockFitResult || 'error' in blockFitResult) return null;
        return {
            lectureDays: blockFitResult.lectureDays, lecTbaHours: 0,
            labDays: blockFitResult.labDays, labTbaHours: 0,
            startTime: blockSelection.start, labStartTime: null,
            schemaVersion: 2 as const,
            lectureTimeMode: 'shared' as const, labTimeMode: 'shared' as const,
            lectureTimesPerDay: {}, labTimesPerDay: {},
            lectureSplitMode: 'custom' as const, labSplitMode: 'custom' as const,
            lectureHoursPerDay: blockFitResult.lectureHoursPerDay,
            labHoursPerDay: blockFitResult.labHoursPerDay,
        };
    }, [blockFit, blockSelection, blockFitResult]);

    return {
        sheet, session, meetingsByDay, canBlockFit,
        blockFitResult, selectBlock, handleBlockFitToggle, blockFitSectionFields
    };
}
