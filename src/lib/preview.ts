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

/**
 * Canvas-based preview that switches source videos per segment
 * while playing the music track in sync.
 */
export function createPreview(opts: {
  canvas: HTMLCanvasElement
  segments: Segment[]
  videos: MediaAsset[]
  music: MediaAsset | null
  onTime?: (t: number) => void
  onStatus?: (s: PreviewStatus) => void
}): PreviewController {
  const { canvas, segments, videos, music } = opts
  const ctx = canvas.getContext('2d')!
  const byId = new Map(videos.map((v) => [v.id, v]))

  const pool = new Map<string, HTMLVideoElement>()
  function getVideoEl(assetId: string): HTMLVideoElement | null {
    const asset = byId.get(assetId)
    if (!asset) return null
    let el = pool.get(assetId)
    if (!el) {
      el = document.createElement('video')
      el.src = asset.url
      el.muted = true
      el.playsInline = true
      el.preload = 'auto'
      pool.set(assetId, el)
    }
    return el
  }

  const musicEl = music ? new Audio(music.url) : null
  if (musicEl) {
    musicEl.preload = 'auto'
  }

  let status: PreviewStatus = 'idle'
  let currentSegId: string | null = null
  let raf = 0
  let destroyed = false

  const duration = Math.max(
    compositionDuration(segments),
    music?.duration ?? 0,
  )

  function setStatus(s: PreviewStatus) {
    status = s
    opts.onStatus?.(s)
  }

  function drawFrame(video: HTMLVideoElement) {
    const cw = canvas.width
    const ch = canvas.height
    if (video.readyState < 2 || !video.videoWidth) {
      // Keep last painted frame instead of flashing black between seeks
      return
    }

    ctx.fillStyle = '#0a0a0c'
    ctx.fillRect(0, 0, cw, ch)

    const vw = video.videoWidth
    const vh = video.videoHeight
    const scale = Math.max(cw / vw, ch / vh)
    const dw = vw * scale
    const dh = vh * scale
    const dx = (cw - dw) / 2
    const dy = (ch - dh) / 2
    ctx.drawImage(video, dx, dy, dw, dh)
  }

  let syncing = false

  async function ensureReady(el: HTMLVideoElement) {
    if (el.readyState >= 2 && el.videoWidth > 0) return
    await new Promise<void>((resolve) => {
      const done = () => {
        el.removeEventListener('loadeddata', done)
        resolve()
      }
      el.addEventListener('loadeddata', done)
      if (el.readyState === 0) el.load()
      window.setTimeout(done, 800)
    })
  }

  async function syncTo(time: number) {
    if (destroyed || syncing) return
    syncing = true
    try {
      const seg = segmentAtTime(segments, time)
      if (!seg) return
      const el = getVideoEl(seg.assetId)
      if (!el) return

      await ensureReady(el)

      const local = clamp(
        seg.sourceStart + (time - seg.timelineStart),
        0,
        Number.isFinite(el.duration) && el.duration > 0 ? el.duration : Infinity,
      )

      const needSeek =
        seg.id !== currentSegId || Math.abs(el.currentTime - local) > 0.22

      if (seg.id !== currentSegId) {
        currentSegId = seg.id
        for (const [id, v] of pool) {
          if (id !== seg.assetId && !v.paused) v.pause()
        }
      }

      if (needSeek) {
        await new Promise<void>((resolve) => {
          const done = () => {
            el.removeEventListener('seeked', done)
            resolve()
          }
          el.addEventListener('seeked', done)
          try {
            el.currentTime = local
          } catch {
            resolve()
          }
          window.setTimeout(done, 180)
        })
      }

      if (status === 'playing') {
        if (el.paused) await el.play().catch(() => {})
      } else {
        try {
          await el.play()
          el.pause()
        } catch {
          /* ignore */
        }
      }
      drawFrame(el)
    } finally {
      syncing = false
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

    void syncTo(t)
    raf = requestAnimationFrame(tick)
  }

  async function play() {
    if (!segments.length) return
    if (status === 'ended') {
      seek(0)
    }
    setStatus('playing')
    if (musicEl) {
      await musicEl.play().catch(() => {})
    }
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(tick)
  }

  function pause() {
    cancelAnimationFrame(raf)
    musicEl?.pause()
    for (const v of pool.values()) v.pause()
    if (status === 'playing') setStatus('paused')
  }

  function seek(time: number) {
    const t = clamp(time, 0, duration)
    if (musicEl) musicEl.currentTime = t
    currentSegId = null
    void syncTo(t)
    opts.onTime?.(t)
    if (status === 'ended') setStatus('paused')
  }

  function destroy() {
    destroyed = true
    pause()
    setStatus('idle')
    musicEl?.removeAttribute('src')
    for (const v of pool.values()) {
      v.pause()
      v.removeAttribute('src')
      v.load()
    }
    pool.clear()
  }

  // Initial frame
  if (segments.length) void syncTo(0)

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

  // Reuse preview drawing against a disposable controller timeline
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
          ctx.fillStyle = '#000'
          ctx.fillRect(0, 0, width, height)
          if (el.readyState >= 2) {
            const vw = el.videoWidth || 16
            const vh = el.videoHeight || 9
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
