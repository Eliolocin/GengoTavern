import type React from 'react';
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Character, GroupMember } from '../../types/interfaces';
import { isIndividualCharacter } from '../../utils/groupChatUtils';

interface GroupChatCreationModalProps {
	isOpen: boolean;
	onClose: () => void;
	onCreateGroupChat: (groupName: string, members: GroupMember[]) => void;
	availableCharacters: Character[];
}

interface CharacterSelection {
	characterId: number;
	isSelected: boolean;
	probability: number;
}

/**
 * Modal component for creating group chats
 * Allows users to select characters and configure response probabilities
 */
const GroupChatCreationModal: React.FC<GroupChatCreationModalProps> = ({
	isOpen,
	onClose,
	onCreateGroupChat,
	availableCharacters,
}) => {
	const [groupName, setGroupName] = useState('');
	const [characterSelections, setCharacterSelections] = useState<CharacterSelection[]>(() => {
		// Initialize selections with only individual characters (no group chats)
		return availableCharacters
			.filter(isIndividualCharacter)
			.map((char) => ({
				characterId: char.id,
				isSelected: false,
				probability: 50, // Default 50% probability
			}));
	});

	if (!isOpen) return null;

	/**
	 * Handle backdrop click to close modal
	 */
	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	/**
	 * Handle keyboard events for accessibility
	 */
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			onClose();
		}
	};

	/**
	 * Toggle character selection
	 */
	const toggleCharacterSelection = useCallback((characterId: number) => {
		setCharacterSelections(prev => 
			prev.map(selection => 
				selection.characterId === characterId
					? { ...selection, isSelected: !selection.isSelected }
					: selection
			)
		);
	}, []);

	/**
	 * Update character response probability
	 */
	const updateProbability = useCallback((characterId: number, probability: number) => {
		setCharacterSelections(prev => 
			prev.map(selection => 
				selection.characterId === characterId
					? { ...selection, probability: Math.max(0, Math.min(100, probability)) }
					: selection
			)
		);
	}, []);

	/**
	 * Handle form submission
	 */
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		
		const selectedCharacters = characterSelections.filter(s => s.isSelected);
		
		if (selectedCharacters.length < 2) {
			alert('Please select at least 2 characters for the group chat.');
			return;
		}

		if (!groupName.trim()) {
			alert('Please enter a name for the group chat.');
			return;
		}

		// Create GroupMember objects with display order
		const members: GroupMember[] = selectedCharacters.map((selection, index) => ({
			characterId: selection.characterId,
			responseProbability: selection.probability,
			displayOrder: index,
		}));

		onCreateGroupChat(groupName.trim(), members);
		
		// Reset form
		setGroupName('');
		setCharacterSelections(prev => 
			prev.map(selection => ({ ...selection, isSelected: false, probability: 50 }))
		);
	};

	const selectedCount = characterSelections.filter(s => s.isSelected).length;
	const individualCharacters = availableCharacters.filter(isIndividualCharacter);

	return (
		<div 
			className="modal-overlay" 
			onClick={handleBackdropClick}
			onKeyDown={handleKeyDown}
			tabIndex={-1}
		>
			<div className="modal-content group-chat-creation-modal">
				<div className="modal-header">
					<h2>Create Group Chat</h2>
					<button 
						type="button" 
						className="modal-close" 
						onClick={onClose}
						aria-label="Close modal"
					>
						×
					</button>
				</div>
				
				<form onSubmit={handleSubmit} className="modal-body">
					{/* Group Name Input */}
					<div className="form-group">
						<label htmlFor="group-name">Group Chat Name:</label>
						<input
							id="group-name"
							type="text"
							value={groupName}
							onChange={(e) => setGroupName(e.target.value)}
							placeholder="Enter group chat name..."
							className="form-input"
							required
						/>
					</div>

					{/* Character Selection */}
					<div className="form-group">
						<label>Select Characters ({selectedCount} selected, minimum 2):</label>
						
						{individualCharacters.length === 0 ? (
							<p className="no-characters-message">
								No individual characters available. Please create some characters first.
							</p>
						) : (
							<div className="character-selection-list">
								{individualCharacters.map((character) => {
									const selection = characterSelections.find(s => s.characterId === character.id);
									if (!selection) return null;

									return (
										<div key={character.id} className="character-selection-item">
											<div className="character-info">
												<label className="character-checkbox">
													<input
														type="checkbox"
														checked={selection.isSelected}
														onChange={() => toggleCharacterSelection(character.id)}
													/>
													<img 
														src={character.image} 
														alt={character.name}
														className="character-thumbnail"
													/>
													<span className="character-name">{character.name}</span>
												</label>
											</div>
											
											{selection.isSelected && (
												<div className="probability-control">
													<label htmlFor={`prob-${character.id}`}>
														Response Probability:
													</label>
													<div className="probability-input-group">
														<input
															id={`prob-${character.id}`}
															type="range"
															min="0"
															max="100"
															value={selection.probability}
															onChange={(e) => updateProbability(character.id, Number(e.target.value))}
															className="probability-slider"
														/>
														<input
															type="number"
															min="0"
															max="100"
															value={selection.probability}
															onChange={(e) => updateProbability(character.id, Number(e.target.value))}
															className="probability-number"
														/>
														<span className="probability-unit">%</span>
													</div>
													<small className="probability-help">
														Higher values mean this character is more likely to respond after each message
													</small>
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* Submit/Cancel Buttons */}
					<div className="modal-footer">
						<button 
							type="button" 
							className="button button-secondary"
							onClick={onClose}
						>
							Cancel
						</button>
						<button 
							type="submit" 
							className="button button-primary"
							disabled={selectedCount < 2 || !groupName.trim()}
						>
							Create Group Chat
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default GroupChatCreationModal;