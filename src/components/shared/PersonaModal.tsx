import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import DeleteConfirmationModal from "../shared/DeleteConfirmationModal";
import { setupModalBackButtonHandler } from "../../utils/modalBackButtonHandler";
import { storageManager } from "../../utils/storageManager";

interface PersonaProps {
	name: string;
	description: string;
}

interface PersonaModalProps {
	onClose: () => void;
	onSave: (persona: PersonaProps) => void;
	currentPersona: PersonaProps;
}

const PersonaModal: React.FC<PersonaModalProps> = ({
	onClose,
	onSave,
	currentPersona,
}) => {
	const [name, setName] = useState(currentPersona.name);
	const [description, setDescription] = useState(currentPersona.description);
	const [showResetConfirmation, setShowResetConfirmation] = useState(false);

	useEffect(() => {
		const nameInput = document.getElementById("persona-name-input");
		if (nameInput) nameInput.focus();
		// Set up back button handler
		const cleanup = setupModalBackButtonHandler(onClose);

		// Return cleanup function
		return cleanup;
	}, [onClose]); // Add onClose to dependencies

	const handleSave = () => {
		// Basic validation
		if (!name.trim()) {
			setName("User");
		}

		onSave({
			name: name.trim() || "User",
			description: description.trim(),
		});
		onClose();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.ctrlKey && e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			onClose();
		}
	};

	const handleResetAppData = () => {
		setShowResetConfirmation(true);
	};

	const confirmReset = async () => {
		try {
			// Use the storage manager to delete all user data
			await storageManager.deleteAllUserData();
			setShowResetConfirmation(false);

			// Reload the page to start fresh
			window.location.reload();
		} catch (error) {
			console.error("Error resetting app data:", error);
			alert("Failed to reset app data. See console for details.");
			setShowResetConfirmation(false);
		}
	};

	// @ts-ignore Export all data of user
	const exportAllData = () => {
		try {
			// Collect all data from localStorage
			const data: Record<string, any> = {};
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key) {
					const value = localStorage.getItem(key);
					if (value) {
						data[key] = JSON.parse(value);
					}
				}
			}

			// Create and download a JSON file
			const jsonString = JSON.stringify(data, null, 2);
			const blob = new Blob([jsonString], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.download = `gengo-tavern-backup-${new Date().toISOString().split("T")[0]}.json`;
			a.href = url;
			a.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Failed to export data:", error);
			alert("Failed to export data. See console for details.");
		}
	};

	// @ts-ignore Import all user data
	const importAllData = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "application/json";

		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;

			try {
				const text = await file.text();
				const data = JSON.parse(text);

				// Confirm before overwriting
				if (confirm("This will replace all your current data. Continue?")) {
					// Clear existing data
					localStorage.clear();

					// Add imported data
					Object.entries(data).forEach(([key, value]) => {
						localStorage.setItem(key, JSON.stringify(value));
					});

					// Reload to apply changes
					window.location.reload();
				}
			} catch (error) {
				console.error("Failed to import data:", error);
				alert("Failed to import data. See console for details.");
			}
		};

		input.click();
	};

	const modalContent = (
		<div className="modal-backdrop">
			<div
				className="modal-content persona-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<h3>User Persona Settings</h3>
					<button className="close-button" onClick={onClose}>
						×
					</button>
				</div>
				<div className="modal-body">
					<div className="persona-form-description">
						<p>
							Customize how the Chatbots refer to you / your character, as well as
							what information you want them to remember.
						</p>
					</div>

					<form className="persona-form">
						<div className="form-group">
							<label htmlFor="persona-name-input">User's Name</label>
							<input
								id="persona-name-input"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Enter your preferred name"
							/>
						</div>

						<div className="form-group">
							<label htmlFor="persona-description-input">
								User's Description
							</label>
							<textarea
								id="persona-description-input"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Describe yourself, your personality, or how you'd like to be portrayed in the chat"
								rows={5}
							/>
							<div className="input-hint">
								This description will be provided to the AI to better understand
								your character
							</div>
						</div>
					</form>
				</div>

				{/* Data Management section commented out
        <div className="data-management-zone">
          <h4>Data Management</h4>
          <div className="data-buttons">
            <button 
              className="export-data-button"
              onClick={exportAllData}
              type="button"
            >
              Export All Data
            </button>
            <button 
              className="import-data-button"
              onClick={importAllData}
              type="button"
            >
              Import Data
            </button>
          </div>
          <p className="data-management-note">Export your data regularly to prevent loss.</p>
        </div>
        */}

				<div className="persona-modal danger-zone">
					<h3>Danger Zone</h3>
					<p>
						This will delete all characters, chats, and settings.
					</p>
					<button
						className="modal-button danger"
						onClick={handleResetAppData}
						type="button"
					>
						Reset App Data
					</button>
				</div>

				<div className="modal-footer">
					<button className="modal-button secondary" onClick={onClose}>
						Cancel
					</button>
					<button className="modal-button primary" onClick={handleSave}>
						Save Persona
					</button>
				</div>
			</div>

			{showResetConfirmation && (
				<DeleteConfirmationModal
					onConfirm={confirmReset}
					onCancel={() => setShowResetConfirmation(false)}
					characterName="all app data"
					title="Reset App Data"
					message="Are you sure you want to reset all app data? This will delete all characters, chats, and settings, and cannot be undone."
				/>
			)}
		</div>
	);

	return createPortal(modalContent, document.body);
};

export default PersonaModal;
