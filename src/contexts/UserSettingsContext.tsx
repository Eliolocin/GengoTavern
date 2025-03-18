import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadUserSettings, saveUserSettings } from '../utils/fileSystem';

interface UserPersona {
  name: string;
  description: string;
}

interface UserSettings {
  apiKey: string;
  persona: UserPersona;
  model: string;
}

interface UserSettingsContextValue {
  settings: UserSettings;
  updateApiKey: (key: string) => void;
  updatePersona: (persona: UserPersona) => void;
  updateModel: (model: string) => void;
  isLoading: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  apiKey: '',
  persona: {
    name: 'User',
    description: ''
  },
  model: 'gemini-1.0-pro'
};

// Define the GEMINI_MODELS constant that is being imported elsewhere
export const GEMINI_MODELS = [
  { 
    id: 'gemini-1.0-pro', 
    name: 'Gemini Pro (Better for complex tasks)',
    description: 'Best for complex reasoning tasks' 
  },
  { 
    id: 'gemini-1.5-flash', 
    name: 'Gemini Flash (Faster responses)',
    description: 'Best for simple tasks and fast responses' 
  },
  { 
    id: 'gemini-1.5-pro', 
    name: 'Gemini 1.5 Pro (Most capable)',
    description: 'Most capable, best for complex reasoning' 
  }
];

const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

export const useUserSettings = () => {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
};

export const UserSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from file system on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const savedSettings = await loadUserSettings();
        setSettings({
          apiKey: savedSettings.apiKey || DEFAULT_SETTINGS.apiKey,
          persona: savedSettings.persona || DEFAULT_SETTINGS.persona,
          model: savedSettings.model || DEFAULT_SETTINGS.model
        });
      } catch (error) {
        console.error('Failed to load user settings:', error);
        // Use default settings on error
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadSettings();
  }, []);

  // Update API key and save
  const updateApiKey = async (key: string) => {
    const newSettings = { ...settings, apiKey: key };
    setSettings(newSettings);
    try {
      await saveUserSettings(newSettings);
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
  };

  // Update persona and save
  const updatePersona = async (persona: UserPersona) => {
    const newSettings = { ...settings, persona };
    setSettings(newSettings);
    try {
      await saveUserSettings(newSettings);
    } catch (error) {
      console.error('Failed to save persona:', error);
    }
  };

  // Update model and save
  const updateModel = async (model: string) => {
    const newSettings = { ...settings, model };
    setSettings(newSettings);
    try {
      await saveUserSettings(newSettings);
    } catch (error) {
      console.error('Failed to save model selection:', error);
    }
  };
  
  // Subscribe to settings changes for the global reference
  useEffect(() => {
    observeSettings(settings);
  }, [settings]);

  return (
    <UserSettingsContext.Provider 
      value={{ 
        settings, 
        updateApiKey, 
        updatePersona, 
        updateModel,
        isLoading
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
};

// Make settings available outside of React components
let globalSettings: UserSettings = DEFAULT_SETTINGS;

export const getGlobalSettings = (): UserSettings => {
  return globalSettings;
};

// Observer to update global settings when context changes
export const observeSettings = (settings: UserSettings) => {
  globalSettings = settings;
};
