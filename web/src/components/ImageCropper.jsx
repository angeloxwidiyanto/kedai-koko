import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const RATIO = 4 / 3
const OUTPUT_W = 800
const OUTPUT_H = 600

export default function ImageCropper({ src, onCancel, onDone }) {
  const [img, setImg] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef(null)
  const viewportRef = useRef(null)
  const [vp, setVp] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const image = new Image()
    image.onload = () => setImg(image)
    image.src = src
  }, [src])

  // ukur viewport (responsif)
  const measure = useCallback(() => {
    const el = viewportRef.current
    if (el) setVp({ w: el.clientWidth, h: el.clientHeight })
  }, [])
  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (viewportRef.current) ro.observe(viewportRef.current)
    return () => ro.disconnect()
  }, [measure])

  const coverScale = img && vp.w > 0 ? Math.max(vp.w / img.width, vp.h / img.height) : 0
  const rw = img && coverScale ? img.width * coverScale * zoom : 0
  const rh = img && coverScale ? img.height * coverScale * zoom : 0

  function clampOffset(x, y) {
    if (!rw || !rh) return { x: 0, y: 0 }
    return {
      x: Math.min((rw - vp.w) / 2, Math.max(-(rw - vp.w) / 2, x)),
      y: Math.min((rh - vp.h) / 2, Math.max(-(rh - vp.h) / 2, y)),
    }
  }

  function onPointerDown(e) {
    setDragging(true)
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e) {
    if (!dragging || !dragRef.current) return
    const dx = e.clientX - dragRef.current.sx
    const dy = e.clientY - dragRef.current.sy
    setOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy))
  }
  function onPointerUp() {
    setDragging(false)
    dragRef.current = null
  }
  function changeZoom(v) {
    setZoom(v)
    setOffset((o) => clampOffset(o.x, o.y))
  }

  function confirm() {
    if (!img || !coverScale) return
    const k = coverScale * zoom
    const cx = img.width / 2 - offset.x / k
    const cy = img.height / 2 - offset.y / k
    const sw = vp.w / k
    const sh = vp.h / k
    const sx = cx - sw / 2
    const sy = cy - sh / 2

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_W
    canvas.height = OUTPUT_H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_W, OUTPUT_H)
    canvas.toBlob((blob) => { if (blob) onDone(blob) }, 'image/jpeg', 0.9)
  }

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="modal form-modal-sm cropper-modal"
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
      >
        <div className="modal-head">
          <h2>Atur Foto</h2>
          <button type="button" className="close-btn" onClick={onCancel} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="cropper-body">
          <p className="cropper-hint">
            Rasio foto <strong>4:3</strong> (disarankan 800×600px). Geser gambar untuk atur posisi.
          </p>

          <div
            ref={viewportRef}
            className="cropper-viewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
          >
            {img && (
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  width: rw,
                  height: rh,
                  left: (vp.w - rw) / 2 + offset.x,
                  top: (vp.h - rh) / 2 + offset.y,
                }}
              />
            )}
            <div className="cropper-grid" aria-hidden="true" />
          </div>

          <div className="cropper-controls">
            <span className="material-symbols-outlined">zoom_out</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
              aria-label="Zoom"
            />
            <span className="material-symbols-outlined">zoom_in</span>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={!img}>
            Gunakan Foto
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
