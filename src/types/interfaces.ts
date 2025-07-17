import type { MessageTutorData } from "./grammarCorrection";

export interface DialoguePair {
  user: string;
  character: string;
}

export interface GroupMember {
  characterId: number; // Reference to existing character
  responseProbability: number; // 0-100, probability of responding after each message
  displayOrder: number; // Order for visual novel sprite positioning (0-based, left to right)
}

export interface GroupGreeting {
  characterId: number; // Which character this greeting belongs to
  greeting: string; // The greeting text for this character
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
  meta?: Record<string, unknown>;
  isError?: boolean; // Flag for error messages that should be displayed differently
  emotion?: string; // Detected emotion for character messages, used for sprite selection
  speakerId?: number; // Character ID that sent this message (for group chats)
  speakerName?: string; // Character name for easy access (for group chats)
  tutorData?: MessageTutorData; // Grammar correction data (only for user messages)
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
  groupGreetings?: GroupGreeting[]; // Split greetings for group chats
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
  type?: 'individual' | 'group'; // Distinguish between individual characters and group chats (default: 'individual')
  members?: GroupMember[]; // Only used for group chats - references to member characters
  groupCompositeImage?: string; // Generated composite image for group chat icon
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