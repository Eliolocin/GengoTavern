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
  return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
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
    // First, create a data URL for the image (as fallback if no metadata found)
    const imageReader = new FileReader();
    imageReader.onload = (imageEvent) => {
      const imageDataUrl = imageEvent.target?.result as string;
      
      // Now read the file as array buffer to extract metadata
      const metadataReader = new FileReader();
      metadataReader.onload = (e) => {
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
          
          if (metadata) {
            // If we have metadata with an image in base64 format, preserve it
            const originalImage = metadata.image && typeof metadata.image === 'string' && 
                                 metadata.image.startsWith('data:') ? metadata.image : imageDataUrl;
            
            // Return character data, preserving the original base64 image
            resolve({
              ...metadata,
              image: originalImage,
              originalFilename: pngFile.name
            });
          } else {
            // If no metadata found, create a new character from this image
            resolve({
              id: Date.now(),
              name: pngFile.name.replace(/\.[^/.]+$/, ''), // Filename without extension
              image: imageDataUrl, // Use data URL instead of blob
              chats: [],
              originalFilename: pngFile.name
            });
          }
        } catch (error) {
          reject(new Error(`Failed to parse character data: ${error}`));
        }
      };
      
      metadataReader.onerror = (event) => {
        console.error('PNG metadata read error for file:', pngFile.name, event);
        reject(new Error(`Error reading PNG metadata from file: ${pngFile.name}`));
      };
      metadataReader.readAsArrayBuffer(pngFile);
    };
    
    imageReader.onerror = () => reject(new Error('Error reading image file'));
    imageReader.readAsDataURL(pngFile);
  });
}

/**
 * Embeds character data into a PNG file with options for what to include
 */
export async function embedCharacterIntoPng(
  character: Character,
  options: { includeChats?: boolean; includeBackground?: boolean } = { includeChats: true, includeBackground: true }
): Promise<File> {
  try {
    // First, ensure we have the character image in base64 format
    let imageBase64 = character.image;
    if (!imageBase64.startsWith('data:')) {
      // Convert to base64 if not already
      imageBase64 = await imageUrlToBase64(character.image);
    }
    
    // Get the image data
    const imageBlob = await fetchImage(character.image);
    
    // Convert to PNG if not already a PNG
    const pngBlob = await ensurePngFormat(imageBlob);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (!e.target?.result) {
          reject(new Error('Failed to read image file'));
          return;
        }
        
        try {
          // Convert to Uint8Array for processing
          const buffer = e.target.result as ArrayBuffer;
          const dataView = new Uint8Array(buffer);
          
          // Create a clone of character data, including the base64 image
          const characterDataToEmbed = {
            id: character.id,
            name: character.name,
            image: imageBase64, // Include the base64 image data
            description: character.description || '',
            defaultGreeting: character.defaultGreeting || '',
            defaultScenario: character.defaultScenario || '',
            defaultBackground: options.includeBackground ? character.defaultBackground || '' : '',
            sampleDialogues: character.sampleDialogues ? [...character.sampleDialogues] : [],
            chats: options.includeChats ? character.chats ? [...character.chats] : [] : [],
          };
          
          // Convert to JSON
          const metadataText = JSON.stringify(characterDataToEmbed);
          
          // Insert metadata into the PNG
          const newPngData = insertMetadataIntoPng(dataView, metadataText);
          
          // Create a new File object with the modified PNG data
          const newFile = new File([newPngData], `${character.name}.png`, { 
            type: 'image/png',
            lastModified: Date.now() 
          });
          
          resolve(newFile);
        } catch (error) {
          reject(new Error(`Failed to embed character data: ${error}`));
        }
      };
      
      reader.onerror = () => reject(new Error('Error reading image file'));
      reader.readAsArrayBuffer(pngBlob);
    });
  } catch (error) {
    throw new Error(`Failed to process image: ${error}`);
  }
}

/**
 * Convert an image URL (blob or regular) to a base64 data URL
 */
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  // If it's already a data URL, return it
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  
  // Otherwise, fetch it and convert to base64
  try {
    const blob = await fetchImage(imageUrl);
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(new Error('Failed to convert image to base64'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw new Error(`Failed to convert image to base64: ${error}`);
  }
}

/**
 * Fetches an image from a URL or blob URL
 */
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
function extractMetadataFromPng(data: Uint8Array): Character | null {
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
    
    // If it's a text chunk, check for our metadata
    if (chunkType === TEXT_CHUNK_TYPE) {
      // Read the key-value pair
      let keyEnd = offset;
      while (keyEnd < offset + length && data[keyEnd] !== 0) keyEnd++;
      
      const key = String.fromCharCode(...data.slice(offset, keyEnd));
      
      if (key === METADATA_KEY && keyEnd + 1 < offset + length) {
        // Extract the value (our JSON data)
        const value = new TextDecoder().decode(data.slice(keyEnd + 1, offset + length));
        
        try {
          return JSON.parse(value);
        } catch (error) {
          console.error('Error parsing metadata JSON:', error);
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
 * Saves a character as a PNG file via browser download with options
 */
export async function savePngAsBrowserDownload(
  character: Character, 
  options: { includeChats?: boolean; includeBackground?: boolean } = { includeChats: true, includeBackground: true }
): Promise<void> {
  try {
    const pngFile = await embedCharacterIntoPng(character, options);
    
    const a = document.createElement('a');
    a.download = `${character.name}.png`;
    a.href = URL.createObjectURL(pngFile);
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (error) {
    console.error('Error saving character as download:', error);
    throw new Error(`Failed to save character: ${error}`);
  }
}

/**
 * Interface extension for Character with original filename
 */
declare module '../types/interfaces' {
  interface Character {
    originalFilename?: string;
  }
}
