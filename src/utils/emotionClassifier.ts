/**
 * Supported sentiment levels for sprite classification
 * Maps to the 5 sentiment levels supported by the tabularisai/multilingual-sentiment-analysis model
 */
export const SUPPORTED_EMOTIONS = [
	"very_negative",
	"negative",
	"neutral",
	"positive",
	"very_positive",
] as const;

export type SupportedEmotion = (typeof SUPPORTED_EMOTIONS)[number];

/**
 * Maps the model's LABEL outputs to our supported emotions
 */
const LABEL_TO_EMOTION_MAP: Record<string, SupportedEmotion> = {
	"Very Negative": "very_negative",
	"Negative": "negative",
	"Neutral": "neutral",
	"Positive": "positive",
	"Very Positive": "very_positive",
};

/**
 * Hugging Face API response type for text classification
 */
interface HuggingFaceClassificationResult {
	label: string;
	score: number;
}

/**
 * Singleton class for emotion classification using Hugging Face Inference API
 * Uses the tabularisai/multilingual-sentiment-analysis model via API calls
 */
class EmotionClassifier {
	private static instance: EmotionClassifier;
	private readonly apiUrl =
		"https://api-inference.huggingface.co/models/tabularisai/multilingual-sentiment-analysis";

	private constructor() {}

	/**
	 * Gets the singleton instance of the EmotionClassifier
	 * @returns The EmotionClassifier instance
	 */
	public static getInstance(): EmotionClassifier {
		if (!EmotionClassifier.instance) {
			EmotionClassifier.instance = new EmotionClassifier();
		}
		return EmotionClassifier.instance;
	}

	/**
	 * Classifies the emotion of a given text message using Hugging Face API
	 * @param text - The text to analyze for emotion
	 * @param apiKey - The user's Hugging Face API key
	 * @returns Promise<SupportedEmotion | null> - The detected emotion, or null if classification fails
	 */
	public async classify(
		text: string,
		apiKey: string,
	): Promise<SupportedEmotion | null> {
		// 1. Validate inputs
		if (!text || typeof text !== "string" || text.trim().length === 0) {
			console.warn("Empty or invalid text provided to emotion classifier");
			return null;
		}

		if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
			console.warn(
				"No Hugging Face API key provided for emotion classification",
			);
			return null;
		}

		try {
			console.log(
				"🔍 Starting sentiment analysis for text:",
				`${text.substring(0, 100)}...`,
			);
			console.log("🔑 Using API key:", `${apiKey.substring(0, 8)}...`);

			// 2. Prepare the API request
			const requestBody = {
				inputs: text.trim(),
				options: {
					wait_for_model: true, // Wait if model is loading
				},
			};

			console.log("📤 Sending request to HuggingFace API:", {
				url: this.apiUrl,
				body: requestBody,
			});

			const response = await fetch(this.apiUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey.trim()}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
			});

			console.log("📥 Received response:", {
				status: response.status,
				statusText: response.statusText,
				ok: response.ok,
			});

			// 3. Check if the request was successful
			if (!response.ok) {
				if (response.status === 401) {
					console.error("❌ Invalid Hugging Face API key");
					return null;
				}
				if (response.status === 429) {
					console.error("❌ Hugging Face API rate limit exceeded");
					return null;
				}
				console.error(
					`❌ Hugging Face API error: ${response.status} ${response.statusText}`,
				);
				return null;
			}

			// 4. Parse the response
			const responseText = await response.text();
			console.log("📄 Raw response text:", responseText);

			let parsedResponse: unknown;
			try {
				parsedResponse = JSON.parse(responseText);
			} catch (parseError) {
				console.error("❌ Failed to parse JSON response:", parseError);
				console.error("Raw response was:", responseText);
				return null;
			}

			// Handle nested array structure - the API sometimes returns [[{...}]] instead of [{...}]
			let results: HuggingFaceClassificationResult[];

			if (Array.isArray(parsedResponse)) {
				// Check if it's a nested array structure [[{...}]]
				if (Array.isArray(parsedResponse[0])) {
					results = parsedResponse[0];
				} else {
					// Standard format [{...}]
					results = parsedResponse;
				}
			} else {
				console.warn("❌ Invalid response format - not an array");
				console.warn("Response:", parsedResponse);
				return null;
			}

			console.log("🔍 Parsed results:", results);

			// 5. Handle API response errors
			if (!Array.isArray(results) || results.length === 0) {
				console.warn(
					"❌ Invalid response from Hugging Face API - not an array or empty",
				);
				console.warn("Response type:", typeof results);
				console.warn("Response:", results);
				return null;
			}

			// 6. Find the emotion with the highest confidence
			const topResult = results.reduce((prev, current) =>
				prev.score > current.score ? prev : current,
			);

			console.log("🏆 Top result:", topResult);

			const detectedLabel = topResult.label;

			// 7. Map the label to our supported emotions
			let mappedEmotion = LABEL_TO_EMOTION_MAP[detectedLabel];
			
			// Handle different label formats that might be returned by the model
			if (!mappedEmotion) {
				// Try with "LABEL_" prefix if it's just a number
				if (/^\d+$/.test(detectedLabel)) {
					mappedEmotion = LABEL_TO_EMOTION_MAP[`LABEL_${detectedLabel}`];
				}
				// Try without "LABEL_" prefix if it has one
				else if (detectedLabel.startsWith("LABEL_")) {
					const numberOnly = detectedLabel.replace("LABEL_", "");
					mappedEmotion = LABEL_TO_EMOTION_MAP[`LABEL_${numberOnly}`];
				}
			}

			if (mappedEmotion) {
				console.log(
					`✅ Detected sentiment: ${mappedEmotion} (label: ${detectedLabel}, confidence: ${topResult.score.toFixed(3)})`,
				);
				return mappedEmotion;
			}

			// 8. Log warning if label is not in our mapping
			console.warn(`❌ Unsupported label detected: ${detectedLabel}`);
			console.warn("Supported labels:", Object.keys(LABEL_TO_EMOTION_MAP));
			console.warn("Full results:", results);
			return null;
		} catch (error) {
			// 9. Handle network and other errors
			console.error("❌ Error during sentiment analysis:", error);
			if (error instanceof TypeError && error.message.includes("fetch")) {
				console.error("Network error during sentiment analysis:", error);
			} else {
				console.error("Unexpected error during sentiment analysis:", error);
			}
			return null;
		}
	}

	/**
	 * Test the API key to ensure it's valid
	 * @param apiKey - The user's Hugging Face API key
	 * @returns Promise<boolean> - True if the API key is valid
	 */
	public async testApiKey(apiKey: string): Promise<boolean> {
		if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
			console.log("🔍 API Key test: Empty or invalid key provided");
			return false;
		}

		try {
			console.log("🔍 Testing API key with sentiment analysis...");
			// Use a simple test text to verify the API key
			const result = await this.classify("This is a test message", apiKey);
			const isValid = result !== null;
			console.log(`🔍 API Key test result: ${isValid ? "✅ Valid" : "❌ Invalid"}`);
			if (result) {
				console.log(`🔍 Test returned sentiment: ${result}`);
			}
			return isValid;
		} catch (error) {
			console.error("🔍 API Key test failed with error:", error);
			return false;
		}
	}

	/**
	 * Check if emotion classification is available (i.e., if an API key is provided)
	 * @param apiKey - The user's Hugging Face API key
	 * @returns boolean indicating if classification is available
	 */
	public isAvailable(apiKey: string): boolean {
		return Boolean(
			apiKey && typeof apiKey === "string" && apiKey.trim().length > 0,
		);
	}
}

// Export the singleton instance
export const emotionClassifier = EmotionClassifier.getInstance();
