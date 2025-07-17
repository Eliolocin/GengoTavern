# GengoTavern Project Overview
GengoTavern is a chat application that allows users to create and interact with AI-powered characters. It is designed to be a user-friendly platform for language learners and roleplayers, enabling them to practice conversation through customizable AI companions. 

The project is a derivative of SillyTavern, focusing on enhancing the language learning experience with extra features like sentence correction, pop-up dictionaries, and grammar checkers.

Each AI character can be customized with unique traits and speech styles using Descriptions and Sample Dialogues respectively, and users can import/export these characters as PNG files for sharing. This may also include their image files, which are compressed to ensure efficient storage and transfer.

## 💡 Core Features
- 🌟 Integration with Google Gemini for AI-powered conversations
- 🛠️ User-friendly interface for creating and managing AI characters
- 🔄 Character import/export functionality for sharing

## 📅 Planned Features
- 📘 Language learning modules
- 🗣️ Text-to-Speech and Speech-to-Text capabilities
- 🎨 Visual novel-style chat interface
- 👥 Group chats with multiple characters
- 🖼️ Easy character creator through image-to-text generation
- 💬 Sentiment analysis for character responses and spriting

## 👥 Target Users
- Language Learners trying to practice conversation with AI through roleplay
- Roleplayers looking for a customizable AI companion
- Beginner learners and roleplayers who need a user-friendly interface

## 🔧 Tech Stack
- **TypeScript** for type-checking on compile
- **Vite** as the build tool for fast development
- **React** for building the user interface
- **Bun** as the runtime and tooling manager
- **Biome** for code formatting and linting

## 📦 Project Core Structure (High-Level Overview)
``` plaintext
gengoTavern/
├── src/
│   ├── components/     # Reusable UI components, split by the three main panes
│   │   ├── characterSelection/         # Left pane, character selection and management
│   │   ├── chatInterface/              # Middle pane, chat interface, message handling, and settings tabs
│   │   └── characterCustomization/     # Right pane, character customization 
│   ├── contexts/       # React context providers for state management
│   ├── pages/          # Main page components
│   ├── styles/         # CSS modules
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions and helpers
│   └── assets/         # Static assets
├── img/            # Public images
├── user/           # User-specific data
│   ├── characters/     # Character storage
│   └── backgrounds/    # Background images
├─ biome.json       ← formatter/linter config
└─ README.md        ← project overview
```