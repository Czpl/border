import { useRef } from 'react'

interface DropzoneProps {
  source?: string | null
  dragOver: boolean
  onDragOver: (over: boolean) => void
  onFile?: (file: File | null) => void
  onFiles?: (files: File[]) => void
  className?: string
  emptyText?: string
  contentText?: string
}

export function Dropzone({
  source,
  dragOver,
  onDragOver,
  onFile,
  onFiles,
  className,
  emptyText = 'Drop an image here, or click to browse',
  contentText = 'Replace image',
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const multiple = Boolean(onFiles)

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (onFiles) {
      onFiles(Array.from(files))
    } else {
      onFile?.(files[0] ?? null)
    }
  }

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
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <p>{source ? contentText : emptyText}</p>
    </section>
  )
}