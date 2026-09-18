import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getCategories, getProducts, getMe, hasAuthToken, setAuthToken, login as apiLogin, syncOrderToServer, getPackagingFee } from './lib/api'
import {
  cacheCatalog,
  getCachedCatalog,
  getPendingCount,
  syncPendingOrders,
  subscribeSync,
} from './lib/offlineSync'

const ShopContext = createContext(null)

const CART_KEY = 'kedai-koko-cart'
const IDLE_TIMEOUT = 5 * 60 * 1000

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const normalized = {}
    for (const [key, val] of Object.entries(parsed)) {
      if (!val || typeof val !== 'object') continue
      const cartItemId = val.cartItemId || key
      const productId = val.productId || key
      const qty = Number(val.qty) || 0
      const note = String(val.note || '')
      if (qty > 0) {
        normalized[cartItemId] = { cartItemId, productId, qty, note }
      }
    }
    return normalized
  } catch {
    return {}
  }
}

export function ShopProvider({ children }) {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [user, setUser] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [cart, setCart] = useState(loadCart)
  const [orderType, setOrderType] = useState(null)
  const [tableNo, setTableNo] = useState('')
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [packagingFee, setPackagingFee] = useState(2000)

  const idleTimer = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch {
      /* ignore */
    }
  }, [cart])

  // Sync count listener
  useEffect(() => {
    getPendingCount().then(setPendingSyncCount)
    const unsub = subscribeSync(() => {
      getPendingCount().then(setPendingSyncCount)
    })
    return unsub
  }, [])

  const triggerSyncNow = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { error: 'Sedang offline' }
    }
    setIsSyncing(true)
    try {
      return await syncPendingOrders(syncOrderToServer)
    } finally {
      setIsSyncing(false)
      getPendingCount().then(setPendingSyncCount)
    }
  }, [])

  // Auto-sync listener saat online kembali
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      triggerSyncNow()
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const interval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        getPendingCount().then((cnt) => {
          setPendingSyncCount(cnt)
          if (cnt > 0) triggerSyncNow()
        })
      }
    }, 20000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [triggerSyncNow])

  useEffect(() => {
    if (!hasAuthToken()) {
      setAuthRequired(true)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)
    Promise.all([getProducts(), getCategories(), getMe(), getPackagingFee().catch(() => ({ fee: 2000 }))])
      .then(([p, c, me, feeResp]) => {
        if (!active) return
        setProducts(p)
        setCategories(c)
        setUser(me)
        setAuthRequired(false)
        if (feeResp?.fee != null) setPackagingFee(feeResp.fee)
        cacheCatalog(p, c, me)
      })
      .catch(async (e) => {
        if (!active) return
        if (e.status === 401) {
          setAuthRequired(true)
          return
        }
        // Fallback offline: gunakan data katalog dari cache IndexedDB
        const cached = await getCachedCatalog()
        if (cached.products && cached.products.length > 0) {
          setProducts(cached.products)
          setCategories(cached.categories || [])
          if (cached.user) setUser(cached.user)
          setAuthRequired(false)
          setError(null)
        } else {
          setError(e.message)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const logout = useCallback(() => {
    setAuthToken('')
    setUser(null)
    setAuthRequired(true)
  }, [])

  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      if (sessionStorage.getItem('kk-token')) logout()
    }, IDLE_TIMEOUT)
  }, [logout])

  useEffect(() => {
    if (!user) return
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'click']
    events.forEach((e) => window.addEventListener(e, resetIdle))
    resetIdle()
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle))
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [user, resetIdle])

  const login = useCallback(async (userId, pin) => {
    const { token, user: u } = await apiLogin(userId, pin)
    setAuthToken(token)
    setUser(u)
    setAuthRequired(false)
    setReloadKey((k) => k + 1)
    return u
  }, [])

  const role = user?.role || null
  const roleLabel = role === 'admin' ? 'Admin' : 'Kasir'

  const add = useCallback((productId) => {
    setCart((prev) => {
      // Cari apakah ada baris produk ini yang catatannya MASIH KOSONG
      const emptyNoteEntry = Object.values(prev).find(
        (it) => it.productId === productId && !it.note
      )
      if (emptyNoteEntry) {
        return {
          ...prev,
          [emptyNoteEntry.cartItemId]: {
            ...emptyNoteEntry,
            qty: emptyNoteEntry.qty + 1,
          },
        }
      }
      // Jika semua baris sudah ada catatan atau belum ada, buat baris baru
      const cartItemId = `${productId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      return {
        ...prev,
        [cartItemId]: {
          cartItemId,
          productId,
          qty: 1,
          note: '',
        },
      }
    })
  }, [])

  // Tambah kemasan cepat (quick packaging)
  // dine-in → gratis (Rp0, tracking only)
  // take-away → kena packagingFee
  const addQuickPackaging = useCallback((qty = 1, overridePrice = null) => {
    const productId = '__quick_packaging__'
    setCart((prev) => {
      const existing = Object.values(prev).find((it) => it.productId === productId)
      if (existing) {
        return {
          ...prev,
          [existing.cartItemId]: {
            ...existing,
            qty: existing.qty + qty,
          },
        }
      }
      const cartItemId = `${productId}_${Date.now()}`
      return {
        ...prev,
        [cartItemId]: {
          cartItemId,
          productId,
          qty,
          note: '',
          isQuickPackaging: true,
          overridePrice,  // null = gunakan packagingFee, 0 = gratis
        },
      }
    })
  }, [])

  const remove = useCallback((productId) => {
    setCart((prev) => {
      const matching = Object.values(prev).filter((it) => it.productId === productId)
      if (matching.length === 0) return prev
      // Kurangi baris yang belum memiliki catatan terlebih dahulu, atau baris terakhir
      const target = matching.find((it) => !it.note) || matching[matching.length - 1]
      const next = { ...prev }
      if (target.qty <= 1) {
        delete next[target.cartItemId]
      } else {
        next[target.cartItemId] = { ...target, qty: target.qty - 1 }
      }
      return next
    })
  }, [])

  // Modifikasi kuantitas spesifik per baris di keranjang
  const updateQty = useCallback((cartItemId, delta) => {
    setCart((prev) => {
      const cur = prev[cartItemId]
      if (!cur) return prev
      const next = { ...prev }
      const newQty = cur.qty + delta
      if (newQty <= 0) {
        delete next[cartItemId]
      } else {
        next[cartItemId] = { ...cur, qty: newQty }
      }
      return next
    })
  }, [])

  // Memecah 1 porsi dari baris yang ada menjadi baris baru untuk catatan berbeda
  const splitItem = useCallback((cartItemId) => {
    setCart((prev) => {
      const cur = prev[cartItemId]
      if (!cur || cur.qty <= 1) return prev
      const next = { ...prev }
      next[cartItemId] = { ...cur, qty: cur.qty - 1 }
      const newId = `${cur.productId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      next[newId] = {
        cartItemId: newId,
        productId: cur.productId,
        qty: 1,
        note: '',
      }
      return next
    })
  }, [])

  const setNote = useCallback((cartItemId, note) => {
    setCart((prev) => {
      if (!prev[cartItemId]) return prev
      return { ...prev, [cartItemId]: { ...prev[cartItemId], note } }
    })
  }, [])

  const clear = useCallback(() => {
    setCart({})
    setOrderType(null)
    setTableNo('')
  }, [])

  const loadOrderToCart = useCallback((order) => {
    if (!order || !Array.isArray(order.items) || order.items.length === 0) return false
    const nextCart = {}
    order.items.forEach((it, idx) => {
      const pId = it.productId
      const cartItemId = `${pId}_${Date.now()}_${idx}`
      nextCart[cartItemId] = {
        cartItemId,
        productId: pId,
        qty: Number(it.qty) || 1,
        note: it.note || '',
      }
    })
    setCart(nextCart)
    if (order.orderType) {
      setOrderType(order.orderType)
    }
    setTableNo(order.tableNo || '')
    return true
  }, [])

  const getProductQty = useCallback(
    (productId) =>
      Object.values(cart)
        .filter((it) => it.productId === productId)
        .reduce((sum, it) => sum + it.qty, 0),
    [cart]
  )

  const cartItems = useMemo(() => {
    const pMap = new Map(products.map((p) => [p.id, p]))
    const regularItems = Object.values(cart)
      .filter((it) => it.qty > 0 && pMap.has(it.productId))
      .map((it) => {
        const p = pMap.get(it.productId)
        return {
          ...p,
          cartItemId: it.cartItemId,
          qty: it.qty,
          note: it.note || '',
        }
      })
    // Synthetic quick packaging items (tidak ada di catalog products)
    const quickItems = Object.values(cart)
      .filter((it) => it.qty > 0 && it.isQuickPackaging)
      .map((it) => {
        const isFree = orderType === 'dine_in'
        const effectivePrice = isFree ? 0 : packagingFee
        return {
          id: it.productId,
          cartItemId: it.cartItemId,
          name: isFree ? 'Kemasan Tambahan (Gratis)' : 'Kemasan Tambahan',
          price: effectivePrice,
          qty: it.qty,
          note: it.note || '',
          isQuickPackaging: true,
          isFreePackaging: isFree,
          emoji: '📦',
        }
      })
    return [...regularItems, ...quickItems]
  }, [products, cart, packagingFee, orderType])

  const count = useMemo(() => cartItems.reduce((s, i) => s + i.qty, 0), [cartItems])
  const subtotal = useMemo(() => cartItems.reduce((s, i) => s + i.qty * i.price, 0), [cartItems])

  const value = {
    products,
    categories,
    loading,
    error,
    authRequired,
    user,
    role,
    roleLabel,
    login,
    logout,
    cart,
    add,
    addQuickPackaging,
    remove,
    updateQty,
    splitItem,
    setNote,
    getProductQty,
    clear,
    loadOrderToCart,
    orderType,
    setOrderType,
    tableNo,
    setTableNo,
    cartItems,
    count,
    subtotal,
    packagingFee,
    isOnline,
    pendingSyncCount,
    isSyncing,
    triggerSyncNow,
  }

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop() {
  return useContext(ShopContext)
}
