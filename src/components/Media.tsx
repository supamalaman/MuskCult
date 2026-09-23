import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { MediaAsset } from '../lib/types'
import { formatTime } from '../lib/utils'

interface DropZoneProps {
  label: string
  hint: string
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  busy?: boolean
}

export function DropZone({
  label,
  hint,
  accept,
  multiple,
  onFiles,
  busy,
}: DropZoneProps) {
  const inputId = useId()
  const [over, setOver] = useState(false)

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return
      onFiles(Array.from(list))
    },
    [onFiles],
  )

  return (
    <label
      htmlFor={inputId}
      className={`dropzone ${over ? 'is-over' : ''} ${busy ? 'is-busy' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <span className="dropzone-label">{label}</span>
      <span className="dropzone-hint">{hint}</span>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        disabled={busy}
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </label>
  )
}

interface AssetListProps {
  assets: MediaAsset[]
  onRemove: (id: string) => void
  empty: string
}

export function AssetList({ assets, onRemove, empty }: AssetListProps) {
  if (!assets.length) {
    return <p className="asset-empty">{empty}</p>
  }

  return (
    <ul className="asset-list">
      {assets.map((a) => (
        <li key={a.id} className="asset-row">
          {a.kind === 'video' ? (
            <video src={a.url} muted playsInline preload="metadata" className="asset-thumb" />
          ) : (
            <div className="asset-thumb asset-thumb-audio" aria-hidden>
              <span>♪</span>
            </div>
          )}
          <div className="asset-meta">
            <span className="asset-name" title={a.name}>
              {a.name}
            </span>
            <span className="asset-dur">{formatTime(a.duration)}</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onRemove(a.id)}
            aria-label={`Remove ${a.name}`}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}

interface TimelineProps {
  duration: number
  currentTime: number
  beats: number[]
  segmentCount: number
  onSeek: (t: number) => void
}

export function Timeline({
  duration,
  currentTime,
  beats,
  segmentCount,
  onSeek,
}: TimelineProps) {
  const ref = useRef<HTMLDivElement>(null)

  const seekFromEvent = (clientX: number) => {
    const el = ref.current
    if (!el || duration <= 0) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onSeek(ratio * duration)
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let dragging = false

    const onDown = (e: PointerEvent) => {
      dragging = true
      el.setPointerCapture(e.pointerId)
      seekFromEvent(e.clientX)
    }
    const onMove = (e: PointerEvent) => {
      if (dragging) seekFromEvent(e.clientX)
    }
    const onUp = () => {
      dragging = false
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  })

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="timeline-wrap">
      <div className="timeline-meta">
        <span>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <span>
          {segmentCount} cuts · {beats.length} beats
        </span>
      </div>
      <div
        ref={ref}
        className="timeline"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 0.5))
          if (e.key === 'ArrowRight') onSeek(Math.min(duration, currentTime + 0.5))
        }}
      >
        <div className="timeline-beats" aria-hidden>
          {beats.map((b) => (
            <span
              key={b}
              className="timeline-beat"
              style={{ left: `${duration ? (b / duration) * 100 : 0}%` }}
            />
          ))}
        </div>
        <div className="timeline-progress" style={{ width: `${progress}%` }} />
        <div className="timeline-playhead" style={{ left: `${progress}%` }} />
      </div>
    </div>
  )
}
