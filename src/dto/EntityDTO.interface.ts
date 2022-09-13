import Coord from './Coord.interface';

interface EntityDTO extends Coord {
  dead?: boolean;
}

export default EntityDTO;
