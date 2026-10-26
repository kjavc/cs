// src/components/ConfirmModal.tsx
import React from 'react';
import './ConfirmModal.css';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  title, message, onConfirm, onCancel, 
  confirmText = "Save", cancelText = "Discard" 
}) => {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content confirm-modal-content" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button 
            className="secondary-button cancel-btn" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button className="primary-button" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
