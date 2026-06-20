import { Level, Genome, CellConfig, WallConfig } from '../data/levels';

export interface GridCell {
  id: string;
  x: number;
  y: number;
  isEditable: boolean;
  isTarget: boolean;
  genome: Genome;
  state: 'idle' | 'triggered' | 'active' | 'dead';
  triggerTimer: number;     // countdown timer (in frames/ticks) for DELAY modifier
  maxTriggerTimer: number;  // original duration for DELAY modifier
  slidingDir?: { dx: number; dy: number }; // Direction of sliding for SPLIT action
  slideSpeed?: number;
}

export class Grid {
  width: number = 0;
  height: number = 0;
  cells: GridCell[] = [];
  walls: WallConfig[] = [];
  private cellIdCounter = 0;

  constructor() {}

  initialize(level: Level) {
    this.width = level.width;
    this.height = level.height;
    this.walls = [...level.walls];
    this.cells = level.cells.map(config => this.createCellFromConfig(config));
    this.cellIdCounter = this.cells.length;
  }

  private createCellFromConfig(config: CellConfig): GridCell {
    return {
      id: `cell-${this.cellIdCounter++}`,
      x: config.x,
      y: config.y,
      isEditable: config.isEditable,
      isTarget: !!config.isTarget,
      genome: { ...config.genome },
      state: 'idle',
      triggerTimer: 0,
      maxTriggerTimer: 0
    };
  }

  getCellAt(x: number, y: number): GridCell | null {
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    return this.cells.find(c => c.state !== 'dead' && Math.round(c.x) === roundedX && Math.round(c.y) === roundedY) || null;
  }

  isWallAt(x: number, y: number): boolean {
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    return this.walls.some(w => w.x === roundedX && w.y === roundedY);
  }

  isEmptyAt(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return !this.isWallAt(x, y) && !this.getCellAt(x, y);
  }

  addCell(x: number, y: number, genome: Genome, isEditable: boolean = false, isTarget: boolean = false): GridCell | null {
    if (!this.isEmptyAt(x, y)) return null;
    const newCell: GridCell = {
      id: `cell-${this.cellIdCounter++}`,
      x,
      y,
      isEditable,
      isTarget,
      genome: { ...genome },
      state: 'idle',
      triggerTimer: 0,
      maxTriggerTimer: 0
    };
    this.cells.push(newCell);
    return newCell;
  }

  mutateCell(cell: GridCell, newGenome: Genome) {
    cell.genome = { ...newGenome };
  }

  getAdjacentCoords(x: number, y: number): { x: number; y: number }[] {
    const coords = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ];
    return coords.filter(c => c.x >= 0 && c.x < this.width && c.y >= 0 && c.y < this.height);
  }

  reset() {
    this.cells = [];
    this.walls = [];
  }
}
