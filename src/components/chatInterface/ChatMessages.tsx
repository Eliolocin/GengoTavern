import { useRef, useEffect, useState } from 'react';
import type { FC } from 'react';
import type { Message } from '../../types/interfaces';
import EditMessageModal from './EditMessageModal';
import DeleteConfirmationModal from '../shared/DeleteConfirmationModal';
import MarkdownRenderer from '../shared/MarkdownRenderer';
import { useUserSettings } from '../../contexts/UserSettingsContext';
import { replaceNamePlaceholders } from '../../utils/promptBuilder';

interface ChatMessagesProps {
  messages: Message[];
  characterImage?: string;
  characterName?: string;
  background?: string;
  onRegenerateMessage?: (messageId: number) => void;
  onContinueMessage?: (messageId: number) => void; // Keep this prop for future use
  onDeleteErrorMessage?: (messageId: number) => void;
  onEditMessage?: (messageId: number, newText: string) => void;
  onDeleteMessage?: (messageId: number) => void;
}

const ChatMessages: FC<ChatMessagesProps> = ({
  messages,
  characterImage,
  characterName = "Character",
  // @ts-ignore - background will be used in future implementation
  background,
  onRegenerateMessage,
  // @ts-ignore - onContinueMessage will be used in future implementation
  onContinueMessage, // Keep this prop for future use
  onDeleteErrorMessage,
  onEditMessage,
  onDeleteMessage
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [deletingMessage, setDeletingMessage] = useState<Message | null>(null);
  const { userPersona } = useUserSettings();
  
  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Find the last character message
  const lastCharacterMessageIndex = [...messages]
    .reverse()
    .findIndex(msg => msg.sender === 'character' && !msg.isGenerating);
    
  // Convert back to normal index (or -1 if not found)
  const lastCharacterMessageId = lastCharacterMessageIndex !== -1 
    ? messages[messages.length - 1 - lastCharacterMessageIndex].id 
    : -1;

  const handleStartEditing = (message: Message) => {
    setEditingMessage(message);
  };

  const handleSaveEdit = (newText: string) => {
    if (editingMessage && onEditMessage) {
      onEditMessage(editingMessage.id, newText);
      setEditingMessage(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleStartDeleting = (message: Message) => {
    setDeletingMessage(message);
  };

  const handleConfirmDelete = () => {
    if (deletingMessage && onDeleteMessage) {
      onDeleteMessage(deletingMessage.id);
      setDeletingMessage(null);
    }
  };

  const handleCancelDelete = () => {
    setDeletingMessage(null);
  };
  
  return (
    <div className="chat-messages">
      {editingMessage && (
        <EditMessageModal
          message={editingMessage.text}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
          sender={editingMessage.sender}
        />
      )}
      
      {deletingMessage && (
        <DeleteConfirmationModal
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          title="Delete Message"
          message={`Are you sure you want to delete this message? This action cannot be undone.`}
        />
      )}
      
      {messages.length === 0 ? (
        <div className="empty-chat">No messages yet. Start a conversation!</div>
      ) : (
        messages.map((message) => {
          // Special rendering for system error messages
          if (message.sender === 'system' && message.isError) {
            return (
              <div key={message.id} className="system-message error-message">
                <div className="message-content">
                  <div className="message-sender">Error</div>
                  <div className="message-text">{message.text}</div>
                  <button 
                    type="button" 
                    className="message-action delete-button error-delete" 
                    title="Delete error message"
                    onClick={() => onDeleteErrorMessage && onDeleteErrorMessage(message.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          }
          
          // Special rendering for system messages (including scenarios)
          if (message.sender === 'system' && !message.isError) {
            // Replace placeholder tokens in scenario messages for display
            const displayText = characterName && userPersona
              ? replaceNamePlaceholders(message.text, characterName, userPersona.name)
              : message.text;
              
            return (
              <div key={message.id} className="system-message">
                <div className="message-content">
                  <div className="message-sender">Scenario</div>
                  <div className="message-text">{displayText}</div>
                </div>
              </div>
            );
          }
          
          // Regular user/character message rendering
          return (
            <div 
              key={message.id} 
              className={`message ${message.sender === 'user' ? 'user-message' : 'character-message'}`}
            >
              {message.sender === 'character' && characterImage && (
                <div className="character-avatar-container">
                  <img 
                    src={characterImage} 
                    alt="Character" 
                    className="message-avatar" 
                  />
                </div>
              )}
              <div className="message-content">
                <div className="message-sender">
                  {message.sender === 'user' ? userPersona.name : characterName}
                </div>
                <div className="message-text">
                  {message.isGenerating ? '...' : (
                    <MarkdownRenderer 
                      content={
                        // Replace any remaining placeholders in message text
                        characterName && userPersona
                          ? replaceNamePlaceholders(message.text, characterName, userPersona.name)
                          : message.text
                      } 
                    />
                  )}
                </div>
                <div className="message-timestamp">{formatTimestamp(message.timestamp)}</div>
                {message.editHistory && message.editHistory.length > 0 && (
                  <div className="edit-indicator">(edited)</div>
                )}
              </div>
              <div className="message-actions visible">
                {message.sender === 'character' && message.id === lastCharacterMessageId && !message.isGenerating && (
                  <>
                    {onRegenerateMessage && (
                      <button 
                        type="button" 
                        className="message-action reroll-button" 
                        title="Regenerate response"
                        onClick={() => onRegenerateMessage(message.id)}
                      >
                        ↻
                      </button>
                    )}
                    {/* Continue button hidden but keeping functionality intact for future use
                    {onContinueMessage && (
                      <button 
                        type="button" 
                        className="message-action continue-button" 
                        title="Continue response"
                        onClick={() => onContinueMessage(message.id)}
                      >
                        ⋯
                      </button>
                    )}
                    */}
                  </>
                )}
                <button 
                  type="button" 
                  className="message-action edit-button" 
                  title="Edit message"
                  onClick={() => handleStartEditing(message)}
                  disabled={message.isGenerating}
                >
                  ✎
                </button>
                <button 
                  type="button" 
                  className="message-action delete-button" 
                  title="Delete message"
                  onClick={() => handleStartDeleting(message)}
                  disabled={message.isGenerating}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;
