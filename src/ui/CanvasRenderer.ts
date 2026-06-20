import { Grid, GridCell } from '../engine/Grid';
import { ParticleSystem, Particle } from '../engine/ParticleSystem';
import { TriggerType, ActionType, ReleaseType, ModifierType } from '../data/levels';

export class CanvasRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  grid: Grid;
  particles: ParticleSystem;

  // Render settings
  padding = 40;
  cellSize = 0; // calculated dynamically
  offsetX = 0;
  offsetY = 0;

  // Colors
  readonly COLORS = {
    bg: '#080c14',
    gridLines: 'rgba(30, 41, 59, 0.5)',
    dishBorder: 'rgba(59, 130, 246, 0.25)',
    wallFill: '#151e2e',
    wallStroke: '#3b82f6',
    HEAT: '#ff5722',   // Orange-Red
    TOXIN: '#39ff14',  // Neon Green
    SHOCK: '#00f0ff',  // Electric Cyan
    IMPACT: '#d946ef'  // Magenta / Pink
  };

  private animationFrame = 0;

  constructor(canvas: HTMLCanvasElement, grid: Grid, particles: ParticleSystem) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Could not get 2D context");
    this.ctx = context;
    this.grid = grid;
    this.particles = particles;
  }

  resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width || 600;
    const height = rect?.height || 500;

    // Set canvas dimensions with device pixel ratio support
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Reset transform then apply DPR scale (non-cumulative)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Guard: grid must have dimensions to compute layout
    if (this.grid.width === 0 || this.grid.height === 0) return;

    // Calculate layout sizing
    const availableWidth = width - this.padding * 2;
    const availableHeight = height - this.padding * 2;

    const cellWidth = availableWidth / this.grid.width;
    const cellHeight = availableHeight / this.grid.height;
    
    // Maintain square cells
    this.cellSize = Math.min(cellWidth, cellHeight);
    
    this.offsetX = this.padding + (availableWidth - this.cellSize * this.grid.width) / 2;
    this.offsetY = this.padding + (availableHeight - this.cellSize * this.grid.height) / 2;
  }

  gridToCanvas(gx: number, gy: number): { x: number; y: number } {
    return {
      x: this.offsetX + gx * this.cellSize,
      y: this.offsetY + gy * this.cellSize
    };
  }

  canvasToGrid(cx: number, cy: number): { x: number; y: number } | null {
    const gx = (cx - this.offsetX) / this.cellSize;
    const gy = (cy - this.offsetY) / this.cellSize;

    if (gx >= 0 && gx < this.grid.width && gy >= 0 && gy < this.grid.height) {
      return { x: gx, y: gy };
    }
    return null;
  }

  draw(hoveredCell: GridCell | null, selectedCell: GridCell | null, currentInjection: TriggerType | null, isSimulating: boolean) {
    this.animationFrame++;
    const { width, height } = this.canvas.getBoundingClientRect();
    const ctx = this.ctx;

    // 1. Clear background
    ctx.fillStyle = this.COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Petri Dish Container (glowing circular boundaries)
    const dishCx = this.offsetX + (this.grid.width * this.cellSize) / 2;
    const dishCy = this.offsetY + (this.grid.height * this.cellSize) / 2;
    const dishRadius = Math.max(this.grid.width, this.grid.height) * this.cellSize * 0.72;

    ctx.save();
    const dishGrd = ctx.createRadialGradient(dishCx, dishCy, dishRadius * 0.8, dishCx, dishCy, dishRadius);
    dishGrd.addColorStop(0, 'rgba(10, 15, 30, 0)');
    dishGrd.addColorStop(1, 'rgba(30, 58, 138, 0.15)');
    ctx.fillStyle = dishGrd;
    ctx.beginPath();
    ctx.arc(dishCx, dishCy, dishRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = this.COLORS.dishBorder;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // 3. Draw Grid Lines
    ctx.strokeStyle = this.COLORS.gridLines;
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.grid.width; x++) {
      const start = this.gridToCanvas(x, 0);
      const end = this.gridToCanvas(x, this.grid.height);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    for (let y = 0; y <= this.grid.height; y++) {
      const start = this.gridToCanvas(0, y);
      const end = this.gridToCanvas(this.grid.width, y);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // 4. Draw Walls
    this.grid.walls.forEach(wall => {
      const pos = this.gridToCanvas(wall.x, wall.y);
      ctx.save();
      
      // Draw dark block
      ctx.fillStyle = this.COLORS.wallFill;
      ctx.strokeStyle = this.COLORS.wallStroke;
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      this.roundRect(ctx, pos.x + 3, pos.y + 3, this.cellSize - 6, this.cellSize - 6, 8);
      ctx.fill();
      ctx.stroke();

      // Inner diagonal hatching for warning block look
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pos.x + 8, pos.y + this.cellSize - 8);
      ctx.lineTo(pos.x + this.cellSize - 8, pos.y + 8);
      ctx.moveTo(pos.x + 8, pos.y + 8);
      ctx.lineTo(pos.x + this.cellSize - 8, pos.y + this.cellSize - 8);
      ctx.stroke();

      ctx.restore();
    });

    // 5. Draw Cells
    this.grid.cells.forEach(cell => {
      if (cell.state === 'dead') return;
      this.drawCell(cell, selectedCell === cell, hoveredCell === cell);
    });

    // 6. Draw Particles
    this.particles.particles.forEach(p => {
      this.drawParticle(p);
    });

    // 7. Draw Hover placement outline if not simulating
    if (!isSimulating && hoveredCell === null && currentInjection !== null) {
      const mousePos = this.getMouseCoords();
      if (mousePos) {
        const gridPos = this.canvasToGrid(mousePos.x, mousePos.y);
        if (gridPos && !this.grid.isWallAt(gridPos.x, gridPos.y)) {
          const pos = this.gridToCanvas(Math.floor(gridPos.x), Math.floor(gridPos.y));
          
          ctx.save();
          ctx.strokeStyle = this.COLORS[currentInjection];
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          
          // Draw targeting square
          ctx.beginPath();
          ctx.arc(pos.x + this.cellSize / 2, pos.y + this.cellSize / 2, this.cellSize * 0.4, 0, Math.PI * 2);
          ctx.stroke();

          // Syringe/injection indicator
          ctx.fillStyle = this.COLORS[currentInjection];
          ctx.font = '10px "Share Tech Mono"';
          ctx.textAlign = 'center';
          ctx.fillText(`INJECT: ${currentInjection}`, pos.x + this.cellSize / 2, pos.y - 6);
          ctx.restore();
        }
      }
    }
  }

  private drawCell(cell: GridCell, isSelected: boolean, isHovered: boolean) {
    const ctx = this.ctx;
    const pos = this.gridToCanvas(cell.x, cell.y);
    const cx = pos.x + this.cellSize / 2;
    const cy = pos.y + this.cellSize / 2;
    const r = this.cellSize * 0.38;

    ctx.save();

    // 1. Draw outer glowing boundary for cell
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.COLORS[cell.genome.trigger];
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset shadow

    // 2. Draw color-coded gene slots around cell edge (four quarters)
    // Top-Left: Trigger Gene
    ctx.strokeStyle = this.COLORS[cell.genome.trigger];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, Math.PI, Math.PI * 1.5);
    ctx.stroke();

    // Top-Right: Action Gene
    ctx.strokeStyle = '#ffffff'; // White for biological actions
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, Math.PI * 1.5, Math.PI * 2);
    ctx.stroke();

    // Bottom-Right: Release Gene
    ctx.strokeStyle = this.COLORS[cell.genome.release];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 0.5);
    ctx.stroke();

    // Bottom-Left: Modifier Gene
    // Make modifier colored based on its type:
    let modifierColor = '#475569'; // Slate for NONE
    if (cell.genome.modifier === 'DUAL') modifierColor = '#f59e0b'; // Amber
    if (cell.genome.modifier === 'DELAY') modifierColor = '#10b981'; // Emerald
    if (cell.genome.modifier === 'CHAIN') modifierColor = '#ef4444'; // Red/Chain
    
    ctx.strokeStyle = modifierColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, Math.PI * 0.5, Math.PI);
    ctx.stroke();

    // 3. Draw Cell symbol in center
    this.drawActionSymbol(ctx, cx, cy, cell.genome.action, r * 0.5);

    // 4. Draw outer Modifier ring modifiers
    if (cell.genome.modifier !== 'NONE') {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = modifierColor;

      if (cell.genome.modifier === 'DUAL') {
        // Double ring
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (cell.genome.modifier === 'DELAY') {
        // Dotted clock-like outer ring
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (cell.genome.modifier === 'CHAIN') {
        // Spiked gear shape
        ctx.beginPath();
        const spikes = 8;
        const outerR = r + 6;
        const innerR = r + 3;
        for (let i = 0; i < spikes * 2; i++) {
          const angle = (i / spikes) * Math.PI;
          const currR = i % 2 === 0 ? outerR : innerR;
          const sx = cx + Math.cos(angle) * currR;
          const sy = cy + Math.sin(angle) * currR;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // 5. Draw Target Indicator
    if (cell.isTarget) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Draw outer crosshairs on target cell
      ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs ticks
      ctx.beginPath();
      ctx.moveTo(cx - r - 12, cy); ctx.lineTo(cx - r - 6, cy);
      ctx.moveTo(cx + r + 6, cy);  ctx.lineTo(cx + r + 12, cy);
      ctx.moveTo(cx, cy - r - 12); ctx.lineTo(cx, cy - r - 6);
      ctx.moveTo(cx, cy + r + 6);  ctx.lineTo(cx, cy + r + 12);
      ctx.stroke();
      
      // Target Label
      ctx.fillStyle = '#ef4444';
      ctx.font = '8px "Share Tech Mono"';
      ctx.textAlign = 'center';
      ctx.fillText("HOST", cx, cy + r + 20);
    }

    // 6. Draw selection/hover highlights
    if (isSelected) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.stroke();

      // Floating indicator
      const angle = (this.animationFrame * 0.03) % (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(cx, cy, r + 10, angle, angle + Math.PI * 0.5);
      ctx.stroke();
    } else if (isHovered) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 7. Draw editable indicator (small green dot on editable cells)
    if (cell.isEditable) {
      ctx.fillStyle = '#39ff14';
      ctx.beginPath();
      ctx.arc(cx - r + 3, cy - r + 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Draw countdown for delay timer
    if (cell.state === 'triggered' && cell.triggerTimer > 0) {
      const progress = cell.triggerTimer / cell.maxTriggerTimer;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 5, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * progress);
      ctx.stroke();

      // Show tiny ticks remaining
      ctx.fillStyle = '#10b981';
      ctx.font = '10px "Share Tech Mono"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.ceil(cell.triggerTimer / 60 * 10) / 10 + 's', cx, cy);
    }

    ctx.restore();
  }

  private drawActionSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, action: ActionType, size: number) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (action) {
      case 'BURST':
        // A clean starburst pattern
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          ctx.moveTo(cx + Math.cos(angle) * (size * 0.3), cy + Math.sin(angle) * (size * 0.3));
          ctx.lineTo(cx + Math.cos(angle) * size, cy + Math.sin(angle) * size);
        }
        ctx.stroke();
        break;

      case 'SHOOT':
        // A crosshair with cardinal points
        ctx.beginPath();
        ctx.moveTo(cx - size, cy); ctx.lineTo(cx + size, cy);
        ctx.moveTo(cx, cy - size); ctx.lineTo(cx, cy + size);
        ctx.stroke();
        // Inner square
        ctx.strokeRect(cx - size * 0.4, cy - size * 0.4, size * 0.8, size * 0.8);
        break;

      case 'SPLIT':
        // Left/Right division arrows
        ctx.beginPath();
        // Horizontal bar
        ctx.moveTo(cx - size, cy);
        ctx.lineTo(cx + size, cy);
        // Left arrow head
        ctx.moveTo(cx - size + 3, cy - 3);
        ctx.lineTo(cx - size, cy);
        ctx.lineTo(cx - size + 3, cy + 3);
        // Right arrow head
        ctx.moveTo(cx + size - 3, cy - 3);
        ctx.lineTo(cx + size, cy);
        ctx.lineTo(cx + size - 3, cy + 3);
        ctx.stroke();
        break;

      case 'MUTATE':
        // Biohazard triangle-like structure
        ctx.beginPath();
        ctx.arc(cx, cy - size * 0.3, size * 0.3, 0, Math.PI * 2);
        ctx.arc(cx - size * 0.3, cy + size * 0.3, size * 0.3, 0, Math.PI * 2);
        ctx.arc(cx + size * 0.3, cy + size * 0.3, size * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'GROW':
        // Plus symbol / Leaf structure
        ctx.beginPath();
        ctx.moveTo(cx, cy - size); ctx.lineTo(cx, cy + size);
        ctx.moveTo(cx - size, cy); ctx.lineTo(cx + size, cy);
        ctx.stroke();
        break;
    }
  }

  private drawParticle(p: Particle) {
    const ctx = this.ctx;
    const color = this.COLORS[p.type];

    ctx.save();
    
    // Draw fading trail
    if (p.trail.length > 1) {
      ctx.beginPath();
      const startPos = this.gridToCanvas(p.trail[0].x, p.trail[0].y);
      ctx.moveTo(startPos.x, startPos.y);
      
      for (let j = 1; j < p.trail.length; j++) {
        const pt = this.gridToCanvas(p.trail[j].x, p.trail[j].y);
        ctx.lineTo(pt.x, pt.y);
      }
      
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.25 * p.life;
      ctx.lineWidth = p.size * 0.6;
      ctx.stroke();
    }

    // Draw particle core
    const pos = this.gridToCanvas(p.x, p.y);
    ctx.fillStyle = color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, p.size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private getMouseCoords(): { x: number; y: number } | null {
    // This will be resolved in main controller, keeping tracking of actual client position
    return (this.canvas as any)._lastMousePos || null;
  }
}
