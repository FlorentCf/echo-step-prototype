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
  {
    id: "tall-step",
    name: "Tall Step",
    prompt: "Record a Weight Echo near the ledge, then use it as a higher step.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 30, 2), tileRect(18, 12, 10, 1)],
    objects: [object("weight-tall-step", "weight", 112)],
    plates: [],
    doors: [],
    hazards: [],
    markers: [marker("STEP", 500)],
    exit: rect(804, 12 * TILE_SIZE - 44, 34, 44),
  },
  {
    id: "late-plate",
    name: "Late Plate",
    prompt: "Carry the Plate farther before dropping it; the door opens only while it holds.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 30, 2)],
    objects: [object("plate-late", "plate", 112)],
    plates: [plate("A", 414)],
    doors: [door("A", 662, 12 * TILE_SIZE, FLOOR_Y - 12 * TILE_SIZE, ["A"])],
    hazards: [],
    markers: [marker("HOLD", 392)],
    exit: rect(812, FLOOR_Y - 44, 34, 44),
  },
  {
    id: "shield-walk",
    name: "Shield Walk",
    prompt: "Carry the Shield through a longer hazard lane.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 30, 2)],
    objects: [object("shield-walk", "shield", 112)],
    plates: [],
    doors: [],
    hazards: [rect(330, FLOOR_Y - 12, 238, 12)],
    markers: [marker("SHIELD", 328)],
    exit: rect(802, FLOOR_Y - 44, 34, 44),
  },
  {
    id: "first-relay",
    name: "First Relay",
    prompt: "Drop a Plate with one Echo, then reuse the handoff as your next step.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 21, 2), tileRect(23, 11, 7, 1)],
    objects: [object("plate-relay", "plate", 110)],
    plates: [],
    doors: [],
    hazards: [],
    markers: [marker("DROP", 330), marker("PICK", 542), marker("STEP", 674)],
    exit: rect(818, 11 * TILE_SIZE - 44, 34, 44),
  },
  {
    id: "two-plates",
    name: "Two Plates",
    prompt: "The door wants two held switches. Use two lives to leave two Plates behind.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 30, 2)],
    objects: [object("plate-left", "plate", 108), object("plate-right", "plate", 168)],
    plates: [plate("A", 260), plate("B", 462)],
    doors: [door("AB", 674, 12 * TILE_SIZE, FLOOR_Y - 12 * TILE_SIZE, ["A", "B"])],
    hazards: [],
    markers: [marker("A", 238), marker("B", 440)],
    exit: rect(812, FLOOR_Y - 44, 34, 44),
  },
  {
    id: "shield-escort",
    name: "Shield Escort",
    prompt: "Let a Shield Echo cover the hazard so a later Plate carrier can pass.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 30, 2)],
    objects: [object("shield-escort", "shield", 108), object("plate-escort", "plate", 154)],
    plates: [plate("A", 610)],
    doors: [door("A", 746, 12 * TILE_SIZE, FLOOR_Y - 12 * TILE_SIZE, ["A"])],
    hazards: [rect(332, FLOOR_Y - 12, 154, 12)],
    markers: [marker("COVER", 330), marker("DROP", 588)],
    exit: rect(838, FLOOR_Y - 44, 34, 44),
  },
  {
    id: "upper-handoff",
    name: "Upper Handoff",
    prompt: "Relay a Weight across lives, then use the carried Echo object to reach the upper shelf.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 20, 2), tileRect(22, 11, 8, 1)],
    objects: [object("weight-upper", "weight", 110)],
    plates: [],
    doors: [],
    hazards: [],
    markers: [marker("DROP 1", 326), marker("DROP 2", 546), marker("CLIMB", 650)],
    exit: rect(810, 11 * TILE_SIZE - 44, 34, 44),
  },
  {
    id: "two-step-climb",
    name: "Two-Step Climb",
    prompt: "Stack timing, not objects: two Weight Echoes make a route up the shelves.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 14, 2), tileRect(15, 12, 5, 1), tileRect(24, 9, 6, 1)],
    objects: [object("weight-low", "weight", 108), object("weight-high", "weight", 164)],
    plates: [],
    doors: [],
    hazards: [],
    markers: [marker("STEP 1", 430), marker("STEP 2", 626, 12 * TILE_SIZE)],
    exit: rect(816, 9 * TILE_SIZE - 44, 34, 44),
  },
  {
    id: "plate-bridge",
    name: "Plate Bridge",
    prompt: "Open the gate with a Plate Echo, then climb with a Weight Echo.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 21, 2), tileRect(23, 11, 7, 1)],
    objects: [object("plate-bridge", "plate", 108), object("weight-bridge-step", "weight", 164)],
    plates: [plate("A", 332)],
    doors: [door("A", 654, 11 * TILE_SIZE, FLOOR_Y - 11 * TILE_SIZE, ["A"])],
    hazards: [],
    markers: [marker("HOLD", 310), marker("STEP", 570)],
    exit: rect(812, 11 * TILE_SIZE - 44, 34, 44),
  },
  {
    id: "final-relay",
    name: "Final Relay",
    prompt: "Cover the hazard, hold the gate, and carry the last Weight into place.",
    loopDuration: LOOP_DURATION,
    start: start(72),
    solids: [tileRect(0, 15, 22, 2), tileRect(23, 11, 7, 1)],
    objects: [
      object("shield-final", "shield", 104),
      object("plate-final", "plate", 150),
      object("weight-final", "weight", 210),
    ],
    plates: [plate("A", 528)],
    doors: [door("A", 672, 11 * TILE_SIZE, FLOOR_Y - 11 * TILE_SIZE, ["A"])],
    hazards: [rect(330, FLOOR_Y - 12, 120, 12)],
    markers: [marker("COVER", 320), marker("HOLD", 506), marker("STEP", 616)],
    exit: rect(816, 11 * TILE_SIZE - 44, 34, 44),
  },
];
