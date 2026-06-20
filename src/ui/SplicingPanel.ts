import { GridCell } from '../engine/Grid';
import { Level, TriggerType, ActionType, ReleaseType, ModifierType, GeneType, Genome } from '../data/levels';
import { audio } from '../utils/AudioSynth';

export class SplicingPanel {
  private container: HTMLElement;
  private currentCell: GridCell | null = null;
  private currentLevel: Level | null = null;
  private activeSlot: GeneType | null = null;
  private onGenomeChanged: (() => void) | null = null;

  // Gene explanations
  private readonly DESCRIPTIONS = {
    HEAT: "Triggers when hit by Heat/Fire sparks. Releases thermal particles.",
    TOXIN: "Triggers when hit by Toxin/Acid droplets. Releases poisonous particles.",
    SHOCK: "Triggers when hit by Shock/Electrical arcs. Releases conductive energy.",
    IMPACT: "Triggers on physical collision or any explosion. Launches kinetic energy.",
    
    BURST: "Releases a radial burst of particles (8 directions, or 16 if DUAL).",
    SHOOT: "Fires high-velocity projectiles in cardinal directions.",
    SPLIT: "Splits into two sliding daughter cells moving in opposite directions.",
    MUTATE: "Mutates and triggers all adjacent cells to match this genome.",
    GROW: "Breeds new cells of the same type in adjacent empty slots.",
    
    NONE: "Standard behaviour without modifications.",
    DUAL: "Doubles the number of particles or entities released.",
    DELAY: "Delays cell activation by 1.5 seconds, great for timing chain reactions.",
    CHAIN: "Boosts particle velocity, size, and lifetime for penetration."
  };

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container with id ${containerId} not found`);
    this.container = el;
    this.hide();
  }

  show(cell: GridCell, level: Level, onGenomeChanged: () => void) {
    this.currentCell = cell;
    this.currentLevel = level;
    this.onGenomeChanged = onGenomeChanged;
    this.container.classList.remove('hidden');
    this.container.classList.add('visible');
    this.activeSlot = 'trigger'; // default active slot
    this.render();
  }

  hide() {
    this.currentCell = null;
    this.currentLevel = null;
    this.activeSlot = null;
    this.container.classList.remove('visible');
    this.container.classList.add('hidden');
  }

  private render() {
    if (!this.currentCell || !this.currentLevel) return;

    const cell = this.currentCell;
    const genome = cell.genome;

    this.container.innerHTML = `
      <div class="splicer-header">
        <h3>GENE SPLICER: CELL NODE</h3>
        <button id="splicer-close-btn" class="close-btn">&times;</button>
      </div>
      
      <div class="splicer-dna-display">
        <div class="splicer-helix-svg">
          <svg viewBox="0 0 100 30" width="100%" height="30">
            <path d="M 0,15 C 25,0 25,30 50,15 C 75,0 75,30 100,15" fill="none" stroke="rgba(59, 130, 246, 0.4)" stroke-width="2"/>
            <path d="M 0,15 C 25,30 25,0 50,15 C 75,30 75,0 100,15" fill="none" stroke="rgba(16, 185, 129, 0.4)" stroke-width="2"/>
            <!-- DNA Rungs -->
            <line x1="12.5" y1="8" x2="12.5" y2="22" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
            <line x1="37.5" y1="8" x2="37.5" y2="22" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
            <line x1="62.5" y1="8" x2="62.5" y2="22" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
            <line x1="87.5" y1="8" x2="87.5" y2="22" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
          </svg>
        </div>
      </div>

      <div class="splicer-genome-slots">
        <div class="gene-slot ${this.activeSlot === 'trigger' ? 'active' : ''}" data-slot="trigger" style="--glow-color: ${this.getGeneColor(genome.trigger)}">
          <span class="gene-slot-label">TRIGGER</span>
          <span class="gene-value text-glow" style="color: ${this.getGeneColor(genome.trigger)}">${genome.trigger}</span>
        </div>
        
        <div class="gene-slot ${this.activeSlot === 'action' ? 'active' : ''}" data-slot="action" style="--glow-color: #ffffff">
          <span class="gene-slot-label">ACTION</span>
          <span class="gene-value text-glow" style="color: #ffffff">${genome.action}</span>
        </div>

        <div class="gene-slot ${this.activeSlot === 'release' ? 'active' : ''}" data-slot="release" style="--glow-color: ${this.getGeneColor(genome.release)}">
          <span class="gene-slot-label">RELEASE</span>
          <span class="gene-value text-glow" style="color: ${this.getGeneColor(genome.release)}">${genome.release}</span>
        </div>

        <div class="gene-slot ${this.activeSlot === 'modifier' ? 'active' : ''}" data-slot="modifier" style="--glow-color: ${this.getModifierColor(genome.modifier)}">
          <span class="gene-slot-label">MODIFIER</span>
          <span class="gene-value text-glow" style="color: ${this.getModifierColor(genome.modifier)}">${genome.modifier}</span>
        </div>
      </div>

      <div class="splicer-pool-section">
        <div class="pool-title">AVAILABLE ALLELES (INVENTORY)</div>
        <div id="gene-pool" class="gene-pool">
          <!-- Pool items rendered dynamically -->
        </div>
      </div>

      <div id="gene-desc" class="gene-description">
        Select a gene slot to view and splice genes.
      </div>
    `;

    // Add close event
    document.getElementById('splicer-close-btn')?.addEventListener('click', () => {
      audio.playClick();
      this.hide();
      this.onGenomeChanged?.();
    });

    // Add slot click events
    this.container.querySelectorAll('.gene-slot').forEach(el => {
      el.addEventListener('click', (e) => {
        audio.playClick();
        const slot = (e.currentTarget as HTMLElement).getAttribute('data-slot') as GeneType;
        this.activeSlot = slot;
        this.render();
      });
    });

    this.renderPool();
  }

  private renderPool() {
    if (!this.currentCell || !this.currentLevel || !this.activeSlot) return;

    const poolContainer = document.getElementById('gene-pool');
    if (!poolContainer) return;

    const slot = this.activeSlot;
    const inventoryOptions = this.currentLevel.inventory[slot] as string[];
    const currentValue = this.currentCell.genome[slot];

    let html = '';
    
    if (inventoryOptions.length === 0) {
      html = `<div class="pool-empty">No alleles in splicing pool.</div>`;
    } else {
      inventoryOptions.forEach(opt => {
        const isCurrent = opt === currentValue;
        const color = slot === 'trigger' || slot === 'release' 
          ? this.getGeneColor(opt) 
          : slot === 'modifier' ? this.getModifierColor(opt) : '#ffffff';

        html += `
          <button class="pool-item ${isCurrent ? 'selected' : ''}" data-value="${opt}" style="--item-color: ${color}">
            <span class="pool-item-name" style="color: ${color}">${opt}</span>
          </button>
        `;
      });
    }

    poolContainer.innerHTML = html;

    // Add pool item hover and click events
    poolContainer.querySelectorAll('.pool-item').forEach(el => {
      const val = el.getAttribute('data-value')!;
      
      // Hover event for explanations
      el.addEventListener('mouseenter', () => {
        const descContainer = document.getElementById('gene-desc');
        if (descContainer) {
          descContainer.innerHTML = `<strong>${val}</strong>: ${this.DESCRIPTIONS[val as keyof typeof this.DESCRIPTIONS] || ''}`;
        }
      });

      // Splicing action
      el.addEventListener('click', () => {
        if (val !== currentValue) {
          audio.playMutate();
          (this.currentCell!.genome as any)[slot] = val;
          this.render();
          this.onGenomeChanged?.();
        }
      });
    });

    // Default description for currently selected slot gene
    const descContainer = document.getElementById('gene-desc');
    if (descContainer && currentValue) {
      descContainer.innerHTML = `<strong>${currentValue} (Active)</strong>: ${this.DESCRIPTIONS[currentValue as keyof typeof this.DESCRIPTIONS] || ''}`;
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
    if (mod === 'DUAL') return '#f59e0b'; // Amber
    if (mod === 'DELAY') return '#10b981'; // Emerald
    if (mod === 'CHAIN') return '#ef4444'; // Red
    return '#475569'; // Slate
  }
}
