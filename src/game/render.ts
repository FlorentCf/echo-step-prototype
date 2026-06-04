import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAX_ECHOES,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_SIZE,
  type Echo,
  type EchoSample,
  type InteractionState,
  type LevelDefinition,
  type PlayerState,
  type Rect,
} from "./types";
import { playerRect, rectsOverlap } from "./physics";

type RenderState = {
  level: LevelDefinition;
  levelIndex: number;
  levelCount: number;
  player: PlayerState;
  echoes: Echo[];
  echoSamples: EchoSample[];
  interactions: InteractionState;
  timelineTime: number;
  debug: boolean;
  levelComplete: boolean;
  message: string;
};

const ECHO_COLORS = ["#1b9aaa", "#7a5cff", "#e7902f"];

export function render(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { level } = state;

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackdrop(ctx);
  drawGrid(ctx);
  drawSolids(ctx, level.solids);
  drawMarkers(ctx, level.markers);
  drawHazards(ctx, level.hazards);
  drawPlates(ctx, level, state.interactions);
  drawDoors(ctx, level, state.interactions);
  drawExit(ctx, level.exit, state.levelComplete);
  drawEchoTrails(ctx, state.echoes);
  drawEchoes(ctx, state.echoSamples);
  drawPlayer(ctx, state.player);
  drawHud(ctx, state);

  if (state.levelComplete) {
    drawComplete(ctx);
  }

  if (state.debug) {
    drawDebug(ctx, state);
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#eef2f0";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "#dbe7ea";
  ctx.fillRect(0, 76, CANVAS_WIDTH, CANVAS_HEIGHT - 76);
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = "rgba(70, 89, 94, 0.12)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= CANVAS_WIDTH; x += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 76);
    ctx.lineTo(x + 0.5, CANVAS_HEIGHT);
    ctx.stroke();
  }

  for (let y = 96; y <= CANVAS_HEIGHT; y += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(CANVAS_WIDTH, y + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSolids(ctx: CanvasRenderingContext2D, solids: Rect[]): void {
  for (const solid of solids) {
    ctx.fillStyle = "#26343f";
    ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
    ctx.fillStyle = "#43606c";
    ctx.fillRect(solid.x, solid.y, solid.w, 4);
  }
}

function drawMarkers(ctx: CanvasRenderingContext2D, markers: LevelDefinition["markers"]): void {
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#f0b84d";
  ctx.fillStyle = "#2e3a40";
  ctx.font = "700 11px ui-sans-serif, system-ui";
  ctx.textAlign = "center";

  for (const marker of markers) {
    ctx.strokeRect(marker.rect.x, marker.rect.y - 24, marker.rect.w, marker.rect.h + 24);
    ctx.fillText(marker.label, marker.rect.x + marker.rect.w / 2, marker.rect.y - 10);
  }

  ctx.restore();
}

function drawHazards(ctx: CanvasRenderingContext2D, hazards: Rect[]): void {
  ctx.fillStyle = "#c3433d";

  for (const hazard of hazards) {
    const spikeCount = Math.max(1, Math.floor(hazard.w / 18));
    const spikeWidth = hazard.w / spikeCount;

    for (let i = 0; i < spikeCount; i += 1) {
      const x = hazard.x + i * spikeWidth;
      ctx.beginPath();
      ctx.moveTo(x, hazard.y + hazard.h);
      ctx.lineTo(x + spikeWidth / 2, hazard.y);
      ctx.lineTo(x + spikeWidth, hazard.y + hazard.h);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawPlates(ctx: CanvasRenderingContext2D, level: LevelDefinition, interactions: InteractionState): void {
  ctx.font = "700 11px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  for (const plate of level.plates) {
    const pressed = interactions.pressedPlateIds.has(plate.id);
    ctx.fillStyle = pressed ? "#62a87c" : "#c4a35a";
    ctx.fillRect(plate.rect.x, plate.rect.y, plate.rect.w, plate.rect.h);
    ctx.strokeStyle = pressed ? "#245d38" : "#87692a";
    ctx.lineWidth = 2;
    ctx.strokeRect(plate.rect.x, plate.rect.y, plate.rect.w, plate.rect.h);
    ctx.fillStyle = "#233036";
    ctx.fillText(`PLATE ${plate.id}`, plate.rect.x + plate.rect.w / 2, plate.rect.y - 4);
  }
}

function drawDoors(ctx: CanvasRenderingContext2D, level: LevelDefinition, interactions: InteractionState): void {
  ctx.font = "700 12px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const door of level.doors) {
    const open = interactions.openDoorIds.has(door.id);
    if (open) {
      ctx.strokeStyle = "rgba(48, 117, 87, 0.55)";
      ctx.lineWidth = 3;
      ctx.strokeRect(door.rect.x + 6, door.rect.y, door.rect.w - 12, door.rect.h);
      ctx.fillStyle = "#307557";
      ctx.fillText("OPEN", door.rect.x + door.rect.w / 2, door.rect.y + door.rect.h / 2);
      continue;
    }

    ctx.fillStyle = "#475a80";
    ctx.fillRect(door.rect.x, door.rect.y, door.rect.w, door.rect.h);
    ctx.fillStyle = "#8092bd";
    ctx.fillRect(door.rect.x + 4, door.rect.y, 5, door.rect.h);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("DOOR", door.rect.x + door.rect.w / 2, door.rect.y + door.rect.h / 2);
  }
}

function drawExit(ctx: CanvasRenderingContext2D, exit: Rect, complete: boolean): void {
  ctx.fillStyle = complete ? "#8be38b" : "#38a36a";
  ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
  ctx.strokeStyle = "#175c38";
  ctx.lineWidth = 2;
  ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 11px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EXIT", exit.x + exit.w / 2, exit.y + exit.h / 2);
}

function drawEchoTrails(ctx: CanvasRenderingContext2D, echoes: Echo[]): void {
  ctx.save();
  ctx.lineWidth = 2;

  echoes.forEach((echo, index) => {
    ctx.strokeStyle = withAlpha(ECHO_COLORS[index % ECHO_COLORS.length], 0.24);
    ctx.beginPath();
    let started = false;

    for (let i = 0; i < echo.snapshots.length; i += 7) {
      const snapshot = echo.snapshots[i];
      if (!snapshot.alive) {
        continue;
      }

      const x = snapshot.x + PLAYER_WIDTH / 2;
      const y = snapshot.y + PLAYER_HEIGHT / 2;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  });

  ctx.restore();
}

function drawEchoes(ctx: CanvasRenderingContext2D, samples: EchoSample[]): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.font = "800 12px ui-sans-serif, system-ui";

  for (const sample of samples) {
    if (!sample.alive) {
      continue;
    }

    const color = ECHO_COLORS[(sample.echoId - 1) % ECHO_COLORS.length];
    ctx.fillStyle = withAlpha(color, 0.34);
    ctx.fillRect(sample.rect.x, sample.rect.y, sample.rect.w, sample.rect.h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(sample.rect.x, sample.rect.y, sample.rect.w, sample.rect.h);
    ctx.fillStyle = color;
    ctx.fillText(`E${sample.echoId}`, sample.rect.x + sample.rect.w / 2, sample.rect.y - 5);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerState): void {
  if (!player.alive) {
    return;
  }

  const rect = playerRect(player);
  ctx.fillStyle = "#141f28";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = "#f4d35e";
  ctx.fillRect(rect.x + (player.facing > 0 ? 15 : 4), rect.y + 8, 5, 5);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

function drawHud(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { level } = state;
  const progress = Math.min(1, state.timelineTime / level.loopDuration);

  ctx.fillStyle = "rgba(238, 242, 240, 0.96)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, 76);
  ctx.fillStyle = "#121c23";
  ctx.font = "800 20px ui-sans-serif, system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`Echo Step  |  ${state.levelIndex + 1}/${state.levelCount}: ${level.name}`, 16, 12);

  ctx.font = "500 13px ui-sans-serif, system-ui";
  ctx.fillStyle = "#526069";
  ctx.fillText(level.prompt, 16, 42);

  ctx.fillStyle = "#d1d8d8";
  ctx.fillRect(530, 18, 196, 12);
  ctx.fillStyle = "#2c8c7b";
  ctx.fillRect(530, 18, 196 * progress, 12);
  ctx.strokeStyle = "#8a999b";
  ctx.strokeRect(530, 18, 196, 12);

  ctx.fillStyle = "#18252d";
  ctx.font = "700 12px ui-sans-serif, system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`${state.timelineTime.toFixed(2)}s / ${level.loopDuration}s`, 734, 17);
  ctx.fillText(`Echoes ${state.echoes.length}/${MAX_ECHOES}`, 734, 38);

  ctx.textAlign = "right";
  ctx.fillStyle = "#384952";
  ctx.font = "600 11px ui-sans-serif, system-ui";
  ctx.fillText("A/D move   Space/W jump   R commit   K kill   U undo   C clear   N/B level   Esc retry   F1 debug", 944, 55);

  if (state.message) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#9b3d36";
    ctx.font = "800 12px ui-sans-serif, system-ui";
    ctx.fillText(state.message, 944, 17);
  }
}

function drawComplete(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(18, 28, 35, 0.78)";
  ctx.fillRect(296, 198, 368, 112);
  ctx.strokeStyle = "#8be38b";
  ctx.lineWidth = 2;
  ctx.strokeRect(296, 198, 368, 112);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 28px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Level Complete", 480, 238);
  ctx.font = "600 14px ui-sans-serif, system-ui";
  ctx.fillText("Press N for the next level", 480, 274);
}

function drawDebug(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const player = state.player;
  const rect = playerRect(player);
  const activePlates = [...state.interactions.pressedPlateIds].join(", ") || "none";
  const support =
    player.support.kind === "echo" ? `echo E${player.support.echoId}` : player.support.kind === "ground" ? "ground" : "none";
  const lines = [
    `player x ${player.x.toFixed(1)} y ${player.y.toFixed(1)}`,
    `velocity x ${player.vx.toFixed(1)} y ${player.vy.toFixed(1)}`,
    `grounded ${player.grounded}`,
    `support ${support}`,
    `active plates ${activePlates}`,
    `timeline ${state.timelineTime.toFixed(3)}`,
    `echo snapshots ${state.echoes.map((echo) => `E${echo.id}:${echo.snapshots.length}`).join("  ") || "none"}`,
  ];

  ctx.fillStyle = "rgba(18, 28, 35, 0.82)";
  ctx.fillRect(12, 92, 270, 154);
  ctx.fillStyle = "#e9f5f2";
  ctx.font = "600 12px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  lines.forEach((line, index) => {
    ctx.fillText(line, 24, 104 + index * 19);
  });

  ctx.strokeStyle = "#f0b84d";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  for (const sample of state.echoSamples) {
    if (!sample.alive || !rectsOverlap(rect, sample.rect)) {
      continue;
    }

    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(sample.rect.x - 2, sample.rect.y - 2, sample.rect.w + 4, sample.rect.h + 4);
  }
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
