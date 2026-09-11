import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useShop } from '../shop'

const NAV = [
  { id: 'menu', label: 'Menu', icon: 'restaurant_menu' },
  { id: 'history', label: 'Riwayat', icon: 'receipt_long' },
  { id: 'help', label: 'Bantuan', icon: 'help' },
]

const ADMIN_NAV = [{ id: 'admin', label: 'Admin', icon: 'dashboard' }]

export default function TopNav({ page, onNav, onCart, onPrinter }) {
  const {
    count,
    role,
    user,
    logout,
    isOnline,
    pendingSyncCount,
    isSyncing,
    triggerSyncNow,
  } = useShop()
  const items = role === 'admin' ? [...NAV, ...ADMIN_NAV] : NAV
  const [installPrompt, setInstallPrompt] = useState(null)

  useEffect(() => {
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone)
    if (isStandalone) return

    const handlePrompt = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
    }
  }

  return (
    <header className="topnav">
      <div className="brand">
        <img src="/pwa-192x192.png" alt="Kedai Koko" className="nav-logo-img" />
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
        {pendingSyncCount > 0 && (
          <button
            type="button"
            className={`connection-chip sync-pending ${isSyncing ? 'syncing' : ''}`}
            onClick={triggerSyncNow}
            disabled={isSyncing}
            title="Klik untuk menyinkronkan transaksi offline ke cloud sekarang"
          >
            <span className="material-symbols-outlined sync-icon">{isSyncing ? 'sync' : 'cloud_upload'}</span>
            <span>{isSyncing ? 'Menyinkronkan...' : `${pendingSyncCount} Belum Sync`}</span>
          </button>
        )}

        {!isOnline ? (
          <div className="connection-chip offline" title="Aplikasi sedang offline. Transaksi tetap berjalan normal & tersimpan lokal.">
            <span className="status-dot dot-offline" />
            <span className="conn-label">Offline</span>
          </div>
        ) : pendingSyncCount === 0 ? (
          <div className="connection-chip online" title="Terhubung ke cloud database">
            <span className="status-dot dot-online" />
            <span className="conn-label">Online</span>
          </div>
        ) : null}

        {installPrompt && (
          <button
            type="button"
            className="btn btn-secondary install-app-btn"
            onClick={handleInstall}
            title="Pasang aplikasi ke layar tablet"
          >
            <span className="material-symbols-outlined">install_mobile</span>
            <span className="install-label">Pasang App</span>
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={onPrinter}
          aria-label="Pengaturan printer"
        >
          <span className="material-symbols-outlined">print</span>
        </button>
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
