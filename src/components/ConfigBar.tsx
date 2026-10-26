// src/components/ConfigBar.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Lock, Unlock, CalendarDays, Clock, ChevronUp } from 'lucide-react';
import { TimeMode, SplitMode, FixedHours } from '../types/section';
import { Building } from '../types/rooms';
import CustomSplit from './CustomSplit';
import RoomSelector from './RoomSelector';
import { TimeSelector } from './Settings';
import CoursePicker from './CoursePicker';
import CourseInput from './CourseInput';
import { formatTime } from '../utils/timeUtils';
import { AcademicTerm, TermSession } from '../types/calendar';
import { CatalogHierarchy, Course } from '../hooks/useCatalog';
import './ConfigBar.css';

interface ConfigBarProps {
    isConfigExpanded: boolean;
    setIsConfigExpanded: (v: boolean) => void;
    selectedTerm: AcademicTerm;
    selectedSession: TermSession;
    selectedTermId: string;
    setSelectedTermId: (v: string) => void;
    selectedSessionId: string;
    setSelectedSessionId: (v: string) => void;
    calendar: AcademicTerm[];
    startTime: string;
    setStartTime: (v: string) => void;
    labStartTime: string | null;
    setLabStartTime: (v: string | null) => void;
    handleLabLockToggle: () => void;
    timeFormat: '12h' | '24h';
    catalog: CatalogHierarchy;
    divisions: Record<string, string>;
    departments: Record<string, string>;
    handleCourseSelect: (sub: string, course: Course) => void;
    onClearCourse: () => void;
    selectedCourseInfo: { sub: string, no: string, title?: string } | null;
    lectureUnits: number;
    setLectureUnits: (v: number) => void;
    lectureDays: string[];
    setLectureDays: (v: string[]) => void;
    lecTbaHours: number;
    fixedHours?: FixedHours;
    setLecTbaHours: (v: number) => void;
    labUnits: number;
    setLabUnits: (v: number) => void;
    labDays: string[];
    setLabDays: (v: string[]) => void;
    labTbaHours: number;
    setLabTbaHours: (v: number) => void;
    isLecFixed: boolean;
    isLabFixed: boolean;
    lecRange: { min: number; max: number };
    labRange: { min: number; max: number };
    lectureTimeMode: TimeMode;
    setLectureTimeMode: (v: TimeMode) => void;
    labTimeMode: TimeMode;
    setLabTimeMode: (v: TimeMode) => void;
    lectureTimesPerDay: Record<string, string>;
    setLectureTimesPerDay: (v: Record<string, string>) => void;
    labTimesPerDay: Record<string, string>;
    setLabTimesPerDay: (v: Record<string, string>) => void;
    lectureSplitMode: SplitMode;
    setLectureSplitMode: (v: SplitMode) => void;
    labSplitMode: SplitMode;
    setLabSplitMode: (v: SplitMode) => void;
    lectureHoursPerDay: Record<string, number>;
    setLectureHoursPerDay: (v: Record<string, number>) => void;
    labHoursPerDay: Record<string, number>;
    setLabHoursPerDay: (v: Record<string, number>) => void;
    // Smart Split
    smartSplit: boolean;
    setSmartSplit: (v: boolean) => void;
    smartSplitDays: string[];
    setSmartSplitDays: (v: string[]) => void;
    canSmartSplit: boolean;
    onSmartSplitToggle: (enabled: boolean) => void;
    // Room assignment
    buildings: Building[];
    hasDivision: boolean;
    lectureBuildingId: string;
    setLectureBuildingId: (v: string) => void;
    lectureRoomId: string;
    setLectureRoomId: (v: string) => void;
    labBuildingId: string;
    setLabBuildingId: (v: string) => void;
    labRoomId: string;
    setLabRoomId: (v: string) => void;
    lectureRoomLabel?: string;
    labRoomLabel?: string;
}

const ConfigBar: React.FC<ConfigBarProps> = ({
    isConfigExpanded, setIsConfigExpanded,
    selectedTerm, selectedSession,
    selectedTermId, setSelectedTermId,
    selectedSessionId, setSelectedSessionId,
    calendar,
    startTime, setStartTime,
    labStartTime, setLabStartTime,
    handleLabLockToggle,
    timeFormat,
    catalog, divisions, departments,
    handleCourseSelect, onClearCourse,
    selectedCourseInfo,
    lectureUnits, setLectureUnits,
    lectureDays, setLectureDays,
    lecTbaHours, setLecTbaHours,
    fixedHours,
    labUnits, setLabUnits,
    labDays, setLabDays,
    labTbaHours, setLabTbaHours,
    isLecFixed, isLabFixed,
    lecRange, labRange,
    lectureTimeMode, setLectureTimeMode,
    labTimeMode, setLabTimeMode,
    lectureTimesPerDay, setLectureTimesPerDay,
    labTimesPerDay, setLabTimesPerDay,
    lectureSplitMode, setLectureSplitMode,
    labSplitMode, setLabSplitMode,
    lectureHoursPerDay, setLectureHoursPerDay,
    labHoursPerDay, setLabHoursPerDay,
    smartSplit, setSmartSplit, smartSplitDays, setSmartSplitDays,
    canSmartSplit, onSmartSplitToggle,
    buildings, hasDivision,
    lectureBuildingId, setLectureBuildingId,
    lectureRoomId, setLectureRoomId,
    labBuildingId, setLabBuildingId,
    labRoomId, setLabRoomId,
    lectureRoomLabel, labRoomLabel
}) => {
    const weeks = selectedSession.weeks || 1;
    // Fixed-hours courses meet once, so the whole total is due on the one day
    const lecWeeklyCH = fixedHours ? fixedHours.lec : Math.max(0, (lectureUnits * 18 - (lecTbaHours || 0))) / weeks;
    const labWeeklyCH = fixedHours ? fixedHours.lab : Math.max(0, (labUnits * 54 - (labTbaHours || 0))) / weeks;
    const lecStartForDay = (day: string) => lectureTimeMode === 'perDay' ? (lectureTimesPerDay[day] ?? startTime) : startTime;
    const labEffectiveStart = labStartTime ?? startTime;
    const labStartForDay = (day: string) => labTimeMode === 'perDay' ? (labTimesPerDay[day] ?? labEffectiveStart) : labEffectiveStart;
    const toggleLectureTimeMode = () => {
        if (lectureTimeMode === 'shared') {
            // Pre-fill per-day map with shared start time for every selected day
            const next: Record<string, string> = { ...lectureTimesPerDay };
            for (const d of lectureDays) if (next[d] === undefined) next[d] = startTime;
            setLectureTimesPerDay(next);
            setLectureTimeMode('perDay');
        } else {
            setLectureTimeMode('shared');
        }
    };
    const toggleLabTimeMode = () => {
        const labBaseTime = labStartTime ?? startTime;
        if (labTimeMode === 'shared') {
            const next: Record<string, string> = { ...labTimesPerDay };
            for (const d of labDays) if (next[d] === undefined) next[d] = labBaseTime;
            setLabTimesPerDay(next);
            setLabTimeMode('perDay');
        } else {
            setLabTimeMode('shared');
        }
    };
    const setLectureDayTime = (day: string, value: string) => {
        setLectureTimesPerDay({ ...lectureTimesPerDay, [day]: value });
    };
    const setLabDayTime = (day: string, value: string) => {
        setLabTimesPerDay({ ...labTimesPerDay, [day]: value });
    };
    return (
        <div className={`config-bar ${isConfigExpanded ? 'expanded' : 'collapsed'}`}>
            <AnimatePresence mode="wait">
                {!isConfigExpanded ? (
                    <motion.div
                        key="summary"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="config-summary-row"
                        onClick={() => setIsConfigExpanded(true)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isConfigExpanded}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setIsConfigExpanded(true);
                            }
                        }}
                    >
                        <div className="summary-sentence">
                            Scheduling <strong>{selectedTerm.name}</strong> ({selectedSession.name})
                            starting at <strong>{formatTime(startTime, timeFormat)}</strong>
                            {labStartTime && <> (Labs at <strong>{formatTime(labStartTime, timeFormat)}</strong>)</>}
                            • <strong>{lectureUnits}u</strong> Lec / <strong>{labUnits}u</strong> Lab
                            {/* ROOMS: hidden until feature ships
                            {lectureRoomLabel && <> • {lectureRoomLabel}</>}
                            {labRoomLabel && labRoomLabel !== lectureRoomLabel && <> • Lab: {labRoomLabel}</>}
                            */}
                        </div>
                        <div className="edit-pill">
                            <Edit2 size={12} /> Edit Configuration
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="edit"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="config-edit-container"
                    >
                        {/* Mode Toggle */}
                        <div className="config-mode-toggle">
                            <button
                                className={`mode-btn ${!smartSplit ? 'active' : ''}`}
                                onClick={() => { if (smartSplit) onSmartSplitToggle(false); }}
                            >
                                Manual
                            </button>
                            <button
                                className={`mode-btn ${smartSplit ? 'active' : ''}`}
                                onClick={() => { if (!smartSplit) onSmartSplitToggle(true); }}
                                disabled={!canSmartSplit}
                                title={!canSmartSplit ? 'Smart Split requires both lecture and lab units' : 'Automatically distribute lecture and lab across selected days'}
                            >
                                Smart Split
                            </button>
                        </div>

                        {/* Row 1: Session, Times, Catalog */}
                        <div className="config-edit-row">
                            <div className="config-section">
                                <label className="config-label">Academic Session</label>
                                <div className="config-controls">
                                    <div className="time-sub-group">
                                        <span className="micro-label">Term</span>
                                        <select value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)}>
                                            {calendar.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="time-sub-group">
                                        <span className="micro-label">Weeks</span>
                                        <select value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)}>
                                            {selectedTerm.sessions.map(session => <option key={session.id} value={session.id}>{session.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="config-divider" />

                            <div className="config-section">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '10px', gap: '8px' }}>
                                    <label className="config-label" style={{ lineHeight: 1 }}>Start Time{!smartSplit && 's'}</label>
                                    {!smartSplit && (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                onClick={toggleLectureTimeMode}
                                                className="icon-btn-xs"
                                                style={{ padding: 0 }}
                                                title={lectureTimeMode === 'shared' ? 'Use per-day start times for Lecture' : 'Use one shared start time for Lecture'}
                                                disabled={lectureDays.length === 0}
                                            >
                                                {lectureTimeMode === 'shared' ? <Clock size={10} /> : <CalendarDays size={10} />}
                                            </button>
                                            <button onClick={handleLabLockToggle} className="icon-btn-xs" style={{ padding: 0 }} title="Toggle separate lab time">
                                                {labStartTime === null ? <Lock size={10} /> : <Unlock size={10} />}
                                            </button>
                                            {labStartTime !== null && (
                                                <button
                                                    onClick={toggleLabTimeMode}
                                                    className="icon-btn-xs"
                                                    style={{ padding: 0 }}
                                                    title={labTimeMode === 'shared' ? 'Use per-day start times for Lab' : 'Use one shared start time for Lab'}
                                                    disabled={labDays.length === 0}
                                                >
                                                    {labTimeMode === 'shared' ? <Clock size={10} /> : <CalendarDays size={10} />}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="config-controls">
                                    {smartSplit ? (
                                        <div className="time-sub-group">
                                            <span className="micro-label">&nbsp;</span>
                                            <TimeSelector time={startTime} onTimeChange={setStartTime} timeFormat={timeFormat} />
                                        </div>
                                    ) : (
                                        <>
                                            {lectureTimeMode === 'shared' || lectureDays.length === 0 ? (
                                                <div className="time-sub-group">
                                                    <span className="micro-label">{labStartTime === null ? <>&nbsp;</> : 'Lec'}</span>
                                                    <TimeSelector time={startTime} onTimeChange={setStartTime} timeFormat={timeFormat} />
                                                </div>
                                            ) : (
                                                lectureDays.map(day => (
                                                    <div key={`lec-${day}`} className="time-sub-group">
                                                        <span className="micro-label">Lec {day}</span>
                                                        <TimeSelector
                                                            time={lectureTimesPerDay[day] ?? startTime}
                                                            onTimeChange={(v) => setLectureDayTime(day, v)}
                                                            timeFormat={timeFormat}
                                                        />
                                                    </div>
                                                ))
                                            )}
                                            {labStartTime !== null && (
                                                labTimeMode === 'shared' || labDays.length === 0 ? (
                                                    <div className="time-sub-group">
                                                        <span className="micro-label">Lab</span>
                                                        <TimeSelector time={labStartTime} onTimeChange={setLabStartTime} timeFormat={timeFormat} />
                                                    </div>
                                                ) : (
                                                    labDays.map(day => (
                                                        <div key={`lab-${day}`} className="time-sub-group">
                                                            <span className="micro-label">Lab {day}</span>
                                                            <TimeSelector
                                                                time={labTimesPerDay[day] ?? labStartTime}
                                                                onTimeChange={(v) => setLabDayTime(day, v)}
                                                                timeFormat={timeFormat}
                                                            />
                                                        </div>
                                                    ))
                                                )
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="config-divider" />

                            <div className="config-section">
                                <label className="config-label">Course Catalog</label>
                                <div className="config-controls">
                                    <div className="time-sub-group">
                                        <span className="micro-label">&nbsp;</span>
                                        <CoursePicker
                                            catalog={catalog}
                                            divisions={divisions}
                                            departments={departments}
                                            selectedCourse={selectedCourseInfo}
                                            onSelect={handleCourseSelect}
                                            onClear={onClearCourse}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ROOMS: hidden until feature ships
                            <div className="config-divider" />

                            <RoomSelector
                                buildings={buildings}
                                hasDivision={hasDivision}
                                lectureBuildingId={lectureBuildingId}
                                setLectureBuildingId={setLectureBuildingId}
                                lectureRoomId={lectureRoomId}
                                setLectureRoomId={setLectureRoomId}
                                labBuildingId={labBuildingId}
                                setLabBuildingId={setLabBuildingId}
                                labRoomId={labRoomId}
                                setLabRoomId={setLabRoomId}
                                lectureUnits={lectureUnits}
                                labUnits={labUnits}
                            />
                            */}
                        </div>

                        {/* Row 2: Course Input (Units/Days) */}
                        <div className="config-edit-row secondary-row">
                            <CourseInput
                                lectureUnits={lectureUnits}
                                setLectureUnits={setLectureUnits}
                                lectureDays={lectureDays}
                                setLectureDays={setLectureDays}
                                lecTbaHours={lecTbaHours}
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
                                fixedHours={fixedHours}
                                smartSplit={smartSplit}
                                smartSplitDays={smartSplitDays}
                                setSmartSplitDays={setSmartSplitDays}
                            />

                            <button className="icon-btn-collapse" onClick={() => setIsConfigExpanded(false)} title="Collapse configuration" aria-label="Collapse configuration">
                                <ChevronUp size={18} />
                            </button>
                        </div>

                        {!smartSplit && ((lectureUnits > 0 && lectureDays.length >= 2) || (labUnits > 0 && labDays.length >= 2)) ? (
                            <div className="config-edit-row tertiary-row">
                                {lectureUnits > 0 && lectureDays.length >= 2 && (
                                    <CustomSplit
                                        label="Lecture"
                                        days={lectureDays}
                                        splitMode={lectureSplitMode}
                                        setSplitMode={setLectureSplitMode}
                                        hoursPerDay={lectureHoursPerDay}
                                        setHoursPerDay={setLectureHoursPerDay}
                                        startTimeForDay={lecStartForDay}
                                        weeklyRequiredCH={lecWeeklyCH}
                                        timeFormat={timeFormat}
                                    />
                                )}
                                {labUnits > 0 && labDays.length >= 2 && (
                                    <CustomSplit
                                        label="Lab"
                                        days={labDays}
                                        splitMode={labSplitMode}
                                        setSplitMode={setLabSplitMode}
                                        hoursPerDay={labHoursPerDay}
                                        setHoursPerDay={setLabHoursPerDay}
                                        startTimeForDay={labStartForDay}
                                        weeklyRequiredCH={labWeeklyCH}
                                        timeFormat={timeFormat}
                                    />
                                )}
                            </div>
                        ) : null}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ConfigBar;
