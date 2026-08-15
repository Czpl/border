export type Placement = 'outer' | 'inner'

export type AspectRatio = 'original' | 'square' | 'instagram' | 'story' | 'polaroid'

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
  placement: Placement
  aspect: AspectRatio
  second: SecondBorder
  bottomWidth?: number
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
  story: 9 / 16,
  polaroid: 14 / 17,
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
  bottomPx: number,
  segments: string[],
  options: BorderOptions,
  textColor: string,
) {
  const maxWidth = contentW - 2 * borderPx
  const family = FONT_FAMILIES[options.infoFontFamily]
  const fontSize = Math.max(10, Math.max(borderPx, bottomPx) * (options.infoFontSize / 100))
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
  const midY = contentH - bottomPx / 2

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
  const { width: widthPercent, color, placement, aspect, second } = options
  const imgW = image.naturalWidth
  const imgH = image.naturalHeight
  const borderPx = Math.round(Math.min(imgW, imgH) * (widthPercent / 100))
  const bottomPx =
    options.bottomWidth != null
      ? Math.round(Math.min(imgW, imgH) * (options.bottomWidth / 100))
      : borderPx
  const secondPx = second.enabled
    ? Math.round(Math.min(imgW, imgH) * (second.width / 100))
    : 0

  const leftPx = borderPx
  const rightPx = borderPx
  const topPx = borderPx

  const contentW = placement === 'outer' ? imgW + leftPx + rightPx : imgW
  const contentH = placement === 'outer' ? imgH + topPx + bottomPx : imgH

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
    ctx.rect(0, 0, contentW, contentH)
    ctx.fillStyle = color
    ctx.fill()

    if (secondPx > 0) {
      ctx.beginPath()
      ctx.rect(leftPx, topPx, imgW + 2 * secondPx, imgH + 2 * secondPx)
      ctx.rect(leftPx + secondPx, topPx + secondPx, imgW, imgH)
      ctx.fillStyle = second.color
      ctx.fill('evenodd')
    }

    ctx.drawImage(image, leftPx + secondPx, topPx + secondPx, imgW, imgH)
  } else {
    const innerX = leftPx + secondPx
    const innerY = topPx + secondPx
    const innerW = imgW - leftPx - rightPx - 2 * secondPx
    const innerH = imgH - topPx - bottomPx - 2 * secondPx

    if (innerW <= 0 || innerH <= 0) {
      throw new Error('Border width exceeds image dimensions')
    }

    ctx.drawImage(image, 0, 0, imgW, imgH)

    ctx.beginPath()
    ctx.rect(0, 0, contentW, contentH)
    ctx.rect(
      leftPx,
      topPx,
      contentW - leftPx - rightPx,
      contentH - topPx - bottomPx,
    )
    ctx.fillStyle = color
    ctx.fill('evenodd')

    if (secondPx > 0) {
      ctx.beginPath()
      ctx.rect(
        leftPx,
        topPx,
        contentW - leftPx - rightPx,
        contentH - topPx - bottomPx,
      )
      ctx.rect(innerX, innerY, innerW, innerH)
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
      bottomPx,
      segments,
      options,
      textColorFor(color),
    )
  }

  return { canvas, width: canvasW, height: canvasH }
}