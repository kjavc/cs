import React from 'react';
import { motion } from 'framer-motion';
import { Copy, RotateCcw, CalendarClock, Ban, Palette } from 'lucide-react';
import { RollResults, RollOutputRow, ROLL_NOTES_COL } from './roll';
import { RollCatalogBanner } from './RollReviewStage';
import { COL } from './types';

interface RollResultsStageProps {
    results: RollResults;
    onReset: () => void;
    onCopyRich: () => void;
    onCopyPlain: () => void;
    onCopyCantRoll: () => void;
}

const COLUMNS: Array<[string, number]> = [
    ['CRN', COL.CRN], ['Sub', COL.SUB], ['#', COL.NUM], ['Sec', COL.SEC], ['Faculty', COL.FACULTY],
    ['Days', COL.DAYS], ['Start', COL.S_TIME], ['End', COL.E_TIME], ['Bldg', COL.BLDG], ['Rm', COL.RM],
    ['S Date', COL.S_DATE], ['E Date', COL.E_DATE], ['MT', COL.MT], ['Hrs/Ttl', COL.HRS_TTL], ['LHE', COL.LHE],
];

const cellClass = (row: RollOutputRow, col: number) =>
    row.conflictCols.includes(col) ? 'cell-conflict' : row.changedCols.includes(col) ? 'cell-changed' : '';

const statusClass: Record<string, string> = {
    'split': 'badge-split', 'already-split': 'badge-ok', 'pass-through': 'badge-pass', 'tba': 'badge-tba', 'error': 'badge-error',
};

export const RollResultsStage: React.FC<RollResultsStageProps> = ({
    results, onReset, onCopyRich, onCopyPlain, onCopyCantRoll
}) => (
    <div className="splitter-stage results-stage">
        <div className="stage-header">
            <CalendarClock size={20} />
            <h2>Rolled to {results.targetTerm.name}</h2>
        </div>

        <RollCatalogBanner results={results} />

        <div className="info-banner">
            Copy pastes 28 columns: A–Z, status in AA, roll notes in AB. "Copy with highlights" also carries cell colors
            (yellow = recomputed, orange = conflict, red = error) into spreadsheets that accept rich paste.
        </div>

        <div className="results-table-container">
            <table className="results-table">
                <thead>
                    <tr>
                        <th>Status</th>
                        {COLUMNS.map(([label]) => <th key={label}>{label}</th>)}
                        <th>Roll Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {results.outputRows.map((row, i) => (
                        <tr key={i} className={`result-row row-${row.status}`}>
                            <td><span className={`status-badge ${statusClass[row.status] || ''}`}>{row.cells[COL.STATUS]}</span></td>
                            {COLUMNS.map(([label, col]) => <td key={label} className={cellClass(row, col)}>{row.cells[col]}</td>)}
                            <td className="notes-cell">{row.cells[ROLL_NOTES_COL]}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <div className="stage-actions">
            <motion.button className="secondary-button" onClick={onReset} whileTap={{ scale: 0.95 }}>
                <RotateCcw size={16} /> Start Over
            </motion.button>
            <div className="action-group">
                <motion.button className="secondary-button" onClick={onCopyPlain} whileTap={{ scale: 0.95 }}>
                    <Copy size={16} /> Copy plain
                </motion.button>
                <motion.button className="primary-button" onClick={onCopyRich} whileTap={{ scale: 0.95 }}>
                    <Palette size={16} /> Copy with highlights
                </motion.button>
            </div>
        </div>

        {results.cantRoll.length > 0 && (
            <div className="cant-roll-section">
                <div className="stage-header">
                    <Ban size={18} />
                    <h3>Can't roll ({results.summary.cantRoll} section{results.summary.cantRoll !== 1 ? 's' : ''})</h3>
                </div>
                <div className="results-table-container">
                    <table className="results-table">
                        <thead>
                            <tr><th>CRN</th><th>Sub</th><th>#</th><th>Sec</th><th>Days</th><th>Start</th><th>End</th><th>S Date</th><th>Reason</th></tr>
                        </thead>
                        <tbody>
                            {results.cantRoll.map((r, i) => (
                                <tr key={i}>
                                    <td>{r.cells[COL.CRN]}</td><td>{r.cells[COL.SUB]}</td><td>{r.cells[COL.NUM]}</td><td>{r.cells[COL.SEC]}</td>
                                    <td>{r.cells[COL.DAYS]}</td><td>{r.cells[COL.S_TIME]}</td><td>{r.cells[COL.E_TIME]}</td>
                                    <td>{r.cells[COL.S_DATE]}</td><td>{r.reason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="stage-actions">
                    <span className="row-count">Original rows (source dates) with the reason in column AA.</span>
                    <motion.button className="secondary-button" onClick={onCopyCantRoll} whileTap={{ scale: 0.95 }}>
                        <Copy size={16} /> Copy can't-roll list
                    </motion.button>
                </div>
            </div>
        )}
    </div>
);
