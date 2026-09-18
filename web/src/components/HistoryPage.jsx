import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getOrders, voidOrder, syncOrderToServer } from '../lib/api'
import { getPendingOrders, discardPendingOrder, syncSingleOrder, subscribeSync } from '../lib/offlineSync'
import { rupiah, timeID } from '../lib/format'
import { useShop } from '../shop'

export default function HistoryPage({ onPrint, onNav, onToast }) {
  const { role, loadOrderToCart, count } = useShop()
  const [orders, setOrders] = useState(null)
  const [offlineOrders, setOfflineOrders] = useState([])
  const [error, setError] = useState(null)
  const [voiding, setVoiding] = useState(null)
  const [syncingId, setSyncingId] = useState(null)

  async function load() {
    let pendingList = []
    try {
      const pending = await getPendingOrders()
      pendingList = (pending || []).map((p) => {
        const ord = p.order || p
        return {
          ...ord,
          lastError: p.lastError || ord.lastError || null,
        }
      })
      setOfflineOrders(pendingList)
    } catch {
      setOfflineOrders([])
    }

    try {
      const sOrders = await getOrders()
      setOrders(sOrders)
      setError(null)
    } catch (e) {
      if (pendingList.length > 0) {
        setOrders([])
        setError(null)
      } else {
        setError(e.message)
      }
    }
  }

  useEffect(() => {
    load()
    const unsub = subscribeSync(() => {
      load()
    })
    return unsub
  }, [])

  const allOrders = useMemo(() => {
    const syncedIds = new Set((orders || []).map((o) => o.id))
    const pending = offlineOrders.filter((o) => !syncedIds.has(o.id))
    return [...pending, ...(orders || [])]
  }, [offlineOrders, orders])

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

  async function handleEditOrder(order) {
    if (count > 0) {
      const ok = window.confirm(
        `Keranjang belanja saat ini berisi ${count} item. Batalkan pesanan ${order.number} dan ganti isi keranjang dengan pesanan ini untuk diedit?`
      )
      if (!ok) return
    } else {
      const ok = window.confirm(
        `Batalkan pesanan ${order.number} dan kembalikan item ke keranjang untuk diedit?`
      )
      if (!ok) return
    }

    setVoiding(order.id)
    try {
      await voidOrder(order.id, 'Koreksi pesanan')
      loadOrderToCart(order)
      if (onToast) onToast(`Pesanan ${order.number} dibatalkan & item dimuat ke keranjang`)
      if (onNav) onNav('menu')
    } catch (e) {
      setError(e.message)
    } finally {
      setVoiding(null)
    }
  }

  function handleCopyOrder(order) {
    if (count > 0) {
      const ok = window.confirm(
        `Keranjang belanja saat ini sudah berisi ${count} item. Ganti isi keranjang dengan pesanan ${order.number}?`
      )
      if (!ok) return
    }
    loadOrderToCart(order)
    if (onToast) onToast(`Item pesanan ${order.number} disalin ke keranjang`)
    if (onNav) onNav('menu')
  }

  async function handleSyncSingle(order) {
    setSyncingId(order.id)
    try {
      await syncSingleOrder(order.id, syncOrderToServer)
      if (onToast) onToast(`Pesanan ${order.number} berhasil disinkronkan ke cloud!`)
      load()
    } catch (err) {
      if (onToast) onToast(`Gagal sinkron pesanan ${order.number}: ${err.message}`)
      load()
    } finally {
      setSyncingId(null)
    }
  }

  async function handleDiscardOffline(order) {
    const ok = window.confirm(
      `Hapus pesanan offline ${order.number} dari antrean tablet ini? Tindakan ini tidak dapat dibatalkan.`
    )
    if (!ok) return
    try {
      await discardPendingOrder(order.id)
      if (onToast) onToast(`Pesanan offline ${order.number} dihapus dari tablet`)
      load()
    } catch (err) {
      setError(err.message)
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
      ) : allOrders.length === 0 ? (
        <div className="state-box">
          <span className="material-symbols-outlined">receipt_long</span>
          <h3>Belum ada pesanan</h3>
          <p>Pesanan yang selesai akan muncul di sini.</p>
        </div>
      ) : (
        <div className="history-list">
          {allOrders.map((o, i) => {
            const isVoid = o.status === 'void'
            return (
              <motion.div
                key={o.id}
                className={`order-card ${isVoid ? 'voided' : ''} ${o.isOffline ? 'order-offline' : ''}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
              >
                <div className="order-card-top">
                  <span className="order-number">{o.number}</span>
                  <span className="order-type-tag">{o.orderType === 'dine_in' ? '🍽️ Dine In' : '🛍️ Bungkus'}{o.tableNo ? ` · Meja ${o.tableNo}` : ''}</span>
                  <span className="order-type-tag">{o.paymentMethod === 'qris' ? 'QRIS' : 'Tunai'}</span>
                  <span className={`order-status ${isVoid ? 'status-void' : o.isOffline ? 'status-offline' : ''}`}>
                    {isVoid ? 'Batal' : o.isOffline ? 'Menunggu Sync' : 'Lunas'}
                  </span>
                </div>
                {o.isOffline && o.lastError && (
                  <div className="order-offline-error">
                    <span className="material-symbols-outlined">warning</span>
                    <span>Kendala sinkronisasi: {o.lastError}</span>
                  </div>
                )}
                <p className="order-summary">{summary(o)}</p>
                <div className="order-card-bottom">
                  <span className="order-time">
                    {timeID(o.createdAt)}
                    {o.cashierName ? ` · ${o.cashierName}` : ''}
                  </span>
                  <div className="order-card-right">
                    {!isVoid ? (
                      <>
                        <button type="button" className="reprint-btn" onClick={() => onPrint(o, 'kitchen')}>
                          <span className="material-symbols-outlined">print</span>
                          Dapur
                        </button>
                        <button type="button" className="reprint-btn" onClick={() => onPrint(o, 'receipt')}>
                          <span className="material-symbols-outlined">receipt_long</span>
                          Struk
                        </button>
                        {o.isOffline ? (
                          <>
                            <button
                              type="button"
                              className="reprint-btn sync-single-btn"
                              title="Coba sinkronkan pesanan offline ini ke cloud sekarang"
                              onClick={() => handleSyncSingle(o)}
                              disabled={syncingId === o.id}
                            >
                              <span className={`material-symbols-outlined ${syncingId === o.id ? 'spin' : ''}`}>
                                {syncingId === o.id ? 'sync' : 'cloud_upload'}
                              </span>
                              {syncingId === o.id ? 'Sync...' : 'Sync Ulang'}
                            </button>
                            <button
                              type="button"
                              className="reprint-btn discard-offline-btn"
                              title="Hapus pesanan ini dari antrean offline tablet"
                              onClick={() => handleDiscardOffline(o)}
                            >
                              <span className="material-symbols-outlined">delete_outline</span>
                              Hapus
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="reprint-btn edit-order-btn"
                              title="Batalkan nota ini dan kembalikan item ke keranjang untuk diperbaiki"
                              onClick={() => handleEditOrder(o)}
                              disabled={voiding === o.id}
                            >
                              <span className="material-symbols-outlined">edit_note</span>
                              Edit
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
                      </>
                    ) : (
                      <button
                        type="button"
                        className="reprint-btn recart-btn"
                        title="Muat kembali item pesanan yang dibatalkan ini ke keranjang"
                        onClick={() => handleCopyOrder(o)}
                      >
                        <span className="material-symbols-outlined">add_shopping_cart</span>
                        Ke Keranjang
                      </button>
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
