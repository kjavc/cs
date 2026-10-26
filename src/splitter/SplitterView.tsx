import React, { useState, useCallback, useMemo } from 'react';
import { SplitterStage, CRNGroup, ReviewSummary, SplitterResults } from './types';
import { parseAndGroup, classifyGroups, processGroups, outputToTsv } from './pipeline';
import { PasteStage, SplitterMode } from './PasteStage';
import { RollSetup } from './RollSetup';
import { RollReviewStage } from './RollReviewStage';
import { RollResultsStage } from './RollResultsStage';
import { rollGroups, rollTargetsFor, detectSourceTerm, rollToTsv, rollToHtml, RollResults } from './roll';
import { academicCalendar } from '../types/calendar';
import { ReviewStage } from './ReviewStage';
import { ResultsStage } from './ResultsStage';
import { useToast } from '../components/Toast';
import { copyToClipboard, copyRichToClipboard } from '../utils/copyUtils';
import { AttendanceAccountingRules } from '../types/rules';
import './SplitterView.css';

interface SplitterViewProps {
    attendanceRules: AttendanceAccountingRules;
    appMode: 'scheduler' | 'splitter';
    setAppMode: (mode: 'scheduler' | 'splitter') => void;
}

const SplitterView: React.FC<SplitterViewProps> = ({ attendanceRules, appMode, setAppMode }) => {
    const { showToast } = useToast();

    const [stage, setStage] = useState<SplitterStage>('paste');
    const [rawInput, setRawInput] = useState('');
    const [groups, setGroups] = useState<CRNGroup[]>([]);
    const [parseWarnings, setParseWarnings] = useState<string[]>([]);
    const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
    const [results, setResults] = useState<SplitterResults | null>(null);
    const [tsvOutput, setTsvOutput] = useState('');

    // Roll mode
    const [mode, setMode] = useState<SplitterMode>('split');
    const [sourceTermId, setSourceTermId] = useState('');   // '' = detected from pasted dates
    const [targetTermId, setTargetTermId] = useState('');   // '' = earliest valid target
    const [rollResults, setRollResults] = useState<RollResults | null>(null);

    const detectedSource = useMemo(() => {
        if (mode !== 'roll' || !rawInput.trim()) return null;
        try {
            return detectSourceTerm(parseAndGroup(rawInput).groups, academicCalendar);
        } catch {
            return null;
        }
    }, [mode, rawInput]);
    const sourceTerm = academicCalendar.find(t => t.id === sourceTermId) ?? detectedSource;
    const rollTargets = useMemo(() => sourceTerm ? rollTargetsFor(sourceTerm, academicCalendar) : [], [sourceTerm]);
    const targetTerm = rollTargets.find(t => t.id === targetTermId) ?? rollTargets[0] ?? null;

    const handleParse = useCallback(() => {
        try {
            const { groups: parsed, parseWarnings: warnings } = parseAndGroup(rawInput);
            if (parsed.length === 0) {
                showToast('No valid data rows found.', 'error');
                setParseWarnings(warnings);
                return;
            }
            setGroups(parsed);
            setParseWarnings(warnings);

            if (mode === 'roll') {
                if (!sourceTerm || !targetTerm) {
                    showToast('Pick the term to roll from and to.', 'error');
                    return;
                }
                setRollResults(rollGroups(parsed, sourceTerm, targetTerm, attendanceRules));
                setStage('review');
                return;
            }

            const summary = classifyGroups(parsed, attendanceRules);
            setReviewSummary(summary);
            setStage('review');
        } catch (err: any) {
            showToast(`Parse error: ${err.message || 'Unknown error'}`, 'error');
        }
    }, [rawInput, attendanceRules, mode, sourceTerm, targetTerm, showToast]);

    const handleProcess = useCallback(() => {
        if (!reviewSummary) return;
        try {
            const result = processGroups(groups, reviewSummary);
            setResults(result);
            setTsvOutput(outputToTsv(result));
            setStage('results');
        } catch (err: any) {
            showToast(`Processing error: ${err.message || 'Unknown error'}`, 'error');
        }
    }, [groups, reviewSummary, showToast]);

    const handleCopy = useCallback(async () => {
        const success = await copyToClipboard(tsvOutput);
        if (success) {
            showToast(`Copied ${results?.outputRows.length || 0} rows to clipboard.`);
        } else {
            showToast('Failed to copy to clipboard.', 'error');
        }
    }, [tsvOutput, results, showToast]);

    const copyWithToast = useCallback(async (copy: () => Promise<boolean>, rows: number) => {
        const success = await copy();
        if (success) {
            const fallback = rollResults?.targetCatalog.isFallback ? ' Units not checked (next year\'s catalog isn\'t available).' : '';
            showToast(`Copied ${rows} rows to clipboard.${fallback}`);
        } else {
            showToast('Failed to copy to clipboard.', 'error');
        }
    }, [rollResults, showToast]);

    const handleReset = useCallback(() => {
        setStage('paste');
        setRawInput('');
        setGroups([]);
        setParseWarnings([]);
        setReviewSummary(null);
        setResults(null);
        setTsvOutput('');
        setRollResults(null);
    }, []);

    return (
        <div className="splitter-layout">
            <header className="splitter-header">
                <div className="header-left">
                    <img src={process.env.PUBLIC_URL + '/logo.svg'} className="app-logo" alt="logo" />
                    <h1>Course Scheduler</h1>
                    <div className="mode-tabs">
                        <button
                            className={`mode-tab ${appMode === 'scheduler' ? 'active' : ''}`}
                            onClick={() => setAppMode('scheduler')}
                        >
                            Scheduler
                        </button>
                        <button
                            className={`mode-tab ${appMode === 'splitter' ? 'active' : ''}`}
                            onClick={() => setAppMode('splitter')}
                        >
                            Splitter
                        </button>
                    </div>
                </div>
            </header>

            <main className="splitter-content">
                {stage === 'paste' && (
                    <PasteStage
                        rawInput={rawInput}
                        setRawInput={setRawInput}
                        onParse={handleParse}
                        parseWarnings={parseWarnings}
                        mode={mode}
                        setMode={setMode}
                        canRoll={!!sourceTerm && !!targetTerm}
                        rollSetup={
                            <RollSetup
                                calendar={academicCalendar}
                                detectedSource={detectedSource}
                                source={sourceTerm}
                                onSourceChange={id => { setSourceTermId(id); setTargetTermId(''); }}
                                targets={rollTargets}
                                target={targetTerm}
                                onTargetChange={setTargetTermId}
                            />
                        }
                    />
                )}
                {stage === 'review' && mode === 'roll' && rollResults && (
                    <RollReviewStage
                        results={rollResults}
                        onContinue={() => setStage('results')}
                        onBack={() => setStage('paste')}
                    />
                )}
                {stage === 'results' && mode === 'roll' && rollResults && (
                    <RollResultsStage
                        results={rollResults}
                        onReset={handleReset}
                        onCopyRich={() => copyWithToast(() => copyRichToClipboard(rollToTsv(rollResults.outputRows), rollToHtml(rollResults.outputRows)), rollResults.outputRows.length)}
                        onCopyPlain={() => copyWithToast(() => copyToClipboard(rollToTsv(rollResults.outputRows)), rollResults.outputRows.length)}
                        onCopyCantRoll={() => copyWithToast(() => copyToClipboard(rollToTsv(rollResults.cantRoll)), rollResults.cantRoll.length)}
                    />
                )}
                {stage === 'review' && mode === 'split' && reviewSummary && (
                    <ReviewStage
                        summary={reviewSummary}
                        groups={groups}
                        onProcess={handleProcess}
                        onBack={() => setStage('paste')}
                    />
                )}
                {stage === 'results' && mode === 'split' && results && (
                    <ResultsStage
                        results={results}
                        tsvOutput={tsvOutput}
                        onReset={handleReset}
                        onCopy={handleCopy}
                    />
                )}
            </main>
        </div>
    );
};

export default SplitterView;
