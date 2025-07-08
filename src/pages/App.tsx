import { useState, useEffect, useRef } from "react";
import "../styles/App.css";

import type { Message, Chat, Character } from "../types/interfaces";
// Import our new utilities
import { buildPrompt } from "../utils/promptBuilder";
import { callGeminiAPI, sanitizeResponse } from "../utils/geminiAPI";
import { emotionClassifier } from "../utils/emotionClassifier";
import SidePanel from "../components/layout/SidePanel";
import CharacterGrid from "../components/characterSelection/CharacterGrid";
import ChatHeader from "../components/chatInterface/ChatHeader";
import ChatMessages from "../components/chatInterface/ChatMessages";
import ChatInput from "../components/chatInterface/ChatInput";
import CharacterForm from "../components/characterCustomization/CharacterForm";
import { CharacterProvider, useCharacters } from "../contexts/CharacterContext";
import {
	UserSettingsProvider,
	useUserSettings,
} from "../contexts/UserSettingsContext";
import { AppProvider, useAppContext } from "../contexts/AppContext";
import HelpModal from "../components/shared/HelpModal";
import FileSystemSetupModal from "../components/shared/FileSystemSetupModal";
import NewCharacterModal from "../components/shared/NewCharacterModal";
import ImageToTextModal from "../components/shared/ImageToTextModal";
import type { GeneratedCharacterData } from "../components/shared/ImageToTextModal";
import StorageIndicator from "../components/shared/StorageIndicator";
import { storageManager } from "../utils/storageManager";

// Main App Component wrapper with Providers
const App: React.FC = () => {
	return (
		<AppProvider>
			<UserSettingsProvider>
				<CharacterProvider>
					<AppContent />
				</CharacterProvider>
			</UserSettingsProvider>
		</AppProvider>
	);
};

// Internal component that uses the Character context
const AppContent: React.FC = () => {
	const {
		characters,
		selectedCharacter,
		isLoading,
		error,
		createNewCharacter,
		selectCharacter,
		updateCharacter,
		deleteCharacter,
		saveCharacter,
		addGeneratedCharacter,
		importCharacter,
	} = useCharacters();
	const {
		isSetupModalOpen,
		openSetupModal,
		closeSetupModal,
		setStorageStrategy,
		userSettings,
	} = useAppContext();
	const {
		apiKey,
		huggingFaceApiKey,
		selectedModel,
		temperature,
		visualNovelMode,
	} = useUserSettings();

	const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
	const [isRightCollapsed, setIsRightCollapsed] = useState(false);
	const [activeMessages, setActiveMessages] = useState<Message[]>([]);
	const [activeChatId, setActiveChatId] = useState<number | null>(null);
	const [localError, setLocalError] = useState<string | null>(null);
	const [activeChat, setActiveChat] = useState<Chat | null>(null);
	const [showHelpModal, setShowHelpModal] = useState<boolean>(true); // Default to true to show at startup
	const [showNewCharacterModal, setShowNewCharacterModal] = useState<boolean>(false);
	const [showImageToTextModal, setShowImageToTextModal] = useState<boolean>(false);
	const [isMobile, setIsMobile] = useState<boolean>(false);
	const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);

	// Use ref to track background URL for cleanup without triggering re-renders
	const backgroundUrlRef = useRef<string | null>(null);

	// Clear local error after 5 seconds
	useEffect(() => {
		if (localError) {
			const timer = setTimeout(() => setLocalError(null), 5000);
			return () => clearTimeout(timer);
		}
	}, [localError]);

	// Effect to initialize storage and prompt for setup
	useEffect(() => {
		const initializeStorage = async () => {
			await storageManager.initialize();
			const strategy = storageManager.getStrategy();
			setStorageStrategy(strategy);

			// If the API is supported but no directory is selected, show the setup modal.
			if (strategy === "localstorage" && "showDirectoryPicker" in window) {
				// Check if the user has previously skipped the setup
				const hasSkipped = sessionStorage.getItem("hasSkippedFSAccess");
				if (!hasSkipped) {
					openSetupModal();
				}
			}

			// Note: Emotion classifier will load automatically on first use
			// This prevents startup errors and only downloads the model when needed
		};

		initializeStorage();
	}, [openSetupModal, setStorageStrategy]);

	// Effect to handle active chat when character changes
	useEffect(() => {
		if (selectedCharacter) {
			if (selectedCharacter.chats.length > 0) {
				// Find an active chat or default to first chat
				const activeChat =
					selectedCharacter.chats.find((chat) => chat.isActive) ||
					selectedCharacter.chats[0];

				setActiveChatId(activeChat.id);
				setActiveChat(activeChat);
				setActiveMessages(activeChat.messages);
			} else {
				// No chats exist for this character
				setActiveMessages([]);
				setActiveChatId(null);
				setActiveChat(null);
			}
		} else {
			setActiveMessages([]);
			setActiveChatId(null);
			setActiveChat(null);
		}
	}, [selectedCharacter]);

	useEffect(() => {
		// Check if user has previously chosen to hide the help modal at startup
		const hideAtStartup = localStorage.getItem("hideHelpAtStartup") === "true";
		if (hideAtStartup) {
			setShowHelpModal(false);
		}
	}, []);

	// Add this alongside your other useEffect hooks in AppContent
	useEffect(() => {
		// Function to check if we're in mobile mode
		const checkMobileMode = () => {
			const isMobileView = window.innerWidth <= 768; // Match your CSS breakpoint
			setIsMobile(isMobileView);
		};

		// Check initially
		checkMobileMode();

		// Set up event listener for window resize
		window.addEventListener("resize", checkMobileMode);

		// Clean up
		return () => window.removeEventListener("resize", checkMobileMode);
	}, []);

	const handleNewChat = async (
		chatName: string,
		scenario: string,
		greeting: string,
		background: string,
	) => {
		if (!selectedCharacter) return;

		try {
			const newChatId = Date.now();
			const messages: Message[] = [];

			// Add system message with scenario if provided
			if (scenario) {
				messages.push({
					id: Date.now(),
					text: scenario,
					sender: "system",
					timestamp: Date.now(),
				});
			}

			// Add greeting message from character if provided
			if (greeting) {
				// 1. Classify emotion for character greeting message (if HF API key is available)
				const greetingEmotion = huggingFaceApiKey
					? await emotionClassifier.classify(greeting, huggingFaceApiKey)
					: null;
				console.log(
					`Character greeting emotion: ${greetingEmotion || "not classified (HF API key not set)"}`,
				);

				messages.push({
					id: Date.now() + 1,
					text: greeting,
					sender: "character",
					timestamp: Date.now() + 1,
					emotion: greetingEmotion || undefined, // 2. Store detected emotion or undefined if HF API key not set
				});
			}

			// Mark all existing chats as not active
			const updatedChats = selectedCharacter.chats.map((chat) => ({
				...chat,
				isActive: false,
			}));

			// Create new chat with isActive flag
			const newChat: Chat = {
				id: newChatId,
				name: chatName,
				scenario: scenario,
				background: background,
				messages: messages,
				lastActivity: Date.now(),
				isActive: true, // Mark as active
			};

			const updatedCharacter = {
				...selectedCharacter,
				chats: [...updatedChats, newChat], // Add to existing chats
			};

			// Update character with new chats array
			updateCharacter(selectedCharacter.id, "chats", updatedCharacter.chats);

			// Make sure the new chat is active locally too
			setActiveChatId(newChatId);
			setActiveChat(newChat);
			setActiveMessages(messages);
		} catch (err) {
			setLocalError(`Failed to create new chat: ${err}`);
		}
	};

	const handleEditChat = (
		chatId: number,
		chatName: string,
		scenario: string,
		background: string,
	) => {
		if (!selectedCharacter) return;

		try {
			const updatedChats = selectedCharacter.chats.map((chat) => {
				if (chat.id === chatId) {
					// Create updated chat
					const updatedChat = {
						...chat,
						name: chatName,
						scenario: scenario,
						background: background,
						lastActivity: Date.now(),
					};

					// Find and update the scenario message (first system message)
					if (updatedChat.messages.length > 0) {
						const firstMessage = updatedChat.messages[0];

						if (firstMessage.sender === "system") {
							// Update the existing scenario message text
							firstMessage.text = scenario;
						} else if (scenario) {
							// If first message isn't a system message but we have a scenario, insert one
							updatedChat.messages.unshift({
								id: Date.now(),
								text: scenario,
								sender: "system",
								timestamp: Date.now(),
							});
						}
					} else if (scenario) {
						// If no messages but scenario is provided, create scenario message
						updatedChat.messages.push({
							id: Date.now(),
							text: scenario,
							sender: "system",
							timestamp: Date.now(),
						});
					}

					return updatedChat;
				}
				return chat;
			});

			// Update the character with the updated chats
			updateCharacter(selectedCharacter.id, "chats", updatedChats, true);

			// If this is the active chat, update active messages
			if (chatId === activeChatId) {
				const chat = updatedChats.find((c) => c.id === chatId);
				if (chat) {
					setActiveMessages(chat.messages);
					setActiveChat(chat);
				}
			}
		} catch (err) {
			setLocalError(`Failed to update chat: ${err}`);
		}
	};

	const handleDeleteChat = (chatId: number) => {
		if (!selectedCharacter) return;

		try {
			// Filter out the deleted chat - no restriction on deleting all chats
			const updatedChats = selectedCharacter.chats.filter(
				(chat) => chat.id !== chatId,
			);

			// Update character with filtered chats
			updateCharacter(selectedCharacter.id, "chats", updatedChats);

			// If we deleted the active chat, check if there are any chats left
			if (chatId === activeChatId) {
				if (updatedChats.length > 0) {
					// Select another chat if available
					const newActiveChat = updatedChats[0];
					setActiveChatId(newActiveChat.id);
					setActiveMessages(newActiveChat.messages);
					setActiveChat(newActiveChat);
				} else {
					// No chats left
					setActiveChatId(null);
					setActiveMessages([]);
					setActiveChat(null);
				}
			}
		} catch (err) {
			setLocalError(`Failed to delete chat: ${err}`);
		}
	};

	const handleSelectChat = (chatId: number) => {
		if (!selectedCharacter) return;

		try {
			// Update isActive flag on all chats
			const updatedChats = selectedCharacter.chats.map((chat) => ({
				...chat,
				isActive: chat.id === chatId,
			}));

			// Find the newly active chat
			const newActiveChat = updatedChats.find((c) => c.id === chatId);
			if (!newActiveChat) return;

			// Update character with new active flags
			updateCharacter(selectedCharacter.id, "chats", updatedChats, true);

			// Update local state
			setActiveChatId(chatId);
			setActiveChat(newActiveChat);
			setActiveMessages(newActiveChat.messages);
		} catch (err) {
			setLocalError(`Failed to switch chat: ${err}`);
		}
	};

	const handleSendMessage = async (text: string) => {
		if (!selectedCharacter || activeChatId === null) return;

		const newMessage: Message = {
			id: Date.now(),
			text,
			sender: "user",
			timestamp: Date.now(),
		};

		const updatedMessages = [...activeMessages, newMessage];

		// First update local state
		setActiveMessages(updatedMessages);

		// Then update in character state but keep current active chat
		// We need to wait for the chat messages to be updated properly
		await updateChatMessagesAsync(updatedMessages, false);

		// Add a loading/generating message
		const generatingMsgId = Date.now() + 1;
		const generatingMessage: Message = {
			id: generatingMsgId,
			text: "...",
			sender: "character",
			timestamp: Date.now() + 1,
			isGenerating: true,
		};

		const messagesWithGenerating = [...updatedMessages, generatingMessage];
		setActiveMessages(messagesWithGenerating);

		try {
			// Find the active chat AFTER it's been updated
			const activeChat = selectedCharacter.chats.find(
				(chat) => chat.id === activeChatId,
			);
			if (!activeChat) throw new Error("Chat not found");

			// Double-check that the user's message is in the chat
			if (!activeChat.messages.some((msg) => msg.id === newMessage.id)) {
				console.warn("Ensuring user message is included in prompt");
				// If not found in the chat, manually include it in our prompt building
				activeChat.messages = [...activeChat.messages, newMessage];
			}

			// Build the prompt with the updated chat that includes the new message
			const { prompt, settings } = buildPrompt(
				selectedCharacter,
				activeChat,
				"User",
			);

			// Call the API
			let response = await callGeminiAPI(prompt, settings);

			// Check for errors
			if (response.error) {
				let errorMessage = response.error;

				// Add helpful suggestions based on error type
				if (response.errorType === "RATE_LIMIT") {
					errorMessage += " This typically resolves within a minute.";
				} else if (response.errorType === "API_KEY") {
					errorMessage += " Go to API Settings to update your key.";
				} else if (response.errorType === "BLOCKED_CONTENT") {
					errorMessage +=
						" Try rewording your message or adjusting the conversation.";
				} else if (response.errorType === "MODEL_ERROR") {
					errorMessage += " You can select a different model in API Settings.";
				}

				throw new Error(errorMessage);
			}

			// Process the response
			const sanitizedResponse = sanitizeResponse(response.text);

			// Only classify emotion if in Visual Novel mode or if HF API key is not available
			const detectedEmotion =
				visualNovelMode && huggingFaceApiKey
					? await emotionClassifier.classify(
							sanitizedResponse,
							huggingFaceApiKey,
						)
					: null;

			if (visualNovelMode) {
				console.log(
					`Character message emotion: ${detectedEmotion || "not classified (HF API key not set)"}`,
				);
			} else {
				console.log(
					"Emotion classification skipped (not in Visual Novel mode)",
				);
			}

			// First, immediately show the message without waiting for emotion classification
			const initialResponseMessage: Message = {
				id: generatingMsgId, // Replace the generating message
				text: sanitizedResponse,
				sender: "character",
				timestamp: Date.now() + 1000,
			};

			// Update messages immediately without waiting for emotion classification
			const initialMessages = [...updatedMessages, initialResponseMessage];
			setActiveMessages(initialMessages);
			await updateChatMessagesAsync(initialMessages, false);

			// Then update with emotion once classification is complete
			if (detectedEmotion) {
				const responseWithEmotion: Message = {
					...initialResponseMessage,
					emotion: detectedEmotion,
				};

				const finalMessages = initialMessages.map((msg) =>
					msg.id === generatingMsgId ? responseWithEmotion : msg,
				);

				setActiveMessages(finalMessages);
				updateChatMessages(finalMessages, false);
			}
		} catch (err) {
			console.error("Message generation error:", err);

			// Remove the generating message
			setActiveMessages(updatedMessages);

			// Add error message
			const errorMsg =
				err instanceof Error ? err.message : "Unknown error occurred";
			const errorMessage: Message = {
				id: Date.now() + 2,
				text: `Failed to generate response: ${errorMsg}.`,
				sender: "system",
				timestamp: Date.now() + 2000,
				isError: true,
			};

			const messagesWithError = [...updatedMessages, errorMessage];
			setActiveMessages(messagesWithError);
			updateChatMessages(messagesWithError, false);
		}
	};

	// Add this handler function
	const handleRegenerateMessage = async (messageId: number) => {
		if (!selectedCharacter || activeChatId === null) return;

		try {
			// Find the active chat
			const activeChat = selectedCharacter.chats.find(
				(chat) => chat.id === activeChatId,
			);
			if (!activeChat) throw new Error("Chat not found");

			// Find the message to regenerate
			const messageToRegenerate = activeChat.messages.find(
				(msg) => msg.id === messageId,
			);
			if (!messageToRegenerate) throw new Error("Message not found");

			// Show loading state
			const updatedMessages = activeMessages.map((msg) => {
				if (msg.id === messageId) {
					return {
						...msg,
						isGenerating: true,
					};
				}
				return msg;
			});

			setActiveMessages(updatedMessages);

			// Find the index of the message to regenerate
			const messageIndex = activeChat.messages.findIndex(
				(msg) => msg.id === messageId,
			);

			// Create a copy of messages up to the message we're regenerating
			const messagesForPrompt = activeChat.messages.slice(0, messageIndex);

			// Create a temporary chat object for prompt building
			const tempChat = {
				...activeChat,
				messages: messagesForPrompt,
			};

			// Build the prompt
			const { prompt, settings } = buildPrompt(
				selectedCharacter,
				tempChat,
				"User",
			);

			// Call the API
			let response = await callGeminiAPI(prompt, settings);

			// Check for errors
			if (response.error) {
				throw new Error(response.error);
			}

			// Process the response
			const sanitizedResponse = sanitizeResponse(response.text);

			// Only classify emotion if in Visual Novel mode
			const detectedEmotion =
				visualNovelMode && huggingFaceApiKey
					? await emotionClassifier.classify(
							sanitizedResponse,
							huggingFaceApiKey,
						)
					: null;

			if (visualNovelMode) {
				console.log(
					`Regenerated character message emotion: ${detectedEmotion || "not classified (HF API key not set)"}`,
				);
			} else {
				console.log(
					"Emotion classification skipped (not in Visual Novel mode)",
				);
			}

			// First, immediately update with the regenerated message without emotion
			const currentUpdatedMsg = updatedMessages.find((u) => u.id === messageId);

			const initialRegeneratedMessages = activeMessages.map((msg) => {
				if (msg.id === messageId) {
					return {
						...msg,
						text: sanitizedResponse,
						isGenerating: false,
						timestamp: Date.now(),
						// Preserve the regenHistory from the updated message
						regenHistory: currentUpdatedMsg?.regenHistory || [],
					};
				}
				return msg;
			});

			// Update the UI immediately
			setActiveMessages(initialRegeneratedMessages);
			await updateChatMessagesAsync(initialRegeneratedMessages, false);

			// Then update with emotion once classification is complete
			if (detectedEmotion) {
				const regeneratedMessagesWithEmotion = initialRegeneratedMessages.map(
					(msg) => {
						if (msg.id === messageId) {
							return {
								...msg,
								emotion: detectedEmotion,
							};
						}
						return msg;
					},
				);

				// Update the UI with emotion data
				setActiveMessages(regeneratedMessagesWithEmotion);
				await updateChatMessagesAsync(regeneratedMessagesWithEmotion, false);
			}
		} catch (err) {
			console.error("Message regeneration error:", err);

			// Update UI to show error
			const updatedMessages = activeMessages.map((msg) => {
				if (msg.id === messageId) {
					return {
						...msg,
						isGenerating: false, // Remove loading state
					};
				}
				return msg;
			});

			setActiveMessages(updatedMessages);

			// Add error message
			const errorMsg =
				err instanceof Error ? err.message : "Unknown error occurred";
			const errorMessage: Message = {
				id: Date.now(),
				text: `Failed to regenerate response: ${errorMsg}.`,
				sender: "system",
				timestamp: Date.now(),
				isError: true,
			};

			const messagesWithError = [...updatedMessages, errorMessage];
			setActiveMessages(messagesWithError);
			updateChatMessages(messagesWithError, false);
		}
	};

	// Update the continue message handler with a simpler approach
	const handleContinueMessage = async (messageId: number) => {
		if (!selectedCharacter || activeChatId === null) return;

		try {
			// Find the active chat
			const activeChat = selectedCharacter.chats.find(
				(chat) => chat.id === activeChatId,
			);
			if (!activeChat) throw new Error("Chat not found");

			// Find the message to continue
			const messageToContinue = activeChat.messages.find(
				(msg) => msg.id === messageId,
			);
			if (!messageToContinue) throw new Error("Message not found");

			// Show loading state
			const updatedMessages = activeMessages.map((msg) => {
				if (msg.id === messageId) {
					return {
						...msg,
						isGenerating: true,
					};
				}
				return msg;
			});

			setActiveMessages(updatedMessages);

			// Create a copy of messages up to and including the message we're continuing
			const messageIndex = activeChat.messages.findIndex(
				(msg) => msg.id === messageId,
			);
			const messagesForPrompt = activeChat.messages.slice(0, messageIndex + 1);

			// Create a temporary chat object for prompt building
			const tempChat = {
				...activeChat,
				messages: messagesForPrompt,
			};

			// Build the prompt with a special continuation indicator
			const { prompt, settings } = buildPrompt(
				selectedCharacter,
				tempChat,
				"User",
				true, // isContinuation flag
			);

			// Call the API
			let response = await callGeminiAPI(prompt, settings);

			// Check for errors
			if (response.error) {
				throw new Error(response.error);
			}

			// Process the response
			const sanitizedResponse = sanitizeResponse(response.text);

			// Only classify emotion if in Visual Novel mode
			const combinedText = messageToContinue.text + " " + sanitizedResponse;
			const detectedEmotion =
				visualNovelMode && huggingFaceApiKey
					? await emotionClassifier.classify(combinedText, huggingFaceApiKey)
					: null;

			if (visualNovelMode) {
				console.log(
					`Continued character message emotion: ${detectedEmotion || "not classified (HF API key not set)"}`,
				);
			} else {
				console.log(
					"Emotion classification skipped (not in Visual Novel mode)",
				);
			}

			// First, immediately update with the continued message without emotion
			const initialContinuedMessages = activeMessages.map((msg) => {
				if (msg.id === messageId) {
					return {
						...msg,
						text: combinedText,
						isGenerating: false,
					};
				}
				return msg;
			});

			// Update the UI immediately
			setActiveMessages(initialContinuedMessages);
			await updateChatMessagesAsync(initialContinuedMessages, false);

			// Then update with emotion once classification is complete
			if (detectedEmotion) {
				const continuedMessagesWithEmotion = initialContinuedMessages.map(
					(msg) => {
						if (msg.id === messageId) {
							return {
								...msg,
								emotion: detectedEmotion,
							};
						}
						return msg;
					},
				);

				// Update the UI with emotion data
				setActiveMessages(continuedMessagesWithEmotion);
				await updateChatMessagesAsync(continuedMessagesWithEmotion, false);
			}
		} catch (err) {
			console.error("Message continuation error:", err);

			// Restore original message without ellipsis if there was an error
			const originalMessage = activeMessages.find(
				(msg) => msg.id === messageId,
			);
			if (originalMessage) {
				const restoredMessages = activeMessages.map((msg) => {
					if (msg.id === messageId) {
						return {
							...originalMessage,
							isGenerating: false,
						};
					}
					return msg;
				});

				setActiveMessages(restoredMessages);
			}

			// Add error message
			const errorMsg =
				err instanceof Error ? err.message : "Unknown error occurred";
			const errorMessage: Message = {
				id: Date.now(),
				text: `Failed to continue response: ${errorMsg}.`,
				sender: "system",
				timestamp: Date.now(),
				isError: true,
			};

			const messagesWithError = [...activeMessages, errorMessage];
			setActiveMessages(messagesWithError);
			updateChatMessages(messagesWithError, false);
		}
	};

	// Function to handle error message deletion
	const handleDeleteErrorMessage = (messageId: number) => {
		if (!activeMessages || activeChatId === null) return;

		const updatedMessages = activeMessages.filter(
			(msg) => msg.id !== messageId,
		);
		setActiveMessages(updatedMessages);
		updateChatMessages(updatedMessages, false);
	};

	// Add a parameter to prevent switching chats
	const updateChatMessages = (
		messages: Message[],
		switchChat: boolean = false,
	) => {
		if (!selectedCharacter || activeChatId === null) return;

		try {
			const updatedChats = selectedCharacter.chats.map((chat) => {
				if (chat.id === activeChatId) {
					const updatedChat = {
						...chat,
						messages,
						lastActivity: Date.now(),
						isActive: true, // Ensure this chat stays active
					};

					// Update activeChat state
					if (!switchChat) {
						setActiveChat(updatedChat);
					}

					return updatedChat;
				}
				return {
					...chat,
					isActive: false, // Mark other chats as not active
				};
			});

			// Update character but keep current active chat
			updateCharacter(selectedCharacter.id, "chats", updatedChats, true);
		} catch (err) {
			setLocalError(`Failed to update chat: ${err}`);
		}
	};

	// Add this new function for asynchronous chat message updating
	const updateChatMessagesAsync = async (
		messages: Message[],
		switchChat: boolean = false,
	): Promise<void> => {
		return new Promise((resolve) => {
			if (!selectedCharacter || activeChatId === null) {
				resolve();
				return;
			}

			try {
				const updatedChats = selectedCharacter.chats.map((chat) => {
					if (chat.id === activeChatId) {
						const updatedChat = {
							...chat,
							messages,
							lastActivity: Date.now(),
							isActive: true, // Ensure this chat stays active
						};

						// Update activeChat state
						if (!switchChat) {
							setActiveChat(updatedChat);
						}

						return updatedChat;
					}
					return {
						...chat,
						isActive: false, // Mark other chats as not active
					};
				});

				// Update character but keep current active chat
				updateCharacter(selectedCharacter.id, "chats", updatedChats, true);

				// Wait for a short tick to ensure state updates are processed
				setTimeout(() => {
					resolve();
				}, 10);
			} catch (err) {
				setLocalError(`Failed to update chat: ${err}`);
				resolve();
			}
		});
	};

	const handleUpdateForm = (field: string, value: any) => {
		if (!selectedCharacter) return;

		// Update character but don't reset active chat
		updateCharacter(selectedCharacter.id, field, value, true);
	};

	/**
	 * 1. Open the new character modal instead of directly creating a character
	 */
	const handleOpenNewCharacterModal = () => {
		setShowNewCharacterModal(true);
	};

	/**
	 * 2. Close the new character modal
	 */
	const handleCloseNewCharacterModal = () => {
		setShowNewCharacterModal(false);
	};

	/**
	 * 3. Handle creating an empty character (current behavior)
	 */
	const handleCreateEmptyCharacter = async () => {
		setShowNewCharacterModal(false);
		await createNewCharacter();
	};

	/**
	 * 4. Handle creating character from image - open the ImageToTextModal
	 */
	const handleCreateFromImage = () => {
		setShowNewCharacterModal(false);
		setShowImageToTextModal(true);
	};

	/**
	 * 5. Handle creating group chat (placeholder for now)
	 */
	const handleCreateGroupChat = () => {
		setShowNewCharacterModal(false);
		// TODO: Implement group chat creation
		alert("Group Chat feature coming soon! This will allow you to create chats with multiple characters.");
	};

	/**
	 * 6. Handle closing the ImageToTextModal
	 */
	const handleCloseImageToTextModal = () => {
		setShowImageToTextModal(false);
	};

	/**
	 * 7. Handle accepting the generated character from ImageToTextModal
	 * @param characterData - The generated character data
	 */
	const handleAcceptGeneratedCharacter = async (characterData: GeneratedCharacterData) => {
		try {
			// 1. Create character object with all the generated data
			const newCharacter: Character = {
				id: Date.now(),
				name: characterData.name, // Use the generated name immediately
				image: characterData.image,
				description: characterData.description,
				defaultGreeting: characterData.defaultGreeting,
				defaultScenario: characterData.defaultScenario,
				sampleDialogues: characterData.sampleDialogues,
				chats: [], // Start with no chats
			};

			// 2. Use the new addGeneratedCharacter function (follows importCharacter pattern)
			// This will add to characters array, select it, and save to storage all at once
			await addGeneratedCharacter(newCharacter);

			console.log('✅ Generated character created successfully:', characterData.name);

		} catch (error) {
			console.error('Failed to create generated character:', error);
			setLocalError(`Failed to create character: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	};

	// Get the current background from the active chat
	const currentBackgroundFilename =
		activeChat?.background || selectedCharacter?.defaultBackground;

	// Effect to load the background URL from the filename
	useEffect(() => {
		let isMounted = true;
		const loadUrl = async () => {
			if (currentBackgroundFilename) {
				try {
					const url = await storageManager.loadBackgroundAsUrl(
						currentBackgroundFilename,
					);
					if (isMounted) {
						setBackgroundUrl(url);
						// Update ref for cleanup
						backgroundUrlRef.current = url;
					}
				} catch (error) {
					console.error("Failed to load background:", error);
					if (isMounted) {
						setBackgroundUrl(null);
						backgroundUrlRef.current = null;
					}
				}
			} else {
				setBackgroundUrl(null);
				backgroundUrlRef.current = null;
			}
		};

		loadUrl();

		return () => {
			isMounted = false;
			if (backgroundUrlRef.current) {
				// Revoke the object URL to avoid memory leaks
				URL.revokeObjectURL(backgroundUrlRef.current);
			}
		};
	}, [currentBackgroundFilename]);

	if (isLoading) {
		return <div className="loading">Loading characters...</div>;
	}

	const handleEditMessage = (messageId: number, newText: string) => {
		if (!selectedCharacter || activeChatId === null) return;

		try {
			// Find the message to edit
			const messageToEdit = activeMessages.find((msg) => msg.id === messageId);
			if (!messageToEdit) return;

			// Create a copy of messages with the edited message
			const updatedMessages = activeMessages.map((msg) => {
				if (msg.id === messageId) {
					// Store original text in editHistory
					const editHistory = msg.editHistory || [];
					return {
						...msg,
						text: newText,
						editHistory: [...editHistory, msg.text],
					};
				}
				return msg;
			});

			// Update UI and save to character state
			setActiveMessages(updatedMessages);
			updateChatMessages(updatedMessages, false);
		} catch (err) {
			setLocalError(`Failed to edit message: ${err}`);
		}
	};

	const handleDeleteMessage = (messageId: number) => {
		if (!selectedCharacter || activeChatId === null) return;

		try {
			// Find the message to delete
			const messageToDelete = activeMessages.find(
				(msg) => msg.id === messageId,
			);
			if (!messageToDelete) return;

			// Remove the message from the active messages
			const updatedMessages = activeMessages.filter(
				(msg) => msg.id !== messageId,
			);

			// Find the active chat
			const activeChat = selectedCharacter.chats.find(
				(chat) => chat.id === activeChatId,
			);
			if (!activeChat) throw new Error("Chat not found");

			// Prepare the updated chat with the message moved to deletedMessages
			const updatedChat = {
				...activeChat,
				messages: updatedMessages,
				// Add to deletedMessages array or create if it doesn't exist
				deletedMessages: [
					...(activeChat.deletedMessages || []),
					messageToDelete,
				],
			};

			// Update the chats in the character
			const updatedChats = selectedCharacter.chats.map((chat) =>
				chat.id === activeChatId ? updatedChat : chat,
			);

			// Update character with the new chat data
			updateCharacter(selectedCharacter.id, "chats", updatedChats, true);

			// Update local state
			setActiveMessages(updatedMessages);
			setActiveChat(updatedChat);
		} catch (err) {
			setLocalError(`Failed to delete message: ${err}`);
		}
	};

	return (
		<div
			className="app-container"
			style={
				backgroundUrl
					? {
							backgroundImage: `url(${backgroundUrl})`,
							backgroundSize: "cover",
							backgroundPosition: "center",
							backgroundAttachment: "fixed",
						}
					: undefined
			}
		>
			<div className="app-backdrop"></div>

			{/* Show error toast if there's an error */}
			{(error || localError) && (
				<div className="error-toast">
					{error || localError}
					<button onClick={() => setLocalError(null)}>×</button>
				</div>
			)}

			{/* Left Panel */}
			<SidePanel side="left" isMobile={isMobile}>
				<div className="character-actions">
					<button
						type="button"
						className="import-button"
						onClick={importCharacter}
					>
						Import Character
					</button>
				</div>
				<CharacterGrid
					characters={characters}
					selectedCharacterId={selectedCharacter?.id}
					onSelectCharacter={selectCharacter}
					onNewCharacter={handleOpenNewCharacterModal}
				/>
				<StorageIndicator />
			</SidePanel>

			{/* Center Chat Pane */}
			<main
				className={`chat-pane ${isMobile && (!isLeftCollapsed || !isRightCollapsed) ? "hidden" : ""}`}
			>
				<ChatHeader
					selectedCharacter={selectedCharacter}
					onNewChat={handleNewChat}
					onEditChat={handleEditChat}
					onDeleteChat={handleDeleteChat}
					onSelectChat={handleSelectChat}
					activeChatId={activeChatId}
					setShowHelpModal={setShowHelpModal}
				/>

				{selectedCharacter && selectedCharacter.chats.length === 0 ? (
					<div className="no-chats-placeholder">
						<div className="no-chats-message">
							<p>No chats yet</p>
							<button
								className="create-chat-button"
								onClick={() => {
									const newChatButton = document.querySelector(
										".chat-dropdown-button.new-button",
									);
									if (newChatButton) {
										newChatButton.dispatchEvent(
											new MouseEvent("click", { bubbles: true }),
										);
									}
								}}
							>
								Create a new chat <span className="plus-icon">+</span>
							</button>
						</div>
					</div>
				) : (
					<ChatMessages
						messages={activeMessages}
						character={selectedCharacter}
						background={backgroundUrl || undefined}
						onRegenerateMessage={handleRegenerateMessage}
						onContinueMessage={handleContinueMessage}
						onDeleteErrorMessage={handleDeleteErrorMessage}
						onEditMessage={handleEditMessage}
						onDeleteMessage={handleDeleteMessage}
					/>
				)}

				{/* Show chat input only when there's an active chat */}
				{activeChatId !== null && (
					<ChatInput onSendMessage={handleSendMessage} />
				)}
			</main>

			{/* Right Panel */}
			<SidePanel side="right" isMobile={isMobile}>
				{selectedCharacter ? (
					<CharacterForm
						character={selectedCharacter}
						onUpdateCharacter={handleUpdateForm}
						onDeleteCharacter={deleteCharacter}
					/>
				) : (
					<div className="no-character">Please select a character</div>
				)}
			</SidePanel>
			{showHelpModal && (
				<HelpModal
					onClose={() => setShowHelpModal(false)}
					onHideAtStartupChange={(hide) => {
						// You could save this preference to localStorage
						localStorage.setItem("hideHelpAtStartup", JSON.stringify(hide));
					}}
					initialHideAtStartup={
						localStorage.getItem("hideHelpAtStartup") === "true"
					}
				/>
			)}
			{isSetupModalOpen && (
				<FileSystemSetupModal
					onClose={closeSetupModal}
					onDirectorySelected={() => {
						storageManager.migrateFromOldLocalStorage().then(() => {
							window.location.reload();
						});
						closeSetupModal();
					}}
					onSkip={() => {
						sessionStorage.setItem("hasSkippedFSAccess", "true");
						closeSetupModal();
					}}
				/>
			)}
			{showNewCharacterModal && (
				<NewCharacterModal
					isOpen={showNewCharacterModal}
					onClose={handleCloseNewCharacterModal}
					onCreateEmpty={handleCreateEmptyCharacter}
					onCreateFromImage={handleCreateFromImage}
					onCreateGroupChat={handleCreateGroupChat}
				/>
			)}
			{showImageToTextModal && (
				<ImageToTextModal
					isOpen={showImageToTextModal}
					onClose={handleCloseImageToTextModal}
					onAccept={handleAcceptGeneratedCharacter}
				/>
			)}
		</div>
	);
};

export default App;
