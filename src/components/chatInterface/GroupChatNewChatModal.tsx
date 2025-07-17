import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import type { Character, GroupGreeting } from "../../types/interfaces";
import { isGroupChat, getOrderedGroupMembers } from "../../utils/groupChatUtils";
import { setupModalBackButtonHandler } from "../../utils/modalBackButtonHandler";
import BackgroundManagerModal from "../shared/BackgroundManagerModal";
import { storageManager } from "../../utils/storageManager";

interface GroupChatNewChatModalProps {
	groupChat: Character;
	allCharacters: Character[];
	onSave: (
		chatName: string,
		scenario: string,
		greetings: GroupGreeting[],
		background: string,
	) => void;
	onCancel: () => void;
}

const GroupChatNewChatModal: React.FC<GroupChatNewChatModalProps> = ({
	groupChat,
	allCharacters,
	onSave,
	onCancel,
}) => {
	const [chatName, setChatName] = useState("New Group Chat");
	const [scenario, setScenario] = useState("");
	const [selectedScenarioSource, setSelectedScenarioSource] = useState<number | null>(null);
	const [greetings, setGreetings] = useState<{ [characterId: number]: string }>({});
	const [background, setBackground] = useState("");
	const [selectedBackgroundSource, setSelectedBackgroundSource] = useState<number | null>(null);
	const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
	const [isBgManagerOpen, setIsBgManagerOpen] = useState(false);
	const [validationError, setValidationError] = useState("");
	
	// Ref to track if greetings have been initialized
	const greetingsInitialized = useRef(false);

	// Get ordered group members
	const orderedMembers = getOrderedGroupMembers(groupChat);
	const memberCharacters = orderedMembers
		.map(member => allCharacters.find(char => char.id === member.characterId))
		.filter((char): char is Character => char !== undefined);

	// Focus the name input when the modal opens
	useEffect(() => {
		const timer = setTimeout(() => {
			const nameInput = document.getElementById("group-chat-name");
			if (nameInput) nameInput.focus();
		}, 100);
		// Set up back button handler
		const backButtonCleanup = setupModalBackButtonHandler(onCancel);

		return () => {
			clearTimeout(timer);
			backButtonCleanup();
		};
	}, [onCancel]);

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

	// Initialize greetings with defaults only once when memberCharacters are available
	useEffect(() => {
		if (memberCharacters.length > 0 && !greetingsInitialized.current) {
			const initialGreetings: { [characterId: number]: string } = {};
			memberCharacters.forEach(character => {
				initialGreetings[character.id] = character.defaultGreeting || "";
			});
			setGreetings(initialGreetings);
			greetingsInitialized.current = true;
		}
	}, [memberCharacters]); // Only run when memberCharacters change and not yet initialized

	// Handle scenario source selection
	const handleScenarioSourceChange = (characterId: number | null) => {
		setSelectedScenarioSource(characterId);
		if (characterId === null) {
			setScenario("");
		} else {
			const character = memberCharacters.find(c => c.id === characterId);
			if (character && character.defaultScenario) {
				// Replace {{char}} with the topmost display order character (first member)
				const topCharacter = memberCharacters[0];
				const scenarioText = character.defaultScenario.replace(/\{\{char\}\}/g, topCharacter?.name || "");
				setScenario(scenarioText);
			} else {
				setScenario("");
			}
		}
	};

	// Handle background source selection
	const handleBackgroundSourceChange = (characterId: number | null) => {
		setSelectedBackgroundSource(characterId);
		if (characterId === null) {
			setBackground("");
		} else {
			const character = memberCharacters.find(c => c.id === characterId);
			setBackground(character?.defaultBackground || "");
		}
	};

	// Handle greeting changes
	const handleGreetingChange = (characterId: number, greeting: string) => {
		setGreetings(prev => ({
			...prev,
			[characterId]: greeting
		}));
	};

	const handleSelectBackground = (filename: string) => {
		setBackground(filename);
		setSelectedBackgroundSource(null); // Clear source selection when manually selecting
	};

	const validateForm = (): boolean => {
		// Check if at least one greeting is provided
		const hasAtLeastOneGreeting = Object.values(greetings).some(greeting => greeting.trim() !== "");
		if (!hasAtLeastOneGreeting) {
			setValidationError("At least one character must have a greeting message");
			return false;
		}

		// Check if scenario is provided
		if (!scenario.trim()) {
			setValidationError("Please enter a scenario or select a default from one of the characters");
			return false;
		}

		setValidationError("");
		return true;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (validateForm()) {
			// Convert greetings to GroupGreeting format
			const groupGreetings: GroupGreeting[] = Object.entries(greetings)
				.filter(([_, greeting]) => greeting.trim() !== "")
				.map(([characterId, greeting]) => ({
					characterId: Number(characterId),
					greeting: greeting.trim()
				}));

			onSave(
				chatName || "New Group Chat",
				scenario.trim(),
				groupGreetings,
				background
			);
		}
	};

	if (!isGroupChat(groupChat)) {
		return null;
	}

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
				<h3>Create New Group Chat</h3>

				<form onSubmit={handleSubmit} className="new-chat-form">
					<div className="form-group">
						<label htmlFor="group-chat-name">Chat Name:</label>
						<input
							id="group-chat-name"
							type="text"
							value={chatName}
							onChange={(e) => setChatName(e.target.value)}
							placeholder="New Group Chat"
						/>
					</div>

					<div className="form-group">
						<label htmlFor="group-chat-scenario">Scenario:</label>
						<div className="scenario-source-selector">
							<label>
								<input
									type="radio"
									name="scenario-source"
									checked={selectedScenarioSource === null}
									onChange={() => handleScenarioSourceChange(null)}
								/>
								Custom scenario
							</label>
							{memberCharacters.map(character => (
								character.defaultScenario && (
									<label key={character.id}>
										<input
											type="radio"
											name="scenario-source"
											checked={selectedScenarioSource === character.id}
											onChange={() => handleScenarioSourceChange(character.id)}
										/>
										Use {character.name}'s default
									</label>
								)
							))}
						</div>
						<textarea
							id="group-chat-scenario"
							value={scenario}
							onChange={(e) => setScenario(e.target.value)}
							placeholder="Enter scenario or context for this group chat"
							rows={3}
							disabled={selectedScenarioSource !== null}
						/>
						<div className="input-hint">
							Sets the context for this group chat. {`{{char}}`} tokens refer to {memberCharacters[0]?.name || "the first character"}.
						</div>
					</div>

					<div className="form-group">
						<label>Character Greetings:</label>
						<p className="default-note">
							Each character can have an opening message. At least one greeting is required.
							Characters are ordered by their display order in the group.
						</p>
						<div className="character-greetings">
							{memberCharacters.map((character, index) => (
								<div key={character.id} className="character-greeting-item">
									<label htmlFor={`greeting-${character.id}`}>
										{index + 1}. {character.name}:
									</label>
									<textarea
										id={`greeting-${character.id}`}
										value={greetings[character.id] || ""}
										onChange={(e) => handleGreetingChange(character.id, e.target.value)}
										placeholder={`Enter greeting message from ${character.name} (optional)`}
										rows={2}
									/>
									{character.defaultGreeting && greetings[character.id] === character.defaultGreeting && (
										<div className="default-filled-hint">
											Pre-filled from character's defaults
										</div>
									)}
								</div>
							))}
						</div>
					</div>

					<div className="form-group">
						<label>Background Image: <span className="default-note">(Optional)</span></label>
						<div className="background-source-selector">
							<label>
								<input
									type="radio"
									name="background-source"
									checked={selectedBackgroundSource === null}
									onChange={() => handleBackgroundSourceChange(null)}
								/>
								Custom background
							</label>
							{memberCharacters.map(character => (
								character.defaultBackground && (
									<label key={character.id}>
										<input
											type="radio"
											name="background-source"
											checked={selectedBackgroundSource === character.id}
											onChange={() => handleBackgroundSourceChange(character.id)}
										/>
										Use {character.name}'s default
									</label>
								)
							))}
						</div>
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
							disabled={selectedBackgroundSource !== null}
						>
							Select Background
						</button>
						{background && (
							<button
								type="button"
								className="secondary-button"
								onClick={() => {
									setBackground("");
									setSelectedBackgroundSource(null);
								}}
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
							Create Group Chat
						</button>
					</div>
				</form>
			</div>
		</div>
	);

	// Use React Portal to render directly to document.body, bypassing all stacking contexts
	return createPortal(modalContent, document.body);
};

export default GroupChatNewChatModal;