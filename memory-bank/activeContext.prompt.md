# Active Context for Development
This constantly changing file contains the current focus and active issues for the GengoTavern project, along with recent changes and upcoming considerations. It serves as a guide for developers to understand the current state of the project and what areas currently need attention.

## Recent Changes
**Group Chat Feature Development:**
The Group Chat feature is now **100% COMPLETE** ✅ including Visual Novel Mode integration!
This feature allows users to engage in group conversations with multiple characters, enhancing the interactive storytelling experience.

**CSS Refactoring and UI Polish (Component-by-Component Approach)**
Component-level CSS improvements have been completed.

## Current Implementation Focus
**Implicit Grammar Correction - Language Learning Module** (STARTING IMPLEMENTATION)

### Overview
The first experimental language learning module that provides grammar and roleplay feedback through async dual-LLM processing. Features two correction modes with seamless UX integration via pop-up notifications.

### Core Architecture & Message Flow

**Current Flow (without correction):**
1. User sends message → save to storage
2. Build roleplay prompt → send to LLM
3. Receive response → process → display → save to storage

**New Flow (with correction enabled):**
1. User sends message → save to storage
2. Build roleplay prompt → send to **TWO LLMs simultaneously** (async):
   - **Roleplay LLM** (standard behavior)
   - **Tutor LLM** (with structured output for corrections)
3. **Roleplay path:** Receive → process → display immediately → save
4. **Tutor path:** Receive → process → show pop-up on user message if confidence is high → save tutor data

### UI Integration
**Toggle Location:** Row beside "Visual Novel Mode" button above chat input
**Three Modes:** Off (default) | Implicit Feedback | Narrative Suggestion
**Feedback Display:** Pop-up appears on left side of user messages (async, dismissible with 'X' button)

### Tutor LLM Structured Output Schema
Using Gemini's Structured Output format with the following JSON schema:

```typescript
interface TutorResponse {
  original_text: string;           // Required: User's original message
  text_language: string;           // Required: Detected language (English, Japanese, etc.)
  has_mistake: boolean;            // Required: Whether mistakes were found
  grammar_mistakes?: GrammarMistakeType[];  // Optional: Array of grammar error types
  roleplay_mistakes?: RoleplayMistakeType[]; // Optional: Only for Narrative Suggestion mode
  system_message?: string;         // Optional: Message to show user (empty if no mistakes)
  confidence_score?: number;       // Optional: 0-1 confidence in corrections
}
```

**Grammar Mistake Types:**
`spelling`, `grammar`, `syntax`, `vocabulary`, `formality`, `punctuation`, `conjugation`, `homophone_confusion`

**Roleplay Mistake Types (Narrative Suggestion only):**
`out_of_character`, `ignored_context`, `inconsistent_tone`, `derailed_topic`, `too_short`, `repetition`, `meta_language`, `setting_violation`, `character_overlap`, `unclear_intent`

### Example Responses

**Narrative Suggestion:**
```json
{
  "original_text": "I likes tea. *grins while hiding my sword under cloak*",
  "text_language": "English",
  "has_mistake": true,
  "grammar_mistakes": ["grammar"],
  "roleplay_mistakes": ["inconsistent_tone", "out_of_character"],
  "system_message": "How about: 'I like tea... but I'm not here to chit-chat.' *She grins, her hand tightening around the hilt beneath her cloak.* Want to try rephrasing it like this? That way, it fits your character's mysterious vibe more!"
}
```

**Implicit Feedback:**
```json
{
  "original_text": "I likes tea. *grins while hiding my sword under cloak*",
  "text_language": "English",
  "has_mistake": true,
  "grammar_mistakes": ["grammar"],
  "system_message": "Oh, you like tea? Me too~ Green tea especially on rainy days!"
}
```

### Implementation Phases

**Phase 0: Documentation & Planning** ✅
- Update active context with comprehensive plan
- Define all data structures and schemas

**Phase 1: Foundation (1-2 days)** ✅
- Grammar correction context + settings storage
- ChatInput toggle UI component (3-state toggle)
- Basic tutor API client structure

**Phase 2: Core Logic (2-3 days)**
- Structured output tutor prompts with conditional roleplay_mistakes
- Message flow integration in App.tsx (dual async LLM calls)
- Pop-up UI component with dismiss functionality

**Phase 3: Polish (1-2 days)**
- Error handling + edge cases
- Storage persistence for tutor data

### Main Implementation Considerations

| Area | Why It Matters | Quick Checklist / Tips |
|------|---------------|------------------------|
| **Latency & UX timing** | Gemini ≠ instant; pop-ups might appear after user moves on | • Add "✏️ checking…" micro-spinner on user bubble (max 5s)<br>• Pop-up appears when ready, even if chat scrolled |
| **Token limits** | Tutor prompt ≈ Roleplay prompt + schema = potential 30-60k tokens | • Trim chat history for Tutor to last 6 messages instead of full conversation |
| **Concurrency quirks** | Messages may arrive out of order | • Save tutor result keyed to `message_id`<br>• Discard tutor result if user edits original message |
| **Thread-safety in storage** | Async writes can clash | • Queue disk writes; make them atomic using `await` with mutex |
| **Dismissed pop-ups** | Flag must persist per message and survive reload | • Add `tutorDismissed: boolean` inside each message object |
| **Structured-output validation** | Tutor might hallucinate keys | • JSON.parse try/catch; silently discard invalid responses |
| **Roleplay vs Grammar toggle** | Only Narrative Suggestion needs `roleplay_mistakes` | • Build tutor prompt with conditional block based on mode |
| **Accessibility** | Pop-up placement for screen readers | • Add `aria-describedby` linking pop-up to bubble<br>• Ensure dismiss button is keyboard-focusable |
| **Fail-open behavior** | Tutor outage shouldn't block chat | • If tutor request throws, skip pop-up; log once per session |

### Integration Points in Existing Codebase

**Key Files to Modify:**
- `src/pages/App.tsx:714` - `handleSendMessage` function (main integration point)
- `src/components/chatInterface/ChatInput.tsx` - Add 3-state toggle UI
- `src/contexts/UserSettingsContext.tsx` - Add grammar correction settings
- `src/utils/geminiAPI.ts` - Add tutor-specific API functions

**New Files to Create:**
- `src/contexts/GrammarCorrectionContext.tsx` - Manage correction state
- `src/utils/grammarTutor.ts` - Tutor logic and prompt building
- `src/types/grammarCorrection.ts` - Type definitions
- `src/components/chatInterface/TutorPopup.tsx` - Pop-up component

**Key Behavioral Notes:**
- Tutoring only applies to user messages, never character responses
- Feature defaults to "Off" mode for backward compatibility
- Pop-ups are dismissible and persist dismissal state in message objects
- Async processing ensures conversation flow is never blocked by tutor calls

