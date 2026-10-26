import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, ArrowRight, ArrowLeft,
    Scissors, CheckCircle, AlertCircle, Clock, SkipForward } from 'lucide-react';
import { ReviewSummary, CRNGroup, COL } from './types';

interface ReviewStageProps {
    summary: ReviewSummary;
    groups: CRNGroup[];
    onProcess: () => void;
    onBack: () => void;
}

const ClassBadge: React.FC<{ type: string }> = ({ type }) => {
    const labels: Record<string, { text: string; className: string }> = {
        'split': { text: 'Split', className: 'badge-split' },
        'already-split': { text: 'Already Split', className: 'badge-ok' },
        'pass-through': { text: 'Pass Through', className: 'badge-pass' },
        'tba': { text: 'TBA', className: 'badge-tba' },
        'error': { text: 'Error', className: 'badge-error' },
    };
    const info = labels[type] || { text: type, className: '' };
    return <span className={`classification-badge ${info.className}`}>{info.text}</span>;
};

export const ReviewStage: React.FC<ReviewStageProps> = ({
    summary, groups, onProcess, onBack
}) => {
    const [errorsExpanded, setErrorsExpanded] = useState(summary.errors > 0);
    const [detailsExpanded, setDetailsExpanded] = useState(false);

    const canProcess = summary.toSplit > 0 || summary.alreadySplit > 0 || summary.passThrough > 0 || summary.tba > 0;

    return (
        <div className="splitter-stage review-stage">
            <div className="stage-header">
                <Scissors size={20} />
                <h2>Review</h2>
            </div>

            <div className="summary-bar">
                <div className="summary-total">
                    Found <strong>{summary.totalSections}</strong> section{summary.totalSections !== 1 ? 's' : ''}
                </div>
                <div className="summary-chips">
                    {summary.toSplit > 0 && (
                        <span className="chip chip-split">
                            <Scissors size={12} /> {summary.toSplit} to split
                        </span>
                    )}
                    {summary.alreadySplit > 0 && (
                        <span className="chip chip-ok">
                            <CheckCircle size={12} /> {summary.alreadySplit} already split
                        </span>
                    )}
                    {summary.passThrough > 0 && (
                        <span className="chip chip-pass">
                            <SkipForward size={12} /> {summary.passThrough} pass-through
                        </span>
                    )}
                    {summary.tba > 0 && (
                        <span className="chip chip-tba">
                            <Clock size={12} /> {summary.tba} TBA
                        </span>
                    )}
                    {summary.errors > 0 && (
                        <span className="chip chip-error">
                            <AlertCircle size={12} /> {summary.errors} error{summary.errors !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            {summary.errors > 0 && (
                <div className="expandable-section">
                    <button
                        className="expandable-header error-header"
                        onClick={() => setErrorsExpanded(!errorsExpanded)}
                    >
                        {errorsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <AlertCircle size={16} />
                        {summary.errors} Error{summary.errors !== 1 ? 's' : ''} — these sections will not be processed
                    </button>
                    <AnimatePresence>
                        {errorsExpanded && (
                            <motion.div
                                className="expandable-content"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                            >
                                {summary.errorDetails.map((err, i) => (
                                    <div key={i} className="error-detail">
                                        <span className="error-crn">CRN {err.crn}</span>
                                        <span className="error-course">{err.sub} {err.num}</span>
                                        <span className="error-msg">{err.message}</span>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <div className="expandable-section">
                <button
                    className="expandable-header"
                    onClick={() => setDetailsExpanded(!detailsExpanded)}
                >
                    {detailsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    Inspect Sections ({groups.length})
                </button>
                <AnimatePresence>
                    {detailsExpanded && (
                        <motion.div
                            className="expandable-content section-list"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                        >
                            {groups.map(group => {
                                const classification = summary.classifications.get(group.crn);
                                return (
                                    <div key={group.crn} className="section-detail">
                                        <div className="section-detail-header">
                                            <span className="detail-crn">CRN {group.crn}</span>
                                            <span className="detail-course">{group.sub} {group.num}</span>
                                            {classification && <ClassBadge type={classification.type} />}
                                        </div>
                                        <div className="section-detail-rows">
                                            {group.rows.map((row, ri) => (
                                                <div key={ri} className="detail-row">
                                                    <span>ses {row.cells[COL.SES_NUM]}</span>
                                                    <span>{row.cells[COL.DAYS]}</span>
                                                    <span>{row.cells[COL.S_TIME]}–{row.cells[COL.E_TIME]}</span>
                                                    <span>mt={row.cells[COL.MT]}</span>
                                                    <span>{row.cells[COL.HRS_TTL]} hrs</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="stage-actions">
                <motion.button
                    className="secondary-button"
                    onClick={onBack}
                    whileTap={{ scale: 0.95 }}
                >
                    <ArrowLeft size={16} /> Back
                </motion.button>
                <motion.button
                    className="primary-button"
                    onClick={onProcess}
                    disabled={!canProcess}
                    whileTap={{ scale: 0.95 }}
                >
                    Process {summary.toSplit > 0 ? `${summary.toSplit} Section${summary.toSplit !== 1 ? 's' : ''}` : ''} <ArrowRight size={16} />
                </motion.button>
            </div>
        </div>
    );
};
