import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface WritingTipsModalProps {
  onClose: () => void;
}

const WritingTipsModal: React.FC<WritingTipsModalProps> = ({ onClose }) => {
  const writingTipsContent = `
### General Tips:
---
- Use the '**Gemini 2.0 Flash Thinking**' model in the API settings for possibly better results, at the cost of slower responses.
- If a message sent by the AI is unsatisfactory, use the **Regenerate** or **Edit** buttons located in the chat bubbles.
    - Editing messages allow you to hard 'steer' the AI into performing actions you want them to take, in which it will play along and learn from.
- Enclose words ** to signify actions through text.
  - *Megumin slowly raised her hand*
  - Use parentheses（ ）instead for Japanese
    - *(めぐみんが手をゆっくりと上げた)*
- Try not to use the first-person or second-person perspective when writing **actions** or **character descriptions** to avoid confusing the AI.
    - *I sighed* ❌ *She sighed* ✅ *Dennis sighed* ✅
    - *You took my hand* ❌ *He took Ahri's hand* ✅ *Yasuo took Ahri's hand* ✅
    - You are a coffeehouse worker ❌ Dave is a coffeehouse worker ✅
    - I'm a dragon ❌ Alice is a dragon ✅
      - Using first-person and second-person is okay when actually uttered by characters: "Hey, I'm a dragon" ✅
- Use the {{user}} and {{char}} placeholders for character creation.
    - Instead of writing the actual names of characters in the character editor,
    use placeholders that update themselves.
        - {{user}} is replaced with your set name in settings
        - {{char}} is replaced with the character's name
            - Bob likes teasing Alice ❌
            - {{char}} likes teasing {{user}} ✅
### Character Creation Tips
---
- **Descriptions**: For simple characters, a single sentence description is enough. 
For more complex characters, be as detailed as you want them to be. 
- **Sample Dialogues**: Write how the character would react to certain questions or actions you do, which the AI will mimic.
It also further gives the AI an idea on your character's personality.
  - To further reinforce the Description, add an example where the {{user}} asks the {{char}} to introduce themselves. 
  - Add desired mannerisms or tendencies through action text.
  - Three examples is the best amount.
  - No examples is only recommended for simple characters.
- **Scenarios**: Gives context to the AI on what the chat is about, or what the current motives of the character/s are.
- **Greetings**: The first ever message of the AI-powered character,
very important along with the Scenario as it sets the context.
- Use the sample characters provided by the developer as reference if needed.
### Language Learning Tips
---
- Install [Yomitan](https://yomitan.wiki/getting-started/) for easy pop-up dictionaries during chat.
- Follow this [Tofugu guide](https://www.tofugu.com/japanese/how-to-install-japanese-keyboard/) to gain Japanese input.
- Descriptions and Scenarios can be English, but Sample Dialogues and Greetings have to be written
in your desired Foreign Language in order for the AI to speak it.
  - Writing everything using your desired Foreign Language will minimize cases where the AI will mix up languages.
- Play with Sample Dialogues in order to create a character that speaks in a way matching your current language proficiency.
- Add parenthesized instructions in the Scenario such as (Use easy Japanese) to further encourage the AI
to communicate at a comprehensible level.
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
