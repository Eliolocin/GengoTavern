import React, { useState } from "react";
import { setupModalBackButtonHandler } from "../../utils/modalBackButtonHandler";
import { useEffect } from "react";

interface FileSystemSetupModalProps {
	onClose: () => void;
	onDirectorySelected: () => void;
	onSkip: () => void;
}

const FileSystemSetupModal: React.FC<FileSystemSetupModalProps> = ({
	onClose,
	onDirectorySelected,
	onSkip,
}) => {
	const [isSelecting, setIsSelecting] = useState(false);

	useEffect(() => {
		// Set up back button handler
		const cleanup = setupModalBackButtonHandler(onClose);
		return cleanup;
	}, [onClose]);

	const handleSelectDirectory = async () => {
		setIsSelecting(true);
		try {
			const { storageManager } = await import("../../utils/storageManager");
			const success = await storageManager.requestDirectoryAccess();

			if (success) {
				onDirectorySelected();
			} else {
				setIsSelecting(false);
			}
		} catch (error) {
			console.error("Error requesting directory access:", error);
			setIsSelecting(false);
		}
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div
				className="modal-content setup-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<h3>🚀 Unlock Unlimited Storage</h3>
					<button className="close-button" onClick={onClose} type="button">
						×
					</button>
				</div>

				<div className="modal-body">
					<div className="setup-content">
						<div className="feature-highlight">
							<h4>✨ Break Free from Browser Limits!</h4>
							<p>
								Your browser normally limits storage to 5-10MB, but GengoTavern
								can do better!
							</p>
						</div>

						<div className="benefits-list">
							<div className="benefit-item">
								<span className="benefit-icon">💾</span>
								<div>
									<strong>Unlimited Storage</strong>
									<p>
										Store thousands of characters, long chat histories, and
										large sprite images
									</p>
								</div>
							</div>

							<div className="benefit-item">
								<span className="benefit-icon">🔒</span>
								<div>
									<strong>Your Data, Your Control</strong>
									<p>
										Files are saved directly to your computer - no cloud, no
										limits
									</p>
								</div>
							</div>

							<div className="benefit-item">
								<span className="benefit-icon">⚡</span>
								<div>
									<strong>Future-Ready</strong>
									<p>
										Ready for Visual Novel sprites, Group Chats, and more
										exciting features
									</p>
								</div>
							</div>
						</div>

						<div className="setup-instructions">
							<p>
								<strong>How it works:</strong>
							</p>
							<ol>
								<li>Click "Choose Folder" below</li>
								<li>
									Select or create a folder for GengoTavern (e.g.,
									"Documents/GengoTavern")
								</li>
								<li>Grant permission when prompted</li>
								<li>Enjoy unlimited storage! 🎉</li>
							</ol>
						</div>

						<div className="browser-note">
							<p>
								<small>
									<strong>Note:</strong> This feature requires Chrome, Edge, or
									another Chromium-based browser. Firefox users will continue to
									use browser storage (limited but functional).
								</small>
							</p>
						</div>
					</div>
				</div>

				<div className="modal-footer">
					<button
						className="secondary-button"
						onClick={onSkip}
						type="button"
						disabled={isSelecting}
					>
						Maybe Later
					</button>
					<button
						className="primary-button"
						onClick={handleSelectDirectory}
						disabled={isSelecting}
						type="button"
					>
						{isSelecting ? "Selecting..." : "📁 Choose Folder"}
					</button>
				</div>
			</div>
		</div>
	);
};

export default FileSystemSetupModal;
