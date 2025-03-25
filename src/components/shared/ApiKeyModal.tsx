import React, { useState, useEffect } from 'react';
import { GEMINI_MODELS } from '../../contexts/UserSettingsContext';
import { setupModalBackButtonHandler } from '../../utils/modalBackButtonHandler';

interface ApiKeyModalProps {
  onClose: () => void;
  onSave: (apiKey: string) => void;
  currentApiKey: string;
  currentModel: string;
  onModelChange: (model: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ 
  onClose, 
  onSave, 
  currentApiKey, 
  currentModel,
  onModelChange
}) => {
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState(currentModel);

  // Update the useEffect in ApiKeyModal
  useEffect(() => {
    const keyInput = document.getElementById('api-key-input');
    if (keyInput) keyInput.focus();
    
    // Set up back button handler
    const cleanup = setupModalBackButtonHandler(onClose);
    
    // Cleanup when component unmounts
    return cleanup;
}, [onClose]);

  const handleSave = () => {
    // Basic validation - API keys are typically long strings
    if (apiKey.length < 10) {
      setValidationMessage('API key appears to be too short. Please check and try again.');
      return;
    }
    
    // Save both API key and model
    onSave(apiKey);
    onModelChange(selectedModel);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Function to get a friendly name for the model
  const getModelDisplayName = (modelId: string) => {
    switch(modelId) {
      case GEMINI_MODELS.FLASH_EXP:
        return "Gemini 2.0 Flash (Balanced)";
      case GEMINI_MODELS.FLASH_LITE:
        return "Gemini 2.0 Flash Lite (Faster)";
      case GEMINI_MODELS.FLASH_THINKING:
        return "Gemini 2.0 Flash Thinking (More Creative)";
      default:
        return modelId;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content api-key-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>API Settings</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="modal-description">
            Configure your Google API key and model preferences. 
            All settings are stored only on your browser and never sent to any server.
          </p>
          
          <div className="api-key-input-container">
            <label htmlFor="api-key-input">Google API Key:</label>
            <div className="secure-input-wrapper">
              <input
                id="api-key-input"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your Google Gemini API key"
                className="secure-input"
              />
              <button 
                type="button" 
                className="toggle-visibility-button"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            <div className="model-description">
                <span>GengoTavern uses Google AI to power the Chatbots, requiring an API key.</span>
            </div>
            <div className="input-hint">
                <span>Do not share this key with anyone.</span>
            </div>
          </div>
          
          <div className="model-selection-container">
            <label htmlFor="model-select">Model:</label>
            <select
              id="model-select"
              className="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              <option value={GEMINI_MODELS.FLASH_EXP}>
                {getModelDisplayName(GEMINI_MODELS.FLASH_EXP)}
              </option>
              <option value={GEMINI_MODELS.FLASH_LITE}>
                {getModelDisplayName(GEMINI_MODELS.FLASH_LITE)}
              </option>
              <option value={GEMINI_MODELS.FLASH_THINKING}>
                {getModelDisplayName(GEMINI_MODELS.FLASH_THINKING)}
              </option>
            </select>
            
            <div className="model-description">
              {selectedModel === GEMINI_MODELS.FLASH_EXP && 
                <span>Balanced model with good performance and quality</span>}
              {selectedModel === GEMINI_MODELS.FLASH_LITE && 
                <span>Faster responses with slightly reduced quality</span>}
              {selectedModel === GEMINI_MODELS.FLASH_THINKING && 
                <span>More creative responses at the cost of speed</span>}
            </div>
          </div>
          
          {validationMessage && (
            <div className="validation-error">{validationMessage}</div>
          )}
          
          <div className="info-box">
            <p><strong>How to get a Free API key:</strong></p>
            <ol>
              <li>Go to <a href="https://aistudio.google.com/prompts/new_chat" target="_blank" rel="noopener noreferrer">Google AI Studio</a></li>
              <li>Sign in with any Google account</li>
              <li>Click on "Get API Key" on the top-left</li>
              <li>Create a new API key</li>
              <li>Copy and paste the API key here</li>
            </ol>
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>Cancel</button>
          <button className="save-button" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
