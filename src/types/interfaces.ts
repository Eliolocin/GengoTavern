export interface DialoguePair {
  user: string;
  character: string;
}

export interface Sprite {
  emotion: string;
  filename: string;
}

export interface Message {
  id: number;
  text: string;
  sender: 'user' | 'character' | 'system';
  timestamp: number;
  editHistory?: string[];
  regenHistory?: string[];
  isEditing?: boolean;
  isGenerating?: boolean;
  error?: string;
  reactions?: string[];
  meta?: Record<string, any>;
  isError?: boolean; // Flag for error messages that should be displayed differently
  emotion?: string; // Detected emotion for character messages, used for sprite selection
}

export interface Chat {
  id: number;
  name?: string;
  scenario?: string;
  background?: string;
  messages: Message[];
  deletedMessages?: Message[];
  lastActivity?: number;
  pinned?: boolean;
  tags?: string[];
  settings?: ChatSettings;
  isActive?: boolean; // Flag to track active chat state
}

export interface Character {
  id: number;
  name: string;
  image: string;
  description?: string;
  defaultGreeting?: string;
  defaultScenario?: string;
  defaultBackground?: string;
  sampleDialogues?: DialoguePair[];
  sprites?: Sprite[]; // Array of emotion-based sprites for VN mode
  chats: Chat[];
}

export interface MessageEditState {
  messageId: number;
  originalText: string;
  editedText: string;
}

export interface ChatSettings {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseFormat?: 'text' | 'json';
  modelName?: string;
}