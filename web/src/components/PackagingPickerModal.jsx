import { motion } from 'framer-motion'

function getPackagingEmoji(name = '') {
  const lower = name.toLowerCase()
  if (lower.includes('bowl') || lower.includes('mangkuk')) return '🥣'
  if (lower.includes('gelas') || lower.includes('cup') || lower.includes('minum')) return '🥤'
  if (lower.includes('bag') || lower.includes('kantong') || lower.includes('plastik')) return '🛍️'
  if (lower.includes('box') || lower.includes('kotak') || lower.includes('nasi')) return '🍱'
  if (lower.includes('mika') || lower.includes('kue')) return '🧁'
  return '📦'
}

export default function PackagingPickerModal({ packagings = [], isDineIn = true, fee = 0, onSelect, onClose }) {
  const list =
    packagings.length > 0
      ? packagings
      : [
          { id: 'paper-bowl', name: 'Paper Bowl', stock: 50 },
          { id: 'gelas', name: 'Gelas Plastik', stock: 50 },
        ]

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal packaging-picker-card"
        style={{ background: '#ffffff', backgroundColor: '#ffffff' }}
        initial={{ y: 30, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 20, scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '18px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                inventory_2
              </span>
              Pilih Jenis Kemasan
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
              {isDineIn
                ? 'Wadah gratis untuk bungkus sisa makanan tamu'
                : `Dikenakan biaya Rp${fee.toLocaleString('id-ID')} per wadah`}
            </p>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="packaging-picker-body">
          <div className="packaging-picker-grid">
            {list.map((pkg) => {
              const emoji = getPackagingEmoji(pkg.name)

              return (
                <button
                  key={pkg.id}
                  type="button"
                  className="pkg-pick-item"
                  onClick={() => {
                    onSelect(pkg)
                    onClose()
                  }}
                >
                  <div className="pkg-pick-emoji" aria-hidden="true">
                    {emoji}
                  </div>
                  <div className="pkg-pick-info">
                    <span className="pkg-pick-name">{pkg.name}</span>
                    <div className="pkg-pick-meta">
                      <span className={`pkg-stock-badge ${pkg.stock <= 10 ? 'low' : ''}`}>
                        Stok: {pkg.stock} pcs
                      </span>
                      <span className={`pkg-price-badge ${isDineIn ? 'free' : ''}`}>
                        {isDineIn ? 'GRATIS' : `+Rp${fee.toLocaleString('id-ID')}`}
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined pkg-pick-arrow">add_circle</span>
                </button>
              )
            })}
          </div>

          <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: 4, padding: 0 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Batal
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
