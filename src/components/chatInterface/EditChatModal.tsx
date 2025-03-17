import React, { useState, useEffect } from 'react';
import type { Chat } from '../../types/interfaces';

interface EditChatModalProps {
  chat: Chat;
  onSave: (chatName: string, scenario: string, background: string) => void;
  onCancel: () => void;
}

const EditChatModal: React.FC<EditChatModalProps> = ({ chat, onSave, onCancel }) => {
  const [chatName, setChatName] = useState(chat.name || '');
  const [scenario, setScenario] = useState(chat.scenario || '');
  const [background, setBackground] = useState(chat.background || '');
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(chat.background || null);
  const [removeBackground, setRemoveBackground] = useState(false);

  // Focus the name input when the modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      const nameInput = document.getElementById('edit-chat-name');
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
      setRemoveBackground(false);
    }
  };

  const handleRemoveBackground = () => {
    setBackground('');
    setBackgroundPreview(null);
    setRemoveBackground(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // If removeBackground is true, explicitly set background to empty string
    const finalBackground = removeBackground ? '' : background;
    onSave(chatName || `Chat ${chat.id}`, scenario, finalBackground);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content edit-chat-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit Chat</h3>

        <form onSubmit={handleSubmit} className="edit-chat-form">
          <div className="form-group">
            <label htmlFor="edit-chat-name">Chat Name:</label>
            <input
              id="edit-chat-name"
              type="text"
              value={chatName}
              onChange={(e) => setChatName(e.target.value)}
              placeholder={`Chat ${chat.id}`}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-chat-scenario">Scenario:</label>
            <textarea
              id="edit-chat-scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="Enter scenario or context for this chat"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Background Image: <span className="default-note">(Optional)</span></label>
            {backgroundPreview && !removeBackground && (
              <div className="background-preview-container">
                <img 
                  src={backgroundPreview} 
                  alt="Background Preview" 
                  className="background-preview"
                />
                <button 
                  type="button" 
                  className="remove-background-button"
                  onClick={handleRemoveBackground}
                >
                  Remove Background
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleBackgroundUpload}
              className="background-upload"
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

export default EditChatModal;
