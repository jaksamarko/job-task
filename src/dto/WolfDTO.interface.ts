import Coord from './Coord.interface';

interface WolfDTO extends Coord {
  speed: number;
  size: number;
}

export default WolfDTO;
