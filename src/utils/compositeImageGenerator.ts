/**
 * Composite Image Generator for Group Chats
 * Creates dynamic thumbnails by combining member character images
 */

import type { Character } from '../types/interfaces';

interface CompositeLayout {
	width: number;
	height: number;
	positions: Array<{
		x: number;
		y: number;
		width: number;
		height: number;
	}>;
}

/**
 * Get the optimal layout for a given number of characters
 */
function getLayout(memberCount: number): CompositeLayout {
	const canvasSize = 256; // Standard character card size
	
	switch (memberCount) {
		case 2:
			// Side by side layout
			return {
				width: canvasSize,
				height: canvasSize,
				positions: [
					{ x: 0, y: 0, width: canvasSize / 2, height: canvasSize },
					{ x: canvasSize / 2, y: 0, width: canvasSize / 2, height: canvasSize },
				],
			};
		case 3:
			// Triangle layout: 2 on top, 1 on bottom center
			return {
				width: canvasSize,
				height: canvasSize,
				positions: [
					{ x: 0, y: 0, width: canvasSize / 2, height: canvasSize / 2 },
					{ x: canvasSize / 2, y: 0, width: canvasSize / 2, height: canvasSize / 2 },
					{ x: canvasSize / 4, y: canvasSize / 2, width: canvasSize / 2, height: canvasSize / 2 },
				],
			};
		case 4:
			// 2x2 grid layout
			return {
				width: canvasSize,
				height: canvasSize,
				positions: [
					{ x: 0, y: 0, width: canvasSize / 2, height: canvasSize / 2 },
					{ x: canvasSize / 2, y: 0, width: canvasSize / 2, height: canvasSize / 2 },
					{ x: 0, y: canvasSize / 2, width: canvasSize / 2, height: canvasSize / 2 },
					{ x: canvasSize / 2, y: canvasSize / 2, width: canvasSize / 2, height: canvasSize / 2 },
				],
			};
		default:
			// For 5+ characters, use 2x2 with "+" indicator
			return {
				width: canvasSize,
				height: canvasSize,
				positions: [
					{ x: 0, y: 0, width: canvasSize / 2, height: canvasSize / 2 },
					{ x: canvasSize / 2, y: 0, width: canvasSize / 2, height: canvasSize / 2 },
					{ x: 0, y: canvasSize / 2, width: canvasSize / 2, height: canvasSize / 2 },
					{ x: canvasSize / 2, y: canvasSize / 2, width: canvasSize / 2, height: canvasSize / 2 }, // This will be the "+N" overlay
				],
			};
	}
}

/**
 * Load an image from a URL or data URI
 */
function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous'; // Enable CORS for canvas drawing
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

/**
 * Draw an image with smart cropping to fit the target rectangle
 * Uses "cover" behavior - maintains aspect ratio and crops to fill
 */
function drawCroppedImage(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	width: number,
	height: number
) {
	const targetAspect = width / height;
	const sourceAspect = img.width / img.height;

	let sourceX = 0;
	let sourceY = 0;
	let sourceWidth = img.width;
	let sourceHeight = img.height;

	// Crop the source image to match target aspect ratio
	if (sourceAspect > targetAspect) {
		// Source is wider - crop horizontally
		sourceWidth = img.height * targetAspect;
		sourceX = (img.width - sourceWidth) / 2;
	} else {
		// Source is taller - crop vertically  
		sourceHeight = img.width / targetAspect;
		sourceY = (img.height - sourceHeight) / 2;
	}

	// Draw the cropped image
	ctx.drawImage(
		img,
		sourceX, sourceY, sourceWidth, sourceHeight,
		x, y, width, height
	);
}

/**
 * Draw a "+N" overlay for groups with more than 4 members
 */
function drawPlusOverlay(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	additionalCount: number
) {
	// Semi-transparent dark overlay
	ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
	ctx.fillRect(x, y, width, height);

	// White text
	ctx.fillStyle = '#ffffff';
	ctx.font = `bold ${Math.min(width, height) * 0.3}px sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	const text = `+${additionalCount}`;
	ctx.fillText(text, x + width / 2, y + height / 2);
}

/**
 * Generate a composite image from an array of character images
 */
export async function generateCompositeImage(characters: Character[]): Promise<string> {
	if (characters.length === 0) {
		throw new Error('Cannot generate composite image: no characters provided');
	}

	if (characters.length === 1) {
		// For single character, just return their image
		return characters[0].image;
	}

	const layout = getLayout(characters.length);
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		throw new Error('Could not get canvas 2D context');
	}

	canvas.width = layout.width;
	canvas.height = layout.height;

	// Clear canvas with a subtle background
	ctx.fillStyle = '#2a2a2a';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	try {
		// Load all character images
		const characterImages = await Promise.all(
			characters.slice(0, Math.min(4, characters.length)).map(char => loadImage(char.image))
		);

		// Draw each character image
		for (let i = 0; i < characterImages.length; i++) {
			const position = layout.positions[i];
			
			if (i === 3 && characters.length > 4) {
				// Draw the last character image first, then overlay the "+N" indicator
				drawCroppedImage(ctx, characterImages[i], position.x, position.y, position.width, position.height);
				drawPlusOverlay(ctx, position.x, position.y, position.width, position.height, characters.length - 4);
			} else {
				drawCroppedImage(ctx, characterImages[i], position.x, position.y, position.width, position.height);
			}
		}

		// Add subtle borders between images
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
		ctx.lineWidth = 1;
		
		for (const position of layout.positions) {
			ctx.strokeRect(position.x, position.y, position.width, position.height);
		}

		// Convert to data URI
		return canvas.toDataURL('image/png', 0.8);
	} catch (error) {
		console.error('Error generating composite image:', error);
		// Return a fallback image or throw
		throw new Error(`Failed to generate composite image: ${error}`);
	}
}

/**
 * Generate a composite image for a group chat using member character data
 */
export async function generateGroupChatImage(
	groupMembers: Array<{ characterId: number }>,
	allCharacters: Character[]
): Promise<string> {
	// Get character objects for the group members
	const memberCharacters = groupMembers
		.map(member => allCharacters.find(char => char.id === member.characterId))
		.filter((char): char is Character => char !== undefined);

	if (memberCharacters.length === 0) {
		throw new Error('No valid characters found for group chat');
	}

	return generateCompositeImage(memberCharacters);
}

/**
 * Create a placeholder image for when composite generation fails
 */
export function generateFallbackGroupImage(): string {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		// Return a data URI for a simple colored square if canvas fails
		return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iIzQyNDI0MiIvPjx0ZXh0IHg9IjEyOCIgeT0iMTQwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+RpTwvdGV4dD48L3N2Zz4=';
	}

	canvas.width = 256;
	canvas.height = 256;

	// Gray background
	ctx.fillStyle = '#424242';
	ctx.fillRect(0, 0, 256, 256);

	// White group icon (👥)
	ctx.fillStyle = '#ffffff';
	ctx.font = '48px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('👥', 128, 140);

	return canvas.toDataURL('image/png', 0.8);
}