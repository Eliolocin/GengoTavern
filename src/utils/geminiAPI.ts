import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { PromptSettings } from './promptBuilder';

export interface GeminiResponse {
  text: string;
  error?: string;
  errorType?: 'RATE_LIMIT' | 'BLOCKED_CONTENT' | 'API_KEY' | 'CONNECTION' | 'MODEL_ERROR' | 'TIMEOUT' | 'EMPTY_RESPONSE' | 'UNKNOWN';
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
  
  // Use temperature from user settings if available, otherwise from passed settings
  const temperature = userSettings.temperature !== undefined 
    ? userSettings.temperature 
    : (settings.temperature || 1.5);

  try {
    // Debug print the prompt being sent
    console.log(`Using model: ${MODEL_NAME} with temperature: ${temperature}`);
    console.log("%c=== PROMPT SENT TO GEMINI ===", "color: blue; font-weight: bold");

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
      temperature: temperature,  // Use the temperature from user settings
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
      // Create a timeout promise that rejects after 20 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out after 20 seconds')), 20000);
      });
      
      // Race between the API call and timeout
      const result = await Promise.race([
        model.generateContent(prompt),
        timeoutPromise
      ]);
      
      const response = result.response;

      // Debug print the raw response before sanitization
      console.log("%c=== RAW GEMINI RESPONSE ===", "color: green; font-weight: bold");
      console.log(response);
      console.log("%c=== END OF RAW RESPONSE ===", "color: green; font-weight: bold");
      
      // Check if there are any blocked prompts
      if (response.promptFeedback && response.promptFeedback.blockReason) {
        return {
          text: '',
          error: `Content was blocked by Gemini API safety filters: ${response.promptFeedback.blockReason}`,
          errorType: 'BLOCKED_CONTENT'
        };
      }
      
      const text = response.text();
      
      // Check if response text is empty
      if (!text || text.trim() === '') {
        return {
          text: '',
          error: 'Gemini API returned an empty response. Try rephrasing your message.',
          errorType: 'EMPTY_RESPONSE'
        };
      }
      
      return { text };
    } catch (apiError: any) {
      const errorMessage = apiError.message || 'Unknown API error';
      
      // Handle timeout error
      if (errorMessage.includes('timed out')) {
        return {
          text: '',
          error: 'Request timed out after 20 seconds. The server might be busy. Please try again.',
          errorType: 'TIMEOUT'
        };
      }
      
      // Handle specific API errors
      if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('rate limit')) {
        return {
          text: '',
          error: `Rate limit exceeded. Try using a different model for now or please wait a moment before trying again. API Error: ${errorMessage}`,
          errorType: 'RATE_LIMIT'
        };
      } else if (errorMessage.includes('INVALID_ARGUMENT') || errorMessage.includes('blocked')) {
        return {
          text: '',
          error: `Content was blocked by Gemini API safety filters. Try rephrasing your message. API Error: ${errorMessage}`,
          errorType: 'BLOCKED_CONTENT'
        };
      } else if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('API key')) {
        return {
          text: '',
          error: `Invalid or expired API key. Please check your API key in settings. API Error: ${errorMessage}`,
          errorType: 'API_KEY'
        };
      } else if (errorMessage.includes('model not found') || errorMessage.includes('MODEL_NOT_FOUND')) {
        return {
          text: '',
          error: `Model "${MODEL_NAME}" is not available. Try selecting a different model in API settings. API Error: ${errorMessage}`,
          errorType: 'MODEL_ERROR'
        };
      }
      
      // Re-throw for the outer catch block to handle
      throw apiError;
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Check if it's a network error
    if (error instanceof TypeError && errorMessage.includes('network')) {
      return {
        text: '',
        error: `Network error. Please check your internet connection. Error: ${errorMessage}`,
        errorType: 'CONNECTION'
      };
    }
    
    // General error handling
    return { 
      text: '', 
      error: `Error: ${errorMessage}`,
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
