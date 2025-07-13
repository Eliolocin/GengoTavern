import { useState, useEffect, useRef } from "react";
import "../styles/App.css";

import type { Message, Chat, Character, GroupMember, GroupGreeting } from "../types/interfaces";
// Import our new utilities
import { buildPrompt } from "../utils/promptBuilder";
import { callGeminiAPI, sanitizeResponse } from "../utils/geminiAPI";
import { emotionClassifier } from "../utils/emotionClassifier";
import { callTutorLLM, extractChatHistoryForTutor, shouldProcessWithTutor } from "../utils/grammarTutor";
import { createGroupChat, isGroupChat, calculateResponseQueue, getLastSpeaker } from "../utils/groupChatUtils";
import { generateGroupChatImage, generateFallbackGroupImage } from "../utils/compositeImageGenerator";
import SidePanel from "../components/layout/SidePanel";
import CharacterGrid from "../components/characterSelection/CharacterGrid";
import ChatHeader from "../components/chatInterface/ChatHeader";
import ChatMessages from "../components/chatInterface/ChatMessages";
import ChatInput from "../components/chatInterface/ChatInput";
import CharacterForm from "../components/characterCustomization/CharacterForm";
import GroupChatConfig from "../components/characterCustomization/GroupChatConfig";
import { CharacterProvider, useCharacters } from "../contexts/CharacterContext";
import {
	UserSettingsProvider,
	useUserSettings,
} from "../contexts/UserSettingsContext";
import { AppProvider, useAppContext } from "../contexts/AppContext";
import { GrammarCorrectionProvider, useGrammarCorrection } from "../contexts/GrammarCorrectionContext";
import HelpModal from "../components/shared/HelpModal";
import FileSystemSetupModal from "../components/shared/FileSystemSetupModal";
import NewCharacterModal from "../components/shared/NewCharacterModal";
import ImageToTextModal from "../components/shared/ImageToTextModal";
import type { GeneratedCharacterData } from "../components/shared/ImageToTextModal";
import GroupChatCreationModal from "../components/shared/GroupChatCreationModal";
import StorageIndicator from "../components/shared/StorageIndicator";
import { storageManager } from "../utils/storageManager";

// Main App Component wrapper with Providers
const App: React.FC = () => {
	return (
		<AppProvider>
			<UserSettingsProvider>
				<CharacterProvider>
					<GrammarCorrectionWrapper>
						<AppContent />
					</GrammarCorrectionWrapper>
				</CharacterProvider>
			</UserSettingsProvider>
		</AppProvider>
	);
};

// Wrapper to connect UserSettings with GrammarCorrection
const GrammarCorrectionWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const { grammarCorrectionMode, setGrammarCorrectionMode } = useUserSettings();
	
	return (
		<GrammarCorrectionProvider mode={grammarCorrectionMode} setMode={setGrammarCorrectionMode}>
			{children}
		</GrammarCorrectionProvider>
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
		addGeneratedCharacter,
		importCharacter,
	} = useCharacters();
	const {
		isSetupModalOpen,
		openSetupModal,
		closeSetupModal,
		setStorageStrategy,
	} = useAppContext();
	const {
		huggingFaceApiKey,
		visualNovelMode,
		grammarCorrectionMode,
	} = useUserSettings();
	const {
		settings: grammarSettings,
		setIsProcessingTutor,
		getMessageTutorData,
		setMessageTutorData,
		dismissTutorPopup,
	} = useGrammarCorrection();

	const [isLeftCollapsed] = useState(false);
	const [isRightCollapsed] = useState(false);
	const [activeMessages, setActiveMessages] = useState<Message[]>([]);
	const [activeChatId, setActiveChatId] = useState<number | null>(null);
	const [localError, setLocalError] = useState<string | null>(null);
	const [activeChat, setActiveChat] = useState<Chat | null>(null);
	const [showHelpModal, setShowHelpModal] = useState<boolean>(true); // Default to true to show at startup
	const [showNewCharacterModal, setShowNewCharacterModal] = useState<boolean>(false);
	const [showImageToTextModal, setShowImageToTextModal] = useState<boolean>(false);
	const [showGroupChatCreationModal, setShowGroupChatCreationModal] = useState<boolean>(false);
	const [isMobile, setIsMobile] = useState<boolean>(false);
	const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
	
	// Group chat response queue state
	const [responseQueue, setResponseQueue] = useState<number[]>([]);
	const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false);
	const [currentlyTypingCharacter, setCurrentlyTypingCharacter] = useState<number | null>(null);
	const [shouldStopQueue, setShouldStopQueue] = useState<boolean>(false);
	
	// Use a ref to track stop state for immediate access in async operations
	const stopQueueRef = useRef<boolean>(false);

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
				loadTutorDataFromMessages(activeChat.messages);
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

	const handleNewGroupChat = async (
		chatName: string,
		scenario: string,
		greetings: GroupGreeting[],
		background: string,
	) => {
		if (!selectedCharacter || !isGroupChat(selectedCharacter)) return;

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

			// Add greeting messages from each character in display order
			let messageIdCounter = Date.now() + 1;
			for (const greeting of greetings) {
				// Find the character for this greeting
				const character = characters.find(c => c.id === greeting.characterId);
				if (!character) continue;

				// Classify emotion for greeting if HF API key is available
				const greetingEmotion = huggingFaceApiKey
					? await emotionClassifier.classify(greeting.greeting, huggingFaceApiKey)
					: null;

				console.log(
					`Group chat greeting emotion (${character.name}): ${greetingEmotion || "not classified (HF API key not set)"}`,
				);

				messages.push({
					id: messageIdCounter++,
					text: greeting.greeting,
					sender: "character",
					timestamp: Date.now() + messageIdCounter,
					emotion: greetingEmotion || undefined,
					speakerId: greeting.characterId,
					speakerName: character.name,
				});
			}

			// Mark all existing chats as not active
			const updatedChats = selectedCharacter.chats.map((chat) => ({
				...chat,
				isActive: false,
			}));

			// Create new chat with isActive flag and group greetings
			const newChat: Chat = {
				id: newChatId,
				name: chatName,
				scenario: scenario,
				background: background,
				messages: messages,
				lastActivity: Date.now(),
				isActive: true, // Mark as active
				groupGreetings: greetings, // Store the split greetings for future reference
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
			setLocalError(`Failed to create new group chat: ${err}`);
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
					loadTutorDataFromMessages(chat.messages);
				}
			}
		} catch (err) {
			setLocalError(`Failed to update chat: ${err}`);
		}
	};

	/**
	 * Force a specific character to respond in a group chat
	 */
	const handleForceResponse = async (characterId: number) => {
		if (!selectedCharacter || !isGroupChat(selectedCharacter) || activeChatId === null) return;
		
		// Don't allow force response if already processing
		if (isProcessingQueue) return;
		
		// Find the character
		const character = characters.find(c => c.id === characterId);
		if (!character) return;
		
		// Create a simple queue with just this character
		const forceQueue = [characterId];
		
		// Process the forced response
		await processResponseQueue(forceQueue, "Force Response", activeMessages);
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
					loadTutorDataFromMessages(newActiveChat.messages);
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
			loadTutorDataFromMessages(newActiveChat.messages);
		} catch (err) {
			setLocalError(`Failed to switch chat: ${err}`);
		}
	};

	/**
	 * Process a queue of character responses for group chats
	 * Each character responds sequentially with typing indicators
	 */
	const processResponseQueue = async (queue: number[], _userMessage: string, currentMessages?: Message[]) => {
		if (!selectedCharacter || !isGroupChat(selectedCharacter) || activeChatId === null) return;
		
		console.log(`Starting processResponseQueue with queue: [${queue.join(', ')}]`);
		console.log(`shouldStopQueue at start: ${shouldStopQueue}`);
		console.log(`stopQueueRef.current at start: ${stopQueueRef.current}`);
		
		setIsProcessingQueue(true);
		// Don't reset shouldStopQueue here - preserve user's stop request
		
		// Create a copy of the queue to avoid modifying the original
		const processQueue = [...queue];
		setResponseQueue(processQueue);

		// Keep track of the most current messages as we process the queue
		let workingMessages = currentMessages || activeMessages;

		try {
			for (let i = 0; i < processQueue.length; i++) {
				// Check if user requested to stop the queue BEFORE starting next character
				if (stopQueueRef.current) {
					console.log(`Queue stopped by user at position ${i}/${processQueue.length} (ref check)`);
					break;
				}

				const speakerId = processQueue[i];
				const speakerCharacter = characters.find(c => c.id === speakerId);
				if (!speakerCharacter) continue;

				console.log(`Processing character ${speakerCharacter.name} (${speakerId}) - ${i + 1}/${processQueue.length}`);

				// Set typing indicator
				setCurrentlyTypingCharacter(speakerId);

				// Generate response for this character with current message state
				// Let this complete fully without interruption
				const newMessage = await generateCharacterResponse(speakerId, speakerCharacter.name, _userMessage, workingMessages);
				
				// Check again after response generation in case user clicked stop during generation
				if (stopQueueRef.current) {
					console.log(`Queue stopped by user after ${speakerCharacter.name}'s response generation`);
					// Still add the completed message to working messages
					if (newMessage) {
						workingMessages = [...workingMessages, newMessage];
					}
					break;
				}
				
				// Update working messages to include the new response for the next character
				if (newMessage) {
					workingMessages = [...workingMessages, newMessage];
					
					// Check if this character's response triggers additional characters
					// But only if queue hasn't been stopped
					if (selectedCharacter && isGroupChat(selectedCharacter) && !stopQueueRef.current) {
						console.log(`Checking if ${speakerCharacter.name}'s response triggers additional characters`);
						console.log(`Message from ${speakerCharacter.name}: "${newMessage.text}"`);
						console.log(`Last speaker ID being passed: ${newMessage.speakerId}`);
						
						const lastSpeaker = { speakerId: newMessage.speakerId, isUser: false };
						const additionalQueue = calculateResponseQueue(
							selectedCharacter,
							newMessage.text,
							false, // isUserMessage = false (this is a character message)
							lastSpeaker.speakerId,
							characters
						);

						// Add any newly triggered characters to our processing queue
						if (additionalQueue.length > 0) {
							console.log(`${speakerCharacter.name} triggered additional characters: [${additionalQueue.join(', ')}]`);
							// Add to the end of our processing queue (will be processed in this same loop)
							processQueue.push(...additionalQueue);
							// Update the displayed queue state
							setResponseQueue([...processQueue]);
						} else {
							console.log(`${speakerCharacter.name}'s response did not trigger any additional characters`);
						}
					} else if (stopQueueRef.current) {
						console.log(`Skipping additional character triggers - queue stop requested`);
					}
				}

				// Ensure state has time to propagate before next character responds
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		} finally {
			console.log('Queue processing finished - cleaning up state');
			// Clean up queue state
			setIsProcessingQueue(false);
			setCurrentlyTypingCharacter(null);
			setResponseQueue([]);
			setShouldStopQueue(false);
			stopQueueRef.current = false;
		}
	};

	/**
	 * Generate a response for a specific character in a group chat
	 */
	const generateCharacterResponse = async (speakerId: number, speakerName: string, _userMessage: string, currentMessages?: Message[]): Promise<Message | null> => {
		if (!selectedCharacter || activeChatId === null) return null;

		try {
			// Use the provided current messages or fall back to activeMessages
			const messagesToUse = currentMessages || activeMessages;
			
			// Get the most current chat state with up-to-date messages
			// This ensures characters see responses from previous characters in the queue
			const currentActiveChat = {
				id: activeChatId,
				messages: messagesToUse, // Use the most current messages passed from the queue
				isActive: true,
				lastActivity: Date.now()
			};

			// Build the prompt with the current chat state, specifying the next speaker
			const { prompt, settings } = buildPrompt(
				selectedCharacter,
				currentActiveChat,
				"User",
				isGroupChat(selectedCharacter) ? characters : undefined,
				speakerId // Pass the speaker ID to the prompt builder
			);

			// Call the API
			const response = await callGeminiAPI(prompt, settings);

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
					`Character message emotion (${speakerName}): ${detectedEmotion || "not classified (HF API key not set)"}`,
				);
			} else {
				console.log(
					"Emotion classification skipped (not in Visual Novel mode)",
				);
			}

			// Create the character response message
			const responseMessage: Message = {
				id: Date.now() + Math.random(), // Ensure unique ID
				text: sanitizedResponse,
				sender: "character",
				timestamp: Date.now(),
				speakerId: speakerId,
				speakerName: speakerName,
				emotion: detectedEmotion || undefined,
			};

			// Update messages and save to character state
			// Use a callback to ensure we get the latest state and save immediately
			let updatedMessages: Message[] = [];
			setActiveMessages(currentMessages => {
				updatedMessages = [...currentMessages, responseMessage];
				return updatedMessages;
			});

			// Wait for the message to be fully saved before returning
			// Use the updatedMessages from the state callback, not stale activeMessages
			await updateChatMessagesAsync(updatedMessages, false);
			
			// Return the new message so the queue can use it for subsequent characters
			return responseMessage;

		} catch (err) {
			console.error(`Character response generation error (${speakerName}):`, err);

			// Add error message
			const errorMsg =
				err instanceof Error ? err.message : "Unknown error occurred";
			const errorMessage: Message = {
				id: Date.now() + Math.random(),
				text: `Failed to generate response from ${speakerName}: ${errorMsg}.`,
				sender: "system",
				timestamp: Date.now(),
				isError: true,
			};

			let messagesWithError: Message[] = [];
			setActiveMessages(currentMessages => {
				messagesWithError = [...currentMessages, errorMessage];
				return messagesWithError;
			});

			// Wait for the error message to be fully saved before returning
			await updateChatMessagesAsync(messagesWithError, false);
			
			// Return null on error so queue processing continues
			return null;
		}
	};

	/**
	 * Process grammar correction feedback asynchronously (non-blocking)
	 */
	const processTutorFeedback = async (userMessage: string, messageId: number, messagesContext: Message[]) => {
		try {
			setIsProcessingTutor(true);
			
			// Extract chat history for context
			const chatHistory = extractChatHistoryForTutor(
				{ messages: messagesContext } as Chat,
				grammarSettings.maxChatHistoryForTutor
			);
			
			// Call tutor LLM
			const tutorResponse = await callTutorLLM(
				userMessage,
				grammarCorrectionMode,
				selectedCharacter?.type === 'individual' ? selectedCharacter : undefined,
				chatHistory
			);
			
			// Handle tutor response
			if (tutorResponse.response && tutorResponse.response.has_mistake) {
				const confidence = tutorResponse.response.confidence_score || 0;
				
				// Create complete tutor data for storage (including full response for analysis)
				const tutorData = {
					mode: grammarCorrectionMode,
					response: tutorResponse.response, // Full response with all fields
					dismissed: false,
					timestamp: Date.now(),
				};
				
				console.log(`📋 Complete tutor data being saved:`, {
					messageId,
					mode: tutorData.mode,
					has_mistake: tutorData.response.has_mistake,
					confidence: tutorData.response.confidence_score,
					grammar_mistakes: tutorData.response.grammar_mistakes,
					roleplay_mistakes: tutorData.response.roleplay_mistakes,
					system_message: tutorData.response.system_message
				});
				
				// Store tutor data in context for immediate UI updates
				setMessageTutorData(messageId, tutorData);
				
				// Update the actual message object with tutor data using functional update
				setActiveMessages(currentMessages => {
					const updatedMessages = currentMessages.map(msg => 
						msg.id === messageId 
							? { ...msg, tutorData }
							: msg
					);
					
					// Log the message we're trying to update
					const targetMessage = updatedMessages.find(msg => msg.id === messageId);
					if (targetMessage) {
						console.log(`🎯 Updated message ${messageId} with tutor data:`, {
							id: targetMessage.id,
							text: targetMessage.text.substring(0, 30) + '...',
							has_tutorData: !!targetMessage.tutorData,
							tutorData_preview: targetMessage.tutorData ? {
								mode: targetMessage.tutorData.mode,
								has_mistake: targetMessage.tutorData.response.has_mistake,
								dismissed: targetMessage.tutorData.dismissed
							} : null
						});
					} else {
						console.warn(`⚠️ Could not find message ${messageId} to update with tutor data`);
					}
					
					// Save to storage asynchronously (don't block UI)
					updateChatMessages(updatedMessages, false);
					
					return updatedMessages;
				});
				
				// Only show popup if confidence meets threshold
				if (confidence >= grammarSettings.showConfidenceThreshold) {
					console.log(`✏️ Grammar correction feedback for message ${messageId}:`, tutorResponse.response.system_message);
				} else {
					console.log(`✏️ Grammar correction confidence too low (${confidence}) - not showing popup`);
				}
			} else if (tutorResponse.error) {
				console.warn(`❌ Tutor error: ${tutorResponse.error}`);
			} else {
				console.log("✅ No grammar/roleplay issues detected");
			}
		} catch (error) {
			console.error("❌ Error processing tutor feedback:", error);
		} finally {
			setIsProcessingTutor(false);
		}
	};

	/**
	 * Handle dismissing tutor popup and persist to storage
	 */
	const handleDismissTutorPopup = (messageId: number) => {
		// Update context first
		dismissTutorPopup(messageId);
		
		// Update message object using functional update and save to storage
		setActiveMessages(currentMessages => {
			const updatedMessages = currentMessages.map(msg => {
				if (msg.id === messageId && msg.tutorData) {
					const updatedMessage = {
						...msg,
						tutorData: {
							...msg.tutorData,
							dismissed: true,
						}
					};
					console.log(`🗑️ Marked tutor popup as dismissed for message ${messageId}`);
					return updatedMessage;
				}
				return msg;
			});
			
			// Save to storage if any changes were made
			const messageFound = updatedMessages.some(msg => msg.id === messageId && msg.tutorData);
			if (messageFound) {
				updateChatMessages(updatedMessages, false);
				console.log(`💾 Persisted dismissal of tutor popup for message ${messageId}`);
			} else {
				console.warn(`⚠️ Could not find message ${messageId} with tutor data to dismiss`);
			}
			
			return updatedMessages;
		});
	};

	/**
	 * Load existing tutor data from messages into context
	 */
	const loadTutorDataFromMessages = (messages: Message[]) => {
		const messagesWithTutorData = messages.filter(msg => msg.tutorData && msg.sender === 'user');
		
		if (messagesWithTutorData.length > 0) {
			console.log(`📥 Loading ${messagesWithTutorData.length} messages with tutor data from storage:`,
				messagesWithTutorData.map(msg => ({
					id: msg.id,
					text: msg.text.substring(0, 30) + '...',
					tutor_mode: msg.tutorData?.mode,
					tutor_dismissed: msg.tutorData?.dismissed,
					tutor_has_mistake: msg.tutorData?.response.has_mistake,
					tutor_confidence: msg.tutorData?.response.confidence_score
				}))
			);
		} else {
			console.log(`📭 No messages with tutor data found in ${messages.length} total messages`);
		}
		
		for (const message of messages) {
			if (message.tutorData && message.sender === 'user') {
				setMessageTutorData(message.id, message.tutorData);
				console.log(`🔄 Restored tutor data for message ${message.id} from storage`);
			}
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

		// Start tutor processing if grammar correction is enabled (async, non-blocking)
		if (shouldProcessWithTutor(text, grammarCorrectionMode)) {
			console.log(`🔍 Starting tutor analysis for message: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (mode: ${grammarCorrectionMode})`);
			processTutorFeedback(text, newMessage.id, updatedMessages);
		} else {
			console.log(`⏭️ Skipping tutor analysis (mode: ${grammarCorrectionMode}, message too short: ${text.length} chars)`);
		}

		try {

			// Handle group chat vs individual character differently
			if (isGroupChat(selectedCharacter)) {
				// For group chats, calculate response queue
				const lastSpeaker = getLastSpeaker(updatedMessages);
				console.log(`User message: "${text}"`);
				console.log(`Last speaker from getLastSpeaker:`, lastSpeaker);
				
				const queue = calculateResponseQueue(
					selectedCharacter,
					text,
					true, // isUserMessage
					lastSpeaker.speakerId,
					characters
				);

				console.log(`Initial queue from user message: [${queue.join(', ')}]`);
				
				// Process the queue with the updated messages that include the user message
				await processResponseQueue(queue, text, updatedMessages);
			} else {
				// For individual characters, use the original logic
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

				// Build the prompt with the current chat state that includes the new message
				const currentActiveChat = {
					id: activeChatId,
					messages: messagesWithGenerating,
					isActive: true,
					lastActivity: Date.now()
				};
				
				const { prompt, settings } = buildPrompt(
					selectedCharacter,
					currentActiveChat,
					"User",
					isGroupChat(selectedCharacter) ? characters : undefined,
				);

				// Call the API
				const response = await callGeminiAPI(prompt, settings);

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

			// For group chats, use the same speaker ID as the original message
			const speakerId = messageToRegenerate.speakerId;

			// Build the prompt
			const { prompt, settings } = buildPrompt(
				selectedCharacter,
				tempChat,
				"User",
				isGroupChat(selectedCharacter) ? characters : undefined,
				speakerId // Use the original speaker ID for regeneration
			);

			// Call the API
			const response = await callGeminiAPI(prompt, settings);

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
						emotion: detectedEmotion || msg.emotion,
						// Preserve the regenHistory from the updated message
						regenHistory: currentUpdatedMsg?.regenHistory || [],
					};
				}
				return msg;
			});

			// Update the UI immediately
			setActiveMessages(initialRegeneratedMessages);
			await updateChatMessagesAsync(initialRegeneratedMessages, false);

			// For group chats, check if this message should trigger additional responses
			if (isGroupChat(selectedCharacter) && messageToRegenerate.sender === 'character') {
				const lastSpeaker = { speakerId: messageToRegenerate.speakerId, isUser: false };
				const queue = calculateResponseQueue(
					selectedCharacter,
					sanitizedResponse,
					false, // isUserMessage = false (this is a character message)
					lastSpeaker.speakerId,
					characters
				);

				if (queue.length > 0) {
					await processResponseQueue(queue, sanitizedResponse, activeMessages);
				}
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
				isGroupChat(selectedCharacter) ? characters : undefined,
			);

			// Call the API
			const response = await callGeminiAPI(prompt, settings);

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
			// Log tutor data being saved
			const messagesWithTutorData = messages.filter(msg => msg.tutorData);
			if (messagesWithTutorData.length > 0) {
				console.log(`💾 Saving ${messagesWithTutorData.length} messages with tutor data:`, 
					messagesWithTutorData.map(msg => ({
						id: msg.id,
						text: msg.text.substring(0, 30) + '...',
						has_tutorData: !!msg.tutorData,
						tutor_mode: msg.tutorData?.mode,
						tutor_dismissed: msg.tutorData?.dismissed
					}))
				);
			}

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
			
			// Confirm save completion
			if (messagesWithTutorData.length > 0) {
				console.log(`✅ Chat update completed for ${messagesWithTutorData.length} messages with tutor data`);
			}
		} catch (err) {
			setLocalError(`Failed to update chat: ${err}`);
			console.error(`❌ Error saving chat with tutor data:`, err);
		}
	};

	// Add this new function for asynchronous chat message updating
	const updateChatMessagesAsync = async (
		messages: Message[],
		switchChat: boolean = false,
	): Promise<void> => {
		if (!selectedCharacter || activeChatId === null) {
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

			// Update character and properly wait for it to complete
			await updateCharacter(selectedCharacter.id, "chats", updatedChats, true);
			
		} catch (err) {
			setLocalError(`Failed to update chat: ${err}`);
		}
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
	 * 5. Handle creating group chat - opens the Group Chat creation modal
	 */
	const handleCreateGroupChat = () => {
		setShowNewCharacterModal(false);
		setShowGroupChatCreationModal(true);
	};

	/**
	 * 6. Handle closing the ImageToTextModal
	 */
	const handleCloseImageToTextModal = () => {
		setShowImageToTextModal(false);
	};

	/**
	 * 7. Handle closing the GroupChatCreationModal
	 */
	const handleCloseGroupChatCreationModal = () => {
		setShowGroupChatCreationModal(false);
	};

	/**
	 * 8. Handle creating the group chat from the modal
	 */
	const handleCreateGroupChatFromModal = async (groupName: string, members: GroupMember[]) => {
		try {
			// Generate composite image for the group chat
			let compositeImage: string;
			try {
				compositeImage = await generateGroupChatImage(members, characters);
			} catch (imageError) {
				console.warn('Failed to generate composite image, using fallback:', imageError);
				compositeImage = generateFallbackGroupImage();
			}
			
			// Create the group chat character with the composite image
			const groupChat = createGroupChat(groupName, members, compositeImage);
			
			// Add the group chat using the existing context method
			await addGeneratedCharacter(groupChat);
			
			// Close the modal
			setShowGroupChatCreationModal(false);
			
			console.log('✅ Group chat created successfully:', groupName);
		} catch (error) {
			console.error('Error creating group chat:', error);
			setLocalError('Failed to create group chat. Please try again.');
		}
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
					onNewGroupChat={handleNewGroupChat}
					onEditChat={handleEditChat}
					onDeleteChat={handleDeleteChat}
					onSelectChat={handleSelectChat}
					activeChatId={activeChatId}
					setShowHelpModal={setShowHelpModal}
					allCharacters={characters}
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
						allCharacters={characters}
						getMessageTutorData={getMessageTutorData}
						onDismissTutorPopup={handleDismissTutorPopup}
					/>
				)}

				{/* Show chat input only when there's an active chat */}
				{activeChatId !== null && (
					<ChatInput 
						onSendMessage={handleSendMessage} 
						isProcessingQueue={isProcessingQueue}
						currentlyTypingCharacter={currentlyTypingCharacter}
						responseQueue={responseQueue}
						selectedCharacter={selectedCharacter}
						allCharacters={characters}
						onStopQueue={() => {
							console.log('Stop queue button clicked');
							setShouldStopQueue(true);
							stopQueueRef.current = true;
						}}
						shouldStopQueue={shouldStopQueue}
					/>
				)}
			</main>

			{/* Right Panel */}
			<SidePanel side="right" isMobile={isMobile}>
				{selectedCharacter ? (
					isGroupChat(selectedCharacter) ? (
						<GroupChatConfig
							groupChat={selectedCharacter}
							allCharacters={characters}
							onUpdateCharacter={handleUpdateForm}
							onDeleteCharacter={deleteCharacter}
							onForceResponse={handleForceResponse}
							isProcessingQueue={isProcessingQueue}
						/>
					) : (
						<CharacterForm
							character={selectedCharacter}
							onUpdateCharacter={handleUpdateForm}
							onDeleteCharacter={deleteCharacter}
						/>
					)
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
			{showGroupChatCreationModal && (
				<GroupChatCreationModal
					isOpen={showGroupChatCreationModal}
					onClose={handleCloseGroupChatCreationModal}
					onCreateGroupChat={handleCreateGroupChatFromModal}
					availableCharacters={characters}
				/>
			)}
		</div>
	);
};

export default App;
