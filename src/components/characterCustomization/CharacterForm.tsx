import { useState, useEffect } from 'react';
import type { FC } from 'react';
import type { Character, DialoguePair } from '../../types/interfaces';
import placeholderImg from '../../assets/placeholder.jpg';
import { useCharacters } from '../../contexts/CharacterContext';
import ImageCropper from '../shared/ImageCropper';
import DeleteConfirmationModal from '../shared/DeleteConfirmationModal';
import EditFieldModal from '../shared/EditFieldModal';
import SaveAsOptionsModal from '../shared/SaveAsOptionsModal';
import { compressImage, getDataUrlSizeInKB } from '../../utils/imageUtils';
import { savePngAsBrowserDownload } from '../../utils/pngMetadata';

interface CharacterFormProps {
  character: Character;
  onUpdateCharacter: (field: string, value: string | DialoguePair[]) => void;
  onDeleteCharacter?: (id: number) => void;
}

// Define the structure for edit field state
interface EditFieldState {
  isOpen: boolean;
  field: string;
  value: string;
  title: string;
  description: string;
  multiline: boolean;
  dialogueIndex?: number;
  dialogueField?: 'user' | 'character';
}

const CharacterForm: FC<CharacterFormProps> = ({ 
  character, 
  onUpdateCharacter,
  onDeleteCharacter
}) => {
  const { exportCharacterAsJson } = useCharacters();
  const [dialogues, setDialogues] = useState<DialoguePair[]>(
    character.sampleDialogues || [{ user: '', character: '' }]
  );
  const [isUploading, setIsUploading] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [editField, setEditField] = useState<EditFieldState>({
    isOpen: false,
    field: '',
    value: '',
    title: '',
    description: '',
    multiline: true
  });

  // Update dialogues state when character prop changes
  useEffect(() => {
    setDialogues(character.sampleDialogues || [{ user: '', character: '' }]);
  }, [character.id, character.sampleDialogues]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      // Create a temporary URL for the cropper
      const tempImageUrl = URL.createObjectURL(file);
      setCropImage(tempImageUrl);
    } catch (error) {
      console.error('Error handling image upload:', error);
      alert('Error uploading image: ' + error);
      setIsUploading(false);
    }
  };

  const handleCroppedImage = async (croppedImageUrl: string) => {
    try {
      // Compress the cropped image
      const originalSizeKB = getDataUrlSizeInKB(croppedImageUrl);
      
      // Only compress if the image is large
      if (originalSizeKB > 200) { // If larger than 200KB
        const compressedImageUrl = await compressImage(croppedImageUrl, 800, 1200, 0.8);
        const compressedSizeKB = getDataUrlSizeInKB(compressedImageUrl);
        
        console.log(`Image compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB (${Math.round((1 - compressedSizeKB/originalSizeKB) * 100)}% reduction)`);
        
        // Update with compressed image
        onUpdateCharacter('image', compressedImageUrl);
      } else {
        // Use original if it's already small
        onUpdateCharacter('image', croppedImageUrl);
      }
    } catch (error) {
      console.error('Error compressing image:', error);
      // Fallback to original image if compression fails
      onUpdateCharacter('image', croppedImageUrl);
    }
    
    setCropImage(null);
    setIsUploading(false);
  };

  const handleCancelCrop = () => {
    setCropImage(null);
    setIsUploading(false);
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Create a FileReader to read the file as data URL
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target?.result as string;
        
        // Compress background image
        const originalSizeKB = getDataUrlSizeInKB(dataUrl);
        
        // Only compress if the image is large
        if (originalSizeKB > 300) { // If larger than 300KB
          const compressedDataUrl = await compressImage(dataUrl, 1920, 1080, 0.7);
          const compressedSizeKB = getDataUrlSizeInKB(compressedDataUrl);
          
          console.log(`Background compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB (${Math.round((1 - compressedSizeKB/originalSizeKB) * 100)}% reduction)`);
          
          onUpdateCharacter('defaultBackground', compressedDataUrl);
        } else {
          // Use original if it's already small
          onUpdateCharacter('defaultBackground', dataUrl);
        }
      } catch (error) {
        console.error('Error processing background image:', error);
        // Fallback to original image
        const dataUrl = event.target?.result as string;
        onUpdateCharacter('defaultBackground', dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = () => {
    onUpdateCharacter('defaultBackground', '');
  };

  const handleDialogueChange = (index: number, field: 'user' | 'character', value: string) => {
    const newDialogues = dialogues.map((dialogue, i) => {
      if (i === index) {
        return { ...dialogue, [field]: value };
      }
      return dialogue;
    });
    
    setDialogues(newDialogues);
    onUpdateCharacter('sampleDialogues', newDialogues);
  };

  const addDialogue = () => {
    const newDialogues = [...dialogues, { user: '', character: '' }];
    setDialogues(newDialogues);
    onUpdateCharacter('sampleDialogues', newDialogues);
  };

  const removeDialogue = (index: number) => {
    if (dialogues.length > 1) {
      const newDialogues = dialogues.filter((_, i) => i !== index);
      setDialogues(newDialogues);
      onUpdateCharacter('sampleDialogues', newDialogues);
    }
  };

  // Updated to show options modal instead of saving directly
  const handleSaveAsPng = async () => {
    setShowSaveOptions(true);
  };
  
  // New handlers for the modal actions
  const handleSaveBackup = async () => {
    try {
      await savePngAsBrowserDownload(character, {
        includeChats: true,
        includeBackground: true
      });
      setShowSaveOptions(false);
    } catch (error) {
      console.error('Failed to save character backup:', error);
    }
  };
  
  const handleSaveShare = async () => {
    try {
      await savePngAsBrowserDownload(character, {
        includeChats: false,
        includeBackground: false
      });
      setShowSaveOptions(false);
    } catch (error) {
      console.error('Failed to save character share copy:', error);
    }
  };

  const handleSaveAsJson = async () => {
    try {
      await exportCharacterAsJson(character);
    } catch (error) {
      console.error('Failed to save character as JSON:', error);
    }
  };

  const confirmDelete = () => {
    if (onDeleteCharacter) {
      onDeleteCharacter(character.id);
    }
    setShowDeleteConfirmation(false);
  };

  // Open edit modal for regular fields
  const openEditModal = (field: string, value: string, title: string, description: string, multiline = true) => {
    setEditField({
      isOpen: true,
      field,
      value,
      title,
      description,
      multiline
    });
  };

  // Open edit modal for dialogue fields
  const openDialogueEditModal = (index: number, field: 'user' | 'character', value: string) => {
    const title = field === 'user' ? 'Edit User Message' : 'Edit Character Response';
    const description = field === 'user' 
      ? 'Enter what the user might say to the character in this example dialogue.'
      : 'Enter how the character would respond to the user message in this example dialogue.';
    
    setEditField({
      isOpen: true,
      field: 'dialogue',
      value,
      title,
      description,
      multiline: true,
      dialogueIndex: index,
      dialogueField: field
    });
  };

  // Handle saving from edit modal
  const handleSaveEdit = (newValue: string) => {
    if (editField.field === 'dialogue' && editField.dialogueIndex !== undefined && editField.dialogueField) {
      // Handle dialogue field
      handleDialogueChange(editField.dialogueIndex, editField.dialogueField, newValue);
    } else {
      // Handle regular field
      onUpdateCharacter(editField.field, newValue);
    }
    setEditField({ ...editField, isOpen: false });
  };

  // Handle cancel from edit modal
  const handleCancelEdit = () => {
    setEditField({ ...editField, isOpen: false });
  };

  return (
    <div className="character-customization">
      {cropImage && (
        <ImageCropper
          src={cropImage}
          onImageCropped={handleCroppedImage}
          onCancel={handleCancelCrop}
        />
      )}

      {showDeleteConfirmation && (
        <DeleteConfirmationModal
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirmation(false)}
          characterName={character.name}
          title="Delete Character"
          message={`Are you sure you want to delete ${character.name}?`}
        />
      )}

      {showSaveOptions && (
        <SaveAsOptionsModal
          character={character}
          onSaveBackup={handleSaveBackup}
          onSaveShare={handleSaveShare}
          onCancel={() => setShowSaveOptions(false)}
        />
      )}

      {editField.isOpen && (
        <EditFieldModal
          title={editField.title}
          description={editField.description}
          value={editField.value}
          multiline={editField.multiline}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      )}

      <div className="character-form-header">
        <h3>Edit Character</h3>
        {onDeleteCharacter && (
          <button 
            type="button" 
            className="delete-character-button"
            onClick={() => setShowDeleteConfirmation(true)}
          >
            Delete
          </button>
        )}
      </div>

      <div className="character-avatar-wrapper">
        <img
          src={character.image || placeholderImg}
          alt="Character Avatar"
          className="character-avatar"
        />
        <div className="avatar-upload-overlay">
          <label htmlFor="avatar-upload" className="upload-button">
            {isUploading ? 'Uploading...' : 'Change Image'}
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden-input"
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="save-character-button" onClick={handleSaveAsPng}>
          Save as PNG
        </button>
        <button type="button" className="save-json-button" onClick={handleSaveAsJson}>
          Save as JSON
        </button>
      </div>

      <div className="form-group">
        <label htmlFor="character-name">
          Character Name:
          <div 
            className="editable-field"
            onClick={() => openEditModal(
              'name', 
              character.name, 
              'Edit Character Name', 
              'The name of your character as it will appear in chats.',
              false
            )}
          >
            <input
              id="character-name"
              type="text"
              value={character.name}
              readOnly
              required
            />
          </div>
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="character-description">
          Description:
          <div 
            className="editable-field"
            onClick={() => openEditModal(
              'description', 
              character.description || '', 
              'Edit Character Description', 
              'Describe your character\'s personality, background, and any other relevant details.'
            )}
          >
            <textarea
              id="character-description"
              placeholder="Character personality..."
              value={character.description || ''}
              readOnly
              rows={4}
            />
          </div>
        </label>
      </div>

      <div className="form-group sample-dialogues">
        <label>Sample Dialogues:</label>
        {dialogues.map((dialogue, index) => (
          <div key={index} className="dialogue-pair-container">
            <div className="dialogue-pair">
              <div 
                className="editable-field"
                onClick={() => openDialogueEditModal(index, 'user', dialogue.user)}
              >
                <input
                  type="text"
                  placeholder="User:"
                  value={dialogue.user}
                  readOnly
                />
              </div>
              <div 
                className="editable-field"
                onClick={() => openDialogueEditModal(index, 'character', dialogue.character)}
              >
                <input
                  type="text"
                  placeholder="Character:"
                  value={dialogue.character}
                  readOnly
                />
              </div>
            </div>
            <button
              type="button"
              className="remove-dialogue"
              onClick={() => removeDialogue(index)}
              disabled={dialogues.length <= 1}
            >
              -
            </button>
          </div>
        ))}
        <button type="button" className="add-dialogue" onClick={addDialogue}>
          + Add Example
        </button>
      </div>

      <div className="form-group">
        <label htmlFor="default-scenario">
          Default Scenario:
          <div 
            className="editable-field"
            onClick={() => openEditModal(
              'defaultScenario', 
              character.defaultScenario || '', 
              'Edit Default Scenario', 
              'The default scenario sets the context for new chats with this character.'
            )}
          >
            <textarea
              id="default-scenario"
              placeholder="Default scenario"
              value={character.defaultScenario || ''}
              readOnly
              rows={3}
            />
          </div>
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="default-greeting">
          Default Greeting:
          <div 
            className="editable-field"
            onClick={() => openEditModal(
              'defaultGreeting', 
              character.defaultGreeting || '', 
              'Edit Default Greeting', 
              'The message this character will send at the beginning of each new chat.'
            )}
          >
            <textarea
              id="default-greeting"
              placeholder="Default greeting"
              value={character.defaultGreeting || ''}
              readOnly
              rows={3}
            />
          </div>
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="background-upload">
          Default Background Image:
          <div className="upload-preview">
            {character.defaultBackground && (
              <div className="background-preview-container">
                <img 
                  src={character.defaultBackground} 
                  alt="Background Preview" 
                  className="background-preview"
                />
                <button 
                  type="button" 
                  className="remove-background-button"
                  onClick={handleRemoveBackground}
                >
                  Remove Background
                </button>
              </div>
            )}
            <input
              id="background-upload"
              type="file"
              accept="image/*"
              onChange={handleBackgroundUpload}
            />
          </div>
        </label>
      </div>
    </div>
  );
};

export default CharacterForm;
