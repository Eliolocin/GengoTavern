import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Character, Chat, DialoguePair } from '../types/interfaces';
import {
  isFileSystemAccessSupported, 
  loadAllCharacters, 
  deleteCharacterFile, 
  saveCharacterToDisk
} from '../utils/fileSystem';
import { extractCharacterFromPng, savePngAsBrowserDownload } from '../utils/pngMetadata';
import { saveCharacterAsJson } from '../utils/jsonExport';
import { initializeFileSystem } from '../utils/fileSystem';
import { loadAssetImage, DEFAULT_PLACEHOLDER } from '../utils/imageUtils';

// Default placeholder image as base64
const placeholderImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

interface CharacterContextValue {
  characters: Character[];
  selectedCharacter: Character | null;
  isLoading: boolean;
  error: string | null;
  createNewCharacter: () => Promise<Character>;
  selectCharacter: (id: number) => void;
  updateCharacter: (id: number, field: string, value: any, keepActiveChat?: boolean) => Promise<void>;
  deleteCharacter: (id: number) => Promise<boolean>;
  saveCharacter: (character: Character) => Promise<void>;
  importCharacter: () => Promise<Character | null>;
  exportCharacterAsPng: (character: Character) => Promise<void>;
  exportCharacterAsJson: (character: Character) => Promise<void>;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

export const useCharacters = () => {
  const context = useContext(CharacterContext);
  
  if (context === null) {
    throw new Error('useCharacters must be used within a CharacterProvider');
  }
  
  return context;
};

export const CharacterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [fsSupported] = useState(isFileSystemAccessSupported());

  // Load characters on mount
  useEffect(() => {
    async function loadCharacters() {
      try {
        setIsLoading(true);
        
        if (!fsSupported) {
          setError('Your browser does not support the required file system features. Please use a Chromium-based browser like Chrome or Edge.');
          setIsLoading(false);
          return;
        }
        
        // Initialize file system and load characters
        await initializeFileSystem();
        const loadedCharacters = await loadAllCharacters();
        
        setCharacters(loadedCharacters);
        if (loadedCharacters.length > 0) {
          setSelectedCharacter(loadedCharacters[0]);
        }
      } catch (err) {
        // Only set error if it's actually a critical failure
        if (characters.length === 0) {
          setError('Failed to load characters');
          console.error('Critical error loading characters:', err);
        } else {
          console.warn('Non-critical error during character loading:', err);
        }
      }
      setIsLoading(false);
    }
    
    loadCharacters();
  }, [fsSupported]);

  // Save a character to disk
  const saveCharacterInternal = useCallback(async (character: Character) => {
    if (savingInProgress) {
      console.log('Save already in progress, waiting...');
      return false;
    }
    
    setSavingInProgress(true);
    try {
      // Ensure character has all required fields before saving
      if (!character.name) character.name = "Unnamed Character";
      
      // Save to disk
      await saveCharacterToDisk(character, character.originalFilename);
      return true;
    } catch (err) {
      console.error('Error saving character:', err);
      throw new Error(`Failed to save character: ${err}`);
    } finally {
      setSavingInProgress(false);
    }
  }, [savingInProgress]);

  // Create a new character
  const createNewCharacter = useCallback(async () => {
    // Get a placeholder image from assets folder for a new character
    try {
      // Load the placeholder image
      const imageUrl = await loadAssetImage('/assets/placeholder.png');
      
      // Create a new character with the placeholder image
      const newCharacter: Character = {
        id: Date.now(),
        name: `New Character ${characters.length + 1}`,
        image: imageUrl,
        description: '',
        chats: [] // No default chat is created
      };
      
      // Update state first for immediate UI feedback
      const newCharacters = [...characters, newCharacter];
      setCharacters(newCharacters);
      setSelectedCharacter(newCharacter);
      
      // Save to disk
      await saveCharacterInternal(newCharacter);
      
      return newCharacter;
    } catch (err) {
      console.error('Failed to create new character:', err);
      
      // Fallback to default placeholder if asset loading fails
      const newCharacter: Character = {
        id: Date.now(),
        name: `New Character ${characters.length + 1}`,
        image: DEFAULT_PLACEHOLDER,
        description: '',
        chats: []
      };
      
      // Update state first for immediate UI feedback
      const newCharacters = [...characters, newCharacter];
      setCharacters(newCharacters);
      setSelectedCharacter(newCharacter);
      
      // Save to disk
      await saveCharacterInternal(newCharacter);
      
      return newCharacter;
    }
  }, [characters, saveCharacterInternal]);

  // Select a character by ID
  const selectCharacter = useCallback((id: number) => {
    const character = characters.find(c => c.id === id);
    if (character) {
      // Ensure character always has a chats array
      if (!character.chats) {
        character.chats = [];
      }
      setSelectedCharacter(character);
    }
  }, [characters]);

  // Update a character's field
  const updateCharacter = useCallback(async (
    id: number, 
    field: string, 
    value: string | DialoguePair[] | Chat[] | any,
    keepActiveChat: boolean = false // Add parameter to control chat switching
  ) => {
    try {
      const characterIndex = characters.findIndex(c => c.id === id);
      if (characterIndex === -1) return;

      const updatedCharacter = {
        ...characters[characterIndex],
        [field]: value
      };

      // Update the characters array
      const newCharacters = [...characters];
      newCharacters[characterIndex] = updatedCharacter;
      setCharacters(newCharacters);
      
      // Handle selected character update
      if (keepActiveChat) {
        // If this is the selected character, update but keep current active chat
        if (selectedCharacter?.id === id) {
          setSelectedCharacter(updatedCharacter);
        }
      } else {
        // Standard behavior - fully update selected character
        if (selectedCharacter?.id === id) {
          setSelectedCharacter(updatedCharacter);
        }
      }
      
      // Then save to disk in the background
      saveCharacterInternal(updatedCharacter).catch(err => {
        console.error('Error saving character:', err);
        // Don't show errors during background saves to avoid flooding
        // the user with error messages for every keypress
      });
    } catch (err) {
      console.error(`Error updating character:`, err);
    }
  }, [characters, selectedCharacter, saveCharacterInternal]);

  // Delete a character
  const deleteCharacter = useCallback(async (id: number) => {
    const character = characters.find(c => c.id === id);
    if (!character) return false;
    
    try {
      let success = false;
      
      if (character.originalFilename) {
        success = await deleteCharacterFile(character.originalFilename);
      } else {
        // Character hasn't been saved to disk yet
        success = true;
      }
      
      if (success) {
        const newCharacters = characters.filter(c => c.id !== id);
        setCharacters(newCharacters);
        
        // Select another character or null
        if (selectedCharacter?.id === id) {
          setSelectedCharacter(newCharacters.length > 0 ? newCharacters[0] : null);
        }
      }
      
      return success;
    } catch (err) {
      setError(`Failed to delete character: ${err}`);
      return false;
    }
  }, [characters, selectedCharacter]);

  // Save character changes
  const saveCharacter = useCallback(async (character: Character) => {
    try {
      setError(null);
      const result = await saveCharacterInternal(character);
      
      if (result) {
        // Update the character in our array
        const index = characters.findIndex(c => c.id === character.id);
        if (index !== -1) {
          const newCharacters = [...characters];
          newCharacters[index] = character;
          setCharacters(newCharacters);
          
          // Update selected character if needed
          if (selectedCharacter?.id === character.id) {
            setSelectedCharacter(character);
          }
        }
      }
    } catch (err) {
      console.error('Error saving character:', err);
      setError(`Failed to save character: ${err}`);
    }
  }, [characters, selectedCharacter, saveCharacterInternal]);

  // Explicit function for "Save as PNG" button
  const exportCharacterAsPng = useCallback(async (character: Character): Promise<void> => {
    try {
      setError(null);
      
      // Make sure we're exporting a copy to avoid any reference issues
      const characterCopy = JSON.parse(JSON.stringify(character));
      await savePngAsBrowserDownload(characterCopy);
    } catch (err) {
      console.error('Error exporting character as PNG:', err);
      setError(`Failed to export character: ${err}`);
    }
  }, []);

  // Add functionality to export character as JSON
  const exportCharacterAsJson = useCallback(async (character: Character): Promise<void> => {
    try {
      setError(null);
      
      // Make sure we're exporting a copy to avoid any reference issues
      const characterCopy = JSON.parse(JSON.stringify(character));
      await saveCharacterAsJson(characterCopy);
    } catch (err) {
      console.error('Error exporting character as JSON:', err);
      setError(`Failed to export character as JSON: ${err}`);
    }
  }, []);

  // Import a character from a PNG file
  const importCharacter = useCallback(async () => {
    try {
      setError(null);
      
      // Show file picker - only PNG files now
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.png'; // Only accept PNG files
      
      return new Promise<Character | null>((resolve) => {
        input.onchange = async (e) => {
          try {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) {
              resolve(null);
              return;
            }
            
            // Import from PNG
            const character = await extractCharacterFromPng(file);
            
            // Generate a new ID to ensure uniqueness
            character.id = Date.now();
            
            // Validate and fix character data
            const validatedCharacter = validateAndFixCharacter(character);
            
            // Complete the import
            const newCharacters = [...characters, validatedCharacter];
            setCharacters(newCharacters);
            setSelectedCharacter(validatedCharacter);
            
            // Important: Save character immediately after import
            try {
              await saveCharacterInternal(validatedCharacter);
              console.log('Character imported and saved successfully');
            } catch (err) {
              console.error('Error saving imported character:', err);
            }
            
            resolve(validatedCharacter);
          } catch (err) {
            console.error('Error importing character:', err);
            setError(`Failed to import character: ${err}`);
            resolve(null);
          }
        };
        
        input.click();
      });
    } catch (err) {
      setError(`Failed to import character: ${err}`);
      return null;
    }
  }, [characters, saveCharacterInternal]);

  /**
   * Validates and fixes character data to ensure all required fields are present
   */
  const validateAndFixCharacter = (character: Character): Character => {
    const validatedChar: Character = { ...character };
    
    // Ensure required fields exist
    if (!validatedChar.id) validatedChar.id = Date.now();
    if (!validatedChar.name) validatedChar.name = 'Unnamed Character';
    if (!validatedChar.chats) validatedChar.chats = [];
    
    // Ensure chat structure is correct
    validatedChar.chats = validatedChar.chats.map(chat => {
      // Ensure chat has ID
      if (!chat.id) chat.id = Date.now() + Math.floor(Math.random() * 1000);
      // Ensure messages array exists
      if (!chat.messages) chat.messages = [];
      return chat;
    });
    
    return validatedChar;
  };

  return (
    <CharacterContext.Provider
      value={{
        characters,
        selectedCharacter,
        isLoading,
        error,
        createNewCharacter,
        selectCharacter,
        updateCharacter,
        deleteCharacter,
        saveCharacter,
        importCharacter,
        exportCharacterAsPng,
        exportCharacterAsJson
      }}
    >
      {children}
    </CharacterContext.Provider>
  );
};