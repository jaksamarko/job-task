import Coord from './Coord.interface';
import WolfDTO from './WolfDTO.interface';

interface GameDTO {
  sheeps: Coord[];
  wolf: WolfDTO;
  screen: Coord;
}

export default GameDTO;
