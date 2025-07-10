import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Character, Message } from "../../types/interfaces";
import { storageManager } from "../../utils/storageManager";
import placeholderImg from "../../assets/placeholder.jpg";
import MarkdownRenderer from "../shared/MarkdownRenderer";
import { isGroupChat, getOrderedGroupMembers } from "../../utils/groupChatUtils";
import { ArrowPathIcon, ForwardIcon, PencilIcon, XMarkIcon } from "@heroicons/react/20/solid";

interface VisualNovelModeProps {
	character: Character;
	message: Message | null;
	background?: string | null;
	onRegenerateMessage?: (messageId: number) => void;
	onContinueMessage?: (messageId: number) => void;
	onEditMessage?: (messageId: number, newText: string) => void;
	onDeleteMessage?: (messageId: number) => void;
	onStartEditing?: (message: Message) => void;
	onStartDeleting?: (message: Message) => void;
	lastCharacterMessageId?: number;
	allCharacters?: Character[]; // For group chat member lookup
}

const VisualNovelMode: React.FC<VisualNovelModeProps> = ({
	character,
	message,
	// @ts-ignore - background will be used in future updates
	background,
	onRegenerateMessage,
	onContinueMessage,
	// @ts-ignore - onEditMessage will be used in future updates
	onEditMessage,
	// @ts-ignore - onDeleteMessage will be used in future updates
	onDeleteMessage,
	onStartEditing,
	onStartDeleting,
	lastCharacterMessageId,
	allCharacters = [],
}) => {
	// Single character sprite state (for individual chats)
	const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [fadeState, setFadeState] = useState("fade-in"); // "fade-in", "visible", "fade-out"
	const [displayUrl, setDisplayUrl] = useState<string | null>(null);
	
	// Multi-sprite state (for group chats)
	const [groupSprites, setGroupSprites] = useState<{
		characterId: number;
		characterName: string;
		spriteUrl: string | null;
		displayUrl: string | null;
		fadeState: string;
		displayOrder: number;
	}[]>([]);
	
	// Detect if this is a group chat
	const isGroupChatMode = isGroupChat(character);

	// Handle fade transitions when spriteUrl changes (individual character mode)
	useEffect(() => {
		// Skip if this is a group chat
		if (isGroupChatMode) return;
		
		// If this is the first load and we have a sprite, just show it
		if (!displayUrl && spriteUrl) {
			setDisplayUrl(spriteUrl);
			setFadeState("visible");
			return;
		}

		// If sprite URL changes, fade out current sprite, then fade in new one
		if (spriteUrl !== displayUrl && !isLoading) {
			// First fade out current sprite
			setFadeState("fade-out");

			// After fade out completes, change the URL and fade in
			const timer = setTimeout(() => {
				setDisplayUrl(spriteUrl);
				setFadeState("fade-in");

				// After fade in completes, set to visible
				const fadeInTimer = setTimeout(() => {
					setFadeState("visible");
				}, 300); // Match the CSS transition duration

				return () => clearTimeout(fadeInTimer);
			}, 300); // Match the CSS transition duration

			return () => clearTimeout(timer);
		}
	}, [spriteUrl, displayUrl, isLoading, isGroupChatMode]);

	// Load sprites based on chat type (individual vs group)
	// biome-ignore lint/correctness/useExhaustiveDependencies: We need to track message changes for emotion updates
	useEffect(() => {
		const loadSprites = async () => {
			setIsLoading(true);

			try {
				if (!character) {
					setSpriteUrl(null);
					setGroupSprites([]);
					return;
				}

				if (isGroupChatMode) {
					// Group chat mode - load sprites for all members
					await loadGroupSprites();
				} else {
					// Individual character mode - load single sprite
					await loadIndividualSprite();
				}
			} catch (error) {
				console.error("Failed to load sprites:", error);
				// Fallback handling
				if (isGroupChatMode) {
					setGroupSprites([]);
				} else {
					setSpriteUrl(character.image);
				}
			} finally {
				setIsLoading(false);
			}
		};

		loadSprites();
	}, [character, message?.emotion, message?.speakerId, isGroupChatMode]);

	/**
	 * Load sprite for individual character (original logic)
	 */
	const loadIndividualSprite = async () => {
		if (!character) return;

		// Scan for sprites in the filesystem and update the character's sprites array
		const updatedSprites = await storageManager.scanAndUpdateCharacterSprites(character);

		// Use the updated sprites array
		const sprites = updatedSprites.length > 0 ? updatedSprites : character.sprites || [];

		// If we have a message with emotion, try to find matching sprite
		if (message?.emotion) {
			const emotionSprite = sprites.find((s) => s.emotion === message.emotion);
			if (emotionSprite) {
				const url = await storageManager.loadSpriteAsUrl(
					character.id,
					emotionSprite.filename,
				);
				setSpriteUrl(url);
				return;
			}
		}

		// If no emotion-specific sprite found, try to find a neutral sprite as default
		const neutralSprite = sprites.find((s) => s.emotion === "neutral");
		if (neutralSprite) {
			const url = await storageManager.loadSpriteAsUrl(
				character.id,
				neutralSprite.filename,
			);
			setSpriteUrl(url);
			return;
		}

		// If no neutral sprite, try to find any sprite
		if (sprites.length > 0) {
			const url = await storageManager.loadSpriteAsUrl(
				character.id,
				sprites[0].filename,
			);
			setSpriteUrl(url);
			return;
		}

		// No sprites available, use the character image
		setSpriteUrl(character.image);
	};

	/**
	 * Load sprites for all group chat members
	 */
	const loadGroupSprites = async () => {
		if (!character || !character.members) return;

		// Get ordered group members
		const orderedMembers = getOrderedGroupMembers(character);
		const newGroupSprites = [];

		for (const member of orderedMembers) {
			// Find the character data for this member
			const memberCharacter = allCharacters.find((c) => c.id === member.characterId);
			if (!memberCharacter) continue;

			// Determine the emotion to use for this member
			let targetEmotion = "neutral"; // Default to neutral

			// If the latest message is from this character, use its emotion
			if (message?.sender === "character" && message?.speakerId === member.characterId && message?.emotion) {
				targetEmotion = message.emotion;
			}

			// Load sprite for this member
			const spriteUrl = await loadMemberSprite(memberCharacter, targetEmotion);

			newGroupSprites.push({
				characterId: member.characterId,
				characterName: memberCharacter.name,
				spriteUrl,
				displayUrl: spriteUrl, // Start with immediate display
				fadeState: "visible",
				displayOrder: member.displayOrder,
			});
		}

		setGroupSprites(newGroupSprites);
	};

	/**
	 * Load sprite for a specific group member
	 */
	const loadMemberSprite = async (memberCharacter: Character, targetEmotion: string): Promise<string | null> => {
		try {
			// Scan for sprites in the filesystem and update the character's sprites array
			const updatedSprites = await storageManager.scanAndUpdateCharacterSprites(memberCharacter);

			// Use the updated sprites array
			const sprites = updatedSprites.length > 0 ? updatedSprites : memberCharacter.sprites || [];

			// Try to find sprite with target emotion
			const emotionSprite = sprites.find((s) => s.emotion === targetEmotion);
			if (emotionSprite) {
				return await storageManager.loadSpriteAsUrl(
					memberCharacter.id,
					emotionSprite.filename,
				);
			}

			// Fallback to neutral if not already trying neutral
			if (targetEmotion !== "neutral") {
				const neutralSprite = sprites.find((s) => s.emotion === "neutral");
				if (neutralSprite) {
					return await storageManager.loadSpriteAsUrl(
						memberCharacter.id,
						neutralSprite.filename,
					);
				}
			}

			// If no sprites available, use the character image
			if (sprites.length > 0) {
				return await storageManager.loadSpriteAsUrl(
					memberCharacter.id,
					sprites[0].filename,
				);
			}

			// Final fallback to character image
			return memberCharacter.image;
		} catch (error) {
			console.error(`Failed to load sprite for ${memberCharacter.name}:`, error);
			return memberCharacter.image;
		}
	};

	/**
	 * Render group chat sprites using React Portal directly to body
	 */
	const renderGroupChatSprites = (spritesData: typeof groupSprites) => {
		if (!isGroupChatMode) return null;
		
		const spritesElement = (
			<div className="group-chat-sprite-backdrop">
				{spritesData.map((sprite) => {
					const isCurrentSpeaker = message?.sender === "character" && message?.speakerId === sprite.characterId;
					
					return (
						<div
							key={sprite.characterId}
							className={`group-chat-sprite-container ${
								isCurrentSpeaker ? "current-speaker" : ""
							}`}
							title={sprite.characterName}
							style={{
								backgroundImage: `url(${sprite.displayUrl || placeholderImg})`,
								backgroundSize: 'contain',
								backgroundPosition: 'bottom center',
								backgroundRepeat: 'no-repeat'
							}}
						>
							<div className="character-name-label">{sprite.characterName}</div>
						</div>
					);
				})}
			</div>
		);
		
		// Use React Portal to render directly to body, bypassing ALL container nesting
		return createPortal(spritesElement, document.body);
	};

	// If no message is provided, show a placeholder
	if (!message) {
		// Render group chat sprites using placeholder data
		const placeholderSprites = getOrderedGroupMembers(character)
			.map((member) => {
				const memberCharacter = allCharacters.find((c) => c.id === member.characterId);
				if (!memberCharacter) return null;
				
				return {
					characterId: member.characterId,
					characterName: memberCharacter.name,
					spriteUrl: memberCharacter.image,
					displayUrl: memberCharacter.image,
					fadeState: "visible" as const,
					displayOrder: member.displayOrder,
				};
			})
			.filter((sprite): sprite is NonNullable<typeof sprite> => sprite !== null);

		return (
			<>
				{/* Group Chat Sprites - Render to Body via Portal */}
				{isGroupChatMode && createPortal(
					<div className="group-chat-sprite-backdrop">
						{getOrderedGroupMembers(character).map((member) => {
							const memberCharacter = allCharacters.find((c) => c.id === member.characterId);
							if (!memberCharacter) return null;

							return (
								<div
									key={member.characterId}
									className="group-chat-sprite-container"
									title={memberCharacter.name}
									style={{
										backgroundImage: `url(${memberCharacter.image || placeholderImg})`,
										backgroundSize: 'contain',
										backgroundPosition: 'bottom center',
										backgroundRepeat: 'no-repeat'
									}}
								>
									<div className="character-name-label">{memberCharacter.name}</div>
								</div>
							);
						})}
					</div>,
					document.body
				)}
				
				{/* Main Visual Novel Container */}
				<div className="visual-novel-mode">
					<div className="visual-novel-character-container">
						{isGroupChatMode ? (
							// Group chat mode - sprites are rendered to body, show placeholder or nothing
							<div className="group-chat-placeholder">
								{/* Empty placeholder - sprites are rendered to body via portal */}
							</div>
						) : (
							// Individual character placeholder
							<img
								src={character.image || placeholderImg}
								alt={character.name}
								className="visual-novel-character-sprite"
							/>
						)}
					</div>
					<div className="visual-novel-dialogue-box">
						<div className="visual-novel-speaker">{character.name}</div>
						<div className="visual-novel-text">
							<p>Start the conversation to begin...</p>
						</div>
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			{/* Group Chat Sprites - Render to Body via Portal */}
			{isGroupChatMode && !isLoading && renderGroupChatSprites(groupSprites)}
			
			{/* Main Visual Novel Container */}
			<div className="visual-novel-mode">
				<div className="visual-novel-character-container">
					{isLoading ? (
						<div className="sprite-loading-placeholder">Loading...</div>
					) : isGroupChatMode ? (
						// Group chat mode - sprites are rendered to body via portal, show placeholder or nothing
						<div className="group-chat-placeholder">
							{/* Empty placeholder - sprites are rendered to body via portal */}
						</div>
					) : (
						// Individual character mode - render single sprite
						<img
							src={displayUrl || character.image || placeholderImg}
							alt={character.name}
							className={`visual-novel-character-sprite sprite-${fadeState}`}
						/>
					)}
				</div>
			<div className="visual-novel-dialogue-box">
				<div className="visual-novel-speaker">
					{message.sender === "user" 
						? "You" 
						: isGroupChatMode && message.speakerName 
							? message.speakerName 
							: character.name
					}
				</div>
				<div className="visual-novel-text">
					<MarkdownRenderer content={message.text} />
				</div>

				{/* Action buttons positioned in the dialogue box */}
				<div className="vn-message-actions">
					{message.sender === "character" &&
						message.id === lastCharacterMessageId &&
						!message.isGenerating && (
							<>
								{onRegenerateMessage && (
									<button
										type="button"
										className="message-action reroll-button"
										title="Regenerate response"
										onClick={() => onRegenerateMessage(message.id)}
									>
										<ArrowPathIcon className="w-4 h-4" />
									</button>
								)}
								{onContinueMessage && (
									<button
										type="button"
										className="message-action continue-button"
										title="Continue response"
										onClick={() => onContinueMessage(message.id)}
									>
										<ForwardIcon className="w-4 h-4" />
									</button>
								)}
							</>
						)}
					{onStartEditing && (
						<button
							type="button"
							className="message-action edit-button"
							title="Edit message"
							onClick={() => onStartEditing(message)}
						>
							<PencilIcon className="w-4 h-4" />
						</button>
					)}
					{onStartDeleting && (
						<button
							type="button"
							className="message-action delete-button"
							title="Delete message"
							onClick={() => onStartDeleting(message)}
						>
							<XMarkIcon className="w-4 h-4" />
						</button>
					)}
				</div>
			</div>
		</div>
		</>
	);
};

export default VisualNovelMode;
