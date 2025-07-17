import type { Character, Chat, Message } from '../types/interfaces';

/**
 * Determines if a character is "simple" - has no sample dialogues or only empty sample dialogues
 * @param character The character to check
 * @returns boolean True if the character has no meaningful sample dialogues
 */
function isSimpleCharacter(character: Character): boolean {
  // If no sample dialogues array or empty array, it's a simple character
  if (!character.sampleDialogues || character.sampleDialogues.length === 0) {
    return true;
  }
  
  // Check if all dialogue pairs are empty (both user and character parts)
  return character.sampleDialogues.every(
    dialogue => (!dialogue.user || dialogue.user.trim() === '') && 
                (!dialogue.character || dialogue.character.trim() === '')
  );
}

/**
 * Sorts messages by timestamp in ascending order
 * @param messages The messages to sort
 * @returns Sorted array of messages
 */
function sortMessagesByTimestamp(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => a.timestamp - b.timestamp);
}

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
      characterDescription: character.description || '',
      characterSampleDialogues: character.sampleDialogues || [],
      chatName: chat.name || 'Unnamed Chat',
      chatId: chat.id,
      scenario: chat.scenario || '',
      //background: chat.background || '',
      messages: sortMessagesByTimestamp(chat.messages),
      // Include deletedMessages if they exist, also sorted
      deletedMessages: chat.deletedMessages ? sortMessagesByTimestamp(chat.deletedMessages) : [],
      lastActivity: chat.lastActivity,
      // Include any other chat properties that might be useful
      pinned: chat.pinned,
      tags: chat.tags,
      settings: chat.settings,
      // Add the isSimpleCharacter flag for analytics purposes
      isSimpleCharacter: isSimpleCharacter(character),
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
