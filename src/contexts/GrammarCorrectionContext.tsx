/**
 * Grammar Correction Context
 * Manages grammar correction state and tutor data for messages
 */

import {
	createContext,
	useState,
	useContext,
	useCallback,
	useMemo,
} from "react";
import type React from "react";
import type { ReactNode } from "react";
import {
	DEFAULT_GRAMMAR_CORRECTION_SETTINGS,
	type GrammarCorrectionContextType,
	type GrammarCorrectionMode,
	type GrammarCorrectionSettings,
	type MessageTutorData,
} from "../types/grammarCorrection";

const GrammarCorrectionContext = createContext<GrammarCorrectionContextType | null>(null);

/**
 * Hook to use Grammar Correction context
 */
export const useGrammarCorrection = () => {
	const context = useContext(GrammarCorrectionContext);
	if (!context) {
		throw new Error(
			"useGrammarCorrection must be used within a GrammarCorrectionProvider",
		);
	}
	return context;
};

interface GrammarCorrectionProviderProps {
	children: ReactNode;
	mode: GrammarCorrectionMode; // Mode from UserSettingsContext
	setMode: (mode: GrammarCorrectionMode) => void; // Setter from UserSettingsContext
}

/**
 * Grammar Correction Provider Component
 * Manages tutor processing state and message-specific tutor data
 */
export const GrammarCorrectionProvider: React.FC<GrammarCorrectionProviderProps> = ({
	children,
	mode,
	setMode,
}) => {
	// Settings (using defaults, could be extended for per-user customization)
	const [settings] = useState<GrammarCorrectionSettings>(DEFAULT_GRAMMAR_CORRECTION_SETTINGS);

	// Tutor processing state
	const [isProcessingTutor, setIsProcessingTutor] = useState<boolean>(false);

	// Message-specific tutor data storage (messageId -> tutorData)
	const [messageTutorData, setMessageTutorDataState] = useState<Map<number, MessageTutorData>>(new Map());

	/**
	 * Update settings (placeholder for future extensibility)
	 */
	const updateSettings = useCallback((_updates: Partial<GrammarCorrectionSettings>) => {
		// TODO: Implement settings updates if needed
		console.log("⚙️ Grammar correction settings update not yet implemented");
	}, []);

	/**
	 * Get tutor data for a specific message
	 */
	const getMessageTutorData = useCallback((messageId: number): MessageTutorData | null => {
		return messageTutorData.get(messageId) || null;
	}, [messageTutorData]);

	/**
	 * Set tutor data for a specific message
	 */
	const setMessageTutorData = useCallback((messageId: number, data: MessageTutorData) => {
		console.log(`💾 Storing tutor data for message ${messageId}:`, {
			mode: data.mode,
			has_mistake: data.response.has_mistake,
			confidence: data.response.confidence_score,
			system_message: data.response.system_message ? "Present" : "None"
		});
		setMessageTutorDataState(prev => {
			const newMap = new Map(prev);
			newMap.set(messageId, data);
			return newMap;
		});
	}, []);

	/**
	 * Dismiss tutor popup for a specific message
	 * NOTE: This updates the context map, but the actual message object persistence
	 * should be handled by the caller (App.tsx) to ensure it's saved to storage
	 */
	const dismissTutorPopup = useCallback((messageId: number) => {
		console.log(`🗑️ Dismissing tutor popup for message ${messageId}`);
		setMessageTutorDataState(prev => {
			const existingData = prev.get(messageId);
			if (existingData) {
				const newMap = new Map(prev);
				newMap.set(messageId, {
					...existingData,
					dismissed: true,
				});
				return newMap;
			}
			return prev;
		});
	}, []);

	// Context value
	const contextValue = useMemo(() => ({
		// Settings
		settings,
		updateSettings,
		
		// Mode management
		mode,
		setMode,
		
		// Tutor processing state
		isProcessingTutor,
		setIsProcessingTutor,
		
		// Message-specific tutor data
		getMessageTutorData,
		setMessageTutorData,
		dismissTutorPopup,
	}), [
		settings,
		updateSettings,
		mode,
		setMode,
		isProcessingTutor,
		setIsProcessingTutor,
		getMessageTutorData,
		setMessageTutorData,
		dismissTutorPopup,
	]);

	return (
		<GrammarCorrectionContext.Provider value={contextValue}>
			{children}
		</GrammarCorrectionContext.Provider>
	);
};