import { motion } from 'framer-motion'
import { useShop } from '../shop'
import { rupiah } from '../lib/format'

export default function ProductCard({ product, index, onAdd }) {
  const { cart, add, remove } = useShop()
  const qty = cart[product.id]?.qty || 0
  const isBest = (product.tags || []).includes('Best Seller')
  const otherTags = (product.tags || []).filter((t) => t !== 'Best Seller').slice(0, 2)
  const soldOut = !product.available

  function handleAdd() {
    if (soldOut) return
    add(product.id)
    if (onAdd) onAdd(`${product.name} ditambahkan`)
  }

  return (
    <motion.article
      layout
      className={`card ${soldOut ? 'card-soldout' : ''}`}
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        delay: Math.min(index * 0.05, 0.4),
        type: 'spring',
        stiffness: 260,
        damping: 22,
      }}
    >
      <div
        className="card-media"
        style={{ background: `linear-gradient(135deg, ${product.color} 0%, #fff8f6 100%)` }}
      >
        {product.imageUrl ? (
          <img className="card-img" src={product.imageUrl} alt={product.name} loading="lazy" />
        ) : (
          <span className="card-emoji" aria-hidden="true">{product.emoji}</span>
        )}
        {isBest && <span className="badge-best">Terlaris</span>}
        {soldOut && <span className="badge-soldout">Habis</span>}
      </div>

      <div className="card-body">
        <div className="card-top">
          <h3>{product.name}</h3>
          <span className="price">{rupiah(product.price)}</span>
        </div>
        <p className="desc">{product.description}</p>

        {otherTags.length > 0 && (
          <div className="tags">
            {otherTags.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        )}

        {soldOut ? (
          <button type="button" className="btn btn-secondary add-btn" disabled>
            Habis
          </button>
        ) : qty === 0 ? (
          <button type="button" className="btn btn-primary add-btn" onClick={handleAdd}>
            <span className="material-symbols-outlined">add</span>
            Tambah
          </button>
        ) : (
          <div className="stepper">
            <button
              type="button"
              className="qty-btn"
              onClick={() => remove(product.id)}
              aria-label="Kurangi jumlah"
            >
              <span className="material-symbols-outlined">remove</span>
            </button>
            <motion.span
              key={qty}
              className="qty"
              initial={{ scale: 1.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              {qty}
            </motion.span>
            <button
              type="button"
              className="qty-btn qty-btn-plus"
              onClick={handleAdd}
              aria-label="Tambah jumlah"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
        )}
      </div>
    </motion.article>
  )
}
