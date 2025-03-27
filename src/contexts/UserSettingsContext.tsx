import React, { createContext, useState, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';

interface UserPersona {
  name: string;
  description: string;
}

// Available Gemini model options
export const GEMINI_MODELS = {
  FLASH_EXP: 'gemini-2.0-flash-exp',
  FLASH_LITE: 'gemini-2.0-flash-lite',
  FLASH_THINKING: 'gemini-2.0-flash-thinking-exp-01-21',
  PRO_25_EXP: 'gemini-2.5-pro-exp-03-25',
};

interface UserSettingsContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  userPersona: UserPersona;
  setUserPersona: (persona: UserPersona) => void;
  isApiKeySet: boolean;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

export const useUserSettings = () => {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
};

interface UserSettingsProviderProps {
  children: ReactNode;
}

export const UserSettingsProvider: React.FC<UserSettingsProviderProps> = ({ children }) => {
  // Load stored API key and user persona from localStorage
  const [apiKey, setApiKeyState] = useState<string>(() => {
    const storedKey = localStorage.getItem('gengoTavern_apiKey');
    return storedKey || '';
  });

  const [userPersona, setUserPersonaState] = useState<UserPersona>(() => {
    const storedPersona = localStorage.getItem('gengoTavern_userPersona');
    return storedPersona 
      ? JSON.parse(storedPersona) 
      : { name: 'User', description: 'A friendly user chatting with characters.' };
  });
  
  // Load stored model choice from localStorage
  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    const storedModel = localStorage.getItem('gengoTavern_selectedModel');
    return storedModel || GEMINI_MODELS.FLASH_EXP; // Default to flash-thinking-exp model
  });

  // Update localStorage when apiKey changes
  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem('gengoTavern_apiKey', key);
  };

  // Update localStorage when userPersona changes
  const setUserPersona = (persona: UserPersona) => {
    setUserPersonaState(persona);
    localStorage.setItem('gengoTavern_userPersona', JSON.stringify(persona));
  };
  
  // Update localStorage when selectedModel changes
  const setSelectedModel = (model: string) => {
    setSelectedModelState(model);
    localStorage.setItem('gengoTavern_selectedModel', model);
  };

  // Check if API key is set
  const isApiKeySet = apiKey.length > 0;

  const value = {
    apiKey,
    setApiKey,
    userPersona,
    setUserPersona,
    isApiKeySet,
    selectedModel,
    setSelectedModel,
  };
  
  // Make settings available globally for non-React components
  useEffect(() => {
    // Set global variable to access settings outside of React context
    (window as any).__gengoTavernUserSettings = value;
    
    // Cleanup when unmounted
    return () => {
      delete (window as any).__gengoTavernUserSettings;
    };
  }, [apiKey, userPersona, isApiKeySet, selectedModel]);

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
};
