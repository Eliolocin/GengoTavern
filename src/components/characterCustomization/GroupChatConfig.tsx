import { useState, useCallback } from "react";
import type { FC } from "react";
import type { Character, GroupMember } from "../../types/interfaces";
import { useCharacters } from "../../contexts/CharacterContext";
import DeleteConfirmationModal from "../shared/DeleteConfirmationModal";
import { 
	isGroupChat, 
	getOrderedGroupMembers, 
	updateMemberProbability,
	addGroupMember,
	removeGroupMember,
	moveGroupMemberUp,
	moveGroupMemberDown
} from "../../utils/groupChatUtils";

interface GroupChatConfigProps {
	groupChat: Character;
	allCharacters: Character[];
	onUpdateCharacter: (field: string, value: string | GroupMember[]) => void;
	onDeleteCharacter?: (id: number) => void;
	onForceResponse?: (characterId: number) => void;
	isProcessingQueue?: boolean;
}

/**
 * Component for configuring Group Chat settings
 * Manages member list, response probabilities, and group metadata
 */
const GroupChatConfig: FC<GroupChatConfigProps> = ({
	groupChat,
	allCharacters,
	onUpdateCharacter,
	onDeleteCharacter,
	onForceResponse,
	isProcessingQueue = false,
}) => {
	const { exportCharacterAsJson } = useCharacters();
	const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

	/**
	 * Update group chat name
	 */
	const handleNameChange = useCallback((newName: string) => {
		onUpdateCharacter('name', newName);
	}, [onUpdateCharacter]);

	/**
	 * Update member response probability
	 */
	const handleProbabilityChange = useCallback((characterId: number, probability: number) => {
		const updatedGroupChat = updateMemberProbability(groupChat, characterId, probability);
		onUpdateCharacter('members', updatedGroupChat.members || []);
	}, [groupChat, onUpdateCharacter]);

	/**
	 * Add a new member to the group chat
	 */
	const handleAddMember = useCallback((characterId: number) => {
		const updatedGroupChat = addGroupMember(groupChat, characterId, 50); // Default 50% probability
		onUpdateCharacter('members', updatedGroupChat.members || []);
	}, [groupChat, onUpdateCharacter]);

	/**
	 * Remove a member from the group chat
	 */
	const handleRemoveMember = useCallback((characterId: number) => {
		const updatedGroupChat = removeGroupMember(groupChat, characterId);
		onUpdateCharacter('members', updatedGroupChat.members || []);
	}, [groupChat, onUpdateCharacter]);

	/**
	 * Move member up in display order
	 */
	const handleMoveUp = useCallback((characterId: number) => {
		const updatedGroupChat = moveGroupMemberUp(groupChat, characterId);
		onUpdateCharacter('members', updatedGroupChat.members || []);
	}, [groupChat, onUpdateCharacter]);

	/**
	 * Move member down in display order
	 */
	const handleMoveDown = useCallback((characterId: number) => {
		const updatedGroupChat = moveGroupMemberDown(groupChat, characterId);
		onUpdateCharacter('members', updatedGroupChat.members || []);
	}, [groupChat, onUpdateCharacter]);

	/**
	 * Export group chat as JSON
	 */
	const handleExportAsJson = useCallback(async () => {
		try {
			await exportCharacterAsJson(groupChat);
		} catch (error) {
			console.error('Error exporting group chat as JSON:', error);
		}
	}, [exportCharacterAsJson, groupChat]);

	/**
	 * Handle delete confirmation
	 */
	const handleDeleteClick = useCallback(() => {
		setShowDeleteConfirmation(true);
	}, []);

	const handleConfirmDelete = useCallback(() => {
		if (onDeleteCharacter) {
			onDeleteCharacter(groupChat.id);
		}
		setShowDeleteConfirmation(false);
	}, [onDeleteCharacter, groupChat.id]);

	// Validate that this is actually a group chat
	if (!isGroupChat(groupChat)) {
		return <div className="error-message">Error: Not a group chat</div>;
	}

	const members = groupChat.members || [];
	const orderedMembers = getOrderedGroupMembers(groupChat);
	
	// Get character objects for the members
	const memberCharacters = orderedMembers
		.map(member => ({
			member,
			character: allCharacters.find(char => char.id === member.characterId)
		}))
		.filter(item => item.character); // Only include members whose characters still exist

	// Get available characters that aren't already in the group
	const availableCharacters = allCharacters.filter(char => 
		char.type !== 'group' && 
		!members.some(member => member.characterId === char.id)
	);

	return (
		<div className="character-form group-chat-config">
			{/* Header */}
			<div className="form-header">
				<h2>Group Chat Configuration</h2>
				<div className="group-chat-icon">👥</div>
			</div>

			{/* Group Chat Name */}
			<div className="form-section">
				<label htmlFor="group-name">Group Chat Name:</label>
				<input
					id="group-name"
					type="text"
					value={groupChat.name}
					onChange={(e) => handleNameChange(e.target.value)}
					className="character-input"
					placeholder="Enter group chat name..."
				/>
			</div>

			{/* Current Members */}
			<div className="form-section">
				<h3>Current Members ({memberCharacters.length})</h3>
				{memberCharacters.length === 0 ? (
					<div className="no-members-message">
						No valid members found. Add some characters to get started.
					</div>
				) : (
					<div className="members-list">
						{memberCharacters.map(({ member, character }) => character && (
							<div key={member.characterId} className="member-item">
								<div className="member-info">
									<img 
										src={character.image} 
										alt={character.name}
										className="member-avatar"
									/>
									<div className="member-details">
										<span className="member-name">{character.name}</span>
										<span className="member-order">Display Order: #{member.displayOrder + 1}</span>
									</div>
								</div>

								<div className="member-controls">
									{/* Response Probability Slider */}
									<div className="probability-control">
										<label htmlFor={`prob-${member.characterId}`}>
											Response Probability: {member.responseProbability}%
										</label>
										<div className="probability-input-group">
											<input
												id={`prob-${member.characterId}`}
												type="range"
												min="0"
												max="100"
												value={member.responseProbability}
												onChange={(e) => handleProbabilityChange(member.characterId, Number(e.target.value))}
												className="probability-slider"
											/>
											<input
												type="number"
												min="0"
												max="100"
												value={member.responseProbability}
												onChange={(e) => handleProbabilityChange(member.characterId, Number(e.target.value))}
												className="probability-number"
											/>
											<span className="probability-unit">%</span>
										</div>
									</div>

									{/* Display Order Control */}
									<div className="order-control">
										<label>Display Order:</label>
										<div className="order-buttons">
											<button
												type="button"
												onClick={() => handleMoveUp(member.characterId)}
												className="order-button up-button"
												disabled={member.displayOrder === 0}
												title="Move up"
											>
												▲
											</button>
											<span className="order-display">#{member.displayOrder + 1}</span>
											<button
												type="button"
												onClick={() => handleMoveDown(member.characterId)}
												className="order-button down-button"
												disabled={member.displayOrder === memberCharacters.length - 1}
												title="Move down"
											>
												▼
											</button>
										</div>
									</div>

									{/* Force Response Button */}
									<button
										type="button"
										onClick={() => onForceResponse?.(member.characterId)}
										className="force-response-button"
										title="Force this character to respond"
										disabled={isProcessingQueue}
									>
										Force Response
									</button>

									{/* Remove Member Button */}
									<button
										type="button"
										onClick={() => handleRemoveMember(member.characterId)}
										className="remove-member-button"
										title="Remove from group"
									>
										Remove
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Add New Members */}
			{availableCharacters.length > 0 && (
				<div className="form-section">
					<h3>Add Members</h3>
					<div className="available-characters">
						{availableCharacters.map(character => (
							<div key={character.id} className="available-character">
								<img 
									src={character.image} 
									alt={character.name}
									className="character-thumbnail"
								/>
								<span className="character-name">{character.name}</span>
								<button
									type="button"
									onClick={() => handleAddMember(character.id)}
									className="add-member-button"
								>
									Add
								</button>
							</div>
						))}
					</div>
				</div>
			)}


			{/* Action Buttons */}
			<div className="form-actions">
				<button
					type="button"
					onClick={handleExportAsJson}
					className="export-button"
				>
					Export as JSON
				</button>

				{onDeleteCharacter && (
					<button
						type="button"
						onClick={handleDeleteClick}
						className="delete-button"
					>
						Delete Group Chat
					</button>
				)}
			</div>

			{/* Delete Confirmation Modal */}
			{showDeleteConfirmation && (
				<DeleteConfirmationModal
					onCancel={() => setShowDeleteConfirmation(false)}
					onConfirm={handleConfirmDelete}
					title="Delete Group Chat"
					message={`Are you sure you want to delete <strong>${groupChat.name}</strong>? This will permanently delete the group chat and all its conversations. Individual characters will not be affected.`}
				/>
			)}
		</div>
	);
};

export default GroupChatConfig;