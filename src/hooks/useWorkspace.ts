import { useState, useCallback } from 'react';
import { ScheduleRequest } from '../components/CourseInput';
import { GeneratedSchedule } from '../types';
import { Course, fixedHoursOf } from './useCatalog';
import { FixedHours } from '../types/section';


export function useWorkspace() {
    const [lectureUnits, setLectureUnits] = useState(0);
    const [lectureDays, setLectureDays] = useState<string[]>([]);
    const [lecTbaHours, setLecTbaHours] = useState(0);

    const [labUnits, setLabUnits] = useState(0);
    const [labDays, setLabDays] = useState<string[]>([]);
    const [labTbaHours, setLabTbaHours] = useState(0);

    const [isLecFixed, setIsLecFixed] = useState(false);
    const [isLabFixed, setIsLabFixed] = useState(false);

    const [lecRange, setLecRange] = useState({ min: 0, max: 10 });
    const [labRange, setLabRange] = useState({ min: 0, max: 10 });

    const [generatedSchedule, setGeneratedSchedule] = useState<GeneratedSchedule | null>(null);
    const [lastRequest, setLastRequest] = useState<ScheduleRequest | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    const [selectedCourseInfo, setSelectedCourseInfo] = useState<{ sub: string, no: string, title?: string } | null>(null);

    // Set when the selected course is listed in hours (fixed-hours course); units then hold the hour equivalents
    const [fixedHours, setFixedHours] = useState<FixedHours | undefined>(undefined);

    const [smartSplit, setSmartSplit] = useState(false);
    const [smartSplitDays, setSmartSplitDays] = useState<string[]>([]);

    const handleCourseSelect = useCallback((sub: string, course: Course) => {
        setSelectedCourseInfo({ sub, no: course.no, title: course.title });

        // Auto-populate units (handle fixed number or {min, max} object)
        const lecVal = course.lec;
        const labVal = course.lab;

        const fixed = fixedHoursOf(course);
        setFixedHours(fixed);
        if (fixed) {
            // Hour equivalents keep "has lecture/lab" checks working; the math uses fixedHours
            const lecEq = Math.round(fixed.lec / 18 * 10000) / 10000;
            const labEq = Math.round(fixed.lab / 54 * 10000) / 10000;
            setIsLecFixed(true);
            setIsLabFixed(true);
            setLecRange({ min: lecEq, max: lecEq });
            setLabRange({ min: labEq, max: labEq });
            setLectureUnits(lecEq);
            setLabUnits(labEq);
            setSmartSplit(false);
            setSmartSplitDays([]);
            return;
        }

        const newLecUnits = typeof lecVal === 'number' ? lecVal : lecVal.min;
        const newLabUnits = typeof labVal === 'number' ? labVal : labVal.min;

        // Determine locks: Locked if it's a fixed number, Unlocked if it's a range object
        setIsLecFixed(typeof lecVal === 'number');
        setIsLabFixed(typeof labVal === 'number');

        // Set Ranges
        setLecRange(typeof lecVal === 'number' ? { min: lecVal, max: lecVal } : { min: lecVal.min, max: lecVal.max });
        setLabRange(typeof labVal === 'number' ? { min: labVal, max: labVal } : { min: labVal.min, max: labVal.max });

        setLectureUnits(newLecUnits);
        setLabUnits(newLabUnits);
    }, []);

    const clearCourseSelection = useCallback(() => {
        setSelectedCourseInfo(null);
        setFixedHours(undefined);
        setIsLecFixed(false);
        setIsLabFixed(false);
        setLecRange({ min: 0, max: 10 });
        setLabRange({ min: 0, max: 10 });
        setLectureUnits(0);
        setLabUnits(0);
        setLecTbaHours(0);
        setLabTbaHours(0);
        setSmartSplit(false);
        setSmartSplitDays([]);
    }, []);

    const getWorkspaceAsSection = useCallback((id: string, name: string, settings: any) => {
        const usesV2 = settings.lectureTimeMode === 'perDay' || settings.labTimeMode === 'perDay' || settings.lectureSplitMode === 'custom' || settings.labSplitMode === 'custom' || !!settings.lectureRoomId || !!settings.labRoomId;
        return {
            id,
            name,
            lectureUnits, lectureDays, lecTbaHours,
            labUnits, labDays, labTbaHours,
            startTime: settings.startTime,
            labStartTime: settings.labStartTime,
            selectedTermId: settings.selectedTermId,
            selectedSessionId: settings.selectedSessionId,
            timestamp: Date.now(),
            ...(fixedHours ? { fixedHours } : {}),
            ...(usesV2 ? {
                schemaVersion: 2 as const,
                lectureTimeMode: settings.lectureTimeMode,
                labTimeMode: settings.labTimeMode,
                lectureTimesPerDay: settings.lectureTimesPerDay,
                labTimesPerDay: settings.labTimesPerDay,
                lectureSplitMode: settings.lectureSplitMode,
                labSplitMode: settings.labSplitMode,
                lectureHoursPerDay: settings.lectureHoursPerDay,
                labHoursPerDay: settings.labHoursPerDay,
                lectureBuildingId: settings.lectureBuildingId,
                lectureRoomId: settings.lectureRoomId,
                labBuildingId: settings.labBuildingId,
                labRoomId: settings.labRoomId,
            } : {})
        };
    }, [lectureUnits, lectureDays, lecTbaHours, labUnits, labDays, labTbaHours, fixedHours]);

    return {
        lectureUnits, setLectureUnits,
        lectureDays, setLectureDays,
        labUnits, setLabUnits,
        labDays, setLabDays,
        isLecFixed, setIsLecFixed,
        isLabFixed, setIsLabFixed,
        lecRange, setLecRange,
        labRange, setLabRange,
        lecTbaHours, setLecTbaHours,
        labTbaHours, setLabTbaHours,
        generatedSchedule, setGeneratedSchedule,
        lastRequest, setLastRequest,
        isCalculating, setIsCalculating,
        selectedCourseInfo, setSelectedCourseInfo,
        fixedHours, setFixedHours,
        smartSplit, setSmartSplit,
        smartSplitDays, setSmartSplitDays,
        handleCourseSelect, clearCourseSelection,
        getWorkspaceAsSection
    };
}
