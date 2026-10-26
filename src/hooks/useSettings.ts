import { useState, useEffect } from 'react';
import { LOCAL_STORAGE_KEY, academicCalendar } from '../types/calendar';
import { TimeMode, SplitMode } from '../types/section';

export function useSettings() {
    const [selectedTermId, setSelectedTermId] = useState<string>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return saved ? JSON.parse(saved).selectedTermId : academicCalendar[0].id;
    });
    const [selectedSessionId, setSelectedSessionId] = useState<string>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return saved ? JSON.parse(saved).selectedSessionId : academicCalendar[0].sessions[0].id;
    });
    const [startTime, setStartTime] = useState<string>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return saved ? JSON.parse(saved).startTime : '08:00';
    });
    const [labStartTime, setLabStartTime] = useState<string | null>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return saved ? JSON.parse(saved).labStartTime : null;
    });

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return saved ? JSON.parse(saved).theme : 'light';
    });
    const [daySelectionMode, setDaySelectionMode] = useState<'simple' | 'advanced'>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return saved ? JSON.parse(saved).daySelectionMode : 'simple';
    });
    const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return saved ? JSON.parse(saved).timeFormat : '12h';
    });

    const [lectureTimeMode, setLectureTimeMode] = useState<TimeMode>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).lectureTimeMode) || 'shared';
    });
    const [labTimeMode, setLabTimeMode] = useState<TimeMode>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).labTimeMode) || 'shared';
    });
    const [lectureTimesPerDay, setLectureTimesPerDay] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).lectureTimesPerDay) || {};
    });
    const [labTimesPerDay, setLabTimesPerDay] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).labTimesPerDay) || {};
    });

    const [lectureSplitMode, setLectureSplitMode] = useState<SplitMode>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).lectureSplitMode) || 'even';
    });
    const [labSplitMode, setLabSplitMode] = useState<SplitMode>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).labSplitMode) || 'even';
    });
    const [lectureHoursPerDay, setLectureHoursPerDay] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).lectureHoursPerDay) || {};
    });
    const [labHoursPerDay, setLabHoursPerDay] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).labHoursPerDay) || {};
    });

    const [selectedDivisionId, setSelectedDivisionId] = useState<string>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).selectedDivisionId) || '';
    });

    const [lectureBuildingId, setLectureBuildingId] = useState<string>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).lectureBuildingId) || '';
    });
    const [lectureRoomId, setLectureRoomId] = useState<string>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).lectureRoomId) || '';
    });
    const [labBuildingId, setLabBuildingId] = useState<string>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).labBuildingId) || '';
    });
    const [labRoomId, setLabRoomId] = useState<string>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return (saved && JSON.parse(saved).labRoomId) || '';
    });

    useEffect(() => {
        const settings = {
            selectedTermId, selectedSessionId, startTime, labStartTime, theme, daySelectionMode, timeFormat,
            lectureTimeMode, labTimeMode, lectureTimesPerDay, labTimesPerDay,
            lectureSplitMode, labSplitMode, lectureHoursPerDay, labHoursPerDay,
            selectedDivisionId,
            lectureBuildingId, lectureRoomId, labBuildingId, labRoomId
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
    }, [selectedTermId, selectedSessionId, startTime, labStartTime, theme, daySelectionMode, timeFormat, lectureTimeMode, labTimeMode, lectureTimesPerDay, labTimesPerDay, lectureSplitMode, labSplitMode, lectureHoursPerDay, labHoursPerDay, selectedDivisionId, lectureBuildingId, lectureRoomId, labBuildingId, labRoomId]);

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        const term = academicCalendar.find(t => t.id === selectedTermId);
        if (term && !term.sessions.find(s => s.id === selectedSessionId)) {
            setSelectedSessionId(term.sessions[0].id);
        }
    }, [selectedTermId, selectedSessionId]);

    return {
        selectedTermId, setSelectedTermId,
        selectedSessionId, setSelectedSessionId,
        startTime, setStartTime,
        labStartTime, setLabStartTime,
        theme, setTheme,
        daySelectionMode, setDaySelectionMode,
        timeFormat, setTimeFormat,
        lectureTimeMode, setLectureTimeMode,
        labTimeMode, setLabTimeMode,
        lectureTimesPerDay, setLectureTimesPerDay,
        labTimesPerDay, setLabTimesPerDay,
        lectureSplitMode, setLectureSplitMode,
        labSplitMode, setLabSplitMode,
        lectureHoursPerDay, setLectureHoursPerDay,
        labHoursPerDay, setLabHoursPerDay,
        selectedDivisionId, setSelectedDivisionId,
        lectureBuildingId, setLectureBuildingId,
        lectureRoomId, setLectureRoomId,
        labBuildingId, setLabBuildingId,
        labRoomId, setLabRoomId
    };
}
