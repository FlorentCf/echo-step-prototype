import {
  FIXED_DT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  type Echo,
  type EchoSample,
  type ObjectDropEvent,
  type ObjectSnapshot,
  type PlayerSnapshot,
  type PlayerState,
} from "./types";

export type Recording = {
  snapshots: PlayerSnapshot[];
  objectDrops: ObjectDropEvent[];
};

export type FinalizedRecording = {
  snapshots: PlayerSnapshot[];
  objectDrops: ObjectDropEvent[];
};

type FinalizeMode = "standing" | "dead";

export function startRecording(player: PlayerState, carriedObject: ObjectSnapshot | null = null): Recording {
  return {
    snapshots: [snapshotFromPlayer(player, 0, carriedObject)],
    objectDrops: [],
  };
}

export function recordFrame(recording: Recording, player: PlayerState, t: number, carriedObject: ObjectSnapshot | null = null): void {
  const last = recording.snapshots[recording.snapshots.length - 1];
  const roundedT = roundTime(t);

  if (last && Math.abs(last.t - roundedT) < FIXED_DT * 0.4) {
    recording.snapshots[recording.snapshots.length - 1] = snapshotFromPlayer(player, roundedT, carriedObject);
    return;
  }

  recording.snapshots.push(snapshotFromPlayer(player, roundedT, carriedObject));
}

export function recordObjectDrop(recording: Recording, t: number, object: ObjectSnapshot): void {
  recording.objectDrops.push({
    t: roundTime(t),
    object: cloneObjectSnapshot(object)!,
  });
}

export function finalizeRecording(
  recording: Recording,
  player: PlayerState,
  currentTime: number,
  loopDuration: number,
  mode: FinalizeMode,
  carriedObject: ObjectSnapshot | null = null,
): FinalizedRecording {
  const frameCount = Math.round(loopDuration / FIXED_DT);
  const currentFrame = clampFrame(Math.round(currentTime / FIXED_DT), frameCount);
  const snapshots = recording.snapshots
    .filter((snapshot) => snapshot.t <= currentFrame * FIXED_DT + 0.0001)
    .map((snapshot) => ({ ...snapshot, carriedObject: cloneObjectSnapshot(snapshot.carriedObject) }));
  const finalCarriedObject = mode === "dead" ? null : carriedObject;
  const finalPose =
    mode === "dead"
      ? deadSnapshot(player, currentFrame * FIXED_DT)
      : standingSnapshot(player, currentFrame * FIXED_DT, finalCarriedObject);

  snapshots[currentFrame] = finalPose;

  for (let frame = 0; frame <= frameCount; frame += 1) {
    if (!snapshots[frame]) {
      const previous = snapshots[frame - 1] ?? finalPose;
      snapshots[frame] = {
        ...previous,
        t: roundTime(frame * FIXED_DT),
        carriedObject: cloneObjectSnapshot(previous.carriedObject),
      };
    }
  }

  for (let frame = currentFrame + 1; frame <= frameCount; frame += 1) {
    snapshots[frame] = {
      ...finalPose,
      t: roundTime(frame * FIXED_DT),
      alive: mode === "standing",
      carriedObject: cloneObjectSnapshot(finalPose.carriedObject),
    };
  }

  return {
    snapshots: snapshots.slice(0, frameCount + 1),
    objectDrops: recording.objectDrops
      .filter((drop) => drop.t <= currentFrame * FIXED_DT + 0.0001)
      .map((drop) => ({
        t: drop.t,
        object: cloneObjectSnapshot(drop.object)!,
      })),
  };
}

export function sampleEchoes(echoes: Echo[], t: number): EchoSample[] {
  return echoes.map((echo) => {
    const current = sampleSnapshot(echo, t);
    const previous = sampleSnapshot(echo, Math.max(0, t - FIXED_DT));

    return {
      ...current,
      echoId: echo.id,
      rect: snapshotRect(current),
      previousRect: snapshotRect(previous),
      dx: current.x - previous.x,
      dy: current.y - previous.y,
      carriedObject: cloneObjectSnapshot(current.carriedObject),
      previousCarriedObject: cloneObjectSnapshot(previous.carriedObject),
    };
  });
}

export function snapshotFromPlayer(
  player: PlayerState,
  t: number,
  carriedObject: ObjectSnapshot | null = null,
): PlayerSnapshot {
  return {
    t: roundTime(t),
    x: player.x,
    y: player.y,
    vx: player.vx,
    vy: player.vy,
    grounded: player.grounded,
    alive: player.alive,
    facing: player.facing,
    carriedObject: cloneObjectSnapshot(carriedObject),
  };
}

function sampleSnapshot(echo: Echo, t: number): PlayerSnapshot {
  const index = clampFrame(Math.round(t / FIXED_DT), echo.snapshots.length - 1);
  return echo.snapshots[index] ?? echo.snapshots[echo.snapshots.length - 1];
}

function standingSnapshot(player: PlayerState, t: number, carriedObject: ObjectSnapshot | null): PlayerSnapshot {
  return {
    ...snapshotFromPlayer(player, t, carriedObject),
    vx: 0,
    vy: 0,
    alive: true,
  };
}

function deadSnapshot(player: PlayerState, t: number): PlayerSnapshot {
  return {
    ...snapshotFromPlayer(player, t, null),
    vx: 0,
    vy: 0,
    alive: false,
  };
}

function snapshotRect(snapshot: PlayerSnapshot) {
  return {
    x: snapshot.x,
    y: snapshot.y,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT,
  };
}

function clampFrame(frame: number, maxFrame: number): number {
  return Math.max(0, Math.min(maxFrame, frame));
}

function roundTime(t: number): number {
  return Math.round(t * 1000) / 1000;
}

function cloneObjectSnapshot(object: ObjectSnapshot | null): ObjectSnapshot | null {
  if (!object) {
    return null;
  }

  return {
    id: object.id,
    kind: object.kind,
    rect: { ...object.rect },
  };
}
