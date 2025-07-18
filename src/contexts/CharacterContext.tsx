import {
	createContext,
	useState,
	useEffect,
	useContext,
	useCallback,
	useRef,
} from "react";
import type React from "react";
import type { ReactNode } from "react";
import type { Character, DialoguePair, Chat } from "../types/interfaces";
import placeholderImg from "../assets/placeholder.jpg";
import { storageManager } from "../utils/storageManager";
// import { savePngAsBrowserDownload } from '../utils/pngMetadata';
import { saveCharacterAsJson } from "../utils/jsonExport";

interface CharacterContextType {
	characters: Character[];
	selectedCharacter: Character | null;
	isLoading: boolean;
	error: string | null;
	createNewCharacter: () => Promise<Character>;
	selectCharacter: (id: number) => void;
	updateCharacter: (
		id: number,
		field: string,
		value: string | DialoguePair[] | Chat[] | unknown,
		keepActiveChat?: boolean,
	) => Promise<void>;
	deleteCharacter: (id: number) => Promise<boolean>;
	saveCharacter: (character: Character) => Promise<void>;
	addGeneratedCharacter: (character: Character) => Promise<void>;
	importCharacter: () => Promise<Character | null>;
	exportCharacterAsPng: (character: Character) => Promise<void>;
	exportCharacterAsJson: (character: Character) => Promise<void>;
}

const CharacterContext = createContext<CharacterContextType | null>(null);

export const useCharacters = () => {
	const context = useContext(CharacterContext);
	if (!context) {
		throw new Error("useCharacters must be used within a CharacterProvider");
	}
	return context;
};

interface CharacterProviderProps {
	children: ReactNode;
}

export const CharacterProvider: React.FC<CharacterProviderProps> = ({
	children,
}) => {
	const [characters, setCharacters] = useState<Character[]>([]);
	const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	// Enhanced save management: per-character queues and locks
	const saveQueues = useRef<Map<number, Promise<void>>>(new Map());
	const saveLocks = useRef<Set<number>>(new Set());

	// Load characters on mount
	useEffect(() => {
		async function loadCharacters() {
			setIsLoading(true);
			try {
				// 1. Initialize storage manager
				await storageManager.initialize();

				// 2. Handle migration from old localStorage format
				await storageManager.migrateFromOldLocalStorage();

				// 3. Migrate sprites from ID-based to name-based directories
				await storageManager.migrateAllSprites();

				// 4. Load characters from storage
				let loadedCharacters: Character[] = [];
				loadedCharacters = await storageManager.loadAllCharacters();

				// 5. If no characters were loaded, create a default character
				if (loadedCharacters.length === 0) {
					const defaultCharacter: Character = {
						id: Date.now(),
						name: "Default Character",
						image: placeholderImg,
						description: "Your first character",
						chats: [], // No default chat is created for the default character either
					};
					loadedCharacters = [defaultCharacter];

					// Save default character
					await saveCharacterSafely(defaultCharacter);
				}

				setCharacters(loadedCharacters);
				setSelectedCharacter(loadedCharacters[0]);
				console.log("✅ Characters loaded from storage");
			} catch (err) {
				setError("Failed to load characters");
				console.error("Error loading characters:", err);
			}
			setIsLoading(false);
		}

		loadCharacters();
	}, []);

	/**
	 * Thread-safe character saving with per-character queuing
	 * Prevents race conditions by serializing saves for each character
	 */
	const saveCharacterSafely = useCallback(
		async (character: Character): Promise<void> => {
			const characterId = character.id;
			
			// Create a new save operation for this character
			const saveOperation = async (): Promise<void> => {
				// Wait for any existing save operation for this character
				const existingQueue = saveQueues.current.get(characterId);
				if (existingQueue) {
					try {
						await existingQueue;
					} catch (err) {
						// Log but don't propagate errors from previous saves
						console.warn(`Previous save for character ${characterId} failed:`, err);
					}
				}

				// Check if character is currently locked
				if (saveLocks.current.has(characterId)) {
					console.log(`Character ${characterId} is locked, queuing save...`);
				}

				// Set lock for this character
				saveLocks.current.add(characterId);
				
				try {
					console.log(`🔄 Saving character ${characterId} (${character.name}) - Queue size: ${saveQueues.current.size}`);
					await storageManager.saveCharacter(character);
					console.log(`✅ Successfully saved character ${characterId} - Queue size: ${saveQueues.current.size}`);
				} catch (err) {
					console.error(`❌ Failed to save character ${characterId}:`, err);
					throw new Error(`Failed to save character ${character.name}: ${err}`);
				} finally {
					// Always release lock
					saveLocks.current.delete(characterId);
					console.log(`🔓 Released lock for character ${characterId}`);
				}
			};

			// Add this operation to the character's queue
			const queuedOperation = saveQueues.current.get(characterId)?.then(saveOperation).catch(saveOperation) || saveOperation();
			saveQueues.current.set(characterId, queuedOperation);

			// Return the queued operation so callers can await it
			return queuedOperation;
		},
		[],
	);

	// Create a new character
	const createNewCharacter = useCallback(async () => {
		const newCharacter: Character = {
			id: Date.now(),
			name: `New Character ${characters.length + 1}`,
			image: placeholderImg,
			description: "",
			chats: [], // No default chat is created
		};

		try {
			// Update state first for immediate UI feedback
			const newCharacters = [...characters, newCharacter];
			setCharacters(newCharacters);
			setSelectedCharacter(newCharacter);

			// Then save to storage (this might take a moment)
			await saveCharacterSafely(newCharacter);

			return newCharacter;
		} catch (err) {
			console.error("Failed to create new character:", err);
			// Don't throw, we already updated UI
			return newCharacter; // Still return the character even if saving fails
		}
	}, [characters, saveCharacterSafely]);

	// Select a character by ID
	const selectCharacter = useCallback(
		(id: number) => {
			const character = characters.find((c) => c.id === id);
			if (character) {
				setSelectedCharacter(character);
			}
		},
		[characters],
	);

	// Update a character's field
	const updateCharacter = useCallback(
		async (
			id: number,
			field: string,
			value: string | DialoguePair[] | Chat[] | unknown,
			keepActiveChat = false, // Add parameter to control chat switching
		) => {
			try {
				const characterIndex = characters.findIndex((c) => c.id === id);
				if (characterIndex === -1) return;

				const oldCharacter = characters[characterIndex];

				// Process value based on field type
				let processedValue = value;

				// Parse JSON string back to object if we're updating chats
				if (field === "chats" && typeof value === "string") {
					try {
						processedValue = JSON.parse(value);
					} catch (e) {
						console.error("Failed to parse chats JSON:", e);
					}
				}

				// Create updated character
				const updatedCharacter = {
					...oldCharacter,
					[field]: processedValue,
				};

				// The storageManager is now responsible for handling filename updates.
				// When a character's name changes, the manager will detect it,
				// delete the old file, save the new one, and update the
				// originalFilename property on the character object automatically.

				// Update state immediately for better UI responsiveness
				const newCharacters = [...characters];
				newCharacters[characterIndex] = updatedCharacter;
				setCharacters(newCharacters);

				// Only update selected character if we should (when keepActiveChat is true)
				if (keepActiveChat) {
					// If this is the selected character, update but keep current active chat
					if (selectedCharacter?.id === id) {
						setSelectedCharacter(updatedCharacter);
					}
				} else {
					// Standard behavior - fully update selected character
					if (selectedCharacter?.id === id) {
						setSelectedCharacter(updatedCharacter);
					}
				}

				// TEMPORARY: Use old save method to test if save queue is the issue
				try {
					console.log(`🔧 Using direct save (bypassing queue) for character ${updatedCharacter.id}`);
					await storageManager.saveCharacter(updatedCharacter);
					console.log(`🔧 Direct save completed for character ${updatedCharacter.id}`);
				} catch (err) {
					console.error("Error saving character:", err);
					// Log error but don't block UI updates
					setError(`Save failed for ${updatedCharacter.name}: ${err}`);
				}
			} catch (err) {
				console.error("Error updating character:", err);
			}
		},
		[characters, selectedCharacter, saveCharacterSafely, setError],
	);

	// Delete a character
	const deleteCharacter = useCallback(
		async (id: number) => {
			const character = characters.find((c) => c.id === id);
			if (!character) return false;

			try {
				const success = await storageManager.deleteCharacter(id);

				if (success) {
					const newCharacters = characters.filter((c) => c.id !== id);
					setCharacters(newCharacters);

					// Select another character or null
					if (selectedCharacter?.id === id) {
						setSelectedCharacter(
							newCharacters.length > 0 ? newCharacters[0] : null,
						);
					}
				}

				return success;
			} catch (err) {
				setError(`Failed to delete character: ${err}`);
				return false;
			}
		},
		[characters, selectedCharacter],
	);

	// Save character changes
	const saveCharacter = useCallback(
		async (character: Character) => {
			try {
				setError(null);
				await saveCharacterSafely(character);

				// Update the character in our array after successful save
				const index = characters.findIndex((c) => c.id === character.id);
				if (index !== -1) {
					const newCharacters = [...characters];
					newCharacters[index] = character;
					setCharacters(newCharacters);

					// Update selected character if needed
					if (selectedCharacter?.id === character.id) {
						setSelectedCharacter(character);
					}
				}
			} catch (err) {
				console.error("Error saving character:", err);
				setError(`Failed to save character: ${err}`);
			}
		},
		[characters, selectedCharacter, saveCharacterSafely, setError],
	);

	// Explicit function for "Save as PNG" button
	const exportCharacterAsPng = useCallback(
		async (_character: Character): Promise<void> => {
			try {
				setError(null);
				// No longer directly calling savePngAsBrowserDownload - we let the form handle it
				// Instead we'll throw an error if this is directly called
				throw new Error(
					"Please use the Save as PNG button in the character form",
				);
			} catch (err) {
				console.error("Error exporting character as PNG:", err);
				setError(`Failed to export character: ${err}`);
			}
		},
		[],
	);

	// Add functionality to export character as JSON
	const exportCharacterAsJson = useCallback(
		async (character: Character): Promise<void> => {
			try {
				setError(null);
				await saveCharacterAsJson(character);
			} catch (err) {
				console.error("Error exporting character as JSON:", err);
				setError(`Failed to export character as JSON: ${err}`);
			}
		},
		[],
	);

	// Import a character from a PNG file
	const importCharacter = useCallback(async () => {
		try {
			// Show file picker
			const input = document.createElement("input");
			input.type = "file";
			input.accept = "image/png";

			return new Promise<Character | null>((resolve) => {
				input.onchange = async (e) => {
					const file = (e.target as HTMLInputElement).files?.[0];
					if (!file) {
						resolve(null);
						return;
					}

					try {
						// Extract character data
						const { extractCharacterFromPng } = await import(
							"../utils/pngMetadata"
						);
						const character = await extractCharacterFromPng(file);

						// Add to characters list
						const exists = characters.some((c) => c.id === character.id);

						if (exists) {
							// Update existing character
							const newCharacters = characters.map((c) =>
								c.id === character.id ? character : c,
							);
							setCharacters(newCharacters);
						} else {
							// Add new character
							setCharacters([...characters, character]);
						}

						// Select the character
						setSelectedCharacter(character);

						// Explicitly save the imported character to storage
						await saveCharacterSafely(character);

						resolve(character);
					} catch (err) {
						console.error("Error importing character:", err);
						setError(`Failed to import character: ${err}`);
						resolve(null);
					}
				};

				input.click();
			});
		} catch (err) {
			setError(`Failed to import character: ${err}`);
			return null;
		}
	}, [characters, saveCharacterSafely]);

	// Add a generated character (follows importCharacter pattern but for generated characters)
	const addGeneratedCharacter = useCallback(async (character: Character) => {
		try {
			// Add to characters list (same as importCharacter)
			const exists = characters.some((c) => c.id === character.id);

			if (exists) {
				// Update existing character
				const newCharacters = characters.map((c) =>
					c.id === character.id ? character : c,
				);
				setCharacters(newCharacters);
			} else {
				// Add new character
				setCharacters([...characters, character]);
			}

			// Select the character
			setSelectedCharacter(character);

			// Save the generated character to storage
			await saveCharacterSafely(character);

		} catch (err) {
			console.error("Error adding generated character:", err);
			setError(`Failed to add generated character: ${err}`);
		}
	}, [characters, saveCharacterSafely]);

	const value = {
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
		exportCharacterAsPng,
		exportCharacterAsJson,
	};

	return (
		<CharacterContext.Provider value={value}>
			{children}
		</CharacterContext.Provider>
	);
};
