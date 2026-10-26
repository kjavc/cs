// src/App.tsx
import React, { useState, useEffect } from 'react';
import './App.css';
import { useSections } from './hooks/useSections';
import { useRules } from './hooks/useRules';
import { useSettings } from './hooks/useSettings';
import { useCatalog } from './hooks/useCatalog';
import { useWorkspace } from './hooks/useWorkspace';
import { useRooms } from './hooks/useRooms';
import { generateSchedule, meetingsPerWeekday } from './utils/scheduleGenerator';
import { computeSmartSplit } from './utils/smartSplit';
import { ScheduleRequest } from './components/CourseInput';
import { RuleAndTermContext, AcademicTerm, ScheduleInfo } from './types';
import { academicCalendar } from './types/calendar';

import { useMediaQuery } from './hooks/useMediaQuery';
import { DesktopView } from './components/layout/DesktopView';
import { MobileView } from './components/layout/MobileView';
import { AppLoader } from './components/AppLoader';
import { ToastProvider } from './components/Toast';
import ConfirmModal from './components/ConfirmModal';
import { decodeSections } from './utils/shareUtils';
import { SavedSection } from './types';
import SplitterView from './splitter/SplitterView';

function App() {
  const sectionsAPI = useSections();
  const rulesAPI = useRules();
  const settingsAPI = useSettings();
  const catalogAPI = useCatalog(settingsAPI.selectedTermId);
  const workspaceAPI = useWorkspace();
  const roomsAPI = useRooms(settingsAPI.selectedDivisionId);
  const [calendar] = useState<AcademicTerm[]>(academicCalendar);
  const [appMode, setAppMode] = useState<'scheduler' | 'splitter'>('scheduler');
  const [pendingImport, setPendingImport] = useState<SavedSection[] | null>(null);

  // Read URL hash on mount for shared schedule import
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && hash.startsWith('v1:')) {
      const sections = decodeSections(hash);
      if (sections && sections.length > 0) {
        setPendingImport(sections);
      }
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // Destructure for the useEffect dependencies
  const { lectureUnits, lectureDays, labUnits, labDays, lecTbaHours, labTbaHours, fixedHours, setGeneratedSchedule, setLastRequest, setIsCalculating, smartSplit, smartSplitDays } = workspaceAPI;
  const { startTime, labStartTime, selectedTermId, selectedSessionId,
    lectureTimeMode, labTimeMode, lectureTimesPerDay, labTimesPerDay,
    lectureSplitMode, labSplitMode, lectureHoursPerDay, labHoursPerDay } = settingsAPI;
  const { contactHourRules, attendanceRules } = rulesAPI;

  const selectedTerm = calendar.find(t => t.id === selectedTermId) || calendar[0];
  const selectedSession = selectedTerm.sessions.find(s => s.id === selectedSessionId) || selectedTerm.sessions[0];

  useEffect(() => {
    // Skip if everything is 0
    if (lectureUnits === 0 && labUnits === 0) {
      setGeneratedSchedule(null);
      setLastRequest(null);
      setIsCalculating(false);
      return;
    }

    setIsCalculating(true);
    const handler = setTimeout(() => {
      if (contactHourRules && attendanceRules) {
        const context: RuleAndTermContext = { contactHourRules, attendanceRules, term: selectedTerm, session: selectedSession };

        if (smartSplit && smartSplitDays.length > 0 && lectureUnits > 0 && labUnits > 0) {
          // Smart Split path
          const result = computeSmartSplit(lectureUnits, labUnits, smartSplitDays, selectedSession.weeks, meetingsPerWeekday(selectedTerm, selectedSession, attendanceRules));
          if ('error' in result) {
            const emptyInfo: ScheduleInfo = { contactHoursForTerm: 0, weeklyContactHours: 0, totalScheduledContactHours: 0, contactHoursPerDay: 0, totalBreakMinutesPerDay: 0, actualMeetingDays: 0 };
            setGeneratedSchedule({ lectureInfo: emptyInfo, labInfo: emptyInfo, scheduleBlocks: [], warnings: ['ERROR: ' + result.error] });
          } else {
            const request: ScheduleRequest = {
              lectureUnits, lectureDays: result.lectureDays,
              labUnits, labDays: result.labDays,
              lecTbaHours: 0, labTbaHours: 0
            };
            const overrides = {
              lectureHoursPerDay: result.lectureHoursPerDay,
              labHoursPerDay: result.labHoursPerDay,
            };
            const schedule = generateSchedule(request, context, startTime, null, overrides);
            setGeneratedSchedule(schedule);
            setLastRequest(request);
          }
        } else {
          // Manual path
          const request: ScheduleRequest = { lectureUnits, lectureDays, labUnits, labDays, lecTbaHours, labTbaHours, fixedHours };
          const overrides = {
            lectureTimesPerDay: lectureTimeMode === 'perDay' ? lectureTimesPerDay : undefined,
            labTimesPerDay: labTimeMode === 'perDay' ? labTimesPerDay : undefined,
            lectureHoursPerDay: lectureSplitMode === 'custom' ? lectureHoursPerDay : undefined,
            labHoursPerDay: labSplitMode === 'custom' ? labHoursPerDay : undefined,
          };
          const schedule = generateSchedule(request, context, startTime, labStartTime, overrides);
          setGeneratedSchedule(schedule);
          setLastRequest(request);
        }
      }
      setIsCalculating(false);
    }, 500);

    return () => clearTimeout(handler);
  }, [
    lectureUnits, lectureDays, labUnits, labDays, lecTbaHours, labTbaHours, fixedHours,
    startTime, labStartTime, selectedTermId, selectedSessionId,
    lectureTimeMode, labTimeMode, lectureTimesPerDay, labTimesPerDay,
    lectureSplitMode, labSplitMode, lectureHoursPerDay, labHoursPerDay,
    smartSplit, smartSplitDays,
    contactHourRules, attendanceRules, selectedTerm, selectedSession,
    setGeneratedSchedule, setLastRequest, setIsCalculating
  ]);

  const appProps = {
    sectionsAPI,
    rulesAPI,
    settingsAPI,
    catalogAPI,
    workspaceAPI,
    roomsAPI,
    calendar,
    appMode,
    setAppMode
  };

  const isMobile = useMediaQuery('(max-width: 768px)');

  if (!contactHourRules || !attendanceRules) {
    return <AppLoader />;
  }

  return (
    <ToastProvider>
      {appMode === 'splitter' ? (
        <SplitterView attendanceRules={attendanceRules} appMode={appMode} setAppMode={setAppMode} />
      ) : (
        isMobile ? <MobileView {...appProps} /> : <DesktopView {...appProps} />
      )}
      {pendingImport && (
        <ConfirmModal
          title="Import Shared Schedule"
          message={`This link contains ${pendingImport.length} section${pendingImport.length !== 1 ? 's' : ''}. Import them? This will replace your current saved sections.`}
          confirmText="Import"
          cancelText="Cancel"
          onConfirm={() => {
            sectionsAPI.importSections(pendingImport);
            setPendingImport(null);
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </ToastProvider>
  );
}

export default App;
