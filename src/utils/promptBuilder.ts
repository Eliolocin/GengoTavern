import type { Character, Message, Chat } from '../types/interfaces';

export interface PromptSettings {
  temperature?: number; // Controls randomness (0.0-2.0)
  topP?: number; // Nucleus sampling (0.0-1.0)
  topK?: number; // Top-k sampling (1-40)
  maxTokens?: number; // Maximum length of output
}

const DEFAULT_SETTINGS: PromptSettings = {
  temperature: 1.5,
  topK: 1,
  topP: 0.9,
  maxTokens: 1024,
};

/**
 * Build a conversation prompt for the AI model following MLChat format
 */
export function buildPrompt(
  character: Character, 
  chat: Chat, 
  userName: string = 'User'
): { prompt: string; settings: PromptSettings } {
  // Start building the prompt
  let prompt = '';
  
  // Get user persona from global settings if available
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
  const settings = chat.settings || DEFAULT_SETTINGS;
  
  return { prompt, settings };
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