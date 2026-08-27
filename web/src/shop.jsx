import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getCategories, getProducts, getMe, hasAuthToken, setAuthToken, login as apiLogin } from './lib/api'

const ShopContext = createContext(null)

const CART_KEY = 'kedai-koko-cart'
const IDLE_TIMEOUT = 5 * 60 * 1000

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
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

  const idleTimer = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch {
      /* ignore */
    }
  }, [cart])

  useEffect(() => {
    if (!hasAuthToken()) {
      setAuthRequired(true)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)
    Promise.all([getProducts(), getCategories(), getMe()])
      .then(([p, c, me]) => {
        if (!active) return
        setProducts(p)
        setCategories(c)
        setUser(me)
        setAuthRequired(false)
      })
      .catch((e) => {
        if (!active) return
        if (e.status === 401) setAuthRequired(true)
        else setError(e.message)
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

  const add = useCallback((id) => {
    setCart((prev) => {
      const cur = prev[id] || { qty: 0, note: '' }
      return { ...prev, [id]: { qty: cur.qty + 1, note: cur.note } }
    })
  }, [])

  const remove = useCallback((id) => {
    setCart((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      const next = { ...prev }
      const qty = cur.qty - 1
      if (qty <= 0) delete next[id]
      else next[id] = { ...cur, qty }
      return next
    })
  }, [])

  const setNote = useCallback((id, note) => {
    setCart((prev) => {
      if (!prev[id]) return prev
      return { ...prev, [id]: { ...prev[id], note } }
    })
  }, [])

  const clear = useCallback(() => {
    setCart({})
    setOrderType(null)
    setTableNo('')
  }, [])

  const cartItems = useMemo(
    () =>
      products
        .filter((p) => (cart[p.id]?.qty || 0) > 0)
        .map((p) => ({ ...p, qty: cart[p.id].qty, note: cart[p.id].note || '' })),
    [products, cart]
  )

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
    remove,
    setNote,
    clear,
    orderType,
    setOrderType,
    tableNo,
    setTableNo,
    cartItems,
    count,
    subtotal,
  }

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop() {
  return useContext(ShopContext)
}
