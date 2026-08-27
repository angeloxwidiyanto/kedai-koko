import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useShop } from '../shop'
import ProductCard from './ProductCard'
import CartPanel from './CartPanel'
import MobileBar from './MobileBar'
import OrderTypeBar from './OrderTypeBar'

export default function MenuPage({ onCheckout, onToast }) {
  const { products, categories, loading, error } = useShop()
  const [activeCat, setActiveCat] = useState('all')

  const allCategories = [{ id: 'all', name: 'Semua', icon: 'grid_view', emoji: '✨' }, ...categories]

  const active = allCategories.find((c) => c.id === activeCat) || allCategories[0]
  const filtered =
    activeCat === 'all' ? products : products.filter((p) => p.category === activeCat)

  return (
    <div className="menu-layout">
      <aside className="cat-sidebar">
        <div className="cat-heading">
          <h2>Kategori</h2>
          <p>Pilih kategori menu</p>
        </div>
        <nav>
          {allCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cat-item ${activeCat === c.id ? 'active' : ''}`}
              onClick={() => setActiveCat(c.id)}
            >
              <span className="material-symbols-outlined">{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="menu-main">
        <OrderTypeBar />

        <div className="cat-chips">
          {allCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${activeCat === c.id ? 'active' : ''}`}
              onClick={() => setActiveCat(c.id)}
            >
              <span className="material-symbols-outlined">{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <div className="menu-heading">
          <h1>{active.emoji} {active.name}</h1>
          <p>{active.id === 'all' ? 'Semua menu lezat di Kedai Koko.' : `Menu ${active.name.toLowerCase()} yang lezat.`}</p>
        </div>

        {loading ? (
          <div className="grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card skeleton" aria-hidden="true">
                <div className="sk-media" />
                <div className="sk-body">
                  <div className="sk-line w60" />
                  <div className="sk-line w40" />
                  <div className="sk-line w80" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="state-box">
            <span className="material-symbols-outlined">error_outline</span>
            <h3>Tidak bisa memuat menu</h3>
            <p>{error}</p>
          </div>
        ) : (
          <div className="grid">
            <AnimatePresence mode="popLayout">
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} onAdd={onToast} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <CartPanel onCheckout={onCheckout} />
      <MobileBar onCheckout={onCheckout} />
    </div>
  )
}
