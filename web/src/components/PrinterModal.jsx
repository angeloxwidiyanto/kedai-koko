import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import * as printer from '../lib/printer'
import * as escpos from '../lib/escpos'

export default function PrinterModal({ open, onClose }) {
  const [mode, setMode] = useState(printer.getPrintMode())
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [webUsbSupported, setWebUsbSupported] = useState(true)

  useEffect(() => {
    if (!open) return
    setWebUsbSupported(printer.isWebUsbSupported())
    const unsubMode = printer.subscribeMode((m) => setMode(m))
    const unsubDev = printer.subscribe((dev) => setConnected(!!dev))
    return () => {
      unsubMode()
      unsubDev()
    }
  }, [open])

  function handleSelectMode(newMode) {
    printer.setPrintMode(newMode)
    setErr('')
    setSuccessMsg('')
  }

  async function doTestRawBT() {
    setBusy(true)
    setErr('')
    setSuccessMsg('')
    try {
      const res = await printer.printRawBT(escpos.testTicket())
      if (res?.method === 'websocket') {
        setSuccessMsg('Tercetak via RawBT WebSocket (Background)!')
      } else {
        setSuccessMsg('Data dikirim ke RawBT. Periksa printer Anda!')
      }
    } catch (e) {
      setErr(e.message || 'Gagal mengirim ke RawBT')
    } finally {
      setBusy(false)
    }
  }

  async function doConnectUsb() {
    setBusy(true)
    setErr('')
    setSuccessMsg('')
    try {
      await printer.connect()
    } catch (e) {
      if (e.name !== 'NotFoundError') setErr(e.message || 'Gagal menyambungkan printer USB')
    } finally {
      setBusy(false)
    }
  }

  async function doTestUsb() {
    setBusy(true)
    setErr('')
    setSuccessMsg('')
    try {
      await printer.print(escpos.testTicket())
      setSuccessMsg('Uji cetak USB berhasil!')
    } catch (e) {
      setErr(e.message || 'Gagal mencetak')
    } finally {
      setBusy(false)
    }
  }

  async function doDisconnectUsb() {
    setBusy(true)
    setErr('')
    setSuccessMsg('')
    try {
      await printer.disconnect()
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const isAndroid = printer.isAndroid()

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="modal form-modal-sm printer-modal-dialog"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
      >
        <div className="modal-head">
          <h2>Pengaturan Printer</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="form-body">
          {/* Pemilihan Mode */}
          <div className="printer-modes">
            <button
              type="button"
              className={`mode-card ${mode === 'rawbt' ? 'active' : ''}`}
              onClick={() => handleSelectMode('rawbt')}
            >
              <div className="mode-card-header">
                <span className="material-symbols-outlined">tablet_android</span>
                <strong>RawBT (Android)</strong>
              </div>
              <p>Khusus Samsung Tab / Android via Bluetooth atau USB</p>
              {isAndroid && <span className="mode-pill">Direkomendasikan</span>}
            </button>

            <button
              type="button"
              className={`mode-card ${mode === 'webusb' ? 'active' : ''}`}
              onClick={() => handleSelectMode('webusb')}
            >
              <div className="mode-card-header">
                <span className="material-symbols-outlined">usb</span>
                <strong>WebUSB (PC)</strong>
              </div>
              <p>Kabel USB langsung di laptop/komputer kasir</p>
            </button>

            <button
              type="button"
              className={`mode-card ${mode === 'browser' ? 'active' : ''}`}
              onClick={() => handleSelectMode('browser')}
            >
              <div className="mode-card-header">
                <span className="material-symbols-outlined">print</span>
                <strong>Browser (Sistem)</strong>
              </div>
              <p>Dialog cetak bawaan browser atau cetak PDF</p>
            </button>
          </div>

          {/* Feedback status */}
          {err && <p className="form-error upload-error">{err}</p>}
          {successMsg && <p className="form-success">{successMsg}</p>}

          {/* Konten Mode RawBT */}
          {mode === 'rawbt' && (
            <div className="printer-mode-content">
              <div className="printer-status on">
                <span className="material-symbols-outlined">check_circle</span>
                <span>Mode RawBT Aktif</span>
              </div>

              <div className="printer-actions">
                <button type="button" className="btn btn-primary" onClick={doTestRawBT} disabled={busy}>
                  <span className="material-symbols-outlined">receipt_long</span>
                  {busy ? 'Mengirim...' : 'Uji Cetak RawBT'}
                </button>
              </div>

              <div className="rawbt-instructions">
                <h4>Cara Penggunaan di Samsung Tab:</h4>
                <ol>
                  <li>Sambungkan printer termal ke tablet via <strong>Bluetooth</strong> di pengaturan tablet.</li>
                  <li>Buka aplikasi <strong>RawBT</strong>, pilih printer Anda, dan pastikan tes cetak di RawBT berhasil.</li>
                  <li>
                    <em>(Sangat Disarankan)</em> Di menu RawBT, aktifkan <strong>WebSocket Service</strong> (port 40213) agar cetak berlangsung instan tanpa berpindah layar.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* Konten Mode WebUSB */}
          {mode === 'webusb' && (
            <div className="printer-mode-content">
              {!webUsbSupported ? (
                <div className="state-box state-box-small">
                  <p>Browser ini tidak mendukung WebUSB. Gunakan Chrome di PC/laptop atau beralih ke mode RawBT.</p>
                </div>
              ) : (
                <>
                  <div className={`printer-status ${connected ? 'on' : ''}`}>
                    <span className="material-symbols-outlined">{connected ? 'print' : 'print_disabled'}</span>
                    <span>{connected ? 'Printer USB Terhubung' : 'Printer USB Belum Terhubung'}</span>
                  </div>

                  <div className="printer-actions">
                    {connected ? (
                      <>
                        <button type="button" className="btn btn-primary" onClick={doTestUsb} disabled={busy}>
                          <span className="material-symbols-outlined">receipt_long</span>
                          Uji Cetak USB
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={doDisconnectUsb} disabled={busy}>
                          Lepas
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-primary" onClick={doConnectUsb} disabled={busy}>
                        <span className="material-symbols-outlined">link</span>
                        {busy ? 'Menghubungkan...' : 'Sambungkan Kabel USB'}
                      </button>
                    )}
                  </div>
                  <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                    Khusus printer thermal yang terhubung kabel USB langsung ke PC/laptop kasir.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Konten Mode Browser */}
          {mode === 'browser' && (
            <div className="printer-mode-content">
              <div className="printer-status">
                <span className="material-symbols-outlined">info</span>
                <span>Dialog Print Sistem Bawaan Browser</span>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>
                Setiap kali transaksi selesai, browser akan menampilkan jendela cetak sistem (Print Preview) bawaan tablet atau laptop.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
