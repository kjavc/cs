// src/components/layout/MobileView.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '../Toast';
import { AppViewProps } from './AppViewProps';
import { MobileHeader } from './mobile/MobileHeader';
import { MobileSidebar } from './mobile/MobileSidebar';
import { MobileConfig } from './mobile/MobileConfig';
import ScheduleDisplay, { BlockMoveEvent } from '../ScheduleDisplay';
import { useRoomContext } from '../../hooks/useRoomContext';
import HelpModal from '../HelpModal';
import ConfirmModal from '../ConfirmModal';
import {
    SavedSection,
    ExportType
} from '../../types';
import { generateSchedule, meetingsPerWeekday } from '../../utils/scheduleGenerator';
import { computeSmartSplit } from '../../utils/smartSplit';
import { formatScheduleSimple, formatScheduleDetailed, formatBulkExport, copyToClipboard } from '../../utils/copyUtils';
import { generateShareUrl } from '../../utils/shareUtils';

import { exportForSpreadsheet } from '../../utils/spreadsheetExport';
import './MobileView.css';

export const MobileView: React.FC<AppViewProps> = ({
    sectionsAPI,
    rulesAPI,
    settingsAPI,
    catalogAPI,
    workspaceAPI,
    roomsAPI,
    calendar,
    appMode,
    setAppMode
}) => {
    const { showToast } = useToast();
    const {
        savedSections, currentSectionId, setCurrentSectionId, saveSection
    } = sectionsAPI;

    const { contactHourRules, attendanceRules } = rulesAPI;

    const {
        selectedTermId, setSelectedTermId, selectedSessionId, setSelectedSessionId,
        startTime, setStartTime, labStartTime, setLabStartTime, theme,
        timeFormat,
        lectureTimeMode, setLectureTimeMode,
        labTimeMode, setLabTimeMode,
        lectureTimesPerDay, setLectureTimesPerDay,
        labTimesPerDay, setLabTimesPerDay,
        lectureSplitMode, setLectureSplitMode,
        labSplitMode, setLabSplitMode,
        lectureHoursPerDay, setLectureHoursPerDay,
        labHoursPerDay, setLabHoursPerDay,
        lectureBuildingId, setLectureBuildingId,
        lectureRoomId, setLectureRoomId,
        labBuildingId, setLabBuildingId,
        labRoomId, setLabRoomId,
        selectedDivisionId
    } = settingsAPI;

    const { buildings, findRoom } = roomsAPI;

    const { catalog, divisions, departments } = catalogAPI;

    const {
        lectureUnits, setLectureUnits, lectureDays, setLectureDays, labUnits, setLabUnits,
        lecTbaHours, setLecTbaHours, labTbaHours, setLabTbaHours,
        labDays, setLabDays, isLecFixed, isLabFixed,
        lecRange, labRange,
        generatedSchedule, setGeneratedSchedule,
        lastRequest, setLastRequest,
        selectedCourseInfo, handleCourseSelect, fixedHours, setFixedHours,
        getWorkspaceAsSection, isCalculating, clearCourseSelection,
        smartSplit, setSmartSplit, smartSplitDays, setSmartSplitDays
    } = workspaceAPI;

    // UI States
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isConfirmNewOpen, setIsConfirmNewOpen] = useState(false);
    const [isConfigExpanded, setIsConfigExpanded] = useState(true);
    const hasAutoCollapsed = useRef(false);

    useEffect(() => {
        if (generatedSchedule && generatedSchedule.scheduleBlocks.length > 0 && !hasAutoCollapsed.current) {
            hasAutoCollapsed.current = true;
            setIsConfigExpanded(false);
        }
    }, [generatedSchedule]);

    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [overlaySectionIds, setOverlaySectionIds] = useState<string[]>([]);

    const handleSaveSection = useCallback(() => {
        if (lectureUnits === 0 && labUnits === 0) {
            showToast("Enter units first", "error");
            return;
        }

        let sectionName = `Section ${savedSections.length + 1}`;
        if (selectedCourseInfo) {
            const { sub, no } = selectedCourseInfo;
            const existingCount = savedSections.filter(s => s.name.startsWith(`${sub} ${no}`)).length;
            const sectionNum = String(existingCount + 1).padStart(2, '0');
            sectionName = `${sub} ${no} ${sectionNum}`;
        }

        if (smartSplit && smartSplitDays.length > 0) {
            const selTerm = calendar.find(t => t.id === selectedTermId) || calendar[0];
            const selSession = selTerm.sessions.find(s => s.id === selectedSessionId) || selTerm.sessions[0];
            const result = computeSmartSplit(lectureUnits, labUnits, smartSplitDays, selSession.weeks, attendanceRules ? meetingsPerWeekday(selTerm, selSession, attendanceRules) : undefined);
            if (!('error' in result)) {
                saveSection({
                    lectureUnits, lectureDays: result.lectureDays, lecTbaHours: 0,
                    labUnits, labDays: result.labDays, labTbaHours: 0,
                    startTime, labStartTime: null, selectedTermId, selectedSessionId,
                    schemaVersion: 2 as const,
                    lectureTimeMode: 'shared', labTimeMode: 'shared',
                    lectureTimesPerDay: {}, labTimesPerDay: {},
                    lectureSplitMode: 'custom', labSplitMode: 'custom',
                    lectureHoursPerDay: result.lectureHoursPerDay,
                    labHoursPerDay: result.labHoursPerDay,
                    lectureBuildingId, lectureRoomId, labBuildingId, labRoomId,
                    ...(currentSectionId ? {} : { name: sectionName })
                });
                showToast("Section saved. Smart Split sections save as fixed schedules — edits will use Manual mode.", "info");
                return;
            }
        }

        const usesV2 = lectureTimeMode === 'perDay' || labTimeMode === 'perDay' || lectureSplitMode === 'custom' || labSplitMode === 'custom' || !!lectureRoomId || !!labRoomId;
        saveSection({
            lectureUnits, lectureDays, lecTbaHours, labUnits, labDays, labTbaHours, fixedHours, startTime, labStartTime, selectedTermId, selectedSessionId,
            ...(usesV2 ? { schemaVersion: 2 as const, lectureTimeMode, labTimeMode, lectureTimesPerDay, labTimesPerDay, lectureSplitMode, labSplitMode, lectureHoursPerDay, labHoursPerDay, lectureBuildingId, lectureRoomId, labBuildingId, labRoomId } : {}),
            ...(currentSectionId ? {} : { name: sectionName })
        });
        showToast(currentSectionId ? "Updated" : "Saved");
    }, [saveSection, lectureUnits, lectureDays, lecTbaHours, labUnits, labDays, labTbaHours, startTime, labStartTime, selectedTermId, selectedSessionId, lectureTimeMode, labTimeMode, lectureTimesPerDay, labTimesPerDay, lectureSplitMode, labSplitMode, lectureHoursPerDay, labHoursPerDay, selectedCourseInfo, fixedHours, savedSections, currentSectionId, smartSplit, smartSplitDays, calendar, attendanceRules, lectureBuildingId, lectureRoomId, labBuildingId, labRoomId, showToast]);

    const handleSaveAsNew = useCallback(() => {
        if (lectureUnits === 0 && labUnits === 0) {
            showToast("Enter units first", "error");
            return;
        }

        let sectionName = `Section ${savedSections.length + 1}`;
        if (selectedCourseInfo) {
            const { sub, no } = selectedCourseInfo;
            const existingCount = savedSections.filter(s => s.name.startsWith(`${sub} ${no}`)).length;
            const sectionNum = String(existingCount + 1).padStart(2, '0');
            sectionName = `${sub} ${no} ${sectionNum}`;
        }

        const usesV2 = lectureTimeMode === 'perDay' || labTimeMode === 'perDay' || lectureSplitMode === 'custom' || labSplitMode === 'custom' || !!lectureRoomId || !!labRoomId;
        saveSection({
            lectureUnits, lectureDays, lecTbaHours, labUnits, labDays, labTbaHours, fixedHours, startTime, labStartTime, selectedTermId, selectedSessionId,
            ...(usesV2 ? { schemaVersion: 2 as const, lectureTimeMode, labTimeMode, lectureTimesPerDay, labTimesPerDay, lectureSplitMode, labSplitMode, lectureHoursPerDay, labHoursPerDay, lectureBuildingId, lectureRoomId, labBuildingId, labRoomId } : {}),
            name: sectionName
        }, true);
        showToast("Saved as new copy");
    }, [saveSection, lectureUnits, lectureDays, lecTbaHours, labUnits, labDays, labTbaHours, startTime, labStartTime, selectedTermId, selectedSessionId, lectureTimeMode, labTimeMode, lectureTimesPerDay, labTimesPerDay, lectureSplitMode, labSplitMode, lectureHoursPerDay, labHoursPerDay, selectedCourseInfo, fixedHours, savedSections, showToast]);


    const handleLoadSection = useCallback((section: SavedSection) => {
        setSmartSplit(false);
        setSmartSplitDays([]);
        setCurrentSectionId(section.id);
        setLectureUnits(section.lectureUnits);
        setLectureDays(section.lectureDays);
        setLecTbaHours(section.lecTbaHours || 0);
        setLabUnits(section.labUnits);
        setLabDays(section.labDays);
        setLabTbaHours(section.labTbaHours || 0);
        setFixedHours(section.fixedHours);
        setStartTime(section.startTime);
        setLabStartTime(section.labStartTime);
        setSelectedTermId(section.selectedTermId);
        setSelectedSessionId(section.selectedSessionId);
        setLectureTimeMode(section.lectureTimeMode ?? 'shared');
        setLabTimeMode(section.labTimeMode ?? 'shared');
        setLectureTimesPerDay((section.lectureTimesPerDay as Record<string, string>) ?? {});
        setLabTimesPerDay((section.labTimesPerDay as Record<string, string>) ?? {});
        setLectureSplitMode(section.lectureSplitMode ?? 'even');
        setLabSplitMode(section.labSplitMode ?? 'even');
        setLectureHoursPerDay((section.lectureHoursPerDay as Record<string, number>) ?? {});
        setLabHoursPerDay((section.labHoursPerDay as Record<string, number>) ?? {});
        setLectureBuildingId(section.lectureBuildingId ?? '');
        setLectureRoomId(section.lectureRoomId ?? '');
        setLabBuildingId(section.labBuildingId ?? '');
        setLabRoomId(section.labRoomId ?? '');

        if (contactHourRules && attendanceRules) {
            const term = calendar.find(t => t.id === section.selectedTermId) || calendar[0];
            const session = term.sessions.find(s => s.id === section.selectedSessionId) || term.sessions[0];
            const context = { contactHourRules, attendanceRules, term, session };
            const request = {
                lectureUnits: section.lectureUnits, lectureDays: section.lectureDays, lecTbaHours: section.lecTbaHours || 0,
                labUnits: section.labUnits, labDays: section.labDays, labTbaHours: section.labTbaHours || 0,
                fixedHours: section.fixedHours
            };
            const overrides = {
                lectureTimesPerDay: section.lectureTimeMode === 'perDay' ? (section.lectureTimesPerDay as Record<string, string>) : undefined,
                labTimesPerDay: section.labTimeMode === 'perDay' ? (section.labTimesPerDay as Record<string, string>) : undefined,
                lectureHoursPerDay: section.lectureSplitMode === 'custom' ? (section.lectureHoursPerDay as Record<string, number>) : undefined,
                labHoursPerDay: section.labSplitMode === 'custom' ? (section.labHoursPerDay as Record<string, number>) : undefined,
            };
            setGeneratedSchedule(generateSchedule(request, context, section.startTime, section.labStartTime, overrides));
            setLastRequest(request);
        }
        setIsSidebarOpen(false);
        setIsConfigExpanded(false);
    }, [contactHourRules, attendanceRules, calendar, setCurrentSectionId, setLectureUnits, setLectureDays, setLecTbaHours, setLabUnits, setLabDays, setLabTbaHours, setFixedHours, setStartTime, setLabStartTime, setSelectedTermId, setSelectedSessionId, setLectureTimeMode, setLabTimeMode, setLectureTimesPerDay, setLabTimesPerDay, setLectureSplitMode, setLabSplitMode, setLectureHoursPerDay, setLabHoursPerDay, setGeneratedSchedule, setLastRequest]);

    const toggleOverlay = (id: string) => {
        setOverlaySectionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const canSmartSplit = lectureUnits > 0 && labUnits > 0 && !fixedHours;

    const handleSmartSplitToggle = useCallback((enabled: boolean) => {
        if (enabled) {
            setSmartSplit(true);
            setSmartSplitDays([]);
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
        } else {
            const selTerm = calendar.find(t => t.id === selectedTermId) || calendar[0];
            const selSession = selTerm.sessions.find(s => s.id === selectedSessionId) || selTerm.sessions[0];
            if (smartSplitDays.length > 0 && lectureUnits > 0 && labUnits > 0) {
                const result = computeSmartSplit(lectureUnits, labUnits, smartSplitDays, selSession.weeks, attendanceRules ? meetingsPerWeekday(selTerm, selSession, attendanceRules) : undefined);
                if (!('error' in result)) {
                    setLectureDays(result.lectureDays);
                    setLabDays(result.labDays);
                    setLectureSplitMode('custom');
                    setLabSplitMode('custom');
                    setLectureHoursPerDay(result.lectureHoursPerDay);
                    setLabHoursPerDay(result.labHoursPerDay);
                }
            }
            setSmartSplit(false);
            setSmartSplitDays([]);
        }
    }, [smartSplitDays, lectureUnits, labUnits, calendar, attendanceRules, selectedTermId, selectedSessionId, setSmartSplit, setSmartSplitDays, setLectureDays, setLabDays, setLecTbaHours, setLabTbaHours, setLectureTimesPerDay, setLabTimesPerDay, setLectureTimeMode, setLabTimeMode, setLectureSplitMode, setLabSplitMode, setLectureHoursPerDay, setLabHoursPerDay, setLabStartTime]);

    React.useEffect(() => {
        if (smartSplit && (lectureUnits <= 0 || labUnits <= 0)) {
            setSmartSplit(false);
            setSmartSplitDays([]);
            showToast("Smart Split requires both lecture and lab — switching to Manual mode.", "info");
        }
    }, [smartSplit, lectureUnits, labUnits, setSmartSplit, setSmartSplitDays, showToast]);

    const WEEK_DAYS_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const handleBlockMove = useCallback((event: BlockMoveEvent) => {
        const { type, fromDay, toDay, newStartTime, isPerDayMove } = event;

        if (smartSplit) {
            if (fromDay === toDay) {
                setStartTime(newStartTime);
            } else {
                if (smartSplitDays.includes(toDay)) return;
                const newDays = smartSplitDays.map(d => d === fromDay ? toDay : d)
                    .sort((a, b) => WEEK_DAYS_ORDER.indexOf(a) - WEEK_DAYS_ORDER.indexOf(b));
                setSmartSplitDays(newDays);
            }
            return;
        }

        const isLecture = type === 'lecture';
        const days = isLecture ? lectureDays : labDays;
        const setDays = isLecture ? setLectureDays : setLabDays;
        const setTimeMode = isLecture ? setLectureTimeMode : setLabTimeMode;
        const timesPerDay = isLecture ? lectureTimesPerDay : labTimesPerDay;
        const setTimesPerDay = isLecture ? setLectureTimesPerDay : setLabTimesPerDay;

        if (isPerDayMove) {
            const currentSharedTime = isLecture ? startTime : (labStartTime ?? startTime);
            const timeMode = isLecture ? lectureTimeMode : labTimeMode;
            if (timeMode === 'shared') {
                const prefilled: Record<string, string> = {};
                for (const d of days) prefilled[d] = currentSharedTime;
                prefilled[toDay] = newStartTime;
                setTimesPerDay(prefilled);
                setTimeMode('perDay');
            } else {
                setTimesPerDay({ ...timesPerDay, [toDay]: newStartTime });
            }

            if (fromDay !== toDay && !days.includes(toDay)) {
                const newDays = days.map(d => d === fromDay ? toDay : d)
                    .sort((a, b) => WEEK_DAYS_ORDER.indexOf(a) - WEEK_DAYS_ORDER.indexOf(b));
                setDays(newDays);
                const updated = { ...timesPerDay, [toDay]: newStartTime };
                delete updated[fromDay];
                setTimesPerDay(updated);
                const setSplitMode = isLecture ? setLectureSplitMode : setLabSplitMode;
                const setHoursPerDay = isLecture ? setLectureHoursPerDay : setLabHoursPerDay;
                setSplitMode('even');
                setHoursPerDay({});
            }
        } else {
            const timeMode = isLecture ? lectureTimeMode : labTimeMode;
            if (isLecture) {
                setStartTime(newStartTime);
            } else {
                setLabStartTime(newStartTime);
            }
            if (timeMode === 'perDay') {
                setTimeMode('shared');
                setTimesPerDay({});
            }
        }
    }, [smartSplit, smartSplitDays, setSmartSplitDays, lectureDays, labDays, setLectureDays, setLabDays, lectureTimeMode, labTimeMode, setLectureTimeMode, setLabTimeMode, lectureTimesPerDay, labTimesPerDay, setLectureTimesPerDay, setLabTimesPerDay, startTime, labStartTime, setStartTime, setLabStartTime, setLectureSplitMode, setLabSplitMode, setLectureHoursPerDay, setLabHoursPerDay]);

    const handleCopy = (summaryType: ExportType) => {
        if (!generatedSchedule) return;

        let text = "";
        let toastMsg = "Copied!";

        if (summaryType === 'spreadsheet') {
            let name = "Current";
            if (selectedCourseInfo) name = `${selectedCourseInfo.sub} ${selectedCourseInfo.no} 01`;
            else if (currentSectionId) name = savedSections.find(s => s.id === currentSectionId)?.name || name;

            const temp = getWorkspaceAsSection('temp', name, { startTime, labStartTime, selectedTermId, selectedSessionId, lectureTimeMode, labTimeMode, lectureTimesPerDay, labTimesPerDay, lectureSplitMode, labSplitMode, lectureHoursPerDay, labHoursPerDay, lectureBuildingId, lectureRoomId, labBuildingId, labRoomId });
            text = exportForSpreadsheet([temp], calendar, attendanceRules);
            toastMsg = "Section copied (Spreadsheet)!";
        } else if (summaryType === 'simple') {
            text = formatScheduleSimple(generatedSchedule, timeFormat);
            toastMsg = "Simple summary copied!";
        } else {
            let name = currentSectionId ? savedSections.find(s => s.id === currentSectionId)?.name || 'Current' : 'Current';
            text = formatScheduleDetailed(generatedSchedule, name, timeFormat);
            toastMsg = "Detailed summary copied!";
        }

        if (text) {
            copyToClipboard(text).then(success => {
                if (success) showToast(toastMsg);
                else showToast("Failed to copy", "error");
            });
        }
    };

    const handleExportAll = () => {
        if (savedSections.length === 0) {
            showToast("No sections to export", "error");
            return;
        }
        const text = formatBulkExport(savedSections, calendar);
        copyToClipboard(text).then(success => {
            if (success) showToast("All sections copied (Detailed)!");
            else showToast("Failed to copy", "error");
        });
        setIsSidebarOpen(false);
    };

    const handleShareUrl = () => {
        if (savedSections.length === 0) {
            showToast("No sections to share", "error");
            return;
        }
        const url = generateShareUrl(savedSections);
        copyToClipboard(url).then(success => {
            if (success) showToast("Share link copied!");
            else showToast("Failed to copy link", "error");
        });
        setIsSidebarOpen(false);
    };

    const handleExportSpreadsheet = () => {
        if (savedSections.length === 0) {
            showToast("No sections to export", "error");
            return;
        }
        const text = exportForSpreadsheet(savedSections, calendar, attendanceRules);
        copyToClipboard(text).then(success => {
            if (success) showToast("All sections copied (Spreadsheet)!");
            else showToast("Failed to copy", "error");
        });
        setIsSidebarOpen(false);
    };


    const clearWorkspace = () => {
        setCurrentSectionId(null);
        if (!selectedCourseInfo) {
            setFixedHours(undefined);
            setLectureUnits(0);
            setLecTbaHours(0);
            setLabUnits(0);
            setLabTbaHours(0);
        }
        setLectureDays([]);
        setLabDays([]);
        setGeneratedSchedule(null);
        setLastRequest(null);
        setIsConfirmNewOpen(false);
        setLectureTimeMode('shared');
        setLabTimeMode('shared');
        setLectureTimesPerDay({});
        setLabTimesPerDay({});
        setLectureSplitMode('even');
        setLabSplitMode('even');
        setLectureHoursPerDay({});
        setLabHoursPerDay({});
        setLectureBuildingId('');
        setLectureRoomId('');
        setLabBuildingId('');
        setLabRoomId('');
        setSmartSplit(false);
        setSmartSplitDays([]);
        showToast("Ready for new section", "info");
    };

    const handleNewRequest = () => {
        const isModified = currentSectionId || lectureUnits > 0 || labUnits > 0;
        if (isModified) setIsConfirmNewOpen(true);
        else clearWorkspace();
    };

    const handleConfirmSaveNew = () => {
        handleSaveSection();
        clearWorkspace();
    };

    const selectedTerm = calendar.find(t => t.id === selectedTermId) || calendar[0];
    const selectedSession = selectedTerm.sessions.find(s => s.id === selectedSessionId) || selectedTerm.sessions[0];

    // ROOMS: disabled until feature ships
    const roomContextSchedules: never[] = [];
    /* const roomContextSchedules = useRoomContext({
        savedSections,
        currentSectionId,
        lectureRoomId,
        labRoomId,
        selectedTermId,
        selectedSessionId,
        calendar,
        contactHourRules,
        attendanceRules
    }); */

    const checkIsModified = (id: string) => {
        if (id !== currentSectionId) return false;
        return true;
    };

    return (
        <div className="mobile-view">
            <MobileHeader
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onSave={handleSaveSection}
                onSaveAsNew={handleSaveAsNew}
                onNew={handleNewRequest}
                onCopySimple={() => handleCopy('simple')}
                onCopyDetailed={() => handleCopy('detailed')}
                onCopySpreadsheet={() => handleCopy('spreadsheet')}
                workspaceAPI={workspaceAPI}
                sectionsAPI={sectionsAPI}
                selectedTermId={selectedTermId}
            />

            <main className="mv-content">
                <MobileConfig
                    isConfigExpanded={isConfigExpanded}
                    setIsConfigExpanded={setIsConfigExpanded}
                    selectedTerm={selectedTerm}
                    selectedSession={selectedSession}
                    selectedTermId={selectedTermId}
                    setSelectedTermId={setSelectedTermId}
                    selectedSessionId={selectedSessionId}
                    setSelectedSessionId={setSelectedSessionId}
                    calendar={calendar}
                    startTime={startTime}
                    setStartTime={setStartTime}
                    labStartTime={labStartTime}
                    setLabStartTime={setLabStartTime}
                    handleLabLockToggle={() => setLabStartTime(labStartTime === null ? '13:00' : null)}
                    timeFormat={timeFormat}
                    catalog={catalog}
                    divisions={divisions}
                    departments={departments}
                    handleCourseSelect={handleCourseSelect}
                    onClearCourse={clearCourseSelection}
                    selectedCourseInfo={selectedCourseInfo}
                    lectureUnits={lectureUnits}
                    setLectureUnits={setLectureUnits}
                    lectureDays={lectureDays}
                    setLectureDays={setLectureDays}
                    lecTbaHours={lecTbaHours}
                    fixedHours={fixedHours}
                    setLecTbaHours={setLecTbaHours}
                    labUnits={labUnits}
                    setLabUnits={setLabUnits}
                    labDays={labDays}
                    setLabDays={setLabDays}
                    labTbaHours={labTbaHours}
                    setLabTbaHours={setLabTbaHours}
                    isLecFixed={isLecFixed}
                    isLabFixed={isLabFixed}
                    lecRange={lecRange}
                    labRange={labRange}
                    lectureTimeMode={lectureTimeMode}
                    setLectureTimeMode={setLectureTimeMode}
                    labTimeMode={labTimeMode}
                    setLabTimeMode={setLabTimeMode}
                    lectureTimesPerDay={lectureTimesPerDay}
                    setLectureTimesPerDay={setLectureTimesPerDay}
                    labTimesPerDay={labTimesPerDay}
                    setLabTimesPerDay={setLabTimesPerDay}
                    lectureSplitMode={lectureSplitMode}
                    setLectureSplitMode={setLectureSplitMode}
                    labSplitMode={labSplitMode}
                    setLabSplitMode={setLabSplitMode}
                    lectureHoursPerDay={lectureHoursPerDay}
                    setLectureHoursPerDay={setLectureHoursPerDay}
                    labHoursPerDay={labHoursPerDay}
                    setLabHoursPerDay={setLabHoursPerDay}
                    buildings={buildings}
                    hasDivision={!!selectedDivisionId}
                    lectureBuildingId={lectureBuildingId}
                    setLectureBuildingId={setLectureBuildingId}
                    lectureRoomId={lectureRoomId}
                    setLectureRoomId={setLectureRoomId}
                    labBuildingId={labBuildingId}
                    setLabBuildingId={setLabBuildingId}
                    labRoomId={labRoomId}
                    setLabRoomId={setLabRoomId}
                    smartSplit={smartSplit}
                    setSmartSplit={setSmartSplit}
                    smartSplitDays={smartSplitDays}
                    setSmartSplitDays={setSmartSplitDays}
                    canSmartSplit={canSmartSplit}
                    onSmartSplitToggle={handleSmartSplitToggle}
                />

                <ScheduleDisplay
                    schedule={generatedSchedule}
                    request={lastRequest}
                    timeFormat={timeFormat}
                    resultsHeadingRef={{ current: null }}
                    isCalculating={isCalculating}
                    onBlockMove={handleBlockMove}
                    lectureDays={lectureDays}
                    labDays={labDays}
                    roomContextSchedules={roomContextSchedules}
                    overlaidSchedules={savedSections.filter(s => overlaySectionIds.includes(s.id)).map(s => {
                        // This is a bit expensive but necessary if we want overlays on mobile
                        // In the real app we'd probably cache generated schedules for overlays
                        const term = calendar.find(t => t.id === s.selectedTermId) || calendar[0];
                        const session = term.sessions.find(sn => sn.id === s.selectedSessionId) || term.sessions[0];
                        const context = { contactHourRules: rulesAPI.contactHourRules!, attendanceRules: rulesAPI.attendanceRules!, term, session };
                        const request = { lectureUnits: s.lectureUnits, lectureDays: s.lectureDays, labUnits: s.labUnits, labDays: s.labDays, fixedHours: s.fixedHours };
                        const overrides = {
                            lectureTimesPerDay: s.lectureTimeMode === 'perDay' ? (s.lectureTimesPerDay as Record<string, string>) : undefined,
                            labTimesPerDay: s.labTimeMode === 'perDay' ? (s.labTimesPerDay as Record<string, string>) : undefined,
                            lectureHoursPerDay: s.lectureSplitMode === 'custom' ? (s.lectureHoursPerDay as Record<string, number>) : undefined,
                            labHoursPerDay: s.labSplitMode === 'custom' ? (s.labHoursPerDay as Record<string, number>) : undefined,
                        };
                        return {
                            id: s.id,
                            name: s.name,
                            schedule: generateSchedule(request, context, s.startTime, s.labStartTime, overrides)
                        };
                    })}
                />
            </main>

            {isSidebarOpen && (
                <MobileSidebar
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    sectionsAPI={sectionsAPI}
                    settingsAPI={settingsAPI}
                    workspaceAPI={workspaceAPI}
                    calendar={calendar}
                    attendanceRules={attendanceRules}
                    checkIsModified={checkIsModified}
                    handleLoadSection={handleLoadSection}
                    overlaySectionIds={overlaySectionIds}
                    toggleOverlay={toggleOverlay}
                    setIsHelpOpen={setIsHelpOpen}
                    isSettingsOpen={isSettingsOpen}
                    setIsSettingsOpen={setIsSettingsOpen}
                    handleExportAll={handleExportAll}
                    handleExportSpreadsheet={handleExportSpreadsheet}
                    handleShareUrl={handleShareUrl}
                />
            )}

            {isHelpOpen && (
                <HelpModal onClose={() => setIsHelpOpen(false)} />
            )}

            {isConfirmNewOpen && (
                <ConfirmModal
                    title="Save?"
                    message="Save current work first?"
                    onConfirm={handleConfirmSaveNew}
                    onCancel={clearWorkspace}
                    confirmText="Save"
                    cancelText="Discard"
                />
            )}
        </div>
    );
};
