import type React from 'react';

interface NewCharacterModalProps {
	isOpen: boolean;
	onClose: () => void;
	onCreateEmpty: () => void;
	onCreateFromImage: () => void;
	onCreateGroupChat: () => void;
}

/**
 * Modal component that presents three character creation options
 * @param isOpen - Whether the modal is currently displayed
 * @param onClose - Callback to close the modal
 * @param onCreateEmpty - Callback to create an empty character
 * @param onCreateFromImage - Callback to start image-to-text character creation
 * @param onCreateGroupChat - Callback to start group chat creation
 */
const NewCharacterModal: React.FC<NewCharacterModalProps> = ({
	isOpen,
	onClose,
	onCreateEmpty,
	onCreateFromImage,
	onCreateGroupChat,
}) => {
	if (!isOpen) return null;

	/**
	 * Handle backdrop click to close modal
	 * @param e - Click event
	 */
	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	/**
	 * Handle keyboard events for accessibility
	 * @param e - Keyboard event
	 */
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			onClose();
		}
	};

	return (
		<div 
			className="modal-overlay" 
			onClick={handleBackdropClick}
			onKeyDown={handleKeyDown}
			tabIndex={-1}
		>
			<div className="modal-content new-character-modal">
				<div className="modal-header">
					<h2>Create New</h2>
					<button 
						type="button" 
						className="modal-close" 
						onClick={onClose}
						aria-label="Close modal"
					>
						×
					</button>
				</div>
				
				<div className="modal-body">
					<p>Choose how you'd like to create your new character:</p>
					
					<div className="character-options">
						{/* 1. Empty Character Option */}
						<button 
							type="button" 
							className="character-option-button"
							onClick={onCreateEmpty}
						>
							<div className="option-icon">📝</div>
							<div className="option-content">
								<h3>Empty Character</h3>
								<p>Start with a blank character and customize everything yourself</p>
							</div>
						</button>

						{/* 2. Character from Image Option */}
						<button 
							type="button" 
							className="character-option-button"
							onClick={onCreateFromImage}
						>
							<div className="option-icon">🖼️</div>
							<div className="option-content">
								<h3>Character from Image</h3>
								<p>Upload an image and let AI create the character for you</p>
							</div>
						</button>

						{/* 3. Group Chat Option */}
						<button 
							type="button" 
							className="character-option-button"
							onClick={onCreateGroupChat}
						>
							<div className="option-icon">👥</div>
							<div className="option-content">
								<h3>Group Chat</h3>
								<p>Create a group chat with multiple existing characters</p>
							</div>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default NewCharacterModal;