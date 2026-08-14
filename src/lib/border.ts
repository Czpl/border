export type Placement = 'outer' | 'inner'

export type AspectRatio = 'original' | 'square' | 'instagram'

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

export function renderBorder(
  image: HTMLImageElement,
  options: BorderOptions,
  limits?: RenderLimits,
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

    ctx.beginPath()
    traceRoundedRect(ctx, totalPx, totalPx, imgW, imgH, Math.max(0, radius - totalPx))
    ctx.clip()
    ctx.drawImage(image, totalPx, totalPx, imgW, imgH)
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

  return { canvas, width: canvasW, height: canvasH }
}