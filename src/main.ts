import { Game } from "./game/Game";
import "./style.css";

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("Missing #root element.");
}

root.innerHTML = `
  <main class="game-shell">
    <canvas id="game" aria-label="Echo Step puzzle platformer prototype" tabindex="0"></canvas>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (!canvas) {
  throw new Error("Missing game canvas.");
}

canvas.focus();
new Game(canvas).start();
