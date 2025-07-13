/**
 * Type definitions for Grammar Correction feature
 * Supporting both Implicit Feedback and Narrative Suggestion modes
 */

/**
 * Grammar correction modes
 */
export type GrammarCorrectionMode = "off" | "implicit" | "narrative";

/**
 * Types of grammar mistakes that can be detected
 */
export type GrammarMistakeType = 
  | "spelling"              // Misspelled words (e.g. "recieve" instead of "receive")
  | "grammar"               // Incorrect tense, subject-verb agreement, pluralization, etc.
  | "syntax"                // Incorrect word order or awkward phrasing
  | "vocabulary"            // Unnatural or incorrect word choice
  | "formality"             // Inappropriate register (too casual/formal)
  | "punctuation"           // Incorrect or missing punctuation affecting readability
  | "conjugation"           // Wrong verb/adjective forms (especially in languages like Japanese)
  | "homophone_confusion";  // Confusion between similar-sounding words

/**
 * Types of roleplay mistakes that can be detected (Narrative Suggestion mode only)
 */
export type RoleplayMistakeType = 
  | "out_of_character"      // Line doesn't match the user's defined persona or tone
  | "ignored_context"       // Doesn't respond to or acknowledge previous dialogue/emotional cues
  | "inconsistent_tone"     // Abrupt mood/voice shift without narrative transition
  | "derailed_topic"        // Breaks flow by switching topics abruptly or unnaturally
  | "too_short"             // Message too brief to contribute meaningfully to the scene
  | "repetition"            // Reuses the same structure/content unnecessarily
  | "meta_language"         // Breaks immersion by referring to AI, prompts, or mechanics
  | "setting_violation"     // Says something inconsistent with the world
  | "character_overlap"     // Confusing or accidental speech by the wrong character
  | "unclear_intent";       // Message lacks clear action, tone, or communicative purpose

/**
 * Structured output response from tutor LLM
 */
export interface TutorResponse {
  original_text: string;                    // Required: User's original message
  text_language: string;                    // Required: Detected language (English, Japanese, etc.)
  has_mistake: boolean;                     // Required: Whether mistakes were found
  grammar_mistakes?: GrammarMistakeType[];  // Optional: Array of grammar error types
  roleplay_mistakes?: RoleplayMistakeType[]; // Optional: Only for Narrative Suggestion mode
  system_message?: string;                  // Optional: Message to show user (empty if no mistakes)
  confidence_score?: number;                // Optional: 0-1 confidence in corrections
}

/**
 * Tutor data stored with each message
 */
export interface MessageTutorData {
  mode: GrammarCorrectionMode;              // Mode used when generating this correction
  response: TutorResponse;                  // Full tutor response
  dismissed: boolean;                       // Whether user has dismissed the pop-up
  timestamp: number;                        // When tutor response was received
  hasBeenSeen: boolean;                     // Whether user has seen this suggestion (for VN mode)
}

/**
 * Grammar correction settings stored in user preferences
 */
export interface GrammarCorrectionSettings {
  mode: GrammarCorrectionMode;              // Current correction mode
  showConfidenceThreshold: number;          // Minimum confidence to show corrections (0-1)
  enabledLanguages: string[];               // Languages to provide corrections for
  maxChatHistoryForTutor: number;           // Number of messages to include in tutor context
}

/**
 * Default settings for grammar correction
 */
export const DEFAULT_GRAMMAR_CORRECTION_SETTINGS: GrammarCorrectionSettings = {
  mode: "off",
  showConfidenceThreshold: 0.7,
  enabledLanguages: ["English", "Japanese", "Spanish", "French", "German"],
  maxChatHistoryForTutor: 6,
};

/**
 * Context interface for Grammar Correction provider
 */
export interface GrammarCorrectionContextType {
  // Settings
  settings: GrammarCorrectionSettings;
  updateSettings: (updates: Partial<GrammarCorrectionSettings>) => void;
  
  // Mode management
  mode: GrammarCorrectionMode;
  setMode: (mode: GrammarCorrectionMode) => void;
  
  // Tutor processing state
  isProcessingTutor: boolean;
  setIsProcessingTutor: (processing: boolean) => void;
  
  // Message-specific tutor data
  getMessageTutorData: (messageId: number) => MessageTutorData | null;
  setMessageTutorData: (messageId: number, data: MessageTutorData) => void;
  dismissTutorPopup: (messageId: number) => void;
  
  // Unread state management (for VN mode notifications)
  unreadTutorSuggestions: Set<number>;
  getUnreadCount: () => number;
  hasUnreadSuggestions: () => boolean;
  markTutorAsRead: (messageId: number) => void;
  markAllTutorAsRead: () => void;
}