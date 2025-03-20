import type { Character, Chat } from '../types/interfaces';

/**
 * Saves a chat as a JSON file via browser download
 * This is used when the "Export" button is pressed in the chat dropdown
 */
export async function saveChatAsJson(character: Character, chat: Chat): Promise<void> {
  try {
    // Create a simplified object with just the chat data and some context
    const exportData = {
      characterName: character.name,
      characterId: character.id,
      chatName: chat.name || 'Unnamed Chat',
      chatId: chat.id,
      scenario: chat.scenario || '',
      background: chat.background || '',
      messages: chat.messages,
      // Include deletedMessages if they exist
      deletedMessages: chat.deletedMessages || [],
      lastActivity: chat.lastActivity,
      // Include any other chat properties that might be useful
      pinned: chat.pinned,
      tags: chat.tags,
      settings: chat.settings,
      exportDate: new Date().toISOString(),
    };

    // Convert to pretty-printed JSON
    const jsonData = JSON.stringify(exportData, null, 2);
    
    // Create a blob from the JSON data
    const blob = new Blob([jsonData], { type: 'application/json' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a link to download the file
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name} - ${chat.name || 'Chat'}.json`;
    
    // Append to the body, click, and remove
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Release the blob URL
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error saving chat as JSON:', error);
    throw new Error(`Failed to save chat: ${error}`);
  }
}
