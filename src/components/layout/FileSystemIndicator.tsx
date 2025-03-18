import React, { useState, useEffect } from 'react';
import { isFileSystemAccessSupported, initializeFileSystem } from '../../utils/fileSystem';
import './FileSystemIndicator.css';

const FileSystemIndicator: React.FC = () => {
  const [basePath, setBasePath] = useState<string>(() => {
    return localStorage.getItem('gengoTavern_basePath') || '';
  });
  
  const [fsSupported] = useState(isFileSystemAccessSupported());
  const [initAttempted, setInitAttempted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showClearStorageConfirm, setShowClearStorageConfirm] = useState(false);

  // Initialize on mount for Chromium browsers
  useEffect(() => {
    if (fsSupported && !basePath && !initAttempted) {
      setIsInitializing(true);
      setInitAttempted(true);
      
      initializeFileSystem()
        .then(success => {
          if (success) {
            const path = localStorage.getItem('gengoTavern_basePath');
            if (path) setBasePath(path);
          }
        })
        .catch(err => {
          console.error('Error initializing file system:', err);
        })
        .finally(() => {
          setIsInitializing(false);
        });
    }
  }, [fsSupported, basePath, initAttempted]);

  const handleSelectDirectory = async () => {
    if (!fsSupported) return;
    
    try {
      setIsInitializing(true);
      const success = await initializeFileSystem();
      setIsInitializing(false);
      
      if (success) {
        const path = localStorage.getItem('gengoTavern_basePath');
        if (path) {
          setBasePath(path);
          
          // Refresh the page to reinitialize with the new directory
          window.location.reload();
        }
      }
    } catch (error) {
      setIsInitializing(false);
      console.error('Error selecting directory:', error);
    }
  };

  const handleClearStorage = () => {
    // Show confirmation first
    setShowClearStorageConfirm(true);
  };

  const confirmClearStorage = () => {
    // Clear all localStorage
    localStorage.clear();
    setShowClearStorageConfirm(false);
    // Reload the page to restart fresh
    window.location.reload();
  };

  const cancelClearStorage = () => {
    setShowClearStorageConfirm(false);
  };

  // Clear storage confirmation dialog
  if (showClearStorageConfirm) {
    return (
      <div className="filesystem-indicator warning">
        <span>Are you sure you want to clear all storage? This will delete all characters and settings.</span>
        <div className="storage-buttons">
          <button onClick={confirmClearStorage}>Yes, Clear Storage</button>
          <button onClick={cancelClearStorage}>Cancel</button>
        </div>
      </div>
    );
  }

  if (!fsSupported) {
    return (
      <div className="filesystem-indicator warning">
        <span>Using browser storage (files will be downloaded when saving)</span>
        <button onClick={handleClearStorage} className="clear-storage-button">
          Clear Storage
        </button>
      </div>
    );
  }

  return (
    <div className="filesystem-indicator">
      {isInitializing && (
        <span>Initializing file system...</span>
      )}
      {!isInitializing && (
        <>
          <span>
            {basePath 
              ? `Saving to: ${basePath}/user/characters` 
              : 'No directory selected'}
          </span>
          <div className="filesystem-buttons">
            <button onClick={handleSelectDirectory}>
              {basePath ? 'Change Directory' : 'Select Directory'}
            </button>
            <button onClick={handleClearStorage} className="clear-storage-button">
              Clear Storage
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FileSystemIndicator;
