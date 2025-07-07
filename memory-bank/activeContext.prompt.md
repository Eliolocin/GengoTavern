# Active Context for Development
This constantly changing file contains the current focus and active issues for the GengoTavern project, along with recent changes and upcoming considerations. It serves as a guide for developers to understand the current state of the project and what areas currently need attention.

## Current Implementation Focus
Final polish for Visual Novel mode:
Our current emotion classifier only works for English, which prevents accurate emotions for different languages. Let's change it to the following model instead:
`tabularisai/multilingual-sentiment-analysis`

But this new model uses different emotions, therefore we have to change all instances of the old emotions (sadness, joy, love, anger, fear, surprise) into: (very_negative (0), negative (1), neutral (2), positive (3), very positive (4)). This also means some adjustments to the sprite manager in the character form as the new model utilizes only 5 emotions, instead of 6, as well as fixes to the naming conventions for fetching and saving of sprites (use very_negative, etc. instead of the old names now).

## Recent Changes
- ✅ **Visual Novel Mode Implementation (COMPLETED)**
  - ✅ Storage foundation complete and refactored
  - ✅ Background management system successfully implemented with reference-based storage
  - ✅ Emotion classification system fully integrated into chat flow
  - ✅ **FIXED: HuggingFace API key access issue**
  - ✅ **FIXED: Message display delay issue**
  - ✅ **FIXED: Emotion classification parsing bug**
  - ✅ **IMPLEMENTED: Visual Novel Mode (COMPLETED)**
    - ✅ Sprite management system with emotion-based sprites
    - ✅ Visual Novel toggle in chat input area
    - ✅ Visual Novel display mode with character sprites and dialogue box
    - ✅ Sprite upload and management UI
    - ✅ Proper z-index layering for UI elements
    - ✅ Fixed sprite positioning below header
    - ✅ Ensured toggle button visibility
    - ✅ **OPTIMIZED: Disabled emotion classifier during Chat mode (saves API call limits)**
    - ✅ **IMPROVED: Added fade in/out transitions for sprite changes**


