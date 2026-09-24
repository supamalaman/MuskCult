# MuskCult

Browser-based music video maker. Drop video clips and a track, cut on the beat (or scatter randomly), preview the edit, and export a WebM.

## Run

```bash
npm install
npm run dev
```

## Macro Launch (`Applications/Macro.app`)

MuskCult is registered in **Macro Launch**. On a Mac:

```bash
npm install
bash scripts/install-macro-app.sh
open /Applications/Macro.app
```

That installs/updates `/Applications/Macro.app` (or `~/Applications/Macro.app`), links the repo at `~/Documents/Apps/MuskCult`, and opens the Macro Launch hub with **MuskCult** as a one-click tool.

Cross-platform (no `.app` needed):

```bash
npm run macro-launch
```

Add more tools in `macro-launch/tools.json`.

### Linux desktop / dock

```bash
bash scripts/install-launchers.sh
```

## Modes

- **Coherent** — cycle clips in order, cut on detected beats
- **Random** — shuffle sources and in-points
- **Hybrid** — ordered clips with wild in-points

All processing stays in your browser (Web Audio beat detection + canvas preview/export).
