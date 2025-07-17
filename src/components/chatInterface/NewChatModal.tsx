import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import type { Character } from "../../types/interfaces";
import { setupModalBackButtonHandler } from "../../utils/modalBackButtonHandler";
import BackgroundManagerModal from "../shared/BackgroundManagerModal";
import { storageManager } from "../../utils/storageManager";

interface NewChatModalProps {
	character: Character;
	onSave: (
		chatName: string,
		scenario: string,
		greeting: string,
		background: string,
	) => void;
	onCancel: () => void;
}

const NewChatModal: React.FC<NewChatModalProps> = ({
	character,
	onSave,
	onCancel,
}) => {
	const [chatName, setChatName] = useState("New Chat");
	const [scenario, setScenario] = useState(character.defaultScenario || "");
	const [greeting, setGreeting] = useState(character.defaultGreeting || "");
	const [background, setBackground] = useState("");
	const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
		null,
	);
	const [isBgManagerOpen, setIsBgManagerOpen] = useState(false);
	const [validationError, setValidationError] = useState("");

	// Focus the name input when the modal opens
	useEffect(() => {
		const timer = setTimeout(() => {
			const nameInput = document.getElementById("new-chat-name");
			if (nameInput) nameInput.focus();
		}, 100);
		// Set up back button handler
		const backButtonCleanup = setupModalBackButtonHandler(onCancel);

		// Return combined cleanup function
		return () => {
			clearTimeout(timer);
			backButtonCleanup();
		};
	}, [onCancel]); // Add onCancel to dependencies

	// Effect to load the background preview URL
	useEffect(() => {
		let isMounted = true;
		const loadPreview = async () => {
			if (background) {
				try {
					const url = await storageManager.loadBackgroundAsUrl(background);
					if (isMounted) {
						setBackgroundPreview(url);
					}
				} catch (error) {
					console.error("Failed to load background preview:", error);
					if (isMounted) {
						setBackgroundPreview(null);
					}
				}
			} else {
				setBackgroundPreview(null);
			}
		};

		loadPreview();

		return () => {
			isMounted = false;
			if (backgroundPreview) {
				URL.revokeObjectURL(backgroundPreview);
			}
		};
	}, [background, backgroundPreview]);

	const handleSelectBackground = (filename: string) => {
		setBackground(filename);
	};

	const validateForm = (): boolean => {
		// Check if greeting is provided either in the form or in character defaults
		if (!greeting && !character.defaultGreeting) {
			setValidationError(
				"Please enter a greeting or set a default greeting for the character",
			);
			return false;
		}

		// Check if scenario is provided either in the form or in character defaults
		if (!scenario && !character.defaultScenario) {
			setValidationError(
				"Please enter a scenario or set a default scenario for the character",
			);
			return false;
		}

		// Reset validation error if all is good
		setValidationError("");
		return true;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (validateForm()) {
			const finalScenario = scenario || character.defaultScenario || "";
			const finalGreeting = greeting || character.defaultGreeting || "";
			// Background is truly optional - no need for a default
			const finalBackground = background || "";

			onSave(
				chatName || "New Chat",
				finalScenario,
				finalGreeting,
				finalBackground,
			);
		}
	};

	const modalContent = (
		<div
			className="modal-overlay new-chat-modal-overlay"
			onClick={onCancel}
			onKeyDown={(e) => e.key === "Escape" && onCancel()}
			role="dialog"
			aria-modal="true"
		>
			{isBgManagerOpen && (
				<BackgroundManagerModal
					onClose={() => setIsBgManagerOpen(false)}
					onSelect={handleSelectBackground}
				/>
			)}
			<div
				className="modal-content new-chat-modal"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="document"
			>
				<h3>Create New Chat</h3>

				<form onSubmit={handleSubmit} className="new-chat-form">
					<div className="form-group">
						<label htmlFor="new-chat-name">Chat Name:</label>
						<input
							id="new-chat-name"
							type="text"
							value={chatName}
							onChange={(e) => setChatName(e.target.value)}
							placeholder="New Chat"
						/>
					</div>

					<div className="form-group">
						<label htmlFor="new-chat-scenario">Scenario:</label>
						<span className="default-note">
							The scenario sets the context for this new chat. Can be in any
							language.
						</span>
						<textarea
							id="new-chat-scenario"
							value={scenario}
							onChange={(e) => setScenario(e.target.value)}
							placeholder="Enter scenario or context for this chat"
							rows={3}
						/>
						{character.defaultScenario ? (
							<div className="default-filled-hint">
								Pre-filled from this character's defaults
							</div>
						) : (
							<div className="input-hint">This is required</div>
						)}
					</div>

					<div className="form-group">
						<label htmlFor="new-chat-greeting">Greeting:</label>
						<p className="default-note">
							The very first message sent in the chat by your Character. Should
							be based on the Scenario for consistency, and written in the
							language you want your Character to speak in.
						</p>

						<textarea
							id="new-chat-greeting"
							value={greeting}
							onChange={(e) => setGreeting(e.target.value)}
							placeholder="Enter greeting message from character"
							rows={3}
						/>
						{character.defaultGreeting ? (
							<div className="default-filled-hint">
								Pre-filled from this character's defaults
							</div>
						) : (
							<div className="input-hint">This is required</div>
						)}
					</div>

					<div className="form-group">
						<label>
							Background Image: <span className="default-note">(Optional)</span>
						</label>
						{backgroundPreview && (
							<img
								src={backgroundPreview}
								alt="Background Preview"
								className="background-preview"
							/>
						)}
						<button
							type="button"
							className="primary-button"
							onClick={() => setIsBgManagerOpen(true)}
						>
							Select Background
						</button>
						{background && (
							<button
								type="button"
								className="secondary-button"
								onClick={() => setBackground("")}
							>
								Remove
							</button>
						)}
					</div>

					{validationError && (
						<div className="validation-error">{validationError}</div>
					)}

					<div className="modal-actions">
						<button type="button" className="cancel-button" onClick={onCancel}>
							Cancel
						</button>
						<button type="submit" className="save-button">
							Create Chat
						</button>
					</div>
				</form>
			</div>
		</div>
	);

	// Use React Portal to render directly to document.body, bypassing all stacking contexts
	return createPortal(modalContent, document.body);
};

export default NewChatModal;
