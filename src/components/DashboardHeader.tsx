// src/components/DashboardHeader.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Save, Copy, ChevronDown } from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { useSections } from '../hooks/useSections';
import { RoomConflict } from '../utils/roomConflicts';
import './DashboardHeader.css';

interface DashboardHeaderProps {
    status: { label: string; class: string };
    isStatusPopoverOpen: boolean;
    setIsStatusPopoverOpen: (open: boolean) => void;
    statusPopoverRef: React.RefObject<HTMLDivElement | null>;
    workspaceAPI: ReturnType<typeof useWorkspace>;
    sectionsAPI: ReturnType<typeof useSections>;
    handleScheduleNew: () => void;
    handleSaveSection: () => void;
    handleSaveAsNew: () => void;
    handleCopy: (type: 'simple' | 'detailed' | 'spreadsheet') => void;
    isCopyDropdownOpen: boolean;
    setIsCopyDropdownOpen: (open: boolean) => void;
    copyDropdownRef: React.RefObject<HTMLDivElement | null>;
    selectedTermId: string;
    roomConflicts?: RoomConflict[];
    appMode?: 'scheduler' | 'splitter';
    setAppMode?: (mode: 'scheduler' | 'splitter') => void;
}


const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    status,
    isStatusPopoverOpen,
    setIsStatusPopoverOpen,
    workspaceAPI,
    sectionsAPI,
    statusPopoverRef,
    handleScheduleNew,
    handleSaveSection,
    handleSaveAsNew,
    handleCopy,
    isCopyDropdownOpen,
    setIsCopyDropdownOpen,
    copyDropdownRef,
    selectedTermId,
    roomConflicts = [],
    appMode,
    setAppMode
}) => {
    const { generatedSchedule } = workspaceAPI;
    const { currentSectionId } = sectionsAPI;
    const isBorrowedCatalog = ['fa2027', 'wi2028', 'sp2028', 'su2028'].includes(selectedTermId);

    return (
        <header className="dashboard-header">
            <div className="header-left">
                <img src={process.env.PUBLIC_URL + '/logo.svg'} className="app-logo" alt="logo" />
                <h1>Course Scheduler</h1>
                {setAppMode && (
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
                )}
                <div className="status-container" ref={statusPopoverRef}>
                    <span
                        className={`status-badge ${status.class} ${generatedSchedule ? 'clickable' : ''}`}
                        onClick={() => generatedSchedule && setIsStatusPopoverOpen(!isStatusPopoverOpen)}
                        tabIndex={generatedSchedule ? 0 : undefined}
                        role={generatedSchedule ? 'button' : undefined}
                        aria-expanded={generatedSchedule ? isStatusPopoverOpen : undefined}
                        onKeyDown={(e) => {
                            if (generatedSchedule && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                setIsStatusPopoverOpen(!isStatusPopoverOpen);
                            }
                        }}
                    >
                        {status.label}
                    </span>
                    {isBorrowedCatalog && (
                        <span className="catalog-notice" title="The AY27-28 catalog is not yet available. Course options shown reflect the AY26-27 catalog.">
                            AY27-28 is using AY26-27 catalog
                        </span>
                    )}
                    {isStatusPopoverOpen && generatedSchedule && (
                        <div className="status-popover">
                            <h4>Schedule Details</h4>
                            <ul>
                                {generatedSchedule.warnings.length > 0 ? (
                                    generatedSchedule.warnings.map((w, i) => (
                                        <li key={i} className={w.startsWith('ERROR:') ? 'error' : ''}>
                                            {w.replace('ERROR: ', '')}
                                        </li>
                                    ))
                                ) : roomConflicts.length === 0 ? (
                                    <li>This schedule is fully rule-compliant.</li>
                                ) : null}
                                {roomConflicts.map((c, i) => (
                                    <li key={`rc-${i}`} className="error">
                                        Room conflict: {c.sectionName} on {c.day} {c.conflictTime} ({c.weekLabel})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <div className="header-right">
                <motion.button
                    className="secondary-button compact"
                    onClick={handleScheduleNew}
                    whileTap={{ scale: 0.95 }}
                >
                    <Plus size={16} /> Schedule New Section
                </motion.button>
                <motion.button
                    className="primary-button compact"
                    onClick={handleSaveSection}
                    whileTap={{ scale: 0.95 }}
                >
                    <Save size={16} /> {currentSectionId ? 'Update Section' : 'Save Section'}
                </motion.button>
                {currentSectionId && (
                    <motion.button
                        className="secondary-button compact"
                        onClick={handleSaveAsNew}
                        whileTap={{ scale: 0.95 }}
                        title="Duplicate this section into a new save"
                    >
                        <Copy size={16} /> Save as New
                    </motion.button>
                )}
                {generatedSchedule && (
                    <div className="split-button-container" ref={copyDropdownRef}>
                        <motion.button
                            className="secondary-button split-left compact"
                            onClick={() => handleCopy('simple')}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Copy size={16} /> Copy
                        </motion.button>
                        <motion.button
                            className={`secondary-button split-right compact ${isCopyDropdownOpen ? 'active' : ''}`}
                            onClick={() => setIsCopyDropdownOpen(!isCopyDropdownOpen)}
                            whileTap={{ scale: 0.95 }}
                        >
                            <ChevronDown size={14} />
                        </motion.button>
                        {isCopyDropdownOpen && (
                            <div className="dropdown-menu">
                                <button
                                    className="dropdown-item"
                                    onClick={() => { handleCopy('detailed'); setIsCopyDropdownOpen(false); }}
                                >
                                    <Copy size={14} /> Copy Detailed
                                </button>
                                <button
                                    className="dropdown-item"
                                    onClick={() => { handleCopy('spreadsheet'); setIsCopyDropdownOpen(false); }}
                                >
                                    <Copy size={14} /> Spreadsheet Format
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
};

export default DashboardHeader;
