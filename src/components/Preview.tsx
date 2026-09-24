import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import type { MediaAsset, Segment } from '../lib/types'
import type { PreviewStatus } from '../lib/preview'
import { createPreview, type PreviewController } from '../lib/preview'
import { Timeline } from './Media'
import { formatTime } from '../lib/utils'

const PALETTE = ['#ff3b1f', '#0a7ea4', '#12141a', '#e6a817', '#2f9e44', '#7c3aed']

interface PreviewProps {
  segments: Segment[]
  videos: MediaAsset[]
  music: MediaAsset | null
  beats: number[]
  duration: number
  currentTime: number
  status: PreviewStatus
  onTime: (t: number) => void
  onStatus: (s: PreviewStatus) => void
  onSeek: (t: number) => void
  exporting: boolean
  exportProgress: number
  onExport: () => void
  controllerRef: MutableRefObject<PreviewController | null>
}

export function PreviewStage({
  segments,
  videos,
  music,
  beats,
  duration,
  currentTime,
  status,
  onTime,
  onStatus,
  onSeek,
  exporting,
  exportProgress,
  onExport,
  controllerRef,
}: PreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const assetColors = useMemo(() => {
    const map: Record<string, string> = {}
    videos.forEach((v, i) => {
      map[v.id] = PALETTE[i % PALETTE.length]
    })
    return map
  }, [videos])

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl) return

    controllerRef.current?.destroy()
    controllerRef.current = null

    if (!segments.length) {
      videoEl.removeAttribute('src')
      videoEl.load()
      return
    }

    const controller = createPreview({
      videoEl,
      segments,
      videos,
      music,
      onTime,
      onStatus,
    })
    controllerRef.current = controller

    return () => {
      controller.destroy()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [segments, videos, music, onTime, onStatus, controllerRef])

  const playing = status === 'playing'

  return (
    <section className="panel preview-panel">
      <header className="panel-head preview-head">
        <h2>Preview</h2>
        <p>
          {segments.length
            ? `${segments.length} segments · ${formatTime(duration)}`
            : 'Assemble a cut to preview the edit.'}
        </p>
      </header>

      <div className="stage">
        <video
          ref={videoRef}
          className="stage-video"
          muted
          playsInline
          aria-label="Video preview"
        />
        {!segments.length && (
          <div className="stage-empty">
            <span>Drop clips + a track, then hit Cut it up.</span>
          </div>
        )}
      </div>

      <Timeline
        duration={duration}
        currentTime={currentTime}
        beats={beats}
        segments={segments}
        assetColors={assetColors}
        onSeek={(t) => {
          controllerRef.current?.seek(t)
          onSeek(t)
        }}
      />

      <div className="preview-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!segments.length || exporting}
          onClick={() => {
            if (playing) controllerRef.current?.pause()
            else void controllerRef.current?.play()
          }}
        >
          {playing ? 'Pause' : status === 'ended' ? 'Replay' : 'Play'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!segments.length || exporting}
          onClick={() => {
            controllerRef.current?.seek(0)
            onSeek(0)
          }}
        >
          Restart
        </button>
        <button
          type="button"
          className="btn btn-accent"
          disabled={!segments.length || exporting}
          onClick={onExport}
        >
          {exporting
            ? `Exporting ${Math.round(exportProgress * 100)}%`
            : 'Export WebM'}
        </button>
      </div>
    </section>
  )
}
