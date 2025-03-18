import { extractCharacterFromPng } from './pngMetadata';
import type { Character } from '../types/interfaces';

// Store the directory handle persistently
let charactersDirHandle: FileSystemDirectoryHandle | null = null;
let backgroundsDirHandle: FileSystemDirectoryHandle | null = null;
let userDirHandle: FileSystemDirectoryHandle | null = null;
let rootDirHandle: FileSystemDirectoryHandle | null = null;

// Default settings structure
const DEFAULT_SETTINGS = {
  persona: {
    name: 'User',
    description: '',
  },
  model: 'gemini-1.0-pro',
  apiKey: '',
};

/**
 * Initialize the file system structure
 * Called on app startup to ensure directories exist
 */
export async function initializeFileSystem(): Promise<boolean> {
  try {
    // Get or create the root directory using origin private file system
    // @ts-ignore - FileSystemAccess API might not be fully typed
    rootDirHandle = await navigator.storage.getDirectory();
    
    // Create the main user directory structure
    userDirHandle = await rootDirHandle.getDirectoryHandle('user', { create: true });
    charactersDirHandle = await userDirHandle.getDirectoryHandle('characters', { create: true });
    backgroundsDirHandle = await userDirHandle.getDirectoryHandle('backgrounds', { create: true });
    
    // Create settings.json if it doesn't exist
    await ensureSettingsFileExists();
    
    return true;
  } catch (error) {
    console.error('Error initializing file system:', error);
    return false;
  }
}

/**
 * Ensure settings.json exists, create with defaults if not
 */
async function ensureSettingsFileExists(): Promise<void> {
  if (!userDirHandle) return;
  
  try {
    // Try to get the settings file
    try {
      await userDirHandle.getFileHandle('settings.json');
      // File exists, no need to create it
    } catch (error) {
      // File doesn't exist, create it with default settings
      const fileHandle = await userDirHandle.getFileHandle('settings.json', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(DEFAULT_SETTINGS, null, 2));
      await writable.close();
    }
  } catch (error) {
    console.error('Error ensuring settings file exists:', error);
  }
}

/**
 * Load user settings from settings.json
 */
export async function loadUserSettings(): Promise<any> {
  if (!userDirHandle) {
    await initializeFileSystem();
  }
  
  if (!userDirHandle) {
    return DEFAULT_SETTINGS;
  }
  
  try {
    // Get the settings file
    const fileHandle = await userDirHandle.getFileHandle('settings.json');
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Error loading user settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save user settings to settings.json
 */
export async function saveUserSettings(settings: any): Promise<boolean> {
  if (!userDirHandle) {
    await initializeFileSystem();
  }
  
  if (!userDirHandle) {
    return false;
  }
  
  try {
    const fileHandle = await userDirHandle.getFileHandle('settings.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(settings, null, 2));
    await writable.close();
    return true;
  } catch (error) {
    console.error('Error saving user settings:', error);
    return false;
  }
}

/**
 * Gets a file handle for the user/characters directory,
 * creating it if it doesn't exist
 */
async function getCharactersDirHandle(): Promise<FileSystemDirectoryHandle> {
  // Return the cached handle if available
  if (charactersDirHandle) {
    return charactersDirHandle;
  }

  // Initialize file system if not already done
  const success = await initializeFileSystem();
  if (!success || !charactersDirHandle) {
    throw new Error('Could not access the characters directory');
  }
  
  return charactersDirHandle;
}

/**
 * Gets a file handle for the user/backgrounds directory,
 * creating it if it doesn't exist
 */
export async function getBackgroundsDirHandle(): Promise<FileSystemDirectoryHandle> {
  // Return the cached handle if available
  if (backgroundsDirHandle) {
    return backgroundsDirHandle;
  }

  // Initialize file system if not already done
  const success = await initializeFileSystem();
  if (!success || !backgroundsDirHandle) {
    throw new Error('Could not access the backgrounds directory');
  }
  
  return backgroundsDirHandle;
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
      // Get the PNG data with metadata - properly cloned to avoid issues
      const characterForSaving = JSON.parse(JSON.stringify(character));
      
      // Convert background paths to be relative to ./user/backgrounds
      if (characterForSaving.chats && Array.isArray(characterForSaving.chats)) {
        characterForSaving.chats = characterForSaving.chats.map((chat: any) => {
          if (chat.background && typeof chat.background === 'string') {
            // Extract just the filename from the background path or URL
            const backgroundFilename = chat.background.split('/').pop().split('\\').pop();
            if (backgroundFilename) {
              chat.background = `backgrounds/${backgroundFilename}`;
            }
          }
          return chat;
        });
      }
      
      // Same for default background if present
      if (characterForSaving.defaultBackground && typeof characterForSaving.defaultBackground === 'string') {
        const backgroundFilename = characterForSaving.defaultBackground.split('/').pop().split('\\').pop();
        if (backgroundFilename) {
          characterForSaving.defaultBackground = `backgrounds/${backgroundFilename}`;
        }
      }
      
      const pngFile = await embedCharacterIntoPng(characterForSaving);
      
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
 * Save a background image to the backgrounds directory
 */
export async function saveBackgroundImage(file: File): Promise<string> {
  try {
    const dirHandle = await getBackgroundsDirHandle();
    
    // Create sanitized filename
    const filename = sanitizeFilename(file.name);
    
    // Save the file
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    
    // Return the relative path to the background
    return `backgrounds/${filename}`;
  } catch (error) {
    console.error('Error saving background image:', error);
    throw new Error(`Failed to save background image: ${error}`);
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
          
          // Fix background paths if they're relative
          if (character.chats && Array.isArray(character.chats)) {
            character.chats = character.chats.map(chat => {
              if (chat.background && typeof chat.background === 'string' && chat.background.startsWith('backgrounds/')) {
                // Get the blob URL for the background
                getBackgroundUrl(chat.background.split('/').pop() || '')
                  .then(url => {
                    if (url) chat.background = url;
                  })
                  .catch(err => {
                    console.warn(`Could not load background: ${err}`);
                  });
              }
              return chat;
            });
          }
          
          // Fix default background if it's relative
          if (character.defaultBackground && 
              typeof character.defaultBackground === 'string' && 
              character.defaultBackground.startsWith('backgrounds/')) {
            getBackgroundUrl(character.defaultBackground.split('/').pop() || '')
              .then(url => {
                if (url) character.defaultBackground = url;
              })
              .catch(err => {
                console.warn(`Could not load default background: ${err}`);
              });
          }
          
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
 * Create a default character
 * @deprecated Not used anymore to prevent issues with malformed default characters
 */
function createDefaultCharacter(): Character {
  return {
    id: Date.now(),
    name: "Default Character",
    description: "This is a default character created automatically.",
    image: "/assets/placeholder.jpg", 
    chats: [],
    originalFilename: "Default_Character.png"
  };
}

/**
 * Get a background image URL from the backgrounds directory
 */
export async function getBackgroundUrl(filename: string): Promise<string | null> {
  try {
    const dirHandle = await getBackgroundsDirHandle();
    
    try {
      const fileHandle = await dirHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  } catch (error) {
    console.error('Error getting background URL:', error);
    return null;
  }
}

/**
 * List all available backgrounds in the backgrounds directory
 */
export async function listBackgrounds(): Promise<string[]> {
  try {
    const dirHandle = await getBackgroundsDirHandle();
    const backgrounds: string[] = [];
    
    // @ts-ignore - Typescript doesn't recognize entries() yet
    for await (const [filename, fileHandle] of dirHandle.entries()) {
      if (fileHandle.kind === 'file' && isImageFilename(filename)) {
        backgrounds.push(filename);
      }
    }
    
    return backgrounds;
  } catch (error) {
    console.error('Error listing backgrounds:', error);
    return [];
  }
}

/**
 * Check if a filename is an image
 */
function isImageFilename(filename: string): boolean {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
  const lowerFilename = filename.toLowerCase();
  return imageExtensions.some(ext => lowerFilename.endsWith(ext));
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
  return 'showDirectoryPicker' in window || 
         // Check for Origin Private File System
         (typeof navigator === 'object' && 
          navigator !== null && 
          'storage' in navigator &&
          'getDirectory' in (navigator as any).storage);
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
 * Get information about where the user directory is stored
 * This is useful for debugging purposes
 */
export function getUserDirectoryInfo(): string {
  if (!isFileSystemAccessSupported()) {
    return "File System Access API not supported in this browser. Please use Chrome, Edge or another Chromium-based browser.";
  }
  
  return "Your data is stored in the Origin Private File System, managed by your browser. " +
    "In Chrome, you can view it by going to chrome://web-app-internals/ and finding your site's storage." +
    "Otherwise, your data is securely stored by the browser and not directly accessible through the file system.";
}
