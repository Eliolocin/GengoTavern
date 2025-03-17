import type { Character } from '../types/interfaces';

/**
 * Saves a character as a downloadable JSON file
 */
export async function saveCharacterAsJson(character: Character): Promise<void> {
  try {
    // Create a clone of character data (without circular references)
    const { originalFilename, ...characterData } = character;
    
    // Convert character to formatted JSON string
    const jsonString = JSON.stringify(characterData, null, 2);
    
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
