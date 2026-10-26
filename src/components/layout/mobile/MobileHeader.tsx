import React, { useRef, useState } from 'react';
import { Menu, Save, MoreVertical, Plus, FileText, CheckCircle2, AlertTriangle, Copy, Table } from 'lucide-react';
import { useWorkspace } from '../../../hooks/useWorkspace';
import { useSections } from '../../../hooks/useSections';
import { useOutsideClick } from '../../../hooks/useOutsideClick';
import './MobileHeader.css';

interface MobileHeaderProps {
    onOpenSidebar: () => void;
    onSave: () => void;
    onNew: () => void;
    onCopySimple: () => void;
    onCopyDetailed: () => void;
    onCopySpreadsheet: () => void;
    onSaveAsNew: () => void;
    workspaceAPI: ReturnType<typeof useWorkspace>;
    sectionsAPI: ReturnType<typeof useSections>;
    selectedTermId: string;
}


export const MobileHeader: React.FC<MobileHeaderProps> = ({
    onOpenSidebar, onSave, onNew, onCopySimple, onCopyDetailed, onCopySpreadsheet, onSaveAsNew, workspaceAPI, sectionsAPI, selectedTermId
}) => {
    const isBorrowedCatalog = ['fa2027', 'wi2028', 'sp2028', 'su2028'].includes(selectedTermId);
    const { generatedSchedule: schedule, isCalculating } = workspaceAPI;
    const { currentSectionId } = sectionsAPI;

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    useOutsideClick(menuRef, () => setMenuOpen(false));

    const getStatus = () => {
        if (isCalculating) return { label: 'Automating...', icon: <CheckCircle2 size={16} />, class: 'warning' };
        if (!schedule) return null;
        if (schedule.warnings.some(w => w.startsWith('ERROR:'))) return { label: 'Conflict', icon: <AlertTriangle size={16} />, class: 'error' };
        if (schedule.warnings.length > 0) return { label: 'Adjusted', icon: <AlertTriangle size={16} />, class: 'warning' };
        return { label: 'Valid', icon: <CheckCircle2 size={16} />, class: 'valid' };
    };

    const statusInfo = getStatus();

    return (
        <header className="mobile-header">
            <div className="mh-left">
                <button className="mh-btn" onClick={onOpenSidebar} aria-label="Menu">
                    <Menu size={24} />
                </button>
                <div className="mh-title-area">
                    <h1 className="mh-title">Scheduler</h1>
                    {statusInfo && (
                        <span className={`mh-badge ${statusInfo.class}`}>
                            {statusInfo.icon} {statusInfo.label}
                        </span>
                    )}
                    {isBorrowedCatalog && (
                        <span className="mh-catalog-notice" title="The AY27-28 catalog is not yet available. Course options shown reflect the AY26-27 catalog.">
                            AY27-28 using AY26-27 catalog
                        </span>
                    )}
                </div>
            </div>

            <div className="mh-right">
                {currentSectionId && (
                    <button className="mh-btn" onClick={onSaveAsNew} aria-label="Save as New">
                        <Copy size={20} />
                    </button>
                )}
                <button className="mh-btn primary" onClick={onSave} aria-label={currentSectionId ? "Update" : "Save"}>
                    <Save size={20} />
                </button>
                <div className="mh-more" ref={menuRef}>
                    <button className="mh-btn" onClick={() => setMenuOpen(!menuOpen)}>
                        <MoreVertical size={24} />
                    </button>
                    {menuOpen && (
                        <div className="mh-dropdown">
                            <button onClick={() => { onNew(); setMenuOpen(false); }}>
                                <Plus size={16} /> New Schedule
                            </button>
                            <button onClick={() => { onCopySpreadsheet(); setMenuOpen(false); }}>
                                <Table size={16} /> Spreadsheet Format
                            </button>
                            <button onClick={() => { onCopySimple(); setMenuOpen(false); }}>
                                <Copy size={16} /> Copy Simple
                            </button>
                            <button onClick={() => { onCopyDetailed(); setMenuOpen(false); }}>
                                <FileText size={16} /> Copy Detailed
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
