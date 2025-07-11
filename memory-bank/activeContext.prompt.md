# Active Context for Development
This constantly changing file contains the current focus and active issues for the GengoTavern project, along with recent changes and upcoming considerations. It serves as a guide for developers to understand the current state of the project and what areas currently need attention.

## Recent Changes
**Group Chat Feature Development:**
The Group Chat feature is now **100% COMPLETE** ✅ including Visual Novel Mode integration!
This feature allows users to engage in group conversations with multiple characters, enhancing the interactive storytelling experience.
**CSS Refactoring and UI Polish (Component-by-Component Approach)**

## Current Implementation Focus
**Implicit Grammar Correction** (NOT YET STARTED)
1. The first experimental language learning module. Implicitly corrects a user's grammar mistakes. Whenever a user sends a message, it will first go through another LLM acting as a grammar tutor before it is sent to the roleplaying LLM playing the character. If the tutor LLM catches a grammar mistake in the message, it will send a System message in the chat (with a static message reminding that the user can edit their messages). If there is no grammar mistake, no system message happens and the message will be sent as-is to the roleplaying LLM (basically the tutor is just an extra layer)
2. Can be toggled right above the chatInterface chat box (beside the Visual Novel Toggle). Has three modes: Off (default), Implicit Feedback, Narrative Suggestion
3. Implicit Feedback sends implicit feedback through the form of conversational recast. Example: "I likes tea" is detected as a grammar mistake, the tutor LLM would send a response "Ohh, You like tea, I see" (requires prompt engineering)
4. Narrative Suggestion sends implicit feedback in the form of role-playing suggestions. This is unique such that it would also correct the user's role-playing, not just their grammar, so it's two birds with one stone, as well as masks language mistakes as fun suggestions. For instance: "I likes tea" is detected as a grammar mistake that the tutor LLM would reply: "How about, "I like tea, Lilim, how about you ...? " That would also encourage Lilim to open up more!" (requires prompt engineering)

