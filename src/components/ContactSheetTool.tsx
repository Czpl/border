import { useEffect, useRef, useState } from 'react'
import {
  buildContactSheetPDF,
  renderSheetPreview,
  SHEET_DEFAULTS,
  type SheetImage,
  type SheetOptions,
} from '../lib/contactSheet'
import { RENDER_DEBOUNCE_MS } from '../lib/config'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { Dropzone } from './Dropzone'
import { Filmstrip } from './Filmstrip'
import { SheetControls } from './SheetControls'
import { SheetMobileDrawer } from './SheetMobileDrawer'

// Downscaled data-URL preview so filmstrip thumbnails have a stable `src`
// without keeping blob URLs alive.
function makeThumb(image: HTMLImageElement): string | undefined {
  try {
    const max = 96
    const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight))
    const w = Math.max(1, Math.round(image.naturalWidth * scale))
    const h = Math.max(1, Math.round(image.naturalHeight * scale))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(image, 0, 0, w, h)
    return c.toDataURL('image/jpeg', 0.7)
  } catch {
    return undefined
  }
}

export function ContactSheetTool({ hidden = false }: { hidden?: boolean }) {
  const [images, setImages] = useState<SheetImage[]>([])
  const [options, setOptions] = useState<SheetOptions>(SHEET_DEFAULTS)
  const [info, setInfo] = useState<{ pages: number; perPage: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderOptions = useDebouncedValue(options, RENDER_DEBOUNCE_MS)

  // Decode incoming files into <img> elements (applies EXIF orientation) plus a
  // small thumbnail. Blob URLs are revoked once decoding finishes; decoded
  // images keep their pixels in memory, and thumbnails are self-contained data
  // URLs, so nothing references the revoked URLs later.
  const decodeImages = async (files: File[]): Promise<SheetImage[]> => {
    const urls = files.map((file) => URL.createObjectURL(file))
    try {
      const imgs = await Promise.all(
        urls.map(
          (url) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image()
              img.onload = () => resolve(img)
              img.onerror = reject
              img.src = url
            }),
        ),
      )
      return imgs.map((img, i) => ({
        image: img,
        name: files[i].name,
        thumb: makeThumb(img),
      }))
    } finally {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }

  useEffect(() => {
    if (images.length === 0) return
    try {
      const preview = renderSheetPreview(images, renderOptions)
      const target = canvasRef.current
      if (!target) return
      target.width = preview.canvas.width
      target.height = preview.canvas.height
      const ctx = target.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, target.width, target.height)
      ctx.drawImage(preview.canvas, 0, 0)
      setInfo({ pages: preview.pages, perPage: preview.perPage })
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to render the contact sheet',
      )
    }
  }, [images, renderOptions])

  const handleAddFiles = async (incoming: File[]) => {
    const imagesToAdd = incoming.filter((f) => f.type.startsWith('image/'))
    if (imagesToAdd.length === 0) return
    setError(null)
    try {
      const decoded = await decodeImages(imagesToAdd)
      setImages((prev) => [...prev, ...decoded])
    } catch {
      setError('Could not load one of those images. Try again.')
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const reorderImages = (from: number, to: number) => {
    if (from === to) return
    setImages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const handleDownload = async () => {
    if (images.length === 0 || busy) return
    setBusy(true)
    try {
      const bytes = await buildContactSheetPDF(images, options)
      const url = URL.createObjectURL(
        new Blob([bytes as BlobPart], { type: 'application/pdf' }),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = 'contact-sheet.pdf'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build the PDF')
    } finally {
      setBusy(false)
    }
  }

  const update = <K extends keyof SheetOptions>(key: K, value: SheetOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="tool" hidden={hidden}>
      <Dropzone
        dragOver={dragOver}
        onDragOver={setDragOver}
        onFiles={handleAddFiles}
        className={images.length > 0 ? 'dropzone--has-image' : ''}
        emptyText="Drop 12+ images here, or click to browse"
        contentText="Add more images"
      />

      {images.length > 0 && (
        <Filmstrip images={images} onRemove={removeImage} onReorder={reorderImages} />
      )}

      {error && <p className="error">{error}</p>}

      {images.length > 0 && (
        <div className="workspace">
          <aside className="controls">
            <SheetControls
              options={options}
              update={update}
              busy={busy}
              imageCount={images.length}
              result={info}
              onDownload={handleDownload}
              onAddFiles={handleAddFiles}
            />
          </aside>

          <figure className="preview">
            <canvas ref={canvasRef} />
          </figure>

          <SheetMobileDrawer
            open={drawerOpen}
            onToggleOpen={() => setDrawerOpen((open) => !open)}
            options={options}
            update={update}
            busy={busy}
            imageCount={images.length}
            result={info}
            onDownload={handleDownload}
            onAddFiles={handleAddFiles}
          />
        </div>
      )}
    </div>
  )
}