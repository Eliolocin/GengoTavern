import type React from 'react';
import CharacterTile from './CharacterTile';
import type { Character } from '../../types/interfaces';

interface CharacterGridProps {
  onNewCharacter: () => void;
  onSelectCharacter: (id: number) => void;
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
      <CharacterTile isNew onClick={onNewCharacter} />
      {characters.map((character) => (
        <CharacterTile
          key={character.id}
          character={character}
          onClick={() => onSelectCharacter(character.id)}
          isSelected={character.id === selectedCharacterId}
        />
      ))}
    </div>
  );
};

export default CharacterGrid;
