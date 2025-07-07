import { useState, useEffect, useRef } from "react";
import type { FC, KeyboardEvent } from "react";
import { useUserSettings } from "../../contexts/UserSettingsContext";

interface ChatInputProps {
	onSendMessage: (message: string) => void;
	isProcessing: boolean;
}

const ChatInput: FC<ChatInputProps> = ({ onSendMessage, isProcessing }) => {
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
		if (message.trim() && !isProcessing) {
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
			<div className="chat-input">
				<textarea
					ref={textareaRef}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Type your message..."
					disabled={isProcessing}
					rows={1}
				/>
				<button
					type="button"
					onClick={handleSendMessage}
					disabled={!message.trim() || isProcessing}
				>
					Send
				</button>
			</div>
		</div>
	);
};

export default ChatInput;
