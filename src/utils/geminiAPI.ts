import {
	GoogleGenAI,
	type Content,
	type GenerateContentConfig,
} from "@google/genai";
import { PromptSettings } from "./promptBuilder";

export interface GeminiResponse {
	text: string;
	error?: string;
	errorType?:
		| "RATE_LIMIT"
		| "BLOCKED_CONTENT"
		| "API_KEY"
		| "CONNECTION"
		| "MODEL_ERROR"
		| "TIMEOUT"
		| "EMPTY_RESPONSE"
		| "UNKNOWN";
}

/**
 * Interface for character generation response from Gemini
 */
export interface CharacterGenerationResponse {
	character?: GeneratedCharacter;
	error?: string;
	errorType?:
		| "RATE_LIMIT"
		| "BLOCKED_CONTENT"
		| "API_KEY"
		| "CONNECTION"
		| "MODEL_ERROR"
		| "TIMEOUT"
		| "EMPTY_RESPONSE"
		| "INVALID_JSON"
		| "UNKNOWN";
}

/**
 * Interface for character retrieval response from Google Search
 */
export interface CharacterRetrievalResponse {
	characterInfo?: string;
	error?: string;
	errorType?:
		| "RATE_LIMIT"
		| "BLOCKED_CONTENT"
		| "API_KEY"
		| "CONNECTION"
		| "MODEL_ERROR"
		| "TIMEOUT"
		| "EMPTY_RESPONSE"
		| "UNKNOWN";
}

/**
 * Structure of generated character data from Gemini
 */
export interface GeneratedCharacter {
	description: string;
	sampleDialogues: Array<{
		user: string;
		character: string;
	}>;
	defaultScenario: string;
	defaultGreeting: string;
}

/**
 * Send a prompt to Gemini API and get a response using the new library
 */
export async function callGeminiAPI(
	prompt: string,
	settings: PromptSettings,
): Promise<GeminiResponse> {
	// Get settings from global variable set in UserSettingsContext
	const userSettings = (window as any).__gengoTavernUserSettings;

	// Check if API key is set
	if (!userSettings || !userSettings.apiKey) {
		return {
			text: "",
			error:
				"API key is not set. Please enter your Google API key in settings.",
			errorType: "API_KEY",
		};
	}

	const apiKey = userSettings.apiKey;
	const MODEL_NAME = userSettings.selectedModel || "gemini-2.5-flash";

	// Use temperature from user settings if available, otherwise from passed settings
	const temperature =
		userSettings.temperature !== undefined
			? userSettings.temperature
			: settings.temperature || 1.5;

	try {
		// Debug print the prompt being sent
		console.log(`Using model: ${MODEL_NAME} with temperature: ${temperature}`);
		console.log(
			"%c=== PROMPT SENT TO GEMINI ===",
			"color: blue; font-weight: bold",
		);

		console.log(prompt);
		console.log("%c=== END OF PROMPT ===", "color: blue; font-weight: bold");

		// Initialize the Google Generative AI client
		const genAI = new GoogleGenAI({ apiKey });

		// Prepare the user prompt content
		const userPromptContent: Content = {
			role: "user",
			parts: [{ text: prompt }],
		};

		// Configure generation parameters from settings
		const generationConfig: GenerateContentConfig = {
			temperature: temperature, // Use the temperature from user settings
			topP: settings.topP,
			topK: settings.topK,
			maxOutputTokens: settings.maxTokens,
		};

		try {
			// Create a timeout promise that rejects after 60 seconds
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() => reject(new Error("Request timed out after 60 seconds")),
					60000,
				);
			});

			// Race between the API call and timeout
			const result = await Promise.race([
				genAI.models.generateContent({
					model: MODEL_NAME,
					contents: [userPromptContent],
					config: generationConfig,
				}),
				timeoutPromise,
			]);

			// Debug print the raw response before sanitization
			console.log(
				"%c=== RAW GEMINI RESPONSE ===",
				"color: green; font-weight: bold",
			);
			console.log(result);
			console.log(
				"%c=== END OF RAW RESPONSE ===",
				"color: green; font-weight: bold",
			);

			// Check if there are any blocked prompts
			if (result.promptFeedback?.blockReason) {
				return {
					text: "",
					error: `Content was blocked by Gemini API safety filters: ${result.promptFeedback.blockReason}`,
					errorType: "BLOCKED_CONTENT",
				};
			}

			const text = result.text;

			// Check if response text is empty
			if (!text || text.trim() === "") {
				return {
					text: "",
					error:
						"Gemini API returned an empty response. Try rephrasing your message.",
					errorType: "EMPTY_RESPONSE",
				};
			}

			return { text };
		} catch (apiError: any) {
			const errorMessage = apiError.message || "Unknown API error";

			// Handle timeout error
			if (errorMessage.includes("timed out")) {
				return {
					text: "",
					error:
						"Request timed out after 60 seconds. The server might be busy. Please try again.",
					errorType: "TIMEOUT",
				};
			}

			// Handle specific API errors
			if (
				errorMessage.includes("RESOURCE_EXHAUSTED") ||
				errorMessage.includes("rate limit")
			) {
				return {
					text: "",
					error: `Rate limit exceeded. Try using a different model for now or please wait a moment before trying again. API Error: ${errorMessage}`,
					errorType: "RATE_LIMIT",
				};
			} else if (
				errorMessage.includes("INVALID_ARGUMENT") ||
				errorMessage.includes("blocked")
			) {
				return {
					text: "",
					error: `Content was blocked by Gemini API safety filters. Try rephrasing your message. API Error: ${errorMessage}`,
					errorType: "BLOCKED_CONTENT",
				};
			} else if (
				errorMessage.includes("PERMISSION_DENIED") ||
				errorMessage.includes("API key")
			) {
				return {
					text: "",
					error: `Invalid or expired API key. Please check your API key in settings. API Error: ${errorMessage}`,
					errorType: "API_KEY",
				};
			} else if (
				errorMessage.includes("model not found") ||
				errorMessage.includes("MODEL_NOT_FOUND")
			) {
				return {
					text: "",
					error: `Model "${MODEL_NAME}" is not available. Try selecting a different model in API settings. API Error: ${errorMessage}`,
					errorType: "MODEL_ERROR",
				};
			}

			// Re-throw for the outer catch block to handle
			throw apiError;
		}
	} catch (error) {
		console.error("Gemini API error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";

		// Check if it's a network error
		if (error instanceof TypeError && errorMessage.includes("network")) {
			return {
				text: "",
				error: `Network error. Please check your internet connection. Error: ${errorMessage}`,
				errorType: "CONNECTION",
			};
		}

		// General error handling
		return {
			text: "",
			error: `Error: ${errorMessage}`,
			errorType: "UNKNOWN",
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
	if (!response) return "";

	// Remove any ML tags
	let cleaned = response
		.replace(/<\|im_start\|>assistant\n/g, "")
		.replace(/<\|im_end\|>/g, "")
		.replace(/<\|im_start\|>user\n/g, "")
		.replace(/<\|im_start\|>system\n/g, "")
		.replace(/<\|file_separator\|>system/g, "")
		.replace(/<\|file_separator\|>/g, "");

	// Trim character name prefixes like "{{char}}:", "Character Name:", or Japanese names like "とも:"
	cleaned = cleaned
		.replace(/^{{char}}:\s*/i, "") // Remove {{char}}: prefix
		.replace(/^{{character}}:\s*/i, "") // Remove {{character}}: prefix
		.replace(/^[^:]+:\s*/i, ""); // Remove any prefix that ends with a colon and space

	// Remove any trailing incomplete sentences if they end with a special character
	const incompleteEndRegex = /[,;:\-–—]$/;
	if (incompleteEndRegex.test(cleaned)) {
		// Find the last complete sentence
		const lastSentenceEnd = Math.max(
			cleaned.lastIndexOf("."),
			cleaned.lastIndexOf("!"),
			cleaned.lastIndexOf("?"),
		);

		if (lastSentenceEnd !== -1) {
			cleaned = cleaned.substring(0, lastSentenceEnd + 1);
		}
	}

	/* 👇 NEW: collapse consecutive blank lines */
	cleaned = cleaned.replace(/\n{2,}/g, "\n"); // turns \n\n\n → \n

	// Debug the sanitized output
	console.log(
		"%c=== SANITIZED RESPONSE ===",
		"color: purple; font-weight: bold",
	);
	console.log(cleaned);
	console.log(
		"%c=== END OF SANITIZED RESPONSE ===",
		"color: purple; font-weight: bold",
	);

	return cleaned.trim();
}

// Mock the API call for development purposes
export async function mockGeminiCall(prompt: string): Promise<GeminiResponse> {
	// Debug print the mock prompt
	console.log("%c=== MOCK PROMPT ===", "color: orange; font-weight: bold");
	console.log(prompt);
	console.log(
		"%c=== END OF MOCK PROMPT ===",
		"color: orange; font-weight: bold",
	);

	// Simulate API delay
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// Create a mock response
	const mockResponse = `This is a mock response from the AI. I'm pretending to be the character and responding to your message. The prompt had ${prompt.length} characters.`;

	// Debug print the mock response
	console.log("%c=== MOCK RESPONSE ===", "color: orange; font-weight: bold");
	console.log(mockResponse);
	console.log(
		"%c=== END OF MOCK RESPONSE ===",
		"color: orange; font-weight: bold",
	);

	return {
		text: mockResponse,
	};
}

/**
 * Retrieve existing character information using Google Search
 * @param characterName - The name of the character to search for
 * @param additionalInstructions - Optional additional context or instructions
 * @returns Promise<CharacterRetrievalResponse> - Character information from search or "None" if not found
 */
export async function retrieveExistingCharacterInfo(
	characterName: string,
	additionalInstructions?: string,
): Promise<CharacterRetrievalResponse> {
	// Get user settings
	const userSettings = (window as any).__gengoTavernUserSettings;

	// Check if API key is set
	if (!userSettings || !userSettings.apiKey) {
		return {
			error:
				"API key is not set. Please enter your Google API key in settings.",
			errorType: "API_KEY",
		};
	}

	try {
		// Initialize the Google Generative AI client
		const genAI = new GoogleGenAI({ apiKey: userSettings.apiKey });

		// Use Gemini 2.5 Flash for fast and cost-effective search
		const MODEL_NAME = "gemini-2.5-flash";

		// Configure generation parameters (no structured output, just text)
		const generationConfig: GenerateContentConfig = {
			temperature: 1.0,
			topP: 0.9,
			maxOutputTokens: 4096,
			// Add Google Search tool for character information gathering
			tools: [{ googleSearch: {} }],
		};

		// Build the search prompt
		let prompt = `You are a character information researcher. Search for detailed information about the character "${characterName}".

Search Instructions:
- Use Google Search to find comprehensive information about this character and their franchise
- Look for personality traits, background story, appearance, relationships, and speaking style
- Include sample dialogue lines from actual scenes if available
- If you find the character, provide a detailed biography with sample dialogue examples from actual scenes of the character
- If this character doesn't exist or you can't find reliable information, respond with exactly "None found, this is an original character from the user"

Character Name: ${characterName}`;

		// Add additional instructions if provided
		if (additionalInstructions && additionalInstructions.trim()) {
			prompt += `\n\nAdditional Context: ${additionalInstructions.trim()}`;
		}

		prompt += `\n\nProvide either:
1. A detailed character biography with sample dialogue lines (if character exists)
2. "None found, this is an original character from the user" (if character doesn't exist)

Focus on gathering authentic information that would help create an accurate character representation.`;

		// Prepare the user prompt content
		const userPromptContent: Content = {
			role: "user",
			parts: [{ text: prompt }],
		};

		console.log(
			`%c=== CHARACTER SEARCH (${characterName}) ===`,
			"color: cyan; font-weight: bold",
		);
		console.log(prompt);

		try {
			// Create a timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() =>
						reject(new Error("Character search timed out after 45 seconds")),
					45000, // Moderate timeout for search operations
				);
			});

			// Make the API call
			const result = await Promise.race([
				genAI.models.generateContent({
					model: MODEL_NAME,
					contents: [userPromptContent],
					config: generationConfig,
				}),
				timeoutPromise,
			]);

			console.log(
				`%c=== CHARACTER SEARCH RESPONSE ===`,
				"color: cyan; font-weight: bold",
			);
			console.log(result);

			// Check for blocked content
			if (result.promptFeedback?.blockReason) {
				return {
					error: `Character search was blocked: ${result.promptFeedback.blockReason}`,
					errorType: "BLOCKED_CONTENT",
				};
			}

			const responseText = result.text;

			// Check if response is empty
			if (!responseText || responseText.trim() === "") {
				return {
					error: "Character search returned an empty response",
					errorType: "EMPTY_RESPONSE",
				};
			}

			console.log(
				`%c=== CHARACTER SEARCH SUCCESS ===`,
				"color: green; font-weight: bold",
			);
			console.log(responseText);

			return { characterInfo: responseText.trim() };
		} catch (apiError: any) {
			const errorMessage = apiError.message || "Unknown API error";

			// Handle specific API errors
			if (errorMessage.includes("timed out")) {
				return {
					error: "Character search timed out. Using fallback generation.",
					errorType: "TIMEOUT",
				};
			}

			if (
				errorMessage.includes("RESOURCE_EXHAUSTED") ||
				errorMessage.includes("rate limit")
			) {
				return {
					error: "Rate limit exceeded for character search",
					errorType: "RATE_LIMIT",
				};
			}

			if (
				errorMessage.includes("INVALID_ARGUMENT") ||
				errorMessage.includes("blocked")
			) {
				return {
					error: "Character search content was blocked",
					errorType: "BLOCKED_CONTENT",
				};
			}

			if (
				errorMessage.includes("PERMISSION_DENIED") ||
				errorMessage.includes("API key")
			) {
				return {
					error: "Invalid API key for character search",
					errorType: "API_KEY",
				};
			}

			if (
				errorMessage.includes("model not found") ||
				errorMessage.includes("MODEL_NOT_FOUND")
			) {
				return {
					error: `Character search model "${MODEL_NAME}" not available`,
					errorType: "MODEL_ERROR",
				};
			}

			// Re-throw for outer catch
			throw apiError;
		}
	} catch (error) {
		console.error("Character search error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";

		// Check for network errors
		if (error instanceof TypeError && errorMessage.includes("network")) {
			return {
				error: "Network error during character search",
				errorType: "CONNECTION",
			};
		}

		return {
			error: `Character search failed: ${errorMessage}`,
			errorType: "UNKNOWN",
		};
	}
}

/**
 * Generate character data from an image using two-stage approach: first search for existing character info, then generate structured output
 * @param imageFile - The image file to analyze
 * @param characterName - The desired name for the character
 * @param additionalInstructions - Optional additional instructions for generation
 * @returns Promise<CharacterGenerationResponse> - The generated character data
 */
export async function generateCharacterFromImage(
	imageFile: File,
	characterName: string,
	additionalInstructions?: string,
): Promise<CharacterGenerationResponse> {
	// 1. Get user settings
	const userSettings = (window as any).__gengoTavernUserSettings;

	// 2. Check if API key is set
	if (!userSettings || !userSettings.apiKey) {
		return {
			error:
				"API key is not set. Please enter your Google API key in settings.",
			errorType: "API_KEY",
		};
	}

	try {
		// 3. Convert image to base64
		const imageBase64 = await fileToBase64(imageFile);
		const mimeType = imageFile.type;

		// 4. Initialize the Google Generative AI client
		const genAI = new GoogleGenAI({ apiKey: userSettings.apiKey });

		// 5. Use Gemini 2.5 Pro for best quality
		const MODEL_NAME = "gemini-2.5-pro";

		// 6. Define the JSON schema for structured output
		const responseSchema = {
			type: "object",
			properties: {
				description: {
					type: "string",
					description:
						"Detailed character description including personality, appearance, and backstory (2-3 paragraphs)",
				},
				sampleDialogues: {
					type: "array",
					description:
						"Array of 3 sample dialogue exchanges between user and character, use dialogue showcasing the character's quirks and characteristics. Enclose actions in asterisks.",
					items: {
						type: "object",
						properties: {
							user: {
								type: "string",
								description:
									"What the user says/does in this dialogue exchange",
							},
							character: {
								type: "string",
								description:
									"How the character speaks and/or acts in response to the user",
							},
						},
						required: ["user", "character"],
					},
				},
				defaultScenario: {
					type: "string",
					description:
						"Default scenario/setting for chats (1-2 sentences describing the situation)",
				},
				defaultGreeting: {
					type: "string",
					description:
						"Character's default first message when starting a new chat (should match the scenario)",
				},
			},
			required: [
				"description",
				"sampleDialogues",
				"defaultScenario",
				"defaultGreeting",
			],
		};

		// 7. First, attempt to retrieve existing character information
		console.log(
			`%c=== STAGE 1: CHARACTER SEARCH ===`,
			"color: blue; font-weight: bold",
		);

		const characterSearch = await retrieveExistingCharacterInfo(
			characterName,
			additionalInstructions,
		);

		// 8. Create generation config with structured output (no Google Search tool)
		const generationConfig: GenerateContentConfig = {
			temperature: 1.5, // Creative but controlled
			topP: 0.9,
			maxOutputTokens: 8192, // Increased for longer character descriptions
			responseMimeType: "application/json",
			responseSchema: responseSchema,
			// No Google Search tool here - handled separately
		};

		// 9. Build the prompt with retrieved character information
		let prompt = `You are an expert character creator for a chat application. Analyze this image and create a detailed character profile.

Character Name: ${characterName}

Instructions:
- Create a rich, detailed character based on the image
- The character should be interesting and engaging for conversation
- Include personality traits, background, physical appearance, and distinctive quirks/characteristics
- Make the sample dialogues natural and reflect the character's personality
- Do NOT prepend the sample dialogues with the character's names such as "${characterName}: " or "User: " because the chat application will already handle that for you
- The scenario should be appropriate for the character
- Character's first message/greeting should match the scenario and their way of speaking based on the sample dialogues
`;

		// 10. Add retrieved character information if available
		if (characterSearch.characterInfo && !characterSearch.error) {
			if (characterSearch.characterInfo.includes("None found")) {
				prompt += `\n\nCharacter Search Result: This appears to be an original character. Create a unique profile based on the image.`;
			} else {
				prompt += `\n\nMatching Character from the Internet: ${characterSearch.characterInfo}

Use this information to create an authentic character profile that matches the known character's personality, background, and speaking style.`;
			}
		} else if (characterSearch.error) {
			console.warn("Character search failed:", characterSearch.error);
			prompt += `\n\nNote: Character search was unavailable. Create a unique profile based on the image.`;
		}

		// 11. Add additional instructions if provided
		if (additionalInstructions && additionalInstructions.trim()) {
			prompt += `\n\nAdditional Instructions: ${additionalInstructions.trim()}`;
		}

		prompt +=
			"\n\nIMPORTANT: Respond with COMPLETE valid JSON only. Keep dialogue examples concise (1-2 sentences each) to ensure the response fits within token limits. Follow the exact schema provided.";

		// 12. Prepare the image data
		const imagePart = {
			inlineData: {
				data: imageBase64,
				mimeType: mimeType,
			},
		};

		// 13. Prepare the user prompt content
		const userPromptContent: Content = {
			role: "user",
			parts: [{ text: prompt }, imagePart],
		};

		console.log(
			`%c=== STAGE 2: CHARACTER GENERATION ===`,
			"color: blue; font-weight: bold",
		);
		console.log(`Character Name: ${characterName}`);
		console.log(`Additional Instructions: ${additionalInstructions || "None"}`);
		console.log(`Model: ${MODEL_NAME}`);
		console.log(
			`Character Search Status: ${characterSearch.error ? "Failed" : "Success"}`,
		);

		try {
			// 14. Create a timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() => reject(new Error("Request timed out after 60 seconds")),
					60000, // Longer timeout for vision + structured output
				);
			});

			// 15. Make the API call with both text and image
			const result = await Promise.race([
				genAI.models.generateContent({
					model: MODEL_NAME,
					contents: [userPromptContent],
					config: generationConfig,
				}),
				timeoutPromise,
			]);

			console.log(
				`%c=== RAW CHARACTER GENERATION RESPONSE ===`,
				"color: green; font-weight: bold",
			);
			console.log(result);

			// 14. Check for blocked content
			if (result.promptFeedback?.blockReason) {
				return {
					error: `Content was blocked by Gemini API safety filters: ${result.promptFeedback.blockReason}`,
					errorType: "BLOCKED_CONTENT",
				};
			}

			const responseText = result.text;

			// 15. Check if response is empty
			if (!responseText || responseText.trim() === "") {
				return {
					error:
						"Gemini API returned an empty response. Try using a different image or adding more specific instructions.",
					errorType: "EMPTY_RESPONSE",
				};
			}

			console.log(
				`%c=== CHARACTER GENERATION JSON ===`,
				"color: purple; font-weight: bold",
			);
			console.log(responseText);

			// 16. Parse the JSON response
			try {
				const parsedCharacter = JSON.parse(responseText) as GeneratedCharacter;

				// 17. Validate the response structure
				if (
					!parsedCharacter.description ||
					!parsedCharacter.sampleDialogues ||
					!parsedCharacter.defaultScenario ||
					!parsedCharacter.defaultGreeting
				) {
					return {
						error:
							"Generated character data is incomplete. Please try again with a different image or more specific instructions.",
						errorType: "INVALID_JSON",
					};
				}

				// 18. Validate sample dialogues structure
				if (
					!Array.isArray(parsedCharacter.sampleDialogues) ||
					parsedCharacter.sampleDialogues.length === 0
				) {
					return {
						error:
							"Generated character data has invalid dialogue format. Please try again.",
						errorType: "INVALID_JSON",
					};
				}

				console.log(
					`%c=== CHARACTER GENERATION SUCCESS ===`,
					"color: green; font-weight: bold",
				);
				return { character: parsedCharacter };
			} catch (parseError) {
				console.error("Failed to parse character generation JSON:", parseError);
				return {
					error: `Failed to parse character data: ${parseError instanceof Error ? parseError.message : "Invalid JSON format"}`,
					errorType: "INVALID_JSON",
				};
			}
		} catch (apiError: any) {
			const errorMessage = apiError.message || "Unknown API error";

			// 19. Handle specific API errors (similar to main callGeminiAPI function)
			if (errorMessage.includes("timed out")) {
				return {
					error:
						"Request timed out after 60 seconds. Character generation requires more time. Please try again.",
					errorType: "TIMEOUT",
				};
			}

			if (
				errorMessage.includes("RESOURCE_EXHAUSTED") ||
				errorMessage.includes("rate limit")
			) {
				return {
					error: `Rate limit exceeded. Please wait a moment before generating another character. API Error: ${errorMessage}`,
					errorType: "RATE_LIMIT",
				};
			}

			if (
				errorMessage.includes("INVALID_ARGUMENT") ||
				errorMessage.includes("blocked")
			) {
				return {
					error: `Content was blocked by Gemini API safety filters. Try using a different image or adjusting your instructions. API Error: ${errorMessage}`,
					errorType: "BLOCKED_CONTENT",
				};
			}

			if (
				errorMessage.includes("PERMISSION_DENIED") ||
				errorMessage.includes("API key")
			) {
				return {
					error: `Invalid or expired API key. Please check your API key in settings. API Error: ${errorMessage}`,
					errorType: "API_KEY",
				};
			}

			if (
				errorMessage.includes("model not found") ||
				errorMessage.includes("MODEL_NOT_FOUND")
			) {
				return {
					error: `Model "${MODEL_NAME}" is not available. Please check your API access. API Error: ${errorMessage}`,
					errorType: "MODEL_ERROR",
				};
			}

			// Re-throw for outer catch
			throw apiError;
		}
	} catch (error) {
		console.error("Character generation error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";

		// Check for network errors
		if (error instanceof TypeError && errorMessage.includes("network")) {
			return {
				error: `Network error during character generation. Please check your internet connection. Error: ${errorMessage}`,
				errorType: "CONNECTION",
			};
		}

		return {
			error: `Character generation failed: ${errorMessage}`,
			errorType: "UNKNOWN",
		};
	}
}

/**
 * Convert a File to base64 string
 * @param file - The file to convert
 * @returns Promise<string> - Base64 string without data URL prefix
 */
async function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			// Remove the data URL prefix (e.g., "data:image/png;base64,")
			const base64 = result.split(",")[1];
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
