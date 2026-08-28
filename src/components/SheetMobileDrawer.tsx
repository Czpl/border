import type { SheetOptions } from '../lib/contactSheet'
import { SheetControls, type UpdateSheetOption } from './SheetControls'

interface SheetMobileDrawerProps {
  open: boolean
  onToggleOpen: () => void
  options: SheetOptions
  update: UpdateSheetOption
  busy: boolean
  imageCount: number
  result: { pages: number; perPage: number } | null
  onDownload: () => void
  onAddFiles: (files: File[]) => void
}

export function SheetMobileDrawer({
  open,
  onToggleOpen,
  options,
  update,
  busy,
  imageCount,
  result,
  onDownload,
  onAddFiles,
}: SheetMobileDrawerProps) {
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
        <button type="button" className="tab tab--active">
          Contact sheet
        </button>
      </nav>
      {open && (
        <div className="drawer-body">
          <SheetControls
            options={options}
            update={update}
            busy={busy}
            imageCount={imageCount}
            result={result}
            onDownload={onDownload}
            onAddFiles={onAddFiles}
          />
        </div>
      )}
    </div>
  )
}