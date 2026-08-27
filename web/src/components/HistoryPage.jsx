import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getOrders, voidOrder } from '../lib/api'
import { rupiah, timeID } from '../lib/format'
import { useShop } from '../shop'

export default function HistoryPage({ onPrint }) {
  const { role } = useShop()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)
  const [voiding, setVoiding] = useState(null)

  function load() {
    getOrders()
      .then(setOrders)
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
  }, [])

  function summary(order) {
    return order.items.map((i) => `${i.qty}x ${i.name}`).join(', ')
  }

  async function doVoid(order) {
    if (!window.confirm(`Batalkan pesanan ${order.number}?`)) return
    setVoiding(order.id)
    try {
      await voidOrder(order.id, 'Dibatalkan oleh kasir')
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setVoiding(null)
    }
  }

  return (
    <div className="page-inner">
      <div className="page-heading">
        <h1>Riwayat Pesanan</h1>
        <p>Daftar pesanan yang sudah selesai.</p>
      </div>

      {error ? (
        <div className="state-box">
          <span className="material-symbols-outlined">error_outline</span>
          <h3>Tidak bisa memuat riwayat</h3>
          <p>{error}</p>
        </div>
      ) : !orders ? (
        <div className="history-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="order-card skeleton">
              <div className="sk-line w40" />
              <div className="sk-line w70" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="state-box">
          <span className="material-symbols-outlined">receipt_long</span>
          <h3>Belum ada pesanan</h3>
          <p>Pesanan yang selesai akan muncul di sini.</p>
        </div>
      ) : (
        <div className="history-list">
          {orders.map((o, i) => {
            const isVoid = o.status === 'void'
            return (
              <motion.div
                key={o.id}
                className={`order-card ${isVoid ? 'voided' : ''}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
              >
                <div className="order-card-top">
                  <span className="order-number">{o.number}</span>
                  <span className="order-type-tag">{o.orderType === 'dine_in' ? '🍽️ Dine In' : '🛍️ Bungkus'}{o.tableNo ? ` · Meja ${o.tableNo}` : ''}</span>
                  <span className="order-type-tag">{o.paymentMethod === 'qris' ? 'QRIS' : 'Tunai'}</span>
                  <span className={`order-status ${isVoid ? 'status-void' : ''}`}>
                    {isVoid ? 'Batal' : 'Lunas'}
                  </span>
                </div>
                <p className="order-summary">{summary(o)}</p>
                <div className="order-card-bottom">
                  <span className="order-time">
                    {timeID(o.createdAt)}
                    {o.cashierName ? ` · ${o.cashierName}` : ''}
                  </span>
                  <div className="order-card-right">
                    {!isVoid && (
                      <>
                        <button type="button" className="reprint-btn" onClick={() => onPrint(o, 'kitchen')}>
                          <span className="material-symbols-outlined">print</span>
                          Dapur
                        </button>
                        <button type="button" className="reprint-btn" onClick={() => onPrint(o, 'receipt')}>
                          <span className="material-symbols-outlined">receipt_long</span>
                          Struk
                        </button>
                        <button
                          type="button"
                          className="reprint-btn void-btn"
                          onClick={() => doVoid(o)}
                          disabled={voiding === o.id}
                        >
                          <span className="material-symbols-outlined">block</span>
                          Batalkan
                        </button>
                      </>
                    )}
                    <span className="order-total">{rupiah(o.total)}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
