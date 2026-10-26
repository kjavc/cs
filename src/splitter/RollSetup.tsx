import React from 'react';
import { ArrowRight } from 'lucide-react';
import { AcademicTerm } from '../types/calendar';
import { seasonName } from './roll';

interface RollSetupProps {
    calendar: AcademicTerm[];
    detectedSource: AcademicTerm | null;
    source: AcademicTerm | null;
    onSourceChange: (termId: string) => void;   // '' = use detected
    targets: AcademicTerm[];
    target: AcademicTerm | null;
    onTargetChange: (termId: string) => void;
}

export const RollSetup: React.FC<RollSetupProps> = ({
    calendar, detectedSource, source, onSourceChange, targets, target, onTargetChange
}) => (
    <div className="roll-setup">
        <label className="roll-field">
            <span>From</span>
            <select value={source?.id ?? ''} onChange={e => onSourceChange(e.target.value === detectedSource?.id ? '' : e.target.value)}>
                {!source && <option value="">Paste data to detect…</option>}
                {calendar.map(t => (
                    <option key={t.id} value={t.id}>
                        {t.name}{t.id === detectedSource?.id ? ' (detected)' : ''}
                    </option>
                ))}
            </select>
        </label>
        <ArrowRight size={16} className="roll-arrow" />
        <label className="roll-field">
            <span>To</span>
            <select value={target?.id ?? ''} onChange={e => onTargetChange(e.target.value)} disabled={targets.length === 0}>
                {targets.length === 0 && <option value="">—</option>}
                {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
        </label>
        {source && targets.length === 0 && (
            <span className="roll-hint">No later {seasonName(source.id)} term in the calendar.</span>
        )}
    </div>
);
