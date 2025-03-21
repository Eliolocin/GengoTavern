import React, { useState, useEffect } from 'react';
import type { Character } from '../../types/interfaces';
import { compressImage, getDataUrlSizeInKB } from '../../utils/imageUtils';

interface NewChatModalProps {
  character: Character;
  onSave: (chatName: string, scenario: string, greeting: string, background: string) => void;
  onCancel: () => void;
}

const NewChatModal: React.FC<NewChatModalProps> = ({ character, onSave, onCancel }) => {
  const [chatName, setChatName] = useState('New Chat');
  const [scenario, setScenario] = useState(character.defaultScenario || '');
  const [greeting, setGreeting] = useState(character.defaultGreeting || '');
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

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create a FileReader to read the file as data URL
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const dataUrl = event.target?.result as string;
          
          // Compress background image
          const originalSizeKB = getDataUrlSizeInKB(dataUrl);
          
          // Only compress if the image is large
          if (originalSizeKB > 300) { // If larger than 300KB
            const compressedDataUrl = await compressImage(dataUrl, 1920, 1080, 0.7);
            const compressedSizeKB = getDataUrlSizeInKB(compressedDataUrl);
            
            console.log(`Background compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB (${Math.round((1 - compressedSizeKB/originalSizeKB) * 100)}% reduction)`);
            
            setBackground(compressedDataUrl);
            setBackgroundPreview(compressedDataUrl);
          } else {
            // Use original if it's already small
            setBackground(dataUrl);
            setBackgroundPreview(dataUrl);
          }
        } catch (error) {
          console.error('Error processing background image:', error);
          // Fallback to original image
          const dataUrl = event.target?.result as string;
          setBackground(dataUrl);
          setBackgroundPreview(dataUrl);
        }
      };
      reader.readAsDataURL(file);
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
            </label>
            <span className="default-note">
                  The scenario sets the context for this new chat. Can be in any language.
                </span>
            <textarea
              id="new-chat-scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="Enter scenario or context for this chat"
              rows={3}
            />
            {character.defaultScenario ? (
              <div className="default-filled-hint">
                Pre-filled from this character's defaults
              </div>
            ) : (
              <div className="input-hint">
                This is required
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="new-chat-greeting">
              Greeting:
            </label>
              <p className="default-note">
                The very first message sent in the chat by your Character. 
                Should be based on the Scenario for consistency, and written in the language you want your Character to speak in.
              </p>

            <textarea
              id="new-chat-greeting"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Enter greeting message from character"
              rows={3}
            />
            {character.defaultGreeting ? (
              <div className="default-filled-hint">
                Pre-filled from this character's defaults
              </div>
            ) : (
              <div className="input-hint">
                This is required
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
