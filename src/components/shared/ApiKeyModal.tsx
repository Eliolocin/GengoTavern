import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { GEMINI_MODELS } from "../../contexts/UserSettingsContext";
import { setupModalBackButtonHandler } from "../../utils/modalBackButtonHandler";
import { emotionClassifier } from "../../utils/emotionClassifier";

interface ApiKeyModalProps {
	onClose: () => void;
	onSave: (apiKey: string, huggingFaceApiKey: string) => void;
	currentApiKey: string;
	currentHuggingFaceApiKey: string;
	currentModel: string;
	onModelChange: (model: string) => void;
	currentTemperature: number;
	onTemperatureChange: (temp: number) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
	onClose,
	onSave,
	currentApiKey,
	currentHuggingFaceApiKey,
	currentModel,
	onModelChange,
	currentTemperature = 1.5, // Provide default value here
	onTemperatureChange,
}) => {
	const [apiKey, setApiKey] = useState(currentApiKey);
	const [huggingFaceApiKey, setHuggingFaceApiKey] = useState(
		currentHuggingFaceApiKey,
	);
	const [showApiKey, setShowApiKey] = useState(false);
	const [showHuggingFaceApiKey, setShowHuggingFaceApiKey] = useState(false);
	const [validationMessage, setValidationMessage] = useState("");
	const [selectedModel, setSelectedModel] = useState(currentModel);
	// Ensure temperature always has a fallback value of 1.5
	const [temperature, setTemperature] = useState(
		typeof currentTemperature === "number" ? currentTemperature : 1.5,
	);

	// Hugging Face API key validation state
	const [isTestingHfKey, setIsTestingHfKey] = useState(false);
	const [hfKeyValidation, setHfKeyValidation] = useState<{
		status: "none" | "testing" | "valid" | "invalid";
		message: string;
	}>({ status: "none", message: "" });

	useEffect(() => {
		const keyInput = document.getElementById("api-key-input");
		if (keyInput) keyInput.focus();

		const cleanup = setupModalBackButtonHandler(onClose);
		return cleanup;
	}, [onClose]);

	// Test the Hugging Face API key
	const testHuggingFaceApiKey = useCallback(async (key: string) => {
		if (!key || key.trim().length === 0) {
			setHfKeyValidation({ status: "none", message: "" });
			return;
		}

		setIsTestingHfKey(true);
		setHfKeyValidation({ status: "testing", message: "Testing API key..." });

		try {
			const isValid = await emotionClassifier.testApiKey(key.trim());
			if (isValid) {
				setHfKeyValidation({
					status: "valid",
					message: "API key is valid and working!",
				});
			} else {
				setHfKeyValidation({
					status: "invalid",
					message: "API key is invalid or has insufficient permissions",
				});
			}
		} catch (error) {
			setHfKeyValidation({
				status: "invalid",
				message: "Error testing API key - please check your connection",
			});
		} finally {
			setIsTestingHfKey(false);
		}
	}, []);

	// Auto-test HF key when it changes (with debounce)
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			testHuggingFaceApiKey(huggingFaceApiKey);
		}, 1000); // 1 second debounce

		return () => clearTimeout(timeoutId);
	}, [huggingFaceApiKey, testHuggingFaceApiKey]);

	const handleSave = () => {
		if (apiKey.length < 10) {
			setValidationMessage(
				"Google API key appears to be too short. Please check and try again.",
			);
			return;
		}

		// Save both API keys
		onSave(apiKey, huggingFaceApiKey);
		onModelChange(selectedModel);
		onTemperatureChange(temperature);
		onClose();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSave();
		} else if (e.key === "Escape") {
			onClose();
		}
	};

	const getModelDisplayName = (modelId: string) => {
		switch (modelId) {
			case GEMINI_MODELS.FLASH_EXP:
				return "Gemini 2.5 Flash (Balanced)";
			case GEMINI_MODELS.FLASH_LITE:
				return "Gemini 2.0 Flash Lite (Faster)";
			case GEMINI_MODELS.FLASH_THINKING:
				return "Gemini 2.0 Flash Thinking (More Creative)";
			case GEMINI_MODELS.PRO_25_EXP:
				return "Gemini Pro 2.5 Experimental (Latest, 2 Uses per Minute)";
			default:
				return modelId;
		}
	};

	// Function to get temperature label - ensure it handles undefined by using a default
	const getTemperatureLabel = (temp: number) => {
		if (temp <= 1.1) return "Normal";
		if (temp <= 1.4) return "Slightly Creative";
		if (temp <= 1.6) return "Creative";
		if (temp <= 1.8) return "More Creative";
		return "Schizo";
	};

	return (
		<div className="modal-backdrop" onClick={onClose} onKeyDown={handleKeyDown}>
			<div
				className="modal-content api-key-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<h3>API Settings</h3>
					<button type="button" className="close-button" onClick={onClose}>
						×
					</button>
				</div>
				<div className="modal-body">
					<p className="modal-description">
						Configure your API keys and model preferences. All settings are
						stored only on your browser and never sent to any server.
					</p>

					{/* Google API Key Section */}
					<div className="api-key-input-container">
						<label htmlFor="api-key-input">Google API Key:</label>
						<div className="secure-input-wrapper">
							<input
								id="api-key-input"
								type={showApiKey ? "text" : "password"}
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Enter your Google Gemini API key"
								className="secure-input"
							/>
							<button
								type="button"
								className="toggle-visibility-button"
								onClick={() => setShowApiKey(!showApiKey)}
								title={showApiKey ? "Hide API key" : "Show API key"}
							>
								{showApiKey ? "👁️" : "👁️‍🗨️"}
							</button>
						</div>
						<div className="model-description">
							<span>
								GengoTavern uses Google AI to power the Chatbots, requiring an
								API key.
							</span>
						</div>
						<div className="input-hint">
							<span>Do not share this key with anyone.</span>
						</div>
					</div>

					{/* Hugging Face API Key Section */}
					<div className="api-key-input-container">
						<label htmlFor="hf-api-key-input">
							Hugging Face API Key (Optional):
						</label>
						<div className="secure-input-wrapper">
							<input
								id="hf-api-key-input"
								type={showHuggingFaceApiKey ? "text" : "password"}
								value={huggingFaceApiKey}
								onChange={(e) => setHuggingFaceApiKey(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Enter your Hugging Face API key (for emotion detection)"
								className="secure-input"
							/>
							<button
								type="button"
								className="toggle-visibility-button"
								onClick={() => setShowHuggingFaceApiKey(!showHuggingFaceApiKey)}
								title={showHuggingFaceApiKey ? "Hide API key" : "Show API key"}
							>
								{showHuggingFaceApiKey ? "👁️" : "👁️‍🗨️"}
							</button>
						</div>

						{/* HF API Key Validation Status */}
						{hfKeyValidation.status !== "none" && (
							<div className={`validation-status ${hfKeyValidation.status}`}>
								{hfKeyValidation.status === "testing" && "🔄 "}
								{hfKeyValidation.status === "valid" && "✅ "}
								{hfKeyValidation.status === "invalid" && "❌ "}
								{hfKeyValidation.message}
							</div>
						)}

						<div className="model-description">
							<span>
								Required for Visual Novel mode sprite emotions. Uses Hugging
								Face's emotion classification API.
							</span>
						</div>
						<div className="input-hint">
							<span>Leave empty to disable emotion-based sprite changes.</span>
						</div>
					</div>

					<div className="model-selection-container">
						<label htmlFor="model-select">Model:</label>
						<select
							id="model-select"
							className="model-select"
							value={selectedModel}
							onChange={(e) => setSelectedModel(e.target.value)}
						>
							<option value={GEMINI_MODELS.FLASH_EXP}>
								{getModelDisplayName(GEMINI_MODELS.FLASH_EXP)}
							</option>
							<option value={GEMINI_MODELS.FLASH_LITE}>
								{getModelDisplayName(GEMINI_MODELS.FLASH_LITE)}
							</option>
							<option value={GEMINI_MODELS.FLASH_THINKING}>
								{getModelDisplayName(GEMINI_MODELS.FLASH_THINKING)}
							</option>
							<option value={GEMINI_MODELS.PRO_25_EXP}>
								{getModelDisplayName(GEMINI_MODELS.PRO_25_EXP)}
							</option>
						</select>

						<div className="model-description">
							{selectedModel === GEMINI_MODELS.FLASH_EXP && (
								<span>Balanced model with good performance and quality</span>
							)}
							{selectedModel === GEMINI_MODELS.FLASH_LITE && (
								<span>Faster responses with slightly reduced quality</span>
							)}
							{selectedModel === GEMINI_MODELS.FLASH_THINKING && (
								<span>More creative responses at the cost of speed</span>
							)}
							{selectedModel === GEMINI_MODELS.PRO_25_EXP && (
								<span>
									Latest experimental model with enhanced capabilities (2
									Requests per Minute only)
								</span>
							)}
						</div>
					</div>

					<div className="temperature-selection-container">
						<label htmlFor="temperature-slider">
							Creativity:{" "}
							<span className="temperature-value">
								{/* Guard against undefined temperature */}
								{(temperature || 1.5).toFixed(1)} -{" "}
								{getTemperatureLabel(temperature)}
							</span>
						</label>
						<div className="temperature-slider-container">
							<input
								id="temperature-slider"
								type="range"
								min="1.0"
								max="2.0"
								step="0.1"
								value={temperature || 1.5} // Guard against undefined
								onChange={(e) =>
									setTemperature(Number.parseFloat(e.target.value))
								}
								className="temperature-slider"
							/>
							<div className="temperature-labels">
								<span className="temp-label-min">Normal</span>
								<span className="temp-label-mid">Creative</span>
								<span className="temp-label-max">Schizo</span>
							</div>
						</div>
						<div className="model-description">
							<span>
								Also known as the model's Temperature. Lower values make
								responses more predictable while higher values make responses
								more varied.
							</span>
						</div>
					</div>

					{validationMessage && (
						<div className="validation-error">{validationMessage}</div>
					)}

					<div className="info-box">
						<p>
							<strong>How to get API keys:</strong>
						</p>

						<div className="api-instructions">
							<h4>Google API Key (Required):</h4>
							<ol>
								<li>
									Go to{" "}
									<a
										href="https://aistudio.google.com/prompts/new_chat"
										target="_blank"
										rel="noopener noreferrer"
									>
										Google AI Studio
									</a>
								</li>
								<li>Sign in with any Google account</li>
								<li>Click on "Get API Key" on the top-left</li>
								<li>Create a new API key</li>
								<li>Copy and paste the API key above</li>
							</ol>

							<h4>Hugging Face API Key (Optional - for Visual Novel Mode):</h4>
							<ol>
								<li>
									Go to{" "}
									<a
										href="https://huggingface.co/settings/tokens"
										target="_blank"
										rel="noopener noreferrer"
									>
										Hugging Face Settings
									</a>
								</li>
								<li>Sign in or create a free account</li>
								<li>Click "New token"</li>
								<li>Give it a name like "GengoTavern"</li>
								<li>Select "Read" permission</li>
								<li>Copy and paste the token above</li>
							</ol>
							<p>
								<em>
									Note: Hugging Face has a generous free tier that should be
									sufficient for emotion detection.
								</em>
							</p>
						</div>
					</div>
				</div>
				<div className="modal-footer">
					<button type="button" className="cancel-button" onClick={onClose}>
						Cancel
					</button>
					<button type="button" className="save-button" onClick={handleSave}>
						Save Settings
					</button>
				</div>
			</div>
		</div>
	);
};

export default ApiKeyModal;
