import React, { useState, useEffect } from 'react';
import { isFileSystemAccessSupported } from '../../utils/fileSystem';

const FileSystemIndicator: React.FC = () => {
  const [basePath, setBasePath] = useState<string | null>(null);
  const [fsSupported, setFsSupported] = useState(false);

  useEffect(() => {
    // Check if File System API is supported
    const supported = isFileSystemAccessSupported();
    setFsSupported(supported);

    // If supported, try to get the current path from localStorage
    if (supported) {
      const savedPath = localStorage.getItem('gengoTavern_basePath');
      if (savedPath) {
        setBasePath(savedPath);
      }
    }
  }, []);

  const handleSelectDirectory = async () => {
    try {
      // @ts-ignore - FileSystemAccess API might not be recognized
      const dirHandle = await window.showDirectoryPicker({
        id: 'gengoTavernRoot',
        mode: 'readwrite',
        startIn: 'documents'
      });
      
      // Store the directory name
      const path = dirHandle.name;
      localStorage.setItem('gengoTavern_basePath', path);
      setBasePath(path);
      
      // Refresh the page to reinitialize with the new directory
      window.location.reload();
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  if (!fsSupported) {
    return (
      <div className="filesystem-indicator warning">
        <span>Using browser storage (files will be downloaded when saving)</span>
      </div>
    );
  }

  return (
    <div className="filesystem-indicator">
      <span>
        {basePath 
          ? `Saving to: ${basePath}/user/characters` 
          : 'No directory selected'}
      </span>
      <button onClick={handleSelectDirectory}>
        {basePath ? 'Change Directory' : 'Select Directory'}
      </button>
    </div>
  );
};

export default FileSystemIndicator;
