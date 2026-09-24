import { clamp } from './utils'

/**
 * Detect beat onsets from an audio ArrayBuffer using spectral flux
 * with a local adaptive threshold. Returns times in seconds.
 */
export async function detectBeats(
  arrayBuffer: ArrayBuffer,
  density = 0.75,
): Promise<number[]> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  const ctx = new AudioCtx()
  try {
    const audio = await ctx.decodeAudioData(arrayBuffer.slice(0))
    const channel = audio.getChannelData(0)
    const sampleRate = audio.sampleRate
    const hop = 512
    const frameSize = 1024
    const energies: number[] = []

    for (let i = 0; i + frameSize < channel.length; i += hop) {
      let sum = 0
      for (let j = 0; j < frameSize; j++) {
        const s = channel[i + j]
        sum += s * s
      }
      energies.push(Math.sqrt(sum / frameSize))
    }

    // Spectral flux proxy: positive energy deltas
    const flux: number[] = [0]
    for (let i = 1; i < energies.length; i++) {
      flux.push(Math.max(0, energies[i] - energies[i - 1]))
    }

    const windowFrames = Math.max(8, Math.round(sampleRate / hop / 4))
    const sensitivity = clamp(1.35 - density * 0.55, 0.7, 1.5)
    const peaks: number[] = []
    const minGapSec = clamp(0.18 + (1 - density) * 0.35, 0.15, 0.55)
    const minGapFrames = Math.round((minGapSec * sampleRate) / hop)
    let lastPeak = -minGapFrames

    for (let i = 1; i < flux.length - 1; i++) {
      const start = Math.max(0, i - windowFrames)
      const end = Math.min(flux.length, i + windowFrames)
      let mean = 0
      for (let k = start; k < end; k++) mean += flux[k]
      mean /= end - start

      const isLocalMax = flux[i] > flux[i - 1] && flux[i] >= flux[i + 1]
      if (isLocalMax && flux[i] > mean * sensitivity && i - lastPeak >= minGapFrames) {
        peaks.push((i * hop) / sampleRate)
        lastPeak = i
      }
    }

    // Always include t=0 as a cut point
    if (peaks.length === 0 || peaks[0] > 0.05) peaks.unshift(0)
    return peaks
  } finally {
    await ctx.close()
  }
}

/** Build cut points spanning [0, duration] from beats or fixed interval */
export function buildCutPoints(
  duration: number,
  beats: number[],
  beatSync: boolean,
  cutLength: number,
): number[] {
  if (duration <= 0) return [0]

  let points: number[]
  if (beatSync && beats.length > 1) {
    points = beats.filter((t) => t >= 0 && t < duration)
    if (points[0] !== 0) points = [0, ...points]
  } else {
    const step = Math.max(0.12, cutLength)
    points = []
    for (let t = 0; t < duration; t += step) points.push(t)
  }

  // Ensure we can always reach the end
  const last = points[points.length - 1]
  if (duration - last < 0.08) {
    // last cut too close to end — drop it so final segment has length
    if (points.length > 1) points.pop()
  }

  return points
}
