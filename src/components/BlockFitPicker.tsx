// src/components/BlockFitPicker.tsx
// Block Fit mode: pick a window from the block schedule; each choice shows whether the course fits.

import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { computeBlockFit, BlockFitResult } from '../utils/blockFit';
import {
    BlockScheduleSheet, BlockOption, BlockDaysCode,
    blockOptionsFor, familiesIn, familyFor, weeklyHoursOf, daysLabel
} from '../utils/blockSchedule';
import { formatTime } from '../utils/timeUtils';
import { TermSession } from '../types/calendar';
import './BlockFitPicker.css';

interface BlockFitPickerProps {
    sheet: BlockScheduleSheet | null;
    session: TermSession;
    lectureUnits: number;
    labUnits: number;
    meetingsByDay: Record<string, number> | null;
    fullSemester: boolean;
    selection: BlockOption | null;
    onSelect: (option: BlockOption) => void;
    result: BlockFitResult | { error: string } | null;
    timeFormat: '12h' | '24h';
}

const DAYS_TITLES: Record<BlockDaysCode, string> = {
    'SGL': 'Single day',
    'MW|TR': 'MW or TR',
    'MWF|TRF': 'MWF or TRF',
    'MTWR': 'MTWR',
    'MTWRF': 'MTWRF',
};

const range = (start: string, end: string, fmt: '12h' | '24h') => `${formatTime(start, fmt)}–${formatTime(end, fmt)}`;

const BlockFitPicker: React.FC<BlockFitPickerProps> = ({
    sheet, session, lectureUnits, labUnits, meetingsByDay, fullSemester, selection, onSelect, result, timeFormat
}) => {
    const weekly = weeklyHoursOf(lectureUnits, labUnits);
    const courseFamily = familyFor(lectureUnits, labUnits);
    const families = sheet ? familiesIn(sheet) : [];
    const [family, setFamily] = useState<number | null>(null);

    // Follow the course's family until the user picks another one; a new course resets it
    useEffect(() => { setFamily(null); }, [courseFamily]);
    const shownFamily = family ?? selection?.weeklyHours ?? (families.includes(courseFamily) ? courseFamily : null);

    const groups = useMemo(() => {
        if (!sheet || shownFamily === null || !meetingsByDay || (lectureUnits <= 0 && labUnits <= 0)) return [];
        const options = blockOptionsFor(sheet, shownFamily, lectureUnits > 0 && labUnits > 0);
        const byCode = new Map<BlockDaysCode, Map<string, { option: BlockOption; fit: ReturnType<typeof computeBlockFit> }[]>>();
        for (const option of options) {
            const rows = byCode.get(option.daysCode) ?? new Map();
            const key = `${option.start}-${option.end}`;
            const row = rows.get(key) ?? [];
            row.push({ option, fit: computeBlockFit(lectureUnits, labUnits, option.days, option.start, option.end, meetingsByDay, fullSemester) });
            rows.set(key, row);
            byCode.set(option.daysCode, rows);
        }
        return Array.from(byCode.entries()).map(([code, rows]) => ({ code, rows: Array.from(rows.values()) }));
    }, [sheet, shownFamily, meetingsByDay, fullSemester, lectureUnits, labUnits]);

    if (!sheet) {
        return (
            <div className="block-fit-picker">
                <p className="bf-note">
                    There's no block schedule for <strong>{session.name}</strong>. Block schedules cover full-term, 12-week
                    and 8-week fall/spring sessions, the 8- and 6-week summer sessions, and winter intersession.
                </p>
            </div>
        );
    }
    if (lectureUnits <= 0 && labUnits <= 0) {
        return <div className="block-fit-picker"><p className="bf-note">Pick a course or enter units to see the blocks it fits.</p></div>;
    }

    const isSelected = (o: BlockOption) => !!selection && selection.start === o.start && selection.end === o.end
        && selection.days.join() === o.days.join() && selection.weeklyHours === o.weeklyHours;

    return (
        <div className="block-fit-picker">
            <div className="bf-header">
                <div className="bf-course">
                    {sheet.label} block schedule · {lectureUnits} lec + {labUnits} lab = <strong>{weekly} weekly hours</strong>
                    {weekly !== courseFamily && courseFamily <= 6 && <> (uses {courseFamily}-hour blocks)</>}
                    {courseFamily > 6 && <> — no block family is that large</>}
                    <div className="bf-target-note">
                        {fullSemester
                            ? 'Full term: hours target the catalog total, ±1 week.'
                            : 'Short session: hours target one week less than the catalog total.'}
                    </div>
                </div>
                <div className="bf-families" role="group" aria-label="Weekly hours">
                    {families.map(h => (
                        <button
                            key={h}
                            className={`bf-family ${shownFamily === h ? 'active' : ''} ${h === courseFamily ? 'course' : ''}`}
                            onClick={() => setFamily(h)}
                            title={h === courseFamily ? 'This course\'s family' : undefined}
                        >
                            {h} hr
                        </button>
                    ))}
                </div>
            </div>

            {shownFamily === null ? (
                <p className="bf-note">Choose a family above to see its blocks.</p>
            ) : (
                <div className="bf-groups">
                    {groups.map(({ code, rows }) => (
                        <div key={code} className="bf-group">
                            <div className="bf-group-title">{DAYS_TITLES[code]}</div>
                            {rows.map(row => (
                                <div key={`${row[0].option.start}-${row[0].option.end}`} className="bf-row">
                                    <span className="bf-time">{range(row[0].option.start, row[0].option.end, timeFormat)}</span>
                                    <div className="bf-variants">
                                        {row.map(({ option, fit }) => {
                                            const error = 'error' in fit ? fit.error : null;
                                            const over = 'error' in fit ? 0 : fit.overrunMinutes;
                                            const status = error ? 'error' : over > 0 ? 'over' : 'fits';
                                            return (
                                                <button
                                                    key={option.days.join()}
                                                    className={`bf-variant ${status} ${isSelected(option) ? 'selected' : ''}`}
                                                    onClick={() => onSelect(option)}
                                                    disabled={!!error}
                                                    title={error ?? (over > 0 ? `Closest fit runs ${over} min past the block` : 'Fits the block')}
                                                >
                                                    {daysLabel(option.days)}
                                                    <span className="bf-status">{error ? '✕' : over > 0 ? `+${over}m` : <Check size={11} />}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {selection && result && (
                'error' in result ? (
                    <div className="bf-result error">{daysLabel(selection.days)} {range(selection.start, selection.end, timeFormat)}: {result.error}</div>
                ) : (
                    <div className={`bf-result ${result.overrunMinutes > 0 ? 'over' : 'fits'}`}>
                        <strong>{daysLabel(selection.days)} {range(selection.start, selection.end, timeFormat)}</strong>
                        {result.overrunMinutes > 0
                            ? <> — doesn't fit. Closest: runs <strong>{result.overrunMinutes} min</strong> past {formatTime(selection.end, timeFormat)} on {result.perDay.filter(d => d.overrunMinutes === result.overrunMinutes).map(d => d.day).join(', ')}.</>
                            : <> — fits.</>}
                        {' '}{result.perDay.map(d => `${d.day} ends ${formatTime(d.endTime, timeFormat)}`).join(' · ')}
                        {' '}· {result.meetingPatterns} meeting pattern{result.meetingPatterns !== 1 ? 's' : ''}
                        <div className="bf-hours">
                            {result.lectureCatalog > 0 && <>Lecture {result.lectureHours} hrs (target {result.lectureTarget} of {result.lectureCatalog})</>}
                            {result.lectureCatalog > 0 && result.labCatalog > 0 && ' · '}
                            {result.labCatalog > 0 && <>Lab {result.labHours} hrs (target {result.labTarget} of {result.labCatalog})</>}
                        </div>
                    </div>
                )
            )}
        </div>
    );
};

export default BlockFitPicker;
