'use client'
import { useRef, useState } from 'react'
import styles from './DropZone.module.css'

interface Props {
  label: string
  accept?: string
  onFile: (file: File) => void
  fileName?: string
  hint?: string
}

export default function DropZone({ label, accept = '.pdf,.txt,.md', onFile, fileName, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handle = (file: File | null) => { if (file) onFile(file) }

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.drag : ''} ${fileName ? styles.filled : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files?.[0] ?? null)}
      />

      {fileName ? (
        <div className={styles.fileInfo}>
          <div className={styles.fileIcon}>
            <span className={styles.fileIconLine} />
            <span className={styles.fileIconLine} />
            <span className={styles.fileIconLine} />
          </div>
          <div className={styles.fileName}>{fileName}</div>
          <div className={styles.sub}>Click to replace</div>
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.uploadIcon}>
            <span className={styles.uploadArrow} />
          </div>
          <div className={styles.title}>{label}</div>
          <div className={styles.sub}>{hint ?? 'PDF · TXT · MD'}</div>
        </div>
      )}
    </div>
  )
}
