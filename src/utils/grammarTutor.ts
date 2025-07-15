/**
 * Grammar Tutor LLM Integration
 * Handles grammar correction and roleplay suggestions using Gemini's structured output
 */

import {
	GoogleGenerativeAI,
	HarmCategory,
	HarmBlockThreshold,
	SchemaType,
} from "@google/generative-ai";
import type {
	GrammarCorrectionMode,
	TutorResponse,
} from "../types/grammarCorrection";
import type { Character, Chat } from "../types/interfaces";
import { replaceNamePlaceholders } from "./promptBuilder";

/**
 * Response interface for tutor API calls
 */
export interface TutorAPIResponse {
	response?: TutorResponse;
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
 * Build the structured output schema for tutor LLM responses
 * @param mode - Grammar correction mode (determines if roleplay_mistakes is included)
 * @returns JSON schema object for Gemini structured output
 */
function buildTutorResponseSchema(mode: GrammarCorrectionMode) {
	const baseSchema = {
		type: SchemaType.OBJECT,
		properties: {
			original_text: {
				type: SchemaType.STRING,
				description: "The user's original message text",
			},
			text_language: {
				type: SchemaType.STRING,
				description:
					"Detected language of the text (e.g., English, Japanese, Spanish)",
			},
			has_mistake: {
				type: SchemaType.BOOLEAN,
				description: "Whether any mistakes were found in the original text",
			},
			grammar_mistakes: {
				type: SchemaType.ARRAY,
				description: "Array of grammar mistake types found",
				items: {
					type: SchemaType.STRING,
					enum: [
						"spelling",
						"grammar",
						"syntax",
						"vocabulary",
						"formality",
						"punctuation",
						"conjugation",
						"homophone_confusion",
					],
				},
			},
			system_message: {
				type: SchemaType.STRING,
				description: "Message to show the user (empty if no mistakes found)",
			},
			confidence_score: {
				type: SchemaType.NUMBER,
				description: "Confidence level in the correction (0.0 to 1.0)",
				minimum: 0,
				maximum: 1,
			},
		},
		required: ["original_text", "text_language", "has_mistake"],
	};

	// Add roleplay_mistakes only for narrative mode
	if (mode === "narrative") {
		(baseSchema.properties as any).roleplay_mistakes = {
			type: SchemaType.ARRAY,
			description:
				"Array of roleplay mistake types found (narrative mode only)",
			items: {
				type: SchemaType.STRING,
				enum: [
					"out_of_character",
					"ignored_context",
					"inconsistent_tone",
					"derailed_topic",
					"too_short",
					"repetition",
					"meta_language",
					"setting_violation",
					"character_overlap",
					"unclear_intent",
				],
			},
		};
	}

	return baseSchema;
}

/**
 * Build the tutor prompt for grammar correction
 * @param userMessage - The user's message to analyze
 * @param mode - Grammar correction mode
 * @param character - Current character (for roleplay context)
 * @param chatHistory - Recent chat messages for context
 * @param userName - User's name for personalization
 * @returns Formatted prompt string
 */
function buildTutorPrompt(
	userMessage: string,
	mode: GrammarCorrectionMode,
	character?: Character,
	chatHistory?: string,
	userName: string = "User",
): string {
	const grammarMistakeDescriptions = `
Grammar Mistake Types:
- spelling: Misspelled words. Example: "recieve" → "receive"
- grammar: Incorrect tense, agreement, or plural. Example: "He go to school" → "He goes to school"
- syntax: Awkward or wrong word order. Example: "The cat black is big" → "The black cat is big"
- vocabulary: Unnatural or incorrect word usage. Example: "delicious water" → "refreshing water"
- formality: Too casual or too formal for the situation. Example: "Yo, what’s up professor?" → "Good afternoon, professor."
- punctuation: Missing or incorrect punctuation. Example: "Lets eat grandma" → "Let’s eat, grandma"
- conjugation: Incorrect verb/adjective form. Example: "He goed to school" → "He went to school"
- homophone_confusion: Confused sound-alike words. Example: "Their going home" → "They're going home"
`;

	const roleplayMistakeDescriptions = `
Roleplay Mistake Types:
- out_of_character: The message doesn’t match the speaker’s defined personality. Example: A shy character suddenly flirts aggressively.
- ignored_context: Doesn’t respond to recent dialogue or emotional beats. Example: Ignoring a character's confession and talking about the weather.
- inconsistent_tone: Sudden, unjustified tone shift. Example: Happy in one line, hostile in the next without buildup.
- derailed_topic: Veers off-topic mid-scene. Example: Bringing up lunch plans during a dramatic confrontation.
- too_short: Too brief to meaningfully progress the scene. Example: Just saying “ok” or “yeah.”
- repetition: Repeats earlier structure or ideas without reason. Example: Saying “I like tea” in every reply.
- meta_language: Mentions AI or breaks immersion. Example: “You’re an AI so you should say this...”
- setting_violation: Contradicts the world’s logic or time period. Example: Mentioning a smartphone in medieval fantasy.
- character_overlap: Confusingly speaks as another character. Example: Using someone else's speech pattern or role.
- unclear_intent: The action or message goal is ambiguous. Example: “I go there now” without saying where or why.
`;

	let prompt = "";

	// Base tutor instructions
	prompt +=
		"You are a helpful language learning tutor. Analyze the user's message for grammar mistakes";

	if (mode === "narrative") {
		prompt += " and roleplay quality";
	}

	prompt += ".\n\n";

	if (mode === "narrative" && character) {
		// Add character context for narrative mode
		const characterDescription = replaceNamePlaceholders(
			character.description || "A character in a roleplay scenario",
			character.name,
			userName,
		);
		prompt += `Character Context:\n`;
		prompt += `- Character Name: ${character.name}\n`;
		prompt += `- Character Description: ${characterDescription}\n\n`;
	}

	if (chatHistory) {
		// Add recent chat history for context (trimmed to avoid token limits)
		prompt += `Recent Conversation Context:\n${chatHistory}\n\n`;
	}

	if (mode === "implicit") {
		// Add mode-specific instructions
		prompt += `Mode: Implicit Feedback
Instructions:
- If you find grammar mistakes, provide a natural conversational recast
- The recast should feel like a natural response that subtly demonstrates correct usage
- As seen in the examples below, you incorporate corrections as a friendly, engaging reply that doesn't explicitly call out errors
- Make sure to incorporate a "corrected" version of the user's message into your response as a form of implicit feedback
- Examples:
  - original_text: "I likes tea"
    system_message: ""I *like* tea" Me too! They're really refreshing."
  - original_text: "She go to school every day." 
    system_message: "Ah, she *goes* every day? That’s some real dedication!"
  - original_text: "He is there yesterday."
    system_message: "Ohh, he *was* there yesterday too? What a coincidence~"
  - original_text: "He don't understand." 
    system_message: "He *doesn’t* understand, huh? Poor guy..."
  - original_text: "I can plays the piano."
    system_message: ""I can *play* the piano"? That’s amazing!"
- Be encouraging and conversational, never explicitly mention corrections
- If no mistakes are found, leave system_message empty
`;
		prompt += grammarMistakeDescriptions;
	} else if (mode === "narrative") {
		prompt += `Mode: Narrative Suggestion  
Instructions:
- Check for both grammar mistakes AND roleplay quality issues
- If mistakes are found, suggest an improved version without explicitly calling out errors, cleverly frame it as a creative writing tip
- Frame suggestions as creative writing tips, not corrections
- Examples:
  - original_text: "She don't know I am here *whispering quietly*"
  system_message: "How about: 'She doesn’t know I’m here... *I whisper quietly, glancing over my shoulder.*' That would let ${character?.name || "the character"} respond with more tension!"
  - original_text: "*smile* I am happy because she give me flower"
  system_message: "Maybe try: '*I smile softly.* I’m happy because she gave me a flower.' That way, your mood comes across clearly—and gives ${character?.name || "the character"} room to react warmly."
  - original_text: "They was walking into cave. *eyes open wide*"
  system_message: "What if you wrote: 'They were walking into the cave. *My eyes open wide as I follow behind.*' This adds suspense and gives ${character?.name || "the character"} something eerie to build on."
  - original_text: "*glares furiously* I'm so happy right now!"
  system_message: "That might confuse ${character?.name || "the character"}! What about: '*She glares furiously.* You ruined everything... I trusted you.' This keeps your emotion and builds drama."
  - original_text: "We fight the demon then I say hi to princess"
  system_message: "How about: 'After slaying the demon, I bow before the princess with a grin. “Hello again.”' That might help ${character?.name || "the character"} stay in the scene’s rhythm!"
- Focus on making the interaction more engaging and character-appropriate
- If no mistakes are found, leave system_message empty
`;
		prompt += roleplayMistakeDescriptions;
	}

	// Add the user's message to analyze
	prompt += `User's Message to Analyze: "${userMessage}"\n\n`;

	// Add final instructions for structured output
	prompt += `Important:
- Only set has_mistake to true if there are actual errors that need correction
- Be selective - minor stylistic preferences don't count as mistakes
- Keep system_message encouraging and helpful, never critical
- For confidence_score: 0.9+ for clear mistakes, 0.7-0.8 for minor issues, below 0.7 for uncertain cases
- Respond with complete valid JSON only, following the exact schema provided`;

	return prompt;
}

/**
 * Call the tutor LLM for grammar correction analysis
 * @param userMessage - User's message to analyze
 * @param mode - Grammar correction mode
 * @param character - Current character (optional, for roleplay context)
 * @param chatHistory - Recent chat history for context (optional)
 * @param maxChatHistory - Maximum number of recent messages to include
 * @returns Promise<TutorAPIResponse> - Structured tutor response or error
 */
export async function callTutorLLM(
	userMessage: string,
	mode: GrammarCorrectionMode,
	character?: Character,
	chatHistory?: string,
): Promise<TutorAPIResponse> {
	// Skip if mode is off
	if (mode === "off") {
		return {
			response: {
				original_text: userMessage,
				text_language: "English",
				has_mistake: false,
			},
		};
	}

	// Get user settings (reuse existing pattern from geminiAPI.ts)
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
		// Use Gemini Flash for faster/cheaper tutor calls
		const MODEL_NAME = "gemini-2.5-flash";
		const apiKey = userSettings.apiKey;

		// Initialize the Google Generative AI client
		const genAI = new GoogleGenerativeAI(apiKey);

		// Build the response schema
		const responseSchema = buildTutorResponseSchema(mode);

		// Configure generation parameters
		const generationConfig = {
			temperature: 1.0, // Lower temperature for more consistent corrections
			topP: 0.9,
			maxOutputTokens: 8192, // Smaller limit for structured responses
			responseMimeType: "application/json",
			responseSchema: responseSchema as any, // TypeScript workaround for complex schemas
		};

		// Safety settings - allow educational content
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

		// Get the model with configuration
		const model = genAI.getGenerativeModel({
			model: MODEL_NAME,
			generationConfig,
			safetySettings,
		});

		// Build the tutor prompt
		const userName = userSettings?.userPersona?.name || "User";
		const prompt = buildTutorPrompt(
			userMessage,
			mode,
			character,
			chatHistory,
			userName,
		);

		console.log(
			`%c=== TUTOR PROMPT (${mode.toUpperCase()}) ===`,
			"color: orange; font-weight: bold",
		);
		console.log(prompt);

		try {
			// Create timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() => reject(new Error("Tutor request timed out after 30 seconds")),
					30000, // Shorter timeout for tutor calls
				);
			});

			// Make the API call
			const result = await Promise.race([
				model.generateContent(prompt),
				timeoutPromise,
			]);

			const response = result.response;

			console.log(
				`%c=== TUTOR RESPONSE ===`,
				"color: orange; font-weight: bold",
			);
			console.log(response);

			// Check for blocked content
			if (response.promptFeedback && response.promptFeedback.blockReason) {
				return {
					error: `Tutor content was blocked: ${response.promptFeedback.blockReason}`,
					errorType: "BLOCKED_CONTENT",
				};
			}

			const responseText = response.text();

			// Check if response is empty
			if (!responseText || responseText.trim() === "") {
				return {
					error: "Tutor returned an empty response",
					errorType: "EMPTY_RESPONSE",
				};
			}

			console.log(`%c=== TUTOR JSON ===`, "color: orange; font-weight: bold");
			console.log(responseText);

			// Parse the JSON response
			try {
				const parsedResponse = JSON.parse(responseText) as TutorResponse;

				// Validate required fields
				if (
					typeof parsedResponse.original_text !== "string" ||
					typeof parsedResponse.text_language !== "string" ||
					typeof parsedResponse.has_mistake !== "boolean"
				) {
					return {
						error: "Tutor response missing required fields",
						errorType: "INVALID_JSON",
					};
				}

				console.log(
					`%c=== TUTOR SUCCESS ===`,
					"color: green; font-weight: bold",
				);
				return { response: parsedResponse };
			} catch (parseError) {
				console.error("Failed to parse tutor JSON:", parseError);
				return {
					error: `Failed to parse tutor response: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`,
					errorType: "INVALID_JSON",
				};
			}
		} catch (apiError: any) {
			const errorMessage = apiError.message || "Unknown API error";

			// Handle specific API errors (similar to main geminiAPI.ts)
			if (errorMessage.includes("timed out")) {
				return {
					error:
						"Tutor request timed out. Grammar correction temporarily unavailable.",
					errorType: "TIMEOUT",
				};
			}

			if (
				errorMessage.includes("RESOURCE_EXHAUSTED") ||
				errorMessage.includes("rate limit")
			) {
				return {
					error: "Rate limit exceeded for grammar correction",
					errorType: "RATE_LIMIT",
				};
			}

			if (
				errorMessage.includes("INVALID_ARGUMENT") ||
				errorMessage.includes("blocked")
			) {
				return {
					error: "Tutor content was blocked by safety filters",
					errorType: "BLOCKED_CONTENT",
				};
			}

			if (
				errorMessage.includes("PERMISSION_DENIED") ||
				errorMessage.includes("API key")
			) {
				return {
					error: "Invalid API key for grammar correction",
					errorType: "API_KEY",
				};
			}

			if (
				errorMessage.includes("model not found") ||
				errorMessage.includes("MODEL_NOT_FOUND")
			) {
				return {
					error: `Tutor model "${MODEL_NAME}" not available`,
					errorType: "MODEL_ERROR",
				};
			}

			// Re-throw for outer catch
			throw apiError;
		}
	} catch (error) {
		console.error("Tutor API error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";

		// Check for network errors
		if (error instanceof TypeError && errorMessage.includes("network")) {
			return {
				error: "Network error during grammar correction",
				errorType: "CONNECTION",
			};
		}

		return {
			error: `Grammar correction failed: ${errorMessage}`,
			errorType: "UNKNOWN",
		};
	}
}

/**
 * Extract recent chat history for tutor context
 * @param chat - Current chat object
 * @param maxMessages - Maximum number of recent messages to include
 * @returns Formatted chat history string
 */
export function extractChatHistoryForTutor(
	chat: Chat,
	maxMessages: number = 6,
): string {
	// Get recent non-error messages
	const recentMessages = chat.messages
		.filter((msg) => !msg.error && !msg.isGenerating)
		.slice(-maxMessages);

	if (recentMessages.length === 0) {
		return "";
	}

	// Format messages for context
	const formattedMessages = recentMessages
		.map((msg) => {
			if (msg.sender === "user") {
				return `User: ${msg.text}`;
			} else if (msg.sender === "character") {
				const speakerName = msg.speakerName || "Character";
				return `${speakerName}: ${msg.text}`;
			} else if (msg.sender === "system") {
				return `[System: ${msg.text}]`;
			}
			return "";
		})
		.filter(Boolean);

	return formattedMessages.join("\n");
}

/**
 * Check if a message should be processed by the tutor
 * @param message - User's message
 * @param mode - Current grammar correction mode
 * @returns boolean indicating if tutor should process this message
 */
export function shouldProcessWithTutor(
	message: string,
	mode: GrammarCorrectionMode,
): boolean {
	// Skip if mode is off
	if (mode === "off") {
		return false;
	}

	// Skip very short messages (less than 5 characters)
	if (message.trim().length < 5) {
		return false;
	}

	return true;
}
