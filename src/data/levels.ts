export type GeneType = 'trigger' | 'action' | 'release' | 'modifier';

export type TriggerType = 'HEAT' | 'TOXIN' | 'SHOCK' | 'IMPACT';
export type ActionType = 'BURST' | 'SHOOT' | 'SPLIT' | 'MUTATE' | 'GROW';
export type ReleaseType = 'HEAT' | 'TOXIN' | 'SHOCK' | 'IMPACT';
export type ModifierType = 'NONE' | 'DUAL' | 'DELAY' | 'CHAIN';

export interface Genome {
  trigger: TriggerType;
  action: ActionType;
  release: ReleaseType;
  modifier: ModifierType;
}

export interface CellConfig {
  x: number;
  y: number;
  isEditable: boolean;
  isTarget?: boolean;
  genome: Genome;
}

export interface WallConfig {
  x: number;
  y: number;
}

export type ObjectiveType = 'clear_all' | 'mutate_target' | 'min_energy' | 'min_chain';

export interface Level {
  id: number;
  name: string;
  description: string;
  width: number;
  height: number;
  allowedInjections: TriggerType[];
  inventory: {
    trigger: TriggerType[];
    action: ActionType[];
    release: ReleaseType[];
    modifier: ModifierType[];
  };
  objective: string;
  objectiveType: ObjectiveType;
  objectiveValue?: number;
  cells: CellConfig[];
  walls: WallConfig[];
}

export const LEVELS: Level[] = [
  {
    id: 1,
    name: "Splicing 101",
    description: "The left cell doesn't respond to Heat — its trigger gene is set to SHOCK. Open the Gene Splicer (click the cell) and change the Trigger gene to HEAT so the chain reaction can begin.",
    width: 6,
    height: 6,
    allowedInjections: ['HEAT'],
    inventory: {
      trigger: ['HEAT', 'SHOCK'],
      action: ['BURST'],
      release: ['HEAT'],
      modifier: ['NONE']
    },
    objective: "Destroy all cells in the petri dish.",
    objectiveType: "clear_all",
    cells: [
      {
        x: 1,
        y: 3,
        isEditable: true,
        genome: { trigger: 'SHOCK', action: 'BURST', release: 'HEAT', modifier: 'NONE' }
      },
      {
        x: 4,
        y: 3,
        isEditable: false,
        genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' }
      }
    ],
    walls: []
  },
  {
    id: 2,
    name: "Cross-Catalysis",
    description: "Heat cannot trigger Toxin cells directly. Create a hybrid bridging cell that consumes Heat and releases Toxin to connect the reaction.",
    width: 8,
    height: 5,
    allowedInjections: ['HEAT'],
    inventory: {
      trigger: ['HEAT', 'TOXIN'],
      action: ['BURST', 'SHOOT'],
      release: ['TOXIN', 'HEAT'],
      modifier: ['NONE']
    },
    objective: "Destroy all cells in the petri dish.",
    objectiveType: "clear_all",
    cells: [
      {
        x: 1,
        y: 2,
        isEditable: false,
        genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' }
      },
      {
        x: 3,
        y: 2,
        isEditable: true,
        genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } // Needs to trigger on HEAT, release TOXIN
      },
      {
        x: 6,
        y: 2,
        isEditable: false,
        genome: { trigger: 'TOXIN', action: 'BURST', release: 'TOXIN', modifier: 'NONE' }
      }
    ],
    walls: []
  },
  {
    id: 3,
    name: "Infect the Host",
    description: "To cure the patient, you must mutate the central host cell using a MUTATE cell. It triggers on Shock.",
    width: 7,
    height: 7,
    allowedInjections: ['SHOCK'],
    inventory: {
      trigger: ['SHOCK', 'HEAT'],
      action: ['MUTATE', 'BURST'],
      release: ['SHOCK', 'HEAT'],
      modifier: ['NONE']
    },
    objective: "Mutate the central Target Host cell.",
    objectiveType: "mutate_target",
    cells: [
      {
        x: 1,
        y: 3,
        isEditable: true,
        genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' }
      },
      {
        x: 2,
        y: 3,
        isEditable: false,
        genome: { trigger: 'HEAT', action: 'MUTATE', release: 'HEAT', modifier: 'NONE' }
      },
      {
        x: 3,
        y: 3,
        isEditable: false,
        isTarget: true,
        genome: { trigger: 'IMPACT', action: 'GROW', release: 'HEAT', modifier: 'NONE' }
      }
    ],
    walls: [
      { x: 3, y: 2 },
      { x: 3, y: 4 }
    ]
  },
  {
    id: 4,
    name: "Obstacle Course",
    description: "Bones block free-flying particles. Use the SHOOT gene to project focused energy cards past the gap, or SPLIT to slide around them.",
    width: 9,
    height: 5,
    allowedInjections: ['TOXIN'],
    inventory: {
      trigger: ['TOXIN'],
      action: ['SHOOT', 'SPLIT'],
      release: ['TOXIN'],
      modifier: ['NONE']
    },
    objective: "Destroy all cells in the petri dish.",
    objectiveType: "clear_all",
    cells: [
      {
        x: 1,
        y: 2,
        isEditable: false,
        genome: { trigger: 'TOXIN', action: 'BURST', release: 'TOXIN', modifier: 'NONE' }
      },
      {
        x: 3,
        y: 2,
        isEditable: true,
        genome: { trigger: 'TOXIN', action: 'BURST', release: 'TOXIN', modifier: 'NONE' } // Change action to SHOOT to pass the barrier
      },
      {
        x: 7,
        y: 2,
        isEditable: false,
        genome: { trigger: 'TOXIN', action: 'BURST', release: 'TOXIN', modifier: 'NONE' }
      }
    ],
    walls: [
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 }
    ]
  },
  {
    id: 5,
    name: "Delayed Reaction",
    description: "Two cells in the center block each other's particles if they explode at the same time. Inject Heat, and use DELAY to stagger their explosions.",
    width: 8,
    height: 5,
    allowedInjections: ['HEAT'],
    inventory: {
      trigger: ['HEAT'],
      action: ['BURST'],
      release: ['HEAT'],
      modifier: ['NONE', 'DELAY']
    },
    objective: "Destroy all cells.",
    objectiveType: "clear_all",
    cells: [
      {
        x: 1,
        y: 2,
        isEditable: false,
        genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' }
      },
      {
        x: 3,
        y: 2,
        isEditable: true,
        genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' } // Needs DELAY
      },
      {
        x: 4,
        y: 2,
        isEditable: true,
        genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' }
      },
      {
        x: 6,
        y: 2,
        isEditable: false,
        genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' }
      }
    ],
    walls: []
  },
  {
    id: 6,
    name: "Super-Chain Breeder",
    description: "To reach the required energy threshold, you must amplify the reaction. Use the DUAL modifier to double the particles generated at each explosion.",
    width: 6,
    height: 6,
    allowedInjections: ['SHOCK'],
    inventory: {
      trigger: ['SHOCK'],
      action: ['BURST'],
      release: ['SHOCK'],
      modifier: ['NONE', 'DUAL']
    },
    objective: "Generate at least 80 units of kinetic energy (triggered cells).",
    objectiveType: "min_energy",
    objectiveValue: 8,
    cells: [
      { x: 1, y: 2, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 2, y: 3, isEditable: true, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 3, y: 2, isEditable: true, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 4, y: 3, isEditable: true, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 3, y: 4, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 4, y: 1, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 5, y: 2, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 2, y: 1, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } }
    ],
    walls: []
  },
  {
    id: 7,
    name: "The Growth Engine",
    description: "Some parts of the petri dish are empty. Use the GROW action to breed new cells that fill the spaces, continuing the chain reaction to the target.",
    width: 8,
    height: 6,
    allowedInjections: ['TOXIN'],
    inventory: {
      trigger: ['TOXIN'],
      action: ['GROW', 'BURST'],
      release: ['TOXIN'],
      modifier: ['NONE', 'DELAY']
    },
    objective: "Mutate the Target Host Cell at the far right.",
    objectiveType: "mutate_target",
    cells: [
      { x: 1, y: 3, isEditable: false, genome: { trigger: 'TOXIN', action: 'BURST', release: 'TOXIN', modifier: 'NONE' } },
      { x: 3, y: 2, isEditable: true, genome: { trigger: 'TOXIN', action: 'BURST', release: 'TOXIN', modifier: 'NONE' } }, // Grow cell
      { x: 6, y: 3, isEditable: false, isTarget: true, genome: { trigger: 'TOXIN', action: 'BURST', release: 'TOXIN', modifier: 'NONE' } }
    ],
    walls: [
      { x: 4, y: 1 },
      { x: 4, y: 3 },
      { x: 4, y: 4 },
      { x: 4, y: 5 }
    ]
  },
  {
    id: 8,
    name: "Resonance Cascade",
    description: "A chain reaction must reach 10 consecutive steps. Combine CHAIN modifiers (boosting speed & lifetime) and DUAL multipliers to reach the goal.",
    width: 7,
    height: 7,
    allowedInjections: ['SHOCK'],
    inventory: {
      trigger: ['SHOCK'],
      action: ['BURST', 'SHOOT'],
      release: ['SHOCK'],
      modifier: ['NONE', 'CHAIN', 'DUAL', 'DELAY']
    },
    objective: "Trigger a chain reaction of at least 10 steps.",
    objectiveType: "min_chain",
    objectiveValue: 10,
    cells: [
      { x: 1, y: 1, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 2, y: 2, isEditable: true, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 3, y: 1, isEditable: true, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 4, y: 2, isEditable: true, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 5, y: 3, isEditable: true, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 4, y: 4, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 3, y: 5, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 2, y: 4, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 1, y: 5, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 2, y: 6, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 4, y: 6, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } }
    ],
    walls: []
  },
  {
    id: 9,
    name: "Genetic Maze",
    description: "The cells are trapped in a maze. You can only edit two key nodes. Splice them to shoot in the right direction to navigate the labyrinth.",
    width: 8,
    height: 8,
    allowedInjections: ['HEAT'],
    inventory: {
      trigger: ['HEAT', 'SHOCK'],
      action: ['SHOOT', 'SPLIT'],
      release: ['HEAT', 'SHOCK'],
      modifier: ['NONE', 'DELAY']
    },
    objective: "Destroy all cells.",
    objectiveType: "clear_all",
    cells: [
      { x: 1, y: 1, isEditable: false, genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' } },
      { x: 1, y: 4, isEditable: true, genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' } },
      { x: 4, y: 4, isEditable: true, genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' } },
      { x: 4, y: 6, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 6, y: 6, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } }
    ],
    walls: [
      { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 },
      { x: 3, y: 4 }, { x: 3, y: 5 },
      { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 5, y: 6 }
    ]
  },
  {
    id: 10,
    name: "The Apex Genome",
    description: "The ultimate challenge. Integrate everything you've learned. Inject Shock, and clear a massive, mixed petri dish using minimal edits.",
    width: 9,
    height: 9,
    allowedInjections: ['SHOCK', 'HEAT'],
    inventory: {
      trigger: ['SHOCK', 'HEAT', 'TOXIN'],
      action: ['BURST', 'SHOOT', 'MUTATE', 'SPLIT', 'GROW'],
      release: ['SHOCK', 'HEAT', 'TOXIN'],
      modifier: ['NONE', 'DUAL', 'CHAIN', 'DELAY']
    },
    objective: "Destroy or Mutate all cells in the grid.",
    objectiveType: "clear_all",
    cells: [
      { x: 1, y: 1, isEditable: false, genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' } },
      { x: 2, y: 2, isEditable: true, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 4, y: 2, isEditable: false, genome: { trigger: 'TOXIN', action: 'BURST', release: 'TOXIN', modifier: 'NONE' } },
      { x: 6, y: 3, isEditable: true, genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' } },
      { x: 7, y: 5, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } },
      { x: 5, y: 6, isEditable: true, genome: { trigger: 'TOXIN', action: 'BURST', release: 'TOXIN', modifier: 'NONE' } },
      { x: 3, y: 7, isEditable: false, genome: { trigger: 'HEAT', action: 'BURST', release: 'HEAT', modifier: 'NONE' } },
      { x: 1, y: 6, isEditable: false, genome: { trigger: 'SHOCK', action: 'BURST', release: 'SHOCK', modifier: 'NONE' } }
    ],
    walls: [
      { x: 3, y: 3 }, { x: 5, y: 5 }, { x: 4, y: 4 }
    ]
  }
];
