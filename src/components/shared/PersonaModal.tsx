import React, { useState, useEffect } from 'react';

interface PersonaProps {
  name: string;
  description: string;
}

interface PersonaModalProps {
  onClose: () => void;
  onSave: (persona: PersonaProps) => void;
  currentPersona: PersonaProps;
}

const PersonaModal: React.FC<PersonaModalProps> = ({ onClose, onSave, currentPersona }) => {
  const [name, setName] = useState(currentPersona.name);
  const [description, setDescription] = useState(currentPersona.description);

  useEffect(() => {
    const nameInput = document.getElementById('persona-name-input');
    if (nameInput) nameInput.focus();
  }, []);

  const handleSave = () => {
    // Basic validation
    if (!name.trim()) {
      setName('User');
    }
    
    onSave({
      name: name.trim() || 'User',
      description: description.trim()
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content persona-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>User Persona Settings</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="modal-description">
            Customize how you appear in chats. This information will be used when generating responses.
          </p>
          
          <div className="form-group">
            <label htmlFor="persona-name-input">Your Name:</label>
            <input
              id="persona-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your preferred name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="persona-description-input">Description (optional):</label>
            <textarea
              id="persona-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe yourself, your personality, or how you'd like to be portrayed in the chat"
              rows={4}
            />
            <div className="input-hint">
              This description will be provided to the AI to better understand who you are
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>Cancel</button>
          <button className="save-button" onClick={handleSave}>Save Persona</button>
        </div>
      </div>
    </div>
  );
};

export default PersonaModal;
