import { useMemo, useState } from "react";
import { starterLevel } from "./levels";
import {
  ActionType,
  SimState,
  applyAction,
  createSimulation,
  randomSeed,
  resetSimulation,
  toPublicState,
} from "./simulation";

const actions: Array<{ type: ActionType; label: string; symbol: string; intent: string }> = [
  { type: "school", label: "School", symbol: "S", intent: "Stabilize nearby cells and lower pressure." },
  { type: "roadblock", label: "Road Block", symbol: "B", intent: "Cut pressure locally, but dampen influence flow." },
  { type: "signal", label: "Signal", symbol: "+", intent: "Spread influence farther, with some pressure risk." },
];

const cellSize = 42;
const gap = 4;

export default function App() {
  const [sim, setSim] = useState<SimState>(() => createSimulation(starterLevel, 42017));
  const [selectedAction, setSelectedAction] = useState<ActionType>("school");
  const visible = useMemo(() => toPublicState(sim), [sim]);
  const gridSize = starterLevel.size * cellSize + (starterLevel.size - 1) * gap;
  const selectedActionDetails = actions.find((action) => action.type === selectedAction)!;
  const scoreDelta = visible.stats.score - visible.baselineStats.score;

  const handleCellClick = (x: number, y: number) => {
    if (visible.isComplete) {
      return;
    }

    setSim((current) => applyAction(current, selectedAction, x, y));
  };

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="top-bar">
          <div>
            <h1>Systemic Puzzle Sim</h1>
            <p>Use 3 interventions to beat the starting score. Push opportunity up, pull pressure down, and watch how each move propagates.</p>
          </div>
          <div className="run-controls">
            <button type="button" onClick={() => setSim((current) => resetSimulation(current))}>
              Reset
            </button>
            <button type="button" onClick={() => setSim(createSimulation(starterLevel, randomSeed()))}>
              Random Seed
            </button>
          </div>
        </header>

        <div className="content">
          <section className="board-panel" aria-label="Opportunity grid">
            <div className="objective-strip">
              <strong>Goal: beat {visible.baselineStats.score}</strong>
              <span>Current {visible.stats.score}</span>
              <span className={scoreDelta >= 0 ? "good" : "bad"}>
                {scoreDelta >= 0 ? "+" : ""}
                {scoreDelta}
              </span>
            </div>
            <svg
              className="grid"
              viewBox={`0 0 ${gridSize} ${gridSize}`}
              role="grid"
              aria-label="Nine by nine simulation grid"
            >
              {visible.cells.map((cell) => {
                const x = cell.x * (cellSize + gap);
                const y = cell.y * (cellSize + gap);
                const color = heatColor(cell.heat);
                const isLocked = visible.isComplete || cell.marker !== "none";

                return (
                  <g
                    key={cell.id}
                    role="button"
                    aria-label={`Cell ${cell.x + 1}, ${cell.y + 1}`}
                    className={`cell ${isLocked ? "locked" : ""}`}
                    onClick={() => handleCellClick(cell.x, cell.y)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={cellSize}
                      height={cellSize}
                      rx={4}
                      fill={color}
                      stroke="rgba(18, 30, 42, 0.55)"
                      strokeWidth={1}
                    />
                    <text x={x + cellSize / 2} y={y + 19} textAnchor="middle" className="cell-number">
                      {Math.round(cell.heat * 100)}
                    </text>
                    <text x={x + cellSize / 2} y={y + 35} textAnchor="middle" className="cell-sub">
                      P {Math.round(cell.pressure * 100)}
                    </text>
                    {cell.marker !== "none" && (
                      <text x={x + cellSize - 10} y={y + 13} textAnchor="middle" className="marker">
                        {actions.find((action) => action.type === cell.marker)?.symbol}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="legend">
              <span>Low opportunity</span>
              <div className="legend-ramp" />
              <span>High opportunity</span>
            </div>
          </section>

          <aside className="side-panel">
            <section className="panel-block">
              <h2>Actions</h2>
              <div className="action-row">
                {actions.map((action) => (
                  <button
                    key={action.type}
                    type="button"
                    className={selectedAction === action.type ? "selected" : ""}
                    onClick={() => setSelectedAction(action.type)}
                    disabled={visible.isComplete}
                  >
                    <span>{action.symbol}</span>
                    {action.label}
                  </button>
                ))}
              </div>
              <p className="action-intent">{selectedActionDetails.intent}</p>
              <p className="small-note">{visible.actionsRemaining} actions remaining</p>
            </section>

            <section className="panel-block">
              <h2>Visible Readout</h2>
              <Metric label="Opportunity" value={visible.stats.opportunity} />
              <Metric label="Pressure" value={visible.stats.pressure} invert />
              <Metric label="Support" value={visible.stats.support} />
              <Metric label="Stability" value={visible.stats.stability} />
              <div className="score-line">
                <span>Score</span>
                <strong>
                  {visible.stats.score}
                  <em className={scoreDelta >= 0 ? "good" : "bad"}>
                    {scoreDelta >= 0 ? "+" : ""}
                    {scoreDelta}
                  </em>
                </strong>
              </div>
            </section>

            <section className="panel-block">
              <h2>Run</h2>
              <dl className="run-list">
                <div>
                  <dt>Seed</dt>
                  <dd>{visible.seed}</dd>
                </div>
                <div>
                  <dt>Turns simulated</dt>
                  <dd>{visible.turn}</dd>
                </div>
                <div>
                  <dt>Actions placed</dt>
                  <dd>{visible.actions.map((action) => actionName(action.type)).join(", ") || "None"}</dd>
                </div>
              </dl>
            </section>

            {visible.isComplete && (
              <section className="panel-block result-block">
                <h2>Before / After</h2>
                <p className={scoreDelta > 0 ? "verdict good" : "verdict bad"}>
                  {scoreDelta > 0 ? "Run improved the system." : "Run did not improve the system."}
                </p>
                <Compare label="Opportunity" before={visible.baselineStats.opportunity} after={visible.stats.opportunity} />
                <Compare label="Pressure" before={visible.baselineStats.pressure} after={visible.stats.pressure} invert />
                <Compare label="Score" before={visible.baselineStats.score} after={visible.stats.score} />
              </section>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const width = `${Math.round(value * 100)}%`;

  return (
    <div className="metric">
      <div className="metric-label">
        <span>{label}</span>
        <strong>{formatValue(value)}</strong>
      </div>
      <div className="meter">
        <div className={invert ? "meter-fill warning" : "meter-fill"} style={{ width }} />
      </div>
    </div>
  );
}

function Compare({ label, before, after, invert = false }: { label: string; before: number; after: number; invert?: boolean }) {
  const delta = after - before;
  const improved = invert ? delta < 0 : delta > 0;

  return (
    <div className="compare-row">
      <span>{label}</span>
      <strong>{formatValue(before)}{" -> "}{formatValue(after)}</strong>
      <em className={improved ? "good" : "bad"}>{delta >= 0 ? "+" : ""}{formatValue(delta)}</em>
    </div>
  );
}

function heatColor(value: number): string {
  const clamped = Math.max(0, Math.min(1, value));
  const hue = 215 - clamped * 165;
  const lightness = 32 + clamped * 34;
  return `hsl(${hue}, 70%, ${lightness}%)`;
}

function actionName(type: ActionType): string {
  if (type === "school") {
    return "School";
  }

  if (type === "roadblock") {
    return "Road Block";
  }

  return "Signal";
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 10) {
    return String(Math.round(value));
  }

  return value.toFixed(2);
}
