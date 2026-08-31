import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ShopProvider, useShop } from './shop'
import TopNav from './components/TopNav'
import MenuPage from './components/MenuPage'
import HistoryPage from './components/HistoryPage'
import HelpPage from './components/HelpPage'
import AdminPage from './components/AdminPage'
import PaymentModal from './components/PaymentModal'
import SuccessOverlay from './components/SuccessOverlay'
import PrintTicket from './components/PrintTicket'
import PrinterModal from './components/PrinterModal'
import LoginGate from './components/LoginGate'
import Toast from './components/Toast'
import * as printer from './lib/printer'
import * as escpos from './lib/escpos'

function Shell() {
  const { count, orderType, role, authRequired, login } = useShop()
  const [page, setPage] = useState('menu')
  const [payOpen, setPayOpen] = useState(false)
  const [success, setSuccess] = useState(null)
  const [printState, setPrintState] = useState(null)
  const [toast, setToast] = useState(null)
  const [printerOpen, setPrinterOpen] = useState(false)
  const [printerConnected, setPrinterConnected] = useState(false)

  function showToast(message) {
    setToast({ id: Date.now(), message })
  }

  // Reset halaman saat logout
  useEffect(() => {
    if (authRequired) setPage('menu')
  }, [authRequired])

  // Guard: non-admin tidak boleh berada di halaman admin
  useEffect(() => {
    if (role && role !== 'admin' && page === 'admin') setPage('menu')
  }, [role, page])

  // Setelah login, arahkan sesuai role
  async function handleLogin(userId, pin) {
    const u = await login(userId, pin)
    setPage(u?.role === 'admin' ? 'admin' : 'menu')
  }

  function handleDone(order) {
    setPayOpen(false)
    setSuccess(order)
    handlePrint(order, 'kitchen')
  }

  function handleSuccessClose() {
    setSuccess(null)
    setPage('menu')
  }

  const handlePrint = useCallback(async (order, kind = 'kitchen') => {
    if (printerConnected) {
      try {
        const data = kind === 'receipt' ? escpos.receipt(order) : escpos.kitchenTicket(order)
        await printer.print(data)
        showToast('Tercetak')
      } catch {
        setPrintState({ order, kind }) // fallback browser print
      }
      return
    }
    setPrintState({ order, kind })
  }, [printerConnected])

  useEffect(() => {
    if (!printState) return

    const onAfterPrint = () => setPrintState(null)
    window.addEventListener('afterprint', onAfterPrint)

    const timer = setTimeout(() => window.print(), 120)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [printState])

  useEffect(() => {
    const unsub = printer.subscribe((dev) => setPrinterConnected(!!dev))
    if (printer.isSupported()) printer.autoReconnect()
    return unsub
  }, [])

  function handleCartClick() {
    if (count === 0) {
      showToast('Keranjang masih kosong')
    } else if (!orderType) {
      showToast('Pilih jenis pesanan dulu (Makan di Tempat / Bungkus)')
    } else {
      setPayOpen(true)
    }
  }

  function handleCheckout() {
    if (!orderType) {
      showToast('Pilih jenis pesanan dulu (Makan di Tempat / Bungkus)')
      return
    }
    setPayOpen(true)
  }

  return (
    <div className="app">
      {authRequired && <LoginGate onLogin={handleLogin} />}

      <TopNav page={page} onNav={setPage} onCart={handleCartClick} onPrinter={() => setPrinterOpen(true)} />

      {printer.isSupported() && !printerConnected && !authRequired && (
        <button
          type="button"
          className="printer-banner"
          onClick={() => setPrinterOpen(true)}
        >
          <span className="material-symbols-outlined">print</span>
          Sambungkan printer
        </button>
      )}

      <AnimatePresence mode="wait">
        <motion.main
          key={page}
          className="page"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22 }}
        >
          {page === 'menu' && (
            <MenuPage onCheckout={handleCheckout} onToast={showToast} />
          )}
          {page === 'history' && <HistoryPage onPrint={handlePrint} />}
          {page === 'help' && <HelpPage />}
          {page === 'admin' && <AdminPage onToast={showToast} />}
        </motion.main>
      </AnimatePresence>

      <AnimatePresence>
        {payOpen && (
          <PaymentModal onClose={() => setPayOpen(false)} onDone={handleDone} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {success && (
          <SuccessOverlay
            order={success}
            onClose={handleSuccessClose}
            onPrint={handlePrint}
          />
        )}
      </AnimatePresence>

      <PrintTicket order={printState?.order} kind={printState?.kind} />

      <PrinterModal open={printerOpen} onClose={() => setPrinterOpen(false)} />

      <AnimatePresence>
        {toast && (
          <Toast
            key={toast.id}
            message={toast.message}
            onDone={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <ShopProvider>
      <Shell />
    </ShopProvider>
  )
}