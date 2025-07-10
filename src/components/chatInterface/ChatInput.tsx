import { useState, useEffect, useRef } from "react";
import type { FC, KeyboardEvent } from "react";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import type { Character } from "../../types/interfaces";

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
	shouldStopQueue = false
}) => {
	const [message, setMessage] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { visualNovelMode, setVisualNovelMode } = useUserSettings();

	// Auto-resize the textarea as content grows
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	}, [message]);

	const handleSendMessage = () => {
		if (message.trim() && !isProcessing && !isProcessingQueue) {
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
		setVisualNovelMode(!visualNovelMode);
	};

	const handleStopQueue = () => {
		if (onStopQueue) {
			onStopQueue();
		}
	};

	// Get the name of the character currently typing
	const getTypingCharacterName = () => {
		if (currentlyTypingCharacter && allCharacters) {
			const character = allCharacters.find(c => c.id === currentlyTypingCharacter);
			return character?.name || "Unknown";
		}
		return null;
	};

	// Get names of characters in the queue
	const getQueueCharacterNames = () => {
		if (responseQueue && responseQueue.length > 0 && allCharacters) {
			return responseQueue.map(id => {
				const character = allCharacters.find(c => c.id === id);
				return character?.name || "Unknown";
			});
		}
		return [];
	};

	const typingCharacterName = getTypingCharacterName();
	const queueCharacterNames = getQueueCharacterNames();
	const isGroupChat = selectedCharacter?.type === 'group';

	return (
		<div className="chat-input-container">
			<div className="vn-mode-toggle-container">
				<button
					type="button"
					className={`vn-mode-toggle-button ${visualNovelMode ? "active" : ""}`}
					onClick={toggleVisualNovelMode}
					title={
						visualNovelMode
							? "Switch to Chat Mode"
							: "Switch to Visual Novel Mode"
					}
				>
					{visualNovelMode ? "Chat Mode" : "Visual Novel Mode"}
				</button>
			</div>
			
			{/* Queue Status Indicator */}
			{isProcessingQueue && isGroupChat && (
				<div className="queue-status-indicator">
					{typingCharacterName && (
						<div className="typing-indicator">
							<span className="typing-character">{typingCharacterName}</span> is typing...
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
					placeholder={isProcessingQueue ? "Waiting for responses..." : "Type your message..."}
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
						disabled={!message.trim() || isProcessing || isProcessingQueue}
					>
						Send
					</button>
				)}
			</div>
		</div>
	);
};

export default ChatInput;
