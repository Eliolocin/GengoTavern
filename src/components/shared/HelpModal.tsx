import React, { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface HelpModalProps {
  onClose: () => void;
  onHideAtStartupChange?: (hideAtStartup: boolean) => void;
  initialHideAtStartup?: boolean;
}

const HelpModal: React.FC<HelpModalProps> = ({ 
  onClose, 
  onHideAtStartupChange,
  initialHideAtStartup = false 
}) => {
  const [hideAtStartup, setHideAtStartup] = useState(initialHideAtStartup);

  const handleHideAtStartupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setHideAtStartup(newValue);
    if (onHideAtStartupChange) {
      onHideAtStartupChange(newValue);
    }
  };

  const helpContent = `
## Welcome to GengoTavern!

GengoTavern is a chat application that lets you create and interact with your very own characters, powered by AI. It aims to be a more Language Learning focused derivative of [SillyTavern](https://github.com/SillyTavern/SillyTavern), helping casual users practice conversation with custom characters through a user-friendly interface with tools such as sentence correction, pop-up dictionaries, and grammar checkers.

### Getting Started:
1. **Input an API Key**: Head over to the 🔑 **API Tab**  for instructions
2. **Modify your Profile**: Add your name/description at the 🎭 **Persona Tab**
3. **Create a Character**: Refer to the ✍️ **Writing Tips Tab** for help
4. **Start Chatting**: Create a new chat of your character to start messaging
5. **Import/Export**: Share characters as PNG files with other users

### Writing Tips:
- Enclose words in () or ** to signify actions through text
  - *Megumin slowly raised her hand*
  - *(めぐみんがゆっくりと手を上げた)*
- Do not use first-person pronouns when writing actions or descriptions

### Need Help?
- Join the [Discord Server](ewqe) for instant support regarding usage and bugs.
- Visit the [GitHub Repository](https://github.com/eliolocin/gengotavern) for updates on new versions.

  `;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="help-modal-title">
            <h3>Help & Information</h3>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body help-content">
          <div className="logo-container">
            
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
          <button className="confirm-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;