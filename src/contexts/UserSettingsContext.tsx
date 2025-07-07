import {
	createContext,
	useState,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useCallback,
} from "react";
import type React from "react";
import type { ReactNode } from "react";
import { storageManager } from "../utils/storageManager";

export interface UserPersona {
	name: string;
	description: string;
}

// Available Gemini model options
export const GEMINI_MODELS = {
	FLASH_EXP: "gemini-2.5-flash",
	FLASH_LITE: "gemini-2.0-flash-lite",
	FLASH_THINKING: "gemini-2.0-flash-thinking-exp-01-21",
	PRO_25_EXP: "gemini-2.5-pro-exp-03-25",
};

interface UserSettingsContextType {
	apiKey: string;
	setApiKey: (key: string) => void;
	huggingFaceApiKey: string;
	setHuggingFaceApiKey: (key: string) => void;
	userPersona: UserPersona;
	setUserPersona: (persona: UserPersona) => void;
	isApiKeySet: boolean;
	selectedModel: string;
	setSelectedModel: (model: string) => void;
	temperature: number;
	setTemperature: (temp: number) => void;
	visualNovelMode: boolean;
	setVisualNovelMode: (enabled: boolean) => void;
}

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

export const useUserSettings = () => {
	const context = useContext(UserSettingsContext);
	if (!context) {
		throw new Error(
			"useUserSettings must be used within a UserSettingsProvider",
		);
	}
	return context;
};

interface UserSettingsProviderProps {
	children: ReactNode;
}

export const UserSettingsProvider: React.FC<UserSettingsProviderProps> = ({
	children,
}) => {
	// State for settings - these will be loaded from storage
	const [apiKey, setApiKeyState] = useState<string>("");
	const [huggingFaceApiKey, setHuggingFaceApiKeyState] = useState<string>("");
	const [userPersona, setUserPersonaState] = useState<UserPersona>({
		name: "User",
		description: "A friendly user chatting with characters.",
	});
	const [selectedModel, setSelectedModelState] = useState<string>(
		GEMINI_MODELS.FLASH_EXP,
	);
	const [temperature, setTemperatureState] = useState<number>(1.5);
	const [visualNovelMode, setVisualNovelModeState] = useState<boolean>(false);
	const [isLoaded, setIsLoaded] = useState<boolean>(false);

	// Use refs to always get current values without stale closures
	const currentSettings = useRef({
		apiKey: "",
		huggingFaceApiKey: "",
		userPersona: {
			name: "User",
			description: "A friendly user chatting with characters.",
		},
		selectedModel: GEMINI_MODELS.FLASH_EXP,
		temperature: 1.5,
		visualNovelMode: false,
	});

	// Update refs whenever state changes
	useEffect(() => {
		currentSettings.current = {
			apiKey,
			huggingFaceApiKey,
			userPersona,
			selectedModel,
			temperature,
			visualNovelMode,
		};
	}, [
		apiKey,
		huggingFaceApiKey,
		userPersona,
		selectedModel,
		temperature,
		visualNovelMode,
	]);

	// Unified save function that always uses current values
	const saveCurrentSettings = useCallback(async () => {
		try {
			console.log("💾 Saving settings:", {
				...currentSettings.current,
				apiKey: "[HIDDEN]",
				huggingFaceApiKey: currentSettings.current.huggingFaceApiKey
					? "[HIDDEN]"
					: "empty",
			});
			await storageManager.saveSettings(currentSettings.current);
		} catch (error) {
			console.error("❌ Error saving settings:", error);
		}
	}, []);

	// Load settings from storage on mount
	useEffect(() => {
		async function loadSettingsFromStorage() {
			try {
				// 1. Initialize storage manager
				await storageManager.initialize();

				// 2. Migrate any old localStorage data
				await storageManager.migrateFromOldLocalStorage();

				// 3. Load settings from current storage
				const settings = await storageManager.loadSettings();

				// 4. Update state with loaded settings
				setApiKeyState(settings.apiKey);
				setHuggingFaceApiKeyState(settings.huggingFaceApiKey || "");
				setUserPersonaState(settings.userPersona);
				setSelectedModelState(settings.selectedModel);
				setTemperatureState(settings.temperature);
				setVisualNovelModeState(settings.visualNovelMode || false);

				// 5. If new fields are missing from loaded settings, re-save to add them
				if (
					(!settings.huggingFaceApiKey ||
						settings.visualNovelMode === undefined) &&
					Object.keys(settings).length > 1
				) {
					console.log("🔄 Adding missing fields to existing settings");
					const updatedSettings = {
						...settings,
						huggingFaceApiKey: settings.huggingFaceApiKey || "",
						visualNovelMode: settings.visualNovelMode || false,
					};
					await storageManager.saveSettings(updatedSettings);
				}

				setIsLoaded(true);
				console.log("✅ User settings loaded from storage");
			} catch (error) {
				console.error("❌ Error loading settings:", error);
				// Keep default values if loading fails
				setIsLoaded(true);
			}
		}

		loadSettingsFromStorage();
	}, []);

	// Setting update functions with useCallback for stable references
	const setApiKey = useCallback(
		(key: string) => {
			console.log("🔑 Setting API key:", key ? "[HIDDEN]" : "empty");
			setApiKeyState(key);
			// Save after state update in next tick
			setTimeout(saveCurrentSettings, 0);
		},
		[saveCurrentSettings],
	);

	const setHuggingFaceApiKey = useCallback(
		(key: string) => {
			console.log(
				"🤗 Setting HuggingFace API key:",
				key ? "[HIDDEN]" : "empty",
			);
			setHuggingFaceApiKeyState(key);
			// Save after state update in next tick
			setTimeout(saveCurrentSettings, 0);
		},
		[saveCurrentSettings],
	);

	const setUserPersona = useCallback(
		(persona: UserPersona) => {
			console.log("👤 Setting user persona:", persona.name);
			setUserPersonaState(persona);
			// Save after state update in next tick
			setTimeout(saveCurrentSettings, 0);
		},
		[saveCurrentSettings],
	);

	const setSelectedModel = useCallback(
		(model: string) => {
			console.log("🤖 Setting selected model:", model);
			setSelectedModelState(model);
			// Save after state update in next tick
			setTimeout(saveCurrentSettings, 0);
		},
		[saveCurrentSettings],
	);

	const setTemperature = useCallback(
		(temp: number) => {
			console.log("🌡️ Setting temperature:", temp);
			setTemperatureState(temp);
			// Save after state update in next tick
			setTimeout(saveCurrentSettings, 0);
		},
		[saveCurrentSettings],
	);

	const setVisualNovelMode = useCallback(
		(enabled: boolean) => {
			console.log(
				"📚 Setting Visual Novel Mode:",
				enabled ? "enabled" : "disabled",
			);
			setVisualNovelModeState(enabled);
			// Save after state update in next tick
			setTimeout(saveCurrentSettings, 0);
		},
		[saveCurrentSettings],
	);

	// Compute derived state
	const isApiKeySet = useMemo(() => apiKey.trim().length > 0, [apiKey]);

	// Expose the context value
	const contextValue = useMemo(
		() => ({
			apiKey,
			setApiKey,
			huggingFaceApiKey,
			setHuggingFaceApiKey,
			userPersona,
			setUserPersona,
			isApiKeySet,
			selectedModel,
			setSelectedModel,
			temperature,
			setTemperature,
			visualNovelMode,
			setVisualNovelMode,
		}),
		[
			apiKey,
			setApiKey,
			huggingFaceApiKey,
			setHuggingFaceApiKey,
			userPersona,
			setUserPersona,
			isApiKeySet,
			selectedModel,
			setSelectedModel,
			temperature,
			setTemperature,
			visualNovelMode,
			setVisualNovelMode,
		],
	);

	// Make settings available globally for components that can't use context
	useEffect(() => {
		if (isLoaded) {
			(globalThis as Record<string, unknown>).__gengoTavernUserSettings = {
				apiKey,
				huggingFaceApiKey,
				userPersona,
				selectedModel,
				temperature,
				visualNovelMode,
			};
		}
	}, [
		isLoaded,
		apiKey,
		huggingFaceApiKey,
		userPersona,
		selectedModel,
		temperature,
		visualNovelMode,
	]);

	return (
		<UserSettingsContext.Provider value={contextValue}>
			{children}
		</UserSettingsContext.Provider>
	);
};
