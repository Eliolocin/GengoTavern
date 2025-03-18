import type { Character } from '../types/interfaces';

// PNG signature and chunk-related constants
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const TEXT_CHUNK_TYPE = 'tEXt';
const IEND_CHUNK_TYPE = 'IEND';
const METADATA_KEY = 'GengoTavern';

/**
 * Reads a 4-byte integer from a byte array at a specific position
 */
function readUint32(data: Uint8Array, offset: number): number {
  return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | (data[offset + 3]);
}

/**
 * Writes a 4-byte integer to a byte array at a specific position
 */
function writeUint32(data: Uint8Array, offset: number, value: number): void {
  data[offset] = (value >>> 24) & 0xff;
  data[offset + 1] = (value >>> 16) & 0xff;
  data[offset + 2] = (value >>> 8) & 0xff;
  data[offset + 3] = value & 0xff;
}

/**
 * Converts a string to a byte array
 */
function stringToBytes(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Calculates CRC32 for a chunk
 */
function calculateCRC(data: Uint8Array, offset: number, length: number): number {
  const crcTable: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[i] = c;
  }
  
  let crc = 0xffffffff;
  for (let i = 0; i < length; i++) {
    crc = crcTable[(crc ^ data[offset + i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ 0xffffffff;
}

/**
 * Extracts character data from a PNG file
 */
export async function extractCharacterFromPng(pngFile: File): Promise<Character> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error('Failed to read file'));
        return;
      }
      
      try {
        // Convert to Uint8Array for processing
        const buffer = e.target.result as ArrayBuffer;
        const dataView = new Uint8Array(buffer);
        
        // Verify PNG signature
        if (!verifyPNGSignature(dataView)) {
          throw new Error('Not a valid PNG file');
        }
        
        // Parse chunks to find our metadata
        const metadata = extractMetadataFromPng(dataView);
        
        // Create a blob URL for the image
        const imageUrl = URL.createObjectURL(pngFile);
        
        if (metadata && metadata.character) {
          // Return character data with the image URL
          const characterData = metadata.character || metadata;
          
          // Ensure the character has an ID
          if (!characterData.id) {
            characterData.id = Date.now();
          }
          
          // Ensure the character has a chats array
          if (!characterData.chats) {
            characterData.chats = [];
          }
          
          // Important: Use the PNG itself as the character image
          // This ensures we always have a valid avatar image
          const result = {
            ...characterData,
            image: imageUrl,
            originalFilename: pngFile.name
          };
          
          resolve(result);
        } else {
          // If no metadata found, create a new character from this image
          resolve({
            id: Date.now(),
            name: pngFile.name.replace(/\.[^/.]+$/, ''), // Filename without extension
            image: imageUrl,
            chats: [],  // Always include an empty chats array
            originalFilename: pngFile.name
          });
        }
      } catch (error) {
        console.error('Error extracting character from PNG:', error);
        reject(new Error(`Failed to parse character data: ${error}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsArrayBuffer(pngFile);
  });
}

/**
 * Adds a text chunk to a PNG file
 */
async function addTextChunkToPng(pngBlob: Blob, key: string, text: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target?.result) {
        reject(new Error('Failed to read PNG file'));
        return;
      }

      try {
        const arrayBuffer = e.target.result as ArrayBuffer;
        const data = new Uint8Array(arrayBuffer);
        
        // Verify PNG signature
        if (!verifyPNGSignature(data)) {
          throw new Error('Not a valid PNG file');
        }
        
        // Create the metadata content with format "key\0text"
        const metadataContent = key + '\0' + text;
        
        // Insert the metadata into the PNG
        const newPngData = insertMetadataIntoPng(data, metadataContent);
        
        // Convert back to Blob
        resolve(new Blob([newPngData], { type: 'image/png' }));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read PNG file'));
    reader.readAsArrayBuffer(pngBlob);
  });
}

/**
 * Embeds a character's data into a PNG file
 * Uses the existing PNG file data for the image and injects metadata
 */
export async function embedCharacterIntoPng(character: Character): Promise<Blob> {
  try {
    // Create a clone to prepare the character data for export but exclude image data
    const exportCharacter = prepareCharacterForExport(character);
    
    // IMPORTANT: We'll remove image property from the metadata to avoid duplication
    // Since the image is the PNG itself, there's no need to store it again in the metadata
    delete exportCharacter.image;
    
    let pngBlob: Blob;
    
    // First try to use the character's image if it's a blob or data URL
    if (character.image && (typeof character.image === 'string')) {
      try {
        // Get the image data - this could be a blob URL or data URL
        const response = await fetch(character.image);
        pngBlob = await response.blob();
        
        // Check if we got a valid PNG
        if (!pngBlob || pngBlob.type !== 'image/png') {
          throw new Error('Not a valid PNG');
        }
      } catch (error) {
        // Something went wrong - fall back to placeholder
        console.error('Error using character image, falling back to placeholder:', error);
        throw error; // Let the fallback code handle this
      }
    } else {
      throw new Error('No valid image found');
    }
    
    // Create JSON metadata
    const metadata = {
      version: 1,
      character: exportCharacter
    };
    
    // Convert metadata to text chunk
    const metadataStr = JSON.stringify(metadata);
    
    // Add metadata chunk to PNG
    return await addTextChunkToPng(pngBlob, 'chara', metadataStr);
  } catch (error) {
    console.error('Error embedding character into PNG:', error);
    
    // Use a placeholder image if all else fails
    try {
      // Get a placeholder image from assets
      const placeholderResponse = await fetch('/assets/placeholder.png');
      const placeholderBlob = await placeholderResponse.blob();
      
      // Create metadata without image property
      const exportCharacter = prepareCharacterForExport(character);
      delete exportCharacter.image;
      
      const metadata = {
        version: 1,
        character: exportCharacter
      };
      
      const metadataStr = JSON.stringify(metadata);
      return await addTextChunkToPng(placeholderBlob, 'chara', metadataStr);
    } catch (fallbackError) {
      console.error('Even fallback failed:', fallbackError);
      throw new Error(`Failed to create character PNG: ${error}`);
    }
  }
}

/**
 * Prepares a character for export by creating a deep clone
 * and removing properties we don't want to export
 */
function prepareCharacterForExport(character: Character): any {
  // Properties to exclude from export
  const excludeProperties = ['originalFilename'];
  
  // Create a deep clone of the character
  const clone = JSON.parse(JSON.stringify(character));
  
  // Remove excluded properties
  excludeProperties.forEach(prop => {
    if (prop in clone) {
      delete clone[prop];
    }
  });
  
  // Process chats to handle backgrounds
  if (clone.chats && Array.isArray(clone.chats)) {
    clone.chats = clone.chats.map((chat: any) => {
      // Handle background paths
      if (chat.background && typeof chat.background === 'string' && !chat.background.startsWith('backgrounds/')) {
        // If it's not already a relative path, extract the filename
        const backgroundFilename = chat.background.split('/').pop()?.split('\\').pop();
        if (backgroundFilename) {
          chat.background = `backgrounds/${backgroundFilename}`;
        }
      }
      return chat;
    });
  }
  
  // Handle default background if present
  if (clone.defaultBackground && typeof clone.defaultBackground === 'string' && !clone.defaultBackground.startsWith('backgrounds/')) {
    const backgroundFilename = clone.defaultBackground.split('/').pop()?.split('\\').pop();
    if (backgroundFilename) {
      clone.defaultBackground = `backgrounds/${backgroundFilename}`;
    }
  }
  
  return clone;
}

/**
 * Fetches an image from a URL or blob URL
 * @deprecated This function is currently not used but kept for future use
 */
// @ts-ignore - Kept for future use
async function fetchImage(imageUrl: string): Promise<Blob> {
  // If it's a blob URL or data URL, we need special handling
  if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
    try {
      const response = await fetch(imageUrl);
      return await response.blob();
    } catch (error) {
      console.error("Error fetching blob URL:", error);
      throw new Error("Failed to fetch image from blob URL");
    }
  }
  
  // For static assets
  try {
    const response = await fetch(imageUrl);
    return await response.blob();
  } catch (error) {
    console.error("Error fetching image:", error);
    throw new Error("Failed to fetch image");
  }
}

/**
 * Ensures the image is in PNG format
 */
async function ensurePngFormat(imageBlob: Blob): Promise<Blob> {
  // If it's already a PNG, just return it
  if (imageBlob.type === 'image/png') {
    return imageBlob;
  }
  
  // Convert to PNG using canvas
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);
    
    img.onload = () => {
      URL.revokeObjectURL(url); // Clean up
      
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/png',
          1.0
        );
      } catch (error) {
        reject(new Error(`Canvas conversion error: ${error}`));
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url); // Clean up
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Verifies PNG signature
 */
function verifyPNGSignature(data: Uint8Array): boolean {
  if (data.length < PNG_SIGNATURE.length) return false;
  
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) return false;
  }
  
  return true;
}

/**
 * Extracts metadata from PNG chunks
 */
function extractMetadataFromPng(data: Uint8Array): any {
  let offset = PNG_SIGNATURE.length; // Start after PNG signature
  
  while (offset < data.length) {
    // Read chunk length
    const length = readUint32(data, offset);
    offset += 4;
    
    // Read chunk type
    const chunkType = String.fromCharCode(
      data[offset], 
      data[offset + 1], 
      data[offset + 2], 
      data[offset + 3]
    );
    offset += 4;
    
    // Check for text chunks that might contain character data
    if (chunkType === TEXT_CHUNK_TYPE) {
      // Read the key-value pair
      let keyEnd = offset;
      while (keyEnd < offset + length && data[keyEnd] !== 0) keyEnd++;
      
      const key = String.fromCharCode(...data.slice(offset, keyEnd));
      
      // Check for our metadata or Tavern/SillyTavern format
      if ((key === METADATA_KEY || key === 'chara') && keyEnd + 1 < offset + length) {
        // Extract the value (our JSON data)
        const value = new TextDecoder().decode(data.slice(keyEnd + 1, offset + length));
        console.debug('Raw metadata:', value.substring(0, 50) + '...');
        
        try {
          // Handle various formats of metadata
          let jsonString = value;
          
          // SillyTavern specific format: chara{...json...}
          if (value.startsWith('chara{')) {
            jsonString = value.substring(5); // Remove 'chara' prefix
          }
          
          // Some pngs might have the key repeated in the value
          if (jsonString.startsWith(key)) {
            jsonString = jsonString.substring(key.length);
          }

          // Final attempt if all else fails: find json using regex
          if (jsonString.indexOf('{') !== 0) {
            const match = jsonString.match(/\{.+\}/s);
            if (match) {
              jsonString = match[0];
            }
          }
          
          const parsed = JSON.parse(jsonString);
          
          // Handle different metadata formats
          if (parsed.character) {
            return parsed; // Our format with character property
          } else if (parsed.name && (parsed.avatar || parsed.image)) {
            return parsed; // Likely a Tavern format character
          } else if (parsed.version && parsed.version === 1) {
            return parsed; // Our format from earlier versions
          }
          
          return parsed; // Return whatever we found
        } catch (error) {
          console.error('Error parsing metadata JSON:', error);
          console.debug('Problematic value:', value);
        }
      }
    }
    
    // Move to the next chunk
    offset += length; // Skip chunk data
    offset += 4; // Skip CRC
  }
  
  return null;
}

/**
 * Inserts metadata into PNG by adding a tEXt chunk before IEND
 */
function insertMetadataIntoPng(data: Uint8Array, metadata: string): Uint8Array {
  let offset = PNG_SIGNATURE.length; // Start after PNG signature
  let iendOffset = -1;
  
  // Find the IEND chunk
  while (offset < data.length) {
    const length = readUint32(data, offset);
    offset += 4;
    
    const chunkType = String.fromCharCode(
      data[offset], 
      data[offset + 1], 
      data[offset + 2], 
      data[offset + 3]
    );
    
    if (chunkType === IEND_CHUNK_TYPE) {
      iendOffset = offset - 4; // Store position before IEND chunk
      break;
    }
    
    offset += 4; // Skip chunk type
    offset += length; // Skip chunk data
    offset += 4; // Skip CRC
  }
  
  if (iendOffset === -1) {
    throw new Error('Could not find IEND chunk in PNG');
  }
  
  // Prepare the metadata chunk
  const keyBytes = stringToBytes(METADATA_KEY + '\0');
  const valueBytes = stringToBytes(metadata);
  const chunkData = new Uint8Array(keyBytes.length + valueBytes.length);
  
  chunkData.set(keyBytes, 0);
  chunkData.set(valueBytes, keyBytes.length);
  
  const chunkLength = chunkData.length;
  
  // Create the new PNG with our metadata chunk inserted before IEND
  const newPngSize = data.length + 12 + chunkLength; // 12 bytes for chunk header and CRC
  const newPngData = new Uint8Array(newPngSize);
  
  // Copy everything up to the IEND chunk
  newPngData.set(data.slice(0, iendOffset));
  
  // Insert our chunk
  let writeOffset = iendOffset;
  
  // Write chunk length
  writeUint32(newPngData, writeOffset, chunkLength);
  writeOffset += 4;
  
  // Write chunk type (tEXt)
  const typeBytes = stringToBytes(TEXT_CHUNK_TYPE);
  newPngData.set(typeBytes, writeOffset);
  writeOffset += 4;
  
  // Write chunk data
  newPngData.set(chunkData, writeOffset);
  writeOffset += chunkLength;
  
  // Calculate and write CRC
  const crcData = new Uint8Array(4 + chunkLength);
  crcData.set(typeBytes);
  crcData.set(chunkData, 4);
  const crc = calculateCRC(crcData, 0, crcData.length);
  writeUint32(newPngData, writeOffset, crc);
  writeOffset += 4;
  
  // Copy IEND chunk and everything after
  newPngData.set(data.slice(iendOffset), writeOffset);
  
  return newPngData;
}

/**
 * Saves a character as a PNG file via browser download
 * This should only be used when the "Save as PNG" button is pressed
 */
export async function savePngAsBrowserDownload(character: Character): Promise<void> {
  try {
    // Use the existing character image if possible
    const pngFile = await embedCharacterIntoPng(character);
    
    const a = document.createElement('a');
    a.download = `${character.name || 'character'}.png`;
    a.href = URL.createObjectURL(pngFile);
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (error) {
    console.error('Error saving character as download:', error);
    throw new Error(`Failed to save character: ${error}`);
  }
}

/**
 * Convert a Blob to a data URL
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Interface extension for Character with original filename
 */
declare module '../types/interfaces' {
  interface Character {
    originalFilename?: string;
  }
}
