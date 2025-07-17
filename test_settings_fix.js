// Test script to verify settings saving/loading works correctly
// Run this in the browser console after opening the app

console.log("🧪 Testing Settings Storage Fix...");

// 1. Test if UserSettingsContext is available
const settings = globalThis.__gengoTavernUserSettings;
if (!settings) {
	console.error("❌ UserSettings context not available globally");
} else {
	console.log("✅ UserSettings context is available");
	console.log("Current settings:", {
		apiKey: settings.apiKey ? "[HIDDEN]" : "empty",
		huggingFaceApiKey: settings.huggingFaceApiKey ? "[HIDDEN]" : "empty",
		selectedModel: settings.selectedModel,
		temperature: settings.temperature,
	});
}

// 2. Test setting a HuggingFace API key
if (settings?.setHuggingFaceApiKey) {
	console.log("🔑 Testing HuggingFace API key setting...");

	// Set a test key
	settings.setHuggingFaceApiKey("hf_test_key_12345");

	// Wait a moment for async save
	setTimeout(() => {
		const updatedSettings = globalThis.__gengoTavernUserSettings;
		if (updatedSettings?.huggingFaceApiKey === "hf_test_key_12345") {
			console.log("✅ HuggingFace API key set correctly in memory");
		} else {
			console.error("❌ HuggingFace API key not set in memory");
		}

		// Check if it will persist (check settings file in next browser session)
		console.log(
			"💾 Settings should be saved to storage. Check settings.json file or localStorage.",
		);

		// Clean up test
		settings.setHuggingFaceApiKey("");
		console.log("🧹 Cleaned up test key");
	}, 100);
} else {
	console.error("❌ setHuggingFaceApiKey function not available");
}

// 3. Test model changes
if (settings?.setSelectedModel) {
	console.log("🤖 Testing model selection...");
	const originalModel = settings.selectedModel;

	// Change model
	settings.setSelectedModel("gemini-2.0-flash-lite");

	setTimeout(() => {
		const updatedSettings = globalThis.__gengoTavernUserSettings;
		if (updatedSettings?.selectedModel === "gemini-2.0-flash-lite") {
			console.log("✅ Model selection works correctly");

			// Restore original model
			settings.setSelectedModel(originalModel);
			console.log("🔄 Restored original model");
		} else {
			console.error("❌ Model selection not working");
		}
	}, 100);
}

console.log("🧪 Test complete. Check console output above for results.");
