import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { rupiah } from '../lib/format'
import ImageCropper from './ImageCropper'
import {
  adjustPackaging,
  archiveProduct,
  createCategory,
  createPackaging,
  createProduct,
  createUser,
  deleteCategory,
  deletePackaging,
  deleteUser,
  downloadReportCSV,
  getAdminProducts,
  getAdminUsers,
  getCategories,
  getPackagingLogs,
  getPackagings,
  getPackagingStock,
  getReportSummary,
  restoreProduct,
  setAvailability,
  setPackagingStock,
  setStock,
  updateCategory,
  updatePackaging,
  updateProduct,
  updateUser,
  uploadImage,
} from '../lib/api'

function todayStr(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function AdminPage({ onToast }) {
  const [tab, setTab] = useState('reports')

  return (
    <div className="admin-page">
      <div className="page-heading">
        <h1>Admin</h1>
        <p>Kelola laporan keuangan dan menu.</p>
      </div>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${tab === 'reports' ? 'active' : ''}`}
          onClick={() => setTab('reports')}
        >
          <span className="material-symbols-outlined">bar_chart</span>
          Laporan
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'menu' ? 'active' : ''}`}
          onClick={() => setTab('menu')}
        >
          <span className="material-symbols-outlined">menu_book</span>
          Kelola Menu
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          <span className="material-symbols-outlined">group</span>
          Pengguna
        </button>
      </div>

      {tab === 'reports' && <ReportsView />}
      {tab === 'menu' && <MenuManageView onToast={onToast} />}
      {tab === 'users' && <UserManageView onToast={onToast} />}
    </div>
  )
}

function ReportsView() {
  const [from, setFrom] = useState(todayStr(-6))
  const [to, setTo] = useState(todayStr())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [downloading, setDownloading] = useState(false)

  function load(f, t) {
    setLoading(true)
    setErr(null)
    getReportSummary({ from: f, to: t })
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function quick(days) {
    const t = todayStr()
    const f = todayStr(-(days - 1))
    setFrom(f)
    setTo(t)
    load(f, t)
  }

  async function download() {
    setDownloading(true)
    try {
      await downloadReportCSV({ from, to })
    } catch (e) {
      setErr(e.message)
    } finally {
      setDownloading(false)
    }
  }

  const maxRev = useMemo(
    () => Math.max(1, ...(data?.revenueByDay || []).map((d) => d.revenue)),
    [data]
  )

  return (
    <div className="reports">
      <div className="report-toolbar">
        <div className="range-controls">
          <label>
            Dari
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Sampai
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => load(from, to)}>
            Terapkan
          </button>
        </div>
        <div className="quick-controls">
          <button type="button" className="chip" onClick={() => quick(1)}>Hari ini</button>
          <button type="button" className="chip" onClick={() => quick(7)}>7 hari</button>
          <button type="button" className="chip" onClick={() => quick(30)}>30 hari</button>
        </div>
        <button
          type="button"
          className="btn btn-dark btn-sm report-download-btn"
          onClick={download}
          disabled={downloading}
        >
          <span className="material-symbols-outlined">download</span>
          {downloading ? 'Mengunduh...' : 'Unduh CSV'}
        </button>
      </div>

      {err && <div className="state-box state-box-small"><p>{err}</p></div>}
      {loading && <div className="sk-line w80" style={{ height: 80, marginTop: 16 }} />}

      {!loading && data && (
        <>
          <div className="stat-grid">
            <StatCard icon="payments" label="Pendapatan" value={rupiah(data.totalRevenue)} />
            <StatCard icon="receipt_long" label="Transaksi" value={String(data.orderCount)} />
            <StatCard icon="shopping_bag" label="Item Terjual" value={String(data.itemsSold)} />
            <StatCard icon="functions" label="Rata-rata" value={rupiah(data.avgOrder)} />
            {data.totalDiscount > 0 && <StatCard icon="sell" label="Total Diskon" value={rupiah(data.totalDiscount)} />}
            {data.voidCount > 0 && <StatCard icon="block" label="Dibatalkan" value={String(data.voidCount)} />}
          </div>

          <div className="admin-panel">
            <h3>Penjualan per hari</h3>
            {data.revenueByDay.length === 0 ? (
              <p className="muted">Belum ada data pada rentang ini.</p>
            ) : (
              <div className="bar-chart">
                {data.revenueByDay.map((d) => (
                  <div className="bar-col" key={d.date}>
                    <span className="bar-value">{d.revenue > 0 ? rupiah(d.revenue).replace('Rp', '') : ''}</span>
                    <div
                      className="bar"
                      style={{ height: `${Math.max(6, (d.revenue / maxRev) * 100)}%` }}
                      title={`${d.date}: ${rupiah(d.revenue)}`}
                    />
                    <span className="bar-label">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-panel">
            <h3>Produk terlaris</h3>
            {data.topProducts.length === 0 ? (
              <p className="muted">Belum ada penjualan.</p>
            ) : (
              <ul className="top-list">
                {data.topProducts.map((p, i) => (
                  <li key={p.productId}>
                    <span className="top-rank">{i + 1}</span>
                    <span className="top-emoji">{p.emoji}</span>
                    <span className="top-name">{p.name}</span>
                    <span className="top-qty">{p.qty}x</span>
                    <span className="top-rev">{rupiah(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.byCashier?.length > 0 && (
            <div className="admin-panel">
              <h3>Per kasir</h3>
              <ul className="top-list">
                {data.byCashier.map((c) => (
                  <li key={c.cashierId}>
                    <span className="top-emoji">👤</span>
                    <span className="top-name">{c.cashierName}</span>
                    <span className="top-qty">{c.orders} txn</span>
                    <span className="top-rev">{rupiah(c.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.byOrderType?.length > 0 && (
            <div className="admin-panel">
              <h3>Per jenis layanan</h3>
              <ul className="top-list">
                {data.byOrderType.map((o) => (
                  <li key={o.orderType}>
                    <span className="top-emoji">{o.orderType === 'dine_in' ? '🍽️' : '🛍️'}</span>
                    <span className="top-name">{o.orderType === 'dine_in' ? 'Makan di Tempat' : 'Bungkus'}</span>
                    <span className="top-qty">{o.orders} txn</span>
                    <span className="top-rev">{rupiah(o.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.byPaymentMethod?.length > 0 && (
            <div className="admin-panel">
              <h3>Per metode pembayaran</h3>
              <ul className="top-list">
                {data.byPaymentMethod.map((p) => (
                  <li key={p.paymentMethod}>
                    <span className="top-emoji">{p.paymentMethod === 'qris' ? '📱' : '💵'}</span>
                    <span className="top-name">{p.paymentMethod === 'qris' ? 'QRIS' : 'Tunai'}</span>
                    <span className="top-qty">{p.orders} txn</span>
                    <span className="top-rev">{rupiah(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.byCategory?.length > 0 && (
            <div className="admin-panel">
              <h3>Per kategori</h3>
              <ul className="top-list">
                {data.byCategory.map((c) => (
                  <li key={c.category}>
                    <span className="top-emoji">📦</span>
                    <span className="top-name">{c.category}</span>
                    <span className="top-qty">{c.qty} item</span>
                    <span className="top-rev">{rupiah(c.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="admin-panel">
            <h3>Jam tersibuk</h3>
            <div className="hour-grid">
              {data.byHour?.map((h) => (
                <div key={h.hour} className={`hour-cell ${h.orders > 0 ? 'active' : ''}`} title={`${String(h.hour).padStart(2, '0')}:00 — ${h.orders} transaksi`}>
                  <span className="hour-label">{String(h.hour).padStart(2, '0')}</span>
                  <span className="hour-count">{h.orders}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="admin-panel" style={{ marginTop: 24 }}>
        <PackagingLogsSection />
      </div>
    </div>
  )
}

function PackagingLogsSection() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  function loadLogs() {
    setLoading(true)
    setErr(null)
    getPackagingLogs(100)
      .then(setLogs)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLogs()
  }, [])

  return (
    <div className="packaging-logs-section">
      <div className="manage-head" style={{ marginBottom: 16 }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined">receipt_long</span>
            Log Pemakaian & Penyesuaian Kemasan
          </h3>
          <p className="section-subhead">Riwayat pengurangan saat transaksi atau penambahan stok kemasan.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={loadLogs}>
          <span className="material-symbols-outlined">refresh</span>
          Refresh
        </button>
      </div>

      {err && <div className="state-box state-box-small"><p>{err}</p></div>}
      {loading ? (
        <div className="sk-line w80" style={{ height: 100 }} />
      ) : logs.length === 0 ? (
        <p className="muted">Belum ada riwayat aktivitas kemasan.</p>
      ) : (
        <div className="log-table-container">
          <table className="log-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Kemasan</th>
                <th>Perubahan</th>
                <th>Sisa Stok</th>
                <th>Keterangan / Pesanan</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isDeduct = log.changeAmount < 0
                return (
                  <tr key={log.id}>
                    <td className="log-time">
                      {new Date(log.createdAt).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="log-pkg-name">
                      <strong>{log.packagingName || log.packagingId}</strong>
                    </td>
                    <td className="log-change">
                      <span className={`log-badge ${isDeduct ? 'deduct' : 'add'}`}>
                        {log.changeAmount > 0 ? `+${log.changeAmount}` : log.changeAmount}
                      </span>
                    </td>
                    <td className="log-balance">{log.balanceAfter} pcs</td>
                    <td className="log-reason">
                      {log.orderNumber ? (
                        <span>
                          Order <strong>{log.orderNumber}</strong> ({log.reason})
                        </span>
                      ) : (
                        <span>{log.reason}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-icon" aria-hidden="true">
        <span className="material-symbols-outlined">{icon}</span>
      </span>
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <span className="stat-value" title={value}>{value}</span>
      </div>
    </div>
  )
}

const EMPTY_PRODUCT = {
  id: '',
  name: '',
  category: '',
  price: 0,
  description: '',
  emoji: '',
  color: '#f6ddd4',
  tags: [],
  imageUrl: '',
  stock: -1,
  packagingId: '',
  packagingRule: 'take_away_only',
}

function MenuManageView({ onToast }) {
  const [products, setProducts] = useState(null)
  const [categories, setCategories] = useState([])
  const [packagings, setPackagings] = useState([])
  const [err, setErr] = useState(null)
  const [editing, setEditing] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [catEditing, setCatEditing] = useState(null)
  const [catDraft, setCatDraft] = useState({ name: '', emoji: '' })

  function load() {
    setErr(null)
    Promise.all([getAdminProducts(), getCategories(), getPackagings()])
      .then(([p, c, pk]) => {
        setProducts(p)
        setCategories(c)
        setPackagings(pk)
      })
      .catch((e) => setErr(e.message))
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleAvailability(p) {
    try {
      await setAvailability(p.id, !p.available)
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function doArchive(p) {
    try {
      await archiveProduct(p.id)
      onToast(`${p.name} diarsipkan`)
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function doRestore(p) {
    try {
      await restoreProduct(p.id)
      onToast(`${p.name} dipulihkan`)
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  function openNew() {
    setEditing({ ...EMPTY_PRODUCT, category: categories[0]?.id || '' })
  }

  async function saveProduct(data) {
    try {
      let saved
      if (data.id) saved = await updateProduct(data.id, data)
      else saved = await createProduct(data)
      if (saved && data.stock !== undefined && data.stock !== saved.stock) {
        await setStock(saved.id, data.stock)
      }
      onToast(data.id ? 'Produk diperbarui' : 'Produk ditambahkan')
      setEditing(null)
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function saveCategory() {
    try {
      if (catEditing) {
        await updateCategory(catEditing.id, { ...catEditing, ...catDraft })
      } else {
        await createCategory(catDraft)
      }
      setCatEditing(null)
      setCatDraft({ name: '', emoji: '' })
      onToast('Kategori disimpan')
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function removeCategory(c) {
    if (!window.confirm(`Hapus kategori "${c.name}"?`)) return
    try {
      await deleteCategory(c.id)
      onToast('Kategori dihapus')
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  const active = (products || []).filter((p) => !p.archived)
  const archived = (products || []).filter((p) => p.archived)

  return (
    <div className="menu-manage">
      <PackagingPanel packagings={packagings} onRefresh={load} onToast={onToast} />
      <div className="manage-section">
        <div className="manage-head">
          <h3>Kategori</h3>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCatEditing({ id: '', name: '', emoji: '' })}>
            <span className="material-symbols-outlined">add</span> Kategori
          </button>
        </div>
        <div className="category-list">
          {categories.map((c) => (
            <div className="category-row" key={c.id}>
              <span className="cat-emoji">{c.emoji}</span>
              <span className="cat-name">{c.name}</span>
              <button type="button" className="mini-action" onClick={() => setCatEditing(c)} aria-label="Ubah kategori">
                <span className="material-symbols-outlined">edit</span>
              </button>
              <button type="button" className="mini-action danger" onClick={() => removeCategory(c)} aria-label="Hapus kategori">
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="manage-section">
        <div className="manage-head">
          <h3>Produk</h3>
          <button type="button" className="btn btn-primary btn-sm" onClick={openNew}>
            <span className="material-symbols-outlined">add</span> Produk
          </button>
        </div>

        {err && <div className="state-box state-box-small"><p>{err}</p></div>}

        {!products ? (
          <div className="sk-line w80" style={{ height: 120, marginTop: 16 }} />
        ) : (
          <div className="product-table">
            {active.map((p) => {
              const pkg = packagings.find((pk) => pk.id === p.packagingId)
              return (
                <div className="product-row" key={p.id}>
                  <div className="pr-thumb" style={{ background: p.color }}>
                    {p.imageUrl ? <img src={p.imageUrl} alt="" /> : p.emoji}
                  </div>
                  <div className="pr-info">
                    <span className="pr-name">{p.name}</span>
                    <span className="pr-meta">
                      {rupiah(p.price)} · {p.category}{p.stock >= 0 ? ` · stok ${p.stock}` : ''}
                      {pkg ? (
                        <span className="pr-pkg-tag" title={`Kemasan: ${pkg.name} (${p.packagingRule === 'always' ? 'Dine In & Bungkus' : 'Bungkus Saja'})`}>
                          📦 {pkg.name}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <StockInput product={p} onChanged={load} onError={setErr} />
                  <button
                    type="button"
                    className={`switch ${p.available ? 'on' : 'off'}`}
                    onClick={() => toggleAvailability(p)}
                    aria-label={p.available ? 'Tandai habis' : 'Tandai tersedia'}
                  >
                    <span className="switch-dot" />
                    <span className="switch-label">{p.available ? 'Sedia' : 'Habis'}</span>
                  </button>
                  <button type="button" className="mini-action" onClick={() => setEditing(p)} aria-label="Ubah produk">
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button type="button" className="mini-action danger" onClick={() => doArchive(p)} aria-label="Arsipkan produk">
                    <span className="material-symbols-outlined">archive</span>
                  </button>
                </div>
              )
            })}

            <button
              type="button"
              className="archive-toggle"
              onClick={() => setShowArchived((s) => !s)}
            >
              <span className="material-symbols-outlined">inventory_2</span>
              Produk diarsipkan ({archived.length})
              <span className="material-symbols-outlined">{showArchived ? 'expand_less' : 'expand_more'}</span>
            </button>

            {showArchived &&
              archived.map((p) => (
                <div className="product-row archived" key={p.id}>
                  <div className="pr-thumb" style={{ background: p.color }}>
                    {p.imageUrl ? <img src={p.imageUrl} alt="" /> : p.emoji}
                  </div>
                  <div className="pr-info">
                    <span className="pr-name">{p.name}</span>
                    <span className="pr-meta">{rupiah(p.price)}</span>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => doRestore(p)}>
                    Pulihkan
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <ProductForm
            key={editing.id || 'new'}
            product={editing}
            categories={categories}
            packagings={packagings}
            onClose={() => setEditing(null)}
            onSave={saveProduct}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {catEditing && (
          <CategoryForm
            key={catEditing.id || 'new'}
            initial={catEditing}
            onClose={() => setCatEditing(null)}
            onSave={saveCategory}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ProductForm({ product, categories, packagings = [], onClose, onSave }) {
  const [form, setForm] = useState({
    ...product,
    packagingId: product.packagingId || '',
    packagingRule: product.packagingRule || 'take_away_only',
    tags: (product.tags || []).join(', '),
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [cropSrc, setCropSrc] = useState(null)

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleFile(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploadErr('')
    setCropSrc(URL.createObjectURL(file))
  }

  async function handleCropped(blob) {
    setCropSrc(null)
    setUploading(true)
    setUploadErr('')
    try {
      const res = await uploadImage(new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
      set('imageUrl', res.url)
    } catch (err) {
      setUploadErr(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    const data = {
      ...form,
      price: Math.max(0, Number(form.price) || 0),
      tags: String(form.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    }
    await onSave(data)
    setSaving(false)
  }

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        className="modal form-modal"
        onSubmit={submit}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="modal-head">
          <h2>{product.id ? 'Ubah Produk' : 'Tambah Produk'}</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="form-body">
          <label className="field">
            Nama
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label className="field">
            Kategori
            <select value={form.category} onChange={(e) => set('category', e.target.value)} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Harga (Rp)
            <input type="number" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} required />
          </label>
          <label className="field">
            Stok (kosongkan = tanpa batas)
            <input
              type="number"
              min="-1"
              value={form.stock}
              onChange={(e) => set('stock', e.target.value === '' ? -1 : Number(e.target.value))}
              placeholder="-1"
            />
          </label>

          <div className="field-row">
            <label className="field">
              Wadah Kemasan
              <select
                value={form.packagingId || ''}
                onChange={(e) => set('packagingId', e.target.value)}
              >
                <option value="">Tanpa Kemasan</option>
                {packagings.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} (sisa {pkg.stock})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Aturan Penggunaan
              <select
                value={form.packagingRule || 'take_away_only'}
                onChange={(e) => set('packagingRule', e.target.value)}
                disabled={!form.packagingId}
              >
                <option value="take_away_only">Hanya Saat Bungkus</option>
                <option value="always">Selalu (Dine In & Bungkus)</option>
              </select>
            </label>
          </div>

          <label className="field">
            Deskripsi
            <input value={form.description} onChange={(e) => set('description', e.target.value)} />
          </label>
          <div className="field-row">
            <label className="field">
              Emoji
              <input value={form.emoji} onChange={(e) => set('emoji', e.target.value)} placeholder="🍛" />
            </label>
            <label className="field field-color">
              Warna
              <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} />
            </label>
          </div>
          <label className="field">
            URL Foto (opsional)
            <input value={form.imageUrl || ''} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://..." />
          </label>
          <div className="upload-row">
            <input
              id="img-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            <label htmlFor="img-upload" className="btn btn-secondary btn-sm upload-btn">
              <span className="material-symbols-outlined">upload</span>
              {uploading ? 'Mengunggah...' : 'Upload Gambar'}
            </label>
            {form.imageUrl && (
              <img className="upload-preview" src={form.imageUrl} alt="Pratinjau" />
            )}
          </div>
          {uploadErr && <p className="form-error upload-error">{uploadErr}</p>}
          <label className="field">
            Tag (pisahkan dengan koma)
            <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="Halal, Best Seller" />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </motion.form>

      <AnimatePresence>
        {cropSrc && (
          <ImageCropper
            key={cropSrc}
            src={cropSrc}
            onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null) }}
            onDone={(blob) => { URL.revokeObjectURL(cropSrc); handleCropped(blob) }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function CategoryForm({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial.name || '')
  const [emoji, setEmoji] = useState(initial.emoji || '')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    await onSave({ name, emoji })
    setSaving(false)
  }

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        className="modal form-modal form-modal-sm"
        onSubmit={submit}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
      >
        <div className="modal-head">
          <h2>{initial.id ? 'Ubah Kategori' : 'Tambah Kategori'}</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="form-body">
          <label className="field">
            Nama
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            Emoji
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🍽️" />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}

function PackagingPanel({ packagings = [], onRefresh, onToast }) {
  const [adjustItem, setAdjustItem] = useState(null)
  const [adjustChange, setAdjustChange] = useState('')
  const [adjustReason, setAdjustReason] = useState('Restok kemasan')
  const [adjusting, setAdjusting] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStock, setNewStock] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleAdjust(e) {
    e.preventDefault()
    const chg = parseInt(adjustChange, 10)
    if (Number.isNaN(chg) || chg === 0) return
    setAdjusting(true)
    try {
      await adjustPackaging(adjustItem.id, chg, adjustReason || 'Penyesuaian manual')
      onToast(`Stok ${adjustItem.name} berhasil diperbarui`)
      setAdjustItem(null)
      setAdjustChange('')
      setAdjustReason('Restok kemasan')
      onRefresh()
    } catch (err) {
      alert(err.message)
    } finally {
      setAdjusting(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const stk = Math.max(0, parseInt(newStock, 10) || 0)
    setCreating(true)
    try {
      await createPackaging({ name: newName.trim(), stock: stk })
      onToast(`Wadah kemasan "${newName}" ditambahkan`)
      setShowCreate(false)
      setNewName('')
      setNewStock('')
      onRefresh()
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="manage-section packaging-panel">
      <div className="manage-head">
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined">inventory_2</span>
            Stok Wadah & Kemasan
          </h3>
          <p className="section-subhead">Kelola stok wadah kemasan untuk dine in dan bungkus.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreate(true)}
        >
          <span className="material-symbols-outlined">add</span>
          Wadah Baru
        </button>
      </div>

      <div className="packaging-cards-grid">
        {packagings.map((pkg) => (
          <div className="packaging-card" key={pkg.id}>
            <div className="pkg-card-top">
              <span className="pkg-card-title">{pkg.name}</span>
              <span className={`pack-badge ${pkg.stock <= 15 ? 'low' : ''}`}>
                {pkg.stock} pcs
              </span>
            </div>
            <div className="pkg-card-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setAdjustItem(pkg)
                  setAdjustChange('')
                  setAdjustReason('Restok kemasan')
                }}
              >
                <span className="material-symbols-outlined">tune</span>
                Atur Stok
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Adjust Stok */}
      <AnimatePresence>
        {adjustItem && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.form
              className="modal form-modal form-modal-sm"
              onSubmit={handleAdjust}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
            >
              <div className="modal-head">
                <h2>Atur Stok: {adjustItem.name}</h2>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setAdjustItem(null)}
                  aria-label="Tutup"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="form-body">
                <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
                  Stok saat ini: <strong>{adjustItem.stock} pcs</strong>
                </p>

                <label className="field">
                  Perubahan Jumlah (+ untuk tambah, - untuk rusak/kurang)
                  <input
                    type="number"
                    value={adjustChange}
                    onChange={(e) => setAdjustChange(e.target.value)}
                    placeholder="Contoh: +50 atau -5"
                    required
                    autoFocus
                  />
                </label>

                <div className="quick-adjust-chips">
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setAdjustChange('+50')}
                  >
                    +50 Restok
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setAdjustChange('+100')}
                  >
                    +100 Restok
                  </button>
                  <button
                    type="button"
                    className="chip chip-danger"
                    onClick={() => {
                      setAdjustChange('-1')
                      setAdjustReason('Rusak/cacat')
                    }}
                  >
                    -1 Rusak
                  </button>
                </div>

                <label className="field">
                  Alasan / Keterangan
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Contoh: Restok supplier, Rusak/bocor"
                    required
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAdjustItem(null)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={adjusting || !adjustChange}
                >
                  {adjusting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Wadah Baru */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.form
              className="modal form-modal form-modal-sm"
              onSubmit={handleCreate}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
            >
              <div className="modal-head">
                <h2>Tambah Wadah Baru</h2>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setShowCreate(false)}
                  aria-label="Tutup"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="form-body">
                <label className="field">
                  Nama Kemasan / Wadah
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Misal: Paper Cup 12oz, Kotak Bento"
                    required
                    autoFocus
                  />
                </label>

                <label className="field">
                  Stok Awal (pcs)
                  <input
                    type="number"
                    min="0"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    placeholder="0"
                    required
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !newName.trim()}
                >
                  {creating ? 'Menyimpan...' : 'Tambah Wadah'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StockInput({ product, onChanged, onError }) {
  const [val, setVal] = useState(product.stock >= 0 ? String(product.stock) : '')
  const [focused, setFocused] = useState(false)

  async function apply() {
    const v = val.trim()
    const num = v === '' ? -1 : Math.max(-1, parseInt(v, 10) || 0)
    try {
      await setStock(product.id, Number.isNaN(num) ? -1 : num)
      onChanged()
    } catch (e) {
      if (onError) onError(e.message)
    }
  }

  return (
    <div className="stock-inline">
      <input
        className="stock-input"
        type="number"
        min="-1"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={apply}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); apply() } }}
        placeholder="∞"
        aria-label="Stok produk"
        style={{ width: focused ? 72 : 56 }}
      />
    </div>
  )
}

function UserManageView({ onToast }) {
  const [users, setUsers] = useState(null)
  const [err, setErr] = useState(null)
  const [editing, setEditing] = useState(null)

  function load() {
    setErr(null)
    getAdminUsers()
      .then(setUsers)
      .catch((e) => setErr(e.message))
  }

  useEffect(() => { load() }, [])

  async function toggleActive(u) {
    try {
      await updateUser(u.id, { name: u.name, role: u.role, active: !u.active })
      onToast(u.active ? `${u.name} dinonaktifkan` : `${u.name} diaktifkan`)
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function doDelete(u) {
    if (!window.confirm(`Hapus pengguna "${u.name}"?`)) return
    try {
      await deleteUser(u.id)
      onToast(`${u.name} dihapus`)
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="menu-manage">
      <div className="manage-section">
        <div className="manage-head">
          <h3>Pengguna</h3>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ id: '', name: '', role: 'kasir', pin: '' })}>
            <span className="material-symbols-outlined">add</span> Pengguna
          </button>
        </div>

        <p className="manage-hint">
          Buat akun <strong>Kasir</strong> agar staf bisa login ke aplikasi kasir.
          Setiap kasir punya nama dan kode akses (PIN) sendiri.
        </p>

        {err && <div className="state-box state-box-small"><p>{err}</p></div>}
        {!users ? (
          <div className="sk-line w80" style={{ height: 120 }} />
        ) : (
          <div className="product-table">
            {users.map((u) => (
              <div className="product-row" key={u.id}>
                <span className="pr-thumb" style={{ background: u.role === 'admin' ? 'var(--primary)' : 'var(--surface)' }}>
                  <span className="material-symbols-outlined" style={{ color: u.role === 'admin' ? 'var(--on-primary)' : 'var(--on-bg)' }}>
                    {u.role === 'admin' ? 'admin_panel_settings' : 'point_of_sale'}
                  </span>
                </span>
                <div className="pr-info">
                  <span className="pr-name">{u.name}</span>
                  <span className="pr-meta">{u.role === 'admin' ? 'Admin' : 'Kasir'}{u.hasPin ? '' : ' · PIN belum diset'}</span>
                </div>
                <button
                  type="button"
                  className={`switch ${u.active ? 'on' : 'off'}`}
                  onClick={() => toggleActive(u)}
                >
                  <span className="switch-dot" />
                  <span className="switch-label">{u.active ? 'Aktif' : 'Nonaktif'}</span>
                </button>
                <button type="button" className="mini-action" onClick={() => setEditing({ ...u, pin: '' })} aria-label="Ubah pengguna">
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button type="button" className="mini-action danger" onClick={() => doDelete(u)} aria-label="Hapus pengguna">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <UserForm
            key={editing.id || 'new'}
            initial={editing}
            onClose={() => setEditing(null)}
            onSave={async (data) => {
              try {
                if (data.id) {
                  await updateUser(data.id, { name: data.name, pin: data.pin || undefined, role: data.role })
                } else {
                  await createUser({ name: data.name, pin: data.pin, role: data.role })
                }
                onToast(data.id ? 'Pengguna diperbarui' : 'Pengguna ditambahkan')
                setEditing(null)
                load()
              } catch (e) {
                setErr(e.message)
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function UserForm({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial.name || '')
  const [pin, setPin] = useState('')
  const [role, setRoleVal] = useState(initial.role || 'kasir')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    await onSave({ id: initial.id, name, pin: pin || undefined, role })
    setSaving(false)
  }

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        className="modal form-modal form-modal-sm"
        onSubmit={submit}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
      >
        <div className="modal-head">
          <h2>{initial.id ? 'Ubah Pengguna' : 'Tambah Pengguna'}</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="form-body">
          <label className="field">
            Nama
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            Kode akses {initial.id ? '(kosongkan = tidak diubah)' : ''}
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder={initial.id ? '••••' : ''} required={!initial.id} />
          </label>
          <label className="field">
            Role
            <select value={role} onChange={(e) => setRoleVal(e.target.value)}>
              <option value="kasir">Kasir</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}
