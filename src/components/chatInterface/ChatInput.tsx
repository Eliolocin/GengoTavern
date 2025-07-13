import { useState, useEffect, useRef } from "react";
import type { FC, KeyboardEvent } from "react";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import { useGrammarCorrection } from "../../contexts/GrammarCorrectionContext";
import NotificationBadge from "../shared/NotificationBadge";
import type { Character, Message } from "../../types/interfaces";
import type { GrammarCorrectionMode } from "../../types/grammarCorrection";

interface ChatInputProps {
	onSendMessage: (message: string) => void;
	isProcessing?: boolean;
	// Group chat queue props
	isProcessingQueue?: boolean;
	currentlyTypingCharacter?: number | null;
	responseQueue?: number[];
	selectedCharacter?: Character | null;
	allCharacters?: Character[];
	onStopQueue?: () => void;
	shouldStopQueue?: boolean;
	// Latest message for blank send functionality
	latestMessage?: Message | null;
}

const ChatInput: FC<ChatInputProps> = ({
	onSendMessage,
	isProcessing = false,
	isProcessingQueue = false,
	currentlyTypingCharacter = null,
	responseQueue = [],
	selectedCharacter = null,
	allCharacters = [],
	onStopQueue,
	shouldStopQueue = false,
	latestMessage = null,
}) => {
	const [message, setMessage] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const {
		visualNovelMode,
		setVisualNovelMode,
		grammarCorrectionMode,
		setGrammarCorrectionMode,
	} = useUserSettings();
	const { getUnreadCount, hasUnreadSuggestions, markAllTutorAsRead } =
		useGrammarCorrection();

	// Auto-resize the textarea as content grows
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	}, [message]);

	const handleSendMessage = () => {
		// Allow sending if:
		// 1. Message has content, OR
		// 2. Message is blank but latest message is from user (triggers response to last user message)
		const canSend = (message.trim() || (latestMessage?.sender === "user")) && !isProcessing && !isProcessingQueue;
		
		if (canSend) {
			onSendMessage(message);
			setMessage("");
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const toggleVisualNovelMode = () => {
		const newMode = !visualNovelMode;
		setVisualNovelMode(newMode);

		// When switching from VN mode to Chat mode, mark all tutor suggestions as read
		if (!newMode && hasUnreadSuggestions()) {
			console.log(
				"📖 Switching to Chat Mode - marking all tutor suggestions as read",
			);
			markAllTutorAsRead();
		}
	};

	/**
	 * Cycle through grammar correction modes: off → implicit → narrative → off
	 */
	const cycleGrammarMode = () => {
		const modes: GrammarCorrectionMode[] = ["off", "implicit", "narrative"];
		const currentIndex = modes.indexOf(grammarCorrectionMode);
		const nextIndex = (currentIndex + 1) % modes.length;
		setGrammarCorrectionMode(modes[nextIndex]);
	};

	/**
	 * Get display text for current grammar mode
	 */
	const getGrammarModeText = () => {
		switch (grammarCorrectionMode) {
			case "off":
				return "Suggestions: Off";
			case "implicit":
				return "Suggestions: Implicit";
			case "narrative":
				return "Suggestions: Narrative";
			default:
				return "Suggestions: Off";
		}
	};

	/**
	 * Get tooltip text for current grammar mode
	 */
	const getGrammarModeTooltip = () => {
		switch (grammarCorrectionMode) {
			case "off":
				return "Click to enable Implicit Feedback mode";
			case "implicit":
				return "Click to enable Narrative Suggestion mode";
			case "narrative":
				return "Click to disable grammar correction";
			default:
				return "Click to enable grammar correction";
		}
	};

	const handleStopQueue = () => {
		if (onStopQueue) {
			onStopQueue();
		}
	};

	// Get the name of the character currently typing
	const getTypingCharacterName = () => {
		if (currentlyTypingCharacter && allCharacters) {
			const character = allCharacters.find(
				(c) => c.id === currentlyTypingCharacter,
			);
			return character?.name || "Unknown";
		}
		return null;
	};

	// Get names of characters in the queue
	const getQueueCharacterNames = () => {
		if (responseQueue && responseQueue.length > 0 && allCharacters) {
			return responseQueue.map((id) => {
				const character = allCharacters.find((c) => c.id === id);
				return character?.name || "Unknown";
			});
		}
		return [];
	};

	const typingCharacterName = getTypingCharacterName();
	const queueCharacterNames = getQueueCharacterNames();
	const isGroupChat = selectedCharacter?.type === "group";

	return (
		<div className="chat-input-container">
			<div className="mode-toggles-container">
				<button
					type="button"
					className={`vn-mode-toggle-button ${visualNovelMode ? "active" : ""}`}
					onClick={toggleVisualNovelMode}
					title={
						visualNovelMode
							? hasUnreadSuggestions()
								? `Switch to Chat Mode (${getUnreadCount()} unread grammar suggestion${getUnreadCount() === 1 ? "" : "s"})`
								: "Switch to Chat Mode"
							: "Switch to Visual Novel Mode"
					}
				>
					{visualNovelMode ? "Chat Mode" : "Visual Novel Mode"}

					{/* Show notification badge only when in VN mode and there are unread suggestions */}
					{visualNovelMode && hasUnreadSuggestions() && (
						<NotificationBadge
							count={getUnreadCount()}
							className="grammar-badge"
						/>
					)}
				</button>

				<button
					type="button"
					className={`grammar-mode-toggle-button ${grammarCorrectionMode !== "off" ? "active" : ""} mode-${grammarCorrectionMode}`}
					onClick={cycleGrammarMode}
					title={getGrammarModeTooltip()}
				>
					{getGrammarModeText()}
				</button>
			</div>

			{/* Queue Status Indicator */}
			{isProcessingQueue && isGroupChat && (
				<div className="queue-status-indicator">
					{typingCharacterName && (
						<div className="typing-indicator">
							<span className="typing-character">{typingCharacterName}</span> is
							typing...
						</div>
					)}
					{queueCharacterNames.length > 1 && (
						<div className="queue-info">
							Queue: {queueCharacterNames.join(", ")}
						</div>
					)}
				</div>
			)}

			<div className="chat-input">
				<textarea
					ref={textareaRef}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={
						isProcessingQueue
							? "Waiting for responses..."
							: "Type your message..."
					}
					disabled={isProcessing || isProcessingQueue}
					rows={1}
				/>
				{isProcessingQueue && onStopQueue ? (
					<button
						type="button"
						onClick={handleStopQueue}
						className="stop-queue-button"
						disabled={shouldStopQueue}
					>
						{shouldStopQueue ? "Stopping..." : "Stop Responses"}
					</button>
				) : (
					<button
						type="button"
						onClick={handleSendMessage}
						disabled={!(message.trim() || (latestMessage?.sender === "user")) || isProcessing || isProcessingQueue}
					>
						Send
					</button>
				)}
			</div>
		</div>
	);
};

export default ChatInput;
