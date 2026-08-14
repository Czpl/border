export type Placement = 'outer' | 'inner'

export type AspectRatio = 'original' | 'square' | 'instagram'

export type InfoFontFamily = 'sans' | 'serif' | 'mono'

export type InfoAlign = 'center' | 'left' | 'right' | 'space'

export interface SecondBorder {
  enabled: boolean
  width: number
  color: string
}

export interface BorderOptions {
  width: number
  color: string
  radius: number
  placement: Placement
  aspect: AspectRatio
  second: SecondBorder
  showInfo: boolean
  infoFontSize: number
  infoFontFamily: InfoFontFamily
  infoSeparator: string
  infoAlign: InfoAlign
}

export interface RenderedImage {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

export interface RenderLimits {
  maxDimension: number
  dpr?: number
}

const MAX_PIXEL_DIMENSION = 8192

const ASPECT_RATIOS: Record<Exclude<AspectRatio, 'original'>, number> = {
  square: 1,
  instagram: 4 / 5,
}

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function computeScale(canvasW: number, canvasH: number, limits?: RenderLimits) {
  const maxDim = limits?.maxDimension ?? Infinity
  const dpr = limits?.dpr ?? Math.min(window.devicePixelRatio || 1, 2)
  let scale = Math.min(1, maxDim / Math.max(canvasW, canvasH)) * dpr
  const pixelMax = Math.max(canvasW, canvasH) * scale
  if (pixelMax > MAX_PIXEL_DIMENSION) {
    scale *= MAX_PIXEL_DIMENSION / pixelMax
  }
  return scale
}

function textColorFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1a1a1a' : '#ffffff'
}

const FONT_FAMILIES: Record<InfoFontFamily, string> = {
  sans: 'system-ui, -apple-system, Segoe UI, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SF Mono, Menlo, monospace',
}

function drawInfoText(
  ctx: CanvasRenderingContext2D,
  contentW: number,
  contentH: number,
  borderPx: number,
  segments: string[],
  options: BorderOptions,
  textColor: string,
) {
  const maxWidth = contentW - 2 * borderPx
  const family = FONT_FAMILIES[options.infoFontFamily]
  const fontSize = Math.max(10, borderPx * (options.infoFontSize / 100))
  const joined = segments.join(` ${options.infoSeparator} `)

  const applyFont = (size: number) => {
    ctx.font = `500 ${size}px ${family}`
    return ctx.measureText(joined).width
  }
  let fontPx = fontSize
  let width = applyFont(fontPx)
  if (width > maxWidth && width > 0) {
    fontPx = Math.floor((maxWidth / width) * fontPx)
    width = applyFont(fontPx)
    if (width > maxWidth) {
      fontPx = Math.floor((maxWidth / width) * fontPx)
      applyFont(fontPx)
    }
  }

  ctx.fillStyle = textColor
  ctx.textBaseline = 'middle'
  const midY = contentH - borderPx / 2

  if (options.infoAlign === 'space') {
    const widths = segments.map((s) => ctx.measureText(s).width)
    const total = widths.reduce((a, b) => a + b, 0)
    const gap = segments.length > 1 ? (maxWidth - total) / (segments.length - 1) : 0
    let x = (contentW - (total + gap * (segments.length - 1))) / 2
    ctx.textAlign = 'left'
    segments.forEach((s, i) => {
      ctx.fillText(s, x, midY)
      x += widths[i] + gap
    })
  } else {
    ctx.textAlign = options.infoAlign
    const x =
      options.infoAlign === 'left'
        ? borderPx
        : options.infoAlign === 'right'
          ? contentW - borderPx
          : contentW / 2
    ctx.fillText(joined, x, midY)
  }
}

export function renderBorder(
  image: HTMLImageElement,
  options: BorderOptions,
  limits?: RenderLimits,
  segments?: string[] | null,
): RenderedImage {
  const { width: widthPercent, color, radius, placement, aspect, second } = options
  const imgW = image.naturalWidth
  const imgH = image.naturalHeight
  const borderPx = Math.round(Math.min(imgW, imgH) * (widthPercent / 100))
  const secondPx = second.enabled
    ? Math.round(Math.min(imgW, imgH) * (second.width / 100))
    : 0
  const totalPx = borderPx + secondPx

  const contentW = placement === 'outer' ? imgW + 2 * totalPx : imgW
  const contentH = placement === 'outer' ? imgH + 2 * totalPx : imgH

  let canvasW = contentW
  let canvasH = contentH
  if (aspect !== 'original') {
    const ratio = ASPECT_RATIOS[aspect]
    if (contentW / contentH > ratio) {
      canvasW = contentW
      canvasH = Math.round(contentW / ratio)
    } else {
      canvasW = Math.round(contentH * ratio)
      canvasH = contentH
    }
  }
  const offsetX = Math.round((canvasW - contentW) / 2)
  const offsetY = Math.round((canvasH - contentH) / 2)

  const scale = computeScale(canvasW, canvasH, limits)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(canvasW * scale)
  canvas.height = Math.round(canvasH * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context')
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (offsetX > 0 || offsetY > 0) {
    ctx.beginPath()
    ctx.rect(0, 0, canvasW, canvasH)
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.translate(offsetX, offsetY)

  if (placement === 'outer') {
    ctx.beginPath()
    traceRoundedRect(ctx, 0, 0, contentW, contentH, radius)
    ctx.fillStyle = color
    ctx.fill()

    if (secondPx > 0) {
      ctx.beginPath()
      traceRoundedRect(
        ctx,
        borderPx,
        borderPx,
        imgW + 2 * secondPx,
        imgH + 2 * secondPx,
        Math.max(0, radius - borderPx),
      )
      traceRoundedRect(
        ctx,
        totalPx,
        totalPx,
        imgW,
        imgH,
        Math.max(0, radius - totalPx),
      )
      ctx.fillStyle = second.color
      ctx.fill('evenodd')
    }

    ctx.save()
    ctx.beginPath()
    traceRoundedRect(ctx, totalPx, totalPx, imgW, imgH, Math.max(0, radius - totalPx))
    ctx.clip()
    ctx.drawImage(image, totalPx, totalPx, imgW, imgH)
    ctx.restore()
  } else {
    const innerX = totalPx
    const innerY = totalPx
    const innerW = imgW - 2 * totalPx
    const innerH = imgH - 2 * totalPx
    const innerR = Math.max(0, radius - totalPx)

    if (innerW <= 0 || innerH <= 0) {
      throw new Error('Border width exceeds image dimensions')
    }

    ctx.save()
    ctx.beginPath()
    traceRoundedRect(ctx, 0, 0, contentW, contentH, radius)
    ctx.clip()
    ctx.drawImage(image, 0, 0, imgW, imgH)
    ctx.restore()

    ctx.beginPath()
    traceRoundedRect(ctx, 0, 0, contentW, contentH, radius)
    traceRoundedRect(ctx, borderPx, borderPx, contentW - 2 * borderPx, contentH - 2 * borderPx, Math.max(0, radius - borderPx))
    ctx.fillStyle = color
    ctx.fill('evenodd')

    if (secondPx > 0) {
      ctx.beginPath()
      traceRoundedRect(
        ctx,
        borderPx,
        borderPx,
        contentW - 2 * borderPx,
        contentH - 2 * borderPx,
        Math.max(0, radius - borderPx),
      )
      traceRoundedRect(ctx, innerX, innerY, innerW, innerH, innerR)
      ctx.fillStyle = second.color
      ctx.fill('evenodd')
    }
  }

  if (segments && segments.length > 0 && borderPx > 0) {
    drawInfoText(
      ctx,
      contentW,
      contentH,
      borderPx,
      segments,
      options,
      textColorFor(color),
    )
  }

  return { canvas, width: canvasW, height: canvasH }
}