import React from 'react';

interface DeleteConfirmationModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  characterName?: string; // For backward compatibility
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  onConfirm,
  onCancel,
  title,
  message,
  characterName
}) => {
  // Support both new generic usage and old character-specific usage
  const displayTitle = title || "Confirm Deletion";
  const displayMessage = message || (characterName ? 
    `Are you sure you want to delete <strong>${characterName}</strong>?` : 
    "Are you sure you want to delete this item?");

  return (
    <div className="modal-overlay">
      <div className="modal-content delete-confirmation-modal">
        <h3>{displayTitle}</h3>
        <p dangerouslySetInnerHTML={{ __html: displayMessage }}></p>
        <p className="warning-text">This action cannot be undone.</p>
        
        <div className="modal-actions">
          <button 
            type="button" 
            className="cancel-button" 
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="confirm-button delete-confirm-button" 
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
