import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { PromptSettings } from './promptBuilder';

export interface GeminiResponse {
  text: string;
  error?: string;
  errorType?: 'RATE_LIMIT' | 'BLOCKED_CONTENT' | 'API_KEY' | 'CONNECTION' | 'MODEL_ERROR' | 'UNKNOWN';
}

/**
 * Send a prompt to Gemini API and get a response using the official library
 */
export async function callGeminiAPI(prompt: string, settings: PromptSettings): Promise<GeminiResponse> {
  // Get settings from global variable set in UserSettingsContext
  const userSettings = (window as any).__gengoTavernUserSettings;
  
  // Check if API key is set
  if (!userSettings || !userSettings.apiKey) {
    return {
      text: '',
      error: 'API key is not set. Please enter your Google API key in settings.',
      errorType: 'API_KEY'
    };
  }

  const apiKey = userSettings.apiKey;
  const MODEL_NAME = userSettings.selectedModel || 'gemini-2.0-flash-exp';

  try {
    // Debug print the prompt being sent
    console.log("%c=== PROMPT SENT TO GEMINI ===", "color: blue; font-weight: bold");
    console.log(`Using model: ${MODEL_NAME}`);
    console.log(prompt);
    console.log("%c=== END OF PROMPT ===", "color: blue; font-weight: bold");
    
    // Initialize the Google Generative AI client
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Define safety settings - all set to BLOCK_NONE as requested
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      }
    ];
    
    // Configure generation parameters from settings
    const generationConfig = {
      temperature: settings.temperature,
      topP: settings.topP,
      topK: settings.topK,
      maxOutputTokens: settings.maxTokens,
    };
    
    // Get the model with configuration
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig,
      safetySettings,
    });
    
    try {
      // Generate content
      const result = await model.generateContent(prompt);
      const response = result.response;
      
      // Check if there are any blocked prompts
      if (response.promptFeedback && response.promptFeedback.blockReason) {
        return {
          text: '',
          error: `Content was blocked by Gemini API safety filters: ${response.promptFeedback.blockReason}`,
          errorType: 'BLOCKED_CONTENT'
        };
      }
      
      const text = response.text();
      
      // Debug print the raw response before sanitization
      console.log("%c=== RAW GEMINI RESPONSE ===", "color: green; font-weight: bold");
      console.log(text);
      console.log("%c=== END OF RAW RESPONSE ===", "color: green; font-weight: bold");
      
      return { text };
    } catch (apiError: any) {
      // Handle specific API errors
      if (apiError.message?.includes('RESOURCE_EXHAUSTED') || apiError.message?.includes('rate limit')) {
        return {
          text: '',
          error: 'Rate limit exceeded. Try using a different model for now or please wait a moment before trying again.',
          errorType: 'RATE_LIMIT'
        };
      } else if (apiError.message?.includes('INVALID_ARGUMENT') || apiError.message?.includes('blocked')) {
        return {
          text: '',
          error: 'Content was blocked by Gemini API safety filters. Try rephrasing your message.',
          errorType: 'BLOCKED_CONTENT'
        };
      } else if (apiError.message?.includes('PERMISSION_DENIED') || apiError.message?.includes('API key')) {
        return {
          text: '',
          error: 'Invalid or expired API key. Please check your API key in settings.',
          errorType: 'API_KEY'
        };
      } else if (apiError.message?.includes('model not found') || apiError.message?.includes('MODEL_NOT_FOUND')) {
        return {
          text: '',
          error: `Model "${MODEL_NAME}" is not available. Try selecting a different model in API settings.`,
          errorType: 'MODEL_ERROR'
        };
      }
      
      // Re-throw for the outer catch block to handle
      throw apiError;
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('network')) {
      return {
        text: '',
        error: 'Network error. Please check your internet connection.',
        errorType: 'CONNECTION'
      };
    }
    
    // General error handling
    return { 
      text: '', 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorType: 'UNKNOWN'
    };
  }
}

/**
 * Clean up the response from the API
 * - Remove any ML tags
 * - Trim character prefixes
 * - Handle incomplete sentences
 */
export function sanitizeResponse(response: string): string {
  if (!response) return '';
  
  // Remove any ML tags
  let cleaned = response
    .replace(/<\|im_start\|>assistant\n/g, '')
    .replace(/<\|im_end\|>/g, '')
    .replace(/<\|im_start\|>user\n/g, '')
    .replace(/<\|im_start\|>system\n/g, '')
    .replace(/<\|file_separator\|>system/g, '')
    .replace(/<\|file_separator\|>/g, '');
  
  // Trim character name prefixes like "{{char}}:", "Character Name:", or Japanese names like "とも:"
  cleaned = cleaned
    .replace(/^{{char}}:\s*/i, '') // Remove {{char}}: prefix
    .replace(/^{{character}}:\s*/i, '') // Remove {{character}}: prefix
    .replace(/^[^:]+:\s*/i, ''); // Remove any prefix that ends with a colon and space
  
  // Remove any trailing incomplete sentences if they end with a special character
  const incompleteEndRegex = /[,;:\-–—]$/;
  if (incompleteEndRegex.test(cleaned)) {
    // Find the last complete sentence
    const lastSentenceEnd = Math.max(
      cleaned.lastIndexOf('.'), 
      cleaned.lastIndexOf('!'), 
      cleaned.lastIndexOf('?')
    );
    
    if (lastSentenceEnd !== -1) {
      cleaned = cleaned.substring(0, lastSentenceEnd + 1);
    }
  }
  
  // Debug the sanitized output
  console.log("%c=== SANITIZED RESPONSE ===", "color: purple; font-weight: bold");
  console.log(cleaned);
  console.log("%c=== END OF SANITIZED RESPONSE ===", "color: purple; font-weight: bold");
  
  return cleaned.trim();
}

// Mock the API call for development purposes
export async function mockGeminiCall(prompt: string): Promise<GeminiResponse> {
  // Debug print the mock prompt
  console.log("%c=== MOCK PROMPT ===", "color: orange; font-weight: bold");
  console.log(prompt);
  console.log("%c=== END OF MOCK PROMPT ===", "color: orange; font-weight: bold");
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Create a mock response
  const mockResponse = `This is a mock response from the AI. I'm pretending to be the character and responding to your message. The prompt had ${prompt.length} characters.`;
  
  // Debug print the mock response
  console.log("%c=== MOCK RESPONSE ===", "color: orange; font-weight: bold");
  console.log(mockResponse);
  console.log("%c=== END OF MOCK RESPONSE ===", "color: orange; font-weight: bold");
  
  return {
    text: mockResponse
  };
}
