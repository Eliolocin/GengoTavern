import { useState } from 'react';
import type React from 'react';
import type { Character } from '../../types/interfaces';
import ChatDropdown from './ChatDropdown';
import HelpModal from '../shared/HelpModal';
import ApiKeyModal from '../shared/ApiKeyModal';
import PersonaModal from '../shared/PersonaModal';
import { useUserSettings } from '../../contexts/UserSettingsContext';

interface ChatHeaderProps {
  selectedCharacter: Character | null;
  onNewChat: (chatName: string, scenario: string, greeting: string, background: string) => void;
  onEditChat: (chatId: number, chatName: string, scenario: string, background: string) => void;
  onDeleteChat: (chatId: number) => void;
  onSelectChat: (chatId: number) => void;
  activeChatId: number | null;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ 
  selectedCharacter, 
  onNewChat,
  onEditChat,
  onDeleteChat,
  onSelectChat,
  activeChatId
}) => {
  const { apiKey, setApiKey, userPersona, setUserPersona, selectedModel, setSelectedModel } = useUserSettings();
  
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);

  return (
    <div className="chat-header">
      <h2>{selectedCharacter ? selectedCharacter.name : 'Select a character'}</h2>
      
      <div className="chat-header-actions">
        <button 
          className="header-action-button persona-button" 
          onClick={() => setShowPersonaModal(true)}
          title="User Persona Settings"
        >
          👤
        </button>
        <button 
          className="header-action-button api-button" 
          onClick={() => setShowApiKeyModal(true)}
          title="API Settings"
        >
          🔑
        </button>
        <button 
          className="header-action-button help-button" 
          onClick={() => setShowHelpModal(true)}
          title="Help & Information"
        >
          ?
        </button>
      </div>
      
      {selectedCharacter && (
        <ChatDropdown
          selectedCharacter={selectedCharacter}
          activeChatId={activeChatId}
          onSelectChat={onSelectChat}
          onNewChat={onNewChat}
          onEditChat={onEditChat}
          onDeleteChat={onDeleteChat}
        />
      )}

      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
      
      {showApiKeyModal && (
        <ApiKeyModal 
          onClose={() => setShowApiKeyModal(false)}
          onSave={setApiKey}
          currentApiKey={apiKey}
          currentModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      )}
      
      {showPersonaModal && (
        <PersonaModal
          onClose={() => setShowPersonaModal(false)}
          onSave={setUserPersona}
          currentPersona={userPersona}
        />
      )}
    </div>
  );
};

export default ChatHeader;
