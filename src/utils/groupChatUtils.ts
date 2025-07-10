/**
 * Utility functions for Group Chat operations
 * Provides type-safe helpers and operations for managing group chats
 */

import type { Character, GroupMember, Message } from '../types/interfaces';

/**
 * Type guard to check if a character is a group chat
 */
export function isGroupChat(character: Character): boolean {
	return character.type === 'group';
}

/**
 * Type guard to check if a character is an individual character
 */
export function isIndividualCharacter(character: Character): boolean {
	return character.type !== 'group';
}

/**
 * Get the character type, defaulting to 'individual' for backward compatibility
 */
export function getCharacterType(character: Character): 'individual' | 'group' {
	return character.type || 'individual';
}

/**
 * Create a new group chat character with the specified members
 */
export function createGroupChat(
	name: string,
	members: GroupMember[],
	compositeImage?: string
): Character {
	return {
		id: Date.now(),
		name,
		image: compositeImage || '', // Will be generated later
		type: 'group',
		members,
		chats: [],
		groupCompositeImage: compositeImage,
	};
}

/**
 * Get all member character IDs from a group chat
 */
export function getGroupMemberIds(groupChat: Character): number[] {
	if (!isGroupChat(groupChat) || !groupChat.members) {
		return [];
	}
	return groupChat.members.map(member => member.characterId);
}

/**
 * Get member by character ID from a group chat
 */
export function getGroupMember(groupChat: Character, characterId: number): GroupMember | undefined {
	if (!isGroupChat(groupChat) || !groupChat.members) {
		return undefined;
	}
	return groupChat.members.find(member => member.characterId === characterId);
}

/**
 * Update response probability for a specific member in a group chat
 */
export function updateMemberProbability(
	groupChat: Character,
	characterId: number,
	probability: number
): Character {
	if (!isGroupChat(groupChat) || !groupChat.members) {
		return groupChat;
	}

	const updatedMembers = groupChat.members.map(member =>
		member.characterId === characterId
			? { ...member, responseProbability: Math.max(0, Math.min(100, probability)) }
			: member
	);

	return {
		...groupChat,
		members: updatedMembers,
	};
}

/**
 * Add a member to a group chat
 */
export function addGroupMember(
	groupChat: Character,
	characterId: number,
	probability: number = 50,
	displayOrder?: number
): Character {
	if (!isGroupChat(groupChat)) {
		return groupChat;
	}

	const members = groupChat.members || [];
	const finalDisplayOrder = displayOrder ?? members.length;

	const newMember: GroupMember = {
		characterId,
		responseProbability: Math.max(0, Math.min(100, probability)),
		displayOrder: finalDisplayOrder,
	};

	return {
		...groupChat,
		members: [...members, newMember],
	};
}

/**
 * Remove a member from a group chat
 */
export function removeGroupMember(groupChat: Character, characterId: number): Character {
	if (!isGroupChat(groupChat) || !groupChat.members) {
		return groupChat;
	}

	const updatedMembers = groupChat.members.filter(member => member.characterId !== characterId);

	return {
		...groupChat,
		members: updatedMembers,
	};
}

/**
 * Get members sorted by display order for rendering
 */
export function getOrderedGroupMembers(groupChat: Character): GroupMember[] {
	if (!isGroupChat(groupChat) || !groupChat.members) {
		return [];
	}

	return [...groupChat.members].sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Check if a message contains any character names (case-insensitive)
 * Returns array of character IDs whose names are mentioned
 */
export function detectNameTriggers(
	message: string,
	groupChat: Character,
	allCharacters: Character[]
): number[] {
	if (!isGroupChat(groupChat) || !groupChat.members) {
		return [];
	}

	const triggeredCharacters: number[] = [];
	const messageText = message.toLowerCase();

	for (const member of groupChat.members) {
		// Find the character by ID
		const character = allCharacters.find(c => c.id === member.characterId);
		if (!character) continue;

		// Check if character name is mentioned in message (case-insensitive)
		// Use word boundaries to avoid partial matches, but handle multi-word names
		const characterName = character.name.toLowerCase().trim();
		
		// Skip empty names
		if (!characterName) continue;
		
		const escapedName = characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
		
		// For multi-word names, we need to match the full name sequence
		// But still use word boundaries on the edges
		const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
		const isTriggered = nameRegex.test(messageText);
		
		console.log(`Name trigger check for ${character.name} (${member.characterId}):`, {
			characterName,
			messageText,
			isTriggered,
			regex: nameRegex.toString()
		});
		
		if (isTriggered) {
			triggeredCharacters.push(member.characterId);
		}
	}

	return triggeredCharacters;
}

/**
 * Calculate response queue based on our agreed design:
 * - User messages: guaranteed response with mutually exclusive probabilities
 * - Character messages: chance-based with no fallback
 * - Name triggers: characters mentioned by name are added to queue
 * - Self-response prevention: characters can't respond to themselves
 */
export function calculateResponseQueue(
	groupChat: Character,
	message: string,
	isUserMessage: boolean,
	lastSpeakerId?: number,
	allCharacters?: Character[]
): number[] {
	if (!isGroupChat(groupChat) || !groupChat.members) {
		return [];
	}

	const responseQueue: number[] = [];
	let validNameTriggers: number[] = [];

	// 1. Check for name-based triggers first
	if (allCharacters) {
		const nameTriggered = detectNameTriggers(message, groupChat, allCharacters);
		// Exclude the last speaker from name triggers (prevent self-response)
		validNameTriggers = nameTriggered.filter(id => id !== lastSpeakerId);
		
		console.log('Name trigger analysis:', {
			message,
			nameTriggered,
			lastSpeakerId,
			validNameTriggers
		});
		
		responseQueue.push(...validNameTriggers);
	}

	// 2. Calculate probability-based responses
	const eligibleMembers = groupChat.members.filter(member => {
		// Exclude last speaker (prevent self-response)
		if (member.characterId === lastSpeakerId) {
			console.log(`Excluding ${member.characterId} from probability - is last speaker`);
			return false;
		}
		// Exclude already triggered characters (prevent double response)
		if (responseQueue.includes(member.characterId)) {
			console.log(`Excluding ${member.characterId} from probability - already in queue`);
			return false;
		}
		return true;
	});

	console.log('Eligible members for probability response:', {
		allMembers: groupChat.members.map(m => m.characterId),
		lastSpeakerId,
		currentQueue: responseQueue,
		eligibleMembers: eligibleMembers.map(m => m.characterId)
	});

	if (eligibleMembers.length > 0) {
		if (isUserMessage) {
			// User messages: Use normalized probabilities to guarantee exactly one response
			const totalProbability = eligibleMembers.reduce((sum, member) => sum + member.responseProbability, 0);
			
			if (totalProbability > 0) {
				const randomValue = Math.random() * totalProbability;
				let cumulativeProbability = 0;
				
				for (const member of eligibleMembers) {
					cumulativeProbability += member.responseProbability;
					if (randomValue <= cumulativeProbability) {
						responseQueue.push(member.characterId);
						break;
					}
				}
			}
			
			// Fallback: if no probability-based character was selected (all 0% or selection failed)
			const queueLengthBeforeProbability = validNameTriggers.length;
			const probabilityResponseAdded = responseQueue.length > queueLengthBeforeProbability;
			
			if (!probabilityResponseAdded) {
				const maxProbability = Math.max(...eligibleMembers.map(m => m.responseProbability));
				const highestProbMembers = eligibleMembers.filter(
					m => m.responseProbability === maxProbability
				);
				
				// If tie, pick member with lowest display order (highest priority)
				const chosenMember = highestProbMembers.reduce((prev, current) => 
					prev.displayOrder < current.displayOrder ? prev : current
				);
				responseQueue.push(chosenMember.characterId);
			}
		} else {
			// Character messages: Use individual probability checks, no fallback
			for (const member of eligibleMembers) {
				const shouldRespond = Math.random() * 100 < member.responseProbability;
				if (shouldRespond) {
					responseQueue.push(member.characterId);
				}
			}
		}
	}

	// 3. Sort response queue by display order for consistent ordering
	const sortedQueue = responseQueue.sort((a, b) => {
		const memberA = groupChat.members?.find(m => m.characterId === a);
		const memberB = groupChat.members?.find(m => m.characterId === b);
		if (!memberA || !memberB) return 0;
		return memberA.displayOrder - memberB.displayOrder;
	});

	console.log('Final calculateResponseQueue result:', {
		message: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
		isUserMessage,
		lastSpeakerId,
		nameTriggered: validNameTriggers,
		finalQueue: sortedQueue
	});

	return sortedQueue;
}

/**
 * Combine multiple character descriptions for prompt assembly
 */
export function combineCharacterPrompts(
	characters: Character[],
	excludeGroupChats: boolean = true
): string {
	const validCharacters = excludeGroupChats 
		? characters.filter(char => !isGroupChat(char))
		: characters;

	const prompts: string[] = [];

	for (const character of validCharacters) {
		let prompt = `Character: ${character.name}\n`;
		
		if (character.description) {
			prompt += `Description: ${character.description}\n`;
		}

		if (character.sampleDialogues && character.sampleDialogues.length > 0) {
			prompt += 'Sample Dialogues:\n';
			for (const dialogue of character.sampleDialogues) {
				// Replace {{char}} with actual character name
				const userText = dialogue.user.replace(/\{\{char\}\}/g, character.name);
				const charText = dialogue.character.replace(/\{\{char\}\}/g, character.name);
				prompt += `User: ${userText}\n${character.name}: ${charText}\n`;
			}
		}

		prompts.push(prompt);
	}

	return prompts.join('\n---\n');
}

/**
 * Get the last speaker from a message history
 * Returns character ID for character messages, or special value for user messages
 */
export function getLastSpeaker(messages: Message[]): { speakerId?: number; isUser: boolean } {
	// Look for the most recent message that's either user or character
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message.sender === 'character' && message.speakerId) {
			return { speakerId: message.speakerId, isUser: false };
		}
		if (message.sender === 'user') {
			return { speakerId: undefined, isUser: true };
		}
	}
	return { speakerId: undefined, isUser: false };
}

/**
 * Move a member up in the display order (decrease display order number)
 */
export function moveGroupMemberUp(groupChat: Character, characterId: number): Character {
	if (!isGroupChat(groupChat) || !groupChat.members) {
		return groupChat;
	}

	const members = [...groupChat.members];
	const targetMember = members.find(m => m.characterId === characterId);
	
	if (!targetMember || targetMember.displayOrder <= 0) {
		// Already at the top or not found
		return groupChat;
	}

	// Find the member that's currently one position above
	const memberAbove = members.find(m => m.displayOrder === targetMember.displayOrder - 1);
	
	if (!memberAbove) {
		// No member above, shouldn't happen but safety check
		return groupChat;
	}

	// Swap display orders
	const temp = targetMember.displayOrder;
	targetMember.displayOrder = memberAbove.displayOrder;
	memberAbove.displayOrder = temp;

	return {
		...groupChat,
		members: members
	};
}

/**
 * Move a member down in the display order (increase display order number)
 */
export function moveGroupMemberDown(groupChat: Character, characterId: number): Character {
	if (!isGroupChat(groupChat) || !groupChat.members) {
		return groupChat;
	}

	const members = [...groupChat.members];
	const targetMember = members.find(m => m.characterId === characterId);
	
	if (!targetMember || targetMember.displayOrder >= members.length - 1) {
		// Already at the bottom or not found
		return groupChat;
	}

	// Find the member that's currently one position below
	const memberBelow = members.find(m => m.displayOrder === targetMember.displayOrder + 1);
	
	if (!memberBelow) {
		// No member below, shouldn't happen but safety check
		return groupChat;
	}

	// Swap display orders
	const temp = targetMember.displayOrder;
	targetMember.displayOrder = memberBelow.displayOrder;
	memberBelow.displayOrder = temp;

	return {
		...groupChat,
		members: members
	};
}

/**
 * Validate group chat configuration
 */
export function validateGroupChat(groupChat: Character): string[] {
	const errors: string[] = [];

	if (!isGroupChat(groupChat)) {
		errors.push('Character is not a group chat');
		return errors;
	}

	if (!groupChat.members || groupChat.members.length < 2) {
		errors.push('Group chat must have at least 2 members');
	}

	if (groupChat.members) {
		// Check for duplicate character IDs
		const characterIds = groupChat.members.map(m => m.characterId);
		const uniqueIds = new Set(characterIds);
		if (uniqueIds.size !== characterIds.length) {
			errors.push('Group chat contains duplicate members');
		}

		// Check for invalid probabilities
		for (const member of groupChat.members) {
			if (member.responseProbability < 0 || member.responseProbability > 100) {
				errors.push(`Invalid probability for member ${member.characterId}: ${member.responseProbability}`);
			}
		}
	}

	return errors;
}