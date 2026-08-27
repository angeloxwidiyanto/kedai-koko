import { motion } from 'framer-motion'
import { useShop } from '../shop'
import { rupiah } from '../lib/format'

export default function MobileBar({ onCheckout }) {
  const { count, subtotal } = useShop()

  if (count === 0) return null

  return (
    <motion.div
      className="mobile-bar"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
    >
      <div>
        <p className="m-count">{count} item dipilih</p>
        <p className="m-total">{rupiah(subtotal)}</p>
      </div>
      <button type="button" className="btn btn-dark" onClick={onCheckout}>
        Selesaikan
      </button>
    </motion.div>
  )
}
