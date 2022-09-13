import Coord from './Coord.interface';

interface EntityDTO extends Coord {
  dir: number;
  dead: boolean;
}

export default EntityDTO;
