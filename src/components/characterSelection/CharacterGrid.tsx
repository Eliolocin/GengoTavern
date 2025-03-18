import type React from 'react';
import CharacterTile from './CharacterTile';
import type { Character } from '../../types/interfaces';

interface CharacterGridProps {
  onNewCharacter: () => void;
  onSelectCharacter: (character: Character) => void;
  characters: Character[];
  selectedCharacterId?: number;
}

const CharacterGrid: React.FC<CharacterGridProps> = ({
  onNewCharacter,
  onSelectCharacter,
  characters,
  selectedCharacterId
}) => {
  return (
    <div className="character-grid">
      {/* Key added for New Character tile */}
      <CharacterTile key="new-character" isNew onClick={onNewCharacter} />
      {characters.map((character) => (
        <CharacterTile
          key={character.id} // Ensure this key is present and unique
          character={character}
          onClick={() => onSelectCharacter(character)}
          isSelected={character.id === selectedCharacterId}
        />
      ))}
    </div>
  );
};

export default CharacterGrid;
