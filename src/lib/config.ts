import type { BorderOptions, InfoAlign, InfoFontFamily } from './border'

export const DEFAULTS: BorderOptions = {
  width: 10,
  color: '#ffffff',
  radius: 0,
  placement: 'outer',
  aspect: 'original',
  second: { enabled: false, width: 5, color: '#000000' },
  showInfo: false,
  infoFontSize: 50,
  infoFontFamily: 'sans',
  infoSeparator: '|',
  infoAlign: 'center',
}

export const RENDER_DEBOUNCE_MS = 150
export const PREVIEW_MAX_DIMENSION = 1600
export const EXPORT_MAX_DIMENSION = 8192

export const ALIGNS: { value: InfoAlign; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'space', label: 'Space evenly' },
]

export const FONT_FAMILIES: { value: InfoFontFamily; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Monospace' },
]

export const SEPARATORS: { value: string; label: string }[] = [
  { value: '|', label: '| pipe' },
  { value: '·', label: '· dot' },
  { value: '•', label: '• bullet' },
  { value: '/', label: '/ slash' },
  { value: ',', label: ', comma' },
]
