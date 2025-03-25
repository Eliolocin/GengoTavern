import React, { useEffect } from 'react';
import type { Character } from '../../types/interfaces';
import { setupModalBackButtonHandler } from '../../utils/modalBackButtonHandler';

interface SaveAsOptionsModalProps {
  character: Character;
  onSaveBackup: () => void;
  onSaveShare: () => void;
  onCancel: () => void;
}

const SaveAsOptionsModal: React.FC<SaveAsOptionsModalProps> = ({
  character,
  onSaveBackup,
  onSaveShare,
  onCancel
}) => {
  // Add useEffect for back button handling
  useEffect(() => {
    // Set up back button handler
    const cleanup = setupModalBackButtonHandler(onCancel);
    
    // Cleanup when component unmounts
    return cleanup;
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content save-as-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Save Character as PNG</h3>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <p>Choose how you want to save <strong>{character.name}</strong>:</p>
          
          <div className="save-options save-options-vertical">
            <div className="save-option" onClick={onSaveBackup}>
              <div className="save-option-header">
                <h4>Backup Copy</h4>
                <span className="save-option-tag">Complete</span>
              </div>
              <p>Includes all character data, chats, and backgrounds.</p>
              <p className="save-option-note">Best for personal backups.</p>
            </div>
            
            <div className="save-option" onClick={onSaveShare}>
              <div className="save-option-header">
                <h4>Share Copy</h4>
                <span className="save-option-tag">Privacy-Safe</span>
              </div>
              <p>Includes only character information and avatar.</p>
              <p className="save-option-note">Excludes chats and background images.</p>
              <p className="save-option-note">Best for sharing with others.</p>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="cancel-button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default SaveAsOptionsModal;
