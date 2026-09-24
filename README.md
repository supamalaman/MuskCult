# MuskCult

Browser-based music video maker. Drop video clips and a track, cut on the beat (or scatter randomly), preview the edit, and export a WebM.

## Run

```bash
npm install
npm run dev
```

Or via **Macro Launch** (tools hub):

```bash
npm run macro-launch
# or double-click: Run Macro Launch.command
```

One-click MuskCult only:

```bash
npm run start:muskcult
```

## Macro Launch

`macro-launch/` is the local launcher for MuskCult (and other tools listed in `macro-launch/tools.json`).

- **MuskCult** is registered and starts the Vite app on port 5173 if needed
- Edit `tools.json` to add more apps (Four-Panel Image Splitter is pre-listed if installed under `~/Documents/Apps/`)

### Desktop / dock (Linux)

```bash
bash scripts/install-launchers.sh
```

## Modes

- **Coherent** — cycle clips in order, cut on detected beats
- **Random** — shuffle sources and in-points
- **Hybrid** — ordered clips with wild in-points

All processing stays in your browser (Web Audio beat detection + canvas preview/export).
