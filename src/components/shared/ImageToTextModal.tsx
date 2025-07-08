import { useState } from 'react';
import type React from 'react';
import type { DialoguePair } from '../../types/interfaces';
import { generateCharacterFromImage, type GeneratedCharacter } from '../../utils/geminiAPI';
import ImageCropper from './ImageCropper';

interface ImageToTextModalProps {
	isOpen: boolean;
	onClose: () => void;
	onAccept: (characterData: GeneratedCharacterData) => void;
}

export interface GeneratedCharacterData {
	name: string;
	description: string;
	sampleDialogues: DialoguePair[];
	defaultScenario: string;
	defaultGreeting: string;
	image: string; // The cropped image as data URL for character display
}

type ModalState = 'input' | 'generating' | 'preview' | 'error';

/**
 * Modal for creating characters from uploaded images using AI
 * @param isOpen - Whether the modal is currently displayed
 * @param onClose - Callback to close the modal
 * @param onAccept - Callback when user accepts the generated character
 */
const ImageToTextModal: React.FC<ImageToTextModalProps> = ({
	isOpen,
	onClose,
	onAccept,
}) => {
	// 1. Component state
	const [modalState, setModalState] = useState<ModalState>('input');
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null); // Original image for generation
	const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null); // Cropped image for character display
	const [showImageCropper, setShowImageCropper] = useState<boolean>(false);
	const [characterName, setCharacterName] = useState<string>('');
	const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
	const [generatedCharacter, setGeneratedCharacter] = useState<GeneratedCharacter | null>(null);
	const [errorMessage, setErrorMessage] = useState<string>('');
	const [isGenerating, setIsGenerating] = useState<boolean>(false);

	if (!isOpen) return null;

	/**
	 * 2. Handle image file selection
	 * @param e - File input change event
	 */
	const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			// 1. Validate file type
			if (!file.type.startsWith('image/')) {
				alert('Please select a valid image file.');
				return;
			}

			// 2. Validate file size (max 10MB)
			if (file.size > 10 * 1024 * 1024) {
				alert('Image file size must be less than 10MB.');
				return;
			}

			// 3. Set the selected file
			setSelectedImage(file);

			// 4. Create original image URL for generation
			const reader = new FileReader();
			reader.onload = (e) => {
				const imageUrl = e.target?.result as string;
				setOriginalImageUrl(imageUrl);
				// Open cropper for user to crop the display image
				setShowImageCropper(true);
			};
			reader.readAsDataURL(file);
		}
	};

	/**
	 * 3. Handle successful crop
	 * @param croppedImageUrl - The cropped image data URL
	 */
	const handleCropComplete = (croppedImageUrl: string) => {
		setCroppedImageUrl(croppedImageUrl);
		setShowImageCropper(false);
	};

	/**
	 * 4. Handle crop cancel
	 */
	const handleCropCancel = () => {
		// Reset everything if cropping is cancelled
		setSelectedImage(null);
		setOriginalImageUrl(null);
		setCroppedImageUrl(null);
		setShowImageCropper(false);
	};

	/**
	 * 5. Handle character generation
	 */
	const handleGenerate = async () => {
		// 1. Validate inputs
		if (!selectedImage || !croppedImageUrl) {
			alert('Please select and crop an image first.');
			return;
		}

		if (!characterName.trim()) {
			alert('Please enter a character name.');
			return;
		}

		// 2. Set loading state
		setModalState('generating');
		setIsGenerating(true);
		setErrorMessage('');

		try {
			// 3. Call the generation API
			const result = await generateCharacterFromImage(
				selectedImage,
				characterName.trim(),
				additionalInstructions.trim() || undefined
			);

			// 4. Handle the response
			if (result.error) {
				setErrorMessage(result.error);
				setModalState('error');
			} else if (result.character) {
				setGeneratedCharacter(result.character);
				setModalState('preview');
			} else {
				setErrorMessage('Unknown error occurred during generation.');
				setModalState('error');
			}
		} catch (error) {
			console.error('Character generation error:', error);
			setErrorMessage('Failed to generate character. Please try again.');
			setModalState('error');
		} finally {
			setIsGenerating(false);
		}
	};

	/**
	 * 6. Handle accepting the generated character
	 */
	const handleAccept = () => {
		if (!generatedCharacter || !croppedImageUrl) return;

		// 1. Convert generated character to expected format
		const characterData: GeneratedCharacterData = {
			name: characterName.trim(),
			description: generatedCharacter.description,
			sampleDialogues: generatedCharacter.sampleDialogues,
			defaultScenario: generatedCharacter.defaultScenario,
			defaultGreeting: generatedCharacter.defaultGreeting,
			image: croppedImageUrl, // Use the cropped image for character display
		};

		// 2. Call the accept callback
		onAccept(characterData);

		// 3. Reset modal state
		resetModal();
		onClose();
	};

	/**
	 * 5. Handle rejecting the generated character
	 */
	const handleReject = () => {
		setModalState('input');
		setGeneratedCharacter(null);
		setErrorMessage('');
	};

	/**
	 * 7. Reset modal to initial state
	 */
	const resetModal = () => {
		setModalState('input');
		setSelectedImage(null);
		setOriginalImageUrl(null);
		setCroppedImageUrl(null);
		setShowImageCropper(false);
		setCharacterName('');
		setAdditionalInstructions('');
		setGeneratedCharacter(null);
		setErrorMessage('');
		setIsGenerating(false);
	};

	/**
	 * 7. Handle modal close
	 */
	const handleClose = () => {
		resetModal();
		onClose();
	};

	/**
	 * 8. Handle backdrop click to close modal
	 * @param e - Click event
	 */
	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	};

	/**
	 * 9. Handle keyboard events for accessibility
	 * @param e - Keyboard event
	 */
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			handleClose();
		}
	};

	return (
		<div 
			className="modal-overlay" 
			onClick={handleBackdropClick}
			onKeyDown={handleKeyDown}
			tabIndex={-1}
		>
			<div className="modal-content image-to-text-modal">
				<div className="modal-header">
					<h2>
						{modalState === 'input' && 'Create Character from Image'}
						{modalState === 'generating' && 'Generating Character...'}
						{modalState === 'preview' && 'Character Preview'}
						{modalState === 'error' && 'Generation Error'}
					</h2>
					<button 
						type="button" 
						className="modal-close" 
						onClick={handleClose}
						disabled={isGenerating}
						aria-label="Close modal"
					>
						×
					</button>
				</div>
				
				<div className="modal-body">
					{/* Input State - Upload image and provide details */}
					{modalState === 'input' && (
						<div className="input-section">
							<p>Upload an image and let AI create a unique character for you!</p>
							
							{/* Image Upload */}
							<div className="form-group">
								<label htmlFor="character-image">Character Image</label>
								<input
									type="file"
									id="character-image"
									accept="image/*"
									onChange={handleImageUpload}
									className="file-input"
								/>
								{croppedImageUrl && (
									<div className="image-preview">
										<img src={croppedImageUrl} alt="Character preview" />
										<button 
											type="button"
											onClick={() => setShowImageCropper(true)}
											className="edit-crop-button"
										>
											Edit Crop
										</button>
									</div>
								)}
							</div>

							{/* Character Name */}
							<div className="form-group">
								<label htmlFor="character-name">Character Name *</label>
								<input
									type="text"
									id="character-name"
									value={characterName}
									onChange={(e) => setCharacterName(e.target.value)}
									placeholder="Enter character name..."
									maxLength={50}
									className="text-input"
								/>
							</div>

							{/* Additional Instructions */}
							<div className="form-group">
								<label htmlFor="additional-instructions">Additional Instructions (Optional)</label>
								<textarea
									id="additional-instructions"
									value={additionalInstructions}
									onChange={(e) => setAdditionalInstructions(e.target.value)}
									placeholder="e.g., 'Make them speak in Japanese', 'Focus on their mysterious personality', 'Set in a fantasy world'..."
									maxLength={500}
									className="textarea-input"
									rows={3}
								/>
								<small className="input-hint">
									Specify language, personality traits, setting, or any other preferences
								</small>
							</div>
						</div>
					)}

					{/* Generating State - Show loading */}
					{modalState === 'generating' && (
						<div className="generating-section">
							<div className="loading-container">
								<div className="loading-spinner"></div>
								<p>Analyzing image and generating character...</p>
								<small>This may take up to 30 seconds</small>
							</div>
						</div>
					)}

					{/* Preview State - Show generated character */}
					{modalState === 'preview' && generatedCharacter && (
						<div className="preview-section">
							<p>Here's your generated character! Review the details and accept or try again.</p>
							
							<div className="character-preview">
								{/* Character Image */}
								{croppedImageUrl && (
									<div className="preview-image">
										<img src={croppedImageUrl} alt={characterName} />
									</div>
								)}

								{/* Character Details */}
								<div className="character-details">
									<h3>{characterName}</h3>
									
									<div className="detail-section">
										<h4>Description</h4>
										<p>{generatedCharacter.description}</p>
									</div>

									<div className="detail-section">
										<h4>Default Scenario</h4>
										<p>{generatedCharacter.defaultScenario}</p>
									</div>

									<div className="detail-section">
										<h4>Default Greeting</h4>
										<p>"{generatedCharacter.defaultGreeting}"</p>
									</div>

									<div className="detail-section">
										<h4>Sample Dialogues</h4>
										<div className="sample-dialogues">
											{generatedCharacter.sampleDialogues.map((dialogue, index) => (
												<div key={`dialogue-${index}-${dialogue.user.substring(0, 10)}`} className="dialogue-pair">
													<div className="user-line">
														<strong>You:</strong> {dialogue.user}
													</div>
													<div className="character-line">
														<strong>{characterName}:</strong> {dialogue.character}
													</div>
												</div>
											))}
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Error State - Show error message */}
					{modalState === 'error' && (
						<div className="error-section">
							<div className="error-message">
								<h3>Generation Failed</h3>
								<p>{errorMessage}</p>
							</div>
						</div>
					)}
				</div>

				<div className="modal-footer">
					{modalState === 'input' && (
						<>
							<button type="button" onClick={handleClose} className="cancel-button">
								Cancel
							</button>
							<button 
								type="button" 
								onClick={handleGenerate} 
								className="generate-button"
								disabled={!croppedImageUrl || !characterName.trim()}
							>
								Generate Character
							</button>
						</>
					)}

					{modalState === 'preview' && (
						<>
							<button type="button" onClick={handleReject} className="reject-button">
								Try Again
							</button>
							<button type="button" onClick={handleAccept} className="accept-button">
								Accept Character
							</button>
						</>
					)}

					{modalState === 'error' && (
						<>
							<button type="button" onClick={handleClose} className="cancel-button">
								Cancel
							</button>
							<button type="button" onClick={handleReject} className="retry-button">
								Try Again
							</button>
						</>
					)}

					{modalState === 'generating' && (
						<button type="button" onClick={handleClose} className="cancel-button" disabled>
							Generating...
						</button>
					)}
				</div>
			</div>

			{/* Image Cropper Modal */}
			{showImageCropper && originalImageUrl && (
				<ImageCropper
					src={originalImageUrl}
					onCrop={handleCropComplete}
					onCancel={handleCropCancel}
					aspectRatio={1} // Square aspect ratio for character images
				/>
			)}
		</div>
	);
};

export default ImageToTextModal;