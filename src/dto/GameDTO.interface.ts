import Coord from './Coord.interface';
import EntityDTO from './EntityDTO.interface';
import WolfDTO from './WolfDTO.interface';

interface GameDTO {
  sheeps: EntityDTO[];
  wolf: WolfDTO;
  screen: Coord;
}

export default GameDTO;
