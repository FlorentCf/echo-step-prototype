# Echo Step

Echo Step is a small playable browser prototype for a puzzle-platformer built around one mechanic: each attempt can be recorded as an Echo, and all committed Echoes replay from the start of the next attempt.

Each live attempt can carry one object. When the attempt becomes an Echo, the Echo replays that carried object's pickup, use, and drop timing. Source objects reset every life, while objects dropped by Echoes become physical handoff objects that later lives can pick up.

## Requirements

- Node.js `20.19+` or `22.12+`
- npm

## Run Locally

Clone the repository:

```bash
git clone https://github.com/FlorentCf/echo-step-prototype.git
cd echo-step-prototype
```

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open the local URL printed by Vite. It will usually be:

```text
http://127.0.0.1:5173/
```

If that port is already in use, Vite will print the next available port, such as `http://127.0.0.1:5174/`.

## Build

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## Controls

- `A` / `D` or `Left` / `Right`: move
- `Space` or `W`: jump
- `E`: pick up or drop the nearest object
- `R`: commit the current run as an Echo and restart
- `K`: kill the current player, commit the run up to death, then restart
- `U`: undo the most recent Echo
- `C`: clear all Echoes and restart the level
- `N`: next level
- `B`: previous level
- `Escape`: restart the current live attempt without committing
- `F1`: toggle debug overlay

## Notes

- Each level runs on a fixed 8 second loop.
- A level can have up to 3 committed Echoes.
- Echoes replay from `t=0` on every new attempt.
- Source objects reset at the start of every new live attempt.
- Echo-carried Plate and Weight objects can act as top-only platforms.
- Dropped Echo objects become temporary handoff objects for the current live attempt.
- The game is rendered with plain HTML Canvas 2D and TypeScript.
