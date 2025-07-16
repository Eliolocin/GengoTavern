import {
	GoogleGenerativeAI,
	HarmCategory,
	HarmBlockThreshold,
	SchemaType,
} from "@google/generative-ai";
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
 * Send a prompt to Gemini API and get a response using the official library
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
			},
		];

		// Configure generation parameters from settings
		const generationConfig = {
			temperature: temperature, // Use the temperature from user settings
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
			// Create a timeout promise that rejects after 60 seconds
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() => reject(new Error("Request timed out after 60 seconds")),
					60000,
				);
			});

			// Race between the API call and timeout
			const result = await Promise.race([
				model.generateContent(prompt),
				timeoutPromise,
			]);

			const response = result.response;

			// Debug print the raw response before sanitization
			console.log(
				"%c=== RAW GEMINI RESPONSE ===",
				"color: green; font-weight: bold",
			);
			console.log(response);
			console.log(
				"%c=== END OF RAW RESPONSE ===",
				"color: green; font-weight: bold",
			);

			// Check if there are any blocked prompts
			if (response.promptFeedback && response.promptFeedback.blockReason) {
				return {
					text: "",
					error: `Content was blocked by Gemini API safety filters: ${response.promptFeedback.blockReason}`,
					errorType: "BLOCKED_CONTENT",
				};
			}

			const text = response.text();

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
 * Generate character data from an image using Gemini Vision API with structured output
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
		const genAI = new GoogleGenerativeAI(userSettings.apiKey);

		// 5. Use Gemini 2.5 Pro for best quality
		const MODEL_NAME = "gemini-2.5-pro";

		// 6. Define the JSON schema for structured output
		const responseSchema = {
			type: SchemaType.OBJECT as const,
			properties: {
				description: {
					type: SchemaType.STRING as const,
					description:
						"Detailed character description including personality, appearance, and backstory (2-3 paragraphs)",
				},
				sampleDialogues: {
					type: SchemaType.ARRAY as const,
					description:
						"Array of 3 sample dialogue exchanges between user and character, use dialogue showcasing the character's quirks and characteristics. Enclose actions in asterisks.",
					items: {
						type: SchemaType.OBJECT as const,
						properties: {
							user: {
								type: SchemaType.STRING as const,
								description:
									"What the user says/does in this dialogue exchange",
							},
							character: {
								type: SchemaType.STRING as const,
								description:
									"How the character responds and/or acts (use the character's name, not {{char}})",
							},
						},
						required: ["user", "character"],
					},
				},
				defaultScenario: {
					type: SchemaType.STRING as const,
					description:
						"Default scenario/setting for chats (1-2 sentences describing the situation)",
				},
				defaultGreeting: {
					type: SchemaType.STRING as const,
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

		// 7. Create generation config with structured output
		const generationConfig = {
			temperature: 1.5, // Creative but controlled
			topP: 0.9,
			maxOutputTokens: 8192, // Increased for longer character descriptions
			responseMimeType: "application/json",
			responseSchema: responseSchema,
		};

		// 8. Safety settings - allow creative content
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
			},
		];

		// 9. Get the model with configuration
		const model = genAI.getGenerativeModel({
			model: MODEL_NAME,
			generationConfig,
			safetySettings,
		});

		// 10. Build the prompt
		let prompt = `You are an expert character creator for a chat application. Analyze this image and create a detailed character profile.

Character Name: ${characterName}

Instructions:
- Create a rich, detailed character based on the image
- The character should be interesting and engaging for conversation
- Include personality traits, background, physical appearance, and distinctive quirks/characteristics
- Make the dialogue examples natural and reflect the character's personality
- The scenario should be appropriate for the character
- Use the character's actual name "${characterName}" in dialogues, not placeholders like {{char}}`;

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

		console.log(
			`%c=== GENERATING CHARACTER FROM IMAGE ===`,
			"color: blue; font-weight: bold",
		);
		console.log(`Character Name: ${characterName}`);
		console.log(`Additional Instructions: ${additionalInstructions || "None"}`);
		console.log(`Model: ${MODEL_NAME}`);

		try {
			// 13. Create a timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() => reject(new Error("Request timed out after 60 seconds")),
					60000, // Longer timeout for vision + structured output
				);
			});

			// 14. Make the API call with both text and image
			const result = await Promise.race([
				model.generateContent([prompt, imagePart]),
				timeoutPromise,
			]);

			const response = result.response;

			console.log(
				`%c=== RAW CHARACTER GENERATION RESPONSE ===`,
				"color: green; font-weight: bold",
			);
			console.log(response);

			// 15. Check for blocked content
			if (response.promptFeedback && response.promptFeedback.blockReason) {
				return {
					error: `Content was blocked by Gemini API safety filters: ${response.promptFeedback.blockReason}`,
					errorType: "BLOCKED_CONTENT",
				};
			}

			const responseText = response.text();

			// 16. Check if response is empty
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

			// 17. Parse the JSON response
			try {
				const parsedCharacter = JSON.parse(responseText) as GeneratedCharacter;

				// 18. Validate the response structure
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

				// 19. Validate sample dialogues structure
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

			// 20. Handle specific API errors (similar to main callGeminiAPI function)
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
