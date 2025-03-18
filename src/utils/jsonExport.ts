import type { Character, Chat } from '../types/interfaces';

/**
 * Saves a character as a downloadable JSON file
 */
export async function saveCharacterAsJson(character: Character): Promise<void> {
  try {
    // Ensure character image is a data URL
    if (character.image && !character.image.startsWith('data:')) {
      // Convert to data URL if it's not already
      const imageBlob = await fetch(character.image).then(r => r.blob());
      character.image = await blobToDataUrl(imageBlob);
    }
    
    // Create a deep clone of character data (without circular references)
    // and exclude specific properties we don't want to export
    const exportCharacter = prepareCharacterForExport(character);
    
    // Convert character to formatted JSON string
    const jsonString = JSON.stringify(exportCharacter, null, 2);
    
    // Create a blob with the JSON data
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create a download link and trigger it
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `${character.name}.json`;
    a.href = url;
    a.click();
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error saving character as JSON:', error);
    throw new Error(`Failed to save character as JSON: ${error}`);
  }
}

/**
 * Convert a Blob to a data URL
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Prepares a character for export by creating a deep clone
 * and removing properties we don't want to export
 */
function prepareCharacterForExport(character: Character): any {
  // Properties to exclude from export
  const excludeProperties = ['originalFilename'];
  
  // Create a deep clone of the character
  const clone = JSON.parse(JSON.stringify(character));
  
  // Remove excluded properties
  excludeProperties.forEach(prop => {
    if (prop in clone) {
      delete clone[prop];
    }
  });
  
  // Process chats to handle backgrounds
  if (clone.chats && Array.isArray(clone.chats)) {
    clone.chats = clone.chats.map((chat: Chat) => {
      // Handle background paths
      if (chat.background && typeof chat.background === 'string' && !chat.background.startsWith('backgrounds/')) {
        // If it's not already a relative path, extract the filename
        const backgroundFilename = chat.background.split('/').pop()?.split('\\').pop();
        if (backgroundFilename) {
          chat.background = `backgrounds/${backgroundFilename}`;
        }
      }
      
      return chat;
    });
  }
  
  // Handle default background if present
  if (clone.defaultBackground && typeof clone.defaultBackground === 'string' && !clone.defaultBackground.startsWith('backgrounds/')) {
    const backgroundFilename = clone.defaultBackground.split('/').pop()?.split('\\').pop();
    if (backgroundFilename) {
      clone.defaultBackground = `backgrounds/${backgroundFilename}`;
    }
  }
  
  return clone;
}
