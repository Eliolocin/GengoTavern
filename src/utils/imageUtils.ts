/**
 * Utilities for handling images throughout the application
 */

// Default placeholder as a base64 string when everything else fails
export const DEFAULT_PLACEHOLDER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6QTFCN0Y1N0NBRDg0MTFFQTkwMkZCOUMyNjhBNjI5NjUiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6QTFCN0Y1N0RBRDg0MTFFQTkwMkZCOUMyNjhBNjI5NjUiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpBMUI3RjU3QUFEODQxMUVBOTAyRkI5QzI2OEE2Mjk2NSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpBMUI3RjU3QkFEODQxMUVBOTAyRkI5QzI2OEE2Mjk2NSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PhLwhikAAATqSURBVHja7NzdbxRVGAfwM7Pbbe0WSosgFlBCkJiIUQiJiuiFF973P9ELr7zwEr2QSEi4IBLiNQRjAMUISolo6bLd7vgcMySGdmnn7Myc3fN9L1rtD3b22XN+85zTWV+tVqMgmyYHIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAGQmCaHoA4HeeEwV0GPn+TT65D6t9fi/yRu9NblJdeJ5PcEf25Xlr3cExzd9+8EUCcAu7P9SPTeiUGbOPccr9ce9+gpiJeJ3S7UA6AwyY1LDimYPgL+AEr446rtPoCEP+Hx87I26QPwgN+/EZNSon0APuH3b8Sk9pL9ANrAr/DD5d5eEz8zoEX8sMLZ6c+MfQBt4SuZT58t9hiARa+L3zSCVvCbRwA+SvCJ3x6CzgNI+QdC7AHoh99JBJ0G4Bd/9wi6C2Ak/GoEzgi6CmBk/K0jyLqKnwfA+PiJETxY1xkqKQFUw3+3dDZp8S+fV0WOb8WvRsDIucVDHQeQr+YBp4vAffmmrpXrTMkKwNkgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgACQjgPY4v67xP99nL/O3/bMluCnDHfvwS1A5HK/Ve3IE8Dd3dqGumiyAFe78vRU3Fj80+vcI3iq6xB/fnIkDqa39snMqQGOwUgA+Rt3nrxwpfoPT0q35t45lN06/YFvqvPN8vw0j5sYgHit/5iuWlAVwPQRqO6vPPdBqeUusHMwqg6wXlMVmzVFQDTiD4dbNQukBjCpCBz3T1u28mQBilGHQCEAY+MnQhA0gHHwUyAIFcD4+GYIAgTgC9+EQDAA/vBjBIFkaQ4MwCc+CAgygNX8e4khARgff3MEsAE0gC8RAAMwHXxIAEbH948ACsBs8D0jUADmhe8TQQGYH74fBD5yeMs/rwzcJK3qp6t+CDm8dJxAxfd1Jfp5FLkaACZyDHLYJ6HrBNoi8FS+NGsvf1M1AOYu39QKwA8+/KQKwB9+4J+WAXQFPywA3cIPBoA7fP8A3OJ7BuAc3ycAH/BCADjG90UgFADB3Nd1CABz+K4AOIfvCIB7fCcAoODbBwAHfy0pLQKAhG8ZADB8mwBg4VsDEBZ+teKpuhgA0eXaTa0D2PdoWPgvXTl74MmZ6y8AEGO7BuDx03LfoxGWfm/FX54Wm4vjARCztl97P757vDz5Rikxh2/n78OH7xRu3BkPgBjOpcvHbpUn32ifxLPyylUYuM175fP7qnuLeADih8d351Y//ihylMQJ8delam9VK734ONzNc+7TcDyA5+nm3iyMXlH+SFnF35rhO3CfJfLT496nJ3mvjQdgAbSKr1bDO/yMAS3gD8zfoWdtYBR8L/CZG5AeX8XPDUBqfD/w+QBIi+8NPgcAKfG9wqcHkArfO3xiAKnwQeCTA0iMDwSfGEBSfDD4lAAS4gPCpwOQDB8UPg2ARPgJbj+Ev04nQHR8a9WJdhO+H38ORCt8i9WpJrv43DvRHN9mea7RNgG/aQQN8a0WKJttFPGXRlAf326FttVWGT9pBLXxLZeoW60V8o9GsD2+7Rp942U6fg/MSv/S+bN//TF5IxS7z/X/FxcXFQACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIABkM/8JMADLnKgJsNN+TwAAAABJRU5ErkJggg==";

/**
 * Load an image from public/assets, falling back to the default placeholder if needed
 */
export const loadAssetImage = async (path: string): Promise<string> => {
  try {
    // Try to fetch the asset
    const fullPath = path.startsWith('/') ? path : `/${path}`;
    const response = await fetch(fullPath);
    
    if (!response.ok) {
      throw new Error(`Failed to load image: ${response.status}`);
    }
    
    // Get the blob and convert to URL
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error(`Error loading asset image ${path}:`, error);
    return DEFAULT_PLACEHOLDER;
  }
};

/**
 * Ensure a given URL is valid and accessible, falling back to placeholder if not
 */
export const ensureValidImageUrl = async (url: string): Promise<string> => {
  // If it's already a data URL, just return it
  if (url.startsWith('data:')) {
    return url;
  }
  
  try {
    // For asset paths, use the loadAssetImage helper
    if (url.startsWith('/assets/') || url.startsWith('assets/')) {
      return await loadAssetImage(url);
    }
    
    // For other URLs (including blob: URLs), check if they're valid
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      return url;
    }
    
    // Fallback to default placeholder
    throw new Error('Image URL not accessible');
  } catch (error) {
    console.warn(`Invalid image URL ${url}, using placeholder:`, error);
    return DEFAULT_PLACEHOLDER;
  }
};
