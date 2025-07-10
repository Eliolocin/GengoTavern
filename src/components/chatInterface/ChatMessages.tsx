import { useRef, useEffect, useState, useCallback } from "react";
import type { FC } from "react";
import type { Message, Character } from "../../types/interfaces";
import EditMessageModal from "./EditMessageModal";
import DeleteConfirmationModal from "../shared/DeleteConfirmationModal";
import MarkdownRenderer from "../shared/MarkdownRenderer";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import { replaceNamePlaceholders } from "../../utils/promptBuilder";
import VisualNovelMode from "./VisualNovelMode";
import { useApp } from "../../contexts/AppContext";

interface ChatMessagesProps {
	messages: Message[];
	character?: Character | null;
	background?: string;
	onRegenerateMessage?: (messageId: number) => void;
	onContinueMessage?: (messageId: number) => void; // Keep this prop for future use
	onDeleteErrorMessage?: (messageId: number) => void;
	onEditMessage?: (messageId: number, newText: string) => void;
	onDeleteMessage?: (messageId: number) => void;
	allCharacters?: Character[]; // Add this to look up individual character info
}

const ChatMessages: FC<ChatMessagesProps> = ({
	messages,
	character,
	background,
	onRegenerateMessage,
	// @ts-ignore - onContinueMessage will be used in future implementation
	onContinueMessage, // Keep this prop for future use
	onDeleteErrorMessage,
	onEditMessage,
	onDeleteMessage,
	allCharacters = [],
}) => {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const prevMessagesLengthRef = useRef<number>(0);
	const [editingMessage, setEditingMessage] = useState<Message | null>(null);
	const [deletingMessage, setDeletingMessage] = useState<Message | null>(null);
	const { userPersona, visualNovelMode } = useUserSettings();
	const { setLeftPanelExpanded, setRightPanelExpanded } = useApp();

	const characterImage = character?.image;
	const characterName = character?.name || "Character";

	// Helper function to get character info for group chat messages
	const getCharacterInfo = (message: Message) => {
		if (message.sender === 'character' && message.speakerId && allCharacters.length > 0) {
			// This is a group chat message, find the specific character
			const messageCharacter = allCharacters.find(char => char.id === message.speakerId);
			if (messageCharacter) {
				return {
					name: messageCharacter.name,
					image: messageCharacter.image
				};
			}
		}
		// Fall back to the main character (individual chat or group chat fallback)
		return {
			name: characterName,
			image: characterImage
		};
	};

	// Scroll to bottom helper function
	const scrollToBottom = useCallback(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, []);

	// Auto-scroll to the bottom on initial render
	useEffect(() => {
		scrollToBottom();
	}, [scrollToBottom]);

	// Check if messages have changed and scroll if needed
	useEffect(() => {
		// If the number of messages has changed, scroll to bottom
		if (messages.length !== prevMessagesLengthRef.current) {
			// Update the ref
			prevMessagesLengthRef.current = messages.length;

			// Scroll immediately
			scrollToBottom();

			// Also scroll after a short delay to ensure any rendering completes
			const timeoutId = setTimeout(scrollToBottom, 100);
			return () => clearTimeout(timeoutId);
		}
	}, [messages.length, scrollToBottom]);

	// Handle panel collapse/expand when visual novel mode changes
	useEffect(() => {
		if (visualNovelMode) {
			// Suggest collapsing both panels when entering VN mode, but don't force it
			// This allows users to manually expand panels if they want to
			setLeftPanelExpanded(false);
			setRightPanelExpanded(false);
		} else {
			// Suggest expanding both panels when exiting VN mode
			setLeftPanelExpanded(true);
			setRightPanelExpanded(true);

			// Scroll to the latest message when exiting VN mode
			setTimeout(scrollToBottom, 100);
		}
	}, [
		visualNovelMode,
		setLeftPanelExpanded,
		setRightPanelExpanded,
		scrollToBottom,
	]);

	const formatTimestamp = (timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Find the last character message
	const lastCharacterMessageIndex = [...messages]
		.reverse()
		.findIndex((msg) => msg.sender === "character" && !msg.isGenerating);

	// Convert back to normal index (or -1 if not found)
	const lastCharacterMessageId =
		lastCharacterMessageIndex !== -1
			? messages[messages.length - 1 - lastCharacterMessageIndex].id
			: -1;

	// Get the latest message for Visual Novel mode
	const latestMessage =
		messages.length > 0 ? messages[messages.length - 1] : null;

	const handleStartEditing = (message: Message) => {
		setEditingMessage(message);
	};

	const handleSaveEdit = (newText: string) => {
		if (editingMessage && onEditMessage) {
			onEditMessage(editingMessage.id, newText);
			setEditingMessage(null);
		}
	};

	const handleCancelEdit = () => {
		setEditingMessage(null);
	};

	const handleStartDeleting = (message: Message) => {
		setDeletingMessage(message);
	};

	const handleConfirmDelete = () => {
		if (deletingMessage && onDeleteMessage) {
			onDeleteMessage(deletingMessage.id);
			setDeletingMessage(null);
		}
	};

	const handleCancelDelete = () => {
		setDeletingMessage(null);
	};

	// If in Visual Novel mode and we have a character and messages, show the VN interface
	if (visualNovelMode && character && messages.length > 0) {
		return (
			<div className="chat-messages visual-novel-container">
				{/* Completely transparent chat interface in VN mode */}
				<div className="chat-messages-transparent">
					{/* This div is transparent and doesn't interfere with VN mode */}
				</div>

				<VisualNovelMode
					character={character}
					message={latestMessage}
					background={background || character.defaultBackground}
					onRegenerateMessage={onRegenerateMessage}
					onContinueMessage={onContinueMessage}
					onEditMessage={onEditMessage}
					onDeleteMessage={onDeleteMessage}
					onStartEditing={handleStartEditing}
					onStartDeleting={handleStartDeleting}
					lastCharacterMessageId={lastCharacterMessageId}
					allCharacters={allCharacters}
				/>

				{/* Modals still need to be available in VN mode */}
				{editingMessage && (
					<EditMessageModal
						message={editingMessage.text}
						onSave={handleSaveEdit}
						onCancel={handleCancelEdit}
						sender={editingMessage.sender}
					/>
				)}

				{deletingMessage && (
					<DeleteConfirmationModal
						onConfirm={handleConfirmDelete}
						onCancel={handleCancelDelete}
						title="Delete Message"
						message="Are you sure you want to delete this message? This action cannot be undone."
					/>
				)}

				<div ref={messagesEndRef} />
			</div>
		);
	}

	// Standard chat interface
	return (
		<div className="chat-messages">
			{editingMessage && (
				<EditMessageModal
					message={editingMessage.text}
					onSave={handleSaveEdit}
					onCancel={handleCancelEdit}
					sender={editingMessage.sender}
				/>
			)}

			{deletingMessage && (
				<DeleteConfirmationModal
					onConfirm={handleConfirmDelete}
					onCancel={handleCancelDelete}
					title="Delete Message"
					message="Are you sure you want to delete this message? This action cannot be undone."
				/>
			)}

			{messages.length === 0 ? (
				<div className="empty-chat">No messages yet. Start a conversation!</div>
			) : (
				messages.map((message) => {
					// Special rendering for system error messages
					if (message.sender === "system" && message.isError) {
						return (
							<div key={message.id} className="system-message error-message">
								<div className="message-content">
									<div className="message-sender">Error</div>
									<div className="message-text">{message.text}</div>
									<button
										type="button"
										className="message-action delete-button error-delete"
										title="Delete error message"
										onClick={() => onDeleteErrorMessage?.(message.id)}
									>
										×
									</button>
								</div>
							</div>
						);
					}

					// Special rendering for system messages (including scenarios)
					if (message.sender === "system" && !message.isError) {
						// Replace placeholder tokens in scenario messages for display
						const displayText =
							characterName && userPersona
								? replaceNamePlaceholders(
										message.text,
										characterName,
										userPersona.name,
									)
								: message.text;

						return (
							<div key={message.id} className="system-message">
								<div className="message-content">
									<div className="message-sender">Scenario</div>
									<div className="message-text">{displayText}</div>
								</div>
							</div>
						);
					}

					// Regular user/character message rendering
					const charInfo = getCharacterInfo(message);
					return (
						<div
							key={message.id}
							className={`message ${message.sender === "user" ? "user-message" : "character-message"}`}
						>
							{message.sender === "character" && charInfo.image && (
								<div className="character-avatar-container">
									<img
										src={charInfo.image}
										alt={charInfo.name}
										className="message-avatar"
									/>
								</div>
							)}
							<div className="message-content">
								<div className="message-sender">
									{message.sender === "user" ? userPersona.name : charInfo.name}
								</div>
								<div className="message-text">
									{message.isGenerating ? (
										"..."
									) : (
										<MarkdownRenderer
											content={
												// Replace any remaining placeholders in message text
												charInfo.name && userPersona
													? replaceNamePlaceholders(
															message.text,
															charInfo.name,
															userPersona.name,
														)
													: message.text
											}
										/>
									)}
								</div>
								<div className="message-timestamp">
									{formatTimestamp(message.timestamp)}
								</div>
								{message.editHistory && message.editHistory.length > 0 && (
									<div className="edit-indicator">(edited)</div>
								)}
							</div>
							<div className="message-actions visible">
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
								<button
									type="button"
									className="message-action edit-button"
									title="Edit message"
									onClick={() => handleStartEditing(message)}
								>
									✎
								</button>
								<button
									type="button"
									className="message-action delete-button"
									title="Delete message"
									onClick={() => handleStartDeleting(message)}
								>
									×
								</button>
							</div>
						</div>
					);
				})
			)}
			<div ref={messagesEndRef} />
		</div>
	);
};

export default ChatMessages;
