// Contact sheet renderer: lays a grid of photos onto printer pages and exports
// them as a single PDF (via pdf-lib). The same layout code drives both the
// on-screen preview and the generated document.
//
// Coordinate conventions:
//   - all layout math is done in top-left-origin "point" (pt) coordinates,
//     matching the preview canvas;
//   - pdf-lib uses bottom-left origins, so PDF drawing flips the Y axis via
//     `pdfY = pageH - (cellTop - ...)`.

// pdf-lib is imported lazily inside buildContactSheetPDF so the border feature
// never loads it unless a PDF is actually generated.

import type { PDFDocument, PDFImage, RGB } from 'pdf-lib'

export type SheetFormat = 'a5' | 'a4' | 'a3' | 'letter' | 'tabloid'

export type SheetOrientation = 'portrait' | 'landscape'

export type SheetGridPreset = '12' | '15' | '20' | '24' | '30' | 'auto'

export type SheetLabelMode = 'index' | 'filename' | 'both'

export interface SheetOptions {
  format: SheetFormat
  orientation: SheetOrientation
  grid: SheetGridPreset
  backgroundColor: string
  margin: number
  spacing: number
  showLabels: boolean
  labelMode: SheetLabelMode
  labelSize: number
}

export interface SheetImage {
  image: HTMLImageElement
  name: string
  // Small data-URL preview used for the on-screen filmstrip thumbnails.
  thumb?: string
}

// Portrait page sizes in points. Landscape swaps the pair.
const PAGE_SIZES: Record<SheetFormat, [number, number]> = {
  a5: [419, 595],
  a4: [595, 842],
  a3: [842, 1190],
  letter: [612, 792],
  tabloid: [792, 1224],
}

// Grid presets expressed as (columns rows) for portrait pages. Landscape pages
// swap the two so the long side of the page has more cells.
const GRID_PRESETS: Record<Exclude<SheetGridPreset, 'auto'>, { cols: number; rows: number }> = {
  '12': { cols: 3, rows: 4 },
  '15': { cols: 3, rows: 5 },
  '20': { cols: 4, rows: 5 },
  '24': { cols: 4, rows: 6 },
  '30': { cols: 5, rows: 6 },
}

// "Auto" packs as many cells as possible while keeping each cell at least this
// wide/tall (pt), so printed thumbnails stay legible.
const AUTO_MIN_CELL = 140

export const SHEET_FORMATS: { id: SheetFormat; label: string }[] = [
  { id: 'a4', label: 'A4' },
  { id: 'a3', label: 'A3' },
  { id: 'a5', label: 'A5' },
  { id: 'letter', label: 'Letter' },
  { id: 'tabloid', label: 'Tabloid (11×17)' },
]

export const SHEET_ORIENTATIONS: { id: SheetOrientation; label: string }[] = [
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' },
]

export const SHEET_GRIDS: { id: SheetGridPreset; label: string }[] = [
  { id: '12', label: '12 per page' },
  { id: '15', label: '15 per page' },
  { id: '20', label: '20 per page' },
  { id: '24', label: '24 per page' },
  { id: '30', label: '30 per page' },
  { id: 'auto', label: 'Auto-fit' },
]

export const SHEET_LABEL_MODES: { id: SheetLabelMode; label: string }[] = [
  { id: 'index', label: 'Index number' },
  { id: 'filename', label: 'Filename' },
  { id: 'both', label: 'Both' },
]

export const SHEET_DEFAULTS: SheetOptions = {
  format: 'a4',
  orientation: 'portrait',
  grid: '12',
  backgroundColor: '#ffffff',
  margin: 40,
  spacing: 14,
  showLabels: true,
  labelMode: 'filename',
  labelSize: 9,
}

// --- Geometry helpers ---------------------------------------------------------

interface CellRect {
  x: number
  y: number
  w: number
  h: number
}

interface GridDims {
  cols: number
  rows: number
}

function pageSize(opts: SheetOptions): [number, number] {
  const [w, h] = PAGE_SIZES[opts.format]
  return opts.orientation === 'landscape' ? [h, w] : [w, h]
}

function autoGridDims(usableW: number, usableH: number, spacing: number): GridDims {
  const min = AUTO_MIN_CELL
  const cols = Math.max(1, Math.floor((usableW + spacing) / (min + spacing)))
  const rows = Math.max(1, Math.floor((usableH + spacing) / (min + spacing)))
  return { cols, rows }
}

export function gridDims(opts: SheetOptions): GridDims {
  if (opts.grid === 'auto') {
    const [pageW, pageH] = pageSize(opts)
    return autoGridDims(pageW - 2 * opts.margin, pageH - 2 * opts.margin, opts.spacing)
  }
  const g = GRID_PRESETS[opts.grid]
  return opts.orientation === 'landscape' ? { cols: g.rows, rows: g.cols } : g
}

// Rectangles for the first `count` cells of a page, top-left origin.
export function computeCells(opts: SheetOptions, count: number): CellRect[] {
  const [pageW, pageH] = pageSize(opts)
  const { cols, rows } = gridDims(opts)
  const usableW = pageW - 2 * opts.margin
  const usableH = pageH - 2 * opts.margin
  const cellW = (usableW - (cols - 1) * opts.spacing) / cols
  const cellH = (usableH - (rows - 1) * opts.spacing) / rows

  const cells: CellRect[] = []
  for (let r = 0; r < rows && cells.length < count; r++) {
    for (let c = 0; c < cols && cells.length < count; c++) {
      cells.push({
        x: opts.margin + c * (cellW + opts.spacing),
        y: opts.margin + r * (cellH + opts.spacing),
        w: cellW,
        h: cellH,
      })
    }
  }
  return cells
}

// Fits the tallest/leftover photo inside a cell, reserving `labelH` at the
// bottom for a caption. Returns the fitted rectangle (top-left origin).
interface ImageFit {
  x: number
  y: number
  w: number
  h: number
}

function fitInCell(cell: CellRect, imgW: number, imgH: number, labelH: number): ImageFit {
  const areaH = cell.h - labelH
  const scale = Math.min(cell.w / imgW, areaH / imgH)
  const w = imgW * scale
  const h = imgH * scale
  return { x: cell.x + (cell.w - w) / 2, y: cell.y + (areaH - h) / 2, w, h }
}

function hexToRgb(hex: string, toRgb: (r: number, g: number, b: number) => RGB): RGB {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return toRgb(r, g, b)
}

function captionText(opts: SheetOptions, name: string, index: number): string | null {
  if (!opts.showLabels) return null
  if (opts.labelMode === 'index') return String(index + 1)
  if (opts.labelMode === 'filename') return name
  return `${index + 1} · ${name}`
}

// Truncates `text` with an ellipsis until `measure(text)` fits `maxW`.
function truncateToWidth(measure: (t: string) => number, text: string, maxW: number) {
  if (measure(text) <= maxW) return text
  let out = text
  while (out.length > 1 && measure(out + '\u2026') > maxW) {
    out = out.slice(0, -1)
  }
  return out + '\u2026'
}

// --- Preview (rasterizes straight from the image elements) --------------------

export interface SheetPreview {
  canvas: HTMLCanvasElement
  pages: number
  perPage: number
  cols: number
  rows: number
}

export function renderSheetPreview(images: SheetImage[], opts: SheetOptions): SheetPreview {
  const [pageW, pageH] = pageSize(opts)
  const { cols, rows } = gridDims(opts)
  const perPage = cols * rows
  const pages = Math.max(1, Math.ceil(images.length / perPage))
  const scale = Math.min(1, 1400 / Math.max(pageW, pageH))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(pageW * scale)
  canvas.height = Math.round(pageH * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context')
  }
  ctx.scale(scale, scale)
  ctx.fillStyle = opts.backgroundColor
  ctx.fillRect(0, 0, pageW, pageH)

  const labelH = opts.showLabels ? opts.labelSize + 8 : 0
  const cells = computeCells(opts, Math.min(perPage, images.length))

  cells.forEach((cell, i) => {
    const img = images[i]
    const fit = fitInCell(cell, img.image.naturalWidth, img.image.naturalHeight, labelH)
    ctx.drawImage(img.image, fit.x, fit.y, fit.w, fit.h)

    const text = captionText(opts, img.name, i)
    if (text) {
      const fontSize = opts.labelSize
      ctx.font = `400 ${fontSize}px Helvetica, Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#333333'
      const truncated = truncateToWidth(
        (t) => ctx.measureText(t).width,
        text,
        cell.w - 8,
      )
      ctx.fillText(truncated, cell.x + cell.w / 2, cell.y + cell.h - labelH / 2)
    }
  })

  return { canvas, pages, perPage, cols, rows }
}

// --- PDF generation -----------------------------------------------------------

// Rasterizes one photo to a JPEG at ~144dpi (2x page points) so embedded
// thumbnails stay sharp while the file stays small. EXIF orientation is applied
// by drawing through the normalized <img> element.
async function embedAsJpeg(
  doc: PDFDocument,
  image: HTMLImageElement,
  backgroundColor: string,
  targetPt: number,
): Promise<PDFImage> {
  const px = Math.max(32, Math.round(targetPt * 2))
  const scale = px / Math.max(image.naturalWidth, image.naturalHeight)
  const w = Math.max(32, Math.round(image.naturalWidth * scale))
  const h = Math.max(32, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context')
  }
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(image, 0, 0, w, h)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  )
  if (!blob) {
    throw new Error('Could not encode image for PDF')
  }
  return doc.embedJpg(new Uint8Array(await blob.arrayBuffer()))
}

export async function buildContactSheetPDF(
  images: SheetImage[],
  opts: SheetOptions,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bg = hexToRgb(opts.backgroundColor, rgb)
  const [pageW, pageH] = pageSize(opts)

  // Per-page capacity (auto grids are stable for a fixed page/options combo).
  const perPage = gridDims(opts).cols * gridDims(opts).rows
  const pageCount = Math.ceil(images.length / perPage)
  const labelH = opts.showLabels ? opts.labelSize + 8 : 0

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const page = doc.addPage([pageW, pageH])
    page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: bg })

    const pageImages = images.slice(pageIndex * perPage, (pageIndex + 1) * perPage)
    const cells = computeCells(opts, pageImages.length)

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const img = pageImages[i]
      const fit = fitInCell(cell, img.image.naturalWidth, img.image.naturalHeight, labelH)
      const xobj = await embedAsJpeg(doc, img.image, opts.backgroundColor, cell.w)
      page.drawImage(xobj, { x: fit.x, y: pageH - (fit.y + fit.h), width: fit.w, height: fit.h })

      const text = captionText(opts, img.name, pageIndex * perPage + i)
      if (text) {
        const fontSize = opts.labelSize
        const maxW = cell.w - 8
        const truncated = truncateToWidth(
          (t) => font.widthOfTextAtSize(t, fontSize),
          text,
          maxW,
        )
        const width = font.widthOfTextAtSize(truncated, fontSize)
        page.drawText(truncated, {
          x: cell.x + (cell.w - width) / 2,
          y: pageH - (cell.y + cell.h - labelH / 2),
          size: fontSize,
          font,
          color: rgb(0.2, 0.2, 0.2),
        })
      }
    }
  }

  return doc.save()
}