// src/components/ScheduleDisplay.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeneratedSchedule, ScheduleBlock } from '../types';
import { ScheduleRequest } from './CourseInput';

import { formatTime } from '../utils/timeUtils';
import './ScheduleDisplay.css';

export interface OverlaidSchedule {
    id: string;
    name: string;
    schedule: GeneratedSchedule;
}

export interface BlockMoveEvent {
    type: 'lecture' | 'lab';
    fromDay: string;
    toDay: string;
    newStartTime: string;
    isPerDayMove: boolean;
}

export interface RoomContextSchedule {
    id: string;
    name: string;
    schedule: GeneratedSchedule;
    weekLabel: string;
}

export interface ScheduleDisplayProps {
    schedule: GeneratedSchedule | null;
    request: ScheduleRequest | null;
    overlaidSchedules?: OverlaidSchedule[];
    roomContextSchedules?: RoomContextSchedule[];
    timeFormat: '12h' | '24h';
    resultsHeadingRef: React.RefObject<HTMLHeadingElement | null>;
    isCalculating?: boolean;
    onBlockMove?: (event: BlockMoveEvent) => void;
    lectureDays?: string[];
    labDays?: string[];
}

interface DragState {
    blockType: 'lecture' | 'lab';
    fromDay: string;
    durationMinutes: number;
    ghostDay: string;
    ghostStartMinutes: number;
    offsetY: number;
    isPerDayDrag: boolean;
}

function snapToGrid(minutes: number): number {
    return Math.round(minutes / 5) * 5;
}

function checkOverlap(
    proposedStart: number,
    proposedEnd: number,
    existingBlocks: { startTime: string; endTime: string; type: string }[],
    ignoreType: string
): boolean {
    const BUFFER = 10;
    for (const b of existingBlocks) {
        if (b.type === ignoreType) continue;
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        if (!(proposedEnd + BUFFER <= bStart || bEnd + BUFFER <= proposedStart)) {
            return true;
        }
    }
    return false;
}

const FULL_DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PIXELS_PER_MINUTE = 1.2;
const START_HOUR = 6;
const END_HOUR = 24;

const formatMinutes = (totalMinutes: number) => {
    if (!totalMinutes || totalMinutes === 0) return '0m';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m`;
    return result.trim();
};

const InfoCard: React.FC<{ title: string, info: any, units: number | undefined, color: string, blocks?: ScheduleBlock[] }> = ({ title, info, units, color, blocks }) => {
    const perDayBreakdown = React.useMemo(() => {
        if (!blocks || blocks.length === 0) return null;
        const dayMap = new Map<string, { ch: number, totalMin: number }>();
        for (const b of blocks) {
            const existing = dayMap.get(b.dayOfWeek) || { ch: 0, totalMin: 0 };
            existing.ch += b.instructionalMinutes / 50;
            existing.totalMin += b.durationMinutes;
            dayMap.set(b.dayOfWeek, existing);
        }
        if (dayMap.size <= 1) return null;
        const values = Array.from(dayMap.values());
        const allSame = values.every(v => Math.abs(v.ch - values[0].ch) < 0.05);
        if (allSame) return null;
        return Array.from(dayMap.entries())
            .sort(([a], [b]) => FULL_DAYS_OF_WEEK.indexOf(a) - FULL_DAYS_OF_WEEK.indexOf(b));
    }, [blocks]);

    return (
        <div className="summary-details-card">
            <h4>
                <span className="summary-dot" style={{ backgroundColor: color }}></span>
                <span className="summary-title">{title}</span>
            </h4>
            <div className="summary-details">
                {units !== undefined && units > 0 && <p><strong>Selected Units:</strong> {units}</p>}
                <p><strong>Contact Hours for Course:</strong> {info.contactHoursForTerm.toFixed(2)}</p>
                <p><strong>Actual Meeting Days:</strong> {info.actualMeetingDays}</p>
                {perDayBreakdown ? (
                    perDayBreakdown.map(([day, data]) => (
                        <p key={day}><strong>{day}:</strong> {formatMinutes(data.totalMin)} ({data.ch.toFixed(1)} CH)</p>
                    ))
                ) : (
                    <>
                        <p><strong>Contact Hours Per Day:</strong> {info.contactHoursPerDay.toFixed(1)}</p>
                        <p><strong>Time Block Per Day:</strong> {formatMinutes(info.totalBreakMinutesPerDay + (info.contactHoursPerDay * 50))}</p>
                    </>
                )}
                <p><strong>Total Scheduled Hours:</strong> {info.totalScheduledContactHours.toFixed(2)}</p>
            </div>
        </div>
    );
};

const MinimalSummary: React.FC<{ blocks: ScheduleBlock[], type: 'lecture' | 'lab', timeFormat: '12h' | '24h' }> = ({ blocks, type, timeFormat }) => {
    if (blocks.length === 0) return null;

    const dayGroups = new Map<string, { start: string, end: string }>();
    for (const b of blocks) {
        const existing = dayGroups.get(b.dayOfWeek);
        if (!existing) {
            dayGroups.set(b.dayOfWeek, { start: b.startTime, end: b.endTime });
        } else {
            if (b.startTime < existing.start) existing.start = b.startTime;
            if (b.endTime > existing.end) existing.end = b.endTime;
        }
    }

    const sortedDays = Array.from(dayGroups.entries())
        .sort(([a], [b]) => FULL_DAYS_OF_WEEK.indexOf(a) - FULL_DAYS_OF_WEEK.indexOf(b));

    // Check if all days have the same time range — if so, collapse into one line
    const allSame = sortedDays.length > 1 && sortedDays.every(
        ([, times]) => times.start === sortedDays[0][1].start && times.end === sortedDays[0][1].end
    );

    const label = type.charAt(0).toUpperCase() + type.slice(1);

    if (allSame || sortedDays.length === 1) {
        const days = sortedDays.map(([d]) => d).join('/');
        const { start, end } = sortedDays[0][1];
        return (
            <p className="minimal-summary-item">
                <span className="summary-dot" style={{ backgroundColor: `var(--${type}-color)` }}></span>
                <strong>{label}:</strong> {days} ({formatTime(start, timeFormat)} - {formatTime(end, timeFormat)})
            </p>
        );
    }

    return (
        <>
            {sortedDays.map(([day, times]) => (
                <p key={`${type}-${day}`} className="minimal-summary-item">
                    <span className="summary-dot" style={{ backgroundColor: `var(--${type}-color)` }}></span>
                    <strong>{label}:</strong> {day} ({formatTime(times.start, timeFormat)} - {formatTime(times.end, timeFormat)})
                </p>
            ))}
        </>
    );
};

const ScheduleDisplayEmpty: React.FC = () => (
    <div className="empty-hero-card">
        <div className="hero-icon-well">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="hero-svg"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </div>
        <h2>Ready to schedule?</h2>
        <p>Select a course from the Course Catalog, or configure units and days manually above, to instantly generate your visual timetable.</p>
        <div className="hero-hint">
            <span>Pro Tip: You can save multiple versions to the sidebar for easy comparison.</span>
        </div>
        <div className="hero-hint">
            <span>Need to switch devices? Use the Share Link button in the sidebar to transfer your sections via URL.</span>
        </div>
    </div>
);

const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

const getBlockStyle = (startTime: string, endTime: string, colIndex: number = 0, totalCols: number = 1) => {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);
    const duration = endMins - startMins;
    const top = (startMins - START_HOUR * 60) * PIXELS_PER_MINUTE;
    const height = duration * PIXELS_PER_MINUTE;

    return {
        top: `${top}px`,
        height: `${height}px`,
        left: `${(colIndex / totalCols) * 100}%`,
        width: `${(1 / totalCols) * 100}%`,
        position: 'absolute' as const
    };
};

const DayColumn = React.memo(({
    day,
    hours,
    schedule,
    overlaidSchedules,
    roomContextSchedules,
    hoveredInfo,
    timeFormat,
    isDetailsExpanded,
    handleMouseEnter,
    handleMouseLeave,
    dragState,
    onDragStart
}: any) => {
    const currentBlocks = (schedule?.scheduleBlocks.filter((b: any) => b.dayOfWeek === day) || []).map((b: any) => ({ ...b, id: 'current', sectionName: 'Current', isMain: true, isRoomContext: false }));
    const overlayDayBlocks = (overlaidSchedules || []).flatMap((os: any) =>
        os.schedule.scheduleBlocks
            .filter((b: any) => b.dayOfWeek === day)
            .map((b: any) => ({ ...b, id: os.id, sectionName: os.name, isMain: false, isRoomContext: false }))
    );
    const roomContextDayBlocks = (roomContextSchedules || []).flatMap((rs: any) =>
        rs.schedule.scheduleBlocks
            .filter((b: any) => b.dayOfWeek === day)
            .map((b: any) => ({ ...b, id: `room-${rs.id}`, sectionName: rs.name, weekLabel: rs.weekLabel, isMain: false, isRoomContext: true }))
    );
    const allDayBlocks = [...currentBlocks, ...overlayDayBlocks, ...roomContextDayBlocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    const columns: any[][] = [];
    allDayBlocks.forEach(block => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
            const lastInCol = columns[i][columns[i].length - 1];
            if (timeToMinutes(block.startTime) >= timeToMinutes(lastInCol.endTime)) {
                columns[i].push(block);
                placed = true;
                break;
            }
        }
        if (!placed) columns.push([block]);
    });

    return (
        <div className="day-column timeline">
            <h4 className="weekly-view-header">{day}</h4>
            <div className="day-column-content timeline" style={{ height: `${(END_HOUR - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}>
                {hours.map((h: number) => (
                    <div key={h} className="hour-grid-line" style={{ top: `${(h - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}></div>
                ))}

                <AnimatePresence>
                    {columns.map((col, colIndex) =>
                        col.map((block, i) => {
                            const isRelated = hoveredInfo && hoveredInfo.id === block.id && hoveredInfo.type === block.type;
                            const isDimmed = hoveredInfo && !isRelated;

                            return (
                                <motion.div
                                    key={`${block.id}-${block.startTime}-${block.type}`}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{
                                        opacity: isDimmed ? 0.25 : (block.isMain ? 1 : 0.6),
                                        scale: isRelated ? 1.02 : 1,
                                        zIndex: isRelated ? 30 : 5
                                    }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={`schedule-block ${block.type} ${!block.isMain ? 'overlay' : ''} ${block.isRoomContext ? 'room-context' : ''} timeline-block ${isRelated ? 'related-highlight' : ''} ${block.isMain && onDragStart ? 'draggable' : ''} ${dragState && dragState.blockType === block.type && block.isMain && (dragState.isPerDayDrag ? dragState.fromDay === day : true) ? 'drag-source' : ''}`}
                                    style={getBlockStyle(block.startTime, block.endTime, colIndex, columns.length)}
                                    onMouseEnter={() => !dragState && handleMouseEnter(block, block.id, block.sectionName)}
                                    onMouseLeave={() => !dragState && handleMouseLeave()}
                                    onPointerDown={(e: React.PointerEvent) => {
                                        if (block.isMain && onDragStart) {
                                            e.preventDefault();
                                            const rect = (e.target as HTMLElement).closest('.day-column-content')?.getBoundingClientRect();
                                            if (!rect) return;
                                            const blockTopPx = (timeToMinutes(block.startTime) - START_HOUR * 60) * PIXELS_PER_MINUTE;
                                            const offsetY = e.clientY - rect.top - blockTopPx;
                                            onDragStart(block, day, offsetY, e);
                                        }
                                    }}
                                >
                                    <div className="block-content">
                                        <span className="block-time">
                                            {columns.length === 1
                                                ? `${formatTime(block.startTime, timeFormat)} - ${formatTime(block.endTime, timeFormat)}`
                                                : formatTime(block.startTime, timeFormat)
                                            }
                                        </span>
                                        {columns.length === 1 && !isDetailsExpanded && !isDimmed && (
                                            <span className="block-desc">
                                                {block.isRoomContext ? `${block.sectionName}${block.weekLabel ? ` (${block.weekLabel})` : ''}` : (block.isMain ? '' : block.sectionName)}
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
});


const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({ schedule, request, overlaidSchedules = [], roomContextSchedules = [], timeFormat, resultsHeadingRef, isCalculating, onBlockMove, lectureDays, labDays }) => {
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
    const [hoveredInfo, setHoveredInfo] = useState<{ id: string, type: string, name: string, fullSpan: string, days: string, totalInstr: number, totalBreak: number } | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [showNudge, setShowNudge] = useState(false);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [dragOverlap, setDragOverlap] = useState(false);
    const [showDragTip, setShowDragTip] = useState(false);
    const dragTipShownRef = useRef(false);
    const gridRef = useRef<HTMLDivElement>(null);

    // Trigger nudge only once when a schedule is first displayed
    useEffect(() => {
        if (schedule && !showNudge) {
            const timer = setTimeout(() => setShowNudge(true), 1000);
            const clearTimer = setTimeout(() => setShowNudge(false), 2500);
            return () => {
                clearTimeout(timer);
                clearTimeout(clearTimer);
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schedule]);

    useEffect(() => {
        if (schedule && onBlockMove && !dragTipShownRef.current) {
            dragTipShownRef.current = true;
            const show = setTimeout(() => setShowDragTip(true), 2800);
            const hide = setTimeout(() => setShowDragTip(false), 7000);
            return () => { clearTimeout(show); clearTimeout(hide); };
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schedule, onBlockMove]);

    const allBlocks = React.useMemo(() => {
        return [
            ...(schedule?.scheduleBlocks || []).map((b: any) => ({ ...b, id: 'current', sectionName: 'Current' })),
            ...overlaidSchedules.flatMap(os => os.schedule.scheduleBlocks.map((b: any) => ({ ...b, id: os.id, sectionName: os.name })))
        ];
    }, [schedule, overlaidSchedules]);

    const handleMouseEnterWrapper = React.useCallback((block: any, scheduleId: string, scheduleName: string) => {
        const relatedBlocks = allBlocks.filter((b: any) => b.type === block.type && (b.id === scheduleId || b.sectionName === scheduleName));
        const sameDayBlocks = relatedBlocks.filter((b: any) => b.dayOfWeek === block.dayOfWeek);
        if (sameDayBlocks.length === 0) return;

        const sorted = [...sameDayBlocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        const startTime = sorted[0].startTime;
        const endTime = sorted[sorted.length - 1].endTime;

        const days = Array.from(new Set(relatedBlocks.map((b: any) => b.dayOfWeek)))
            .sort((a: any, b: any) => FULL_DAYS_OF_WEEK.indexOf(a) - FULL_DAYS_OF_WEEK.indexOf(b))
            .join('/');

        const totalInstr = sorted.reduce((sum: number, b: any) => sum + b.instructionalMinutes, 0);
        const totalBreak = sorted.reduce((sum: number, b: any) => sum + b.breakMinutes, 0);

        setHoveredInfo({
            id: scheduleId,
            type: block.type,
            name: scheduleName,
            fullSpan: `${formatTime(startTime, timeFormat)} – ${formatTime(endTime, timeFormat)}`,
            days,
            totalInstr,
            totalBreak
        });
    }, [allBlocks, timeFormat]);

    const handleMouseLeaveWrapper = React.useCallback(() => {
        setHoveredInfo(null);
    }, []);

    const componentDaysFor = useCallback((type: 'lecture' | 'lab') => {
        return type === 'lecture' ? (lectureDays || []) : (labDays || []);
    }, [lectureDays, labDays]);

    const handleDragStart = useCallback((block: any, day: string, offsetY: number, e: React.PointerEvent) => {
        if (!onBlockMove) return;
        setHoveredInfo(null);
        const totalDuration = (schedule?.scheduleBlocks || [])
            .filter((b: ScheduleBlock) => b.dayOfWeek === day && b.type === block.type)
            .reduce((sum: number, b: ScheduleBlock) => sum + b.durationMinutes, 0);

        setDragState({
            blockType: block.type,
            fromDay: day,
            durationMinutes: totalDuration,
            ghostDay: day,
            ghostStartMinutes: timeToMinutes(block.startTime),
            offsetY,
            isPerDayDrag: e.shiftKey
        });
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }, [onBlockMove, schedule]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragState || !gridRef.current) return;
        const columns = gridRef.current.querySelectorAll('.day-column.timeline');
        if (columns.length === 0) return;

        // Determine which day column (only relevant for per-day drag)
        let ghostDay = dragState.ghostDay;
        if (dragState.isPerDayDrag) {
            for (let i = 0; i < columns.length; i++) {
                const colRect = columns[i].getBoundingClientRect();
                if (e.clientX >= colRect.left && e.clientX <= colRect.right) {
                    ghostDay = FULL_DAYS_OF_WEEK[i];
                    break;
                }
            }
        } else {
            ghostDay = dragState.fromDay;
        }

        // Determine start time from Y position
        const contentEl = columns[0].querySelector('.day-column-content');
        if (!contentEl) return;
        const contentRect = contentEl.getBoundingClientRect();
        const relativeY = e.clientY - contentRect.top - dragState.offsetY;
        const rawMinutes = (relativeY / PIXELS_PER_MINUTE) + START_HOUR * 60;
        const snapped = snapToGrid(Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - dragState.durationMinutes, rawMinutes)));

        // Check overlap — for shared drag, check ALL component days
        const daysToCheck = dragState.isPerDayDrag
            ? [ghostDay]
            : componentDaysFor(dragState.blockType);

        let hasOverlap = false;
        for (const day of daysToCheck) {
            const dayBlocks = (schedule?.scheduleBlocks || []).filter(
                (b: ScheduleBlock) => b.dayOfWeek === day
            );
            if (checkOverlap(snapped, snapped + dragState.durationMinutes, dayBlocks, dragState.blockType)) {
                hasOverlap = true;
                break;
            }
        }
        setDragOverlap(hasOverlap);

        setDragState(prev => prev ? { ...prev, ghostDay: ghostDay, ghostStartMinutes: snapped } : null);
    }, [dragState, schedule, componentDaysFor]);

    const handlePointerUp = useCallback(() => {
        if (!dragState || !onBlockMove) {
            setDragState(null);
            return;
        }
        if (dragOverlap) {
            setDragState(null);
            setDragOverlap(false);
            return;
        }

        // Restrict target day to a valid day for this component, or allow replacing a day
        const validDays = componentDaysFor(dragState.blockType);
        const toDay = dragState.ghostDay;

        // Only allow moving to an already-selected day for this component, or replacing the source day
        if (!validDays.includes(toDay) && !validDays.includes(dragState.fromDay)) {
            setDragState(null);
            return;
        }

        const h = Math.floor(dragState.ghostStartMinutes / 60);
        const m = dragState.ghostStartMinutes % 60;
        const newStartTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        onBlockMove({
            type: dragState.blockType,
            fromDay: dragState.fromDay,
            toDay: dragState.isPerDayDrag ? toDay : dragState.fromDay,
            newStartTime,
            isPerDayMove: dragState.isPerDayDrag
        });

        setDragState(null);
        setDragOverlap(false);
    }, [dragState, dragOverlap, onBlockMove, componentDaysFor]);

    if (!schedule && overlaidSchedules.length === 0) {
        return (
            <div className={`schedule-display-container ${isCalculating ? 'is-calculating' : ''}`}>
                <ScheduleDisplayEmpty />
            </div>
        );
    }


    const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

    return (
        <div className={`schedule-display-container ${isCalculating ? 'is-calculating' : ''}`}>
            {schedule && (
                <div className="minimal-summary-container" aria-live="polite">
                    <div className="summary-left">
                        <MinimalSummary blocks={schedule.scheduleBlocks.filter(b => b.type === 'lecture')} type="lecture" timeFormat={timeFormat} />
                        <MinimalSummary blocks={schedule.scheduleBlocks.filter(b => b.type === 'lab')} type="lab" timeFormat={timeFormat} />
                    </div>
                    <div className="summary-right">
                        <span className="schedule-disclaimer">* Generated schedules are estimates</span>
                        <button onClick={() => setIsDetailsExpanded(!isDetailsExpanded)} className="details-toggle-btn">
                            {isDetailsExpanded ? 'Hide Details' : 'Show Details'}
                        </button>
                    </div>
                </div>
            )}

            <div className={`details-container ${isDetailsExpanded ? 'expanded' : ''}`}>
                {schedule && (
                    <div className="summary-card">
                        {schedule.lectureInfo.contactHoursForTerm > 0 && <InfoCard title="Lecture Summary" info={schedule.lectureInfo} units={request?.fixedHours ? undefined : request?.lectureUnits} color="var(--lecture-color)" blocks={schedule.scheduleBlocks.filter(b => b.type === 'lecture')} />}
                        {schedule.labInfo.contactHoursForTerm > 0 && <InfoCard title="Lab Summary" info={schedule.labInfo} units={request?.fixedHours ? undefined : request?.labUnits} color="var(--lab-color)" blocks={schedule.scheduleBlocks.filter(b => b.type === 'lab')} />}
                    </div>
                )}
            </div>

            <div
                className={`timeline-wrapper ${hoveredInfo ? 'has-hover' : ''} ${showNudge ? 'nudge-hint' : ''} ${dragState ? 'is-dragging' : ''}`}
                onMouseMove={(e) => { if (!dragState) setMousePos({ x: e.clientX, y: e.clientY }); }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <div className="time-ruler">
                    {hours.map(h => (
                        <div key={h} className="time-label" style={{ height: `${60 * PIXELS_PER_MINUTE}px` }}>
                            {formatTime(`${h}:00`, timeFormat)}
                        </div>
                    ))}
                </div>

                <div className="weekly-grid timeline" ref={gridRef}>
                    {FULL_DAYS_OF_WEEK.map(day => (
                        <DayColumn
                            key={day}
                            day={day}
                            hours={hours}
                            schedule={schedule}
                            overlaidSchedules={overlaidSchedules}
                            roomContextSchedules={roomContextSchedules}
                            hoveredInfo={hoveredInfo}
                            timeFormat={timeFormat}
                            isDetailsExpanded={isDetailsExpanded}
                            handleMouseEnter={handleMouseEnterWrapper}
                            handleMouseLeave={handleMouseLeaveWrapper}
                            dragState={dragState}
                            onDragStart={onBlockMove ? handleDragStart : undefined}
                        />
                    ))}

                    {dragState && gridRef.current && (() => {
                        const ghostTop = (dragState.ghostStartMinutes - START_HOUR * 60) * PIXELS_PER_MINUTE;
                        const ghostHeight = dragState.durationMinutes * PIXELS_PER_MINUTE;
                        const h = Math.floor(dragState.ghostStartMinutes / 60);
                        const m = dragState.ghostStartMinutes % 60;
                        const endMin = dragState.ghostStartMinutes + dragState.durationMinutes;
                        const eh = Math.floor(endMin / 60);
                        const em = endMin % 60;
                        const startStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        const endStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
                        const timeLabel = `${formatTime(startStr, timeFormat)} - ${formatTime(endStr, timeFormat)}`;

                        const gridRect = gridRef.current!.getBoundingClientRect();
                        const allCols = gridRef.current!.querySelectorAll('.day-column.timeline');

                        const ghostDays = dragState.isPerDayDrag
                            ? [dragState.ghostDay]
                            : componentDaysFor(dragState.blockType);

                        return ghostDays.map(day => {
                            const dayIndex = FULL_DAYS_OF_WEEK.indexOf(day);
                            const colEl = allCols[dayIndex];
                            const colRect = colEl?.getBoundingClientRect();
                            const ghostLeft = colRect ? colRect.left - gridRect.left : 0;
                            const ghostWidth = colRect ? colRect.width : 0;
                            const isPrimary = dragState.isPerDayDrag || day === dragState.fromDay;

                            return (
                                <div
                                    key={`ghost-${day}`}
                                    className={`drag-ghost ${dragState.blockType} ${dragOverlap ? 'overlap' : ''}`}
                                    style={{
                                        position: 'absolute',
                                        top: `${ghostTop + 65}px`,
                                        height: `${ghostHeight}px`,
                                        left: `${ghostLeft + 2}px`,
                                        width: `${ghostWidth - 4}px`,
                                        pointerEvents: 'none',
                                        zIndex: 50,
                                        opacity: isPrimary ? undefined : 0.6,
                                    }}
                                >
                                    <span className="ghost-time">{isPrimary ? timeLabel : formatTime(startStr, timeFormat)}</span>
                                </div>
                            );
                        });
                    })()}
                </div>

                <AnimatePresence>
                    {showDragTip && !dragState && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="drag-tip"
                        >
                            Tip: Drag blocks to move all days together. Hold Shift to move one day only.
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {hoveredInfo && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="timeline-popover"
                            style={{
                                position: 'fixed',
                                top: `${mousePos.y + 20}px`,
                                left: `${mousePos.x + 20}px`,
                                pointerEvents: 'none',
                                zIndex: 1000
                            }}
                        >
                            <div className="popover-inner">
                                <span className={`summary-dot ${hoveredInfo.type}`} style={{ backgroundColor: `var(--${hoveredInfo.type}-color)` }}></span>
                                <div className="popover-content">
                                    <div className="popover-title">{hoveredInfo.name}</div>
                                    <div className="popover-time">
                                        {hoveredInfo.fullSpan} ({hoveredInfo.days})
                                    </div>
                                    <div className="popover-meta">
                                        {hoveredInfo.type.toUpperCase()} • {hoveredInfo.totalInstr}m instr • {hoveredInfo.totalBreak}m break
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default React.memo(ScheduleDisplay);
