import { useState } from "react";
import type React from "react";
import type { Character } from "../../types/interfaces";
import ChatDropdown from "./ChatDropdown";
import ApiKeyModal from "../shared/ApiKeyModal";
import PersonaModal from "../shared/PersonaModal";
import WritingTipsModal from "../shared/WritingTipsModal";
import { useUserSettings } from "../../contexts/UserSettingsContext";

interface ChatHeaderProps {
	selectedCharacter: Character | null;
	onNewChat: (
		chatName: string,
		scenario: string,
		greeting: string,
		background: string,
	) => void;
	onEditChat: (
		chatId: number,
		chatName: string,
		scenario: string,
		background: string,
	) => void;
	onDeleteChat: (chatId: number) => void;
	onSelectChat: (chatId: number) => void;
	activeChatId: number | null;
	setShowHelpModal: (show: boolean) => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
	selectedCharacter,
	onNewChat,
	onEditChat,
	onDeleteChat,
	onSelectChat,
	activeChatId,
	setShowHelpModal,
}) => {
	const {
		apiKey,
		setApiKey,
		huggingFaceApiKey,
		setHuggingFaceApiKey,
		userPersona,
		setUserPersona,
		selectedModel,
		setSelectedModel,
		temperature,
		setTemperature,
	} = useUserSettings();

	const [showApiKeyModal, setShowApiKeyModal] = useState(false);
	const [showPersonaModal, setShowPersonaModal] = useState(false);
	const [showWritingTipsModal, setShowWritingTipsModal] = useState(false);

	const handleHelpClick = () => {
		setShowHelpModal(true);
	};

	const handleWritingTipsClick = () => {
		setShowWritingTipsModal(true);
	};

	return (
		<div className="chat-header">
			<h2>
				{selectedCharacter ? selectedCharacter.name : "Select a character"}
			</h2>

			<div className="chat-header-actions">
				<button
					className="header-action-button persona-button"
					onClick={() => setShowPersonaModal(true)}
					title="User Persona Settings"
				>
					🎭
				</button>
				<button
					className="header-action-button api-button"
					onClick={() => setShowApiKeyModal(true)}
					title="API Settings"
				>
					🔑
				</button>
				<button
					className="header-action-button writing-tips-button"
					onClick={handleWritingTipsClick}
					title="Writing Tips"
				>
					✍️
				</button>
				<button
					className="header-action-button help-button"
					onClick={handleHelpClick}
					title="Help"
				>
					❔
				</button>
			</div>

			{selectedCharacter && (
				<ChatDropdown
					selectedCharacter={selectedCharacter}
					activeChatId={activeChatId}
					onSelectChat={onSelectChat}
					onNewChat={onNewChat}
					onEditChat={onEditChat}
					onDeleteChat={onDeleteChat}
				/>
			)}

			{showWritingTipsModal && (
				<WritingTipsModal onClose={() => setShowWritingTipsModal(false)} />
			)}

			{showApiKeyModal && (
				<ApiKeyModal
					onClose={() => setShowApiKeyModal(false)}
					onSave={(apiKey, huggingFaceApiKey) => {
						setApiKey(apiKey);
						setHuggingFaceApiKey(huggingFaceApiKey);
					}}
					currentApiKey={apiKey}
					currentHuggingFaceApiKey={huggingFaceApiKey}
					currentModel={selectedModel}
					onModelChange={setSelectedModel}
					currentTemperature={temperature}
					onTemperatureChange={setTemperature}
				/>
			)}

			{showPersonaModal && (
				<PersonaModal
					onClose={() => setShowPersonaModal(false)}
					onSave={setUserPersona}
					currentPersona={userPersona}
				/>
			)}
		</div>
	);
};

export default ChatHeader;
