import type { BorderOptions } from '../lib/border'
import { Controls, type ControlTab, type UpdateOption, type UpdateSecond } from './Controls'

const TABS: { id: ControlTab; label: string }[] = [
  { id: 'border', label: 'Border' },
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
  cameraSegments: string[] | null
  onDownload: () => void
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
  cameraSegments,
  onDownload,
  size,
}: MobileDrawerProps) {
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
            className={`tabs__chevron ${open ? 'tabs__chevron--up' : ''}`}
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
          </button>
        ))}
      </nav>
      {open && (
        <div className="drawer-body">
          <Controls
            options={options}
            update={update}
            updateSecond={updateSecond}
            cameraSegments={cameraSegments}
            tab={tab}
          />
          <button type="button" className="download" onClick={onDownload}>
            Download PNG
          </button>
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
