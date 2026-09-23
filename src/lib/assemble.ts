import type { CutSettings, MediaAsset, Segment } from './types'
import { buildCutPoints } from './beats'
import { createRng, shuffleInPlace, uid } from './utils'

function pickSourceWindow(
  asset: MediaAsset,
  want: number,
  rng: () => number,
): { start: number; duration: number } {
  const usable = Math.max(0.05, asset.duration - 0.05)
  const duration = Math.min(want, usable)
  const maxStart = Math.max(0, asset.duration - duration)
  const start = maxStart > 0 ? rng() * maxStart : 0
  return { start, duration }
}

/**
 * Slice source clips and lay them against the music timeline.
 * Coherent: cycles clips in order, one segment per beat/cut.
 * Random: fully shuffled clip + in-point selection.
 * Hybrid: ordered clip cycling with random in-points.
 */
export function assembleComposition(
  videos: MediaAsset[],
  musicDuration: number,
  beats: number[],
  settings: CutSettings,
): Segment[] {
  if (videos.length === 0 || musicDuration <= 0) return []

  const rng = createRng(settings.seed)
  const cutPoints = buildCutPoints(
    musicDuration,
    beats,
    settings.beatSync,
    settings.cutLength,
  )

  const ordered =
    settings.mode === 'random' || !settings.preserveOrder
      ? shuffleInPlace([...videos], rng)
      : [...videos]

  const segments: Segment[] = []
  let clipIndex = 0

  for (let i = 0; i < cutPoints.length; i++) {
    const timelineStart = cutPoints[i]
    const timelineEnd = i + 1 < cutPoints.length ? cutPoints[i + 1] : musicDuration
    const want = Math.max(0.08, timelineEnd - timelineStart)
    if (want < 0.06) continue

    let asset: MediaAsset
    if (settings.mode === 'random') {
      asset = videos[Math.floor(rng() * videos.length)]
    } else {
      asset = ordered[clipIndex % ordered.length]
      clipIndex++
    }

    const randomizeInPoint =
      settings.mode === 'random' || settings.mode === 'hybrid'

    let sourceStart: number
    let duration: number

    if (randomizeInPoint) {
      const w = pickSourceWindow(asset, want, rng)
      sourceStart = w.start
      duration = Math.min(want, w.duration)
    } else {
      // Coherent: walk through each clip sequentially as a continuous strip
      const progress = (clipIndex - 1) / Math.max(1, cutPoints.length)
      const maxStart = Math.max(0, asset.duration - want)
      sourceStart = maxStart * (progress % 1)
      duration = Math.min(want, Math.max(0.08, asset.duration - sourceStart))
    }

    segments.push({
      id: uid('seg'),
      assetId: asset.id,
      sourceStart,
      duration,
      timelineStart,
    })
  }

  return segments
}

export function compositionDuration(segments: Segment[]): number {
  if (segments.length === 0) return 0
  const last = segments[segments.length - 1]
  return last.timelineStart + last.duration
}

export function segmentAtTime(
  segments: Segment[],
  time: number,
): Segment | null {
  for (const seg of segments) {
    if (time >= seg.timelineStart && time < seg.timelineStart + seg.duration) {
      return seg
    }
  }
  // Clamp to last frame of last segment
  if (segments.length && time >= compositionDuration(segments)) {
    return segments[segments.length - 1]
  }
  return null
}
