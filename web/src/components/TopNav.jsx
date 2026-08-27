import { motion } from 'framer-motion'
import { useShop } from '../shop'

const NAV = [
  { id: 'menu', label: 'Menu', icon: 'restaurant_menu' },
  { id: 'history', label: 'Riwayat', icon: 'receipt_long' },
  { id: 'help', label: 'Bantuan', icon: 'help' },
]

const ADMIN_NAV = [{ id: 'admin', label: 'Admin', icon: 'dashboard' }]

export default function TopNav({ page, onNav, onCart }) {
  const { count, role, user, logout } = useShop()
  const items = role === 'admin' ? [...NAV, ...ADMIN_NAV] : NAV

  return (
    <header className="topnav">
      <div className="brand">
        <span className="logo" aria-hidden="true">KK</span>
        <span className="brand-name">Kedai Koko</span>
      </div>

      <nav className="nav-links">
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`nav-item ${page === n.id ? 'active' : ''}`}
            onClick={() => onNav(n.id)}
          >
            <span className="material-symbols-outlined">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="nav-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={onCart}
          aria-label="Lihat keranjang"
        >
          <span className="material-symbols-outlined">shopping_cart</span>
          {count > 0 && (
            <motion.span
              key={count}
              className="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >
              {count}
            </motion.span>
          )}
        </button>

        <div className="user-chip">
          <span className="material-symbols-outlined">person</span>
          <span className="user-role">{user?.name || (role === 'admin' ? 'Admin' : 'Kasir')}</span>
        </div>
        <button
          type="button"
          className="icon-btn icon-btn-logout"
          onClick={logout}
          aria-label="Keluar"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </header>
  )
}
