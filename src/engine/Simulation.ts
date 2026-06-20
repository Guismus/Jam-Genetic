import { Level, TriggerType, ActionType, ReleaseType, ModifierType, Genome } from '../data/levels';
import { Grid, GridCell } from './Grid';
import { ParticleSystem, Particle } from './ParticleSystem';

export class Simulation {
  grid: Grid;
  particles: ParticleSystem;
  isRunning: boolean = false;
  
  // Game stats
  energyGenerated: number = 0;
  maxChainStep: number = 0;
  
  // Callbacks
  onCellTriggered?: (cell: GridCell) => void;
  onCellExploded?: (cell: GridCell) => void;
  onSimulationEnd?: (success: boolean) => void;

  private currentLevel?: Level;
  private cellChainDepths: Map<string, number> = new Map();

  constructor(grid: Grid, particles: ParticleSystem) {
    this.grid = grid;
    this.particles = particles;
  }

  start(level: Level, injectionCoords: { x: number; y: number }, injectionType: TriggerType) {
    this.currentLevel = level;
    this.isRunning = true;
    this.energyGenerated = 0;
    this.maxChainStep = 1;
    this.cellChainDepths.clear();
    this.particles.clear();

    // Trigger cell at injection coordinates if one exists
    const cell = this.grid.getCellAt(injectionCoords.x, injectionCoords.y);
    if (cell) {
      this.triggerCell(cell, 1, injectionType);
    } else {
      // Otherwise, spawn a burst of particles at that position to start the reaction
      this.particles.spawnBurst(injectionCoords.x + 0.5, injectionCoords.y + 0.5, injectionType, 12, false);
      // Give these particles a chain depth of 0
      this.particles.particles.forEach(p => {
        (p as any).chainDepth = 0;
      });
    }
  }

  triggerCell(cell: GridCell, depth: number, type: TriggerType) {
    if (cell.state !== 'idle') return;

    // Each trigger type only matches its own stimulus type, except IMPACT which reacts to any stimulus
    if (cell.genome.trigger !== 'IMPACT' && cell.genome.trigger !== type) {
      return;
    }

    cell.state = 'triggered';
    this.cellChainDepths.set(cell.id, depth);
    if (depth > this.maxChainStep) {
      this.maxChainStep = depth;
    }

    this.energyGenerated += 10; // 10 units of energy per cell triggered

    if (this.onCellTriggered) {
      this.onCellTriggered(cell);
    }

    // Handle DELAY modifier
    if (cell.genome.modifier === 'DELAY') {
      cell.triggerTimer = 90; // 90 frames = 1.5 seconds at 60fps
      cell.maxTriggerTimer = 90;
    } else {
      cell.triggerTimer = 0;
      cell.maxTriggerTimer = 0;
    }
  }

  update() {
    if (!this.isRunning) return;

    // 1. Update particles physics
    this.particles.update(this.grid);

    // 2. Check collisions between particles and idle cells
    const cellRadius = 0.4;
    for (let i = this.particles.particles.length - 1; i >= 0; i--) {
      const p = this.particles.particles[i];
      const particleChainDepth = (p as any).chainDepth || 0;

      // Find cell near particle
      const cell = this.grid.getCellAt(p.x, p.y);
      if (cell && cell.state === 'idle') {
        // Calculate distance
        const dx = p.x - (cell.x + 0.5);
        const dy = p.y - (cell.y + 0.5);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < cellRadius) {
          // Attempt to trigger cell
          const previousState = cell.state;
          this.triggerCell(cell, particleChainDepth + 1, p.type);

          // If successfully triggered (state changed), absorb the particle
          if ((cell.state as string) === 'triggered') {
            this.particles.particles.splice(i, 1);
          }
        }
      }
    }

    // 3. Update cells (schedules, delays, sliding)
    const cellsToActivate: GridCell[] = [];
    const deadCells: GridCell[] = [];

    this.grid.cells.forEach(cell => {
      if (cell.state === 'dead') return;

      // Handle sliding cell movement (SPLIT daughters)
      if (cell.slidingDir) {
        const speed = cell.slideSpeed || 0.08;
        const nextX = cell.x + cell.slidingDir.dx * speed;
        const nextY = cell.y + cell.slidingDir.dy * speed;

        // Check wall collision or cell collision at new position
        const roundedX = Math.round(nextX);
        const roundedY = Math.round(nextY);

        let hitObstacle = false;
        let hitCell: any = null;

        // Out of bounds?
        if (nextX < 0 || nextX >= this.grid.width || nextY < 0 || nextY >= this.grid.height) {
          hitObstacle = true;
        } else if (this.grid.isWallAt(roundedX, roundedY)) {
          hitObstacle = true;
        } else {
          // Check collision with another cell (excluding itself)
          const otherCell = this.grid.getCellAt(nextX, nextY);
          if (otherCell && otherCell.id !== cell.id) {
            hitObstacle = true;
            hitCell = otherCell;
          }
        }

        if (hitObstacle) {
          cell.x = Math.round(cell.x);
          cell.y = Math.round(cell.y);
          cell.slidingDir = undefined;
          cell.slideSpeed = undefined;
          
          const depth = this.cellChainDepths.get(cell.id) || 1;
          
          // 1. Force trigger the sliding cell itself (explodes on physical impact)
          cell.state = 'triggered';
          cell.triggerTimer = 0;
          cell.maxTriggerTimer = 0;
          this.cellChainDepths.set(cell.id, depth + 1);
          if (depth + 1 > this.maxChainStep) {
            this.maxChainStep = depth + 1;
          }
          this.energyGenerated += 10;
          if (this.onCellTriggered) {
            this.onCellTriggered(cell);
          }

          // 2. If it hit another cell, trigger that cell with our release type
          if (hitCell && hitCell.state === 'idle') {
            this.triggerCell(hitCell, depth + 1, cell.genome.release);
          }
        } else {
          cell.x = nextX;
          cell.y = nextY;
        }
      }

      // Process triggered timers
      if (cell.state === 'triggered') {
        if (cell.triggerTimer > 0) {
          cell.triggerTimer--;
        } else {
          cellsToActivate.push(cell);
        }
      }
    });

    // 4. Activate triggered cells
    cellsToActivate.forEach(cell => {
      cell.state = 'active';
      this.executeCellAction(cell);
      cell.state = 'dead';
      if (this.onCellExploded) {
        this.onCellExploded(cell);
      }
    });

    // 5. Check if simulation is finished (no particles, no triggered, active, or sliding cells)
    const hasActiveStimuli = this.particles.particles.length > 0 || 
      this.grid.cells.some(c => c.state === 'triggered' || c.state === 'active' || !!c.slidingDir);

    if (!hasActiveStimuli) {
      this.isRunning = false;
      this.evaluateWinCondition();
    }
  }

  private executeCellAction(cell: GridCell) {
    const depth = this.cellChainDepths.get(cell.id) || 1;
    const isEnhanced = cell.genome.modifier === 'CHAIN';
    const isDual = cell.genome.modifier === 'DUAL';

    const cx = cell.x + 0.5;
    const cy = cell.y + 0.5;

    switch (cell.genome.action) {
      case 'BURST': {
        const count = isDual ? 16 : 8;
        this.particles.spawnBurst(cx, cy, cell.genome.release, count, isEnhanced);
        // Tag spawned particles with this cell's chain depth
        this.tagLastParticles(count, depth);
        break;
      }

      case 'SHOOT': {
        const baseDirections = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 }
        ];
        const diagonalDirections = [
          { dx: 0.707, dy: 0.707 },
          { dx: 0.707, dy: -0.707 },
          { dx: -0.707, dy: 0.707 },
          { dx: -0.707, dy: -0.707 }
        ];
        const directions = isDual ? [...baseDirections, ...diagonalDirections] : baseDirections;

        directions.forEach(dir => {
          const speed = 0.12;
          this.particles.spawn(cx, cy, dir.dx * speed, dir.dy * speed, cell.genome.release, isEnhanced);
        });
        this.tagLastParticles(directions.length, depth);
        break;
      }

      case 'SPLIT': {
        // Spawns 2 daughter cells that slide horizontally
        // If horizontal is blocked by walls, slide vertically
        let dir1 = { dx: 1, dy: 0 };
        let dir2 = { dx: -1, dy: 0 };

        if (
          this.grid.isWallAt(cell.x + 1, cell.y) || 
          this.grid.isWallAt(cell.x - 1, cell.y) ||
          cell.x + 1 >= this.grid.width ||
          cell.x - 1 < 0
        ) {
          dir1 = { dx: 0, dy: 1 };
          dir2 = { dx: 0, dy: -1 };
        }

        const addDaughter = (x: number, y: number, dir: { dx: number; dy: number }) => {
          if (this.grid.isEmptyAt(x, y)) {
            const daughter = this.grid.addCell(x, y, cell.genome, false, false);
            if (daughter) {
              daughter.slidingDir = dir;
              daughter.slideSpeed = isEnhanced ? 0.12 : 0.08;
              this.cellChainDepths.set(daughter.id, depth);
            }
          }
        };

        addDaughter(cell.x + dir1.dx, cell.y + dir1.dy, dir1);
        addDaughter(cell.x + dir2.dx, cell.y + dir2.dy, dir2);
        break;
      }

      case 'MUTATE': {
        const adjacent = this.grid.getAdjacentCoords(cell.x, cell.y);
        let mutationCount = 0;
        adjacent.forEach(coord => {
          const adjCell = this.grid.getCellAt(coord.x, coord.y);
          if (adjCell && adjCell.state === 'idle') {
            this.grid.mutateCell(adjCell, cell.genome);
            mutationCount++;
            // Mutating a cell immediately triggers it with the release gene!
            this.triggerCell(adjCell, depth + 1, cell.genome.release);
          }
        });
        break;
      }

      case 'GROW': {
        const adjacent = this.grid.getAdjacentCoords(cell.x, cell.y);
        const emptySpots = adjacent.filter(coord => this.grid.isEmptyAt(coord.x, coord.y));

        if (emptySpots.length > 0) {
          // Breed a new cell in an empty spot
          const spawnCount = isDual ? Math.min(2, emptySpots.length) : 1;
          for (let i = 0; i < spawnCount; i++) {
            const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
            // Remove spot from pool so we don't spawn two in the same spot
            emptySpots.splice(emptySpots.indexOf(spot), 1);

            const baby = this.grid.addCell(spot.x, spot.y, cell.genome, false, false);
            if (baby) {
              // Trigger it immediately with the release gene
              this.triggerCell(baby, depth + 1, cell.genome.release);
            }
          }
        }
        break;
      }
    }
  }

  private tagLastParticles(count: number, parentDepth: number) {
    const len = this.particles.particles.length;
    for (let i = len - count; i < len; i++) {
      if (i >= 0) {
        (this.particles.particles[i] as any).chainDepth = parentDepth;
      }
    }
  }

  private evaluateWinCondition() {
    if (!this.currentLevel) return;

    let success = false;
    const type = this.currentLevel.objectiveType;

    if (type === 'clear_all') {
      // Check if all cells (except targets maybe, but usually target is included) are dead
      success = this.grid.cells.every(c => c.state === 'dead');
    } else if (type === 'mutate_target') {
      // Check if any target cell is mutated or triggered (i.e. not in its original idle state, or dead)
      const target = this.grid.cells.find(c => c.isTarget);
      success = target ? target.state === 'dead' || target.state === 'triggered' : false;
    } else if (type === 'min_energy') {
      // energyGenerated is incremented by 10 per cell triggered
      success = (this.energyGenerated >= (this.currentLevel.objectiveValue || 0) * 10);
    } else if (type === 'min_chain') {
      success = (this.maxChainStep >= (this.currentLevel.objectiveValue || 0));
    }

    if (this.onSimulationEnd) {
      this.onSimulationEnd(success);
    }
  }

  stop() {
    this.isRunning = false;
    this.particles.clear();
  }
}
