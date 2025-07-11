import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { storageManager } from "../../utils/storageManager";
import { setupModalBackButtonHandler } from "../../utils/modalBackButtonHandler";
import { TrashIcon } from "@heroicons/react/20/solid";

interface BackgroundManagerModalProps {
	onClose: () => void;
	onSelect: (filename: string) => void;
}

const BackgroundManagerModal: React.FC<BackgroundManagerModalProps> = ({
	onClose,
	onSelect,
}) => {
	const [backgrounds, setBackgrounds] = useState<string[]>([]);
	const [backgroundUrls, setBackgroundUrls] = useState<Record<string, string>>(
		{},
	);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Use ref to track URLs for cleanup without triggering re-renders
	const urlsRef = useRef<Record<string, string>>({});

	const loadBackgrounds = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);
			const filenames = await storageManager.listBackgrounds();
			setBackgrounds(filenames);

			const urls: Record<string, string> = {};
			for (const filename of filenames) {
				try {
					urls[filename] = await storageManager.loadBackgroundAsUrl(filename);
				} catch (urlError) {
					console.error(`Failed to load URL for ${filename}`, urlError);
					// Handle cases where a background file might be corrupted or unreadable
					urls[filename] = ""; // or a placeholder image URL
				}
			}
			setBackgroundUrls(urls);
			// Update ref for cleanup
			urlsRef.current = urls;
		} catch (err) {
			console.error("Failed to load backgrounds:", err);
			setError("Could not load backgrounds. See console for details.");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadBackgrounds();
		const cleanup = setupModalBackButtonHandler(onClose);
		return () => {
			// Revoke object URLs to prevent memory leaks
			Object.values(urlsRef.current).forEach(URL.revokeObjectURL);
			cleanup();
		};
	}, [loadBackgrounds, onClose]);

	const handleFileChange = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			setError(null);
			await storageManager.saveBackground(file);
			// Refresh the list after upload
			await loadBackgrounds();
		} catch (err) {
			console.error("Failed to upload background:", err);
			setError("Failed to upload background. See console for details.");
		}
	};

	const handleSelect = (filename: string) => {
		onSelect(filename);
		onClose();
	};

	const handleDelete = async (filename: string) => {
		if (
			window.confirm(
				`Are you sure you want to delete ${filename}? This cannot be undone.`,
			)
		) {
			try {
				setError(null);
				await storageManager.deleteBackground(filename);
				// Refresh the list after deletion
				await loadBackgrounds();
			} catch (err) {
				console.error("Failed to delete background:", err);
				setError("Failed to delete background. See console for details.");
			}
		}
	};

	/**
	 * Handle backdrop click to close modal
	 */
	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	/**
	 * Handle keyboard events for accessibility
	 */
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			onClose();
		}
	};

	const modalContent = (
		<div 
			className="modal-overlay background-manager-overlay" 
			onClick={handleBackdropClick}
			onKeyDown={handleKeyDown}
			tabIndex={-1}
		>
			<div className="modal-content background-manager-modal">
				<div className="modal-header">
					<h2>Manage Backgrounds</h2>
					<button 
						type="button" 
						className="modal-close" 
						onClick={onClose}
						aria-label="Close modal"
					>
						×
					</button>
				</div>
				
				<div className="modal-body">
					{error && <div className="error-toast">{error}</div>}
					<div className="background-upload">
						<label htmlFor="background-upload-input" className="modal-button primary">
							Upload New Background
						</label>
						<input
							id="background-upload-input"
							type="file"
							accept="image/*"
							onChange={handleFileChange}
							style={{ display: "none" }}
						/>
					</div>
					{isLoading ? (
						<div className="loading">Loading backgrounds...</div>
					) : (
						<div className="background-grid">
							{backgrounds.length === 0 ? (
								<p>No backgrounds uploaded yet.</p>
							) : (
								backgrounds.map((filename) => (
									<div key={filename} className="background-item">
										<button
											type="button"
											className="background-select-button"
											onClick={() => handleSelect(filename)}
										>
											<img
												src={backgroundUrls[filename]}
												alt={filename}
												className="background-preview"
											/>
										</button>
										<div className="background-info">
											<span className="background-name">{filename}</span>
											<button
												className="delete-button-small"
												onClick={() => handleDelete(filename)}
												type="button"
												title="Delete background"
											>
												<TrashIcon className="w-4 h-4" />
											</button>
										</div>
									</div>
								))
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);

	// Render using portal to ensure proper z-index layering
	return createPortal(modalContent, document.body);
};

export default BackgroundManagerModal;
