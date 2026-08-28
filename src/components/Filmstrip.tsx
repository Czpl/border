import { useState } from 'react'
import type { SheetImage } from '../lib/contactSheet'

interface FilmstripProps {
  images: SheetImage[]
  onRemove: (index: number) => void
  onReorder: (from: number, to: number) => void
}

export function Filmstrip({ images, onRemove, onReorder }: FilmstripProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const handleReorder = (from: number, to: number) => {
    const clamped = Math.max(0, Math.min(to, images.length - 1))
    if (from === clamped) return
    onReorder(Math.max(0, Math.min(from, images.length - 1)), clamped)
  }

  return (
    <div className="filmstrip" aria-label="Contact sheet images">
      {images.map((img, i) => (
        <figure
          key={i}
          className={[
            'filmstrip-item',
            dragIndex === i ? 'filmstrip-item--drag' : '',
            overIndex === i ? 'filmstrip-item--over' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          draggable
          onDragStart={(e) => {
            setDragIndex(i)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (overIndex !== i) setOverIndex(i)
          }}
          onDragLeave={() => setOverIndex((prev) => (prev === i ? null : prev))}
          onDrop={(e) => {
            e.preventDefault()
            if (dragIndex !== null && dragIndex !== i) handleReorder(dragIndex, i)
            setDragIndex(null)
            setOverIndex(null)
          }}
          onDragEnd={() => {
            setDragIndex(null)
            setOverIndex(null)
          }}
        >
          <div className="filmstrip-thumb">
            {img.thumb ? (
              <img src={img.thumb} alt={img.name} draggable={false} />
            ) : (
              <span className="filmstrip-placeholder">img</span>
            )}
          </div>
          <figcaption title={img.name}>{img.name}</figcaption>
          <div className="filmstrip-actions">
            <button
              type="button"
              disabled={i === 0}
              aria-label={`Move ${img.name} earlier`}
              onClick={() => handleReorder(i, i - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              disabled={i === images.length - 1}
              aria-label={`Move ${img.name} later`}
              onClick={() => handleReorder(i, i + 1)}
            >
              ›
            </button>
            <button
              type="button"
              className="filmstrip-remove"
              aria-label={`Remove ${img.name}`}
              onClick={() => onRemove(i)}
            >
              ×
            </button>
          </div>
        </figure>
      ))}
    </div>
  )
}