import {
  PLAYER_HEIGHT,
  TILE_SIZE,
  type DoorDefinition,
  type LevelDefinition,
  type MarkerDefinition,
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
    plates: [],
    doors: [],
    hazards: [rect(356, FLOOR_Y - 12, 82, 12)],
    markers: [],
    exit: rect(804, 10 * TILE_SIZE - 44, 34, 44),
  },
  {
    id: "headstart",
    name: "Headstart",
    prompt: "The ledge is just out of reach. Make a body-sized step.",
    loopDuration: LOOP_DURATION,
    start: start(74),
    solids: [tileRect(0, 15, 30, 2), tileRect(18, 11, 10, 1)],
    plates: [],
    doors: [],
    hazards: [],
    markers: [marker("STEP", 510)],
    exit: rect(782, 11 * TILE_SIZE - 44, 34, 44),
  },
  {
    id: "hold",
    name: "Hold",
    prompt: "The door only stays open while something holds the plate.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 30, 2)],
    plates: [plate("A", 248)],
    doors: [door("A", 560, 12 * TILE_SIZE, FLOOR_Y - 12 * TILE_SIZE, ["A"])],
    hazards: [],
    markers: [],
    exit: rect(780, FLOOR_Y - 44, 34, 44),
  },
  {
    id: "carry",
    name: "Carry",
    prompt: "A lower route can become a moving bridge.",
    loopDuration: LOOP_DURATION,
    start: start(74, 11 * TILE_SIZE),
    solids: [tileRect(0, 11, 9, 1), tileRect(21, 11, 9, 1), tileRect(7, 15, 16, 2)],
    plates: [],
    doors: [],
    hazards: [],
    markers: [marker("RIDE", 390, FLOOR_Y)],
    exit: rect(820, 11 * TILE_SIZE - 44, 34, 44),
  },
  {
    id: "two-jobs",
    name: "Two Jobs",
    prompt: "One Echo can hold. Another can help you climb.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 19, 2), tileRect(20, 11, 10, 1)],
    plates: [plate("A", 158)],
    doors: [door("A", 608, 11 * TILE_SIZE, FLOOR_Y - 11 * TILE_SIZE, ["A"])],
    hazards: [],
    markers: [marker("STEP", 525)],
    exit: rect(826, 11 * TILE_SIZE - 44, 34, 44),
  },
];
