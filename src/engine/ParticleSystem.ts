import { TriggerType } from '../data/levels';
import { Grid } from './Grid';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: TriggerType;
  life: number;     // 0 to 1
  decayRate: number; // reduction in life per frame
  size: number;
  trail: { x: number; y: number }[];
}

export class ParticleSystem {
  particles: Particle[] = [];

  constructor() {}

  spawn(x: number, y: number, vx: number, vy: number, type: TriggerType, isEnhanced: boolean = false) {
    const size = isEnhanced ? 8 : 5;
    const decayRate = isEnhanced ? 0.005 : 0.012; // Enhanced particles last longer
    const speedMultiplier = isEnhanced ? 1.5 : 1.0;

    this.particles.push({
      x,
      y,
      vx: vx * speedMultiplier,
      vy: vy * speedMultiplier,
      type,
      life: 1.0,
      decayRate,
      size,
      trail: []
    });
  }

  spawnBurst(x: number, y: number, type: TriggerType, count: number, isEnhanced: boolean = false) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const speed = 0.08 + Math.random() * 0.06;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      this.spawn(x, y, vx, vy, type, isEnhanced);
    }
  }

  update(grid: Grid) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update trail
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 5) {
        p.trail.shift();
      }

      // Update life
      p.life -= p.decayRate;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Move particle
      const nextX = p.x + p.vx;
      const nextY = p.y + p.vy;

      // Bounce off grid boundaries
      let bounced = false;
      if (nextX < 0.1) {
        p.x = 0.1;
        p.vx = -p.vx;
        bounced = true;
      } else if (nextX > grid.width - 0.1) {
        p.x = grid.width - 0.1;
        p.vx = -p.vx;
        bounced = true;
      }

      if (nextY < 0.1) {
        p.y = 0.1;
        p.vy = -p.vy;
        bounced = true;
      } else if (nextY > grid.height - 0.1) {
        p.y = grid.height - 0.1;
        p.vy = -p.vy;
        bounced = true;
      }

      // Bounce off walls in grid
      if (!bounced) {
        const currentGridX = Math.floor(p.x);
        const currentGridY = Math.floor(p.y);
        const nextGridX = Math.floor(nextX);
        const nextGridY = Math.floor(nextY);

        if (grid.isWallAt(nextGridX, nextGridY)) {
          // Determine bounce direction
          if (nextGridX !== currentGridX && grid.isWallAt(nextGridX, currentGridY)) {
            p.vx = -p.vx;
          }
          if (nextGridY !== currentGridY && grid.isWallAt(currentGridX, nextGridY)) {
            p.vy = -p.vy;
          }
          if (nextGridX !== currentGridX && nextGridY !== currentGridY && !grid.isWallAt(nextGridX, currentGridY) && !grid.isWallAt(currentGridX, nextGridY)) {
            // Corner hit
            p.vx = -p.vx;
            p.vy = -p.vy;
          }
        } else {
          p.x = nextX;
          p.y = nextY;
        }
      }
    }
  }

  clear() {
    this.particles = [];
  }
}
