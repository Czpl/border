export interface CameraMetadata {
  Make?: string
  Model?: string
  ExposureTime?: number
  FNumber?: number
  ISO?: number
}

export function formatShutter(exposureTime: number): string {
  if (exposureTime >= 1) return `${Math.round(exposureTime)}s`
  return `1/${Math.round(1 / exposureTime)}`
}

export function buildCameraSegments(meta: CameraMetadata): string[] | null {
  const parts: string[] = []
  const camera = [meta.Make, meta.Model].filter(Boolean).join(' ')
  if (camera) parts.push(camera)
  if (meta.FNumber) parts.push(`f/${meta.FNumber}`)
  if (meta.ExposureTime) parts.push(formatShutter(meta.ExposureTime))
  if (meta.ISO) parts.push(`ISO ${meta.ISO}`)
  return parts.length > 0 ? parts : null
}
