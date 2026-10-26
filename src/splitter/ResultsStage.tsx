import React from 'react';
import { motion } from 'framer-motion';
import { Copy, RotateCcw, Scissors, CheckCircle, AlertCircle, Clock, SkipForward } from 'lucide-react';
import { SplitterResults, OutputRow, COL } from './types';

interface ResultsStageProps {
    results: SplitterResults;
    tsvOutput: string;
    onReset: () => void;
    onCopy: () => void;
}

const StatusBadge: React.FC<{ row: OutputRow }> = ({ row }) => {
    const classMap: Record<string, string> = {
        'split': 'badge-split',
        'already-split': 'badge-ok',
        'pass-through': 'badge-pass',
        'tba': 'badge-tba',
        'error': 'badge-error',
    };
    const label = row.cells[COL.STATUS] || row.status;
    return <span className={`status-badge ${classMap[row.status] || ''}`}>{label}</span>;
};

export const ResultsStage: React.FC<ResultsStageProps> = ({
    results, tsvOutput, onReset, onCopy
}) => {
    const { summary } = results;

    return (
        <div className="splitter-stage results-stage">
            <div className="stage-header">
                <CheckCircle size={20} />
                <h2>Results</h2>
            </div>

            <div className="summary-bar">
                <div className="summary-total">
                    {summary.totalInputRows} input row{summary.totalInputRows !== 1 ? 's' : ''} → {summary.totalOutputRows} output row{summary.totalOutputRows !== 1 ? 's' : ''}
                </div>
                <div className="summary-chips">
                    {summary.splitCount > 0 && (
                        <span className="chip chip-split">
                            <Scissors size={12} /> {summary.splitCount} split
                        </span>
                    )}
                    {summary.alreadySplitCount > 0 && (
                        <span className="chip chip-ok">
                            <CheckCircle size={12} /> {summary.alreadySplitCount} already split
                        </span>
                    )}
                    {summary.passThroughCount > 0 && (
                        <span className="chip chip-pass">
                            <SkipForward size={12} /> {summary.passThroughCount} pass-through
                        </span>
                    )}
                    {summary.tbaCount > 0 && (
                        <span className="chip chip-tba">
                            <Clock size={12} /> {summary.tbaCount} TBA
                        </span>
                    )}
                    {summary.errorCount > 0 && (
                        <span className="chip chip-error">
                            <AlertCircle size={12} /> {summary.errorCount} error{summary.errorCount !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            <div className="results-table-container">
                <table className="results-table">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>CRN</th>
                            <th>Sub</th>
                            <th>#</th>
                            <th>Sec</th>
                            <th>Days</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>MT</th>
                            <th>Hrs/Ttl</th>
                            <th>Ses#</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.outputRows.map((row, i) => (
                            <tr key={i} className={`result-row row-${row.status}`}>
                                <td><StatusBadge row={row} /></td>
                                <td>{row.cells[COL.CRN]}</td>
                                <td>{row.cells[COL.SUB]}</td>
                                <td>{row.cells[COL.NUM]}</td>
                                <td>{row.cells[COL.SEC]}</td>
                                <td>{row.cells[COL.DAYS]}</td>
                                <td>{row.cells[COL.S_TIME]}</td>
                                <td>{row.cells[COL.E_TIME]}</td>
                                <td>{row.cells[COL.MT]}</td>
                                <td>{row.cells[COL.HRS_TTL]}</td>
                                <td>{row.cells[COL.SES_NUM]}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="stage-actions">
                <motion.button
                    className="secondary-button"
                    onClick={onReset}
                    whileTap={{ scale: 0.95 }}
                >
                    <RotateCcw size={16} /> Start Over
                </motion.button>
                <motion.button
                    className="primary-button"
                    onClick={onCopy}
                    whileTap={{ scale: 0.95 }}
                >
                    <Copy size={16} /> Copy to Spreadsheet
                </motion.button>
            </div>
        </div>
    );
};
