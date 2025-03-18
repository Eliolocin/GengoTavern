import React, { useState, useEffect } from 'react';
import DeleteConfirmationModal from '../shared/DeleteConfirmationModal';

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
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

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

  const handleResetAppData = () => {
    setShowResetConfirmation(true);
  };

  const confirmReset = () => {
    // Clear all localStorage data
    localStorage.clear();
    setShowResetConfirmation(false);
    
    // Reload the page to start fresh
    window.location.reload();
  };

  const exportAllData = () => {
    try {
      // Collect all data from localStorage
      const data: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            data[key] = JSON.parse(value);
          }
        }
      }
      
      // Create and download a JSON file
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `gengo-tavern-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data. See console for details.');
    }
  };

  const importAllData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Confirm before overwriting
        if (confirm('This will replace all your current data. Continue?')) {
          // Clear existing data
          localStorage.clear();
          
          // Add imported data
          Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(key, JSON.stringify(value));
          });
          
          // Reload to apply changes
          window.location.reload();
        }
      } catch (error) {
        console.error('Failed to import data:', error);
        alert('Failed to import data. See console for details.');
      }
    };
    
    input.click();
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
        
        <div className="data-management-zone">
          <h4>Data Management</h4>
          <div className="data-buttons">
            <button 
              className="export-data-button"
              onClick={exportAllData}
              type="button"
            >
              Export All Data
            </button>
            <button 
              className="import-data-button"
              onClick={importAllData}
              type="button"
            >
              Import Data
            </button>
          </div>
          <p className="data-management-note">Export your data regularly to prevent loss.</p>
        </div>
        
        <div className="danger-zone">
          <h4>Danger Zone</h4>
          <button 
            className="reset-app-data-button"
            onClick={handleResetAppData}
            type="button"
          >
            Reset App Data
          </button>
          <p className="danger-note">This will delete all characters, chats, and settings.</p>
        </div>
        
        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>Cancel</button>
          <button className="save-button" onClick={handleSave}>Save Persona</button>
        </div>
      </div>

      {showResetConfirmation && (
        <DeleteConfirmationModal
          onConfirm={confirmReset}
          onCancel={() => setShowResetConfirmation(false)}
          characterName="all app data"
          title="Reset App Data"
          message="Are you sure you want to reset all app data? This will delete all characters, chats, and settings, and cannot be undone."
        />
      )}
    </div>
  );
};

export default PersonaModal;
