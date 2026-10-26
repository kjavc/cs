import React from 'react';
import { motion } from 'framer-motion';
import { ClipboardPaste, ArrowRight, AlertTriangle, Scissors, CalendarClock } from 'lucide-react';

export type SplitterMode = 'split' | 'roll';

interface PasteStageProps {
    rawInput: string;
    setRawInput: (v: string) => void;
    onParse: () => void;
    parseWarnings: string[];
    mode: SplitterMode;
    setMode: (m: SplitterMode) => void;
    rollSetup?: React.ReactNode;   // term pickers, shown in roll mode
    canRoll?: boolean;
}

export const PasteStage: React.FC<PasteStageProps> = ({
    rawInput, setRawInput, onParse, parseWarnings, mode, setMode, rollSetup, canRoll
}) => {
    const lineCount = rawInput.trim() ? rawInput.trim().split('\n').length : 0;

    return (
        <div className="splitter-stage paste-stage">
            <div className="stage-header">
                <ClipboardPaste size={20} />
                <h2>Paste Schedule Data</h2>
            </div>

            <div className="mode-toggle" role="tablist">
                <button role="tab" aria-selected={mode === 'split'} className={mode === 'split' ? 'active' : ''} onClick={() => setMode('split')}>
                    <Scissors size={14} /> Split
                </button>
                <button role="tab" aria-selected={mode === 'roll'} className={mode === 'roll' ? 'active' : ''} onClick={() => setMode('roll')}>
                    <CalendarClock size={14} /> Roll to another term
                </button>
            </div>

            {mode === 'roll' && rollSetup}

            <div className="info-banner">
                Paste your registrar spreadsheet data (TSV) below. The 26-column format is expected.
                Columns Y and Z (formula-based) will not round-trip cleanly.
                {mode === 'roll' && ' Rolling shifts dates to the new term, re-checks units against its catalog, recomputes end times, and flags what changed in a new column AB.'}
            </div>

            <textarea
                className="splitter-textarea"
                placeholder="Paste tab-separated data here..."
                value={rawInput}
                onChange={e => setRawInput(e.target.value)}
                spellCheck={false}
            />

            <div className="paste-footer">
                <span className="row-count">
                    {lineCount > 0 ? `${lineCount} row${lineCount !== 1 ? 's' : ''} detected` : 'No data'}
                </span>

                <motion.button
                    className="primary-button"
                    onClick={onParse}
                    disabled={!rawInput.trim() || (mode === 'roll' && !canRoll)}
                    whileTap={{ scale: 0.95 }}
                >
                    {mode === 'roll' ? 'Roll' : 'Parse'} <ArrowRight size={16} />
                </motion.button>
            </div>

            {parseWarnings.length > 0 && (
                <div className="parse-warnings">
                    {parseWarnings.map((w, i) => (
                        <div key={i} className="warning-item">
                            <AlertTriangle size={14} /> {w}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
