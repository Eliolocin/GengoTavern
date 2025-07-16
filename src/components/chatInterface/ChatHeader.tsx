import { useState } from "react";
import type React from "react";
import type { Character, GroupGreeting } from "../../types/interfaces";
import ChatDropdown from "./ChatDropdown";
import ApiKeyModal from "../shared/ApiKeyModal";
import PersonaModal from "../shared/PersonaModal";
import WritingTipsModal from "../shared/WritingTipsModal";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import { UserIcon, KeyIcon, PencilSquareIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

interface ChatHeaderProps {
	selectedCharacter: Character | null;
	onNewChat: (
		chatName: string,
		scenario: string,
		greeting: string,
		background: string,
	) => void;
	onNewGroupChat?: (
		chatName: string,
		scenario: string,
		greetings: GroupGreeting[],
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
	allCharacters?: Character[];
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
	selectedCharacter,
	onNewChat,
	onNewGroupChat,
	onEditChat,
	onDeleteChat,
	onSelectChat,
	activeChatId,
	setShowHelpModal,
	allCharacters = [],
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
			<div className="chat-header-actions">
				<button
					type="button"
					className="header-action-button persona-button"
					onClick={() => setShowPersonaModal(true)}
					title="User Persona Settings"
				>
					<UserIcon className="w-5 h-5" />
				</button>
				<button
					type="button"
					className="header-action-button api-button"
					onClick={() => setShowApiKeyModal(true)}
					title="API Settings"
				>
					<KeyIcon className="w-5 h-5" />
				</button>
				<button
					type="button"
					className="header-action-button writing-tips-button"
					onClick={handleWritingTipsClick}
					title="Writing Tips"
				>
					<PencilSquareIcon className="w-5 h-5" />
				</button>
				<button
					type="button"
					className="header-action-button help-button"
					onClick={handleHelpClick}
					title="Help"
				>
					<QuestionMarkCircleIcon className="w-5 h-5" />
				</button>
			</div>

			{selectedCharacter && (
				<ChatDropdown
					selectedCharacter={selectedCharacter}
					activeChatId={activeChatId}
					onSelectChat={onSelectChat}
					onNewChat={onNewChat}
					onNewGroupChat={onNewGroupChat}
					onEditChat={onEditChat}
					onDeleteChat={onDeleteChat}
					allCharacters={allCharacters}
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
