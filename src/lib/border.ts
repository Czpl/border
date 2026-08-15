// Core renderer: takes a photo and BorderOptions and produces a bordered output canvas.
// The pipeline is:
//   1. compute layout sizes (photo area, border, film bands, canvas) in logical px
//   2. size a <canvas> to those dimensions (scaled for preview limits / devicePixelRatio)
//   3. draw in order: frame background -> content (photo + borders) -> effects ->
//      camera info text -> film/portra frames
//
// There are three coordinate spaces:
//   - canvas: output pixel grid (possibly scaled down from logical px)
//   - frame:  the logical canvas minus aspect-ratio letterboxing (offsetX/offsetY)
//   - content: the frame shifted by (bandLeft, bandTop), i.e. the photo + its borders

export type Placement = 'outer' | 'inner'

export type AspectRatio = 'original' | 'square' | 'instagram' | 'story' | 'polaroid'

export type EffectId = 'polaroid' | 'light-leak' | 'flare' | 'film' | 'portraframe'

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

// Hard cap for the largest exported dimension (guards against giant canvases).
const MAX_PIXEL_DIMENSION = 8192

// Fixed output aspect ratios; canvas is letterboxed to one of these when
// `aspect` is not 'original'.
const ASPECT_RATIOS: Record<Exclude<AspectRatio, 'original'>, number> = {
  square: 1,
  instagram: 4 / 5,
  story: 9 / 16,
  polaroid: 14 / 17,
}

// Logical px -> physical px factor. Shrinks the output to fit `maxDimension`,
// applies devicePixelRatio (for crisp retina previews), and clamps to
// MAX_PIXEL_DIMENSION.
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

// Returns a readable text color for a given border hex color:
// white-ish backgrounds get dark text, dark backgrounds get white text.
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

// Draws the camera info line (e.g. "FUJIFILM X100V | 1/125 | f/2.8 | ISO 800")
// centered vertically in the bottom border area. If a film/portra frame added a
// bottom margin (`infoMarginY`), the text sits centered inside that margin so it
// is never covered by the frame. `contentH` is passed in the content coordinate
// space (frame height minus the top band), matching where drawing happens.
function drawInfoText(
  ctx: CanvasRenderingContext2D,
  contentW: number,
  contentH: number,
  borderPx: number,
  bottomPx: number,
  segments: string[],
  options: BorderOptions,
  textColor: string,
  infoMarginY = 0,
) {
  const maxWidth = contentW - 2 * borderPx
  const family = FONT_FAMILIES[options.infoFontFamily]
  // Base size scales with the border; if the full line is too wide we shrink it
  // to fit `maxWidth` (repeating until it fits).
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
  const midY =
    infoMarginY > 0
      ? contentH - infoMarginY / 2
      : contentH - bottomPx / 2

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

// Draws a soft drop shadow around the photo rect (used by the polaroid effect).
// `len` is the shadow thickness; gradients fade the shadow out away from the edges.
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

// Paints one soft radial "smear" of a given color used by the light-leak and
// flare effects. The context is translated to the center, rotated, and scaled
// horizontally (`stretch` > 1) so the blob looks smeared along an axis rather
// than perfectly round.
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

// "Orange light leak" effect: fades in warm orange from the edges using
// `screen` compositing (lightens the photo), clipped to the photo rect. Two
// smeared blobs suggest light bleeding in from opposite corners.
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

// "Orange-red optical flare" effect: anamorphic lens flare built from a bright
// core, a horizontal streak (stretch=5), a vertical streak (stretch=3.2), small
// ghost blobs, and a soft halo ring. Also `screen`-blended and clipped to photo.
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

// Dark background the procedural "35mm Fauxtra 800" film frame is painted on.
const FILM_BLACK = '#0d0d0d'

// Geometry of the portraframe.png asset (2289x2289, portrait film strip):
// the transparent photo "hole" is a 1442x2164 portrait rectangle inset from the
// edges, with thick sprocket-hole bands on the left/right and thin bands top/bottom.
// When the photo is landscape the whole frame is rotated 90deg so the thick
// bands (and sprocket holes) run along the photo's long edge.
const PORTRA_FRAME_W = 2289
const PORTRA_FRAME_H = 2289
const PORTRA_HOLE_X = 417
const PORTRA_HOLE_Y = 83
const PORTRA_HOLE_W = 1442
const PORTRA_HOLE_H = 2164

// Draws the procedural film frame around the photo rect (px, py, pw, ph):
// - fills dark strips on the two long edges (`stripH` wide) and thin edges (`edgeW`)
// - punches sprocket holes into those strips using the border color
// - prints the orange "KODAK PORTRA 800" label on the top/left strip
// `vertical` means the photo is portrait, so the strips run on the left/right.
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
  // Film strips on the two long edges (sprocket side) and the two short edges.
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

  // Sprocket holes: sized relative to the strip, laid out evenly along the strip
// length, and inset `holeGap` from the photo so the photo never touches a hole.
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

  // Orange film-stock label printed on the top strip (or the left strip when
// vertical, rotated -90deg to read upward).
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

export interface RenderAssets {
  portraFrame?: HTMLImageElement | null
}

export function renderBorder(
  image: HTMLImageElement,
  options: BorderOptions,
  limits?: RenderLimits,
  segments?: string[] | null,
  assets?: RenderAssets,
): RenderedImage {
  const { width: widthPercent, color, placement, aspect, second, effects } = options
  const imgW = image.naturalWidth
  const imgH = image.naturalHeight

  // --- Layout math (all in logical px) -----------------------------------------

  // Border thickness is a percentage of the smaller image side.
  const borderPx = Math.round(Math.min(imgW, imgH) * (widthPercent / 100))
  // Polaroid style uses a much taller bottom border; otherwise bottomWidth
  // overrides the symmetric border, falling back to borderPx.
  const bottomPx =
    aspect === 'polaroid'
      ? Math.round(Math.min(imgW, imgH) * 0.4)
      : options.bottomWidth != null
        ? Math.round(Math.min(imgW, imgH) * (options.bottomWidth / 100))
        : borderPx
  // "Inner" border thickness (the second line, enabled in classic presets).
  let secondPx = second.enabled
    ? Math.round(Math.min(imgW, imgH) * (second.width / 100))
    : 0

  const leftPx = borderPx
  const rightPx = borderPx
  const topPx = borderPx

  // The content area: for 'outer' placement the border sits outside the photo,
  // for 'inner' the border overlays the photo so content equals the photo.
  const contentW =
    placement === 'outer' ? imgW + leftPx + rightPx + 2 * secondPx : imgW
  const contentH =
    placement === 'outer' ? imgH + topPx + bottomPx + 2 * secondPx : imgH

  // The photo's visible rectangle inside the content area.
  const visibleX = leftPx + secondPx
  const visibleY = topPx + secondPx
  const visibleW =
    placement === 'outer' ? imgW : imgW - leftPx - rightPx - 2 * secondPx
  const visibleH =
    placement === 'outer' ? imgH : imgH - topPx - bottomPx - 2 * secondPx

  // --- Film / portra frame band sizes ------------------------------------------

  // Procedural film frame: thick sprocket strips on the long edges, thin strips
  // on the short edges. For portrait photos the strips run vertically.
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

  // PNG portra frame: the frame image is scaled so its hole exactly matches the
  // visible photo rect. For landscape photos the asset is rotated 90deg so the
  // thick sprocket bands sit on the top/bottom. `portraSx/Sy` map hole-pixels to
  // screen pixels; the band sizes are the leftover margins of the 2289x2289
  // asset after scaling.
  const portraActive = effects.includes('portraframe')
  const portraImg = assets?.portraFrame
  const portraRotated = portraActive && visibleW > visibleH
  const portraSx =
    portraActive && portraImg
      ? visibleW / (portraRotated ? PORTRA_HOLE_H : PORTRA_HOLE_W)
      : 0
  const portraSy =
    portraActive && portraImg
      ? visibleH / (portraRotated ? PORTRA_HOLE_W : PORTRA_HOLE_H)
      : 0
  const portraLeft =
    portraSx *
    (portraRotated
      ? PORTRA_FRAME_W - PORTRA_HOLE_Y - PORTRA_HOLE_H
      : PORTRA_HOLE_X)
  const portraRight =
    portraSx *
    (portraRotated
      ? PORTRA_HOLE_Y
      : PORTRA_FRAME_W - PORTRA_HOLE_X - PORTRA_HOLE_W)
  const portraTop = portraSy * (portraRotated ? PORTRA_HOLE_X : PORTRA_HOLE_Y)
  const portraBottom =
    portraSy *
    (portraRotated
      ? PORTRA_FRAME_H - PORTRA_HOLE_X - PORTRA_HOLE_W
      : PORTRA_FRAME_H - PORTRA_HOLE_Y - PORTRA_HOLE_H)

  // Total space the frames add around the content area.
  const bandLeft = filmBandX + portraLeft
  const bandRight = filmBandX + portraRight
  const bandTop = filmBandY + portraTop
  const bandBottom = filmBandY + portraBottom

  // When a frame is present and camera info is shown, reserve a bottom margin
  // below the frame bands so the info text isn't hidden under the frame. The
  // height is derived from the info text font size (1.9x for comfortable padding).
  const infoMarginY =
    segments != null && segments.length > 0 && borderPx > 0 && (filmActive || portraActive)
      ? Math.round(
          Math.max(10, Math.max(borderPx, bottomPx) * (options.infoFontSize / 100)) * 1.9,
        )
      : 0

  // The full frame = content + all bands (+ the info margin).
  const frameW = contentW + bandLeft + bandRight
  const frameH = contentH + bandTop + bandBottom + infoMarginY

  // --- Canvas sizing & aspect ratio -------------------------------------------

  // For fixed aspect ratios the canvas is letterboxed to the requested ratio
  // (blank border-color bars are added where the frame is narrower/wider).
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
  // Letterboxing offset that centers the frame inside the canvas.
  const offsetX = Math.round((canvasW - frameW) / 2)
  const offsetY = Math.round((canvasH - frameH) / 2)

  // --- Create the canvas & set up the drawing transform ------------------------

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

  // Paint the letterbox padding (only when aspect ratio adds blank space).
  if (offsetX > 0 || offsetY > 0) {
    ctx.beginPath()
    ctx.rect(0, 0, canvasW, canvasH)
    ctx.fillStyle = color
    ctx.fill()
  }
  // Enter frame coordinates.
  ctx.translate(offsetX, offsetY)

  // Solid background for the whole frame (visible where film sprocket holes are).
  if (filmActive || portraActive) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, frameW, frameH)
  }
  // Enter content coordinates (origin shifted by the top/left frame bands).
  ctx.save()
  ctx.translate(bandLeft, bandTop)

  // --- Draw content: border background, inner border, and the photo ------------

  // 'outer': border is added around the photo.
  if (placement === 'outer') {
    ctx.beginPath()
    ctx.rect(0, 0, contentW, contentH)
    ctx.fillStyle = color
    ctx.fill()

    // Inner (second) border drawn as a ring using the evenodd fill rule.
    if (secondPx > 0) {
      ctx.beginPath()
      ctx.rect(leftPx, topPx, imgW + 2 * secondPx, imgH + 2 * secondPx)
      ctx.rect(leftPx + secondPx, topPx + secondPx, imgW, imgH)
      ctx.fillStyle = second.color
      ctx.fill('evenodd')
    }

    ctx.drawImage(image, leftPx + secondPx, topPx + secondPx, imgW, imgH)
  } else {
    // 'inner': border overlays the photo. Draw the photo first, then punch a
    // rectangular hole for the inner image area.
    const innerX = leftPx + secondPx
    const innerY = topPx + secondPx
    const innerW = imgW - leftPx - rightPx - 2 * secondPx
    const innerH = imgH - topPx - bottomPx - 2 * secondPx

    if (innerW <= 0 || innerH <= 0) {
      throw new Error('Border width exceeds image dimensions')
    }

    ctx.drawImage(image, 0, 0, imgW, imgH)

    // Evenodd: outer rect minus the inner hole = the border ring.
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

  // --- Effects that touch the photo itself (drawn in content coords) ------------

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

  // --- Camera info text (in the bottom margin, clear of any frame bands) -------

  if (segments && segments.length > 0 && borderPx > 0) {
    drawInfoText(
      ctx,
      contentW,
      // Frame height in content coordinates (frame minus the top band).
      frameH - bandTop,
      borderPx,
      bottomPx,
      segments,
      options,
      textColorFor(color),
      infoMarginY,
    )
  }

  // --- Film frames (drawn last so they surround the photo) ----------------------

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

  if (portraActive && portraImg) {
    ctx.save()
    if (portraRotated) {
      // Landscape: rotate the 2289x2289 asset 90deg and scale so the hole maps
      // exactly onto the visible photo rect, sprockets running left-right.
      // Point (u,v) in the asset -> (translate + rotate + scale) as derived from
      // the hole's position so that u in [HOLE_X, HOLE_X+HOLE_W] and
      // v in [HOLE_Y, HOLE_Y+HOLE_H] land on the photo rect.
      ctx.translate(
        visibleX + (PORTRA_HOLE_Y + PORTRA_HOLE_H) * portraSx,
        visibleY - PORTRA_HOLE_X * portraSy,
      )
      ctx.rotate(Math.PI / 2)
      ctx.scale(portraSy, portraSx)
      ctx.drawImage(portraImg, 0, 0)
    } else {
      // Portrait: draw unrotated so the hole sits on the photo rect.
      ctx.drawImage(
        portraImg,
        visibleX - portraLeft,
        visibleY - portraTop,
        PORTRA_FRAME_W * portraSx,
        PORTRA_FRAME_H * portraSy,
      )
    }
    ctx.restore()
  }

  ctx.restore()

  return { canvas, width: canvasW, height: canvasH }
}