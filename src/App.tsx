import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AssetList, DropZone } from './components/Media'
import { Controls } from './components/Controls'
import { PreviewStage } from './components/Preview'
import { assembleComposition, compositionDuration } from './lib/assemble'
import { detectBeats } from './lib/beats'
import { loadMediaFiles, revokeAsset } from './lib/media'
import { exportComposition, type PreviewController } from './lib/preview'
import {
  DEFAULT_SETTINGS,
  type CutSettings,
  type MediaAsset,
  type Segment,
} from './lib/types'
import type { PreviewStatus } from './lib/preview'
import './App.css'

export default function App() {
  const [videos, setVideos] = useState<MediaAsset[]>([])
  const [music, setMusic] = useState<MediaAsset | null>(null)
  const [settings, setSettings] = useState<CutSettings>(DEFAULT_SETTINGS)
  const [beats, setBeats] = useState<number[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [busy, setBusy] = useState(false)
  const [assembling, setAssembling] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle')
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const controllerRef = useRef<PreviewController | null>(null)
  const musicBufferRef = useRef<ArrayBuffer | null>(null)

  const duration = Math.max(
    compositionDuration(segments),
    music?.duration ?? 0,
  )

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      videos.forEach(revokeAsset)
      if (music) revokeAsset(music)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flash = (msg: string) => {
    setStatusMsg(msg)
    window.setTimeout(() => setStatusMsg(null), 4000)
  }

  const onAddVideos = useCallback(async (files: File[]) => {
    setBusy(true)
    try {
      const { videos: next, errors } = await loadMediaFiles(files)
      if (next.length) {
        setVideos((prev) => [...prev, ...next])
        flash(`Added ${next.length} clip${next.length === 1 ? '' : 's'}`)
      }
      if (errors.length) flash(errors[0])
    } finally {
      setBusy(false)
    }
  }, [])

  const onAddMusic = useCallback(async (files: File[]) => {
    if (!files[0]) return
    setBusy(true)
    try {
      const { audios, videos: maybeVids, errors } = await loadMediaFiles(files)
      const source = audios[0] ?? maybeVids[0]
      if (!source) {
        if (errors.length) flash(errors[0])
        return
      }

      const track: MediaAsset = {
        ...source,
        kind: 'audio',
        id: source.id.startsWith('aud') ? source.id : source.id.replace(/^vid/, 'aud'),
      }

      setMusic((prev) => {
        if (prev) revokeAsset(prev)
        return track
      })
      musicBufferRef.current = await files[0].arrayBuffer()
      const detected = await detectBeats(musicBufferRef.current, settings.beatDensity)
      setBeats(detected)
      flash(`Music set · ${detected.length} beats found`)
    } finally {
      setBusy(false)
    }
  }, [settings.beatDensity])

  // Re-detect beats when density changes
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!musicBufferRef.current || !music) return
      const detected = await detectBeats(musicBufferRef.current, settings.beatDensity)
      if (!cancelled) setBeats(detected)
    })()
    return () => {
      cancelled = true
    }
  }, [settings.beatDensity, music])

  const runAssemble = useCallback(
    (nextSettings: CutSettings = settings) => {
      if (!videos.length) {
        flash('Add at least one video clip')
        return
      }
      const musicDur = music?.duration ?? Math.max(...videos.map((v) => v.duration), 8)
      setAssembling(true)
      startTransition(() => {
        const segs = assembleComposition(videos, musicDur, beats, nextSettings)
        setSegments(segs)
        setCurrentTime(0)
        setPreviewStatus('idle')
        setAssembling(false)
        flash(`Assembled ${segs.length} cuts · ${nextSettings.mode}`)
      })
    },
    [videos, music, beats, settings],
  )

  const onReshuffle = () => {
    const next = { ...settings, seed: (settings.seed + 1 + Math.floor(Math.random() * 997)) % 100000 }
    setSettings(next)
    runAssemble(next)
  }

  const onRemoveVideo = (id: string) => {
    setVideos((prev) => {
      const target = prev.find((v) => v.id === id)
      if (target) revokeAsset(target)
      return prev.filter((v) => v.id !== id)
    })
    setSegments([])
  }

  const onExport = async () => {
    if (!segments.length) return
    controllerRef.current?.pause()
    setExporting(true)
    setExportProgress(0)
    try {
      const blob = await exportComposition({
        segments,
        videos,
        music,
        onProgress: setExportProgress,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `muskcult-${settings.mode}-${settings.seed}.webm`
      a.click()
      URL.revokeObjectURL(url)
      flash('Export ready — download started')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }

  const onTime = useCallback((t: number) => setCurrentTime(t), [])
  const onStatus = useCallback((s: PreviewStatus) => setPreviewStatus(s), [])

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden />

      <header className="hero">
        <p className="brand">MuskCult</p>
        <h1 className="hero-line">Cut it. Flip it. Loop it.</h1>
        <p className="hero-sub">
          Drop footage and a track. We slice on the beat — or scatter it into noise —
          and stitch a music video you can preview and export.
        </p>
      </header>

      <main className="workspace">
        <aside className="rail">
          <section className="panel">
            <header className="panel-head">
              <h2>Clips</h2>
              <p>Any short takes. More clips = denser edits.</p>
            </header>
            <DropZone
              label="Drop video clips"
              hint="mp4, webm, mov — multiple ok"
              accept="video/*,.mp4,.webm,.mov,.m4v"
              multiple
              busy={busy}
              onFiles={onAddVideos}
            />
            <AssetList
              assets={videos}
              onRemove={onRemoveVideo}
              empty="No clips yet."
            />
          </section>

          <section className="panel">
            <header className="panel-head">
              <h2>Music</h2>
              <p>One track drives cut timing.</p>
            </header>
            <DropZone
              label="Drop a track"
              hint="mp3, wav, m4a, or video-with-audio"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.ogg,.flac"
              busy={busy}
              onFiles={onAddMusic}
            />
            {music ? (
              <AssetList
                assets={[music]}
                onRemove={() => {
                  revokeAsset(music)
                  setMusic(null)
                  setBeats([])
                  musicBufferRef.current = null
                }}
                empty=""
              />
            ) : (
              <p className="asset-empty">No music yet — fixed cut length still works.</p>
            )}
          </section>

          <Controls
            settings={settings}
            onChange={setSettings}
            onReshuffle={onReshuffle}
            onAssemble={() => runAssemble()}
            canAssemble={videos.length > 0}
            assembling={assembling}
            hasBeats={beats.length > 1}
          />
        </aside>

        <PreviewStage
          segments={segments}
          videos={videos}
          music={music}
          beats={beats}
          duration={duration}
          currentTime={currentTime}
          status={previewStatus}
          onTime={onTime}
          onStatus={onStatus}
          onSeek={setCurrentTime}
          exporting={exporting}
          exportProgress={exportProgress}
          onExport={onExport}
          controllerRef={controllerRef}
        />
      </main>

      {statusMsg && (
        <div className="toast" role="status">
          {statusMsg}
        </div>
      )}

      <footer className="foot">
        <span>MuskCult video maker</span>
        <span>All processing stays in your browser.</span>
      </footer>
    </div>
  )
}
