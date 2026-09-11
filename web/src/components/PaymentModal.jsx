import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useShop } from '../shop'
import { rupiah } from '../lib/format'
import { calcDiscount } from '../lib/discount'
import { createOrder, getPackagingStock } from '../lib/api'

const QUICK = [
  { label: 'Uang Pas', value: null },
  { label: 'Rp20.000', value: 20000 },
  { label: 'Rp50.000', value: 50000 },
  { label: 'Rp100.000', value: 100000 },
]

export default function PaymentModal({ onClose, onDone }) {
  const { cartItems, subtotal, clear, orderType, tableNo } = useShop()
  const [discType, setDiscType] = useState('')
  const [discValue, setDiscValue] = useState(0)
  const [paid, setPaid] = useState(subtotal)
  const [payMethod, setPayMethod] = useState('tunai')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [packStock, setPackStock] = useState(null)

  useEffect(() => {
    if (orderType !== 'take_away') return
    getPackagingStock()
      .then((d) => setPackStock(d.stock))
      .catch(() => setPackStock(null))
  }, [orderType])

  const totalQty = useMemo(() => cartItems.reduce((s, i) => s + i.qty, 0), [cartItems])

  const discountAmount = useMemo(
    () => calcDiscount(subtotal, discType, discValue),
    [discType, discValue, subtotal]
  )

  const total = Math.max(0, subtotal - discountAmount)
  const change = payMethod === 'qris' ? 0 : paid - total
  const packagingOk = orderType !== 'take_away' || packStock === null || packStock >= totalQty
  const canPay = total > 0 && (payMethod === 'qris' ? true : change >= 0) && packagingOk && !!orderType && (orderType !== 'dine_in' || !!tableNo.trim())

  function pick(value) {
    setErr(null)
    setPaid(value == null ? total : value)
  }

  function applyDisc(type, value) {
    setDiscType(type)
    setDiscValue(value)
    setPaid(subtotal - calcDiscount(subtotal, type, value))
  }

  async function confirm() {
    if (!canPay || saving) return
    setSaving(true)
    setErr(null)
    try {
      const order = await createOrder({
        items: cartItems.map((i) => ({ productId: i.id, qty: i.qty, note: i.note || '' })),
        paid,
        paymentMethod: payMethod,
        orderType,
        tableNo: orderType === 'dine_in' ? tableNo.trim() : '',
        discountType: discType || '',
        discountValue: discValue || 0,
      })
      clear()
      onDone(order)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal"
        initial={{ y: 60, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="modal-head">
          <h2>Pembayaran</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="order-type-summary">
          <span className="material-symbols-outlined">
            {orderType === 'dine_in' ? 'restaurant' : 'shopping_bag'}
          </span>
          <span>
            {orderType === 'dine_in' ? 'Makan di Tempat' : 'Bungkus'}
            {orderType === 'dine_in' && tableNo ? ` · Meja ${tableNo}` : ''}
          </span>
        </div>

        {orderType === 'take_away' && packStock !== null && (
          <div className={`packaging-note ${packStock < totalQty ? 'short' : ''}`}>
            <span className="material-symbols-outlined">inventory_2</span>
            <span>
              {packStock < totalQty
                ? `Stok kemasan kurang (butuh ${totalQty}, sisa ${packStock})`
                : `Stok kemasan cukup (${packStock} tersisa)`}
            </span>
          </div>
        )}

        <div className="modal-items">
          {cartItems.map((item) => (
            <div key={item.cartItemId || item.id} className="pay-item">
              <span className="pay-emoji" style={{ background: item.color }} aria-hidden="true">
                {item.emoji}
              </span>
              <span className="pay-name">
                {item.name}
                {item.note ? <span className="pay-note">{item.note}</span> : null}
              </span>
              <span className="pay-qty">x{item.qty}</span>
              <span className="pay-sub">{rupiah(item.price * item.qty)}</span>
            </div>
          ))}
        </div>

        <div className="disc-row">
          <div className="disc-toggle">
            <button
              type="button"
              className={`chip ${discType === 'pct' ? 'active' : ''}`}
              onClick={() => applyDisc('pct', discValue)}
            >
              %
            </button>
            <button
              type="button"
              className={`chip ${discType === 'amt' ? 'active' : ''}`}
              onClick={() => applyDisc('amt', discValue)}
            >
              Rp
            </button>
          </div>
          <input
            className="disc-input"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Diskon"
            value={discValue || ''}
            onChange={(e) => {
              const v = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value))
              setDiscValue(v)
              setDiscType(discType || 'amt')
            }}
            aria-label="Diskon"
          />
          {discountAmount > 0 && (
            <button type="button" className="mini-action danger" onClick={() => { setDiscType(''); setDiscValue(0); setPaid(subtotal) }} aria-label="Hapus diskon">
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <div className="pay-total">
          <span>Subtotal</span>
          <span>{rupiah(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="pay-total pay-discount">
            <span>Diskon</span>
            <span>-{rupiah(discountAmount)}</span>
          </div>
        )}
        <div className="pay-total pay-grand">
          <span>Total</span>
          <motion.span key={total} initial={{ scale: 1.15 }} animate={{ scale: 1 }}>
            {rupiah(total)}
          </motion.span>
        </div>

        <div className="pay-method">
          <button
            type="button"
            className={`pay-method-btn ${payMethod === 'tunai' ? 'active' : ''}`}
            onClick={() => setPayMethod('tunai')}
          >
            <span className="material-symbols-outlined">payments</span>
            Tunai
          </button>
          <button
            type="button"
            className={`pay-method-btn ${payMethod === 'qris' ? 'active' : ''}`}
            onClick={() => setPayMethod('qris')}
          >
            <span className="material-symbols-outlined">qr_code_2</span>
            QRIS
          </button>
        </div>

        {payMethod === 'tunai' && (
        <div className="pay-options">
          <label className="pay-label" htmlFor="paid-input">Dibayar</label>
          <div className="quick-row">
            {QUICK.map((q) => (
              <button
                key={q.label}
                type="button"
                className={`quick-btn ${paid === (q.value == null ? total : q.value) ? 'active' : ''}`}
                onClick={() => pick(q.value)}
              >
                {q.label}
              </button>
            ))}
          </div>
          <input
            id="paid-input"
            className="paid-input"
            type="number"
            inputMode="numeric"
            min="0"
            value={paid}
            onChange={(e) => {
              setErr(null)
              setPaid(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))
            }}
          />
        </div>
        )}

        <div className={`change-box ${change >= 0 ? '' : 'short'}`}>
          {payMethod === 'qris' ? (
            <>
              <span>Pembayaran QRIS</span>
              <span>{rupiah(total)}</span>
            </>
          ) : change >= 0 ? (
            <>
              <span>Kembalian</span>
              <motion.span key={change} initial={{ scale: 1.2 }} animate={{ scale: 1 }}>
                {rupiah(change)}
              </motion.span>
            </>
          ) : (
            <>
              <span>Masih kurang</span>
              <span>{rupiah(-change)}</span>
            </>
          )}
        </div>

        {err && <p className="form-error">{err}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirm}
            disabled={!canPay || saving}
          >
            {saving ? 'Menyimpan...' : 'Konfirmasi'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
