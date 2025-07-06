/**
 * Supported emotions for sprite classification
 * Maps to the 6 emotions supported by the bhadresh-savani/distilbert-base-uncased-emotion model
 */
export const SUPPORTED_EMOTIONS = [
	"sadness",
	"joy",
	"love",
	"anger",
	"fear",
	"surprise",
] as const;

export type SupportedEmotion = (typeof SUPPORTED_EMOTIONS)[number];

/**
 * Hugging Face API response type for text classification
 */
interface HuggingFaceClassificationResult {
	label: string;
	score: number;
}

/**
 * Singleton class for emotion classification using Hugging Face Inference API
 * Uses the bhadresh-savani/distilbert-base-uncased-emotion model via API calls
 */
class EmotionClassifier {
	private static instance: EmotionClassifier;
	private readonly apiUrl =
		"https://api-inference.huggingface.co/models/bhadresh-savani/distilbert-base-uncased-emotion";

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
			// 2. Prepare the API request
			const response = await fetch(this.apiUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey.trim()}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					inputs: text.trim(),
					options: {
						wait_for_model: true, // Wait if model is loading
					},
				}),
			});

			// 3. Check if the request was successful
			if (!response.ok) {
				if (response.status === 401) {
					console.error("Invalid Hugging Face API key");
					return null;
				}
				if (response.status === 429) {
					console.error("Hugging Face API rate limit exceeded");
					return null;
				}
				console.error(
					`Hugging Face API error: ${response.status} ${response.statusText}`,
				);
				return null;
			}

			// 4. Parse the response
			const results: HuggingFaceClassificationResult[] = await response.json();

			// 5. Handle API response errors
			if (!Array.isArray(results) || results.length === 0) {
				console.warn("Invalid response from Hugging Face API");
				return null;
			}

			// 6. Find the emotion with the highest confidence
			const topResult = results.reduce((prev, current) =>
				prev.score > current.score ? prev : current,
			);

			const detectedEmotion = topResult.label?.toLowerCase();

			// 7. Validate that the detected emotion is supported
			if (
				detectedEmotion &&
				SUPPORTED_EMOTIONS.includes(detectedEmotion as SupportedEmotion)
			) {
				console.log(
					`Detected emotion: ${detectedEmotion} (confidence: ${topResult.score.toFixed(3)})`,
				);
				return detectedEmotion as SupportedEmotion;
			}

			// 8. Log warning if emotion is not in our supported list
			console.warn(`Unsupported emotion detected: ${detectedEmotion}`);
			return null;
		} catch (error) {
			// 9. Handle network and other errors
			if (error instanceof TypeError && error.message.includes("fetch")) {
				console.error("Network error during emotion classification:", error);
			} else {
				console.error("Error during emotion classification:", error);
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
			return false;
		}

		try {
			// Use a simple test text to verify the API key
			const result = await this.classify("I am happy", apiKey);
			return result !== null;
		} catch {
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
