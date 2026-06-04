import {
  PLAYER_HEIGHT,
  TILE_SIZE,
  type DoorDefinition,
  type LevelDefinition,
  type MarkerDefinition,
  type ObjectDefinition,
  type ObjectKind,
  type PlateDefinition,
  type Rect,
} from "./types";

const FLOOR_Y = 15 * TILE_SIZE;
const LOOP_DURATION = 8;

function tileRect(x: number, y: number, w: number, h: number): Rect {
  return {
    x: x * TILE_SIZE,
    y: y * TILE_SIZE,
    w: w * TILE_SIZE,
    h: h * TILE_SIZE,
  };
}

function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

function start(x: number, groundY = FLOOR_Y) {
  return { x, y: groundY - PLAYER_HEIGHT };
}

function plate(id: string, x: number, y = FLOOR_Y): PlateDefinition {
  return {
    id,
    rect: rect(x, y - 8, 54, 8),
  };
}

function object(id: string, kind: ObjectKind, x: number, groundY = FLOOR_Y): ObjectDefinition {
  const size = objectSize(kind);
  return {
    id,
    kind,
    rect: rect(x, groundY - size.h, size.w, size.h),
  };
}

function objectSize(kind: ObjectKind): { w: number; h: number } {
  if (kind === "plate") {
    return { w: 58, h: 12 };
  }

  if (kind === "shield") {
    return { w: 14, h: 38 };
  }

  return { w: 44, h: 22 };
}

function marker(label: string, x: number, y = FLOOR_Y): MarkerDefinition {
  return {
    label,
    rect: rect(x, y - 5, 60, 5),
  };
}

function door(id: string, x: number, top: number, height: number, plateIds: string[]): DoorDefinition {
  return {
    id,
    rect: rect(x, top, 32, height),
    plateIds,
  };
}

export const levels: LevelDefinition[] = [
  {
    id: "move",
    name: "Move",
    prompt: "Reach the exit. Echoes are optional here.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [
      tileRect(0, 15, 30, 2),
      tileRect(8, 13, 5, 1),
      tileRect(16, 11, 5, 1),
      tileRect(22, 10, 6, 1),
    ],
    objects: [],
    plates: [],
    doors: [],
    hazards: [rect(356, FLOOR_Y - 12, 82, 12)],
    markers: [],
    exit: rect(804, 10 * TILE_SIZE - 44, 34, 44),
  },
  {
    id: "weight",
    name: "Weight",
    prompt: "Carry the Weight, record an Echo, then use the carried Weight as your step.",
    loopDuration: LOOP_DURATION,
    start: start(74),
    solids: [tileRect(0, 15, 30, 2), tileRect(18, 11, 10, 1)],
    objects: [object("weight-step", "weight", 118)],
    plates: [],
    doors: [],
    hazards: [],
    markers: [marker("WEIGHT STEP", 510)],
    exit: rect(782, 11 * TILE_SIZE - 44, 34, 44),
  },
  {
    id: "plate",
    name: "Plate",
    prompt: "Carry the Plate to the switch, drop it with E, and keep the door open.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 30, 2)],
    objects: [object("plate-a", "plate", 112)],
    plates: [plate("A", 248)],
    doors: [door("A", 560, 12 * TILE_SIZE, FLOOR_Y - 12 * TILE_SIZE, ["A"])],
    hazards: [],
    markers: [marker("DROP", 226)],
    exit: rect(780, FLOOR_Y - 44, 34, 44),
  },
  {
    id: "shield",
    name: "Shield",
    prompt: "Carry the Shield through the hazard. Echo shields can cover danger too.",
    loopDuration: LOOP_DURATION,
    start: start(74),
    solids: [tileRect(0, 15, 30, 2)],
    objects: [object("shield-a", "shield", 120)],
    plates: [],
    doors: [],
    hazards: [rect(330, FLOOR_Y - 12, 154, 12)],
    markers: [marker("SHIELD", 330)],
    exit: rect(780, FLOOR_Y - 44, 34, 44),
  },
  {
    id: "bridge",
    name: "Weight Bridge",
    prompt: "A lower route can become a moving object bridge.",
    loopDuration: LOOP_DURATION,
    start: start(74, 11 * TILE_SIZE),
    solids: [tileRect(0, 11, 9, 1), tileRect(21, 11, 9, 1), tileRect(7, 15, 16, 2)],
    objects: [object("weight-bridge", "weight", 120, 11 * TILE_SIZE)],
    plates: [],
    doors: [],
    hazards: [],
    markers: [marker("RIDE", 390, FLOOR_Y)],
    exit: rect(820, 11 * TILE_SIZE - 44, 34, 44),
  },
  {
    id: "handoff",
    name: "Handoff",
    prompt: "Echo 1 drops the Plate. Later, pick up that handoff and carry the chain forward.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 22, 2), tileRect(22, 11, 8, 1)],
    objects: [object("handoff-plate", "plate", 108)],
    plates: [],
    doors: [],
    hazards: [],
    markers: [marker("DROP 1", 314), marker("DROP 2", 542), marker("CLIMB", 662)],
    exit: rect(814, 11 * TILE_SIZE - 44, 34, 44),
  },
];
