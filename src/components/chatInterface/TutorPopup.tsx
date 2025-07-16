/**
 * TutorPopup Component
 * Displays grammar correction feedback as a dismissible popup next to user messages
 */

import { useState, useEffect } from "react";
import type { FC } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { MessageTutorData } from "../../types/grammarCorrection";
import MarkdownRenderer from "../shared/MarkdownRenderer";

interface TutorPopupProps {
	tutorData: MessageTutorData;
	messageId: number;
	onDismiss: (messageId: number) => void;
	isVisible?: boolean;
}

/**
 * TutorPopup displays grammar/roleplay feedback from the tutor LLM
 */
const TutorPopup: FC<TutorPopupProps> = ({
	tutorData,
	messageId,
	onDismiss,
	isVisible = true,
}) => {
	const [isReady, setIsReady] = useState(false);

	// Wait for parent layout to be ready before showing popup
	useEffect(() => {
		// Use multiple requestAnimationFrame calls to ensure layout is fully stable
		const frameId1 = requestAnimationFrame(() => {
			const frameId2 = requestAnimationFrame(() => {
				const frameId3 = requestAnimationFrame(() => {
					// Now we're confident the layout is stable
					setIsReady(true);
				});
				return () => cancelAnimationFrame(frameId3);
			});
			return () => cancelAnimationFrame(frameId2);
		});
		
		return () => cancelAnimationFrame(frameId1);
	}, []);

	// Skip rendering if dismissed or no system message
	if (tutorData.dismissed || !tutorData.response.system_message || !isVisible) {
		return null;
	}

	// Skip rendering if no mistakes detected
	if (!tutorData.response.has_mistake) {
		return null;
	}

	// Note: We no longer conditionally render, instead use CSS to control visibility

	/**
	 * Handle dismiss button click
	 */
	const handleDismiss = () => {
		console.log(`🚫 User dismissed tutor popup for message ${messageId}`);
		onDismiss(messageId);
	};

	/**
	 * Get CSS class for mode-specific styling
	 */
	const getModeClass = () => {
		switch (tutorData.mode) {
			case "implicit":
				return "tutor-popup-implicit";
			case "narrative":
				return "tutor-popup-narrative";
			default:
				return "tutor-popup-default";
		}
	};

	/**
	 * Get icon for the mode
	 */
	const getModeIcon = () => {
		switch (tutorData.mode) {
			case "implicit":
				return "💬"; // Speech bubble for conversational recast
			case "narrative":
				return "✨"; // Sparkles for creative suggestions
			default:
				return "📝"; // Default writing icon
		}
	};

	/**
	 * Get title for the popup based on mode
	 */
	const getPopupTitle = () => {
		switch (tutorData.mode) {
			case "implicit":
				return "Implicit Feedback";
			case "narrative":
				return "Narrative Suggestion";
			default:
				return "Grammar Tutor";
		}
	};

	return (
		<div
			className={`tutor-popup ${getModeClass()} ${isReady ? "ready" : ""}`}
			role="dialog"
			aria-labelledby={`tutor-popup-title-${messageId}`}
			aria-describedby={`tutor-popup-content-${messageId}`}
		>
			<div className="tutor-popup-header">
				<div className="tutor-popup-title-section">
					<span className="tutor-popup-icon" aria-hidden="true">
						{getModeIcon()}
					</span>
					<span
						id={`tutor-popup-title-${messageId}`}
						className="tutor-popup-title"
					>
						{getPopupTitle()}
					</span>
				</div>
				<button
					type="button"
					className="tutor-popup-dismiss"
					onClick={handleDismiss}
					aria-label="Dismiss grammar suggestion"
					title="Dismiss this suggestion"
				>
					<XMarkIcon className="tutor-popup-dismiss-icon" />
				</button>
			</div>

			<div
				id={`tutor-popup-content-${messageId}`}
				className="tutor-popup-content"
			>
				<MarkdownRenderer 
					content={tutorData.response.system_message} 
					processParentheses={false}
				/>
			</div>

			{/* Debug info (only in development) */}
			{process.env.NODE_ENV === "development" && (
				<div className="tutor-popup-debug">
					<details>
						<summary>More Info</summary>
						<div className="tutor-popup-debug-content">
							<p>
								<strong>Language:</strong> {tutorData.response.text_language}
							</p>
							<p>
								<strong>Confidence:</strong>{" "}
								{tutorData.response.confidence_score?.toFixed(2) || "N/A"}
							</p>
							{tutorData.response.grammar_mistakes &&
								tutorData.response.grammar_mistakes.length > 0 && (
									<p>
										<strong>Grammar Issues:</strong>{" "}
										{tutorData.response.grammar_mistakes.join(", ")}
									</p>
								)}
							{tutorData.response.roleplay_mistakes &&
								tutorData.response.roleplay_mistakes.length > 0 && (
									<p>
										<strong>Roleplay Issues:</strong>{" "}
										{tutorData.response.roleplay_mistakes.join(", ")}
									</p>
								)}
						</div>
					</details>
				</div>
			)}
		</div>
	);
};

export default TutorPopup;
