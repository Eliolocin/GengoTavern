import React, { useState, useEffect } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import { setupModalBackButtonHandler } from "../../utils/modalBackButtonHandler";

interface HelpModalProps {
	onClose: () => void;
	onHideAtStartupChange?: (hideAtStartup: boolean) => void;
	initialHideAtStartup?: boolean;
}

const HelpModal: React.FC<HelpModalProps> = ({
	onClose,
	onHideAtStartupChange,
	initialHideAtStartup = false,
}) => {
	const [hideAtStartup, setHideAtStartup] = useState(initialHideAtStartup);

	// Add useEffect for back button handling
	useEffect(() => {
		// Set up back button handler
		const cleanup = setupModalBackButtonHandler(onClose);

		// Cleanup when component unmounts
		return cleanup;
	}, [onClose]);

	const handleHideAtStartupChange = (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const newValue = e.target.checked;
		setHideAtStartup(newValue);
		if (onHideAtStartupChange) {
			onHideAtStartupChange(newValue);
		}
	};

	const helpContent = `
## Welcome to GengoTavern!

GengoTavern is a (beta) chat application that lets you create and interact with your very own characters, powered by AI. It aims to be a more Language Learning focused derivative of [SillyTavern](https://github.com/SillyTavern/SillyTavern), helping casual users practice conversation with custom characters through a user-friendly interface with tools such as sentence correction, pop-up dictionaries, and grammar checkers.

### Getting Started:
1. **Input an API Key**: Head over to the 🔑 **API Tab**  for instructions
2. **Modify your Profile**: Add your name/description at the 🎭 **Persona Tab**
3. **Create a Character**: Click the ➕ on the lefthand **Selection Panel**
4. **Edit your Character**: Add traits and attributes on the righthand **Edit Panel**
5. **Start Chatting**: Select your Character and Create a New Chat
6. **Import/Export**: Share characters as PNG files with other users

### Problems?
- Join the [Discord Server](https://discord.gg/whT3mRNAGs) for instant support regarding usage and bugs.
- Visit the [GitHub Repository](https://github.com/Eliolocin/GengoTavern/releases) for updates on new versions.
- Contact head developer [@bredrumb](https://telegram.me/bredrumb) directly on Telegram.
  `;

	return (
		<div className="modal-backdrop">
			<div
				className="modal-content help-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<div className="help-modal-title">
						<h3>Help & Information</h3>
					</div>
					<button className="close-button" onClick={onClose}>
						×
					</button>
				</div>
				<div className="modal-body help-content">
					<div className="logo-container">
						<img
							src="../../../img/gticon.png"
							alt="GengoTavern"
							className="help-modal-logo"
						/>
					</div>
					<MarkdownRenderer content={helpContent} processParentheses={false} />
				</div>
				<div className="modal-footer">
					<div className="startup-preference">
						<label className="hide-at-startup-label">
							<input
								type="checkbox"
								checked={hideAtStartup}
								onChange={handleHideAtStartupChange}
							/>
							<span>Don't show at startup</span>
						</label>
					</div>
					<button className="confirm-button" onClick={onClose}>
						Close
					</button>
				</div>
			</div>
		</div>
	);
};

export default HelpModal;
