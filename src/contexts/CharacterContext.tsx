import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Character, DialoguePair, Chat } from '../types/interfaces';
import placeholderImg from '../assets/placeholder.jpg';
import {
  loadAllCharacters,
  saveCharacterToDisk,
  deleteCharacterFile,
  isFileSystemAccessSupported,
  BrowserFsStorage
} from '../utils/fileSystem';
import { savePngAsBrowserDownload } from '../utils/pngMetadata';
import { saveCharacterAsJson } from '../utils/jsonExport';

interface CharacterContextType {
  characters: Character[];
  selectedCharacter: Character | null;
  isLoading: boolean;
  error: string | null;
  createNewCharacter: () => Promise<Character>;
  selectCharacter: (id: number) => void;
  updateCharacter: (id: number, field: string, value: string | DialoguePair[] | Chat[] | any, keepActiveChat?: boolean) => Promise<void>;
  deleteCharacter: (id: number) => Promise<boolean>;
  saveCharacter: (character: Character) => Promise<void>;
  importCharacter: () => Promise<Character | null>;
  exportCharacterAsPng: (character: Character) => Promise<void>;
  exportCharacterAsJson: (character: Character) => Promise<void>;
}

const CharacterContext = createContext<CharacterContextType | null>(null);

export const useCharacters = () => {
  const context = useContext(CharacterContext);
  if (!context) {
    throw new Error('useCharacters must be used within a CharacterProvider');
  }
  return context;
};

interface CharacterProviderProps {
  children: ReactNode;
}

export const CharacterProvider: React.FC<CharacterProviderProps> = ({ children }) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [browserFs] = useState(new BrowserFsStorage());
  const [fsSupported] = useState(isFileSystemAccessSupported());
  const [savingInProgress, setSavingInProgress] = useState(false);

  // Load characters on mount
  useEffect(() => {
    async function loadCharacters() {
      setIsLoading(true);
      try {
        let loadedCharacters: Character[] = [];
        
        if (fsSupported) {
          loadedCharacters = await loadAllCharacters();
        } else {
          loadedCharacters = await browserFs.loadAllCharacters();
        }
        
        // If no characters were loaded, create a default character
        if (loadedCharacters.length === 0) {
          const defaultCharacter: Character = {
            id: Date.now(),
            name: 'Default Character',
            image: placeholderImg,
            description: 'Your first character',
            chats: [] // No default chat is created for the default character either
          };
          loadedCharacters = [defaultCharacter];
          
          // Save default character
          await saveCharacterInternal(defaultCharacter);
        }
        
        setCharacters(loadedCharacters);
        setSelectedCharacter(loadedCharacters[0]);
      } catch (err) {
        setError('Failed to load characters');
        console.error('Error loading characters:', err);
      }
      setIsLoading(false);
    }
    
    loadCharacters();
  }, [fsSupported, browserFs]);

  // Save a character to disk
  const saveCharacterInternal = useCallback(async (character: Character) => {
    if (savingInProgress) {
      console.log('Save already in progress, waiting...');
      return;
    }
    
    setSavingInProgress(true);
    try {
      if (fsSupported) {
        await saveCharacterToDisk(character, character.originalFilename);
      } else {
        await browserFs.saveCharacter(character);
        // Don't download on every save, only when explicitly requested
      }
      return true;
    } catch (err) {
      console.error('Error saving character:', err);
      throw new Error(`Failed to save character: ${err}`);
    } finally {
      setSavingInProgress(false);
    }
  }, [fsSupported, browserFs, savingInProgress]);

  // Create a new character
  const createNewCharacter = useCallback(async () => {
    const newCharacter: Character = {
      id: Date.now(),
      name: `New Character ${characters.length + 1}`,
      image: placeholderImg,
      description: '',
      chats: [] // No default chat is created
    };
    
    try {
      // Update state first for immediate UI feedback
      const newCharacters = [...characters, newCharacter];
      setCharacters(newCharacters);
      setSelectedCharacter(newCharacter);
      
      // Then save to disk (this might take a moment)
      await saveCharacterInternal(newCharacter);
      
      return newCharacter;
    } catch (err) {
      console.error('Failed to create new character:', err);
      // Don't throw, we already updated UI
      return newCharacter; // Still return the character even if saving fails
    }
  }, [characters, saveCharacterInternal]);

  // Select a character by ID
  const selectCharacter = useCallback((id: number) => {
    const character = characters.find(c => c.id === id);
    if (character) {
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
      
      const oldCharacter = characters[characterIndex];
      
      // Process value based on field type
      let processedValue = value;
      
      // Parse JSON string back to object if we're updating chats
      if (field === 'chats' && typeof value === 'string') {
        try {
          processedValue = JSON.parse(value);
        } catch (e) {
          console.error('Failed to parse chats JSON:', e);
        }
      }
      
      // Create updated character
      const updatedCharacter = {
        ...oldCharacter,
        [field]: processedValue
      };
      
      // If name changed, update originalFilename
      if (field === 'name') {
        updatedCharacter.originalFilename = `${value}.png`;
      }
      
      // Update state immediately for better UI responsiveness
      const newCharacters = [...characters];
      newCharacters[characterIndex] = updatedCharacter;
      setCharacters(newCharacters);
      
      // Only update selected character if we should (when keepActiveChat is true)
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
      
      if (fsSupported && character.originalFilename) {
        success = await deleteCharacterFile(character.originalFilename);
      } else {
        success = await browserFs.deleteCharacter(id);
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
  }, [characters, selectedCharacter, fsSupported, browserFs]);

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
      await savePngAsBrowserDownload(character);
    } catch (err) {
      console.error('Error exporting character as PNG:', err);
      setError(`Failed to export character: ${err}`);
    }
  }, []);

  // Add functionality to export character as JSON
  const exportCharacterAsJson = useCallback(async (character: Character): Promise<void> => {
    try {
      setError(null);
      await saveCharacterAsJson(character);
    } catch (err) {
      console.error('Error exporting character as JSON:', err);
      setError(`Failed to export character as JSON: ${err}`);
    }
  }, []);

  // Import a character from a PNG file
  const importCharacter = useCallback(async () => {
    try {
      // Show file picker
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png';
      
      return new Promise<Character | null>((resolve) => {
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          
          try {
            // Extract character data
            const { extractCharacterFromPng } = await import('../utils/pngMetadata');
            const character = await extractCharacterFromPng(file);
            
            // Add to characters list
            const exists = characters.some(c => c.id === character.id);
            
            if (exists) {
              // Update existing character
              const newCharacters = characters.map(c => 
                c.id === character.id ? character : c
              );
              setCharacters(newCharacters);
            } else {
              // Add new character
              setCharacters([...characters, character]);
            }
            
            // Select the character
            setSelectedCharacter(character);
            resolve(character);
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
  }, [characters]);

  const value = {
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
  };

  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  );
};