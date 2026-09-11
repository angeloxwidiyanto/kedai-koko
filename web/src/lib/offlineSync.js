// Offline-First IndexedDB Persistence & Sync Manager for Kedai Koko POS

const DB_NAME = 'kedai_koko_pos_db'
const DB_VERSION = 1
const STORE_PENDING = 'pending_orders'
const STORE_CATALOG = 'catalog_cache'
const SEQ_KEY = 'kk-offline-order-seq'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB tidak didukung'))
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const os = db.createObjectStore(STORE_PENDING, { keyPath: 'id' })
        os.createIndex('status', 'status', { unique: false })
        os.createIndex('createdAt', 'createdAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_CATALOG)) {
        db.createObjectStore(STORE_CATALOG, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

// Sync event listeners
const syncListeners = new Set()

export function subscribeSync(fn) {
  syncListeners.add(fn)
  return () => syncListeners.delete(fn)
}

function notifySync(detail) {
  syncListeners.forEach((fn) => {
    try {
      fn(detail)
    } catch (e) {
      console.error('[offlineSync] listener error:', e)
    }
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kk-sync-change', { detail }))
  }
}

// Next local offline sequential number: OFF-001, OFF-002, etc.
function getNextOfflineSeq() {
  try {
    const curr = parseInt(localStorage.getItem(SEQ_KEY) || '0', 10)
    const next = curr + 1
    localStorage.setItem(SEQ_KEY, String(next))
    return `OFF-${String(next).padStart(3, '0')}`
  } catch {
    return `OFF-${Date.now().toString().slice(-4)}`
  }
}

function calcDiscount(subtotal, type, val) {
  if (!type || !val || val <= 0) return 0
  if (type === 'percent') {
    const p = Math.min(100, Math.max(0, val))
    return Math.floor((subtotal * p) / 100)
  }
  if (type === 'nominal') {
    return Math.min(subtotal, Math.max(0, val))
  }
  return 0
}

/**
 * Menyimpan transaksi saat offline ke IndexedDB dan mengembalikan Order object untuk struk.
 */
export async function saveOfflineOrder(payload, cashier, catalogProducts = []) {
  const db = await openDB()
  const prodMap = new Map((catalogProducts || []).map((p) => [p.id, p]))

  let subtotal = 0
  const enrichedItems = (payload.items || []).map((it) => {
    const p = prodMap.get(it.productId) || {}
    const price = p.price || it.price || 0
    subtotal += price * (it.qty || 1)
    return {
      productId: it.productId,
      name: p.name || it.name || 'Item',
      emoji: p.emoji || it.emoji || '☕',
      price: price,
      qty: it.qty || 1,
      note: it.note || '',
    }
  })

  const discount = calcDiscount(subtotal, payload.discountType, payload.discountValue)
  const total = Math.max(0, subtotal - discount)
  const paid = payload.paymentMethod === 'qris' ? total : (payload.paid || total)
  const change = Math.max(0, paid - total)
  const now = new Date()
  const nowISO = now.toISOString()
  const id = `off-ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const offlineNumber = getNextOfflineSeq()

  const orderObj = {
    id,
    number: offlineNumber,
    isOffline: true,
    orderType: payload.orderType || 'take_away',
    tableNo: payload.tableNo || '',
    items: enrichedItems,
    subtotal,
    discountType: payload.discountType || '',
    discountValue: payload.discountValue || 0,
    discountAmount: discount,
    total,
    paid,
    change,
    paymentMethod: payload.paymentMethod || 'tunai',
    status: 'paid',
    cashierId: cashier?.id || '',
    cashierName: cashier?.name || 'Kasir',
    createdAt: nowISO,
  }

  const record = {
    id,
    tempNumber: offlineNumber,
    payload: {
      items: payload.items.map((i) => ({ productId: i.productId, qty: i.qty, note: i.note || '' })),
      paid,
      paymentMethod: payload.paymentMethod,
      orderType: payload.orderType,
      tableNo: payload.tableNo,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      clientOrderId: id,
      createdAt: nowISO,
    },
    order: orderObj,
    status: 'pending',
    createdAt: nowISO,
    retryCount: 0,
    lastError: null,
  }

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite')
    tx.objectStore(STORE_PENDING).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  notifySync({ type: 'order_added', order: orderObj })
  return orderObj
}

/**
 * Mengambil seluruh pesanan yang belum tersinkronisasi.
 */
export async function getPendingOrders() {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readonly')
      const req = tx.objectStore(STORE_PENDING).getAll()
      req.onsuccess = () => {
        const list = (req.result || [])
          .filter((item) => item.status === 'pending' || item.status === 'failed')
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        resolve(list)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

/**
 * Mengambil jumlah pesanan yang menunggu sinkronisasi.
 */
export async function getPendingCount() {
  try {
    const list = await getPendingOrders()
    return list.length
  } catch {
    return 0
  }
}

/**
 * Hapus pesanan dari antrean IndexedDB setelah berhasil tersinkron ke cloud.
 */
export async function removePendingOrder(id) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readwrite')
      tx.objectStore(STORE_PENDING).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    notifySync({ type: 'order_synced', id })
  } catch (e) {
    console.error('[offlineSync] gagal menghapus order:', id, e)
  }
}

/**
 * Caching katalog produk & kategori untuk fallback offline reload.
 */
export async function cacheCatalog(products, categories, user, packagingStock) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_CATALOG, 'readwrite')
    const store = tx.objectStore(STORE_CATALOG)
    if (products) store.put({ key: 'products', val: products, time: Date.now() })
    if (categories) store.put({ key: 'categories', val: categories, time: Date.now() })
    if (user) store.put({ key: 'user', val: user, time: Date.now() })
    if (packagingStock !== undefined) store.put({ key: 'packaging_stock', val: packagingStock, time: Date.now() })
  } catch (e) {
    console.warn('[offlineSync] cache catalog gagal:', e)
  }
}

/**
 * Mengambil fallback katalog dari IndexedDB saat aplikasi dibuka offline.
 */
export async function getCachedCatalog() {
  try {
    const db = await openDB()
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_CATALOG, 'readonly')
      const store = tx.objectStore(STORE_CATALOG)
      const res = {}
      let done = 0
      const keys = ['products', 'categories', 'user', 'packaging_stock']
      keys.forEach((k) => {
        const req = store.get(k)
        req.onsuccess = () => {
          if (req.result) res[k] = req.result.val
          done++
          if (done === keys.length) resolve(res)
        }
        req.onerror = () => {
          done++
          if (done === keys.length) resolve(res)
        }
      })
    })
  } catch {
    return {}
  }
}

/**
 * Sinkronisasi seluruh antrean pesanan offline ke backend.
 * @param {Function} syncHandler fungsi pengirim API, default panggil /api/orders
 */
let isSyncing = false
export async function syncPendingOrders(syncHandler) {
  if (isSyncing) return { syncing: true }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { error: 'Sedang offline' }
  }

  isSyncing = true
  notifySync({ type: 'sync_start' })

  let syncedCount = 0
  let failedCount = 0

  try {
    const pendingList = await getPendingOrders()
    for (const item of pendingList) {
      try {
        await syncHandler(item.payload)
        await removePendingOrder(item.id)
        syncedCount++
      } catch (err) {
        console.warn(`[offlineSync] gagal sinkron order ${item.id}:`, err)
        failedCount++
        // Jika network error (koneksi terputus saat sync), hentikan iterasi
        if (!navigator.onLine || err.message?.includes('fetch') || err.status === 0) {
          break
        }
      }
    }
  } finally {
    isSyncing = false
    notifySync({ type: 'sync_end', syncedCount, failedCount })
  }

  return { syncedCount, failedCount }
}
