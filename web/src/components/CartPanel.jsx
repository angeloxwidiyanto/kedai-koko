import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useShop } from '../shop'
import { rupiah } from '../lib/format'

const NOTE_PRESETS = ['Kurang gula', 'Tanpa gula', 'Tanpa es', 'Es banyak', 'Pedas', 'Tidak pedas']

function NoteEditor({ item }) {
  const { setNote } = useShop()
  const [open, setOpen] = useState(false)
  const note = item.note || ''
  const itemId = item.cartItemId || item.id

  if (!open) {
    return (
      <button
        type="button"
        className={`note-toggle ${note ? 'has-note' : ''}`}
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-outlined">edit_note</span>
        <span>{note ? note : 'Tambah catatan'}</span>
      </button>
    )
  }

  return (
    <div className="note-editor">
      <div className="note-chips">
        {NOTE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`note-chip ${note === p ? 'active' : ''}`}
            onClick={() => setNote(itemId, note === p ? '' : p)}
          >
            {p}
          </button>
        ))}
      </div>
      <input
        className="note-input"
        value={note}
        onChange={(e) => setNote(itemId, e.target.value)}
        placeholder="Contoh: tanpa gula, tanpa es"
        aria-label="Catatan pesanan"
        autoFocus
      />
      <div className="note-actions">
        <button type="button" className="note-done" onClick={() => setOpen(false)}>
          Selesai
        </button>
      </div>
    </div>
  )
}

export default function CartPanel({ onCheckout }) {
  const { cartItems, count, subtotal, updateQty, splitItem } = useShop()

  return (
    <aside className="cart-panel">
      <div className="cart-head">
        <h2>Pesanan</h2>
        <span className="count-pill">{count} item</span>
      </div>

      <div className="cart-list">
        {cartItems.length === 0 ? (
          <div className="cart-empty">
            <span className="material-symbols-outlined">shopping_basket</span>
            <p>Keranjang masih kosong</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {cartItems.map((item) => (
              <motion.div
                key={item.cartItemId || item.id}
                layout
                className="cart-item"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="cart-emoji" style={{ background: item.color }} aria-hidden="true">
                  {item.emoji}
                </div>
                <div className="cart-info">
                  <h4>{item.name}</h4>
                  <span className="cart-price">{rupiah(item.price)}</span>
                  <div className="cart-controls-row">
                    <div className="mini-stepper">
                      <button
                        type="button"
                        onClick={() => updateQty(item.cartItemId, -1)}
                        aria-label="Kurangi"
                      >
                        <span className="material-symbols-outlined">remove</span>
                      </button>
                      <span>{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.cartItemId, 1)}
                        aria-label="Tambah"
                      >
                        <span className="material-symbols-outlined">add</span>
                      </button>
                    </div>

                    {item.qty > 1 && (
                      <button
                        type="button"
                        className="split-btn"
                        onClick={() => splitItem(item.cartItemId)}
                        title="Pisahkan 1 porsi untuk varian atau catatan berbeda"
                      >
                        <span className="material-symbols-outlined">call_split</span>
                        <span>Pisah catatan</span>
                      </button>
                    )}
                  </div>
                  <NoteEditor item={item} />
                </div>
                <span className="cart-line-total">{rupiah(item.price * item.qty)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="cart-totals">
        <div className="row">
          <span>Total</span>
          <span className="grand">{rupiah(subtotal)}</span>
        </div>
        <button
          type="button"
          className="btn btn-dark complete-btn"
          onClick={onCheckout}
          disabled={count === 0}
        >
          Selesaikan Pesanan
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </aside>
  )
}
