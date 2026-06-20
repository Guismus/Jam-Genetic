import { Level, LEVELS, TriggerType, Genome } from '../data/levels';
import { Grid, GridCell } from '../engine/Grid';
import { ParticleSystem } from '../engine/ParticleSystem';
import { Simulation } from '../engine/Simulation';
import { CanvasRenderer } from './CanvasRenderer';
import { SplicingPanel } from './SplicingPanel';
import { audio } from '../utils/AudioSynth';

export class GameUI {
  private grid: Grid;
  private particles: ParticleSystem;
  private sim: Simulation;
  private renderer!: CanvasRenderer;
  private splicer!: SplicingPanel;

  // View States
  private currentScreen: 'menu' | 'levels' | 'game' = 'menu';
  private selectedLevel: Level | null = null;
  private isSandbox: boolean = false;
  
  // Simulation control states
  private selectedInjection: TriggerType | null = null;
  private isSimulating: boolean = false;
  private speedMultiplier: number = 1;
  private selectedCell: GridCell | null = null;
  private hoveredCell: GridCell | null = null;
  private isMuted: boolean = false;

  // DOM Elements
  private menuScreen!: HTMLElement;
  private levelsScreen!: HTMLElement;
  private gameScreen!: HTMLElement;
  private winModal!: HTMLElement;
  private loseModal!: HTMLElement;

  constructor() {
    this.grid = new Grid();
    this.particles = new ParticleSystem();
    this.sim = new Simulation(this.grid, this.particles);
    
    // Connect simulation callbacks
    this.sim.onCellTriggered = () => {
      audio.playSpark();
    };
    this.sim.onCellExploded = () => {
      audio.playExplosion();
    };
    this.sim.onSimulationEnd = (success) => {
      this.handleSimulationEnd(success);
    };

    // Initialize immediately — module scripts are deferred and run after DOM parsing.
    // DOMContentLoaded may have already fired by the time Vite finishes async module loading.
    const boot = () => {
      this.initDOMElements();
      this.initEvents();
      this.showScreen('menu');
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  private initDOMElements() {
    this.menuScreen = document.getElementById('menu-screen')!;
    this.levelsScreen = document.getElementById('levels-screen')!;
    this.gameScreen = document.getElementById('game-screen')!;
    this.winModal = document.getElementById('win-modal')!;
    this.loseModal = document.getElementById('lose-modal')!;

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new CanvasRenderer(canvas, this.grid, this.particles);
    this.splicer = new SplicingPanel('splicer-panel');

    // Make canvas responsive
    window.addEventListener('resize', () => {
      if (this.currentScreen === 'game') {
        this.renderer.resize();
      }
    });
  }

  private initEvents() {
    // 1. Menu Buttons
    document.getElementById('play-btn')?.addEventListener('click', () => {
      audio.playClick();
      audio.startAmbientDrone();
      this.showScreen('levels');
    });

    document.getElementById('sandbox-btn')?.addEventListener('click', () => {
      audio.playClick();
      audio.startAmbientDrone();
      this.startSandbox();
    });

    // 2. Level Selector Buttons
    document.getElementById('levels-back-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.showScreen('menu');
    });

    // 3. HUD Controls
    document.getElementById('hud-back-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.stopSimulation();
      this.showScreen('levels');
    });

    document.getElementById('hud-reset-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.resetLevelState();
    });

    const speedBtn = document.getElementById('hud-speed-btn')!;
    speedBtn.addEventListener('click', () => {
      audio.playClick();
      if (this.speedMultiplier === 1) {
        this.speedMultiplier = 2.5;
        speedBtn.innerHTML = '⚡ SPEED: 2.5x';
        speedBtn.classList.add('active');
      } else {
        this.speedMultiplier = 1;
        speedBtn.innerHTML = '▶ SPEED: 1.0x';
        speedBtn.classList.remove('active');
      }
    });

    const muteBtn = document.getElementById('hud-mute-btn')!;
    muteBtn.addEventListener('click', () => {
      this.isMuted = audio.toggleMute();
      if (this.isMuted) {
        muteBtn.innerHTML = '🔇 MUTED';
        muteBtn.classList.add('muted');
      } else {
        muteBtn.innerHTML = '🔊 SOUND';
        muteBtn.classList.remove('muted');
        audio.playClick();
      }
    });

    // 4. Modal Overlays Buttons
    document.getElementById('win-next-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.winModal.classList.add('hidden');
      if (this.isSandbox) {
        this.startSandbox();
      } else if (this.selectedLevel) {
        const nextId = this.selectedLevel.id + 1;
        const nextLevel = LEVELS.find(l => l.id === nextId);
        if (nextLevel) {
          this.loadLevel(nextLevel);
        } else {
          this.showScreen('levels');
        }
      }
    });

    document.getElementById('lose-retry-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.loseModal.classList.add('hidden');
      this.resetLevelState();
    });

    document.getElementById('win-menu-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.winModal.classList.add('hidden');
      this.showScreen('levels');
    });

    document.getElementById('lose-menu-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.loseModal.classList.add('hidden');
      this.showScreen('levels');
    });

    // 5. Canvas Interactions (Click/Hover/Selection)
    const canvas = this.renderer.canvas;
    
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      (canvas as any)._lastMousePos = { x: cx, y: cy };

      const gridPos = this.renderer.canvasToGrid(cx, cy);
      if (gridPos) {
        const cell = this.grid.getCellAt(gridPos.x, gridPos.y);
        this.updateHover(cell);
      } else {
        this.updateHover(null);
      }
    });

    canvas.addEventListener('mouseleave', () => {
      (canvas as any)._lastMousePos = null;
      this.updateHover(null);
    });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const gridPos = this.renderer.canvasToGrid(cx, cy);

      if (!gridPos) return;

      const roundedX = Math.floor(gridPos.x);
      const roundedY = Math.floor(gridPos.y);

      // A. If simulating: clicks do nothing
      if (this.isSimulating) return;

      // B. Sandbox Placement Tools (Add Cell / Add Wall / Delete)
      if (this.isSandbox && !this.selectedInjection) {
        const activeTool = this.getSandboxTool();
        if (activeTool === 'wall') {
          audio.playClick();
          if (this.grid.isWallAt(roundedX, roundedY)) {
            this.grid.walls = this.grid.walls.filter(w => w.x !== roundedX || w.y !== roundedY);
          } else if (this.grid.isEmptyAt(roundedX, roundedY)) {
            this.grid.walls.push({ x: roundedX, y: roundedY });
          }
          return;
        } else if (activeTool === 'cell') {
          audio.playClick();
          if (this.grid.isEmptyAt(roundedX, roundedY)) {
            const defaultGenome: Genome = { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' };
            const newCell = this.grid.addCell(roundedX, roundedY, defaultGenome, true, false);
            if (newCell) {
              this.selectCell(newCell);
            }
          }
          return;
        } else if (activeTool === 'delete') {
          audio.playClick();
          const targetCell = this.grid.getCellAt(roundedX, roundedY);
          if (targetCell) {
            this.grid.cells = this.grid.cells.filter(c => c.id !== targetCell.id);
            if (this.selectedCell === targetCell) {
              this.selectCell(null);
            }
          }
          if (this.grid.isWallAt(roundedX, roundedY)) {
            this.grid.walls = this.grid.walls.filter(w => w.x !== roundedX || w.y !== roundedY);
          }
          return;
        }
      }

      // C. Splicing Selection
      const cell = this.grid.getCellAt(roundedX, roundedY);
      if (cell) {
        if (!this.selectedInjection) {
          if (cell.isEditable || this.isSandbox) {
            audio.playClick();
            this.selectCell(cell);
          }
        }
      }

      // D. Stimulus Injection Trigger
      if (this.selectedInjection) {
        if (!this.grid.isWallAt(roundedX, roundedY)) {
          this.injectStimulus(roundedX, roundedY, this.selectedInjection);
        }
      }
    });

    // Start render/physics loop
    this.gameLoop();
  }

  private showScreen(screen: 'menu' | 'levels' | 'game') {
    this.currentScreen = screen;
    this.menuScreen.classList.add('hidden');
    this.levelsScreen.classList.add('hidden');
    this.gameScreen.classList.add('hidden');

    if (screen === 'menu') {
      this.menuScreen.classList.remove('hidden');
      audio.stopAmbientDrone();
    } else if (screen === 'levels') {
      this.levelsScreen.classList.remove('hidden');
      this.renderLevelList();
    } else if (screen === 'game') {
      this.gameScreen.classList.remove('hidden');
      // Use rAF to ensure DOM layout is computed before measuring
      requestAnimationFrame(() => {
        this.renderer.resize();
      });
    }
  }

  private renderLevelList() {
    const listContainer = document.getElementById('levels-grid')!;
    let html = '';

    LEVELS.forEach(level => {
      html += `
        <div class="level-card glass">
          <div class="level-id">DNA MATRIX #${level.id}</div>
          <div class="level-name">${level.name}</div>
          <div class="level-desc">${level.description}</div>
          <div class="level-objective"><strong>Goal:</strong> ${level.objective}</div>
          <button class="level-play-btn neon-btn" data-id="${level.id}">INITIATE LAB</button>
        </div>
      `;
    });

    listContainer.innerHTML = html;

    listContainer.querySelectorAll('.level-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        audio.playClick();
        const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-id')!);
        const lvl = LEVELS.find(l => l.id === id);
        if (lvl) this.loadLevel(lvl);
      });
    });
  }

  private loadLevel(level: Level) {
    this.selectedLevel = level;
    this.isSandbox = false;
    this.isSimulating = false;
    this.selectedInjection = null;
    this.selectedCell = null;
    this.hoveredCell = null;
    this.splicer.hide();
    
    // Hide sandbox toolbar
    document.getElementById('sandbox-toolbar')?.classList.add('hidden');

    this.grid.initialize(level);
    this.showScreen('game');
    this.resetHUDValues();
    this.renderHUDInfo();
  }

  private startSandbox() {
    this.isSandbox = true;
    this.selectedLevel = null;
    this.isSimulating = false;
    this.selectedInjection = null;
    this.selectedCell = null;
    this.hoveredCell = null;
    this.splicer.hide();

    // Create a mock Sandbox level config
    const sandboxConfig: Level = {
      id: 0,
      name: "GENETIC SANDBOX",
      description: "Infinite lab experiment. Place cells, splice anything, and test reactions.",
      width: 10,
      height: 10,
      allowedInjections: ['HEAT', 'TOXIN', 'SHOCK', 'IMPACT'],
      inventory: {
        trigger: ['HEAT', 'TOXIN', 'SHOCK', 'IMPACT'],
        action: ['BURST', 'SHOOT', 'SPLIT', 'MUTATE', 'GROW'],
        release: ['HEAT', 'TOXIN', 'SHOCK', 'IMPACT'],
        modifier: ['NONE', 'DUAL', 'DELAY', 'CHAIN']
      },
      objective: "No strict objective. Build whatever you want!",
      objectiveType: "min_chain",
      objectiveValue: 999,
      cells: [
        { x: 3, y: 5, isEditable: true, genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' } },
        { x: 6, y: 5, isEditable: true, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } }
      ],
      walls: []
    };

    // Show sandbox toolbar
    document.getElementById('sandbox-toolbar')?.classList.remove('hidden');
    this.initSandboxToolbar();

    this.grid.initialize(sandboxConfig);
    this.showScreen('game');
    this.resetHUDValues();
    this.renderHUDInfo();
  }

  private initSandboxToolbar() {
    const tools = document.querySelectorAll('.sandbox-tool');
    tools.forEach(tool => {
      tool.addEventListener('click', (e) => {
        audio.playClick();
        tools.forEach(t => t.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
        this.selectedInjection = null; // deselect active injector
        this.renderInjectionButtons();
      });
    });
  }

  private getSandboxTool(): 'select' | 'cell' | 'wall' | 'delete' {
    const active = document.querySelector('.sandbox-tool.active');
    if (!active) return 'select';
    return active.getAttribute('data-tool') as any;
  }

  private renderHUDInfo() {
    if (!this.grid) return;

    const titleEl = document.getElementById('hud-level-title')!;
    const descEl = document.getElementById('hud-level-desc')!;
    const goalEl = document.getElementById('hud-goal-text')!;
    const progressEl = document.getElementById('hud-goal-progress')!;

    if (this.isSandbox) {
      titleEl.innerHTML = "SANDBOX SIMULATION";
      descEl.innerHTML = "Free bio-engineering lab workspace.";
      goalEl.innerHTML = "Sandbox Mode: Design and simulate custom pathways.";
      progressEl.innerHTML = "Progress: N/A";
    } else if (this.selectedLevel) {
      const lvl = this.selectedLevel;
      titleEl.innerHTML = `${lvl.name}`;
      descEl.innerHTML = `${lvl.description}`;
      goalEl.innerHTML = `${lvl.objective}`;
      this.updateProgressHUD();
    }

    this.renderInjectionButtons();
  }

  private renderInjectionButtons() {
    const container = document.getElementById('injection-selector')!;
    let html = '';

    const allowed = this.isSandbox 
      ? ['HEAT', 'TOXIN', 'SHOCK', 'IMPACT'] as TriggerType[]
      : this.selectedLevel?.allowedInjections || [];

    allowed.forEach(type => {
      const isActive = this.selectedInjection === type;
      html += `
        <button class="inject-btn type-${type} ${isActive ? 'active' : ''}" data-type="${type}">
          INJECT ${type}
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.inject-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        audio.playClick();
        const type = (e.currentTarget as HTMLElement).getAttribute('data-type') as TriggerType;
        
        // Deactivate sandbox placing tools if any
        if (this.isSandbox) {
          document.querySelectorAll('.sandbox-tool').forEach(t => t.classList.remove('active'));
          document.querySelector('[data-tool="select"]')?.classList.add('active');
        }

        if (this.selectedInjection === type) {
          this.selectedInjection = null;
        } else {
          this.selectedInjection = type;
        }
        this.renderInjectionButtons();
      });
    });
  }

  private selectCell(cell: GridCell | null) {
    this.selectedCell = cell;
    if (cell && (this.isSandbox || cell.isEditable)) {
      const level = this.isSandbox ? {
        inventory: {
          trigger: ['HEAT', 'TOXIN', 'SHOCK', 'IMPACT'],
          action: ['BURST', 'SHOOT', 'SPLIT', 'MUTATE', 'GROW'],
          release: ['HEAT', 'TOXIN', 'SHOCK', 'IMPACT'],
          modifier: ['NONE', 'DUAL', 'DELAY', 'CHAIN']
        }
      } as any : this.selectedLevel!;

      this.splicer.show(cell, level, () => {
        // genome was changed — no need to force draw, gameLoop handles it
      });
    } else {
      this.splicer.hide();
    }
  }

  private updateHover(cell: GridCell | null) {
    this.hoveredCell = cell;

    const tooltip = document.getElementById('cell-tooltip')!;
    if (cell && !this.isSimulating) {
      const pos = this.renderer.gridToCanvas(cell.x, cell.y);
      const canvasRect = this.renderer.canvas.getBoundingClientRect();

      // Show details tooltip
      tooltip.classList.remove('hidden');
      tooltip.classList.add('visible');
      tooltip.style.left = `${canvasRect.left + pos.x + this.renderer.cellSize / 2}px`;
      tooltip.style.top = `${canvasRect.top + pos.y - 10}px`;

      const g = cell.genome;
      const triggerColor = this.getGeneColor(g.trigger);
      const releaseColor = this.getGeneColor(g.release);
      const modColor = this.getModifierColor(g.modifier);
      tooltip.innerHTML = `
        <div class="tip-header">${cell.isTarget ? 'TARGET HOST CELL' : cell.isEditable ? 'EDITABLE CELL' : 'LOCKED BIO-CELL'}</div>
        <div class="tip-genome">
          <span style="color: ${triggerColor}">${g.trigger}</span> ➔
          <span style="color: #ffffff">${g.action}</span> ➔
          <span style="color: ${releaseColor}">${g.release}</span>
          ${g.modifier !== 'NONE' ? `<br><span style="color: ${modColor}">[${g.modifier}]</span>` : ''}
        </div>
      `;
    } else {
      tooltip.classList.remove('visible');
      tooltip.classList.add('hidden');
    }
  }

  private getGeneColor(type: string): string {
    if (type === 'HEAT') return '#ff5722';
    if (type === 'TOXIN') return '#39ff14';
    if (type === 'SHOCK') return '#00f0ff';
    if (type === 'IMPACT') return '#d946ef';
    return '#ffffff';
  }

  private getModifierColor(mod: string): string {
    if (mod === 'DUAL') return '#f59e0b';
    if (mod === 'DELAY') return '#10b981';
    if (mod === 'CHAIN') return '#ef4444';
    return '#475569';
  }

  private injectStimulus(x: number, y: number, type: TriggerType) {
    if (!this.selectedLevel && !this.isSandbox) return;
    
    this.isSimulating = true;
    this.selectCell(null);
    this.selectedInjection = null;
    this.renderInjectionButtons();
    
    const level = this.isSandbox ? { width: 10, height: 10 } as any : this.selectedLevel!;
    this.sim.start(level, { x, y }, type);
  }

  private handleSimulationEnd(success: boolean) {
    this.isSimulating = false;
    
    if (this.isSandbox) {
      // No end overlay in sandbox, let it float
      return;
    }

    setTimeout(() => {
      if (success) {
        audio.playWin();
        document.getElementById('win-energy')!.innerHTML = `${this.sim.energyGenerated} J`;
        document.getElementById('win-chain')!.innerHTML = `${this.sim.maxChainStep} levels`;
        this.winModal.classList.remove('hidden');
      } else {
        audio.playLose();
        this.loseModal.classList.remove('hidden');
      }
    }, 800);
  }

  private updateProgressHUD() {
    if (this.isSandbox || !this.selectedLevel) return;

    const progressEl = document.getElementById('hud-goal-progress')!;
    const type = this.selectedLevel.objectiveType;

    if (type === 'clear_all') {
      const living = this.grid.cells.filter(c => c.state !== 'dead').length;
      const total = this.grid.cells.length;
      progressEl.innerHTML = `Active cells remaining: ${living} / ${total}`;
    } else if (type === 'mutate_target') {
      const target = this.grid.cells.find(c => c.isTarget);
      const isMutated = target ? target.state === 'dead' || target.state === 'triggered' : false;
      progressEl.innerHTML = `Host Cell Infected: ${isMutated ? '<span class="text-success">YES</span>' : '<span class="text-danger">NO</span>'}`;
    } else if (type === 'min_energy') {
      const required = (this.selectedLevel.objectiveValue || 0) * 10;
      progressEl.innerHTML = `Kinetic energy generated: ${this.sim.energyGenerated} / ${required} J`;
    } else if (type === 'min_chain') {
      const required = this.selectedLevel.objectiveValue || 0;
      progressEl.innerHTML = `Chain reaction steps reached: ${this.sim.maxChainStep} / ${required}`;
    }
  }

  private resetLevelState() {
    this.stopSimulation();
    this.selectCell(null);
    this.selectedInjection = null;
    this.hoveredCell = null;

    if (this.isSandbox) {
      this.startSandbox();
    } else if (this.selectedLevel) {
      this.grid.initialize(this.selectedLevel);
    }
    
    this.resetHUDValues();
    this.renderHUDInfo();
  }

  private stopSimulation() {
    this.sim.stop();
    this.isSimulating = false;
  }

  private resetHUDValues() {
    this.speedMultiplier = 1;
    const speedBtn = document.getElementById('hud-speed-btn')!;
    speedBtn.innerHTML = '▶ SPEED: 1.0x';
    speedBtn.classList.remove('active');

    document.getElementById('stat-energy')!.innerHTML = '0 J';
    document.getElementById('stat-chain')!.innerHTML = '0';
  }

  private gameLoop() {
    try {
      // 1. Run physics / simulation updates
      if (this.isSimulating && this.sim.isRunning) {
        const loops = Math.ceil(this.speedMultiplier);
        for (let l = 0; l < loops; l++) {
          this.sim.update();
        }

        // Update live stats in HUD
        document.getElementById('stat-energy')!.innerHTML = `${this.sim.energyGenerated} J`;
        document.getElementById('stat-chain')!.innerHTML = `${this.sim.maxChainStep}`;
        this.updateProgressHUD();
      }

      // 2. Always draw when on the game screen
      if (this.currentScreen === 'game' && this.renderer) {
        // Auto-resize if layout not yet computed
        if (this.renderer.cellSize === 0 && this.grid.width > 0) {
          this.renderer.resize();
        }
        this.renderer.draw(this.hoveredCell, this.selectedCell, this.selectedInjection, this.isSimulating);
      }
    } catch (e) {
      console.error('Game loop error:', e);
    }

    requestAnimationFrame(() => this.gameLoop());
  }
}
