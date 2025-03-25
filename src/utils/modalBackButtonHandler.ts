/**
 * Sets up a back button handler for modals
 * @param onClose Function to call when back button is pressed
 * @returns A cleanup function to remove the handler
 */
export const setupModalBackButtonHandler = (onClose: () => void): (() => void) => {
    // Create a history entry to capture the back button press
    window.history.pushState(null, '', window.location.pathname);
    
    // Set up event listener for popstate (back button)
    const handlePopState = () => {
      // Call the close function
      onClose();
      
      // Push a new state to keep the URL the same
      window.history.pushState(null, '', window.location.pathname);
    };
    
    window.addEventListener('popstate', handlePopState);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  };