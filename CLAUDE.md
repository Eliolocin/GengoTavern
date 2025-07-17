# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

- `bun install` - Install dependencies
- `bun run dev` - Start development server with Vite
- `bun run build` - Build for production (creates single HTML file in dist/, renamed to GengoTavern.html)
- `bun run lint` - Run ESLint
- `bun run preview` - Preview production build

## Project Architecture

GengoTavern is a React-based chat application for language learning with AI characters. The app uses a dual storage strategy: File System Access API for desktop or localStorage fallback.

### Key Architecture Patterns

**Context-Based State Management:**
- `AppContext` - Application-wide state (storage strategy, panels, modals)
- `CharacterContext` - Character management and CRUD operations
- `UserSettingsContext` - User preferences and API keys

**Storage Strategy:**
- `StorageManager` class handles dual storage: filesystem (File System Access API) vs localStorage
- Automatically migrates between storage strategies
- Characters stored as PNG files with embedded JSON metadata
- Backgrounds and sprites stored in organized directory structure

**Component Organization:**
- `src/components/` - React components organized by feature
- `src/contexts/` - React contexts for state management
- `src/utils/` - Utility functions and API clients
- `src/types/` - TypeScript interfaces

### Critical Files

**Core Application:**
- `src/pages/App.tsx` - Main application component with chat functionality
- `src/utils/storageManager.ts` - Dual storage strategy implementation
- `src/utils/geminiAPI.ts` - Google Gemini API client
- `src/utils/promptBuilder.ts` - Chat prompt construction
- `src/utils/emotionClassifier.ts` - Multilingual sentiment analysis for visual novel mode

**Configuration:**
- `vite.config.ts` - Vite configuration with single-file plugin
- `biome.json` - Biome formatter configuration (tabs, double quotes)
- `eslint.config.js` - ESLint configuration

### Key Features

**AI Integration:**
- Google Gemini API for chat responses
- Hugging Face Transformers for multilingual sentiment analysis
- Visual novel mode with sentiment-based sprites (very_negative, negative, neutral, positive, very_positive)

**Storage Systems:**
- File System Access API for desktop file management
- PNG metadata embedding for character import/export
- Automatic migration between storage strategies

**Language Learning Focus:**
- Character-based conversation practice
- Emotion detection for immersive experience
- Export/import functionality for character sharing

### Development Notes

- Uses Bun as package manager and runtime
- React 19 with TypeScript
- Vite for development and building
- Single-file output for easy distribution
- Mobile-responsive design with collapsible panels

### Common Patterns

**Character Management:**
- Characters stored with chats, sprites, and metadata
- Each character can have multiple chat sessions
- PNG files contain embedded character data

**Message Handling:**
- Messages support editing, regeneration, and continuation
- Error messages are handled separately with delete functionality
- Sentiment analysis happens asynchronously using multilingual model

**Emotion/Sentiment System:**
- Uses `tabularisai/multilingual-sentiment-analysis` model
- Five sentiment levels: very_negative, negative, neutral, positive, very_positive
- Sprites are organized by sentiment level for visual novel mode
- Default fallback sentiment is "positive"

**File Operations:**
- Always check storage strategy before file operations
- Handle both filesystem and localStorage fallbacks
- Use sanitized filenames for cross-platform compatibility