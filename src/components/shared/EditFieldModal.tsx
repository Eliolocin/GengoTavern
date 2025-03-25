import React, { useState, useEffect } from 'react';
import { setupModalBackButtonHandler } from '../../utils/modalBackButtonHandler';

interface EditFieldModalProps {
  title: string;
  description: string;
  value: string;
  multiline: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
}

const EditFieldModal: React.FC<EditFieldModalProps> = ({
  title,
  description,
  value,
  multiline,
  onSave,
  onCancel,
}) => {
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // New effect for back button handling
  useEffect(() => {
    // Set up back button handler
    const cleanup = setupModalBackButtonHandler(onCancel);
    
    // Cleanup when component unmounts
    return cleanup;
  }, [onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.ctrlKey && e.key === 'Enter') {
      onSave(editValue);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="edit-field-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>
        <div className="modal-description">
          <p>{description}</p>
        </div>
        <div className="modal-content">
          {multiline ? (
            <textarea
              value={editValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              autoFocus
              className="edit-textarea"
              rows={8}
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              autoFocus
              className="edit-input"
            />
          )}
        </div>
        <div className="modal-footer">
          <button className="cancel-button" onClick={onCancel}>Cancel</button>
          <button className="save-button" onClick={() => onSave(editValue)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditFieldModal;
