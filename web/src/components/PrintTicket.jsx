import { rupiah, timeID } from '../lib/format'

export default function PrintTicket({ order, kind = 'kitchen' }) {
  if (!order) return null

  const isReceipt = kind === 'receipt'

  return (
    <div className="print-ticket">
      <div className="pt-brand">Kedai Koko</div>
      <div className="pt-title">{isReceipt ? 'Struk Pembayaran' : 'Tiket Dapur'}</div>
      <div className="pt-rule" />

      <div className="pt-row">
        <span>No.</span>
        <span>{order.number}</span>
      </div>
      <div className="pt-row">
        <span>Waktu</span>
        <span>{timeID(order.createdAt)}</span>
      </div>
      <div className="pt-row">
        <span>Jenis</span>
        <span className="pt-order-type">
          {order.orderType === 'dine_in'
            ? `Makan di Tempat${order.tableNo ? ` · Meja ${order.tableNo}` : ''}`
            : 'Bungkus'}
        </span>
      </div>
      <div className="pt-rule" />

      {order.items.map((it, idx) => (
        <div key={`${it.productId}-${idx}`} className="pt-item">
          <div className="pt-line">
            <span className="pt-qty">{it.qty}x</span>
            <span className="pt-name">{it.name}</span>
            {isReceipt && <span className="pt-price">{rupiah(it.price * it.qty)}</span>}
          </div>
          {it.note ? <div className="pt-note">Catatan: {it.note}</div> : null}
        </div>
      ))}

      {isReceipt ? (
        <>
          <div className="pt-rule" />
          <div className="pt-row">
            <span>Subtotal</span>
            <span>{rupiah(order.subtotal || order.total)}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="pt-row">
              <span>Diskon</span>
              <span>-{rupiah(order.discountAmount)}</span>
            </div>
          )}
          <div className="pt-row">
            <span>Total</span>
            <span>{rupiah(order.total)}</span>
          </div>
          <div className="pt-row">
            <span>Dibayar</span>
            <span>{rupiah(order.paid)}</span>
          </div>
          <div className="pt-row">
            <span>Metode</span>
            <span>{order.paymentMethod === 'qris' ? 'QRIS' : 'Tunai'}</span>
          </div>
          <div className="pt-row">
            <span>Kembalian</span>
            <span>{rupiah(order.change)}</span>
          </div>
          <div className="pt-rule" />
          <div className="pt-lunas">LUNAS</div>
          <div className="pt-footer">Terima kasih</div>
          <div className="pt-powered">powered by Slovana Inovasi Digital</div>
        </>
      ) : (
        <>
          <div className="pt-rule" />
          <div className="pt-footer">Siapkan pesanan</div>
          <div className="pt-powered">powered by Slovana Inovasi Digital</div>
        </>
      )}
    </div>
  )
}
