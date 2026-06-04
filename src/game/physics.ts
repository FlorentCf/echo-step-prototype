import {
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  type MovementInput,
  type ObjectPlatform,
  type PlayerState,
  type Rect,
} from "./types";

const MOVE_SPEED = 220;
const ACCELERATION = 1800;
const FRICTION = 2200;
const GRAVITY = 1800;
const JUMP_VELOCITY = -620;
const COYOTE_TIME = 0.08;
const JUMP_BUFFER = 0.08;
const MAX_FALL_SPEED = 980;

export function createPlayer(start: { x: number; y: number }): PlayerState {
  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    grounded: false,
    alive: true,
    facing: 1,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    support: { kind: "none" },
  };
}

export function stepPlayer(
  player: PlayerState,
  input: MovementInput,
  solids: Rect[],
  objectPlatforms: ObjectPlatform[],
  dt: number,
): void {
  if (!player.alive) {
    return;
  }

  carryByPlatform(player, solids, objectPlatforms);

  if (player.grounded) {
    player.coyoteTimer = COYOTE_TIME;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }

  if (input.jumpPressed) {
    player.jumpBufferTimer = JUMP_BUFFER;
  } else {
    player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
  }

  const direction = Number(input.right) - Number(input.left);
  if (direction !== 0) {
    player.facing = direction > 0 ? 1 : -1;
    player.vx = approach(player.vx, direction * MOVE_SPEED, ACCELERATION * dt);
  } else {
    player.vx = approach(player.vx, 0, FRICTION * dt);
  }

  if (player.jumpBufferTimer > 0 && player.coyoteTimer > 0) {
    player.vy = JUMP_VELOCITY;
    player.grounded = false;
    player.support = { kind: "none" };
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
  }

  player.vy = Math.min(MAX_FALL_SPEED, player.vy + GRAVITY * dt);

  moveHorizontal(player, solids, player.vx * dt);
  moveVerticalWithPlatforms(player, solids, objectPlatforms, dt);
}

export function playerRect(player: PlayerState): Rect {
  return { x: player.x, y: player.y, w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function containsOverlapFromAbove(previousBottom: number, currentBottom: number, platform: Rect): boolean {
  return previousBottom <= platform.y + 3 && currentBottom >= platform.y;
}

function carryByPlatform(player: PlayerState, solids: Rect[], platforms: ObjectPlatform[]): void {
  if (player.support.kind !== "object") {
    return;
  }

  const supportObjectId = player.support.objectId;
  const platform = platforms.find((sample) => sample.id === supportObjectId);
  if (!platform) {
    return;
  }

  const rect = playerRect(player);
  const previousBottom = rect.y + rect.h;
  const standingOnPreviousTop = Math.abs(previousBottom - platform.previousRect.y) <= 4;
  const overlapping =
    rect.x + rect.w > platform.previousRect.x + 5 && rect.x < platform.previousRect.x + platform.previousRect.w - 5;

  if (!standingOnPreviousTop || !overlapping || platform.dx === 0) {
    return;
  }

  moveHorizontal(player, solids, platform.dx);
}

function moveHorizontal(player: PlayerState, solids: Rect[], dx: number): void {
  if (dx === 0) {
    return;
  }

  const previousX = player.x;
  player.x += dx;

  for (const solid of solids) {
    if (!rectsOverlap(playerRect(player), solid)) {
      continue;
    }

    if (player.x > previousX) {
      player.x = solid.x - PLAYER_WIDTH;
    } else if (player.x < previousX) {
      player.x = solid.x + solid.w;
    }

    player.vx = 0;
  }
}

function moveVerticalWithPlatforms(player: PlayerState, solids: Rect[], platforms: ObjectPlatform[], dt: number): void {
  const previousY = player.y;
  const previousBottom = previousY + PLAYER_HEIGHT;
  const wasFalling = player.vy >= 0;

  player.y += player.vy * dt;
  player.grounded = false;
  player.support = { kind: "none" };

  for (const solid of solids) {
    if (!rectsOverlap(playerRect(player), solid)) {
      continue;
    }

    if (player.y > previousY) {
      player.y = solid.y - PLAYER_HEIGHT;
      player.vy = 0;
      player.grounded = true;
      player.support = { kind: "ground" };
    } else if (player.y < previousY) {
      player.y = solid.y + solid.h;
      player.vy = 0;
    }
  }

  if (!wasFalling) {
    return;
  }

  const currentBottom = player.y + PLAYER_HEIGHT;
  let bestPlatform: ObjectPlatform | undefined;

  for (const platform of platforms) {
    const rect = playerRect(player);
    const overlapsTop = rect.x + rect.w > platform.rect.x + 5 && rect.x < platform.rect.x + platform.rect.w - 5;
    if (!overlapsTop || !containsOverlapFromAbove(previousBottom, currentBottom, platform.rect)) {
      continue;
    }

    if (!bestPlatform || platform.rect.y < bestPlatform.rect.y) {
      bestPlatform = platform;
    }
  }

  if (!bestPlatform) {
    return;
  }

  player.y = bestPlatform.rect.y - PLAYER_HEIGHT;
  player.vy = 0;
  player.grounded = true;
  player.support = { kind: "object", objectId: bestPlatform.id };
}

function approach(value: number, target: number, amount: number): number {
  if (value < target) {
    return Math.min(target, value + amount);
  }

  if (value > target) {
    return Math.max(target, value - amount);
  }

  return target;
}
