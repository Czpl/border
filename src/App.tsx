import { useEffect, useRef, useState } from 'react'
import './App.css'
import { renderBorder, type BorderOptions, type SecondBorder } from './lib/border'

const DEFAULTS: BorderOptions = {
  width: 10,
  color: '#ffffff',
  radius: 0,
  placement: 'outer',
  aspect: 'original',
  second: { enabled: false, width: 1, color: '#000000' },
}

const RENDER_DEBOUNCE_MS = 150
const PREVIEW_MAX_DIMENSION = 1600
const EXPORT_MAX_DIMENSION = 8192

type ControlTab = 'border' | 'layout' | 'second'

const TABS: { id: ControlTab; label: string }[] = [
  { id: 'border', label: 'Border' },
  { id: 'layout', label: 'Layout' },
  { id: 'second', label: 'Second' },
]

interface ControlsProps {
  options: BorderOptions
  update: <K extends keyof BorderOptions>(key: K, value: BorderOptions[K]) => void
  updateSecond: <K extends keyof SecondBorder>(key: K, value: SecondBorder[K]) => void
  tab?: ControlTab
}

function Controls({ options, update, updateSecond, tab }: ControlsProps) {
  const show = (name: ControlTab) => !tab || tab === name
  return (
    <>
      {show('border') && (
        <>
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

          <label className="control">
            <span>Corner radius</span>
            <span className="row">
              <input
                type="range"
                min={0}
                max={300}
                value={options.radius}
                onChange={(e) => update('radius', Number(e.target.value))}
              />
              <output>{options.radius}px</output>
            </span>
          </label>
        </>
      )}

      {show('layout') && (
        <>
          <fieldset className="control">
            <legend>Aspect ratio</legend>
            <label className="radio">
              <input
                type="radio"
                name="aspect"
                checked={options.aspect === 'original'}
                onChange={() => update('aspect', 'original')}
              />
              Original
            </label>
            <label className="radio">
              <input
                type="radio"
                name="aspect"
                checked={options.aspect === 'square'}
                onChange={() => update('aspect', 'square')}
              />
              Square (1:1)
            </label>
            <label className="radio">
              <input
                type="radio"
                name="aspect"
                checked={options.aspect === 'instagram'}
                onChange={() => update('aspect', 'instagram')}
              />
              Instagram vertical (4:5)
            </label>
          </fieldset>

          <fieldset className="control">
            <legend>Placement</legend>
            <label className="radio">
              <input
                type="radio"
                name="placement"
                checked={options.placement === 'outer'}
                onChange={() => update('placement', 'outer')}
              />
              Outer (expands canvas)
            </label>
            <label className="radio">
              <input
                type="radio"
                name="placement"
                checked={options.placement === 'inner'}
                onChange={() => update('placement', 'inner')}
              />
              Inner (overlays image)
            </label>
          </fieldset>
        </>
      )}

      {show('second') && (
        <>
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
                      onChange={(e) => updateSecond('width', Number(e.target.value))}
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
        </>
      )}
    </>
  )
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function App() {
  const [source, setSource] = useState<string | null>(null)
  const [options, setOptions] = useState<BorderOptions>(DEFAULTS)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [tab, setTab] = useState<ControlTab>('border')
  const [drawerOpen, setDrawerOpen] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sourceRef = useRef<string | null>(null)
  const renderOptions = useDebouncedValue(options, RENDER_DEBOUNCE_MS)

  useEffect(() => {
    return () => {
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current)
    }
  }, [])

  useEffect(() => {
    if (!source) {
      setImage(null)
      setSize(null)
      return
    }
    const img = new Image()
    img.onload = () => setImage(img)
    img.onerror = () => {
      setError('Could not load that image. Please try another file.')
    }
    img.src = source
  }, [source])

  useEffect(() => {
    if (!image) return
    try {
      const { canvas, width, height } = renderBorder(image, renderOptions, {
        maxDimension: PREVIEW_MAX_DIMENSION,
      })
      const target = canvasRef.current
      if (!target) return
      target.width = canvas.width
      target.height = canvas.height
      const ctx = target.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, target.width, target.height)
      ctx.drawImage(canvas, 0, 0)
      setSize({ width, height })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render the border')
    }
  }, [image, renderOptions])

  const handleFile = (file: File | undefined | null) => {
    if (!file || !file.type.startsWith('image/')) return
    setError(null)
    const url = URL.createObjectURL(file)
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current)
    sourceRef.current = url
    setSource(url)
  }

  const handleDownload = () => {
    if (!image) return
    try {
      const { canvas } = renderBorder(image, options, {
        maxDimension: EXPORT_MAX_DIMENSION,
        dpr: 1,
      })
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'bordered.png'
        link.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export the image')
    }
  }

  const update = <K extends keyof BorderOptions>(key: K, value: BorderOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }))
  }

  const updateSecond = <K extends keyof SecondBorder>(key: K, value: SecondBorder[K]) => {
    setOptions((prev) => ({ ...prev, second: { ...prev.second, [key]: value } }))
  }

  return (
    <main className="app">
      <header>
        <h1>Border</h1>
        <p>Add a border to an image — everything runs locally in your browser.</p>
      </header>

      <section
        className={`dropzone ${dragOver ? 'dropzone--over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFile(e.dataTransfer.files[0])
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <p>{source ? 'Replace image' : 'Drop an image here, or click to browse'}</p>
      </section>

      {error && <p className="error">{error}</p>}

      {source && (
        <div className="workspace">
          <aside className="controls">
            <Controls
              options={options}
              update={update}
              updateSecond={updateSecond}
            />
            <button type="button" className="download" onClick={handleDownload}>
              Download PNG
            </button>
            {size && (
              <p className="size">
                Output: {size.width} × {size.height}px
              </p>
            )}
          </aside>

          <figure className="preview">
            <canvas ref={canvasRef} />
          </figure>

          <div className="mobile-drawer">
            <nav className="tabs">
              <button
                type="button"
                className="tabs__toggle"
                aria-label={drawerOpen ? 'Collapse controls' : 'Expand controls'}
                onClick={() => setDrawerOpen((open) => !open)}
              >
                <svg
                  className={`tabs__chevron ${drawerOpen ? 'tabs__chevron--up' : ''}`}
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                >
                  <path d="M8 11 3 6h10z" />
                </svg>
              </button>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`tab ${tab === t.id ? 'tab--active' : ''}`}
                  onClick={() => {
                    setTab(t.id)
                    setDrawerOpen(true)
                  }}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            {drawerOpen && (
              <div className="drawer-body">
                <Controls
                  options={options}
                  update={update}
                  updateSecond={updateSecond}
                  tab={tab}
                />
                <button type="button" className="download" onClick={handleDownload}>
                  Download PNG
                </button>
                {size && (
                  <p className="size">
                    Output: {size.width} × {size.height}px
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default App
