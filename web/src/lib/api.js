import { saveOfflineOrder } from './offlineSync'

let token = sessionStorage.getItem('kk-token') || ''

export function setAuthToken(t) {
  token = t || ''
  if (t) {
    sessionStorage.setItem('kk-token', t)
  } else {
    sessionStorage.removeItem('kk-token')
  }
}

export function hasAuthToken() {
  return !!token
}

function headers() {
  const h = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = 'Bearer ' + token
  return h
}

async function json(res) {
  if (res.status === 401) {
    const err = new Error('Perlu masuk terlebih dahulu')
    err.status = 401
    throw err
  }
  if (!res.ok) {
    let msg = 'Terjadi kesalahan'
    try {
      const body = await res.json()
      msg = body.error || msg
    } catch {
      /* ignore */
    }
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return res.json()
}

function qs(params) {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v) p.set(k, v)
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

// --- Auth ---
export function getUsers() {
  return fetch('/api/auth/users').then(json)
}

export function getMe() {
  return fetch('/api/auth/me', { headers: headers() }).then(json)
}

export function login(userId, pin) {
  return fetch('/api/auth/login', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ userId, pin }),
  }).then(json)
}

// --- Produk & kategori ---
export function getProducts() {
  return fetch('/api/products', { headers: headers() }).then(json)
}

export function getAdminProducts() {
  return fetch('/api/admin/products', { headers: headers() }).then(json)
}

export function getCategories() {
  return fetch('/api/categories', { headers: headers() }).then(json)
}

// --- Pesanan ---
export function getOrders() {
  return fetch('/api/orders', { headers: headers() }).then(json)
}

export async function createOrder(payload, options = {}) {
  const { cashier, products } = options

  // Jika browser offline, langsung simpan secara lokal
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return saveOfflineOrder(payload, cashier, products)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4500)

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return await json(res)
  } catch (err) {
    clearTimeout(timeoutId)
    // Jika error validasi bisnis dari server (400, 401, 422), jangan simpan offline
    if (err.status && err.status >= 400 && err.status < 500) {
      throw err
    }
    // Jika network error / timeout, simpan ke antrean offline
    console.warn('[api] Gagal terhubung ke cloud/server, menyimpan pesanan secara offline...', err)
    return saveOfflineOrder(payload, cashier, products)
  }
}

export function syncOrderToServer(payload) {
  return fetch('/api/orders', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  }).then(json)
}

export function voidOrder(id, reason) {
  return fetch(`/api/orders/${id}/void`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ reason }),
  }).then(json)
}

// --- Laporan ---
export function getReportSummary({ from, to }) {
  return fetch('/api/reports/summary' + qs({ from, to }), { headers: headers() }).then(json)
}

export async function downloadReportCSV({ from, to }) {
  const res = await fetch('/api/reports/orders.csv' + qs({ from, to }), { headers: headers() })
  if (!res.ok) throw new Error('Gagal mengunduh laporan')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `laporan-${from || 'semua'}-${to || 'semua'}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// --- Admin: produk ---
export function createProduct(data) {
  return fetch('/api/products', { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(json)
}

export function updateProduct(id, data) {
  return fetch('/api/products/' + id, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(json)
}

export function setAvailability(id, available) {
  return fetch(`/api/products/${id}/availability`, {
    method: 'PATCH', headers: headers(), body: JSON.stringify({ available }),
  }).then(json)
}

export function setStock(id, stock) {
  return fetch(`/api/products/${id}/stock`, {
    method: 'PATCH', headers: headers(), body: JSON.stringify({ stock }),
  }).then(json)
}

export function archiveProduct(id) {
  return fetch(`/api/products/${id}/archive`, { method: 'POST', headers: headers() }).then(json)
}

export function restoreProduct(id) {
  return fetch(`/api/products/${id}/restore`, { method: 'POST', headers: headers() }).then(json)
}

// --- Admin: kategori ---
export function createCategory(data) {
  return fetch('/api/categories', { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(json)
}

export function updateCategory(id, data) {
  return fetch('/api/categories/' + id, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(json)
}

export function deleteCategory(id) {
  return fetch('/api/categories/' + id, { method: 'DELETE', headers: headers() }).then(json)
}

// --- Admin: pengguna ---
export function getAdminUsers() {
  return fetch('/api/admin/users', { headers: headers() }).then(json)
}

export function createUser(data) {
  return fetch('/api/admin/users', { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(json)
}

export function updateUser(id, data) {
  return fetch('/api/admin/users/' + id, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(json)
}

export function deleteUser(id) {
  return fetch('/api/admin/users/' + id, { method: 'DELETE', headers: headers() }).then(json)
}

// --- Stok kemasan ---
export function getPackagingStock() {
  return fetch('/api/settings/packaging', { headers: headers() }).then(json)
}

export function setPackagingStock(stock) {
  return fetch('/api/settings/packaging', {
    method: 'PATCH', headers: headers(), body: JSON.stringify({ stock }),
  }).then(json)
}

// --- Upload gambar (admin) ---
export function uploadImage(file) {
  const form = new FormData()
  form.append('file', file)
  return fetch('/api/admin/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  }).then(json)
}
