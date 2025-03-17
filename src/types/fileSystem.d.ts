// TypeScript declarations for the File System Access API
interface FileSystemDirectoryHandle extends FileSystemHandle {
  entries(): AsyncIterable<[string, FileSystemHandle]>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
}

interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: FileSystemWriteChunkType): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

type FileSystemWriteChunkType =
  | string
  | BufferSource
  | Blob
  | File;

interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }): Promise<FileSystemDirectoryHandle>;
  
  showOpenFilePicker(options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }): Promise<FileSystemFileHandle[]>;
  
  showSaveFilePicker(options?: {
    excludeAcceptAllOption?: boolean;
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }): Promise<FileSystemFileHandle>;
}
