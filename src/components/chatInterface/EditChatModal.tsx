import { useState, useEffect } from "react";
import type React from "react";
import type { Chat } from "../../types/interfaces";
import { setupModalBackButtonHandler } from "../../utils/modalBackButtonHandler";
import BackgroundManagerModal from "../shared/BackgroundManagerModal";
import { storageManager } from "../../utils/storageManager";

interface EditChatModalProps {
	chat: Chat;
	onSave: (chatName: string, scenario: string, background: string) => void;
	onCancel: () => void;
}

const EditChatModal: React.FC<EditChatModalProps> = ({
	chat,
	onSave,
	onCancel,
}) => {
	const [chatName, setChatName] = useState(chat.name || "");
	const [scenario, setScenario] = useState(chat.scenario || "");
	const [background, setBackground] = useState(chat.background || "");
	const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
		null,
	);
	const [isBgManagerOpen, setIsBgManagerOpen] = useState(false);

	// Focus the name input when the modal opens
	useEffect(() => {
		const timer = setTimeout(() => {
			const nameInput = document.getElementById("edit-chat-name");
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

	const handleRemoveBackground = () => {
		setBackground("");
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSave(chatName || `Chat ${chat.id}`, scenario, background);
	};

	return (
		<div
			className="modal-overlay"
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
				className="modal-content edit-chat-modal"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="document"
			>
				<h3>Edit Chat</h3>

				<form onSubmit={handleSubmit} className="edit-chat-form">
					<div className="form-group">
						<label htmlFor="edit-chat-name">Chat Name:</label>
						<input
							id="edit-chat-name"
							type="text"
							value={chatName}
							onChange={(e) => setChatName(e.target.value)}
							placeholder={`Chat ${chat.id}`}
						/>
					</div>

					<div className="form-group">
						<label htmlFor="edit-chat-scenario">Scenario:</label>
						<textarea
							id="edit-chat-scenario"
							value={scenario}
							onChange={(e) => setScenario(e.target.value)}
							placeholder="Enter scenario or context for this chat"
							rows={3}
						/>
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
								onClick={handleRemoveBackground}
							>
								Remove
							</button>
						)}
					</div>

					<div className="modal-actions">
						<button type="button" className="cancel-button" onClick={onCancel}>
							Cancel
						</button>
						<button type="submit" className="save-button">
							Save Changes
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default EditChatModal;
