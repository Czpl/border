import { ALIGNS, EFFECTS, FONT_FAMILIES, PRESETS, SEPARATORS } from '../lib/config'
import type { BorderEffect, BorderPreset } from '../lib/config'
import type {
  BorderOptions,
  InfoFontFamily,
  SecondBorder,
} from '../lib/border'

export type ControlTab = 'border' | 'layout' | 'second' | 'text' | 'effects'

export type UpdateOption = <K extends keyof BorderOptions>(
  key: K,
  value: BorderOptions[K],
) => void

export type UpdateSecond = <K extends keyof SecondBorder>(
  key: K,
  value: SecondBorder[K],
) => void

export type ApplyPreset = (preset: BorderPreset) => void

export type ApplyEffect = (effect: BorderEffect, enabled: boolean) => void

interface ControlsProps {
  options: BorderOptions
  update: UpdateOption
  updateSecond: UpdateSecond
  applyPreset: ApplyPreset
  applyEffect: ApplyEffect
  cameraSegments: string[] | null
  tab?: ControlTab
}

export function Controls({
  options,
  update,
  updateSecond,
  applyPreset,
  applyEffect,
  cameraSegments,
  tab,
}: ControlsProps) {
  const show = (name: ControlTab) => !tab || tab === name

  const radioName = (base: string) => `${base}-${tab ?? 'all'}`

  const activePresetId = PRESETS.find(
    (p) =>
      p.width === options.width &&
      p.color.toLowerCase() === options.color.toLowerCase() &&
      p.second.enabled === options.second.enabled &&
      p.second.width === options.second.width &&
      p.second.color.toLowerCase() === options.second.color.toLowerCase() &&
      (p.bottomWidth ?? p.width) === (options.bottomWidth ?? options.width),
  )?.id

  return (
    <>
      {show('border') && (
        <div className="controls-section">
          <h2 className="controls-heading">Border</h2>
          <fieldset className="control">
            <legend>Preset</legend>
            {PRESETS.map((p) => (
              <label className="radio" key={p.id}>
                <input
                  type="radio"
                  name={radioName('preset')}
                  checked={activePresetId === p.id}
                  onChange={() => applyPreset(p)}
                />
                {p.label}
              </label>
            ))}
          </fieldset>
          <label className="control">
            <span>Border width</span>
            <span className="row">
              <input
                type="range"
                min={1}
                max={30}
                value={options.width}
                onChange={(e) => update('width', Number(e.target.value))}
              />
              <output>{options.width}%</output>
            </span>
          </label>

          <label className="control">
            <span>Border color</span>
            <span className="row">
              <input
                type="color"
                value={options.color}
                onChange={(e) => update('color', e.target.value)}
              />
              <code>{options.color}</code>
            </span>
          </label>

          </div>
      )}

      {show('effects') && (
        <div className="controls-section">
          <h2 className="controls-heading">Effects</h2>
          <fieldset className="control">
            <legend>Effect</legend>
            {EFFECTS.map((e) => (
              <label className="checkbox" key={e.id}>
                <input
                  type="checkbox"
                  checked={options.effects.includes(e.id)}
                  onChange={(ev) => applyEffect(e, ev.target.checked)}
                />
                {e.label}
              </label>
            ))}
          </fieldset>
        </div>
      )}

      {show('layout') && (
        <div className="controls-section">
          <h2 className="controls-heading">Layout</h2>
          <fieldset className="control">
            <legend>Aspect ratio</legend>
            <label className="radio">
              <input
                type="radio"
                name={radioName('aspect')}
                checked={options.aspect === 'original'}
                onChange={() => update('aspect', 'original')}
              />
              Original
            </label>
            <label className="radio">
              <input
                type="radio"
                name={radioName('aspect')}
                checked={options.aspect === 'square'}
                onChange={() => update('aspect', 'square')}
              />
              Square (1:1)
            </label>
            <label className="radio">
              <input
                type="radio"
                name={radioName('aspect')}
                checked={options.aspect === 'instagram'}
                onChange={() => update('aspect', 'instagram')}
              />
              Instagram vertical (4:5)
            </label>
            <label className="radio">
              <input
                type="radio"
                name={radioName('aspect')}
                checked={options.aspect === 'story'}
                onChange={() => update('aspect', 'story')}
              />
              Instagram story (9:16)
            </label>
            <label className="radio">
              <input
                type="radio"
                name={radioName('aspect')}
                checked={options.aspect === 'polaroid'}
                onChange={() => update('aspect', 'polaroid')}
              />
              Polaroid (14:17)
            </label>
          </fieldset>

          <fieldset className="control">
            <legend>Placement</legend>
            <label className="radio">
              <input
                type="radio"
                name={radioName('placement')}
                checked={options.placement === 'outer'}
                onChange={() => update('placement', 'outer')}
              />
              Outer (expands canvas)
            </label>
            <label className="radio">
              <input
                type="radio"
                name={radioName('placement')}
                checked={options.placement === 'inner'}
                onChange={() => update('placement', 'inner')}
              />
              Inner (overlays image)
            </label>
          </fieldset>
        </div>
      )}

      {show('second') && (
        <div className="controls-section">
          <h2 className="controls-heading">Border (inner)</h2>
          <fieldset className="control">
            <legend>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={options.second.enabled}
                  onChange={(e) => updateSecond('enabled', e.target.checked)}
                />
                Second border (inside)
              </label>
            </legend>
            {options.second.enabled && (
              <>
                <label className="control">
                  <span>Second border width</span>
                  <span className="row">
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={options.second.width}
                      onChange={(e) =>
                        updateSecond('width', Number(e.target.value))
                      }
                    />
                    <output>{options.second.width}%</output>
                  </span>
                </label>
                <label className="control">
                  <span>Second border color</span>
                  <span className="row">
                    <input
                      type="color"
                      value={options.second.color}
                      onChange={(e) => updateSecond('color', e.target.value)}
                    />
                    <code>{options.second.color}</code>
                  </span>
                </label>
              </>
            )}
          </fieldset>
        </div>
      )}

      {show('text') && (
        <div className="controls-section">
          <h2 className="controls-heading">Camera info</h2>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={options.showInfo}
              onChange={(e) => update('showInfo', e.target.checked)}
            />
            Show camera info
          </label>
          {options.showInfo && !cameraSegments && (
            <p className="hint">No EXIF data found in this image</p>
          )}
          <label className="control">
            <span>Font size (of border)</span>
            <span className="row">
              <input
                type="range"
                min={20}
                max={100}
                value={options.infoFontSize}
                onChange={(e) => update('infoFontSize', Number(e.target.value))}
              />
              <output>{options.infoFontSize}%</output>
            </span>
          </label>

          <label className="control">
            <span>Font family</span>
            <select
              className="select"
              value={options.infoFontFamily}
              onChange={(e) =>
                update('infoFontFamily', e.target.value as InfoFontFamily)
              }
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="control">
            <span>Separator</span>
            <select
              className="select"
              value={options.infoSeparator}
              onChange={(e) => update('infoSeparator', e.target.value)}
            >
              {SEPARATORS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="control">
            <legend>Alignment</legend>
            {ALIGNS.map((a) => (
              <label className="radio" key={a.value}>
                <input
                  type="radio"
                  name="infoAlign"
                  checked={options.infoAlign === a.value}
                  onChange={() => update('infoAlign', a.value)}
                />
                {a.label}
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </>
  )
}
