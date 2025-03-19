import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface WritingTipsModalProps {
  onClose: () => void;
}

const WritingTipsModal: React.FC<WritingTipsModalProps> = ({ onClose }) => {
  const writingTipsContent = `
## Character Writing Tips

### Creating Compelling Characters
- **Consistent Personality**: Define clear personality traits and ensure they remain consistent
- **Unique Voice**: Create a distinct speaking style that reflects the character's background
- **Detailed Backstory**: Develop a rich history to inform the character's behaviors and motivations
- **Clear Motivations**: Establish what drives your character and informs their decisions

### Sample Dialogue Best Practices
- Include 3-5 dialogue examples to establish the character's voice
- Showcase different emotional states (happy, sad, angry, etc.)
- Demonstrate how they react to different situations
- Include examples of their typical speaking patterns and vocabulary

### Writing Effective Prompts
- Be specific in your instructions while chatting
- Use clear language to guide the conversation
- Specify the context or setting when needed
- Ask open-ended questions to encourage detailed responses

### Language Learning Focus
- Create characters with different language proficiency levels
- Include language-specific idioms or expressions in their dialogue
- Consider creating characters who can help correct grammar or explain cultural nuances
- Design characters who can adjust their language complexity based on the user's needs
  `;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="help-modal-title">
            <h3>Writing Tips</h3>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body help-content">
          <MarkdownRenderer content={writingTipsContent} processParentheses={false} />
        </div>
        <div className="modal-footer">
          <button className="confirm-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default WritingTipsModal;
