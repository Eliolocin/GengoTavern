import type React from 'react';
import type { Character } from '../../types/interfaces';

interface CharacterTileProps {
  character?: Character;
  onClick: () => void;
  isNew?: boolean;
  isSelected?: boolean;
}

const CharacterTile: React.FC<CharacterTileProps> = ({ 
  character, 
  onClick, 
  isNew,
  isSelected = false 
}) => {
  return (
    <button 
      type="button" 
      className={`character-tile ${isSelected ? 'selected' : ''}`} 
      onClick={onClick}
    >
      {isNew ? (
        <div className="plus-sign">+</div>
      ) : (
        character && <img src={character.image} alt={character.name} />
      )}
    </button>
  );
};

export default CharacterTile;
