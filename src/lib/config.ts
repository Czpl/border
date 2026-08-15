import type {
  AspectRatio,
  BorderOptions,
  InfoAlign,
  InfoFontFamily,
  Placement,
} from './border'

export const DEFAULTS: BorderOptions = {
  width: 10,
  color: '#ffffff',
  placement: 'outer',
  aspect: 'original',
  second: { enabled: false, width: 1, color: '#000000' },
  showInfo: false,
  infoFontSize: 50,
  infoFontFamily: 'mono',
  infoSeparator: '|',
  infoAlign: 'center',
}

export type BorderPresetId =
  | 'default'
  | 'classic'
  | 'classic-inverted'
  | 'polaroid'

export interface BorderPreset {
  id: BorderPresetId
  label: string
  width: number
  color: string
  second: { enabled: boolean; width: number; color: string }
  bottomWidth?: number
  aspect?: AspectRatio
  placement?: Placement
}

export const PRESETS: BorderPreset[] = [
  {
    id: 'default',
    label: 'Default',
    width: 10,
    color: '#ffffff',
    second: { enabled: false, width: 1, color: '#000000' },
  },
  {
    id: 'classic',
    label: 'Classic',
    width: 10,
    color: '#ffffff',
    second: { enabled: true, width: 1, color: '#000000' },
  },
  {
    id: 'classic-inverted',
    label: 'Classic inverted',
    width: 10,
    color: '#000000',
    second: { enabled: true, width: 1, color: '#ffffff' },
  },
  {
    id: 'polaroid',
    label: 'Polaroid',
    width: 7,
    color: '#ffffff',
    second: { enabled: false, width: 1, color: '#000000' },
    bottomWidth: 40,
    aspect: 'polaroid',
    placement: 'outer',
  },
]

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
