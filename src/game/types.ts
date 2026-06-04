export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;
export const TILE_SIZE = 32;
export const FIXED_DT = 1 / 60;
export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 36;
export const MAX_ECHOES = 3;

export type Facing = -1 | 1;

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Point = {
  x: number;
  y: number;
};

export type PlayerSnapshot = {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  alive: boolean;
  facing: Facing;
};

export type Echo = {
  id: number;
  snapshots: PlayerSnapshot[];
};

export type EchoSample = PlayerSnapshot & {
  echoId: number;
  rect: Rect;
  previousRect: Rect;
  dx: number;
  dy: number;
};

export type Support =
  | { kind: "none" }
  | { kind: "ground" }
  | { kind: "echo"; echoId: number };

export type PlayerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  alive: boolean;
  facing: Facing;
  coyoteTimer: number;
  jumpBufferTimer: number;
  support: Support;
};

export type MovementInput = {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
};

export type PlateDefinition = {
  id: string;
  rect: Rect;
};

export type DoorDefinition = {
  id: string;
  rect: Rect;
  plateIds: string[];
};

export type MarkerDefinition = {
  rect: Rect;
  label: string;
};

export type LevelDefinition = {
  id: string;
  name: string;
  prompt: string;
  loopDuration: number;
  start: Point;
  solids: Rect[];
  plates: PlateDefinition[];
  doors: DoorDefinition[];
  hazards: Rect[];
  markers: MarkerDefinition[];
  exit: Rect;
};

export type InteractionState = {
  pressedPlateIds: Set<string>;
  openDoorIds: Set<string>;
};

export type DebugState = {
  player: PlayerState;
  activePlates: string[];
  echoSnapshotCounts: string[];
  timelineTime: number;
  supportLabel: string;
};
