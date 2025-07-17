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
		<div className="modal-backdrop">
			<div
				className="modal-content setup-modal"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<header className="modal-header">
					<h3>Enable Extended Local Storage</h3>
					<button type="button" className="close-button" onClick={onClose}>
						×
					</button>
				</header>

				{/* Body */}
				<section className="modal-body">
					<p>
						Browsers typically limit local storage to about 5–10 MB. Granting
						folder access lets GengoTavern save data directly to your device,
						removing that cap.
					</p>

					<ul className="benefits-list">
						<li>
							<strong>Large Capacity —</strong> Keep long chat histories,
							images, and other assets.
						</li>
						<li>
							<strong>Local-only —</strong> All files remain on your computer;
							nothing is uploaded.
						</li>
						<li>
							<strong>Scalable —</strong> Ready for upcoming features that need
							additional space.
						</li>
					</ul>

					<p>
						<strong>To enable:</strong>
					</p>
					<ol>
						<li>
							Click <em>Choose Folder</em>.
						</li>
						<li>
							Select or create a directory (e.g.,{" "}
							<code>Documents/GengoTavern</code>).
						</li>
						<li>Approve the permission prompt.</li>
					</ol>

					<p className="browser-note">
						<small>
							Supported in Chrome, Edge, and other Chromium-based browsers.
							Firefox will continue using standard browser storage.
						</small>
					</p>
				</section>

				{/* Footer */}
				<footer className="modal-footer">
					<button
						type="button"
						className="secondary-button"
						onClick={onSkip}
						disabled={isSelecting}
					>
						Later
					</button>
					<button
						type="button"
						className="primary-button"
						onClick={handleSelectDirectory}
						disabled={isSelecting}
					>
						{isSelecting ? "Selecting…" : "Choose Folder"}
					</button>
				</footer>
			</div>
		</div>
	);
};

export default FileSystemSetupModal;
