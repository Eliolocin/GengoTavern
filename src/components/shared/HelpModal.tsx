import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  const helpContent = `
## Welcome to GengoTavern!

GengoTavern is a character-based chat application that lets you create and interact with AI characters.

### Key Features:
- **Character Creation**: Design your own AI characters with unique personalities
- **Chat Interface**: Have conversations with your characters
- **Customization**: Edit character attributes, backgrounds, and more
- **Import/Export**: Share characters as PNG files with embedded data

### Tips:
- Use *italics* for actions during roleplaying
- Create sample dialogues to help shape character responses
- Set custom backgrounds for each chat session

### Need More Help?
Visit our [GitHub repository](https://github.com/yourusername/gengotavern) for documentation and updates.

Made with ❤️ by GengoTavern Team
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
            <img src="/gticon.png" alt="GengoTavern" className="help-modal-logo" />
          </div>
          <MarkdownRenderer content={helpContent} />
        </div>
        <div className="modal-footer">
          <button className="confirm-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;