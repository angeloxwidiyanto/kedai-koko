import { motion } from 'framer-motion'
import { rupiah } from '../lib/format'
import * as printer from '../lib/printer'
import * as escpos from '../lib/escpos'

const COLORS = ['#9e3d00', '#ffb595', '#c64f00', '#e9e2d3', '#ffdbcd', '#f4c07a']

export default function SuccessOverlay({ order, onClose, onPrint }) {
  const pieces = Array.from({ length: 40 })
  const isRawBT = printer.getPrintMode() === 'rawbt'
  const receiptUrl = isRawBT ? printer.getRawBTUrl(escpos.receipt(order)) : ''
  const kitchenUrl = isRawBT ? printer.getRawBTUrl(escpos.kitchenTicket(order)) : ''

  return (
    <motion.div
      className="success-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="confetti-wrap" aria-hidden="true">
        {pieces.map((_, i) => {
          const left = (i * 137) % 100
          const delay = (i % 10) * 0.08
          const duration = 2.2 + (i % 5) * 0.4
          const size = 8 + (i % 4) * 4
          const color = COLORS[i % COLORS.length]
          return (
            <motion.span
              key={i}
              className="confetti"
              style={{ left: `${left}%`, width: size, height: size * 0.5, background: color }}
              initial={{ y: -60, opacity: 1, rotate: 0 }}
              animate={{ y: '105vh', opacity: 0.85, rotate: 360 }}
              transition={{ duration, delay, ease: 'linear' }}
            />
          )
        })}
      </div>

      <motion.div
        className="success-card"
        initial={{ scale: 0.8, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 18 }}
      >
        <motion.div
          className="check"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 14 }}
        >
          <span className="material-symbols-outlined">check</span>
        </motion.div>
        <h2>Terima kasih!</h2>
        <p className="order-no">
          Nomor pesanan {order.number}
          {order.isOffline && <span className="badge-offline-chip">Offline</span>}
        </p>
        {order.isOffline && (
          <p className="offline-notice">
            Transaksi tersimpan di tablet. Otomatis disinkronkan ke server saat online.
          </p>
        )}

        <div className="receipt">
          <div><span>Total</span><span>{rupiah(order.total)}</span></div>
          <div><span>Dibayar</span><span>{rupiah(order.paid)}</span></div>
          <div><span>Metode</span><span>{order.paymentMethod === 'qris' ? 'QRIS' : 'Tunai'}</span></div>
          <div className="change"><span>Kembalian</span><span>{rupiah(order.change)}</span></div>
        </div>

        {isRawBT ? (
          <>
            <a
              href={receiptUrl}
              className="btn btn-primary"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <span className="material-symbols-outlined">receipt_long</span>
              Cetak Struk
            </a>

            <a
              href={kitchenUrl}
              className="btn btn-secondary"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <span className="material-symbols-outlined">print</span>
              Cetak Tiket Dapur
            </a>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onPrint(order, 'receipt')}
            >
              <span className="material-symbols-outlined">receipt_long</span>
              Cetak Struk
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onPrint(order, 'kitchen')}
            >
              <span className="material-symbols-outlined">print</span>
              Cetak Tiket Dapur
            </button>
          </>
        )}

        <button type="button" className="btn btn-secondary btn-plain" onClick={onClose}>
          Selesai
        </button>
      </motion.div>
    </motion.div>
  )
}
