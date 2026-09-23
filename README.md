# MuskCult

Browser-based music video maker. Drop video clips and a track, cut on the beat (or scatter randomly), preview the edit, and export a WebM.

## Run

```bash
npm install
npm run dev
```

## Modes

- **Coherent** — cycle clips in order, cut on detected beats
- **Random** — shuffle sources and in-points
- **Hybrid** — ordered clips with wild in-points

All processing stays in your browser (Web Audio beat detection + canvas preview/export).
