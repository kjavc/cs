// src/components/SidebarItem.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { Edit2, Trash2, Circle, Check } from 'lucide-react';
import { useToast } from './Toast';
import { SavedSection } from '../types';
import './Sidebar.css';

interface SidebarItemProps {
  section: SavedSection;
  isActive: boolean;
  isModified: boolean;
  isOverlaid: boolean;
  onToggleOverlay: () => void;
  isCollapsed: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  formattedLecTime: string | null;
  formattedLabTime: string | null;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  section, isActive, isModified, isOverlaid, onToggleOverlay,
  isCollapsed, onLoad, onDelete, onRename,
  formattedLecTime, formattedLabTime
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [editValue, setEditValue] = useState(section.name);
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();

  const handleMouseLeave = () => {
    setIsConfirmingDelete(false);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue.trim() && editValue !== section.name) {
      onRename(editValue.trim());
      showToast("Section renamed");
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(section.name);
      setIsEditing(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConfirmingDelete) {
      onDelete();
    } else {
      setIsConfirmingDelete(true);
    }
  };

  const tooltipContent = `${section.name}
${section.lectureUnits > 0 ? `Lec: ${section.lectureDays.join('')} ${formattedLecTime}${section.lecTbaHours ? ` (+${section.lecTbaHours} TBA)` : ''}` : ''}
${section.labUnits > 0 ? `Lab: ${section.labDays.join('')} ${formattedLabTime}${section.labTbaHours ? ` (+${section.labTbaHours} TBA)` : ''}` : ''}`;

  return (
    <Reorder.Item
      value={section}
      id={section.id}
      dragListener={isCollapsed}
      dragControls={dragControls}
      className={`sidebar-item ${isActive ? 'active' : ''} ${isModified ? 'modified' : ''}`}
      onClick={() => !isEditing && onLoad()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onLoad();
        }
      }}
      onMouseLeave={handleMouseLeave}
      layout="position"
      whileDrag={{ scale: 1.05, boxShadow: "0 8px 20px rgba(0,0,0,0.2)" }}
      transition={{ duration: 0.2 }}
      title={isCollapsed ? tooltipContent : ''}
    >
      <div className="sidebar-item-controls">
        {!isEditing && (
          <button
            className={`sidebar-checkbox ${isOverlaid ? 'checked' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleOverlay(); }}
            title="Include in multi-view"
            aria-checked={isOverlaid}
            role="checkbox"
          >
            {isOverlaid && <Check size={10} strokeWidth={4} />}
          </button>
        )}

        {!isEditing && !isCollapsed && (
          <div
            className="drag-handle"
            onPointerDown={(e) => dragControls.start(e)}
            aria-hidden="true"
          >
            ⠿
          </div>
        )}
      </div>

      <div className="sidebar-item-info">
        <div className="sidebar-item-top">
          {isEditing ? (
            <input
              ref={inputRef}
              className="rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="name-wrapper">
              <span className="section-name">
                {isCollapsed ? section.name.replace('Section', 'Sec') : section.name}
                {isModified && <Circle size={6} fill="currentColor" style={{ marginLeft: '6px', opacity: 0.8 }} />}
              </span>
              {!isCollapsed && (
                <button
                  className="rename-btn"
                  onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                  title="Rename"
                >
                  <Edit2 size={12} />
                </button>
              )}
            </div>
          )}

          {!isCollapsed && !isEditing && (
            <span className="section-units">
              {section.fixedHours
                ? `${section.fixedHours.lec + section.fixedHours.lab}h`
                : `${(section.lectureUnits + section.labUnits).toFixed(1)}u`}
            </span>
          )}
        </div>

        {!isCollapsed && !isEditing && (
          <div className="section-meta compact">
            <span className="meta-compact">
              {section.lectureUnits > 0 && (
                <span className="meta-tag lec">Lec: {section.lectureDays.join('')} {formattedLecTime}</span>
              )}
              {section.labUnits > 0 && (
                <span className="meta-tag lab">Lab: {section.labDays.join('')} {formattedLabTime}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {!isEditing && (
        <button
          className={`delete-item-btn ${isConfirmingDelete ? 'confirming' : ''}`}
          onClick={handleDeleteClick}
          title={isConfirmingDelete ? "Confirm Delete" : "Delete Section"}
        >
          {isConfirmingDelete ? <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--danger-color)' }}>CONFIRM?</span> : <Trash2 size={16} />}
        </button>
      )}
    </Reorder.Item>
  );
};

export default React.memo(SidebarItem);
