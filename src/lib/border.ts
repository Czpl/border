export type Placement = 'outer' | 'inner'

export type AspectRatio = 'original' | 'square' | 'instagram' | 'story' | 'polaroid'

export type EffectId = 'polaroid' | 'light-leak' | 'flare' | 'film'

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
  effects: EffectId[]
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

function drawFrameShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  len: number,
) {
  if (w <= 0 || h <= 0 || len <= 0) return

  let g = ctx.createLinearGradient(0, y, 0, y + len)
  g.addColorStop(0, 'rgba(0, 0, 0, 0.26)')
  g.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, len)

  g = ctx.createLinearGradient(0, y + h - len, 0, y + h)
  g.addColorStop(0, 'rgba(0, 0, 0, 0)')
  g.addColorStop(1, 'rgba(0, 0, 0, 0.26)')
  ctx.fillStyle = g
  ctx.fillRect(x, y + h - len, w, len)

  g = ctx.createLinearGradient(x, 0, x + len, 0)
  g.addColorStop(0, 'rgba(0, 0, 0, 0.26)')
  g.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = g
  ctx.fillRect(x, y, len, h)

  g = ctx.createLinearGradient(x + w - len, 0, x + w, 0)
  g.addColorStop(0, 'rgba(0, 0, 0, 0)')
  g.addColorStop(1, 'rgba(0, 0, 0, 0.26)')
  ctx.fillStyle = g
  ctx.fillRect(x + w - len, y, len, h)
}

function drawRadialSmear(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  angle: number,
  stretch: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  peak: number,
) {
  ctx.save()
  ctx.globalAlpha = peak
  ctx.translate(gx, gy)
  ctx.rotate(angle)
  ctx.scale(stretch, 1)
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`)
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  ctx.fillStyle = grad
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
  ctx.restore()
}

function drawLightLeak(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (w <= 0 || h <= 0) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.globalCompositeOperation = 'screen'

  const dim = Math.max(w, h)

  let g = ctx.createRadialGradient(x + w, y, 0, x + w, y, dim)
  g.addColorStop(0, 'rgba(255, 125, 30, 0.3)')
  g.addColorStop(0.4, 'rgba(255, 100, 22, 0.13)')
  g.addColorStop(1, 'rgba(255, 100, 22, 0)')
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)

  drawRadialSmear(
    ctx,
    x + w * 0.92,
    y + h * 0.05,
    Math.PI * 0.75,
    1.9,
    dim * 0.3,
    255,
    145,
    50,
    0.2,
  )
  drawRadialSmear(
    ctx,
    x + w * 0.1,
    y + h * 0.95,
    -Math.PI / 4,
    1.7,
    dim * 0.24,
    255,
    115,
    35,
    0.13,
  )

  const eg = ctx.createLinearGradient(0, y, 0, y + h * 0.2)
  eg.addColorStop(0, 'rgba(255, 110, 30, 0.1)')
  eg.addColorStop(1, 'rgba(255, 110, 30, 0)')
  ctx.fillStyle = eg
  ctx.fillRect(x, y, w, h * 0.2)

  ctx.restore()
}

function drawFlare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (w <= 0 || h <= 0) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.globalCompositeOperation = 'screen'

  const dim = Math.max(w, h)
  const cx = x + w * 0.5
  const cy = y + h * 0.42

  drawRadialSmear(ctx, cx, cy, 0, 1, dim * 0.6, 255, 115, 30, 0.2)
  drawRadialSmear(
    ctx,
    x + w * 0.85,
    y + h * 0.78,
    0,
    1,
    dim * 0.45,
    225,
    45,
    20,
    0.14,
  )
  drawRadialSmear(ctx, cx, cy, 0, 5, dim * 0.26, 255, 90, 25, 0.38)
  drawRadialSmear(
    ctx,
    cx,
    cy,
    Math.PI / 2,
    3.2,
    dim * 0.14,
    255,
    150,
    60,
    0.5,
  )
  drawRadialSmear(
    ctx,
    cx - w * 0.28,
    cy + h * 0.05,
    0,
    1,
    dim * 0.08,
    255,
    165,
    70,
    0.35,
  )
  drawRadialSmear(
    ctx,
    cx + w * 0.3,
    cy - h * 0.04,
    0,
    1,
    dim * 0.06,
    255,
    120,
    40,
    0.3,
  )

  const ringR = dim * 0.17
  const rg = ctx.createRadialGradient(cx, cy, ringR * 0.7, cx, cy, ringR * 1.3)
  rg.addColorStop(0, 'rgba(255, 160, 70, 0)')
  rg.addColorStop(0.5, 'rgba(255, 160, 70, 0.16)')
  rg.addColorStop(1, 'rgba(255, 160, 70, 0)')
  ctx.fillStyle = rg
  ctx.fillRect(x, y, w, h)

  ctx.restore()
}

const FILM_BLACK = '#0d0d0d'

function drawFilmFrame(
  ctx: CanvasRenderingContext2D,
  stripH: number,
  edgeW: number,
  px: number,
  py: number,
  pw: number,
  ph: number,
  holeColor: string,
  vertical: boolean,
) {
  ctx.fillStyle = FILM_BLACK
  if (vertical) {
    ctx.fillRect(px - stripH, py - edgeW, stripH, ph + edgeW * 2)
    ctx.fillRect(px + pw, py - edgeW, stripH, ph + edgeW * 2)
    ctx.fillRect(px - stripH, py - edgeW, pw + stripH * 2, edgeW)
    ctx.fillRect(px - stripH, py + ph, pw + stripH * 2, edgeW)
  } else {
    ctx.fillRect(px - edgeW, py - stripH, pw + edgeW * 2, stripH)
    ctx.fillRect(px - edgeW, py + ph, pw + edgeW * 2, stripH)
    ctx.fillRect(px - edgeW, py, edgeW, ph)
    ctx.fillRect(px + pw, py, edgeW, ph)
  }

  const holePerp = Math.round(stripH * 0.4)
  const holeAlong = Math.round(holePerp * 1.55)
  const gapRef = Math.max(2, Math.round(holeAlong * 0.75))
  const runLen = vertical ? ph : pw
  const count = Math.max(
    1,
    Math.round((runLen + gapRef) / (holeAlong + gapRef)),
  )
  const gap = count > 1 ? (runLen - count * holeAlong) / (count - 1) : 0
  const startAlong = count > 1 ? 0 : (runLen - holeAlong) / 2
  const holeGap = Math.round(stripH * 0.14)

  ctx.fillStyle = holeColor
  for (let i = 0; i < count; i++) {
    const along = startAlong + i * (holeAlong + gap)
    if (vertical) {
      ctx.beginPath()
      ctx.roundRect(px - holeGap - holePerp, py + along, holePerp, holeAlong, holePerp * 0.4)
      ctx.fill()
      ctx.beginPath()
      ctx.roundRect(px + pw + holeGap, py + along, holePerp, holeAlong, holePerp * 0.4)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.roundRect(px + along, py - holeGap - holePerp, holeAlong, holePerp, holePerp * 0.4)
      ctx.fill()
      ctx.beginPath()
      ctx.roundRect(px + along, py + ph + holeGap, holeAlong, holePerp, holePerp * 0.4)
      ctx.fill()
    }
  }

  const fontSize = Math.max(9, Math.round(stripH * 0.24))
  ctx.fillStyle = '#ff9a00'
  ctx.font = `700 ${fontSize}px "Helvetica Neue", Arial, sans-serif`
  ctx.textBaseline = 'middle'

  if (vertical) {
    ctx.save()
    ctx.translate(px - stripH + Math.round(stripH * 0.3), py + ph / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'left'
    ctx.fillText('KODAK PORTRA 800', 0, 0)
    ctx.restore()
  } else {
    const pad = Math.max(6, Math.round(edgeW * 1.2))
    const textY = py - stripH + Math.round(stripH * 0.28)
    ctx.textAlign = 'left'
    ctx.fillText('KODAK PORTRA 800', px - edgeW + pad, textY)
    ctx.textAlign = 'right'
    ctx.fillText(
      '800  250D  36 EXP',
      px - edgeW + pw + edgeW * 2 - pad,
      textY,
    )
  }
}

export function renderBorder(
  image: HTMLImageElement,
  options: BorderOptions,
  limits?: RenderLimits,
  segments?: string[] | null,
): RenderedImage {
  const { width: widthPercent, color, placement, aspect, second, effects } = options
  const imgW = image.naturalWidth
  const imgH = image.naturalHeight
  const borderPx = Math.round(Math.min(imgW, imgH) * (widthPercent / 100))
  const bottomPx =
    aspect === 'polaroid'
      ? Math.round(Math.min(imgW, imgH) * 0.4)
      : options.bottomWidth != null
        ? Math.round(Math.min(imgW, imgH) * (options.bottomWidth / 100))
        : borderPx
  let secondPx = second.enabled
    ? Math.round(Math.min(imgW, imgH) * (second.width / 100))
    : 0

  const leftPx = borderPx
  const rightPx = borderPx
  const topPx = borderPx

  const contentW =
    placement === 'outer' ? imgW + leftPx + rightPx + 2 * secondPx : imgW
  const contentH =
    placement === 'outer' ? imgH + topPx + bottomPx + 2 * secondPx : imgH

  const filmActive = effects.includes('film')
  const filmStripH = filmActive
    ? Math.max(20, Math.round(Math.min(imgW, imgH) * 0.09))
    : 0
  const filmEdgeW = filmActive
    ? Math.max(10, Math.round(Math.min(imgW, imgH) * 0.028))
    : 0
  const filmVertical = filmActive && imgH > imgW
  const filmBandX = filmVertical ? filmStripH : filmEdgeW
  const filmBandY = filmVertical ? filmEdgeW : filmStripH
  const frameW = contentW + filmBandX * 2
  const frameH = contentH + filmBandY * 2

  const visibleX = leftPx + secondPx
  const visibleY = topPx + secondPx
  const visibleW =
    placement === 'outer' ? imgW : imgW - leftPx - rightPx - 2 * secondPx
  const visibleH =
    placement === 'outer' ? imgH : imgH - topPx - bottomPx - 2 * secondPx

  let canvasW = frameW
  let canvasH = frameH
  if (aspect !== 'original') {
    const ratio = ASPECT_RATIOS[aspect]
    if (frameW / frameH > ratio) {
      canvasW = frameW
      canvasH = Math.round(frameW / ratio)
    } else {
      canvasW = Math.round(frameH * ratio)
      canvasH = frameH
    }
  }
  const offsetX = Math.round((canvasW - frameW) / 2)
  const offsetY = Math.round((canvasH - frameH) / 2)

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

  if (filmActive) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, frameW, frameH)
  }
  ctx.save()
  ctx.translate(filmBandX, filmBandY)

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

  if (effects.length > 0) {
    if (effects.includes('polaroid')) {
      drawFrameShadow(
        ctx,
        visibleX,
        visibleY,
        visibleW,
        visibleH,
        Math.max(6, Math.round(borderPx * 0.6)),
      )
    }
    if (effects.includes('light-leak')) {
      drawLightLeak(ctx, visibleX, visibleY, visibleW, visibleH)
    }
    if (effects.includes('flare')) {
      drawFlare(ctx, visibleX, visibleY, visibleW, visibleH)
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

  if (filmActive) {
    drawFilmFrame(
      ctx,
      filmStripH,
      filmEdgeW,
      visibleX,
      visibleY,
      visibleW,
      visibleH,
      color,
      filmVertical,
    )
  }

  ctx.restore()

  return { canvas, width: canvasW, height: canvasH }
}