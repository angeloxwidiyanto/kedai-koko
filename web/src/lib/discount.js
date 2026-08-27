export function calcDiscount(subtotal, type, value) {
  if (!value || !type || value <= 0) return 0
  if (type === 'pct') {
    const p = Math.min(100, value)
    return Math.floor(subtotal * p / 100)
  }
  if (type === 'amt') {
    return Math.min(subtotal, value)
  }
  return 0
}
