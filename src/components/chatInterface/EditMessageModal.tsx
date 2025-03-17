import React, { useState, useEffect } from 'react';

interface EditMessageModalProps {
  message: string;
  onSave: (newText: string) => void;
  onCancel: () => void;
  sender: 'user' | 'character' | 'system';
}

const EditMessageModal: React.FC<EditMessageModalProps> = ({
  message,
  onSave,
  onCancel,
  sender
}) => {
  const [editedText, setEditedText] = useState(message);
  
  // Focus the textarea when the modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      const textArea = document.getElementById('edit-message-text');
      if (textArea) textArea.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editedText.trim()) {
      onSave(editedText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.ctrlKey && e.key === 'Enter') {
      if (editedText.trim()) {
        onSave(editedText);
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content edit-message-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit {sender === 'user' ? 'Your' : 'Character'} Message</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <textarea
              id="edit-message-text"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              placeholder="Enter message text..."
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="save-button">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMessageModal;
