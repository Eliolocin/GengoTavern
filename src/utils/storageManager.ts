import { extractCharacterFromPng, embedCharacterIntoPng } from "./pngMetadata";
import type { Character, Sprite } from "../types/interfaces";
import { SUPPORTED_EMOTIONS, type SupportedEmotion } from "./emotionClassifier";

// Define UserPersona interface locally
interface UserPersona {
	name: string;
	description: string;
}

// Storage strategies
export type StorageStrategy = "filesystem" | "localstorage";

// Directory structure for file system storage
const DIRECTORIES = {
	characters: "characters",
	settings: "settings",
	backgrounds: "backgrounds",
} as const;

/**
 * IndexedDB helper for storing FileSystemDirectoryHandle
 */
class HandleStorage {
	private dbName = "GengoTavernStorage";
	private storeName = "handles";
	private version = 1;

	/**
	 * Open IndexedDB database
	 */
	private async openDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.version);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(this.storeName)) {
					db.createObjectStore(this.storeName);
				}
			};
		});
	}

	/**
	 * Store directory handle in IndexedDB
	 * @param handle - FileSystemDirectoryHandle to store
	 */
	async storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
		const db = await this.openDB();
		const transaction = db.transaction([this.storeName], "readwrite");
		const store = transaction.objectStore(this.storeName);

		return new Promise((resolve, reject) => {
			const request = store.put(handle, "rootDirectory");
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	/**
	 * Retrieve directory handle from IndexedDB
	 * @returns Promise<FileSystemDirectoryHandle | null>
	 */
	async getHandle(): Promise<FileSystemDirectoryHandle | null> {
		try {
			const db = await this.openDB();
			const transaction = db.transaction([this.storeName], "readonly");
			const store = transaction.objectStore(this.storeName);

			return new Promise((resolve, reject) => {
				const request = store.get("rootDirectory");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result || null);
			});
		} catch {
			return null;
		}
	}

	/**
	 * Clear stored handle
	 */
	async clearHandle(): Promise<void> {
		const db = await this.openDB();
		const transaction = db.transaction([this.storeName], "readwrite");
		const store = transaction.objectStore(this.storeName);

		return new Promise((resolve, reject) => {
			const request = store.delete("rootDirectory");
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}
}

/**
 * Reads a file as a data URL
 * @param file - The file to read
 * @returns Promise<string> - The file contents as a data URL
 */
async function readFileAsDataURL(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

/**
 * Central Storage Manager
 * Handles both File System Access API and localStorage fallback
 */
export class StorageManager {
	private strategy: StorageStrategy = "localstorage";
	private rootHandle: FileSystemDirectoryHandle | null = null;
	private handleStorage = new HandleStorage();
	private isInitialized = false;

	/**
	 * Check if File System Access API is supported
	 */
	private isFileSystemAccessSupported(): boolean {
		return "showDirectoryPicker" in window;
	}

	/**
	 * Verify that we still have permission to access the stored handle
	 */
	private async verifyHandlePermission(
		handle: FileSystemDirectoryHandle,
	): Promise<boolean> {
		try {
			// @ts-ignore - queryPermission is not yet in TypeScript definitions
			const permission = await (handle as any).queryPermission({
				mode: "readwrite",
			});
			if (permission === "granted") {
				return true;
			}

			// Try to request permission if not granted
			// @ts-ignore - requestPermission is not yet in TypeScript definitions
			const requestedPermission = await (handle as any).requestPermission({
				mode: "readwrite",
			});
			return requestedPermission === "granted";
		} catch {
			return false;
		}
	}

	/**
	 * Initialize the storage manager
	 * Determines which strategy to use and sets up the environment
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) return;

		console.log("🔧 Initializing Storage Manager...");

		// 1. Check if File System Access API is supported
		if (!this.isFileSystemAccessSupported()) {
			console.log(
				"📂 File System Access API not supported, using localStorage fallback",
			);
			this.strategy = "localstorage";
			this.isInitialized = true;
			return;
		}

		// 2. Try to get stored handle from IndexedDB
		const storedHandle = await this.handleStorage.getHandle();

		if (storedHandle) {
			// 3. Verify we still have permission
			const hasPermission = await this.verifyHandlePermission(storedHandle);

			if (hasPermission) {
				console.log("✅ Restored file system access from previous session");
				this.rootHandle = storedHandle;
				this.strategy = "filesystem";
				await this.ensureDirectoryStructure();
			} else {
				console.log("❌ Lost permission to stored directory, clearing handle");
				await this.handleStorage.clearHandle();
				this.strategy = "localstorage";
			}
		} else {
			console.log(
				"📂 No stored directory handle found, using localStorage until user selects folder",
			);
			this.strategy = "localstorage";
		}

		this.isInitialized = true;
	}

	/**
	 * Prompt user to select directory for file system storage
	 */
	async requestDirectoryAccess(): Promise<boolean> {
		if (!this.isFileSystemAccessSupported()) {
			throw new Error(
				"File System Access API is not supported in this browser",
			);
		}

		try {
			// 1. Show directory picker
			const dirHandle = await window.showDirectoryPicker({
				id: "gengoTavernRoot",
				mode: "readwrite",
				startIn: "documents",
			});

			// 2. Store the handle
			await this.handleStorage.storeHandle(dirHandle);

			// 3. Switch to file system strategy
			this.rootHandle = dirHandle;
			this.strategy = "filesystem";

			// 4. Create directory structure
			await this.ensureDirectoryStructure();

			console.log("✅ File system access granted and configured");
			return true;
		} catch (error) {
			console.error("❌ Failed to get directory access:", error);
			return false;
		}
	}

	/**
	 * Create the necessary directory structure in the selected folder
	 */
	private async ensureDirectoryStructure(): Promise<void> {
		if (!this.rootHandle) return;

		for (const [name, dirName] of Object.entries(DIRECTORIES)) {
			try {
				await this.rootHandle.getDirectoryHandle(dirName, { create: true });
				console.log(`✅ Ensured ${name} directory exists`);
			} catch (error) {
				console.warn(`⚠️ Could not create ${name} directory:`, error);
			}
		}
	}

	/**
	 * Get current storage strategy
	 */
	getStrategy(): StorageStrategy {
		return this.strategy;
	}

	/**
	 * Get the root directory path (for file system strategy)
	 */
	async getRootPath(): Promise<string | null> {
		if (this.strategy !== "filesystem" || !this.rootHandle) {
			return null;
		}

		try {
			// This is a bit hacky but works in Chrome - get the handle name
			return this.rootHandle.name || "Selected Folder";
		} catch {
			return "Selected Folder";
		}
	}

	/**
	 * Character storage operations
	 */
	async saveCharacter(character: Character): Promise<void> {
		if (this.strategy === "filesystem") {
			await this.saveCharacterToFileSystem(character);
			return;
		}

		await this.saveCharacterToLocalStorage(character);
	}

	async loadAllCharacters(): Promise<Character[]> {
		if (this.strategy === "filesystem") {
			return await this.loadCharactersFromFileSystem();
		}

		return await this.loadCharactersFromLocalStorage();
	}

	async deleteCharacter(id: number): Promise<boolean> {
		if (this.strategy === "filesystem") {
			return await this.deleteCharacterFromFileSystem(id);
		}

		return await this.deleteCharacterFromLocalStorage(id);
	}

	/**
	 * Settings storage operations
	 */
	async saveSettings(settings: {
		apiKey: string;
		huggingFaceApiKey?: string;
		userPersona: UserPersona;
		selectedModel: string;
		temperature: number;
		visualNovelMode?: boolean;
	}): Promise<void> {
		if (this.strategy === "filesystem") {
			await this.saveSettingsToFileSystem(settings);
			return;
		}

		await this.saveSettingsToLocalStorage(settings);
	}

	async loadSettings(): Promise<{
		apiKey: string;
		huggingFaceApiKey: string;
		userPersona: UserPersona;
		selectedModel: string;
		temperature: number;
		visualNovelMode: boolean;
	}> {
		if (this.strategy === "filesystem") {
			return await this.loadSettingsFromFileSystem();
		}

		return await this.loadSettingsFromLocalStorage();
	}

	/**
	 * File System Implementation
	 */
	private async saveCharacterToFileSystem(character: Character): Promise<void> {
		if (!this.rootHandle) throw new Error("No root directory handle");

		const charactersDir = await this.rootHandle.getDirectoryHandle(
			DIRECTORIES.characters,
		);
		const filename = `${this.sanitizeFilename(character.name)}.png`;

		// Handle renaming
		if (character.originalFilename && character.originalFilename !== filename) {
			try {
				await charactersDir.removeEntry(character.originalFilename);
			} catch (error) {
				console.warn(
					`Could not delete old file: ${character.originalFilename}`,
					error,
				);
			}
		}

		// Embed character data into PNG
		const pngBuffer = await embedCharacterIntoPng(character);

		// Write file
		const fileHandle = await charactersDir.getFileHandle(filename, {
			create: true,
		});
		const writable = await fileHandle.createWritable();
		await writable.write(pngBuffer);
		await writable.close();

		character.originalFilename = filename;
		console.log(`✅ Character saved to file system: ${filename}`);
	}

	private async loadCharactersFromFileSystem(): Promise<Character[]> {
		if (!this.rootHandle) return [];

		try {
			const charactersDir = await this.rootHandle.getDirectoryHandle(
				DIRECTORIES.characters,
			);
			const characters: Character[] = [];

			// @ts-ignore - entries() is not yet in TypeScript types
			for await (const [name, handle] of charactersDir.entries()) {
				if (handle.kind === "file" && name.endsWith(".png")) {
					try {
						// @ts-ignore - getFile is available on FileSystemFileHandle
						const file = await (handle as FileSystemFileHandle).getFile();
						const character = await extractCharacterFromPng(file);
						character.originalFilename = name;
						characters.push(character);
					} catch (error) {
						console.warn(`Error loading character ${name}:`, error);
					}
				}
			}

			console.log(`✅ Loaded ${characters.length} characters from file system`);
			return characters;
		} catch (error) {
			console.error("Error loading characters from file system:", error);
			return [];
		}
	}

	private async deleteCharacterFromFileSystem(id: number): Promise<boolean> {
		if (!this.rootHandle) return false;

		try {
			const characters = await this.loadCharactersFromFileSystem();
			const character = characters.find((c) => c.id === id);

			if (!character?.originalFilename) return false;

			const charactersDir = await this.rootHandle.getDirectoryHandle(
				DIRECTORIES.characters,
			);
			await charactersDir.removeEntry(character.originalFilename);

			console.log(
				`✅ Character deleted from file system: ${character.originalFilename}`,
			);
			return true;
		} catch (error) {
			console.error(`Error deleting character ${id}:`, error);
			return false;
		}
	}

	private async saveSettingsToFileSystem(settings: {
		apiKey: string;
		huggingFaceApiKey?: string;
		userPersona: UserPersona;
		selectedModel: string;
		temperature: number;
		visualNovelMode?: boolean;
	}): Promise<void> {
		if (!this.rootHandle) throw new Error("No root directory handle");

		const settingsDir = await this.rootHandle.getDirectoryHandle(
			DIRECTORIES.settings,
		);
		const fileHandle = await settingsDir.getFileHandle("settings.json", {
			create: true,
		});
		const writable = await fileHandle.createWritable();
		await writable.write(JSON.stringify(settings, null, 2));
		await writable.close();

		console.log("✅ Settings saved to file system");
	}

	private async loadSettingsFromFileSystem(): Promise<{
		apiKey: string;
		huggingFaceApiKey: string;
		userPersona: UserPersona;
		selectedModel: string;
		temperature: number;
		visualNovelMode: boolean;
	}> {
		if (!this.rootHandle) return this.getDefaultSettings();

		try {
			const settingsDir = await this.rootHandle.getDirectoryHandle(
				DIRECTORIES.settings,
			);
			const fileHandle = await settingsDir.getFileHandle("settings.json");
			const file = await fileHandle.getFile();
			const text = await file.text();
			const data = JSON.parse(text);

			return {
				apiKey: data.apiKey || "",
				// Ensure huggingFaceApiKey exists even if not in saved data (backward compatibility)
				huggingFaceApiKey: data.huggingFaceApiKey || "",
				userPersona: data.userPersona || {
					name: "User",
					description: "A friendly user chatting with characters.",
				},
				selectedModel: data.selectedModel || "gemini-2.5-flash",
				temperature: data.temperature || 1.5,
			};
		} catch {
			return this.getDefaultSettings();
		}
	}

	/**
	 * LocalStorage Implementation (fallback)
	 */
	private async saveCharacterToLocalStorage(
		character: Character,
	): Promise<void> {
		const filename = `${this.sanitizeFilename(character.name)}.png`;

		if (character.originalFilename && character.originalFilename !== filename) {
			const oldKey = `gengoTavern_file_characters_${character.originalFilename.replace(".png", "")}_png`;
			localStorage.removeItem(oldKey);
		}

		const characterData = { ...character, originalFilename: filename };
		const storageKey = `gengoTavern_file_characters_${filename.replace(".png", "")}_png`;
		localStorage.setItem(storageKey, JSON.stringify(characterData));

		character.originalFilename = filename;
		console.log(`✅ Character saved to localStorage: ${filename}`);
	}

	private async loadCharactersFromLocalStorage(): Promise<Character[]> {
		const characters: Character[] = [];
		const prefix = "gengoTavern_file_characters_";

		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(prefix) && key.endsWith("_png")) {
				try {
					const data = localStorage.getItem(key);
					if (data) {
						const character = JSON.parse(data) as Character;
						characters.push(character);
					}
				} catch (error) {
					console.warn("Error loading character from localStorage:", error);
				}
			}
		}

		console.log(`✅ Loaded ${characters.length} characters from localStorage`);
		return characters;
	}

	private async deleteCharacterFromLocalStorage(id: number): Promise<boolean> {
		const characters = await this.loadCharactersFromLocalStorage();
		const character = characters.find((c) => c.id === id);

		if (!character?.originalFilename) return false;

		const storageKey = `gengoTavern_file_characters_${character.originalFilename.replace(".png", "")}_png`;
		localStorage.removeItem(storageKey);

		console.log(
			`✅ Character deleted from localStorage: ${character.originalFilename}`,
		);
		return true;
	}

	private async saveSettingsToLocalStorage(settings: {
		apiKey: string;
		huggingFaceApiKey?: string;
		userPersona: UserPersona;
		selectedModel: string;
		temperature: number;
		visualNovelMode?: boolean;
	}): Promise<void> {
		localStorage.setItem(
			"gengoTavern_file_settings_settings_json",
			JSON.stringify(settings, null, 2),
		);
		console.log("✅ Settings saved to localStorage");
	}

	private async loadSettingsFromLocalStorage(): Promise<{
		apiKey: string;
		huggingFaceApiKey: string;
		userPersona: UserPersona;
		selectedModel: string;
		temperature: number;
		visualNovelMode: boolean;
	}> {
		try {
			const data = localStorage.getItem(
				"gengoTavern_file_settings_settings_json",
			);
			if (data) {
				const parsed = JSON.parse(data);
				return {
					apiKey: parsed.apiKey || "",
					// Ensure huggingFaceApiKey exists even if not in saved data (backward compatibility)
					huggingFaceApiKey: parsed.huggingFaceApiKey || "",
					userPersona: parsed.userPersona || {
						name: "User",
						description: "A friendly user chatting with characters.",
					},
					selectedModel: parsed.selectedModel || "gemini-2.5-flash",
					temperature: parsed.temperature || 1.5,
				};
			}
		} catch (error) {
			console.warn("Error loading settings from localStorage:", error);
		}

		return this.getDefaultSettings();
	}

	/**
	 * Utility methods
	 */
	private getDefaultSettings() {
		return {
			apiKey: "",
			huggingFaceApiKey: "",
			userPersona: {
				name: "User",
				description: "A friendly user chatting with characters.",
			},
			selectedModel: "gemini-2.5-flash",
			temperature: 1.5,
			visualNovelMode: false,
		};
	}

	private sanitizeFilename(name: string): string {
		return (
			name
				.replace(/[\\/:*?"<>|]/g, "_")
				.trim()
				.replace(/^\.+|\.+$/g, "") || "unnamed_character"
		);
	}

	/**
	 * Migration from old localStorage format
	 */
	async migrateFromOldLocalStorage(): Promise<void> {
		console.log("🔄 Checking for old localStorage data to migrate...");

		// Check if we have old format data
		const hasOldData =
			localStorage.getItem("gengoTavern_apiKey") ||
			localStorage.getItem("gengoTavern_userPersona") ||
			Object.keys(localStorage).some((key) => key.startsWith("character_"));

		if (!hasOldData) {
			console.log("📁 No old localStorage data found");
			return;
		}

		console.log("📦 Found old localStorage data, starting migration...");

		// Migrate settings
		const userPersonaString = localStorage.getItem("gengoTavern_userPersona");
		const temperatureString = localStorage.getItem("gengoTavern_temperature");

		const settings = {
			apiKey: localStorage.getItem("gengoTavern_apiKey") || "",
			huggingFaceApiKey: "", // Initialize new field during migration
			userPersona: userPersonaString
				? JSON.parse(userPersonaString)
				: {
						name: "User",
						description: "A friendly user chatting with characters.",
					},
			selectedModel:
				localStorage.getItem("gengoTavern_selectedModel") || "gemini-2.5-flash",
			temperature: temperatureString
				? Number.parseFloat(temperatureString)
				: 1.5,
		};

		await this.saveSettings(settings);

		// Migrate characters
		let migratedCharacters = 0;
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith("character_")) {
				try {
					const characterData = localStorage.getItem(key);
					if (characterData) {
						const character = JSON.parse(characterData) as Character;
						await this.saveCharacter(character);
						migratedCharacters++;
					}
				} catch (error) {
					console.warn(`Error migrating character ${key}:`, error);
				}
			}
		}

		// Clear old data
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (
				key &&
				(key.startsWith("character_") ||
					(key.startsWith("gengoTavern_") &&
						!key.startsWith("gengoTavern_file_")))
			) {
				keysToRemove.push(key);
			}
		}

		for (const key of keysToRemove) {
			localStorage.removeItem(key);
		}

		console.log(
			`✅ Migration complete! Migrated ${migratedCharacters} characters and settings`,
		);
		localStorage.setItem("gengoTavern_migrationComplete", "true");
	}

	/**
	 * Delete all user data
	 */
	async deleteAllUserData(): Promise<void> {
		console.log("🗑️ Deleting all user data...");

		if (this.strategy === "filesystem" && this.rootHandle) {
			// Delete from file system
			for (const dirName of Object.values(DIRECTORIES)) {
				try {
					const dir = await this.rootHandle.getDirectoryHandle(dirName);
					// @ts-ignore - entries() not in types yet
					for await (const [name, handle] of dir.entries()) {
						if (handle.kind === "file") {
							await dir.removeEntry(name);
						}
					}
					console.log(`✅ Cleared ${dirName} directory`);
				} catch (error) {
					console.warn(`⚠️ Error clearing ${dirName}:`, error);
				}
			}
		}

		// Also clear localStorage for completeness
		const keysToDelete: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith("gengoTavern_")) {
				keysToDelete.push(key);
			}
		}

		for (const key of keysToDelete) {
			localStorage.removeItem(key);
		}

		console.log("✅ All user data deleted");
	}

	/**
	 * Background storage operations
	 */

	/**
	 * Saves a background image file to the backgrounds directory.
	 * @param file The image file to save.
	 * @returns The unique filename of the saved background.
	 */
	async saveBackground(file: File): Promise<string> {
		if (this.strategy !== "filesystem" || !this.rootHandle) {
			// Fallback for localStorage: convert to base64 and return the data URL
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(file);
			});
		}

		const backgroundsDir = await this.rootHandle.getDirectoryHandle(
			DIRECTORIES.backgrounds,
			{ create: true },
		);
		// Create a unique filename to avoid collisions
		const uniqueFilename = `${Date.now()}-${file.name}`;
		const fileHandle = await backgroundsDir.getFileHandle(uniqueFilename, {
			create: true,
		});
		const writable = await fileHandle.createWritable();
		await writable.write(file);
		await writable.close();
		console.log(`✅ Background saved to file system: ${uniqueFilename}`);
		return uniqueFilename;
	}

	/**
	 * Loads a background image as a Blob URL.
	 * @param filename The filename of the background to load.
	 * @returns A Blob URL that can be used in an `src` attribute.
	 */
	async loadBackgroundAsUrl(filename: string): Promise<string> {
		if (this.strategy !== "filesystem" || !this.rootHandle) {
			// If the filename is a base64 data URL, just return it
			if (filename.startsWith("data:image")) {
				return filename;
			}
			// This case should ideally not be hit if the save logic is correct
			throw new Error(
				"Cannot load background from localStorage with a filename.",
			);
		}

		try {
			const backgroundsDir = await this.rootHandle.getDirectoryHandle(
				DIRECTORIES.backgrounds,
			);
			const fileHandle = await backgroundsDir.getFileHandle(filename);
			const file = await fileHandle.getFile();
			return URL.createObjectURL(file);
		} catch (error) {
			console.error(`Error loading background ${filename}:`, error);
			throw new Error(`Could not load background: ${filename}`);
		}
	}

	/**
	 * Lists all available background filenames.
	 * @returns An array of background filenames.
	 */
	async listBackgrounds(): Promise<string[]> {
		if (this.strategy !== "filesystem" || !this.rootHandle) {
			// localStorage doesn't have a concept of a background directory,
			// so we can't list them. This feature will be available only for FS users.
			return [];
		}

		try {
			const backgroundsDir = await this.rootHandle.getDirectoryHandle(
				DIRECTORIES.backgrounds,
			);
			const filenames: string[] = [];
			// @ts-ignore - entries() is not yet in TypeScript types
			for await (const [name, handle] of backgroundsDir.entries()) {
				if (handle.kind === "file") {
					filenames.push(name);
				}
			}
			return filenames;
		} catch (error) {
			console.warn("Could not list backgrounds:", error);
			return [];
		}
	}

	/**
	 * Deletes a background file.
	 * @param filename The filename of the background to delete.
	 */
	async deleteBackground(filename: string): Promise<void> {
		if (this.strategy !== "filesystem" || !this.rootHandle) {
			// Deleting is not applicable for the localStorage base64 strategy
			return;
		}

		try {
			const backgroundsDir = await this.rootHandle.getDirectoryHandle(
				DIRECTORIES.backgrounds,
			);
			await backgroundsDir.removeEntry(filename);
			console.log(`✅ Background deleted: ${filename}`);
		} catch (error) {
			console.error(`Error deleting background ${filename}:`, error);
			throw new Error(`Could not delete background: ${filename}`);
		}
	}

	/**
	 * Gets the character directory handle
	 * @param characterId - The ID of the character
	 * @returns Promise<FileSystemDirectoryHandle> - The directory handle for the character
	 */
	async getCharacterDirHandle(
		characterId: number,
	): Promise<FileSystemDirectoryHandle> {
		if (!this.rootHandle) {
			throw new Error("No root directory handle available");
		}

		const charactersDirHandle = await this.rootHandle.getDirectoryHandle(
			DIRECTORIES.characters,
			{ create: true },
		);

		// Create or get the directory for this character
		return charactersDirHandle.getDirectoryHandle(`character_${characterId}`, {
			create: true,
		});
	}

	/**
	 * Gets the sprites directory handle for a character
	 * @param characterId - The ID of the character
	 * @returns Promise<FileSystemDirectoryHandle> - The directory handle for the character's sprites
	 */
	async getCharacterSpritesDirHandle(
		characterId: number,
	): Promise<FileSystemDirectoryHandle> {
		// Get the character directory
		const characterDirHandle = await this.getCharacterDirHandle(characterId);

		// Try to get the sprites directory, create if it doesn't exist
		let spritesDirHandle: FileSystemDirectoryHandle;
		try {
			spritesDirHandle = await characterDirHandle.getDirectoryHandle(
				"sprites",
				{
					create: true,
				},
			);
		} catch (error: unknown) {
			console.error("Failed to get sprites directory:", error);
			throw new Error("Failed to access sprites directory");
		}

		return spritesDirHandle;
	}

	/**
	 * Gets the character name-based sprites directory handle
	 * @param characterName - The name of the character
	 * @returns Promise<FileSystemDirectoryHandle> - The directory handle for the character's sprites
	 */
	async getCharacterNamedSpritesDirHandle(
		characterName: string,
	): Promise<FileSystemDirectoryHandle> {
		if (!this.rootHandle) {
			throw new Error("No root directory handle available");
		}

		// Sanitize character name for safe directory naming
		const sanitizedName = this.sanitizeFilename(characterName);

		// Get or create the characters directory
		const charactersDirHandle = await this.rootHandle.getDirectoryHandle(
			DIRECTORIES.characters,
			{ create: true },
		);

		// Create or get the directory for this character by name
		let characterDirHandle: FileSystemDirectoryHandle;
		try {
			characterDirHandle = await charactersDirHandle.getDirectoryHandle(
				sanitizedName,
				{
					create: true,
				},
			);
		} catch (error: unknown) {
			console.error(
				`Failed to get character directory for ${characterName}:`,
				error,
			);
			throw new Error(
				`Failed to access character directory for ${characterName}`,
			);
		}

		// Create or get the sprites directory
		let spritesDirHandle: FileSystemDirectoryHandle;
		try {
			spritesDirHandle = await characterDirHandle.getDirectoryHandle(
				"sprites",
				{
					create: true,
				},
			);
		} catch (error: unknown) {
			console.error(
				`Failed to get sprites directory for ${characterName}:`,
				error,
			);
			throw new Error(
				`Failed to access sprites directory for ${characterName}`,
			);
		}

		return spritesDirHandle;
	}

	/**
	 * Saves a sprite image for a character
	 * @param characterId - The ID of the character
	 * @param filename - The filename to save the sprite as
	 * @param imageData - The image data as a base64 string
	 * @returns Promise<void>
	 */
	async saveSprite(
		characterId: number,
		filename: string,
		imageData: string,
	): Promise<void> {
		if (this.strategy === "filesystem") {
			try {
				// Find character name from ID
				const characters = await this.loadAllCharacters();
				const character = characters.find((c) => c.id === characterId);

				if (!character) {
					throw new Error(`Character with ID ${characterId} not found`);
				}

				// Get the sprites directory using character name
				const spritesDirHandle = await this.getCharacterNamedSpritesDirHandle(
					character.name,
				);

				// Convert base64 to blob
				const base64Data = imageData.split(",")[1];
				const blob = await (
					await fetch(`data:image/png;base64,${base64Data}`)
				).blob();

				// Save the file
				const fileHandle = await spritesDirHandle.getFileHandle(filename, {
					create: true,
				});
				const writable = await fileHandle.createWritable();
				await writable.write(blob);
				await writable.close();

				console.log(`✅ Sprite saved: ${character.name}/sprites/${filename}`);
			} catch (error: unknown) {
				console.error("Failed to save sprite:", error);
				throw new Error("Failed to save sprite");
			}
		} else {
			// LocalStorage fallback
			try {
				// Create a key for the sprite
				const key = `character_${characterId}_sprite_${filename}`;
				localStorage.setItem(key, imageData);
			} catch (error: unknown) {
				console.error("Failed to save sprite to localStorage:", error);
				throw new Error("Failed to save sprite to localStorage");
			}
		}
	}

	/**
	 * Loads a sprite image as a URL
	 * @param characterId - The ID of the character
	 * @param filename - The filename of the sprite
	 * @returns Promise<string> - The sprite image as a data URL
	 */
	async loadSpriteAsUrl(
		characterId: number,
		filename: string,
	): Promise<string> {
		if (this.strategy === "filesystem") {
			try {
				// Find character name from ID
				const characters = await this.loadAllCharacters();
				const character = characters.find((c) => c.id === characterId);

				if (!character) {
					throw new Error(`Character with ID ${characterId} not found`);
				}

				// Try to get the sprites directory using character name
				const spritesDirHandle = await this.getCharacterNamedSpritesDirHandle(
					character.name,
				);

				// Get the file
				const fileHandle = await spritesDirHandle.getFileHandle(filename);
				const file = await fileHandle.getFile();

				// Read the file as data URL
				return await readFileAsDataURL(file);
			} catch (error: unknown) {
				console.error("Failed to load sprite:", error);

				// Fallback to the old ID-based path if name-based fails
				try {
					const spritesDirHandle =
						await this.getCharacterSpritesDirHandle(characterId);
					const fileHandle = await spritesDirHandle.getFileHandle(filename);
					const file = await fileHandle.getFile();
					return await readFileAsDataURL(file);
				} catch (fallbackError) {
					console.error("Fallback sprite loading also failed:", fallbackError);
					throw new Error("Failed to load sprite");
				}
			}
		} else {
			// LocalStorage fallback
			const key = `character_${characterId}_sprite_${filename}`;
			const imageData = localStorage.getItem(key);
			if (!imageData) {
				throw new Error("Sprite not found in localStorage");
			}
			return imageData;
		}
	}

	/**
	 * Deletes a sprite image
	 * @param characterId - The ID of the character
	 * @param filename - The filename of the sprite to delete
	 * @returns Promise<void>
	 */
	async deleteSprite(characterId: number, filename: string): Promise<void> {
		if (this.strategy === "filesystem") {
			try {
				// Find character name from ID
				const characters = await this.loadAllCharacters();
				const character = characters.find((c) => c.id === characterId);

				if (!character) {
					throw new Error(`Character with ID ${characterId} not found`);
				}

				// Get the sprites directory using character name
				const spritesDirHandle = await this.getCharacterNamedSpritesDirHandle(
					character.name,
				);

				// Delete the file
				await spritesDirHandle.removeEntry(filename);
				console.log(`✅ Sprite deleted: ${character.name}/sprites/${filename}`);
			} catch (error: unknown) {
				console.error("Failed to delete sprite:", error);

				// Fallback to the old ID-based path if name-based fails
				try {
					const spritesDirHandle =
						await this.getCharacterSpritesDirHandle(characterId);
					await spritesDirHandle.removeEntry(filename);
				} catch (fallbackError) {
					console.error("Fallback sprite deletion also failed:", fallbackError);
					throw new Error("Failed to delete sprite");
				}
			}
		} else {
			// LocalStorage fallback
			const key = `character_${characterId}_sprite_${filename}`;
			localStorage.removeItem(key);
		}
	}

	/**
	 * Migrates sprites from the old ID-based directory structure to the new name-based structure
	 * @param character - The character whose sprites need to be migrated
	 * @returns Promise<void>
	 */
	async migrateSpriteDirectories(character: Character): Promise<void> {
		if (
			this.strategy !== "filesystem" ||
			!character.sprites ||
			character.sprites.length === 0
		) {
			return;
		}

		try {
			console.log(`🔄 Migrating sprites for character: ${character.name}`);

			// Get the old sprites directory (ID-based)
			let oldSpritesDirHandle: FileSystemDirectoryHandle;
			try {
				oldSpritesDirHandle = await this.getCharacterSpritesDirHandle(
					character.id,
				);
			} catch (error) {
				console.log(
					`No old sprites directory found for ${character.name}, skipping migration`,
				);
				return;
			}

			// Get the new sprites directory (name-based)
			const newSpritesDirHandle = await this.getCharacterNamedSpritesDirHandle(
				character.name,
			);

			// Migrate each sprite
			for (const sprite of character.sprites) {
				try {
					// Get the file from old location
					const oldFileHandle = await oldSpritesDirHandle.getFileHandle(
						sprite.filename,
					);
					const file = await oldFileHandle.getFile();

					// Read the file content
					const fileContent = await file.arrayBuffer();

					// Create the new filename (emotion.png)
					const newFilename = `${sprite.emotion}.png`;

					// Save to new location
					const newFileHandle = await newSpritesDirHandle.getFileHandle(
						newFilename,
						{ create: true },
					);
					const writable = await newFileHandle.createWritable();
					await writable.write(fileContent);
					await writable.close();

					// Update the sprite filename in the character object
					sprite.filename = newFilename;

					console.log(
						`✅ Migrated sprite: ${sprite.emotion} for ${character.name}`,
					);
				} catch (error) {
					console.error(`Failed to migrate sprite ${sprite.filename}:`, error);
				}
			}

			// Save the character with updated sprite filenames
			await this.saveCharacter(character);

			console.log(`✅ Sprite migration completed for ${character.name}`);
		} catch (error) {
			console.error(`Error migrating sprites for ${character.name}:`, error);
		}
	}

	/**
	 * Migrates all characters' sprites from ID-based to name-based directories
	 * @returns Promise<void>
	 */
	async migrateAllSprites(): Promise<void> {
		if (this.strategy !== "filesystem") {
			return;
		}

		try {
			console.log("🔄 Starting sprite migration for all characters");
			const characters = await this.loadAllCharacters();

			for (const character of characters) {
				await this.migrateSpriteDirectories(character);
			}

			console.log("✅ Sprite migration completed for all characters");
		} catch (error) {
			console.error("Error during sprite migration:", error);
		}
	}

	/**
	 * Scans a character's sprites directory and updates the character's sprites array
	 * @param character - The character to scan sprites for
	 * @returns Promise<Sprite[]> - The updated sprites array
	 */
	async scanAndUpdateCharacterSprites(character: Character): Promise<Sprite[]> {
		if (this.strategy !== "filesystem" || !this.rootHandle) {
			// For localStorage, we just return the existing sprites
			return character.sprites || [];
		}

		try {
			// Get the character directory by name
			const sanitizedName = this.sanitizeFilename(character.name);
			const charactersDirHandle = await this.rootHandle.getDirectoryHandle(
				DIRECTORIES.characters,
				{ create: false },
			);

			// Try to get the character directory
			let characterDirHandle: FileSystemDirectoryHandle;
			try {
				characterDirHandle = await charactersDirHandle.getDirectoryHandle(
					sanitizedName,
					{ create: false },
				);
			} catch (error) {
				console.log(
					`No directory found for character ${character.name}, using existing sprites`,
				);
				return character.sprites || [];
			}

			// Try to get the sprites directory
			let spritesDirHandle: FileSystemDirectoryHandle;
			try {
				spritesDirHandle = await characterDirHandle.getDirectoryHandle(
					"sprites",
					{ create: false },
				);
			} catch (error) {
				console.log(
					`No sprites directory found for character ${character.name}`,
				);
				return character.sprites || [];
			}

			// Scan for sprite files
			const sprites: Sprite[] = [];
			const emotionMap = new Map<string, boolean>();

			// First, build a map of supported emotions for quick lookup
			SUPPORTED_EMOTIONS.forEach((emotion) => {
				emotionMap.set(emotion, true);
			});

			// Scan the directory for sprite files
			try {
				// @ts-ignore - entries() is not yet in TypeScript types
				for await (const [filename, fileHandle] of spritesDirHandle.entries()) {
					if (
						fileHandle.kind === "file" &&
						filename.toLowerCase().endsWith(".png")
					) {
						// Extract emotion from filename (remove .png extension)
						const emotion = filename.toLowerCase().replace(/\.png$/i, "");

						// Check if this is a supported emotion
						if (emotionMap.has(emotion)) {
							sprites.push({
								emotion: emotion as SupportedEmotion,
								filename: filename,
							});
							console.log(`Found sprite for emotion ${emotion}: ${filename}`);
						}
					}
				}

				// Update the character's sprites array if we found any
				if (sprites.length > 0) {
					console.log(
						`Found ${sprites.length} sprites for character ${character.name}`,
					);

					// Save the updated character
					const updatedCharacter = { ...character, sprites };
					await this.saveCharacter(updatedCharacter);

					return sprites;
				}
			} catch (error) {
				console.error(
					`Error scanning sprites directory for ${character.name}:`,
					error,
				);
			}

			return character.sprites || [];
		} catch (error) {
			console.error(`Error scanning sprites for ${character.name}:`, error);
			return character.sprites || [];
		}
	}
}

// Create singleton instance
export const storageManager = new StorageManager();
