/**
 * Compresses an image to reduce file size
 * @param imageDataUrl - Data URL of the source image
 * @param maxWidth - Maximum width for the compressed image
 * @param maxHeight - Maximum height for the compressed image 
 * @param quality - JPEG quality (0.0 to 1.0)
 * @returns A Promise that resolves to a data URL of the compressed image
 */
export async function compressImage(
  imageDataUrl: string,
  maxWidth = 1024, 
  maxHeight = 1024, 
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      // Create canvas with the desired dimensions
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      // Draw image onto the canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Determine if we should use PNG or JPEG
      // Use PNG for images with transparency, JPEG otherwise
      const useJPEG = !hasTransparency(img);
      const mimeType = useJPEG ? 'image/jpeg' : 'image/png';
      
      // Get the data URL from the canvas
      const outputQuality = useJPEG ? quality : undefined; // PNG doesn't use quality
      const compressedDataUrl = canvas.toDataURL(mimeType, outputQuality);
      
      resolve(compressedDataUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Error loading image for compression'));
    };
    
    img.src = imageDataUrl;
  });
}

/**
 * Detects if an image has transparency
 * This is done by drawing the image to a temporary canvas and checking pixel alpha values
 */
function hasTransparency(img: HTMLImageElement): boolean {
  // For small images, check every pixel
  // For larger images, use a sampling approach
  const isLarge = img.width * img.height > 1000000; // 1 million pixels
  const canvas = document.createElement('canvas');
  
  // We only need a small portion for the check if it's a large image
  const checkWidth = isLarge ? Math.min(img.width, 100) : img.width;
  const checkHeight = isLarge ? Math.min(img.height, 100) : img.height;
  
  canvas.width = checkWidth;
  canvas.height = checkHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  
  // Draw the image (or a portion of it) to the canvas
  if (isLarge) {
    // Sample from different areas of the image
    ctx.drawImage(
      img, 
      0, 0, img.width, img.height, 
      0, 0, checkWidth, checkHeight
    );
  } else {
    ctx.drawImage(img, 0, 0);
  }
  
  // Get image data to check for transparency
  try {
    const imageData = ctx.getImageData(0, 0, checkWidth, checkHeight);
    const data = imageData.data;
    
    // Check for non-opaque pixels (alpha < 255)
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true;
      }
    }
  } catch (e) {
    console.error('Error checking for transparency:', e);
  }
  
  return false;
}

/**
 * Gets the file size of a data URL in kilobytes
 */
export function getDataUrlSizeInKB(dataUrl: string): number {
  // Remove the data URL prefix
  const base64 = dataUrl.split(',')[1];
  // Calculate the size
  const sizeInBytes = (base64.length * 3) / 4; // Approximate Base64 to raw bytes conversion
  return Math.round(sizeInBytes / 1024); // Convert bytes to KB
}
