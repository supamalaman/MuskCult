export type MediaKind = 'video' | 'audio'

export interface MediaAsset {
  id: string
  name: string
  kind: MediaKind
  file: File
  url: string
  duration: number
  width?: number
  height?: number
}

export type AssembleMode = 'coherent' | 'random' | 'hybrid'

export interface CutSettings {
  mode: AssembleMode
  /** Target cut length in seconds when not beat-synced */
  cutLength: number
  /** Snap cuts to detected beats */
  beatSync: boolean
  /** How tightly to follow beats (0.4–1.5 seconds window) */
  beatDensity: number
  /** Prefer keeping clips in upload order (coherent/hybrid) */
  preserveOrder: boolean
  /** Crossfade between segments in seconds (preview approximation) */
  transition: number
  seed: number
}

export interface Segment {
  id: string
  assetId: string
  /** Source in-point on the original clip */
  sourceStart: number
  /** Length of this segment in the timeline */
  duration: number
  /** Timeline position */
  timelineStart: number
}

export interface Composition {
  segments: Segment[]
  duration: number
  musicId: string | null
  settings: CutSettings
  beats: number[]
}

export const DEFAULT_SETTINGS: CutSettings = {
  mode: 'coherent',
  cutLength: 0.5,
  beatSync: true,
  beatDensity: 0.75,
  preserveOrder: true,
  transition: 0.05,
  seed: Date.now() % 100000,
}
