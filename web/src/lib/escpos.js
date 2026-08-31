// Builder ESC/POS untuk printer termal (SNBC BTP-U60, 80mm).
// Semua output berupa Uint8Array perintah ESC/POS.

const WIDTH = 48 // 80mm, Font A (48 karakter/baris)

// Perintah dasar
const ESC = 0x1b
const GS = 0x1d

const out = []
let bytes

function push(...b) {
  bytes.push(...b)
}

function txt(s) {
  for (let i = 0; i < s.length; i++) {
    bytes.push(s.charCodeAt(i) & 0xff)
  }
}

function line(s) {
  txt(s)
  push(0x0a) // LF
}

// Hapus emoji & karakter non-ASCII (printer termal tidak mendukung)
function clean(s) {
  return String(s == null ? '' : s)
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function padRight(s, n) {
  s = clean(s)
  if (s.length > n) s = s.slice(0, n)
  return s + ' '.repeat(n - s.length)
}

function center(s) {
  const c = clean(s)
  const left = Math.max(0, Math.floor((WIDTH - c.length) / 2))
  return ' '.repeat(left) + c
}

function divider() {
  line('-'.repeat(WIDTH))
}

function init() {
  bytes = []
  push(ESC, 0x40) // ESC @ init
}

function bold(on) {
  push(ESC, 0x45, on ? 1 : 0) // ESC E n
}

function align(n) {
  push(ESC, 0x61, n) // ESC a n (0=left,1=center,2=right)
}

function size(n) {
  push(GS, 0x21, n) // GS ! n (0=normal, 17=double width)
}

function feed(n) {
  push(ESC, 0x64, n) // ESC d n
}

function cut() {
  push(GS, 0x56, 66, 0) // GS V B 0 (partial cut)
}

function header(title) {
  align(1)
  size(1)
  line('KEDAI KOKO')
  size(0)
  line(title)
  align(0)
  divider()
}

// Tiket dapur
export function kitchenTicket(order) {
  init()
  header('TIKET DAPUR')

  const rows = [
    ['No.', order.number],
    ['Waktu', new Date(order.createdAt).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })],
  ]
  if (order.orderType === 'dine_in') {
    rows.push(['Jenis', `Makan di Tempat · Meja ${order.tableNo || '-'}`])
  } else {
    rows.push(['Jenis', 'Bungkus'])
  }

  for (const [k, v] of rows) {
    line(padRight(k, 6) + clean(v))
  }
  divider()

  for (const it of order.items) {
    line(`${it.qty}x ${clean(it.name)}`)
    if (it.note) line('  ' + clean(it.note))
  }
  divider()

  align(1)
  line('Siapkan pesanan')
  feed(3)
  cut()
  return Uint8Array.from(bytes)
}

// Struk pembayaran
export function receipt(order) {
  init()
  header('STRUK PEMBAYARAN')

  const rows = [
    ['No.', order.number],
    ['Waktu', new Date(order.createdAt).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })],
  ]
  if (order.orderType === 'dine_in') {
    rows.push(['Meja', order.tableNo || '-'])
  }
  for (const [k, v] of rows) {
    line(padRight(k, 6) + clean(v))
  }
  divider()

  for (const it of order.items) {
    line(padRight(`${it.qty}x ${it.name}`, WIDTH - 10) + padRight(rupiah(it.price * it.qty), 10))
    if (it.note) line('  ' + clean(it.note))
  }
  divider()

  line(padRight('Subtotal', WIDTH - 10) + padRight(rupiah(order.subtotal || order.total), 10))
  if (order.discountAmount > 0) {
    line(padRight('Diskon', WIDTH - 10) + padRight('-' + rupiah(order.discountAmount), 10))
  }
  bold(true)
  line(padRight('TOTAL', WIDTH - 10) + padRight(rupiah(order.total), 10))
  bold(false)
  line(padRight('Dibayar', WIDTH - 10) + padRight(rupiah(order.paid), 10))
  line(padRight('Kembalian', WIDTH - 10) + padRight(rupiah(order.change), 10))
  line(padRight('Metode', WIDTH - 10) + padRight(order.paymentMethod === 'qris' ? 'QRIS' : 'TUNAI', 10))
  divider()

  align(1)
  bold(true)
  line('LUNAS')
  bold(false)
  line('Terima kasih')
  feed(3)
  cut()
  return Uint8Array.from(bytes)
}

// Uji cetak
export function testTicket() {
  init()
  align(1)
  size(1)
  line('KEDAI KOKO')
  size(0)
  divider()
  line(center('Test Printer OK'))
  line(center('Pesan ini tercetak'))
  line(center('dari aplikasi kasir.'))
  feed(3)
  cut()
  return Uint8Array.from(bytes)
}

function rupiah(n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID')
}
