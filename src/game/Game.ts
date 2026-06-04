import { levels } from "./levels";
import { createPlayer, playerRect, rectsOverlap, stepPlayer } from "./physics";
import {
  finalizeRecording,
  recordFrame,
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
  type Echo,
  type EchoSample,
  type InteractionState,
  type LevelDefinition,
  type MovementInput,
  type PlayerState,
  type Rect,
} from "./types";

type Command = "commit" | "kill" | "undo" | "clear" | "next" | "previous" | "restart";

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
      interactions: this.interactions,
      timelineTime: this.timelineTime,
      debug: this.debug,
      levelComplete: this.levelComplete,
      message: this.message,
    });

    requestAnimationFrame(this.loop);
  };

  private fixedUpdate(dt: number): void {
    this.processCommands();
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    if (this.messageTimer === 0) {
      this.message = "";
    }

    this.echoSamples = sampleEchoes(this.echoes, this.timelineTime);
    this.updateInteractions();

    if (this.levelComplete) {
      this.jumpQueued = false;
      return;
    }

    const input = this.readMovementInput();
    const solids = this.activeSolids();
    stepPlayer(this.player, input, solids, this.echoSamples, dt);
    this.updateInteractions();

    const nextTime = Math.min(this.level.loopDuration, this.timelineTime + dt);

    if (this.touchesHazard() || this.player.y > CANVAS_HEIGHT + 80) {
      this.player.alive = false;
      this.timelineTime = nextTime;
      recordFrame(this.recording, this.player, this.timelineTime);
      this.commitCurrentRun("dead", "Echo ended at the hazard.");
      return;
    }

    if (rectsOverlap(playerRect(this.player), this.level.exit)) {
      this.timelineTime = nextTime;
      recordFrame(this.recording, this.player, this.timelineTime);
      this.levelComplete = true;
      this.showMessage("Level complete.");
      return;
    }

    this.timelineTime = nextTime;
    recordFrame(this.recording, this.player, this.timelineTime);

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
      } else if (command === "commit" && !this.levelComplete) {
        this.commitCurrentRun("standing", "Echo committed.");
      } else if (command === "kill" && !this.levelComplete) {
        this.player.alive = false;
        recordFrame(this.recording, this.player, this.timelineTime);
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

  private commitCurrentRun(mode: "standing" | "dead", message: string): void {
    if (this.echoes.length >= MAX_ECHOES) {
      this.restartAttempt("Max Echoes reached. Use U or C.");
      return;
    }

    const snapshots = finalizeRecording(this.recording, this.player, this.timelineTime, this.level.loopDuration, mode);
    this.echoes.push({
      id: this.echoes.length + 1,
      snapshots,
    });
    this.restartAttempt(message);
  }

  private restartAttempt(message = ""): void {
    this.player = createPlayer(this.level.start);
    this.recording = startRecording(this.player);
    this.timelineTime = 0;
    this.levelComplete = false;
    this.jumpQueued = false;
    this.echoSamples = sampleEchoes(this.echoes, this.timelineTime);
    this.updateInteractions();

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

  private updateInteractions(): void {
    const actors: Rect[] = [];
    if (this.player.alive) {
      actors.push(playerRect(this.player));
    }

    for (const echo of this.echoSamples) {
      if (echo.alive) {
        actors.push(echo.rect);
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
    return this.level.hazards.some((hazard) => rectsOverlap(rect, hazard));
  }

  private reindexEchoes(): void {
    this.echoes = this.echoes.map((echo, index) => ({ ...echo, id: index + 1 }));
  }

  private showMessage(message: string): void {
    this.message = message;
    this.messageTimer = 1.4;
  }
}
