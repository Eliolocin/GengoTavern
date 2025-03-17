import { extractCharacterFromPng } from './pngMetadata';
import type { Character } from '../types/interfaces';

// Store the directory handle persistently
let charactersDirHandle: FileSystemDirectoryHandle | null = null;

/**
 * Gets a file handle for the user/characters directory,
 * creating it if it doesn't exist
 */
async function getCharactersDirHandle(): Promise<FileSystemDirectoryHandle> {
  // Return the cached handle if available
  if (charactersDirHandle) {
    return charactersDirHandle;
  }

  try {
    // Request permission to access the file system
    // @ts-ignore - FileSystemAccess API might not be recognized
    const rootHandle = await window.showDirectoryPicker({
      id: 'gengoTavernRoot',
      mode: 'readwrite',
      startIn: 'documents'
    });

    // Create user directory if needed
    let userDirHandle: FileSystemDirectoryHandle;
    try {
      userDirHandle = await rootHandle.getDirectoryHandle('user', { create: true });
    } catch (error) {
      console.error('Error accessing user directory:', error);
      throw new Error('Could not access the user directory');
    }
    
    // Create characters directory if needed
    try {
      charactersDirHandle = await userDirHandle.getDirectoryHandle('characters', { create: true });
      return charactersDirHandle;
    } catch (error) {
      console.error('Error accessing characters directory:', error);
      throw new Error('Could not access the characters directory');
    }
  } catch (error) {
    console.error('Error setting up directory:', error);
    throw new Error(`Failed to set up characters directory: ${error}`);
  }
}

/**
 * Saves a character to disk as a PNG with metadata
 */
export async function saveCharacterToDisk(
  character: Character, 
  oldFilename?: string
): Promise<void> {
  try {
    // Get directory handle
    const dirHandle = await getCharactersDirHandle();
    
    // Create filename from character name with sanitization
    const filename = `${sanitizeFilename(character.name)}.png`;
    
    // If the character was renamed, delete the old file
    if (oldFilename && oldFilename !== filename) {
      try {
        await dirHandle.removeEntry(oldFilename);
      } catch (error) {
        console.warn(`Could not delete old character file: ${oldFilename}`, error);
      }
    }
    
    // Import dynamically to avoid circular dependencies
    const { embedCharacterIntoPng } = await import('./pngMetadata');
    
    try {
      // Get the PNG data with metadata
      const pngFile = await embedCharacterIntoPng(character);
      
      // Save the file
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(pngFile);
      await writable.close();
      
      // Record that this character has been saved to disk
      console.log(`Character saved to ${filename}`);
      
      // Update originalFilename to record successful save
      character.originalFilename = filename;
    } catch (error) {
      console.error('Error writing file:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error saving character:', error);
    throw new Error(`Failed to save character: ${error}`);
  }
}

/**
 * Loads all characters from the user/characters directory
 */
export async function loadAllCharacters(): Promise<Character[]> {
  try {
    const dirHandle = await getCharactersDirHandle();
    const characters: Character[] = [];
    
    // @ts-ignore - Typescript doesn't recognize entries() yet
    for await (const [filename, fileHandle] of dirHandle.entries()) {
      if (fileHandle.kind === 'file' && filename.toLowerCase().endsWith('.png')) {
        try {
          const file = await (fileHandle as FileSystemFileHandle).getFile();
          const character = await extractCharacterFromPng(file);
          
          // Store the original filename for future reference
          character.originalFilename = filename;
          
          characters.push(character);
        } catch (error) {
          console.warn(`Error loading character ${filename}:`, error);
        }
      }
    }
    
    return characters;
  } catch (error) {
    console.error('Error loading characters:', error);
    return [];
  }
}

/**
 * Deletes a character file from disk
 */
export async function deleteCharacterFile(filename: string): Promise<boolean> {
  try {
    const dirHandle = await getCharactersDirHandle();
    await dirHandle.removeEntry(filename);
    return true;
  } catch (error) {
    console.error(`Error deleting character ${filename}:`, error);
    return false;
  }
}

/**
 * Checks if the File System Access API is available in this browser
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * Sanitize filename to be safe for file systems
 */
function sanitizeFilename(name: string): string {
  // Replace invalid characters with underscores
  return name.replace(/[\\/:*?"<>|]/g, '_')
    // Trim spaces and periods at start/end
    .trim()
    .replace(/^\.+|\.+$/g, '')
    // Default name if empty
    || 'unnamed_character';
}

/**
 * Fallback method for browsers without File System Access API
 * Uses LocalStorage to simulate a file system
 */
export class BrowserFsStorage {
  async saveCharacter(character: Character): Promise<void> {
    console.warn('File System Access API not supported in this browser. Using fallback storage.');
    
    try {
      const serialized = JSON.stringify(character);
      localStorage.setItem(`character_${character.id}`, serialized);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }
  
  async loadAllCharacters(): Promise<Character[]> {
    console.warn('File System Access API not supported in this browser. Using fallback storage.');
    
    const characters: Character[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('character_')) {
          const data = localStorage.getItem(key);
          if (data) {
            characters.push(JSON.parse(data) as Character);
          }
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    
    return characters;
  }
  
  async deleteCharacter(id: number): Promise<boolean> {
    try {
      localStorage.removeItem(`character_${id}`);
      return true;
    } catch (error) {
      console.error('Error deleting from localStorage:', error);
      return false;
    }
  }
}
