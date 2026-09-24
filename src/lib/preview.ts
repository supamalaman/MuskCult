import type { MediaAsset, Segment } from './types'
import { compositionDuration, segmentAtTime } from './assemble'
import { clamp } from './utils'

export type PreviewStatus = 'idle' | 'playing' | 'paused' | 'ended'

export interface PreviewController {
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  destroy: () => void
  getTime: () => number
  getStatus: () => PreviewStatus
}

function waitForEvent(
  el: HTMLMediaElement,
  event: string,
  timeoutMs = 400,
): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener(event, done)
      resolve()
    }
    el.addEventListener(event, done)
    window.setTimeout(done, timeoutMs)
  })
}

/**
 * Preview that swaps a visible <video> element per timeline segment
 * while the music track drives time.
 */
export function createPreview(opts: {
  videoEl: HTMLVideoElement
  segments: Segment[]
  videos: MediaAsset[]
  music: MediaAsset | null
  onTime?: (t: number) => void
  onStatus?: (s: PreviewStatus) => void
}): PreviewController {
  const { videoEl, segments, videos, music } = opts
  const byId = new Map(videos.map((v) => [v.id, v]))

  const musicEl = music ? new Audio(music.url) : null
  if (musicEl) musicEl.preload = 'auto'

  let status: PreviewStatus = 'idle'
  let currentSegId: string | null = null
  let raf = 0
  let destroyed = false
  let switching = false

  const duration = Math.max(
    compositionDuration(segments),
    music?.duration ?? 0,
  )

  function setStatus(s: PreviewStatus) {
    status = s
    opts.onStatus?.(s)
  }

  async function showSegment(seg: Segment, timelineTime: number) {
    const asset = byId.get(seg.assetId)
    if (!asset) return

    if (videoEl.src !== asset.url) {
      videoEl.src = asset.url
      videoEl.load()
      await waitForEvent(videoEl, 'loadeddata', 900)
    }

    const local = clamp(
      seg.sourceStart + (timelineTime - seg.timelineStart),
      0,
      Number.isFinite(videoEl.duration) && videoEl.duration > 0
        ? videoEl.duration
        : Infinity,
    )

    if (Math.abs(videoEl.currentTime - local) > 0.05) {
      const seeked = waitForEvent(videoEl, 'seeked', 280)
      try {
        videoEl.currentTime = local
      } catch {
        /* ignore */
      }
      await seeked
    }

    currentSegId = seg.id
    videoEl.muted = true

    if (status === 'playing') {
      await videoEl.play().catch(() => {})
    } else {
      videoEl.pause()
    }
  }

  async function switchIfNeeded(time: number) {
    if (switching) return
    switching = true
    try {
      let guard = 0
      while (guard++ < 6) {
        const now = musicEl?.currentTime ?? time
        const seg = segmentAtTime(segments, now)
        if (!seg || seg.id === currentSegId) break
        await showSegment(seg, now)
      }
    } finally {
      switching = false
    }
  }

  function tick() {
    if (destroyed) return
    const t = musicEl ? musicEl.currentTime : 0
    opts.onTime?.(t)

    if (t >= duration - 0.04) {
      pause()
      setStatus('ended')
      opts.onTime?.(duration)
      return
    }

    void switchIfNeeded(t)
    raf = requestAnimationFrame(tick)
  }

  async function play() {
    if (!segments.length) return
    if (status === 'ended') seek(0)
    setStatus('playing')
    if (musicEl) await musicEl.play().catch(() => {})
    await videoEl.play().catch(() => {})
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(tick)
  }

  function pause() {
    cancelAnimationFrame(raf)
    musicEl?.pause()
    videoEl.pause()
    if (status === 'playing') setStatus('paused')
  }

  function seek(time: number) {
    const t = clamp(time, 0, duration)
    if (musicEl) musicEl.currentTime = t
    currentSegId = null
    const seg = segmentAtTime(segments, t) ?? segments[0]
    if (seg) void showSegment(seg, t)
    opts.onTime?.(t)
    if (status === 'ended') setStatus('paused')
  }

  function destroy() {
    destroyed = true
    pause()
    setStatus('idle')
    musicEl?.removeAttribute('src')
    videoEl.removeAttribute('src')
    videoEl.load()
  }

  if (segments.length) {
    void showSegment(segments[0], 0)
  }

  return {
    play,
    pause,
    seek,
    destroy,
    getTime: () => (musicEl ? musicEl.currentTime : 0),
    getStatus: () => status,
  }
}

/**
 * Record the composition to a WebM blob via canvas capture + music.
 */
export async function exportComposition(opts: {
  segments: Segment[]
  videos: MediaAsset[]
  music: MediaAsset | null
  width?: number
  height?: number
  onProgress?: (p: number) => void
}): Promise<Blob> {
  const width = opts.width ?? 1280
  const height = opts.height ?? 720
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const duration = Math.max(
    compositionDuration(opts.segments),
    opts.music?.duration ?? 0,
  )

  const stream = canvas.captureStream(30)
  let audioCtx: AudioContext | null = null
  let musicEl: HTMLAudioElement | null = null

  if (opts.music) {
    musicEl = new Audio(opts.music.url)
    musicEl.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      musicEl!.oncanplaythrough = () => resolve()
      musicEl!.onerror = () => reject(new Error('Music failed to load for export'))
      musicEl!.load()
    })
    audioCtx = new AudioContext()
    const source = audioCtx.createMediaElementSource(musicEl)
    const dest = audioCtx.createMediaStreamDestination()
    source.connect(dest)
    source.connect(audioCtx.destination)
    for (const track of dest.stream.getAudioTracks()) {
      stream.addTrack(track)
    }
  }

  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm'

  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 6_000_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }))
    recorder.onerror = () => reject(new Error('Export recording failed'))
  })

  const byId = new Map(opts.videos.map((v) => [v.id, v]))
  const pool = new Map<string, HTMLVideoElement>()
  const ctx = canvas.getContext('2d')!

  function getEl(id: string) {
    const asset = byId.get(id)
    if (!asset) return null
    let el = pool.get(id)
    if (!el) {
      el = document.createElement('video')
      el.src = asset.url
      el.muted = true
      el.playsInline = true
      el.preload = 'auto'
      pool.set(id, el)
    }
    return el
  }

  recorder.start(200)
  if (musicEl) await musicEl.play()

  const start = performance.now()
  let lastSeg: string | null = null

  await new Promise<void>((resolve) => {
    const step = async () => {
      const elapsed = (performance.now() - start) / 1000
      const t = Math.min(elapsed, duration)
      opts.onProgress?.(t / duration)

      const seg = segmentAtTime(opts.segments, t)
      if (seg) {
        const el = getEl(seg.assetId)
        if (el) {
          const local = seg.sourceStart + (t - seg.timelineStart)
          if (seg.id !== lastSeg) {
            lastSeg = seg.id
            try {
              el.currentTime = local
              await el.play().catch(() => {})
            } catch {
              /* ignore */
            }
          }
          if (el.readyState >= 2 && el.videoWidth) {
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, width, height)
            const vw = el.videoWidth
            const vh = el.videoHeight
            const scale = Math.max(width / vw, height / vh)
            const dw = vw * scale
            const dh = vh * scale
            ctx.drawImage(el, (width - dw) / 2, (height - dh) / 2, dw, dh)
          }
        }
      }

      if (t >= duration) {
        resolve()
        return
      }
      requestAnimationFrame(() => {
        void step()
      })
    }
    void step()
  })

  recorder.stop()
  musicEl?.pause()
  for (const v of pool.values()) {
    v.pause()
    v.removeAttribute('src')
  }
  await audioCtx?.close()

  return done
}
