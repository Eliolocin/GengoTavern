import {
	createContext,
	useState,
	useContext,
	useMemo,
	useCallback,
} from "react";
import type React from "react";
import type { ReactNode } from "react";
import { storageManager, type StorageStrategy } from "../utils/storageManager";

interface AppContextType {
	isSetupModalOpen: boolean;
	openSetupModal: () => void;
	closeSetupModal: () => void;
	storageStrategy: StorageStrategy;
	setStorageStrategy: (strategy: StorageStrategy) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error("useAppContext must be used within an AppProvider");
	}
	return context;
};

interface AppProviderProps {
	children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
	const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
	const [storageStrategy, setStorageStrategy] =
		useState<StorageStrategy>("localstorage");

	const openSetupModal = useCallback(() => setIsSetupModalOpen(true), []);
	const closeSetupModal = useCallback(() => setIsSetupModalOpen(false), []);

	const value = useMemo(
		() => ({
			isSetupModalOpen,
			openSetupModal,
			closeSetupModal,
			storageStrategy,
			setStorageStrategy,
		}),
		[isSetupModalOpen, openSetupModal, closeSetupModal, storageStrategy],
	);

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
