# Active Context for Development
This constantly changing file contains the current focus and active issues for the GengoTavern project, along with recent changes and upcoming considerations. It serves as a guide for developers to understand the current state of the project and what areas currently need attention.

## Current Implementation Focus
**New Character Flow Refactor:**
Implement the new character creation modal that replaces the immediate character creation with a choice dialog. When users click the + button in the character selection panel, show a modal with three options:
1. "Empty Character" - Creates a blank character (current behavior)
2. "Character from Image" - Opens the Image-to-Text Character Creator flow (COMPLETED)
3. "Group Chat" - Opens the Group Chat creation flow

This is a foundational change that enables both the Image-to-Text Character Creator and Group Chat features. The modal should be clean, accessible, and set up the infrastructure for the more complex creation flows.
Once the New Character Flow is complete, the next major features in priority order are:
1. **Image-to-Text Character Creator** - Allows users to generate characters from uploaded images using Gemini Vision API (COMPLETED)
2. **Group Chats** - Multi-character conversations with probability-based response systems (UP NEXT)  
3. **Implicit Grammar Correction Module** - Language learning features with grammar feedback

The New Character Flow is the logical foundation that all these features will build upon.

