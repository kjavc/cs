// src/components/layout/mobile/MobileSidebar.tsx
import React from 'react';
import { useToast } from '../../Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, HelpCircle, Settings as SettingsIcon, Table, Share2 } from 'lucide-react';
import { Reorder } from 'framer-motion';
import SidebarItem from '../../SidebarItem';
import Settings from '../../Settings';
import ConfirmModal from '../../ConfirmModal';
import { useSections } from '../../../hooks/useSections';
import { useSettings } from '../../../hooks/useSettings';
import { useWorkspace } from '../../../hooks/useWorkspace';
import { SavedSection, AcademicTerm, TermSession, AttendanceAccountingRules } from '../../../types';
import { calculateComponentFields, meetingsPerWeekday, uniformMeetings } from '../../../utils/scheduleGenerator';
import { formatTime } from '../../../utils/timeUtils';
import './MobileSidebar.css';

interface MobileSidebarProps {
    isOpen: boolean;
    onClose: () => void;
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
    handleExportAll: () => void;
    handleExportSpreadsheet: () => void;
    handleShareUrl: () => void;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
    isOpen, onClose, sectionsAPI, settingsAPI, workspaceAPI,
    calendar, attendanceRules, checkIsModified, handleLoadSection, overlaySectionIds, toggleOverlay,
    setIsHelpOpen, isSettingsOpen, setIsSettingsOpen,
    handleExportAll, handleExportSpreadsheet, handleShareUrl
}) => {
    const { savedSections, currentSectionId, deleteSection, renameSection, reorderSections, clearAllSections } = sectionsAPI;
    const { timeFormat } = settingsAPI;

    const { showToast } = useToast();
    const [isConfirmClearOpen, setIsConfirmClearOpen] = React.useState(false);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="mobile-sidebar-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="mobile-sidebar"
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                        <div className="ms-header">
                            <h2>Saved Sections</h2>
                            <button className="ms-close-btn" onClick={onClose}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="ms-actions">
                            <button className="ms-icon-btn" onClick={handleExportSpreadsheet}>
                                <Table size={18} /> Spreadsheet
                            </button>
                            <button className="ms-icon-btn" onClick={handleExportAll}>
                                <ExternalLink size={18} /> Export
                            </button>
                            <button className="ms-icon-btn" onClick={handleShareUrl}>
                                <Share2 size={18} /> Share Link
                            </button>
                            <button className="ms-icon-btn" onClick={() => { setIsHelpOpen(true); onClose(); }}>
                                <HelpCircle size={18} /> Help
                            </button>
                            <div style={{ position: 'relative' }}>
                                <button className={`ms-icon-btn ${isSettingsOpen ? 'active' : ''}`} onClick={() => setIsSettingsOpen(!isSettingsOpen)}>
                                    <SettingsIcon size={18} /> Settings
                                </button>
                            </div>

                        </div>

                        {isSettingsOpen && (
                            <div className="ms-settings-panel">
                                <Settings
                                    calendar={calendar}
                                    settingsAPI={settingsAPI}
                                    onClose={() => setIsSettingsOpen(false)}
                                />
                            </div>
                        )}

                        <div className="ms-content">
                            {savedSections.length === 0 ? (
                                <div className="ms-empty">No saved sections.</div>
                            ) : (
                                <Reorder.Group
                                    axis="y"
                                    values={savedSections}
                                    onReorder={reorderSections}
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
                                                isActive={currentSectionId === section.id}
                                                isModified={checkIsModified(section.id)}
                                                isOverlaid={overlaySectionIds.includes(section.id)}
                                                onToggleOverlay={() => toggleOverlay(section.id)}
                                                isCollapsed={false}
                                                onLoad={() => { handleLoadSection(section); onClose(); }}
                                                onDelete={() => deleteSection(section.id)}
                                                onRename={(newName) => renameSection(section.id, newName)}
                                                formattedLecTime={section.lectureUnits > 0 ? `${formatTime(section.startTime, timeFormat)} - ${formatTime(rawLecEnd, timeFormat)}` : null}
                                                formattedLabTime={section.labUnits > 0 ? `${formatTime(section.labStartTime || section.startTime, timeFormat)} - ${formatTime(rawLabEnd, timeFormat)}` : null}
                                            />
                                        );
                                    })}
                                </Reorder.Group>
                            )}
                        </div>

                        <div className="ms-footer">
                            <button className="ms-clear-btn" onClick={() => setIsConfirmClearOpen(true)}>
                                Clear All Sections
                            </button>
                            <div className="ms-disclaimer">
                                Schedules are saved locally. Use Share Link to transfer between devices.
                            </div>
                        </div>
                    </motion.div>
                </>
            )}

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
                            onClose();
                        }}
                        onCancel={() => setIsConfirmClearOpen(false)}
                    />
                )}
            </AnimatePresence>
        </AnimatePresence>
    );
};
