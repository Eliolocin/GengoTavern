import { useState, useEffect } from "react";
import type React from "react";
import {
	storageManager,
	type StorageStrategy,
} from "../../utils/storageManager";

interface StorageIndicatorProps {
	className?: string;
}

const StorageIndicator: React.FC<StorageIndicatorProps> = ({
	className = "",
}) => {
	const [strategy, setStrategy] = useState<StorageStrategy>("localstorage");
	const [rootPath, setRootPath] = useState<string | null>(null);

	useEffect(() => {
		const updateStorageInfo = async () => {
			const currentStrategy = storageManager.getStrategy();
			setStrategy(currentStrategy);

			if (currentStrategy === "filesystem") {
				const path = await storageManager.getRootPath();
				setRootPath(path);
			} else {
				setRootPath(null);
			}
		};

		updateStorageInfo();

		// Update every few seconds to catch any changes
		const interval = setInterval(updateStorageInfo, 3000);
		return () => clearInterval(interval);
	}, []);

	const getStorageDisplay = () => {
		if (strategy === "filesystem") {
			return {
				icon: "✅",
				status: "File System",
				description: rootPath
					? `Folder: ${rootPath}`
					: "Unlimited storage active",
				className: "storage-filesystem",
			};
		}

		return {
			icon: "⚠️",
			status: "Browser Storage",
			description: "Limited to 5-10MB",
			className: "storage-localstorage",
		};
	};

	const display = getStorageDisplay();

	return (
		<div className={`storage-indicator ${display.className} ${className}`}>
			<span className="storage-icon">{display.icon}</span>
			<div className="storage-info">
				<div className="storage-status">{display.status}</div>
				<div className="storage-description">{display.description}</div>
			</div>
		</div>
	);
};

export default StorageIndicator;
