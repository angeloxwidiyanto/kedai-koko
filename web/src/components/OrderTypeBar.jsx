import { useShop } from '../shop'

export default function OrderTypeBar() {
  const { orderType, setOrderType, tableNo, setTableNo } = useShop()

  return (
    <div className="ordertype-bar">
      <button
        type="button"
        className={`ordertype-option ${orderType === 'dine_in' ? 'active' : ''}`}
        onClick={() => setOrderType('dine_in')}
      >
        <span className="material-symbols-outlined">restaurant</span>
        <span className="ot-label">Makan di Tempat</span>
      </button>
      <button
        type="button"
        className={`ordertype-option ${orderType === 'take_away' ? 'active' : ''}`}
        onClick={() => setOrderType('take_away')}
      >
        <span className="material-symbols-outlined">shopping_bag</span>
        <span className="ot-label">Bungkus</span>
      </button>

      {orderType === 'dine_in' && (
        <div className="table-input-wrap">
          <label htmlFor="table-no">Meja</label>
          <input
            id="table-no"
            className="table-input"
            type="text"
            inputMode="text"
            value={tableNo}
            onChange={(e) => setTableNo(e.target.value)}
            placeholder="No. meja"
            aria-label="Nomor meja"
          />
        </div>
      )}
    </div>
  )
}
