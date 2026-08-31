import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import * as printer from '../lib/printer'
import * as escpos from '../lib/escpos'

export default function PrinterModal({ open, onClose }) {
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (!open) return
    setSupported(printer.isSupported())
    const unsub = printer.subscribe((dev) => setConnected(!!dev))
    return unsub
  }, [open])

  async function doConnect() {
    setBusy(true)
    setErr('')
    try {
      await printer.connect()
    } catch (e) {
      if (e.name !== 'NotFoundError') setErr(e.message || 'Gagal menyambungkan printer')
    } finally {
      setBusy(false)
    }
  }

  async function doTest() {
    setBusy(true)
    setErr('')
    try {
      await printer.print(escpos.testTicket())
    } catch (e) {
      setErr(e.message || 'Gagal mencetak')
    } finally {
      setBusy(false)
    }
  }

  async function doDisconnect() {
    setBusy(true)
    setErr('')
    try {
      await printer.disconnect()
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="modal form-modal-sm"
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
      >
        <div className="modal-head">
          <h2>Printer</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="form-body">
          {!supported ? (
            <div className="state-box state-box-small">
              <p>Browser ini tidak mendukung WebUSB. Gunakan Chrome (Android/laptop).</p>
            </div>
          ) : (
            <>
              <div className={`printer-status ${connected ? 'on' : ''}`}>
                <span className="material-symbols-outlined">{connected ? 'print' : 'print_disabled'}</span>
                <span>{connected ? 'Printer terhubung' : 'Printer belum terhubung'}</span>
              </div>

              {err && <p className="form-error upload-error">{err}</p>}

              <div className="printer-actions">
                {connected ? (
                  <>
                    <button type="button" className="btn btn-primary" onClick={doTest} disabled={busy}>
                      <span className="material-symbols-outlined">print</span>
                      Uji Cetak
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={doDisconnect} disabled={busy}>
                      Lepas
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={doConnect} disabled={busy}>
                    <span className="material-symbols-outlined">link</span>
                    {busy ? 'Menghubungkan...' : 'Sambungkan Printer'}
                  </button>
                )}
              </div>

              <p className="muted" style={{ fontSize: 14 }}>
                Hubungkan printer termal (USB) sekali saja. Setelah itu cetak berjalan otomatis.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
