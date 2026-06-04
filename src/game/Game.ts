import { levels } from "./levels";
import { createPlayer, playerRect, rectsOverlap, stepPlayer } from "./physics";
import {
  finalizeRecording,
  recordFrame,
  recordObjectDrop,
  sampleEchoes,
  startRecording,
  type Recording,
} from "./recorder";
import { render } from "./render";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FIXED_DT,
  MAX_ECHOES,
  PICKUP_RADIUS,
  PLAYER_HEIGHT,
  type Echo,
  type EchoSample,
  type InteractionState,
  type LevelDefinition,
  type MovementInput,
  type ObjectKind,
  type ObjectPlatform,
  type ObjectSnapshot,
  type PlayerState,
  type Rect,
  type RenderObject,
} from "./types";

type Command = "commit" | "kill" | "undo" | "clear" | "next" | "previous" | "restart" | "interact";
type PickableRole = "source" | "loose" | "handoff";
type PickableObject = { role: PickableRole; object: ObjectSnapshot; distance: number };
type HandoffObject = ObjectSnapshot & { dropTime: number; echoId: number; pulse: number };

const HANDOFF_PULSE_DURATION = 0.48;

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly keys = new Set<string>();
  private readonly commands: Command[] = [];
  private player: PlayerState;
  private echoes: Echo[] = [];
  private recording: Recording;
  private levelIndex = 0;
  private timelineTime = 0;
  private accumulator = 0;
  private lastTime = 0;
  private jumpQueued = false;
  private debug = false;
  private levelComplete = false;
  private message = "";
  private messageTimer = 0;
  private interactions: InteractionState = { pressedPlateIds: new Set(), openDoorIds: new Set() };
  private echoSamples: EchoSample[] = [];
  private carriedObject: ObjectSnapshot | null = null;
  private looseObjects: ObjectSnapshot[] = [];
  private availableHandoffObjects: HandoffObject[] = [];
  private objectPlatforms: ObjectPlatform[] = [];
  private pickedSourceIds = new Set<string>();
  private pickedHandoffIds = new Set<string>();
  private nearestPickableObject: ObjectSnapshot | null = null;
  private looseObjectCounter = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable.");
    }

    this.ctx = ctx;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.player = createPlayer(this.level.start);
    this.recording = startRecording(this.player);
    this.refreshTimelineState();
    this.bindInput();
  }

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private get level(): LevelDefinition {
    return levels[this.levelIndex];
  }

  private readonly loop = (now: number): void => {
    const frameTime = Math.min(0.08, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.accumulator += frameTime;

    while (this.accumulator >= FIXED_DT) {
      this.fixedUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    render(this.ctx, {
      level: this.level,
      levelIndex: this.levelIndex,
      levelCount: levels.length,
      player: this.player,
      echoes: this.echoes,
      echoSamples: this.echoSamples,
      renderObjects: this.renderObjects(),
      carryingObject: this.carriedObject,
      nearbyObject: this.nearestPickableObject,
      interactions: this.interactions,
      timelineTime: this.timelineTime,
      debug: this.debug,
      levelComplete: this.levelComplete,
      message: this.message,
    });

    requestAnimationFrame(this.loop);
  };

  private fixedUpdate(dt: number): void {
    this.refreshTimelineState();
    this.processCommands();
    this.refreshTimelineState();

    this.messageTimer = Math.max(0, this.messageTimer - dt);
    if (this.messageTimer === 0) {
      this.message = "";
    }

    if (this.levelComplete) {
      this.jumpQueued = false;
      return;
    }

    const input = this.readMovementInput();
    const solids = this.activeSolids();
    stepPlayer(this.player, input, solids, this.objectPlatforms, dt);
    this.updateCarriedObjectRect();
    this.refreshTimelineState();

    const nextTime = Math.min(this.level.loopDuration, this.timelineTime + dt);

    if (this.touchesHazard() || this.player.y > CANVAS_HEIGHT + 80) {
      this.player.alive = false;
      this.timelineTime = nextTime;
      recordFrame(this.recording, this.player, this.timelineTime, this.carriedObject);
      this.commitCurrentRun("dead", "Echo ended at the hazard.");
      return;
    }

    if (rectsOverlap(playerRect(this.player), this.level.exit)) {
      this.timelineTime = nextTime;
      recordFrame(this.recording, this.player, this.timelineTime, this.carriedObject);
      this.levelComplete = true;
      this.showMessage("Level complete.");
      return;
    }

    this.timelineTime = nextTime;
    recordFrame(this.recording, this.player, this.timelineTime, this.carriedObject);

    if (this.timelineTime >= this.level.loopDuration - 0.0001) {
      this.commitCurrentRun("standing", "Loop committed.");
    }
  }

  private bindInput(): void {
    window.addEventListener("keydown", (event) => {
      const handled = this.handleKeyDown(event);
      if (handled) {
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      const handled = this.handleKeyUp(event);
      if (handled) {
        event.preventDefault();
      }
    });
  }

  private handleKeyDown(event: KeyboardEvent): boolean {
    switch (event.code) {
      case "ArrowLeft":
      case "KeyA":
        this.keys.add("left");
        return true;
      case "ArrowRight":
      case "KeyD":
        this.keys.add("right");
        return true;
      case "Space":
      case "KeyW":
        this.keys.add("jump");
        if (!event.repeat) {
          this.jumpQueued = true;
        }
        return true;
      case "KeyE":
        this.queueCommand("interact", event.repeat);
        return true;
      case "KeyR":
        this.queueCommand("commit", event.repeat);
        return true;
      case "KeyK":
        this.queueCommand("kill", event.repeat);
        return true;
      case "KeyU":
        this.queueCommand("undo", event.repeat);
        return true;
      case "KeyC":
        this.queueCommand("clear", event.repeat);
        return true;
      case "KeyN":
        this.queueCommand("next", event.repeat);
        return true;
      case "KeyB":
        this.queueCommand("previous", event.repeat);
        return true;
      case "Escape":
        this.queueCommand("restart", event.repeat);
        return true;
      case "F1":
        if (!event.repeat) {
          this.debug = !this.debug;
        }
        return true;
      default:
        return false;
    }
  }

  private handleKeyUp(event: KeyboardEvent): boolean {
    switch (event.code) {
      case "ArrowLeft":
      case "KeyA":
        this.keys.delete("left");
        return true;
      case "ArrowRight":
      case "KeyD":
        this.keys.delete("right");
        return true;
      case "Space":
      case "KeyW":
        this.keys.delete("jump");
        return true;
      default:
        return false;
    }
  }

  private queueCommand(command: Command, repeated: boolean): void {
    if (!repeated) {
      this.commands.push(command);
    }
  }

  private processCommands(): void {
    while (this.commands.length > 0) {
      const command = this.commands.shift();

      if (command === "next") {
        this.changeLevel(1);
      } else if (command === "previous") {
        this.changeLevel(-1);
      } else if (command === "clear") {
        this.echoes = [];
        this.restartAttempt("Echoes cleared.");
      } else if (command === "undo") {
        this.echoes.pop();
        this.reindexEchoes();
        this.restartAttempt("Last Echo removed.");
      } else if (command === "restart") {
        this.restartAttempt("Attempt restarted.");
      } else if (command === "interact" && !this.levelComplete) {
        this.handleObjectInteraction();
      } else if (command === "commit" && !this.levelComplete) {
        this.commitCurrentRun("standing", "Echo committed.");
      } else if (command === "kill" && !this.levelComplete) {
        this.player.alive = false;
        recordFrame(this.recording, this.player, this.timelineTime, this.carriedObject);
        this.commitCurrentRun("dead", "Echo ended here.");
      }
    }
  }

  private readMovementInput(): MovementInput {
    const input = {
      left: this.keys.has("left"),
      right: this.keys.has("right"),
      jumpPressed: this.jumpQueued,
      jumpHeld: this.keys.has("jump"),
    };

    this.jumpQueued = false;
    return input;
  }

  private handleObjectInteraction(): void {
    if (this.carriedObject) {
      this.dropCarriedObject();
      return;
    }

    const nearest = this.findNearestPickableObject();
    if (!nearest) {
      this.showMessage("No object nearby.");
      return;
    }

    this.pickObject(nearest);
  }

  private pickObject(candidate: PickableObject): void {
    if (candidate.role === "source") {
      this.pickedSourceIds.add(candidate.object.id);
    } else if (candidate.role === "loose") {
      this.looseObjects = this.looseObjects.filter((object) => object.id !== candidate.object.id);
    } else {
      this.pickedHandoffIds.add(candidate.object.id);
    }

    this.carriedObject = this.carriedCopy(candidate.object);
    this.updateCarriedObjectRect();
    this.showMessage(`${objectName(this.carriedObject.kind)} picked up.`);
  }

  private dropCarriedObject(): void {
    if (!this.carriedObject) {
      return;
    }

    const dropped: ObjectSnapshot = {
      ...this.carriedObject,
      id: `drop-${this.looseObjectCounter + 1}-${this.carriedObject.id}`,
      rect: this.dropRect(this.carriedObject),
    };

    this.looseObjectCounter += 1;
    this.looseObjects.push(dropped);
    recordObjectDrop(this.recording, this.timelineTime, dropped);
    this.carriedObject = null;
    this.showMessage(`${objectName(dropped.kind)} dropped.`);
  }

  private commitCurrentRun(mode: "standing" | "dead", message: string): void {
    if (this.echoes.length >= MAX_ECHOES) {
      this.restartAttempt("Max Echoes reached. Use U or C.");
      return;
    }

    const finalized = finalizeRecording(
      this.recording,
      this.player,
      this.timelineTime,
      this.level.loopDuration,
      mode,
      this.carriedObject,
    );

    this.echoes.push({
      id: this.echoes.length + 1,
      snapshots: finalized.snapshots,
      objectDrops: finalized.objectDrops,
    });
    this.restartAttempt(message);
  }

  private restartAttempt(message = ""): void {
    this.player = createPlayer(this.level.start);
    this.carriedObject = null;
    this.looseObjects = [];
    this.pickedSourceIds = new Set();
    this.pickedHandoffIds = new Set();
    this.looseObjectCounter = 0;
    this.recording = startRecording(this.player);
    this.timelineTime = 0;
    this.levelComplete = false;
    this.jumpQueued = false;
    this.refreshTimelineState();

    if (message) {
      this.showMessage(message);
    }
  }

  private changeLevel(direction: number): void {
    this.levelIndex = (this.levelIndex + direction + levels.length) % levels.length;
    this.echoes = [];
    this.restartAttempt("");
    this.showMessage(this.level.name);
  }

  private refreshTimelineState(): void {
    this.updateCarriedObjectRect();
    this.echoSamples = sampleEchoes(this.echoes, this.timelineTime);
    this.availableHandoffObjects = this.collectHandoffObjects();
    this.objectPlatforms = this.collectObjectPlatforms();
    this.updateInteractions();
    this.nearestPickableObject = this.carriedObject ? null : this.findNearestPickableObject()?.object ?? null;
  }

  private updateInteractions(): void {
    const actors: Rect[] = [];
    if (this.player.alive) {
      actors.push(playerRect(this.player));
    }

    for (const object of this.renderObjects()) {
      if (objectPressesPlates(object.kind)) {
        actors.push(object.rect);
      }
    }

    const pressedPlateIds = new Set<string>();
    for (const plate of this.level.plates) {
      if (actors.some((actor) => rectsOverlap(actor, plate.rect))) {
        pressedPlateIds.add(plate.id);
      }
    }

    const openDoorIds = new Set<string>();
    for (const door of this.level.doors) {
      if (door.plateIds.every((plateId) => pressedPlateIds.has(plateId))) {
        openDoorIds.add(door.id);
      }
    }

    this.interactions = { pressedPlateIds, openDoorIds };
  }

  private activeSolids(): Rect[] {
    const closedDoors = this.level.doors
      .filter((door) => !this.interactions.openDoorIds.has(door.id))
      .map((door) => door.rect);
    return [...this.level.solids, ...closedDoors];
  }

  private touchesHazard(): boolean {
    const rect = playerRect(this.player);

    for (const hazard of this.level.hazards) {
      if (!rectsOverlap(rect, hazard)) {
        continue;
      }

      if (this.isShielded(hazard)) {
        continue;
      }

      return true;
    }

    return false;
  }

  private isShielded(hazard: Rect): boolean {
    if (this.carriedObject?.kind === "shield") {
      return true;
    }

    return this.renderObjects().some((object) => object.kind === "shield" && rectsOverlap(object.rect, hazard));
  }

  private findNearestPickableObject(): PickableObject | null {
    const playerCenter = centerOf(playerRect(this.player));
    const candidates: PickableObject[] = [];

    for (const object of this.level.objects) {
      if (this.pickedSourceIds.has(object.id)) {
        continue;
      }

      candidates.push({
        role: "source",
        object: cloneObject(object),
        distance: distanceBetween(playerCenter, centerOf(object.rect)),
      });
    }

    for (const object of this.looseObjects) {
      candidates.push({
        role: "loose",
        object: cloneObject(object),
        distance: distanceBetween(playerCenter, centerOf(object.rect)),
      });
    }

    for (const object of this.availableHandoffObjects) {
      candidates.push({
        role: "handoff",
        object: cloneObject(object),
        distance: distanceBetween(playerCenter, centerOf(object.rect)),
      });
    }

    const nearest = candidates
      .filter((candidate) => candidate.distance <= PICKUP_RADIUS)
      .sort((a, b) => a.distance - b.distance)[0];

    return nearest ?? null;
  }

  private collectHandoffObjects(): HandoffObject[] {
    const handoffs: HandoffObject[] = [];

    for (const echo of this.echoes) {
      echo.objectDrops.forEach((drop, index) => {
        if (drop.t > this.timelineTime + 0.0001) {
          return;
        }

        const id = `handoff-e${echo.id}-${index}-${drop.object.id}`;
        if (this.pickedHandoffIds.has(id)) {
          return;
        }

        const age = Math.max(0, this.timelineTime - drop.t);
        handoffs.push({
          id,
          kind: drop.object.kind,
          rect: { ...drop.object.rect },
          dropTime: drop.t,
          echoId: echo.id,
          pulse: Math.max(0, 1 - age / HANDOFF_PULSE_DURATION),
        });
      });
    }

    return handoffs;
  }

  private collectObjectPlatforms(): ObjectPlatform[] {
    const platforms: ObjectPlatform[] = [];

    for (const object of this.renderObjects()) {
      if (!objectSupportsPlayer(object.kind) || object.role === "live-carried") {
        continue;
      }

      const previousRect =
        object.role === "echo-carried"
          ? this.previousEchoObjectRect(object.echoId, object.id) ?? object.rect
          : object.rect;

      platforms.push({
        id: `${object.role}-${object.echoId ?? "live"}-${object.id}`,
        rect: object.rect,
        previousRect,
        dx: object.rect.x - previousRect.x,
        dy: object.rect.y - previousRect.y,
      });
    }

    return platforms;
  }

  private previousEchoObjectRect(echoId: number | undefined, objectId: string): Rect | null {
    if (!echoId) {
      return null;
    }

    const sample = this.echoSamples.find((echo) => echo.echoId === echoId);
    if (!sample?.previousCarriedObject || sample.previousCarriedObject.id !== objectId) {
      return null;
    }

    return sample.previousCarriedObject.rect;
  }

  private renderObjects(): RenderObject[] {
    const objects: RenderObject[] = [];

    for (const object of this.level.objects) {
      if (!this.pickedSourceIds.has(object.id)) {
        objects.push({ ...cloneObject(object), role: "source" });
      }
    }

    for (const object of this.looseObjects) {
      objects.push({ ...cloneObject(object), role: "loose" });
    }

    for (const object of this.availableHandoffObjects) {
      objects.push({ ...cloneObject(object), role: "handoff", echoId: object.echoId, pulse: object.pulse });
    }

    for (const sample of this.echoSamples) {
      if (sample.alive && sample.carriedObject) {
        objects.push({ ...cloneObject(sample.carriedObject), role: "echo-carried", echoId: sample.echoId });
      }
    }

    if (this.carriedObject) {
      objects.push({ ...cloneObject(this.carriedObject), role: "live-carried" });
    }

    return objects;
  }

  private updateCarriedObjectRect(): void {
    if (!this.carriedObject) {
      return;
    }

    this.carriedObject = {
      ...this.carriedObject,
      rect: this.carriedRect(this.carriedObject),
    };
  }

  private carriedCopy(object: ObjectSnapshot): ObjectSnapshot {
    return {
      id: object.id,
      kind: object.kind,
      rect: this.carriedRect(object),
    };
  }

  private carriedRect(object: ObjectSnapshot): Rect {
    const rect = playerRect(this.player);

    if (object.kind === "shield") {
      return {
        x: this.player.facing > 0 ? rect.x + rect.w + 5 : rect.x - object.rect.w - 5,
        y: rect.y + 3,
        w: object.rect.w,
        h: object.rect.h,
      };
    }

    return {
      x: rect.x + rect.w / 2 - object.rect.w / 2,
      y: rect.y - object.rect.h - 7,
      w: object.rect.w,
      h: object.rect.h,
    };
  }

  private dropRect(object: ObjectSnapshot): Rect {
    const rect = playerRect(this.player);
    return {
      x: rect.x + rect.w / 2 - object.rect.w / 2,
      y: rect.y + PLAYER_HEIGHT - object.rect.h,
      w: object.rect.w,
      h: object.rect.h,
    };
  }

  private reindexEchoes(): void {
    this.echoes = this.echoes.map((echo, index) => ({ ...echo, id: index + 1 }));
  }

  private showMessage(message: string): void {
    this.message = message;
    this.messageTimer = 1.4;
  }
}

function objectSupportsPlayer(kind: ObjectKind): boolean {
  return kind === "plate" || kind === "weight";
}

function objectPressesPlates(kind: ObjectKind): boolean {
  return kind === "plate" || kind === "weight";
}

function cloneObject(object: ObjectSnapshot): ObjectSnapshot {
  return {
    id: object.id,
    kind: object.kind,
    rect: { ...object.rect },
  };
}

function centerOf(rect: Rect): { x: number; y: number } {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  };
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function objectName(kind: ObjectKind): string {
  if (kind === "plate") {
    return "Plate";
  }

  if (kind === "shield") {
    return "Shield";
  }

  return "Weight";
}
