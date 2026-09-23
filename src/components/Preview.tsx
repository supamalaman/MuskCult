import { useEffect, useRef, type MutableRefObject } from 'react'
import type { MediaAsset, Segment } from '../lib/types'
import type { PreviewStatus } from '../lib/preview'
import { createPreview, type PreviewController } from '../lib/preview'
import { Timeline } from './Media'
import { formatTime } from '../lib/utils'

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
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    controllerRef.current?.destroy()
    controllerRef.current = null

    if (!segments.length) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#1a1c22'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    const controller = createPreview({
      canvas,
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
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="stage-canvas"
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
        segmentCount={segments.length}
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
