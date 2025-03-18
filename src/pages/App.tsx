import React, { useState, useEffect } from 'react';
import { isFileSystemAccessSupported, initializeFileSystem } from '../utils/fileSystem';
import '../styles/App.css';

import type { Message, Chat } from '../types/interfaces';
import { buildPrompt } from '../utils/promptBuilder';
import { callGeminiAPI, sanitizeResponse } from '../utils/geminiAPI';
import SidePanel from '../components/layout/SidePanel';
import CharacterGrid from '../components/characterSelection/CharacterGrid';
import ChatHeader from '../components/chatInterface/ChatHeader';
import ChatMessages from '../components/chatInterface/ChatMessages';
import ChatInput from '../components/chatInterface/ChatInput';
import CharacterForm from '../components/characterCustomization/CharacterForm';
import { CharacterProvider, useCharacters } from '../contexts/CharacterContext';
import { UserSettingsProvider } from '../contexts/UserSettingsContext';

// Main App Component wrapper with Providers
const App: React.FC = () => {
  useEffect(() => {
    // Initialize file system on first load if supported
    if (isFileSystemAccessSupported()) {
      initializeFileSystem().catch(err => {
        console.error('Error initializing file system:', err);
      });
    }
  }, []);

  return (
    <UserSettingsProvider>
      <CharacterProvider>
        <AppContent />
      </CharacterProvider>
    </UserSettingsProvider>
  );
};

// Internal component that uses the Character context
const AppContent: React.FC = () => {
  const {
    characters,
    selectedCharacter,
    isLoading,
    error,
    createNewCharacter,
    selectCharacter,
    updateCharacter,
    deleteCharacter,
    importCharacter
  } = useCharacters();
  
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  
  // Add safety function to handle undefined chats
  const ensureSafeCharacter = (character: any) => {
    if (!character) return null;
    
    // Create a safe copy with guaranteed chat array
    return {
      ...character,
      chats: Array.isArray(character.chats) ? character.chats : []
    };
  };
  
  // Create a safe version of the selected character
  const safeCharacter = ensureSafeCharacter(selectedCharacter);
  
  // Clear local error after 5 seconds
  useEffect(() => {
    if (localError) {
      const timer = setTimeout(() => setLocalError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [localError]);

  // Effect to handle active chat when character changes
  useEffect(() => {
    if (selectedCharacter) {
      // Use optional chaining and provide default empty array
      const chats = safeCharacter?.chats || [];
      if (chats.length > 0) {
        // Find an active chat or default to first chat
        const activeChat = chats.find((chat: Chat) => chat.isActive) || chats[0];
        
        // Only update states if they've actually changed to prevent infinite loops
        if (activeChat.id !== activeChatId) {
          setActiveChatId(activeChat.id);
        }
        
        // Use JSON comparison to check if activeChat has changed
        const activeChatChanged = !activeChat || 
          JSON.stringify(activeChat) !== JSON.stringify(activeChat);
          
        if (activeChatChanged) {
          setActiveChat(activeChat);
          setActiveMessages(activeChat.messages);
        }
      } else {
        // No chats exist for this character
        setActiveMessages([]);
        setActiveChatId(null);
        setActiveChat(null);
      }
    } else {
      setActiveMessages([]);
      setActiveChatId(null);
      setActiveChat(null);
    }
  }, [selectedCharacter]); // Remove safeCharacter from dependencies, as it causes an infinite loop

  const handleNewChat = (chatName: string, scenario: string, greeting: string, background: string) => {
    if (!safeCharacter) return;

    try {
      const newChatId = Date.now();
      const messages: Message[] = [];

      // Add system message with scenario if provided
      if (scenario) {
        messages.push({
          id: Date.now(),
          text: scenario,
          sender: 'system',
          timestamp: Date.now()
        });
      }

      // Add greeting message from character if provided
      if (greeting) {
        messages.push({
          id: Date.now() + 1,
          text: greeting,
          sender: 'character',
          timestamp: Date.now() + 1
        });
      }
      
      // Mark all existing chats as not active - use safe character's chats
      const updatedChats = (safeCharacter.chats || []).map((chat: Chat) => ({
        ...chat,
        isActive: false
      }));
      
      // Create new chat with isActive flag
      const newChat: Chat = {
        id: newChatId,
        name: chatName,
        scenario: scenario,
        background: background,
        messages: messages,
        lastActivity: Date.now(),
        isActive: true  // Mark as active
      };
      
      const updatedCharacter = {
        ...safeCharacter,
        chats: [...updatedChats, newChat]  // Add to existing chats
      };
      
      // Update character with new chats array
      updateCharacter(safeCharacter.id, 'chats', updatedCharacter.chats);
      
      // Make sure the new chat is active locally too
      setActiveChatId(newChatId);
      setActiveChat(newChat);
      setActiveMessages(messages);
    } catch (err) {
      setLocalError(`Failed to create new chat: ${err}`);
    }
  };

  const handleEditChat = (chatId: number, chatName: string, scenario: string, background: string) => {
    if (!safeCharacter) return;

    try {
      const updatedChats = (safeCharacter.chats || []).map((chat: Chat) => {
        if (chat.id === chatId) {
          // Create updated chat
          const updatedChat = {
            ...chat,
            name: chatName,
            scenario: scenario,
            background: background,
            lastActivity: Date.now()
          };

          // Find and update the scenario message (first system message)
          if (updatedChat.messages.length > 0) {
            const firstMessage = updatedChat.messages[0];
            
            if (firstMessage.sender === 'system') {
              // Update the existing scenario message text
              firstMessage.text = scenario;
            } else if (scenario) {
              // If first message isn't a system message but we have a scenario, insert one
              updatedChat.messages.unshift({
                id: Date.now(),
                text: scenario,
                sender: 'system',
                timestamp: Date.now()
              });
            }
          } else if (scenario) {
            // If no messages but scenario is provided, create scenario message
            updatedChat.messages.push({
              id: Date.now(),
              text: scenario,
              sender: 'system',
              timestamp: Date.now()
            });
          }

          return updatedChat;
        }
        return chat;
      });

      // Update the character with the updated chats
      updateCharacter(safeCharacter.id, 'chats', updatedChats, true);

      // If this is the active chat, update active messages
      if (chatId === activeChatId) {
        const chat = updatedChats.find((c: Chat) => c.id === chatId);
        if (chat) {
          setActiveMessages(chat.messages);
          setActiveChat(chat);
        }
      }
    } catch (err) {
      setLocalError(`Failed to update chat: ${err}`);
    }
  };

  const handleDeleteChat = (chatId: number) => {
    if (!safeCharacter) return;

    try {
      // Filter out the deleted chat - no restriction on deleting all chats
      const updatedChats = (safeCharacter.chats || []).filter((chat: Chat) => chat.id !== chatId);
      
      // Update character with filtered chats
      updateCharacter(safeCharacter.id, 'chats', updatedChats);
      
      // If we deleted the active chat, check if there are any chats left
      if (chatId === activeChatId) {
        if (updatedChats.length > 0) {
          // Select another chat if available
          const newActiveChat = updatedChats[0];
          setActiveChatId(newActiveChat.id);
          setActiveMessages(newActiveChat.messages);
          setActiveChat(newActiveChat);
        } else {
          // No chats left
          setActiveChatId(null);
          setActiveMessages([]);
          setActiveChat(null);
        }
      }
    } catch (err) {
      setLocalError(`Failed to delete chat: ${err}`);
    }
  };

  const handleSelectChat = (chatId: number) => {
    if (!safeCharacter) return;
    
    try {
      // Update isActive flag on all chats
      const updatedChats = (safeCharacter.chats || []).map((chat: Chat) => ({
        ...chat,
        isActive: chat.id === chatId
      }));
      
      // Find the newly active chat
      const newActiveChat = updatedChats.find((c: Chat) => c.id === chatId);
      if (!newActiveChat) return;
      
      // Update character with new active flags
      updateCharacter(safeCharacter.id, 'chats', updatedChats, true);
      
      // Update local state
      setActiveChatId(chatId);
      setActiveChat(newActiveChat);
      setActiveMessages(newActiveChat.messages);
    } catch (err) {
      setLocalError(`Failed to switch chat: ${err}`);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!safeCharacter || activeChatId === null) return;
    
    const newMessage: Message = {
      id: Date.now(),
      text,
      sender: 'user',
      timestamp: Date.now()
    };
    
    const updatedMessages = [...activeMessages, newMessage];
    
    // First update local state
    setActiveMessages(updatedMessages);
    
    // Then update in character state but keep current active chat
    // We need to wait for the chat messages to be updated properly
    await updateChatMessagesAsync(updatedMessages, false);
    
    // Add a loading/generating message
    const generatingMsgId = Date.now() + 1;
    const generatingMessage: Message = {
      id: generatingMsgId,
      text: '...',
      sender: 'character',
      timestamp: Date.now() + 1,
      isGenerating: true
    };
    
    const messagesWithGenerating = [...updatedMessages, generatingMessage];
    setActiveMessages(messagesWithGenerating);
    
    try {
      // Find the active chat AFTER it's been updated
      const activeChat = (safeCharacter.chats || []).find((chat: Chat) => chat.id === activeChatId);
      if (!activeChat) throw new Error("Chat not found");
      
      // Double-check that the user's message is in the chat
      if (!activeChat.messages.some((msg: Message) => msg.id === newMessage.id)) {
        console.warn("Ensuring user message is included in prompt");
        // If not found in the chat, manually include it in our prompt building
        activeChat.messages = [...activeChat.messages, newMessage];
      }
      
      // Build the prompt with the updated chat that includes the new message
      const { prompt, settings } = buildPrompt(safeCharacter, activeChat, 'User');
      
      // Call the API
      let response = await callGeminiAPI(prompt, settings);
      
      // Check for errors
      if (response.error) {
        let errorMessage = response.error;
        
        // Add helpful suggestions based on error type
        if (response.errorType === 'RATE_LIMIT') {
          errorMessage += ' This typically resolves within a minute.';
        } else if (response.errorType === 'API_KEY') {
          errorMessage += ' Go to API Settings to update your key.';
        } else if (response.errorType === 'BLOCKED_CONTENT') {
          errorMessage += ' Try rewording your message or adjusting the conversation.';
        } else if (response.errorType === 'MODEL_ERROR') {
          errorMessage += ' You can select a different model in API Settings.';
        }
        
        throw new Error(errorMessage);
      }
      
      // Process the response
      const sanitizedResponse = sanitizeResponse(response.text);
      
      // Create the real response message
      const responseMessage: Message = {
        id: generatingMsgId, // Replace the generating message
        text: sanitizedResponse,
        sender: 'character',
        timestamp: Date.now() + 1000
      };
      
      // Update messages without the generating placeholder
      const finalMessages = [...updatedMessages, responseMessage];
      setActiveMessages(finalMessages);
      updateChatMessages(finalMessages, false);
      
    } catch (err) {
      console.error('Message generation error:', err);
      
      // Remove the generating message
      setActiveMessages(updatedMessages);
      
      // Add error message
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      const errorMessage: Message = {
        id: Date.now() + 2,
        text: `Failed to generate response: ${errorMsg}. Please try again.`,
        sender: 'system',
        timestamp: Date.now() + 2000,
        isError: true
      };
      
      const messagesWithError = [...updatedMessages, errorMessage];
      setActiveMessages(messagesWithError);
      updateChatMessages(messagesWithError, false);
    }
  };

  const handleRegenerateMessage = async (messageId: number) => {
    if (!safeCharacter || activeChatId === null) return;
    try {
      // Find the message to regenerate
      const messageToRegenerate = activeMessages.find(msg => msg.id === messageId);
      if (!messageToRegenerate || messageToRegenerate.sender !== 'character') {
        return;
      }
      // Create a copy of the current messages
      const updatedMessages = activeMessages.map(msg => {
        if (msg.id === messageId) {
          // Save current text in regenHistory
          const currentRegenHistory = msg.regenHistory || [];
          return {
            ...msg,
            isGenerating: true, // Show loading state
            regenHistory: [...currentRegenHistory, msg.text]
          };
        }
        return msg;
      });
      // Update UI to show generating state
      setActiveMessages(updatedMessages);
      await updateChatMessagesAsync(updatedMessages, false);
      // Find the active chat after it's been updated
      const activeChat = (safeCharacter.chats || []).find((chat: Chat) => chat.id === activeChatId);
      if (!activeChat) throw new Error("Chat not found");
      // Find the last user message before the message we're regenerating
      const messageIndex = activeMessages.findIndex(msg => msg.id === messageId);
      const previousMessages = activeMessages.slice(0, messageIndex);
      const lastUserMessage = [...previousMessages].reverse().find(msg => msg.sender === 'user');
      // If we couldn't find a user message, we can't regenerate
      if (!lastUserMessage) {
        throw new Error("No user message found to base regeneration on");
      }
      // Build prompt for regeneration
      const messagesForPrompt = activeMessages.filter(msg => {
        // Include all messages up to the one being regenerated
        return msg.id !== messageId && 
          msg.timestamp <= messageToRegenerate.timestamp && 
          !msg.isError;
      });
      // Create a temporary chat object for prompt building
      const tempChat = {
        ...activeChat,
        messages: messagesForPrompt
      };
      // Build the prompt
      const { prompt, settings } = buildPrompt(safeCharacter, tempChat, 'User');
      // Call the API
      let response = await callGeminiAPI(prompt, settings);
      // Check for errors
      if (response.error) {
        throw new Error(response.error);
      }
      // Process the response
      const sanitizedResponse = sanitizeResponse(response.text);
      // Create the regenerated message
      const regeneratedMessages = activeMessages.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            text: sanitizedResponse,
            isGenerating: false,
            timestamp: Date.now()
          };
        }
        return msg;
      });
      // Update the UI and save
      setActiveMessages(regeneratedMessages);
      await updateChatMessagesAsync(regeneratedMessages, false);
    } catch (err) {
      console.error('Message regeneration error:', err);
      // Update UI to show error
      const updatedMessages = activeMessages.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            isGenerating: false, // Remove loading state
          };
        }
        return msg;
      });
      setActiveMessages(updatedMessages);
      // Add error message
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      const errorMessage: Message = {
        id: Date.now(),
        text: `Failed to regenerate response: ${errorMsg}. Please try again.`,
        sender: 'system',
        timestamp: Date.now(),
        isError: true
      };
      const messagesWithError = [...updatedMessages, errorMessage];
      setActiveMessages(messagesWithError);
      updateChatMessages(messagesWithError, false);
    }
  };

  const handleContinueMessage = async (messageId: number) => {
    if (!safeCharacter || activeChatId === null) return;
    try {
      // Find the message to continue
      const messageToContinue = activeMessages.find(msg => msg.id === messageId);
      if (!messageToContinue || messageToContinue.sender !== 'character') {
        return;
      }
      // Create a copy of the current messages
      const updatedMessages = activeMessages.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            isGenerating: true, // Show loading state
            text: msg.text + '...' // Add ellipsis to show it's continuing
          };
        }
        return msg;
      });
      // Update UI to show generating state
      setActiveMessages(updatedMessages);
      await updateChatMessagesAsync(updatedMessages, false);
      // Find the active chat after it's been updated
      const activeChat = (safeCharacter.chats || []).find((chat: Chat) => chat.id === activeChatId);
      if (!activeChat) throw new Error("Chat not found");
      // Create a custom prompt for continuation that doesn't add duplicate tags
      const messagesForPrompt = activeChat.messages.filter((msg: Message) => 
        msg.timestamp <= messageToContinue.timestamp && 
        msg.id !== messageId && 
        !msg.isError
      );
      // Create a temporary chat object for prompt building
      const tempChat = {
        ...activeChat,
        messages: messagesForPrompt
      };
      // Build the base prompt
      const { prompt: basePrompt, settings } = buildPrompt(safeCharacter, tempChat, 'User');
      // Instead of adding the message to the chat history, append it directly to the prompt
      const prompt = basePrompt + messageToContinue.text;
      // Call the API
      let response = await callGeminiAPI(prompt, settings);
      // Check for errors
      if (response.error) {
        throw new Error(response.error);
      }
      // Process the response
      const sanitizedResponse = sanitizeResponse(response.text);
      // Create the continued message by appending the new text
      const continuedMessages = activeMessages.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            text: messageToContinue.text + ' ' + sanitizedResponse,
            isGenerating: false
          };
        }
        return msg;
      });
      // Update the UI and save
      setActiveMessages(continuedMessages);
      await updateChatMessagesAsync(continuedMessages, false);
    } catch (err) {
      console.error('Message continuation error:', err);
      // Restore original message without ellipsis if there was an error
      const originalMessage = activeMessages.find(msg => msg.id === messageId);
      if (originalMessage) {
        const restoredMessages = activeMessages.map(msg => {
          if (msg.id === messageId) {
            return {
              ...originalMessage,
              isGenerating: false
            };
          }
          return msg;
        });
        setActiveMessages(restoredMessages);
      }
      // Add error message
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      const errorMessage: Message = {
        id: Date.now(),
        text: `Failed to continue response: ${errorMsg}. Please try again.`,
        sender: 'system',
        timestamp: Date.now(),
        isError: true
      };
      const messagesWithError = [...activeMessages, errorMessage];
      setActiveMessages(messagesWithError);
      updateChatMessages(messagesWithError, false);
    }
  };

  const handleDeleteErrorMessage = (messageId: number) => {
    if (!activeMessages || activeChatId === null) return;
    
    const updatedMessages = activeMessages.filter(msg => msg.id !== messageId);
    setActiveMessages(updatedMessages);
    updateChatMessages(updatedMessages, false);
  };

  const updateChatMessages = (messages: Message[], switchChat: boolean = false) => {
    if (!safeCharacter || activeChatId === null) return;
    
    try {
      const updatedChats = (safeCharacter.chats || []).map((chat: Chat) => {
        if (chat.id === activeChatId) {
          const updatedChat = { 
            ...chat, 
            messages,
            lastActivity: Date.now(),
            isActive: true  // Ensure this chat stays active
          };
          
          // Update activeChat state
          if (!switchChat) {
            setActiveChat(updatedChat);
          }
          
          return updatedChat;
        }
        return {
          ...chat,
          isActive: false  // Mark other chats as not active
        };
      });
      
      // Update character but keep current active chat
      updateCharacter(safeCharacter.id, 'chats', updatedChats, true);
    } catch (err) {
      setLocalError(`Failed to update chat: ${err}`);
    }
  };

  const updateChatMessagesAsync = async (messages: Message[], switchChat: boolean = false): Promise<void> => {
    return new Promise((resolve) => {
      if (!safeCharacter || activeChatId === null) {
        resolve();
        return;
      }
      
      try {
        const updatedChats = (safeCharacter.chats || []).map((chat: Chat) => {
          if (chat.id === activeChatId) {
            const updatedChat = { 
              ...chat, 
              messages,
              lastActivity: Date.now(),
              isActive: true  // Ensure this chat stays active
            };
            
            // Update activeChat state
            if (!switchChat) {
              setActiveChat(updatedChat);
            }
            
            return updatedChat;
          }
          return {
            ...chat,
            isActive: false  // Mark other chats as not active
          };
        });
        
        // Update character but keep current active chat
        updateCharacter(safeCharacter.id, 'chats', updatedChats, true);
        
        // Wait for a short tick to ensure state updates are processed
        setTimeout(() => {
          resolve();
        }, 10);
      } catch (err) {
        setLocalError(`Failed to update chat: ${err}`);
        resolve();
      }
    });
  };

  const handleUpdateForm = (field: string, value: any) => {
    if (!safeCharacter) return;
    
    // Update character but don't reset active chat
    updateCharacter(safeCharacter.id, field, value, true);
  };

  // Get the current background from the active chat
  const currentBackground = activeChat?.background || safeCharacter?.defaultBackground;

  if (isLoading) {
    return <div className="loading">Loading characters...</div>;
  }

  const handleEditMessage = (messageId: number, newText: string) => {
    if (!safeCharacter || activeChatId === null) return;
  
    try {
      // Find the message to edit
      const messageToEdit = activeMessages.find(msg => msg.id === messageId);
      if (!messageToEdit) return;
  
      // Create a copy of messages with the edited message
      const updatedMessages = activeMessages.map(msg => {
        if (msg.id === messageId) {
          // Store original text in editHistory
          const editHistory = msg.editHistory || [];
          return {
            ...msg,
            text: newText,
            editHistory: [...editHistory, msg.text]
          };
        }
        return msg;
      });
  
      // Update UI and save to character state
      setActiveMessages(updatedMessages);
      updateChatMessages(updatedMessages, false);
    } catch (err) {
      setLocalError(`Failed to edit message: ${err}`);
    }
  };
  
  const handleDeleteMessage = (messageId: number) => {
    if (!safeCharacter || activeChatId === null) return;
  
    try {
      // Find the message to delete
      const messageToDelete = activeMessages.find(msg => msg.id === messageId);
      if (!messageToDelete) return;
  
      // Remove the message from the active messages
      const updatedMessages = activeMessages.filter(msg => msg.id !== messageId);
  
      // Find the active chat
      const activeChat = (safeCharacter.chats || []).find((chat: Chat) => chat.id === activeChatId);
      if (!activeChat) throw new Error("Chat not found");
  
      // Prepare the updated chat with the message moved to deletedMessages
      const updatedChat = {
        ...activeChat,
        messages: updatedMessages,
        // Add to deletedMessages array or create if it doesn't exist
        deletedMessages: [
          ...(activeChat.deletedMessages || []),
          messageToDelete
        ]
      };
  
      // Update the chats in the character
      const updatedChats = (safeCharacter.chats || []).map((chat: Chat) => 
        chat.id === activeChatId ? updatedChat : chat
      );
  
      // Update character with the new chat data
      updateCharacter(safeCharacter.id, 'chats', updatedChats, true);
  
      // Update local state
      setActiveMessages(updatedMessages);
      setActiveChat(updatedChat);
    } catch (err) {
      setLocalError(`Failed to delete message: ${err}`);
    }
  };

  return (
    <div 
      className="app-container"
      style={currentBackground ? {
        backgroundImage: `url(${currentBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      } : undefined}
    >
      <div className="app-backdrop"></div>
      
      {/* Show error toast if there's an error */}
      {(error || localError) && (
        <div className="error-toast">
          {error || localError}
          <button onClick={() => setLocalError(null)}>×</button>
        </div>
      )}

      {/* Left Panel */}
      <SidePanel
        side="left"
        isCollapsed={isLeftCollapsed}
        setIsCollapsed={setIsLeftCollapsed}
      >
        <div className="character-actions">
          <button type="button" className="import-button" onClick={importCharacter}>
            Import Character
          </button>
        </div>
        <CharacterGrid
          onNewCharacter={createNewCharacter}
          onSelectCharacter={(character) => selectCharacter(character.id)}
          characters={characters}
          selectedCharacterId={safeCharacter?.id}
        />
      </SidePanel>

      {/* Center Chat Pane */}
      <main className="chat-pane">
        <ChatHeader
          selectedCharacter={safeCharacter}
          onNewChat={handleNewChat}
          onEditChat={handleEditChat}
          onDeleteChat={handleDeleteChat}
          onSelectChat={handleSelectChat}
          activeChatId={activeChatId}
        />
        
        {safeCharacter && (safeCharacter.chats || []).length === 0 ? (
          <div className="no-chats-placeholder">
            <div className="no-chats-message">
              <p>No chats yet</p>
              <button 
                className="create-chat-button"
                onClick={() => {
                  const newChatButton = document.querySelector('.chat-dropdown-button.new-button');
                  if (newChatButton) {
                    newChatButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                  }
                }}
              >
                Create a new chat <span className="plus-icon">+</span>
              </button>
            </div>
          </div>
        ) : (
          <ChatMessages 
            messages={activeMessages} 
            characterImage={safeCharacter?.image}
            characterName={safeCharacter?.name}
            background={currentBackground}
            onRegenerateMessage={handleRegenerateMessage}
            onContinueMessage={handleContinueMessage}
            onDeleteErrorMessage={handleDeleteErrorMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
          />
        )}
        
        {/* Show chat input only when there's an active chat */}
        {activeChatId !== null && (
          <ChatInput onSendMessage={handleSendMessage} />
        )}
      </main>

      {/* Right Panel */}
      <SidePanel
        side="right"
        isCollapsed={isRightCollapsed}
        setIsCollapsed={setIsRightCollapsed}
      >
        {safeCharacter ? (
          <CharacterForm
            character={safeCharacter}
            onUpdateCharacter={handleUpdateForm}
            onDeleteCharacter={deleteCharacter}
          />
        ) : (
          <div className="no-character">Please select a character</div>
        )}
      </SidePanel>
    </div>
  );
};

export default App;