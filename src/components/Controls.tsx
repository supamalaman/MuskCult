import type { AssembleMode, CutSettings } from '../lib/types'

interface ControlsProps {
  settings: CutSettings
  onChange: (next: CutSettings) => void
  onReshuffle: () => void
  onAssemble: () => void
  canAssemble: boolean
  assembling: boolean
  hasBeats: boolean
}

const MODES: { id: AssembleMode; title: string; blurb: string }[] = [
  {
    id: 'coherent',
    title: 'Coherent',
    blurb: 'Cycle clips in order, cut on the pulse.',
  },
  {
    id: 'random',
    title: 'Random',
    blurb: 'Chaos cuts — shuffle sources and in-points.',
  },
  {
    id: 'hybrid',
    title: 'Hybrid',
    blurb: 'Ordered clips, wild in-points.',
  },
]

export function Controls({
  settings,
  onChange,
  onReshuffle,
  onAssemble,
  canAssemble,
  assembling,
  hasBeats,
}: ControlsProps) {
  const patch = (partial: Partial<CutSettings>) =>
    onChange({ ...settings, ...partial })

  return (
    <section className="panel controls">
      <header className="panel-head">
        <h2>Cut &amp; assemble</h2>
        <p>Chop your footage to the track, then stitch it back together.</p>
      </header>

      <div className="mode-grid" role="radiogroup" aria-label="Assemble mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={settings.mode === m.id}
            className={`mode-card ${settings.mode === m.id ? 'is-active' : ''}`}
            onClick={() => patch({ mode: m.id })}
          >
            <span className="mode-title">{m.title}</span>
            <span className="mode-blurb">{m.blurb}</span>
          </button>
        ))}
      </div>

      <div className="control-grid">
        <label className="field">
          <span className="field-label">
            Beat sync
            {!hasBeats && settings.beatSync ? (
              <em className="field-note"> add music to detect beats</em>
            ) : null}
          </span>
          <button
            type="button"
            className={`toggle ${settings.beatSync ? 'is-on' : ''}`}
            aria-pressed={settings.beatSync}
            onClick={() => patch({ beatSync: !settings.beatSync })}
          >
            <span className="toggle-knob" />
            <span className="toggle-text">{settings.beatSync ? 'On' : 'Off'}</span>
          </button>
        </label>

        <label className="field">
          <span className="field-label">
            Beat density <strong>{settings.beatDensity.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={0.35}
            max={1.2}
            step={0.05}
            value={settings.beatDensity}
            disabled={!settings.beatSync}
            onChange={(e) => patch({ beatDensity: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span className="field-label">
            Cut length <strong>{settings.cutLength.toFixed(2)}s</strong>
          </span>
          <input
            type="range"
            min={0.15}
            max={2}
            step={0.05}
            value={settings.cutLength}
            disabled={settings.beatSync}
            onChange={(e) => patch({ cutLength: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span className="field-label">Preserve clip order</span>
          <button
            type="button"
            className={`toggle ${settings.preserveOrder ? 'is-on' : ''}`}
            aria-pressed={settings.preserveOrder}
            disabled={settings.mode === 'random'}
            onClick={() => patch({ preserveOrder: !settings.preserveOrder })}
          >
            <span className="toggle-knob" />
            <span className="toggle-text">{settings.preserveOrder ? 'On' : 'Off'}</span>
          </button>
        </label>
      </div>

      <div className="control-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canAssemble || assembling}
          onClick={onAssemble}
        >
          {assembling ? 'Cutting…' : 'Cut it up'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canAssemble}
          onClick={onReshuffle}
        >
          New seed
        </button>
        <span className="seed-label">seed {settings.seed}</span>
      </div>
    </section>
  )
}
