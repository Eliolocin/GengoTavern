import { useState, useEffect } from "react";
import type { FC, ChangeEvent } from "react";
import type { Character, DialoguePair, Sprite } from "../../types/interfaces";
import placeholderImg from "../../assets/placeholder.jpg";
import { useCharacters } from "../../contexts/CharacterContext";
import ImageCropper from "../shared/ImageCropper";
import DeleteConfirmationModal from "../shared/DeleteConfirmationModal";
import EditFieldModal from "../shared/EditFieldModal";
import SaveAsOptionsModal from "../shared/SaveAsOptionsModal";
import { compressImage, getDataUrlSizeInKB } from "../../utils/imageUtils";
import { savePngAsBrowserDownload } from "../../utils/pngMetadata";
import BackgroundManagerModal from "../shared/BackgroundManagerModal";
import { storageManager } from "../../utils/storageManager";
import { SUPPORTED_EMOTIONS } from "../../utils/emotionClassifier";

interface CharacterFormProps {
	character: Character;
	onUpdateCharacter: (
		field: string,
		value: string | DialoguePair[] | Sprite[],
	) => void;
	onDeleteCharacter?: (id: number) => void;
}

// Define the structure for edit field state
interface EditFieldState {
	isOpen: boolean;
	field: string;
	value: string;
	title: string;
	description: string;
	multiline: boolean;
	dialogueIndex?: number;
	dialogueField?: "user" | "character";
}

const CharacterForm: FC<CharacterFormProps> = ({
	character,
	onUpdateCharacter,
	onDeleteCharacter,
}) => {
	const { exportCharacterAsJson } = useCharacters();
	const [dialogues, setDialogues] = useState<DialoguePair[]>(
		character.sampleDialogues || [{ user: "", character: "" }],
	);
	const [isUploading, setIsUploading] = useState(false);
	const [cropImage, setCropImage] = useState<string | null>(null);
	const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
	const [showSaveOptions, setShowSaveOptions] = useState(false);
	const [editField, setEditField] = useState<EditFieldState>({
		isOpen: false,
		field: "",
		value: "",
		title: "",
		description: "",
		multiline: true,
	});
	const [isBgManagerOpen, setIsBgManagerOpen] = useState(false);
	const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<
		string | null
	>(null);

	// Sprite management states
	const [sprites, setSprites] = useState<Sprite[]>(character.sprites || []);
	const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
	const [isCropperForSprite, setIsCropperForSprite] = useState(false);
	const [spriteUrls, setSpriteUrls] = useState<Record<string, string>>({});
	const [isLoadingSprite, setIsLoadingSprite] = useState(false);
	const [spriteErrorMessage, setSpriteErrorMessage] = useState<string | null>(
		null,
	);

	// Update dialogues state when character prop changes
	useEffect(() => {
		setDialogues(character.sampleDialogues || [{ user: "", character: "" }]);
	}, [character.sampleDialogues]);

	// Update sprites state when character prop changes
	useEffect(() => {
		setSprites(character.sprites || []);
	}, [character.sprites]);

	// Effect to load the background preview URL
	useEffect(() => {
		let isMounted = true;
		const loadPreview = async () => {
			if (character.defaultBackground) {
				try {
					const url = await storageManager.loadBackgroundAsUrl(
						character.defaultBackground,
					);
					if (isMounted) {
						setBackgroundPreviewUrl(url);
					}
				} catch (error) {
					console.error("Failed to load background preview:", error);
					if (isMounted) {
						setBackgroundPreviewUrl(null);
					}
				}
			} else {
				setBackgroundPreviewUrl(null);
			}
		};

		loadPreview();

		return () => {
			isMounted = false;
			if (backgroundPreviewUrl) {
				URL.revokeObjectURL(backgroundPreviewUrl);
			}
		};
	}, [character.defaultBackground, backgroundPreviewUrl]);

	// Load sprite images when component mounts or sprites change
	useEffect(() => {
		const loadSpriteImages = async () => {
			try {
				// First, scan the filesystem for sprites and update the character's sprites array
				const updatedSprites =
					await storageManager.scanAndUpdateCharacterSprites(character);

				// If we found sprites in the filesystem, update our local state
				if (updatedSprites.length > 0) {
					setSprites(updatedSprites);
				}

				// Now load the sprite URLs for display
				const urls: Record<string, string> = {};

				// Load each sprite
				for (const sprite of updatedSprites) {
					try {
						const url = await storageManager.loadSpriteAsUrl(
							character.id,
							sprite.filename,
						);
						urls[sprite.emotion] = url;
					} catch (error) {
						console.warn(
							`Failed to load sprite for ${sprite.emotion}:`,
							error.message || error,
						);
						// Continue loading other sprites even if one fails
					}
				}

				setSpriteUrls(urls);
			} catch (error) {
				console.error("Error loading sprites:", error);
			}
		};

		loadSpriteImages();
	}, [character]);

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsUploading(true);

		try {
			// Create a temporary URL for the cropper
			const tempImageUrl = URL.createObjectURL(file);
			setCropImage(tempImageUrl);
			setIsCropperForSprite(false);
		} catch (error) {
			console.error("Error handling image upload:", error);
			alert("Error uploading image: " + error);
			setIsUploading(false);
		}
	};

	const handleSpriteUpload = (
		e: ChangeEvent<HTMLInputElement>,
		emotion: string,
	) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setSelectedEmotion(emotion);
		setIsLoadingSprite(true);

		try {
			// Create a temporary URL for the cropper
			const tempImageUrl = URL.createObjectURL(file);
			setCropImage(tempImageUrl);
			setIsCropperForSprite(true);
		} catch (error) {
			console.error(`Error handling sprite upload: ${error}`);
			setSpriteErrorMessage("Error uploading sprite image");
			setIsLoadingSprite(false);
		}
	};

	const handleCroppedImage = async (croppedImageUrl: string) => {
		if (isCropperForSprite) {
			await handleCroppedSprite(croppedImageUrl);
		} else {
			await handleCroppedAvatar(croppedImageUrl);
		}
	};

	const handleCroppedAvatar = async (croppedImageUrl: string) => {
		try {
			// Compress the cropped image
			const originalSizeKB = getDataUrlSizeInKB(croppedImageUrl);

			// Only compress if the image is large
			if (originalSizeKB > 200) {
				// If larger than 200KB
				const compressedImageUrl = await compressImage(
					croppedImageUrl,
					800,
					1200,
					0.8,
				);
				const compressedSizeKB = getDataUrlSizeInKB(compressedImageUrl);

				console.log(
					`Image compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB (${Math.round((1 - compressedSizeKB / originalSizeKB) * 100)}% reduction)`,
				);

				// Update with compressed image
				onUpdateCharacter("image", compressedImageUrl);
			} else {
				// Use original if it's already small
				onUpdateCharacter("image", croppedImageUrl);
			}
		} catch (error) {
			console.error("Error compressing image:", error);
			// Fallback to original image if compression fails
			onUpdateCharacter("image", croppedImageUrl);
		}

		setCropImage(null);
		setIsUploading(false);
	};

	const handleCroppedSprite = async (croppedImage: string) => {
		if (!selectedEmotion) return;

		setIsLoadingSprite(true);

		try {
			// Use a consistent filename based on emotion type
			const filename = `${selectedEmotion}.png`;

			// Save the sprite image
			await storageManager.saveSprite(character.id, filename, croppedImage);

			// Update sprites array
			const updatedSprites = sprites.filter(
				(s) => s.emotion !== selectedEmotion,
			);
			updatedSprites.push({
				emotion: selectedEmotion,
				filename: filename,
			});

			setSprites(updatedSprites);
			onUpdateCharacter("sprites", updatedSprites);

			// Update sprite URLs for preview
			setSpriteUrls((prev) => ({
				...prev,
				[selectedEmotion]: croppedImage,
			}));

			setSpriteErrorMessage(null);
		} catch (error) {
			console.error("Failed to save sprite:", error);
			setSpriteErrorMessage("Failed to save sprite image");
		} finally {
			setIsLoadingSprite(false);
			setSelectedEmotion(null);
			setCropImage(null);
			setIsCropperForSprite(false);
		}
	};

	const handleDeleteSprite = async (emotion: string) => {
		setIsLoadingSprite(true);

		try {
			// Find the sprite to delete
			const spriteToDelete = sprites.find((s) => s.emotion === emotion);
			if (!spriteToDelete) return;

			// Delete the sprite file
			await storageManager.deleteSprite(character.id, spriteToDelete.filename);

			// Update sprites array
			const updatedSprites = sprites.filter((s) => s.emotion !== emotion);
			setSprites(updatedSprites);
			onUpdateCharacter("sprites", updatedSprites);

			// Update sprite URLs
			setSpriteUrls((prev) => {
				const updated = { ...prev };
				delete updated[emotion];
				return updated;
			});

			setSpriteErrorMessage(null);
		} catch (error) {
			console.error("Failed to delete sprite:", error);
			setSpriteErrorMessage("Failed to delete sprite image");
		} finally {
			setIsLoadingSprite(false);
		}
	};

	const handleCancelCrop = () => {
		setCropImage(null);
		setIsUploading(false);
		if (isCropperForSprite) {
			setIsLoadingSprite(false);
			setSelectedEmotion(null);
			setIsCropperForSprite(false);
		}
	};

	const handleSelectBackground = (filename: string) => {
		onUpdateCharacter("defaultBackground", filename);
	};

	const handleRemoveBackground = () => {
		onUpdateCharacter("defaultBackground", "");
	};

	const handleDialogueChange = (
		index: number,
		field: "user" | "character",
		value: string,
	) => {
		const newDialogues = dialogues.map((dialogue, i) => {
			if (i === index) {
				return { ...dialogue, [field]: value };
			}
			return dialogue;
		});

		setDialogues(newDialogues);
		onUpdateCharacter("sampleDialogues", newDialogues);
	};

	const addDialogue = () => {
		const newDialogues = [...dialogues, { user: "", character: "" }];
		setDialogues(newDialogues);
		onUpdateCharacter("sampleDialogues", newDialogues);
	};

	const removeDialogue = (index: number) => {
		if (dialogues.length > 1) {
			const newDialogues = dialogues.filter((_, i) => i !== index);
			setDialogues(newDialogues);
			onUpdateCharacter("sampleDialogues", newDialogues);
		}
	};

	// Updated to show options modal instead of saving directly
	const handleSaveAsPng = async () => {
		setShowSaveOptions(true);
	};

	// New handlers for the modal actions
	const handleSaveBackup = async () => {
		try {
			await savePngAsBrowserDownload(character, {
				includeChats: true,
				includeBackground: true,
			});
			setShowSaveOptions(false);
		} catch (error) {
			console.error("Failed to save character backup:", error);
		}
	};

	const handleSaveShare = async () => {
		try {
			await savePngAsBrowserDownload(character, {
				includeChats: false,
				includeBackground: false,
			});
			setShowSaveOptions(false);
		} catch (error) {
			console.error("Failed to save character share copy:", error);
		}
	};

	// @ts-ignore Used to export as Json for debugging
	const handleSaveAsJson = async () => {
		try {
			await exportCharacterAsJson(character);
		} catch (error) {
			console.error("Failed to save character as JSON:", error);
		}
	};

	const confirmDelete = () => {
		if (onDeleteCharacter) {
			onDeleteCharacter(character.id);
		}
		setShowDeleteConfirmation(false);
	};

	// Open edit modal for regular fields
	const openEditModal = (
		field: string,
		value: string,
		title: string,
		description: string,
		multiline = true,
	) => {
		setEditField({
			isOpen: true,
			field,
			value,
			title,
			description,
			multiline,
		});
	};

	// Open edit modal for dialogue fields
	const openDialogueEditModal = (
		index: number,
		field: "user" | "character",
		value: string,
	) => {
		const title =
			field === "user" ? "Edit User Message" : "Edit Character Response";
		const description =
			field === "user"
				? "Enter what the user says or does to the character in this example dialogue."
				: "Enter how the character would respond to the user in this example dialogue.";

		setEditField({
			isOpen: true,
			field: "dialogue",
			value,
			title,
			description,
			multiline: true,
			dialogueIndex: index,
			dialogueField: field,
		});
	};

	// Handle saving from edit modal
	const handleSaveEdit = (newValue: string) => {
		if (
			editField.field === "dialogue" &&
			editField.dialogueIndex !== undefined &&
			editField.dialogueField
		) {
			// Handle dialogue field
			handleDialogueChange(
				editField.dialogueIndex,
				editField.dialogueField,
				newValue,
			);
		} else {
			// Handle regular field
			onUpdateCharacter(editField.field, newValue);
		}
		setEditField({ ...editField, isOpen: false });
	};

	// Handle cancel from edit modal
	const handleCancelEdit = () => {
		setEditField({ ...editField, isOpen: false });
	};

	// Handle sprite item keyboard navigation
	const handleSpriteKeyDown = (
		e: React.KeyboardEvent<HTMLDivElement>,
		emotion: string,
		hasSprite: boolean,
	) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			if (!hasSprite && !isLoadingSprite) {
				document.getElementById(`sprite-upload-${emotion}`)?.click();
			}
		}
	};

	return (
		<div className="character-customization">
			{isBgManagerOpen && (
				<BackgroundManagerModal
					onClose={() => setIsBgManagerOpen(false)}
					onSelect={handleSelectBackground}
					selectedBackground={character.defaultBackground}
				/>
			)}

			{cropImage && (
				<ImageCropper
					src={cropImage}
					onCrop={handleCroppedImage}
					onCancel={handleCancelCrop}
					aspectRatio={isCropperForSprite ? 2 / 3 : undefined} // Use 2:3 aspect ratio for sprites
				/>
			)}

			{showDeleteConfirmation && (
				<DeleteConfirmationModal
					onConfirm={confirmDelete}
					onCancel={() => setShowDeleteConfirmation(false)}
					characterName={character.name}
					title="Delete Character"
					message={`Are you sure you want to delete ${character.name}?`}
				/>
			)}

			{showSaveOptions && (
				<SaveAsOptionsModal
					character={character}
					onSaveBackup={handleSaveBackup}
					onSaveShare={handleSaveShare}
					onCancel={() => setShowSaveOptions(false)}
				/>
			)}

			{editField.isOpen && (
				<EditFieldModal
					title={editField.title}
					description={editField.description}
					value={editField.value}
					multiline={editField.multiline}
					onSave={handleSaveEdit}
					onCancel={handleCancelEdit}
				/>
			)}

			<div className="character-form-header">
				<h3>Edit Character</h3>
				{onDeleteCharacter && (
					<button
						type="button"
						className="delete-character-button"
						onClick={() => setShowDeleteConfirmation(true)}
					>
						Delete
					</button>
				)}
			</div>

			<div className="character-avatar-wrapper">
				<img
					src={character.image || placeholderImg}
					alt="Character Avatar"
					className="character-avatar"
				/>
				<div className="avatar-upload-overlay">
					<label htmlFor="avatar-upload" className="upload-button">
						{isUploading ? "Uploading..." : "Change Image"}
					</label>
					<input
						id="avatar-upload"
						type="file"
						accept="image/*"
						onChange={handleImageUpload}
						className="hidden-input"
					/>
				</div>
			</div>

			<div className="form-actions">
				<button
					type="button"
					className="save-character-button"
					onClick={handleSaveAsPng}
				>
					Export Character
				</button>
				{/* JSON export button temporarily disabled
        <button type="button" className="save-json-button" onClick={handleSaveAsJson}>
          Save as JSON
        </button>
        */}
			</div>

			<div className="form-group">
				<label htmlFor="character-name">
					Character Name:
					<div
						className="editable-field"
						onClick={() =>
							openEditModal(
								"name",
								character.name,
								"Edit Character Name",
								"The name of your character as it will appear in chats.",
								false,
							)
						}
					>
						<input
							id="character-name"
							type="text"
							value={character.name}
							readOnly
							required
						/>
					</div>
				</label>
			</div>

			<div className="form-group">
				<label htmlFor="character-description">
					Description:
					<div
						className="editable-field"
						onClick={() =>
							openEditModal(
								"description",
								character.description || "",
								"Edit Character Description",
								"Describe your character's personality, background, and any other relevant details.",
							)
						}
					>
						<textarea
							id="character-description"
							placeholder="Character personality..."
							value={character.description || ""}
							readOnly
							rows={4}
						/>
					</div>
				</label>
			</div>

			<div className="form-group sample-dialogues">
				<label>Sample Dialogues:</label>
				{dialogues.map((dialogue, index) => (
					<div key={index} className="dialogue-pair-container">
						<div className="dialogue-pair">
							<div
								className="editable-field"
								onClick={() =>
									openDialogueEditModal(index, "user", dialogue.user)
								}
							>
								<input
									type="text"
									placeholder="User:"
									value={dialogue.user}
									readOnly
								/>
							</div>
							<div
								className="editable-field"
								onClick={() =>
									openDialogueEditModal(index, "character", dialogue.character)
								}
							>
								<input
									type="text"
									placeholder="Character:"
									value={dialogue.character}
									readOnly
								/>
							</div>
						</div>
						<button
							type="button"
							className="remove-dialogue"
							onClick={() => removeDialogue(index)}
							disabled={dialogues.length <= 1}
						>
							-
						</button>
					</div>
				))}
				<button type="button" className="add-dialogue" onClick={addDialogue}>
					+ Add Example
				</button>
			</div>

			<div className="form-group">
				<label htmlFor="default-scenario">
					Default Scenario:
					<div
						className="editable-field"
						onClick={() =>
							openEditModal(
								"defaultScenario",
								character.defaultScenario || "",
								"Edit Default Scenario",
								"This scenario sets the context for new chats with this character by default.",
							)
						}
					>
						<textarea
							id="default-scenario"
							placeholder="Default scenario"
							value={character.defaultScenario || ""}
							readOnly
							rows={3}
						/>
					</div>
				</label>
			</div>

			<div className="form-group">
				<label htmlFor="default-greeting">
					Default Greeting:
					<div
						className="editable-field"
						onClick={() =>
							openEditModal(
								"defaultGreeting",
								character.defaultGreeting || "",
								"Edit Default Greeting",
								"The message this character will send at the beginning of each new chat by default.",
							)
						}
					>
						<textarea
							id="default-greeting"
							placeholder="Default greeting"
							value={character.defaultGreeting || ""}
							readOnly
							rows={3}
						/>
					</div>
				</label>
			</div>

			<div className="form-group">
				<label>
					Default Background Image:
					<div className="upload-preview">
						{backgroundPreviewUrl && (
							<div className="background-preview-container">
								<img
									src={backgroundPreviewUrl}
									alt="Background Preview"
									className="background-preview"
								/>
							</div>
						)}
						<div className="background-actions">
							<button
								type="button"
								className="primary-button"
								onClick={() => setIsBgManagerOpen(true)}
							>
								Select Background
							</button>
							{character.defaultBackground && (
								<button
									type="button"
									className="secondary-button"
									onClick={handleRemoveBackground}
								>
									Remove
								</button>
							)}
						</div>
					</div>
				</label>
			</div>

			{/* Sprite Management Section */}
			<div className="form-group sprite-management-section">
				<h4 id="character-sprites-label">Character Sprites:</h4>
				{spriteErrorMessage && (
					<div className="error-message">{spriteErrorMessage}</div>
				)}
				<p className="sprites-description">
					Upload sprites for each emotion to enable Visual Novel mode. Click on
					any empty slot to add a sprite.
				</p>

				<div className="sprites-grid" aria-labelledby="character-sprites-label">
					{SUPPORTED_EMOTIONS.map((emotion) => {
						const hasSprite = spriteUrls[emotion] !== undefined;
						return (
							<div
								key={emotion}
								className="sprite-item"
								onClick={() => {
									if (!hasSprite && !isLoadingSprite) {
										document
											.getElementById(`sprite-upload-${emotion}`)
											?.click();
									}
								}}
								onKeyDown={(e) => handleSpriteKeyDown(e, emotion, hasSprite)}
								tabIndex={0}
								role="button"
								aria-label={`${hasSprite ? "Edit" : "Add"} ${emotion} sprite`}
							>
								<div className="sprite-thumbnail">
									{hasSprite ? (
										<>
											<img
												src={spriteUrls[emotion]}
												alt={`${emotion} sprite`}
												className="sprite-thumbnail-image"
											/>
											<div className="sprite-actions-overlay">
												<button
													type="button"
													className="sprite-action-button replace-button"
													onClick={(e) => {
														e.stopPropagation();
														document
															.getElementById(`sprite-upload-${emotion}`)
															?.click();
													}}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.preventDefault();
															document
																.getElementById(`sprite-upload-${emotion}`)
																?.click();
														}
													}}
													disabled={isLoadingSprite}
													aria-label={`Replace ${emotion} sprite`}
												>
													↺
												</button>
												<button
													type="button"
													className="sprite-action-button delete-button"
													onClick={(e) => {
														e.stopPropagation();
														handleDeleteSprite(emotion);
													}}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.preventDefault();
															handleDeleteSprite(emotion);
														}
													}}
													disabled={isLoadingSprite}
													aria-label={`Delete ${emotion} sprite`}
												>
													✕
												</button>
											</div>
										</>
									) : (
										<div className="sprite-placeholder">
											<span>+</span>
										</div>
									)}
								</div>
								<div className="sprite-label">
									{emotion.charAt(0).toUpperCase() + emotion.slice(1)}
								</div>
								<input
									type="file"
									id={`sprite-upload-${emotion}`}
									accept="image/*"
									style={{ display: "none" }}
									onChange={(e) => handleSpriteUpload(e, emotion)}
									disabled={isLoadingSprite}
									aria-label={`Upload ${emotion} sprite`}
								/>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
};

export default CharacterForm;
