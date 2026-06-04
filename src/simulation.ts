export type ActionType = "school" | "roadblock" | "signal";

export type LevelConfig = {
  id: string;
  name: string;
  size: number;
  maxActions: number;
  propagationTurnsPerAction: number;
  pressureDrift: number;
  influenceDrift: number;
  stabilityRecovery: number;
  roadPressureRelief: number;
  schoolReach: number;
  signalReach: number;
  scoreWeights: {
    opportunity: number;
    stability: number;
    pressure: number;
    equitySpread: number;
  };
};

export type PlacedAction = {
  type: ActionType;
  x: number;
  y: number;
};

export type VisibleCell = {
  id: string;
  x: number;
  y: number;
  heat: number;
  pressure: number;
  support: number;
  marker: "none" | ActionType;
};

export type VisibleStats = {
  opportunity: number;
  pressure: number;
  support: number;
  stability: number;
  score: number;
};

export type PublicSimState = {
  seed: number;
  turn: number;
  actionsRemaining: number;
  actions: PlacedAction[];
  cells: VisibleCell[];
  stats: VisibleStats;
  baselineStats: VisibleStats;
  isComplete: boolean;
};

type Cell = {
  id: string;
  x: number;
  y: number;
  population: number;
  stability: number;
  influence: number;
  pressure: number;
  school: boolean;
  roadblock: boolean;
  signal: boolean;
};

type InternalSimState = {
  seed: number;
  turn: number;
  level: LevelConfig;
  cells: Cell[];
  baselineStats: VisibleStats;
  actions: PlacedAction[];
};

export type SimState = InternalSimState;

export function createSimulation(level: LevelConfig, seed = randomSeed()): SimState {
  const rng = mulberry32(seed);
  const center = (level.size - 1) / 2;
  const cells: Cell[] = [];

  for (let y = 0; y < level.size; y += 1) {
    for (let x = 0; x < level.size; x += 1) {
      const distanceFromCenter = Math.hypot(x - center, y - center) / center;
      const corridor = Math.abs(x - center) < 1.6 || Math.abs(y - center) < 1.4 ? 0.12 : 0;
      const population = clamp(0.32 + (1 - distanceFromCenter) * 0.34 + rng() * 0.26);
      const stability = clamp(0.44 + rng() * 0.34 - distanceFromCenter * 0.14);
      const influence = clamp(0.18 + corridor + rng() * 0.36);
      const pressure = clamp(0.22 + distanceFromCenter * 0.2 + corridor * 0.5 + rng() * 0.36);

      cells.push({
        id: cellId(x, y),
        x,
        y,
        population,
        stability,
        influence,
        pressure,
        school: false,
        roadblock: false,
        signal: false,
      });
    }
  }

  const baselineStats = summarize(cells, level);

  return {
    seed,
    turn: 0,
    level,
    cells,
    baselineStats,
    actions: [],
  };
}

export function applyAction(state: SimState, type: ActionType, x: number, y: number): SimState {
  if (state.actions.length >= state.level.maxActions) {
    return state;
  }

  const cell = getCell(state.cells, state.level.size, x, y);
  if (!cell || cell.school || cell.roadblock || cell.signal) {
    return state;
  }

  let cells = state.cells.map((current) => ({ ...current }));
  const target = getCell(cells, state.level.size, x, y);
  if (!target) {
    return state;
  }

  if (type === "school") {
    target.school = true;
    cells = applyRadialEffect(cells, state.level.size, x, y, state.level.schoolReach, (current, strength) => ({
      ...current,
      stability: clamp(current.stability + 0.1 * strength),
      pressure: clamp(current.pressure - 0.08 * strength),
    }));
  }

  if (type === "roadblock") {
    target.roadblock = true;
    target.pressure = clamp(target.pressure - state.level.roadPressureRelief);
    target.influence = clamp(target.influence - 0.04);
  }

  if (type === "signal") {
    target.signal = true;
    cells = applyRadialEffect(cells, state.level.size, x, y, state.level.signalReach, (current, strength) => ({
      ...current,
      influence: clamp(current.influence + 0.16 * strength),
      pressure: clamp(current.pressure + 0.025 * strength),
    }));
  }

  for (let i = 0; i < state.level.propagationTurnsPerAction; i += 1) {
    cells = propagate(cells, state.level);
  }

  return {
    ...state,
    turn: state.turn + state.level.propagationTurnsPerAction,
    cells,
    actions: [...state.actions, { type, x, y }],
  };
}

export function resetSimulation(state: SimState): SimState {
  return createSimulation(state.level, state.seed);
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 999_999) + 1;
}

export function toPublicState(state: SimState): PublicSimState {
  const stats = summarize(state.cells, state.level);

  return {
    seed: state.seed,
    turn: state.turn,
    actionsRemaining: state.level.maxActions - state.actions.length,
    actions: state.actions,
    cells: state.cells.map((cell) => ({
      id: cell.id,
      x: cell.x,
      y: cell.y,
      heat: visibleOpportunity(cell),
      pressure: round(cell.pressure),
      support: round((cell.influence + cell.stability) / 2),
      marker: cell.school ? "school" : cell.roadblock ? "roadblock" : cell.signal ? "signal" : "none",
    })),
    stats,
    baselineStats: state.baselineStats,
    isComplete: state.actions.length >= state.level.maxActions,
  };
}

function propagate(cells: Cell[], level: LevelConfig): Cell[] {
  return cells.map((cell) => {
    const nearby = neighbors(cells, level.size, cell.x, cell.y);
    const avgPressure = average(nearby.map((neighbor) => neighbor.pressure));
    const avgInfluence = average(nearby.map((neighbor) => neighbor.influence));
    const avgStability = average(nearby.map((neighbor) => neighbor.stability));
    const blockedNeighborCount = nearby.filter((neighbor) => neighbor.roadblock).length;
    const schoolNeighborCount = nearby.filter((neighbor) => neighbor.school).length;
    const signalNeighborCount = nearby.filter((neighbor) => neighbor.signal).length;

    const pressureChange =
      (avgPressure - cell.pressure) * level.pressureDrift +
      signalNeighborCount * 0.006 -
      schoolNeighborCount * 0.01 -
      blockedNeighborCount * 0.012 -
      cell.stability * 0.006;

    const influenceChange =
      (avgInfluence - cell.influence) * level.influenceDrift +
      signalNeighborCount * 0.014 +
      cell.population * 0.004 -
      blockedNeighborCount * 0.005;

    const stabilityChange =
      (avgStability - cell.stability) * level.stabilityRecovery +
      schoolNeighborCount * 0.012 -
      cell.pressure * 0.007 +
      cell.population * 0.003;

    return {
      ...cell,
      pressure: clamp(cell.pressure + pressureChange),
      influence: clamp(cell.influence + influenceChange),
      stability: clamp(cell.stability + stabilityChange),
    };
  });
}

function summarize(cells: Cell[], level: LevelConfig): VisibleStats {
  const opportunities = cells.map(visibleOpportunity);
  const opportunity = average(opportunities);
  const pressure = average(cells.map((cell) => cell.pressure));
  const support = average(cells.map((cell) => (cell.influence + cell.stability) / 2));
  const stability = average(cells.map((cell) => cell.stability));
  const equitySpread = Math.max(...opportunities) - Math.min(...opportunities);
  const score =
    opportunity * level.scoreWeights.opportunity +
    stability * level.scoreWeights.stability +
    pressure * level.scoreWeights.pressure +
    equitySpread * level.scoreWeights.equitySpread;

  return {
    opportunity: round(opportunity),
    pressure: round(pressure),
    support: round(support),
    stability: round(stability),
    score: Math.round(score),
  };
}

function visibleOpportunity(cell: Cell): number {
  const actionBonus = (cell.school ? 0.08 : 0) + (cell.signal ? 0.05 : 0) - (cell.roadblock ? 0.025 : 0);
  return round(clamp(cell.population * 0.34 + cell.stability * 0.29 + cell.influence * 0.24 - cell.pressure * 0.22 + actionBonus));
}

function applyRadialEffect(
  cells: Cell[],
  size: number,
  x: number,
  y: number,
  reach: number,
  effect: (cell: Cell, strength: number) => Cell,
): Cell[] {
  return cells.map((cell) => {
    const distance = Math.abs(cell.x - x) + Math.abs(cell.y - y);
    if (distance > reach) {
      return cell;
    }

    const strength = 1 - distance / (reach + 1);
    const fresh = effect(cell, strength);
    return { ...fresh, id: cellId(fresh.x, fresh.y) };
  });
}

function neighbors(cells: Cell[], size: number, x: number, y: number): Cell[] {
  return [
    getCell(cells, size, x - 1, y),
    getCell(cells, size, x + 1, y),
    getCell(cells, size, x, y - 1),
    getCell(cells, size, x, y + 1),
  ].filter((cell): cell is Cell => Boolean(cell));
}

function getCell(cells: Cell[], size: number, x: number, y: number): Cell | undefined {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return undefined;
  }

  return cells[y * size + x];
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function cellId(x: number, y: number): string {
  return `${x}-${y}`;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function mulberry32(seed: number): () => number {
  let value = seed;

  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

