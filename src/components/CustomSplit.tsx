import React from 'react';
import { TimeSelector } from './Settings';
import { contactHoursFromClockMinutes, parseTimeToMinutes, endTimeForContactHours, calculateTimeMetrics } from '../utils/scheduleGenerator';
import { SplitMode } from '../types/section';
import './CustomSplit.css';

function chDiffToPlainText(diffCH: number): string {
    const { totalClockMinutes: diffMinutes } = calculateTimeMetrics(Math.abs(diffCH));
    const absDiff = Math.abs(diffMinutes);
    const hours = Math.floor(absDiff / 60);
    const mins = absDiff % 60;
    const timeStr = hours > 0
        ? (mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`)
        : `${mins} min`;

    if (diffCH > 0) return `Reduce total meeting time by ~${timeStr}`;
    return `Increase total meeting time by ~${timeStr}`;
}

interface CustomSplitProps {
    label: string;
    days: string[];
    splitMode: SplitMode;
    setSplitMode: (v: SplitMode) => void;
    hoursPerDay: Record<string, number>;
    setHoursPerDay: (v: Record<string, number>) => void;
    startTimeForDay: (day: string) => string;
    weeklyRequiredCH: number;
    timeFormat: '12h' | '24h';
}

const CustomSplit: React.FC<CustomSplitProps> = ({
    label, days, splitMode, setSplitMode, hoursPerDay, setHoursPerDay,
    startTimeForDay, weeklyRequiredCH, timeFormat
}) => {
    const numDays = days.length;
    const evenPerDay = numDays > 0 ? Math.round((weeklyRequiredCH / numDays) * 10) / 10 : 0;
    const splitPossible = numDays >= 2 && weeklyRequiredCH >= numDays * 1.0 - 0.001;

    const prefillEven = (): Record<string, number> => {
        const m: Record<string, number> = {};
        for (const d of days) m[d] = evenPerDay;
        return m;
    };

    const handleToggle = () => {
        if (splitMode === 'even') {
            setHoursPerDay(prefillEven());
            setSplitMode('custom');
        } else {
            setSplitMode('even');
        }
    };

    const handleEndChange = (day: string, newEnd: string) => {
        const start = parseTimeToMinutes(startTimeForDay(day));
        const end = parseTimeToMinutes(newEnd);
        const duration = end - start;
        if (duration < 50) {
            setHoursPerDay({ ...hoursPerDay, [day]: 0 });
            return;
        }
        const ch = contactHoursFromClockMinutes(duration);
        if (ch !== null) {
            setHoursPerDay({ ...hoursPerDay, [day]: ch });
        }
    };

    const handleReset = () => setHoursPerDay(prefillEven());

    if (!splitPossible) {
        return (
            <div className="custom-split-wrapper">
                <button className="cs-toggle" disabled title="Not enough contact hours to split across the selected days.">
                    Custom Split (unavailable)
                </button>
                <span className="cs-unavailable-hint">Too many days selected for the units</span>
            </div>
        );
    }

    if (splitMode === 'even') {
        return (
            <div className="custom-split-wrapper">
                <button className="cs-toggle" onClick={handleToggle}>
                    Custom Split
                </button>
            </div>
        );
    }

    const sumCH = days.reduce((acc, d) => acc + (hoursPerDay[d] ?? 0), 0);
    const diffCH = Math.round((sumCH - weeklyRequiredCH) * 10) / 10;
    const totalValid = Math.abs(diffCH) <= 0.05;

    return (
        <div className="custom-split-wrapper active">
            <div className="cs-header">
                <span className="cs-title">{label} — Custom Split</span>
                <div className="cs-header-actions">
                    <button className="cs-reset" onClick={handleReset} type="button">Reset</button>
                    <button className="cs-toggle on" onClick={handleToggle} type="button">On</button>
                </div>
            </div>
            <div className="cs-rows">
                {days.map(day => {
                    const start = startTimeForDay(day);
                    const ch = hoursPerDay[day] ?? 0;
                    const endTime = ch > 0 ? endTimeForContactHours(start, ch) : start;
                    const rowInvalid = ch < 1.0;
                    return (
                        <div key={day} className={`cs-row ${rowInvalid ? 'invalid' : ''}`}>
                            <span className="cs-day">{day}</span>
                            <span className="cs-start">{start}</span>
                            <span className="cs-arrow">→</span>
                            <TimeSelector
                                time={endTime}
                                onTimeChange={(v) => handleEndChange(day, v)}
                                timeFormat={timeFormat}
                            />
                            <span className="cs-ch-badge">{ch.toFixed(1)} CH</span>
                        </div>
                    );
                })}
            </div>
            <div className={`cs-footer ${totalValid ? 'valid' : 'invalid'}`}>
                <div>Total: {sumCH.toFixed(1)} / {weeklyRequiredCH.toFixed(1)} CH/week {totalValid ? '✓' : '✗'}</div>
                {!totalValid && (
                    <div className="cs-footer-hint">{chDiffToPlainText(diffCH)}</div>
                )}
            </div>
        </div>
    );
};

export default CustomSplit;
