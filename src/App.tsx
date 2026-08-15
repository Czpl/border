import { useEffect, useRef, useState } from 'react'
import exifr from 'exifr'
import './App.css'
import logo from './assets/logo.svg'
import portraFrameUrl from './assets/portraframe.png'
import { renderBorder, type BorderOptions, type SecondBorder } from './lib/border'
import {
  DEFAULTS,
  EXPORT_MAX_DIMENSION,
  PREVIEW_MAX_DIMENSION,
  RENDER_DEBOUNCE_MS,
} from './lib/config'
import { buildCameraSegments, type CameraMetadata } from './lib/exif'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { Controls, type ControlTab } from './components/Controls'
import { Dropzone } from './components/Dropzone'
import { MobileDrawer } from './components/MobileDrawer'
import type { BorderEffect, BorderPreset } from './lib/config'

function App() {
  const [source, setSource] = useState<string | null>(null)
  const [options, setOptions] = useState<BorderOptions>(DEFAULTS)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [tab, setTab] = useState<ControlTab>('border')
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [cameraSegments, setCameraSegments] = useState<string[] | null>(null)
  const [portraFrame, setPortraFrame] = useState<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sourceRef = useRef<string | null>(null)
  const renderOptions = useDebouncedValue(options, RENDER_DEBOUNCE_MS)

  useEffect(() => {
    return () => {
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current)
    }
  }, [])

  useEffect(() => {
    const img = new Image()
    img.onload = () => setPortraFrame(img)
    img.src = portraFrameUrl
    return () => {
      img.onload = null
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
      const segments = renderOptions.showInfo ? cameraSegments : null
      const { canvas, width, height } = renderBorder(
        image,
        renderOptions,
        { maxDimension: PREVIEW_MAX_DIMENSION },
        segments,
        { portraFrame },
      )
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
  }, [image, renderOptions, cameraSegments, portraFrame])

  const handleFile = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    setError(null)
    const url = URL.createObjectURL(file)
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current)
    sourceRef.current = url
    setSource(url)
    setCameraSegments(null)
    exifr
      .parse(file, { pick: ['Make', 'Model', 'ExposureTime', 'FNumber', 'ISO'] })
      .then((meta) =>
        setCameraSegments(buildCameraSegments((meta ?? {}) as CameraMetadata)),
      )
      .catch(() => setCameraSegments(null))
  }

  const handleDownload = () => {
    if (!image) return
    try {
      const segments = options.showInfo ? cameraSegments : null
      const { canvas } = renderBorder(
        image,
        options,
        { maxDimension: EXPORT_MAX_DIMENSION, dpr: 1 },
        segments,
        { portraFrame },
      )
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

  const applyPreset = (preset: BorderPreset) => {
    setOptions((prev) => ({
      ...prev,
      effects: [...preset.effects],
      width: preset.width,
      color: preset.color,
      second: { ...preset.second },
      bottomWidth: preset.bottomWidth ?? preset.width,
      aspect: preset.aspect ?? prev.aspect,
      placement: preset.placement ?? prev.placement,
    }))
  }

  const toggleEffect = (effect: BorderEffect, enabled: boolean) => {
    setOptions((prev) => ({
      ...prev,
      effects: enabled
        ? prev.effects.includes(effect.id)
          ? prev.effects
          : [...prev.effects, effect.id]
        : prev.effects.filter((id) => id !== effect.id),
    }))
  }

  return (
    <main className="app">
      <header>
        <h1>
          <img src={logo} alt="Border logo" className="logo" />
          Border
        </h1>
        <p>Add a border to an image  (everything runs locally in your browser)</p>
      </header>

      <Dropzone
        source={source}
        dragOver={dragOver}
        onDragOver={setDragOver}
        onFile={handleFile}
        className={source ? 'dropzone--has-image' : ''}
      />

      {error && <p className="error">{error}</p>}

      {source && (
        <div className="workspace">
          <aside className="controls">
            <Controls
              options={options}
              update={update}
              updateSecond={updateSecond}
              applyPreset={applyPreset}
              applyEffect={toggleEffect}
              cameraSegments={cameraSegments}
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

          <MobileDrawer
            tab={tab}
            onTabChange={(t) => {
              setTab(t)
              setDrawerOpen(true)
            }}
            open={drawerOpen}
            onToggleOpen={() => setDrawerOpen((open) => !open)}
            options={options}
            update={update}
            updateSecond={updateSecond}
            applyPreset={applyPreset}
            applyEffect={toggleEffect}
            cameraSegments={cameraSegments}
            onDownload={handleDownload}
            onFile={handleFile}
            size={size}
          />
        </div>
      )}
    </main>
  )
}

export default App
