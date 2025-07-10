import type { Character, Chat } from '../types/interfaces';
import { isGroupChat, getOrderedGroupMembers } from './groupChatUtils';

export interface PromptSettings {
  temperature?: number; // Controls randomness (0.0-2.0)
  topP?: number; // Nucleus sampling (0.0-1.0)
  topK?: number; // Top-k sampling (1-40)
  maxTokens?: number; // Maximum length of output
}

// Default settings will be used if no chat-specific settings are provided
const DEFAULT_SETTINGS: PromptSettings = {
  topK: 1,
  topP: 0.9,
  maxTokens: 8192,
};

/**
 * Build a conversation prompt for the AI model following MLChat format
 * Routes to appropriate builder based on character type
 */
export function buildPrompt(
  character: Character, 
  chat: Chat, 
  userName: string = 'User',
  allCharacters?: Character[],
  nextSpeakerId?: number
): { prompt: string; settings: PromptSettings } {
  // Route to group chat builder if this is a group chat
  if (isGroupChat(character)) {
    if (!allCharacters) {
      throw new Error('allCharacters array is required for group chat prompts');
    }
    return buildGroupChatPrompt(character, chat, userName, allCharacters, nextSpeakerId);
  }
  
  // Use original individual character logic
  return buildIndividualPrompt(character, chat, userName);
}

/**
 * Build a conversation prompt for individual characters (original logic)
 */
function buildIndividualPrompt(
  character: Character, 
  chat: Chat, 
  userName: string = 'User'
): { prompt: string; settings: PromptSettings } {
  // Start building the prompt
  let prompt = '';
  
  // Get user settings including temperature
  const userSettings = (window as any).__gengoTavernUserSettings;
  const userPersona = userSettings?.userPersona || { 
    name: userName, 
    description: 'A friendly user who wants to chat with you.' 
  };

  // Use the name from persona if available
  userName = userPersona.name || userName;
  
  // 1. System instructions block with character description
  const systemContent = formatCharacterDescription(character, userName, userPersona.description);
  prompt += `<|im_start|>system\n${systemContent}<|im_end|>\n`;
  
  // 2. Add sample dialogues from character if available
  if (character.sampleDialogues && character.sampleDialogues.length > 0) {
    character.sampleDialogues.forEach(dialogue => {
      // Format the user's dialogue
      const userText = replaceNamePlaceholders(dialogue.user, character.name, userName);
      prompt += `<|im_start|>user\n${userName}: ${userText}\n<|im_end|>\n`;
      
      // Format the character's response
      const charText = replaceNamePlaceholders(dialogue.character, character.name, userName);
      prompt += `<|im_start|>assistant\n${character.name}: ${charText}\n<|im_end|>\n`;
    });
  }
  
  // 3. Add the actual conversation history
  const nonErrorMessages = chat.messages.filter(msg => !msg.error);
  nonErrorMessages.forEach(message => {
    const role = message.sender === 'user' 
        ? 'user' 
        : message.sender === 'character' ? 'assistant' : 'system';
    
    const formattedText = replaceNamePlaceholders(message.text, character.name, userName);
    
    // For system messages (like scenario), we'll format them slightly differently
    if (message.sender === 'system') {
        prompt += `<|im_start|>system\n[New Scenario: ${formattedText}]\n<|im_end|>\n`;
    } else if (message.sender === 'character') {
        prompt += `<|im_start|>${role}\n${character.name}: ${formattedText}\n<|im_end|>\n`;
    } else if (message.sender === 'user') {
        prompt += `<|im_start|>${role}\n${userName}: ${formattedText}\n<|im_end|>\n`;
    }
  });
  
  // 4. Add the final assistant prefix to prompt the model's response
  prompt += `<|im_start|>assistant\n${character.name}: `;
  
  // Use custom settings if available in the chat, otherwise use defaults
  // Note: We don't copy temperature from chat settings here, as that will be applied
  // at the API call level from global user settings
  const settings = { ...DEFAULT_SETTINGS, ...chat.settings };
  
  return { prompt, settings };
}

/**
 * Build a conversation prompt for group chats
 */
function buildGroupChatPrompt(
  groupChat: Character,
  chat: Chat,
  userName: string = 'User',
  allCharacters: Character[],
  nextSpeakerId?: number
): { prompt: string; settings: PromptSettings } {
  // Start building the prompt
  let prompt = '';
  
  // Get user settings including temperature
  const userSettings = (window as any).__gengoTavernUserSettings;
  const userPersona = userSettings?.userPersona || { 
    name: userName, 
    description: 'A friendly user who wants to chat with you.' 
  };

  // Use the name from persona if available
  userName = userPersona.name || userName;

  // Get group members and their character objects
  const orderedMembers = getOrderedGroupMembers(groupChat);
  const memberCharacters = orderedMembers
    .map(member => allCharacters.find(char => char.id === member.characterId))
    .filter((char): char is Character => char !== undefined);

  if (memberCharacters.length === 0) {
    throw new Error('No valid member characters found for group chat');
  }

  // 1. System instructions block with ALL character descriptions
  const systemContent = formatGroupCharacterDescriptions(memberCharacters, userName, userPersona.description);
  prompt += `<|im_start|>system\n${systemContent}<|im_end|>\n`;

  // 2. Add sample dialogues from ALL characters
  memberCharacters.forEach(character => {
    if (character.sampleDialogues && character.sampleDialogues.length > 0) {
      character.sampleDialogues.forEach(dialogue => {
        // Format the user's dialogue
        const userText = replaceNamePlaceholders(dialogue.user, character.name, userName);
        prompt += `<|im_start|>user\n${userName}: ${userText}\n<|im_end|>\n`;
        
        // Format the character's response
        const charText = replaceNamePlaceholders(dialogue.character, character.name, userName);
        prompt += `<|im_start|>assistant\n${character.name}: ${charText}\n<|im_end|>\n`;
      });
    }
  });

  // 3. Add the actual conversation history
  const nonErrorMessages = chat.messages.filter(msg => !msg.error);
  nonErrorMessages.forEach(message => {
    const role = message.sender === 'user' 
        ? 'user' 
        : message.sender === 'character' ? 'assistant' : 'system';
    
    const formattedText = replaceNamePlaceholders(message.text, '', userName);
    
    // For system messages (like scenario), we'll format them slightly differently
    if (message.sender === 'system') {
        prompt += `<|im_start|>system\n[New Scenario: ${formattedText}]\n<|im_end|>\n`;
    } else if (message.sender === 'character') {
        // For group chats, use the speaker name from the message
        const speakerName = message.speakerName || 'Unknown';
        prompt += `<|im_start|>${role}\n${speakerName}: ${formattedText}\n<|im_end|>\n`;
    } else if (message.sender === 'user') {
        prompt += `<|im_start|>${role}\n${userName}: ${formattedText}\n<|im_end|>\n`;
    }
  });

  // 4. Add the final assistant prefix for the next speaker
  let nextSpeaker: Character | undefined;
  if (nextSpeakerId) {
    nextSpeaker = memberCharacters.find(char => char.id === nextSpeakerId);
  }
  
  // If no specific next speaker, default to first member
  if (!nextSpeaker) {
    nextSpeaker = memberCharacters[0];
  }
  
  prompt += `<|im_start|>assistant\n${nextSpeaker.name}: `;

  // Use custom settings if available in the chat, otherwise use defaults
  const settings = { ...DEFAULT_SETTINGS, ...chat.settings };
  
  return { prompt, settings };
}

/**
 * Format multiple character descriptions for group chat system message
 */
function formatGroupCharacterDescriptions(
  characters: Character[], 
  userName: string, 
  userDescription: string = ''
): string {
  let systemMessage = '';
  
  // Add each character's description
  characters.forEach((character, index) => {
    if (character.description) {
      const formattedDescription = replaceNamePlaceholders(
        character.description, 
        character.name, 
        userName
      );
      systemMessage += `[Character ${index + 1} Name: ${character.name}]\n[Character ${index + 1} Profile: ${formattedDescription}]\n`;
    } else {
      systemMessage += `[Character ${index + 1} Name: ${character.name}]\n[Character ${index + 1} Profile: A character in this group chat.]\n`;
    }
  });
  
  // Add user persona information
  systemMessage += `[User's Name: ${userName}]\n[User's Profile: ${userDescription || 'A friendly user who wants to chat with you.'}]\n`;
  
  // Add group chat instructions
  systemMessage += `[Group Chat Instructions: You are one of the characters in this group chat. Only respond as the character whose name appears after the colon. Stay in character and respond naturally as if you are having a real conversation. All characters can see and respond to each other's messages.]\n`;
  
  return systemMessage;
}

/**
 * Format the character description with key information
 */
function formatCharacterDescription(character: Character, userName: string, userDescription: string = ''): string {
  let systemMessage = '';
  
  // Add character description if available
  if (character.description) {
    const formattedDescription = replaceNamePlaceholders(
      character.description, 
      character.name, 
      userName
    );
    systemMessage += `[Character's Name: ${character.name}]\n[Character's Profile: ${formattedDescription}]\n`;
  }
  
  // Add user persona information
  systemMessage += `[User's Name: ${userName}]\n[User's Profile: ${userDescription || 'A friendly user who wants to chat with you.'}]\n`;
  
  // Add instructions for the AI
  /*
  systemMessage += 
    `Instructions:\n` +
    `1. Always stay in character as ${character.name}.\n` +
    `2. Respond naturally as if you are having a real conversation.\n` +
    `3. Never break character by mentioning that you are an AI or language model.\n` +
    `4. Never use markdown formatting or code blocks.\n` +
    `5. Don't include system notes or meta commentary about the response.\n` +
    `6. Keep your responses concise but engaging.\n` +
    `7. Don't repeat yourself unnecessarily.`;
    */
  return systemMessage;
}

/**
 * Replace placeholders like {{char}} and {{user}} with actual names
 */
export function replaceNamePlaceholders(text: string, charName: string, userName: string): string {
  if (!text) return text;
  
  // Handle variations of character placeholders
  let processed = text
    .replace(/{{char}}/gi, charName)
    .replace(/{{character}}/gi, charName)
    .replace(/\{\{CHAR\}\}/g, charName)
    .replace(/\{\{CHARACTER\}\}/g, charName);
  
  // Handle variations of user placeholders
  processed = processed
    .replace(/{{user}}/gi, userName)
    .replace(/\{\{USER\}\}/g, userName);
  
  return processed;
}

/**
 * Helper function to build group chat prompts with cleaner API
 */
export function buildGroupChatPromptWithMembers(
  groupChat: Character,
  chat: Chat,
  allCharacters: Character[],
  nextSpeakerId?: number,
  userName: string = 'User'
): { prompt: string; settings: PromptSettings } {
  return buildGroupChatPrompt(groupChat, chat, userName, allCharacters, nextSpeakerId);
}