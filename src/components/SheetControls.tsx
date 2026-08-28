import { useId, useRef } from 'react'
import {
  SHEET_DEFAULTS,
  SHEET_FORMATS,
  SHEET_GRIDS,
  SHEET_LABEL_MODES,
  SHEET_ORIENTATIONS,
  type SheetOptions,
} from '../lib/contactSheet'

export type UpdateSheetOption = <K extends keyof SheetOptions>(
  key: K,
  value: SheetOptions[K],
) => void

interface SheetControlsProps {
  options: SheetOptions
  update: UpdateSheetOption
  busy: boolean
  imageCount: number
  result: { pages: number; perPage: number } | null
  onDownload: () => void
  onAddFiles: (files: File[]) => void
}

export function SheetControls({
  options,
  update,
  busy,
  imageCount,
  result,
  onDownload,
  onAddFiles,
}: SheetControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Namespaces the radio groups so two mounted instances (desktop sidebar +
  // mobile drawer) don't share radio `name` groups in the DOM.
  const scope = useId()

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    onAddFiles(Array.from(list))
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <div className="controls-section">
        <h2 className="controls-heading">Page</h2>
        <label className="control">
          <span>Format</span>
          <select
            className="select"
            value={options.format}
            onChange={(e) => update('format', e.target.value as SheetOptions['format'])}
          >
            {SHEET_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="control">
          <legend>Orientation</legend>
          {SHEET_ORIENTATIONS.map((o) => (
            <label className="radio" key={o.id}>
              <input
                type="radio"
                name={`sheet-orientation-${scope}`}
                value={o.id}
                checked={options.orientation === o.id}
                onChange={() => update('orientation', o.id)}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="controls-section">
        <h2 className="controls-heading">Grid</h2>
        <fieldset className="control">
          <legend>Images per page</legend>
          {SHEET_GRIDS.map((g) => (
            <label className="radio" key={g.id}>
              <input
                type="radio"
                name={`sheet-grid-${scope}`}
                value={g.id}
                checked={options.grid === g.id}
                onChange={() => update('grid', g.id)}
              />
              {g.label}
            </label>
          ))}
        </fieldset>
        <label className="control">
          <span>Background</span>
          <span className="row">
            <input
              type="color"
              value={options.backgroundColor}
              onChange={(e) => update('backgroundColor', e.target.value)}
            />
            <code>{options.backgroundColor}</code>
          </span>
        </label>
        <label className="control">
          <span>Margin</span>
          <span className="row">
            <input
              type="range"
              min={16}
              max={72}
              value={options.margin}
              onChange={(e) => update('margin', Number(e.target.value))}
            />
            <output>{options.margin}pt</output>
          </span>
        </label>
        <label className="control">
          <span>Spacing</span>
          <span className="row">
            <input
              type="range"
              min={0}
              max={40}
              value={options.spacing}
              onChange={(e) => update('spacing', Number(e.target.value))}
            />
            <output>{options.spacing}pt</output>
          </span>
        </label>
      </div>

      <div className="controls-section">
        <h2 className="controls-heading">Labels</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={options.showLabels}
            onChange={(e) => update('showLabels', e.target.checked)}
          />
          Print labels under each image
        </label>
        {options.showLabels && (
          <>
            <fieldset className="control">
              <legend>Label content</legend>
              {SHEET_LABEL_MODES.map((m) => (
                <label className="radio" key={m.id}>
                  <input
                    type="radio"
                    name={`sheet-label-${scope}`}
                    value={m.id}
                    checked={options.labelMode === m.id}
                    onChange={() => update('labelMode', m.id)}
                  />
                  {m.label}
                </label>
              ))}
            </fieldset>
            <label className="control">
              <span>Label size</span>
              <span className="row">
                <input
                  type="range"
                  min={6}
                  max={16}
                  value={options.labelSize}
                  onChange={(e) => update('labelSize', Number(e.target.value))}
                />
                <output>{options.labelSize}pt</output>
              </span>
            </label>
          </>
        )}
      </div>

      <p className="size">
        {imageCount} image{imageCount === 1 ? '' : 's'}
        {result ? ` · ${result.pages} page${result.pages === 1 ? '' : 's'} · ${result.perPage} per page` : ''}
      </p>

      <button
        type="button"
        className="download"
        disabled={busy || imageCount === 0}
        onClick={onDownload}
      >
        {busy ? 'Building PDF\u2026' : 'Download PDF'}
      </button>
      <button
        type="button"
        className="replace"
        onClick={() => inputRef.current?.click()}
      >
        Add more images
      </button>
      <p className="hint">
        Defaults you can tweak: {SHEET_DEFAULTS.format.toUpperCase()} · {SHEET_DEFAULTS.grid} per page ·{' '}
        {SHEET_DEFAULTS.showLabels ? 'with labels' : 'no labels'}
      </p>
    </>
  )
}