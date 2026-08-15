import { useRef } from 'react'
import type { BorderOptions } from '../lib/border'
import {
  Controls,
  type ApplyEffect,
  type ApplyPreset,
  type ControlTab,
  type UpdateOption,
  type UpdateSecond,
} from './Controls'

const TABS: { id: ControlTab; label: string }[] = [
  { id: 'border', label: 'Border' },
  { id: 'effects', label: 'Effects' },
  { id: 'second', label: 'Border (inner)' },
  { id: 'layout', label: 'Layout' },
  { id: 'text', label: 'Camera info' },
]

interface MobileDrawerProps {
  tab: ControlTab
  onTabChange: (tab: ControlTab) => void
  open: boolean
  onToggleOpen: () => void
  options: BorderOptions
  update: UpdateOption
  updateSecond: UpdateSecond
  applyPreset: ApplyPreset
  applyEffect: ApplyEffect
  cameraSegments: string[] | null
  onDownload: () => void
  onFile: (file: File | null) => void
  size: { width: number; height: number } | null
}

export function MobileDrawer({
  tab,
  onTabChange,
  open,
  onToggleOpen,
  options,
  update,
  updateSecond,
  applyPreset,
  applyEffect,
  cameraSegments,
  onDownload,
  onFile,
  size,
}: MobileDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="mobile-drawer">
      <nav className="tabs">
        <button
          type="button"
          className="tabs__toggle"
          aria-label={open ? 'Collapse controls' : 'Expand controls'}
          onClick={onToggleOpen}
        >
          <svg
            className={`tabs__chevron ${open ? '' : 'tabs__chevron--up'}`}
            viewBox="0 0 16 16"
            width="16"
            height="16"
          >
            <path d="M8 11 3 6h10z" />
          </svg>
        </button>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'tab--active' : ''}`}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
            {t.id === 'effects' && <span className="badge">experimental</span>}
          </button>
        ))}
      </nav>
      {open && (
        <div className="drawer-body">
          <Controls
            options={options}
            update={update}
            updateSecond={updateSecond}
            applyPreset={applyPreset}
            applyEffect={applyEffect}
            cameraSegments={cameraSegments}
            tab={tab}
          />
          <button type="button" className="download" onClick={onDownload}>
            Download PNG
          </button>
          <button
            type="button"
            className="replace"
            onClick={() => fileInputRef.current?.click()}
          >
            Replace image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              onFile(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          {size && (
            <p className="size">
              Output: {size.width} × {size.height}px
            </p>
          )}
        </div>
      )}
    </div>
  )
}
