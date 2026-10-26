import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, ArrowRight, ArrowLeft, CalendarClock, Scissors,
    AlertCircle, AlertTriangle, Ban, Clock, Layers } from 'lucide-react';
import { RollResults } from './roll';
import { formatAy } from '../utils/catalogForTerm';

export const RollCatalogBanner: React.FC<{ results: RollResults }> = ({ results }) => {
    const { targetCatalog } = results;
    if (!targetCatalog.isFallback) return null;
    return (
        <div className="roll-banner" role="alert">
            <AlertTriangle size={18} />
            <div>
                <strong>{formatAy(targetCatalog.ay)} catalog not available yet</strong> — unit changes can't be detected.
                Rows were checked against {formatAy(targetCatalog.catalogAy)}.
            </div>
        </div>
    );
};

const Expandable: React.FC<{
    title: React.ReactNode;
    className?: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}> = ({ title, className = '', defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="expandable-section">
            <button className={`expandable-header ${className}`} onClick={() => setOpen(!open)}>
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {title}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        className="expandable-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface RollReviewStageProps {
    results: RollResults;
    onContinue: () => void;
    onBack: () => void;
}

export const RollReviewStage: React.FC<RollReviewStageProps> = ({ results, onContinue, onBack }) => {
    const { summary, sourceTerm, targetTerm } = results;
    const flagged = results.outputRows.filter(r => r.flags.length > 0 && r.status !== 'error');
    const cantRollCrns = Array.from(new Map(results.cantRoll.map(r => [r.crn, r])).values());

    return (
        <div className="splitter-stage review-stage">
            <div className="stage-header">
                <CalendarClock size={20} />
                <h2>Review Roll: {sourceTerm.name} → {targetTerm.name}</h2>
            </div>

            <RollCatalogBanner results={results} />

            <div className="summary-bar">
                <div className="summary-total">
                    <strong>{summary.sections}</strong> section{summary.sections !== 1 ? 's' : ''} → <strong>{summary.outputRows}</strong> output row{summary.outputRows !== 1 ? 's' : ''}
                </div>
                <div className="summary-chips">
                    {summary.split > 0 && <span className="chip chip-split"><Scissors size={12} /> {summary.split} split</span>}
                    {summary.unitsChanged > 0 && <span className="chip chip-units"><Layers size={12} /> {summary.unitsChanged} units changed</span>}
                    {summary.hoursChanged > 0 && <span className="chip chip-hours"><Clock size={12} /> {summary.hoursChanged} hours changed</span>}
                    {summary.conflicts > 0 && <span className="chip chip-conflict"><AlertTriangle size={12} /> {summary.conflicts} conflict row{summary.conflicts !== 1 ? 's' : ''}</span>}
                    {summary.errors > 0 && <span className="chip chip-error"><AlertCircle size={12} /> {summary.errors} error{summary.errors !== 1 ? 's' : ''}</span>}
                    {summary.cantRoll > 0 && <span className="chip chip-cantroll"><Ban size={12} /> {summary.cantRoll} can't roll</span>}
                </div>
            </div>

            {results.errorDetails.length > 0 && (
                <Expandable
                    className="error-header"
                    defaultOpen
                    title={<><AlertCircle size={16} /> {results.errorDetails.length} Error{results.errorDetails.length !== 1 ? 's' : ''} — dates rolled, times left as-is</>}
                >
                    {results.errorDetails.map((err, i) => (
                        <div key={i} className="error-detail">
                            <span className="error-crn">CRN {err.crn}</span>
                            <span className="error-course">{err.sub} {err.num}</span>
                            <span className="error-msg">{err.message}</span>
                        </div>
                    ))}
                </Expandable>
            )}

            {cantRollCrns.length > 0 && (
                <Expandable title={<><Ban size={16} /> {cantRollCrns.length} Can't roll — listed separately on the next screen</>}>
                    {cantRollCrns.map(r => (
                        <div key={r.crn} className="error-detail">
                            <span className="error-crn">CRN {r.crn}</span>
                            <span className="error-course">{r.sub} {r.num}</span>
                            <span className="error-msg">{r.reason}</span>
                        </div>
                    ))}
                </Expandable>
            )}

            {flagged.length > 0 && (
                <Expandable title={<><AlertTriangle size={16} /> {flagged.length} Flagged row{flagged.length !== 1 ? 's' : ''}</>}>
                    {flagged.map((r, i) => (
                        <div key={i} className="error-detail">
                            <span className="error-crn">CRN {r.sourceCRN}</span>
                            <span className="error-course">{r.cells[3]} {r.cells[4]}</span>
                            <span className="error-msg">{r.cells[27]}</span>
                        </div>
                    ))}
                </Expandable>
            )}

            <div className="stage-actions">
                <motion.button className="secondary-button" onClick={onBack} whileTap={{ scale: 0.95 }}>
                    <ArrowLeft size={16} /> Back
                </motion.button>
                <motion.button className="primary-button" onClick={onContinue} whileTap={{ scale: 0.95 }}>
                    See Results <ArrowRight size={16} />
                </motion.button>
            </div>
        </div>
    );
};
