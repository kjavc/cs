// src/components/Sidebar.tsx
import React from 'react';
import { useToast } from './Toast';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Settings as SettingsIcon,
    HelpCircle,
    ExternalLink,
    Table,
    Share2
} from 'lucide-react';
import SidebarItem from './SidebarItem';
import Settings from './Settings';
import ConfirmModal from './ConfirmModal';
import { useSections } from '../hooks/useSections';
import { useSettings } from '../hooks/useSettings';
import { useWorkspace } from '../hooks/useWorkspace';
import { SavedSection, AcademicTerm, TermSession, AttendanceAccountingRules } from '../types';
import { calculateComponentFields, meetingsPerWeekday, uniformMeetings } from '../utils/scheduleGenerator';
import { formatTime } from '../utils/timeUtils';
import './Sidebar.css';

interface SidebarProps {
    isSidebarCollapsed: boolean;
    setIsSidebarCollapsed: (v: boolean) => void;
    sectionsAPI: ReturnType<typeof useSections>;
    settingsAPI: ReturnType<typeof useSettings>;
    workspaceAPI: ReturnType<typeof useWorkspace>;
    calendar: AcademicTerm[];
    attendanceRules: AttendanceAccountingRules | null;
    checkIsModified: (id: string) => boolean;
    handleLoadSection: (section: SavedSection) => void;
    overlaySectionIds: string[];
    toggleOverlay: (id: string) => void;
    setIsHelpOpen: (v: boolean) => void;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (v: boolean) => void;
    settingsDropdownRef: React.RefObject<HTMLDivElement | null>;
    handleExportAll: () => void;
    handleExportSpreadsheet: () => void;
    handleShareUrl: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    isSidebarCollapsed, setIsSidebarCollapsed,
    sectionsAPI, settingsAPI, workspaceAPI,
    calendar, attendanceRules, checkIsModified, handleLoadSection,
    overlaySectionIds, toggleOverlay, setIsHelpOpen,
    isSettingsOpen, setIsSettingsOpen, settingsDropdownRef,
    handleExportAll, handleExportSpreadsheet, handleShareUrl
}) => {
    const { savedSections, currentSectionId, deleteSection, renameSection, reorderSections, clearAllSections } = sectionsAPI;
    const { timeFormat } = settingsAPI;

    const { showToast } = useToast();
    const [isConfirmClearOpen, setIsConfirmClearOpen] = React.useState(false);

    return (
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                {!isSidebarCollapsed && <span className="sidebar-title">Saved Sections</span>}
                <div className="sidebar-actions" ref={settingsDropdownRef}>
                    {!isSidebarCollapsed && (
                        <>
                            <button className="icon-btn-sm" title="Export for Spreadsheet" onClick={handleExportSpreadsheet}>
                                <Table size={18} />
                            </button>
                            <button className="icon-btn-sm" title="Export All Details" onClick={handleExportAll}>
                                <ExternalLink size={18} />
                            </button>
                            <button className="icon-btn-sm" title="Share via URL" onClick={handleShareUrl} disabled={savedSections.length === 0}>
                                <Share2 size={18} />
                            </button>
                        </>
                    )}
                    <button className="icon-btn-sm" onClick={() => setIsHelpOpen(true)} title="Help">
                        <HelpCircle size={18} />
                    </button>
                    <div style={{ position: 'relative', display: 'flex' }}>
                        <button className="icon-btn-sm" onClick={() => setIsSettingsOpen(!isSettingsOpen)} title="Settings">
                            <SettingsIcon size={18} />
                        </button>
                        <AnimatePresence>
                            {isSettingsOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="settings-popover"
                                >
                                    <Settings
                                        calendar={calendar}
                                        settingsAPI={settingsAPI}
                                        onClose={() => setIsSettingsOpen(false)}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <button
                        className="sidebar-toggle"
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>
            </div>

            <div className="sidebar-content">
                <Reorder.Group
                    axis="y"
                    values={savedSections}
                    onReorder={reorderSections}
                    className="sidebar-list"
                    style={{ listStyle: 'none', padding: 0, margin: 0 }}
                >
                    {savedSections.map((section) => {
                        const termForSection = calendar.find((t: AcademicTerm) => t.id === section.selectedTermId);
                        const sessionForSection = termForSection?.sessions.find((s: TermSession) => s.id === section.selectedSessionId);
                        const meetingsByDay = termForSection && sessionForSection && attendanceRules
                            ? meetingsPerWeekday(termForSection, sessionForSection, attendanceRules)
                            : uniformMeetings(sessionForSection?.weeks || 18);

                        const rawLecEnd = calculateComponentFields(section.lectureUnits, false, section.lectureDays, section.startTime, meetingsByDay, 0, section.fixedHours?.lec).endTime;
                        const rawLabEnd = calculateComponentFields(section.labUnits, true, section.labDays, section.labStartTime || section.startTime, meetingsByDay, 0, section.fixedHours?.lab).endTime;

                        return (
                            <SidebarItem
                                key={section.id}
                                section={section}
                                isActive={section.id === currentSectionId}
                                isModified={checkIsModified(section.id)}
                                isOverlaid={overlaySectionIds.includes(section.id)}
                                onToggleOverlay={() => toggleOverlay(section.id)}
                                isCollapsed={isSidebarCollapsed}
                                onLoad={() => handleLoadSection(section)}
                                onDelete={() => deleteSection(section.id)}
                                onRename={(newName) => renameSection(section.id, newName)}
                                formattedLecTime={section.lectureUnits > 0 ? `${formatTime(section.startTime, timeFormat)} - ${formatTime(rawLecEnd, timeFormat)}` : null}
                                formattedLabTime={section.labUnits > 0 ? `${formatTime(section.labStartTime || section.startTime, timeFormat)} - ${formatTime(rawLabEnd, timeFormat)}` : null}
                            />
                        );
                    })}
                </Reorder.Group>

                {!isSidebarCollapsed && savedSections.length > 0 && (
                    <div className="sidebar-footer">
                        <button className="clear-all-sidebar-btn" onClick={() => setIsConfirmClearOpen(true)}>
                            Clear All Sections
                        </button>
                        <div className="sidebar-disclaimer">
                            Schedules are saved locally. Use Share Link to transfer between devices.
                        </div>
                    </div>
                )}

            </div>

            <AnimatePresence>
                {isConfirmClearOpen && (
                    <ConfirmModal
                        title="Clear All Sections?"
                        message="Are you sure you want to delete all saved sections? This action cannot be undone."
                        confirmText="Delete All"
                        cancelText="Cancel"
                        onConfirm={() => {
                            clearAllSections();
                            showToast("All sections deleted", "info");
                            setIsConfirmClearOpen(false);
                        }}
                        onCancel={() => setIsConfirmClearOpen(false)}
                    />
                )}
            </AnimatePresence>
        </aside>
    );
};

export default Sidebar;
