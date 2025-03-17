import React, { useState, useEffect } from 'react';
import type { Character } from '../../types/interfaces';

interface NewChatModalProps {
  character: Character;
  onSave: (chatName: string, scenario: string, greeting: string, background: string) => void;
  onCancel: () => void;
}

const NewChatModal: React.FC<NewChatModalProps> = ({ character, onSave, onCancel }) => {
  const [chatName, setChatName] = useState('New Chat');
  const [scenario, setScenario] = useState('');
  const [greeting, setGreeting] = useState('');
  const [background, setBackground] = useState('');
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');

  // Focus the name input when the modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      const nameInput = document.getElementById('new-chat-name');
      if (nameInput) nameInput.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setBackground(imageUrl);
      setBackgroundPreview(imageUrl);
    }
  };

  const validateForm = (): boolean => {
    // Check if greeting is provided either in the form or in character defaults
    if (!greeting && !character.defaultGreeting) {
      setValidationError('Please enter a greeting or set a default greeting for the character');
      return false;
    }
    
    // Check if scenario is provided either in the form or in character defaults
    if (!scenario && !character.defaultScenario) {
      setValidationError('Please enter a scenario or set a default scenario for the character');
      return false;
    }

    // Reset validation error if all is good
    setValidationError('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      const finalScenario = scenario || character.defaultScenario || '';
      const finalGreeting = greeting || character.defaultGreeting || '';
      // Background is truly optional - no need for a default
      const finalBackground = background || '';
      
      onSave(
        chatName || 'New Chat', 
        finalScenario, 
        finalGreeting, 
        finalBackground
      );
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content new-chat-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create New Chat</h3>

        <form onSubmit={handleSubmit} className="new-chat-form">
          <div className="form-group">
            <label htmlFor="new-chat-name">Chat Name:</label>
            <input
              id="new-chat-name"
              type="text"
              value={chatName}
              onChange={(e) => setChatName(e.target.value)}
              placeholder="New Chat"
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-chat-scenario">
              Scenario: 
              {character.defaultScenario && (
                <span className="default-note">
                  (Default available)
                </span>
              )}
            </label>
            <textarea
              id="new-chat-scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder={character.defaultScenario ? "Using character default scenario" : "Enter scenario or context for this chat"}
              rows={3}
            />
            {!character.defaultScenario && (
              <div className="input-hint">
                This or the character default is required
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="new-chat-greeting">
              Greeting: 
              {character.defaultGreeting && (
                <span className="default-note">
                  (Default available)
                </span>
              )}
            </label>
            <textarea
              id="new-chat-greeting"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder={character.defaultGreeting ? "Using character default greeting" : "Enter greeting message from character"}
              rows={3}
            />
            {!character.defaultGreeting && (
              <div className="input-hint">
                This or the character default is required
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Background Image: <span className="default-note">(Optional)</span></label>
            {backgroundPreview && (
              <img 
                src={backgroundPreview} 
                alt="Background Preview" 
                className="background-preview"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleBackgroundUpload}
              className="background-upload"
            />
          </div>

          {validationError && (
            <div className="validation-error">
              {validationError}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="save-button">
              Create Chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewChatModal;
