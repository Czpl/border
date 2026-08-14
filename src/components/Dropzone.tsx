import { useRef } from 'react'

interface DropzoneProps {
  source: string | null
  dragOver: boolean
  onDragOver: (over: boolean) => void
  onFile: (file: File | null) => void
  className?: string
}

export function Dropzone({ source, dragOver, onDragOver, onFile, className }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <section
      className={`dropzone ${dragOver ? 'dropzone--over' : ''} ${className ?? ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(true)
      }}
      onDragLeave={() => onDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        onDragOver(false)
        onFile(e.dataTransfer.files[0] ?? null)
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <p>{source ? 'Replace image' : 'Drop an image here, or click to browse'}</p>
    </section>
  )
}
