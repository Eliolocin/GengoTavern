import { useState, useEffect } from "react";
import type { Character, Message } from "../../types/interfaces";
import { storageManager } from "../../utils/storageManager";
import placeholderImg from "../../assets/placeholder.jpg";
import MarkdownRenderer from "../shared/MarkdownRenderer";

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
}

const VisualNovelMode: React.FC<VisualNovelModeProps> = ({
	character,
	message,
	background,
	onRegenerateMessage,
	onContinueMessage,
	onEditMessage,
	onDeleteMessage,
	onStartEditing,
	onStartDeleting,
	lastCharacterMessageId,
}) => {
	const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [fadeState, setFadeState] = useState("fade-in"); // "fade-in", "visible", "fade-out"
	const [displayUrl, setDisplayUrl] = useState<string | null>(null);

	// Handle fade transitions when spriteUrl changes
	useEffect(() => {
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
	}, [spriteUrl, displayUrl, isLoading]);

	// Load the appropriate sprite based on the message emotion
	useEffect(() => {
		const loadSprite = async () => {
			setIsLoading(true);

			try {
				if (!character) {
					setSpriteUrl(null);
					return;
				}

				// Scan for sprites in the filesystem and update the character's sprites array
				const updatedSprites =
					await storageManager.scanAndUpdateCharacterSprites(character);

				// Use the updated sprites array
				const sprites =
					updatedSprites.length > 0 ? updatedSprites : character.sprites || [];

				// If we have a message with emotion, try to find matching sprite
				if (message?.emotion) {
					const emotionSprite = sprites.find(
						(s) => s.emotion === message.emotion,
					);
					if (emotionSprite) {
						const url = await storageManager.loadSpriteAsUrl(
							character.id,
							emotionSprite.filename,
						);
						setSpriteUrl(url);
						return;
					}
				}

				// If no emotion-specific sprite found, try to find a joy sprite as default
				const joySprite = sprites.find((s) => s.emotion === "joy");
				if (joySprite) {
					const url = await storageManager.loadSpriteAsUrl(
						character.id,
						joySprite.filename,
					);
					setSpriteUrl(url);
					return;
				}

				// If no joy sprite, try to find any sprite
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
			} catch (error) {
				console.error("Failed to load sprite:", error);
				// Fallback to character image
				setSpriteUrl(character.image);
			} finally {
				setIsLoading(false);
			}
		};

		loadSprite();
	}, [character, message]);

	// If no message is provided, show a placeholder
	if (!message) {
		return (
			<div className="visual-novel-mode">
				<div className="visual-novel-character-container">
					<img
						src={character.image || placeholderImg}
						alt={character.name}
						className="visual-novel-character-sprite"
					/>
				</div>
				<div className="visual-novel-dialogue-box">
					<div className="visual-novel-speaker">{character.name}</div>
					<div className="visual-novel-text">
						<p>Start the conversation to begin...</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="visual-novel-mode">
			<div className="visual-novel-character-container">
				{isLoading ? (
					<div className="sprite-loading-placeholder">Loading...</div>
				) : (
					<img
						src={displayUrl || character.image || placeholderImg}
						alt={character.name}
						className={`visual-novel-character-sprite sprite-${fadeState}`}
					/>
				)}
			</div>
			<div className="visual-novel-dialogue-box">
				<div className="visual-novel-speaker">
					{message.sender === "user" ? "You" : character.name}
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
										🔄︎
									</button>
								)}
								{onContinueMessage && (
									<button
										type="button"
										className="message-action continue-button"
										title="Continue response"
										onClick={() => onContinueMessage(message.id)}
									>
										⏭︎
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
							✎
						</button>
					)}
					{onStartDeleting && (
						<button
							type="button"
							className="message-action delete-button"
							title="Delete message"
							onClick={() => onStartDeleting(message)}
						>
							×
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default VisualNovelMode;
