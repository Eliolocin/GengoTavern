import React, { useState, useRef, useEffect } from 'react';
import type { Character } from '../../types/interfaces';
import EditChatModal from './EditChatModal';
import NewChatModal from './NewChatModal';
import DeleteConfirmationModal from '../shared/DeleteConfirmationModal';
import { saveChatAsJson } from '../../utils/chatExport';

interface ChatDropdownProps {
  selectedCharacter: Character | null;
  activeChatId: number | null;
  onSelectChat: (chatId: number) => void;
  onNewChat: (chatName: string, scenario: string, greeting: string, background: string) => void;
  onEditChat: (chatId: number, chatName: string, scenario: string, background: string) => void;
  onDeleteChat: (chatId: number) => void;
}

const ChatDropdown: React.FC<ChatDropdownProps> = ({
  selectedCharacter,
  activeChatId,
  onSelectChat,
  onNewChat,
  onEditChat,
  onDeleteChat
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Find active chat
  const activeChat = selectedCharacter?.chats.find(chat => chat.id === activeChatId) || null;
  const hasNoChats = !selectedCharacter?.chats.length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    if (hasNoChats) {
      // If there are no chats, clicking the dropdown should open the new chat modal directly
      setShowNewModal(true);
    } else {
      setIsOpen(!isOpen);
    }
  };

  const handleSelectChat = (chatId: number) => {
    onSelectChat(chatId);
    setIsOpen(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from toggling
    if (activeChatId !== null) {
      setShowEditModal(true);
    }
  };

  const handleNewClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from toggling
    setShowNewModal(true);
  };

  const handleExportClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from toggling
    if (selectedCharacter && activeChat) {
      try {
        saveChatAsJson(selectedCharacter, activeChat);
      } catch (error) {
        console.error('Failed to export chat:', error);
      }
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from toggling
    if (activeChatId !== null) {
      setShowDeleteModal(true);
    }
  };

  const handleEditSubmit = (chatName: string, scenario: string, background: string) => {
    if (activeChatId !== null) {
      onEditChat(activeChatId, chatName, scenario, background);
      setShowEditModal(false);
    }
  };

  const handleNewSubmit = (chatName: string, scenario: string, greeting: string, background: string) => {
    onNewChat(chatName, scenario, greeting, background);
    setShowNewModal(false);
  };

  const handleDeleteConfirm = () => {
    if (activeChatId !== null) {
      onDeleteChat(activeChatId);
      setShowDeleteModal(false);
    }
  };

  if (!selectedCharacter) {
    return <div className="chat-dropdown-placeholder">No character selected</div>;
  }

  // Determine the dropdown title text
  const dropdownTitle = hasNoChats 
    ? "Create New Chat" 
    : (activeChat?.name || "Select a chat");

  return (
    <div className="chat-dropdown-container" ref={dropdownRef}>
      <div className={`chat-dropdown-header ${hasNoChats ? 'no-chats' : ''}`} onClick={toggleDropdown}>
        <span className="chat-dropdown-title">
          {dropdownTitle}
        </span>
        <div className="chat-dropdown-icons">
        <button 
            type="button" 
            className="chat-dropdown-button new-button"
            onClick={handleNewClick}
            title="New chat"
          >
            +
          </button>
          <button 
            type="button" 
            className="chat-dropdown-button edit-button"
            onClick={handleEditClick}
            title="Edit chat"
            disabled={!activeChatId || hasNoChats}
          >
            ✎
          </button>
          <button 
            type="button" 
            className="chat-dropdown-button export-button"
            onClick={handleExportClick}
            title="Export chat as JSON"
            disabled={!activeChatId || hasNoChats}
          >
            ⏏
          </button>
          
          
          <button 
            type="button" 
            className="chat-dropdown-button delete-button"
            onClick={handleDeleteClick}
            title="Delete chat"
            disabled={!activeChatId || hasNoChats}
          >
            ×
          </button>
          {!hasNoChats && <span className="chat-dropdown-arrow">{isOpen ? '▲' : '▼'}</span>}
        </div>
      </div>

      {isOpen && selectedCharacter.chats.length > 0 && (
        <div className="chat-dropdown-list">
          {selectedCharacter.chats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-dropdown-item ${chat.id === activeChatId ? 'active' : ''}`}
              onClick={() => handleSelectChat(chat.id)}
            >
              {chat.name || `Chat ${chat.id}`}
            </div>
          ))}
        </div>
      )}

      {showEditModal && activeChat && (
        <EditChatModal
          chat={activeChat}
          onSave={handleEditSubmit}
          onCancel={() => setShowEditModal(false)}
        />
      )}

      {showNewModal && (
        <NewChatModal
          character={selectedCharacter}
          onSave={handleNewSubmit}
          onCancel={() => setShowNewModal(false)}
        />
      )}

      {showDeleteModal && activeChat && (
        <DeleteConfirmationModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteModal(false)}
          title="Delete Chat"
          message={`Are you sure you want to delete the chat "${activeChat.name || `Chat ${activeChat.id}`}"? This action cannot be undone.`}
        />
      )}
    </div>
  );
};

export default ChatDropdown;
