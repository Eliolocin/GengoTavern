import { extractCharacterFromPng, embedCharacterIntoPng } from "./pngMetadata";
import type { Character } from "../types/interfaces";

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
}

// Create singleton instance
export const storageManager = new StorageManager();
