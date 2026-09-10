// Builder ESC/POS untuk printer termal (80mm / Font A, lebar 42 kolom).
// Semua output berupa Uint8Array perintah ESC/POS.

import { LOGO_RASTER_B64 } from './logo_raster'

const WIDTH = 42 // Lebar cetak thermal printer standar (42 kolom tanpa terpotong)

// Perintah dasar
const ESC = 0x1b
const GS = 0x1d

let bytes = []

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

// Format 2 kolom: kiri rata kiri, kanan rata kanan pas di batas lebar kertas
function twoCol(left, right, width = WIDTH) {
  left = clean(left)
  right = clean(right)
  const spaces = Math.max(1, width - left.length - right.length)
  return left + ' '.repeat(spaces) + right
}

// Format baris item: jika nama terlalu panjang, harga tetap rata kanan tanpa memotong nominal
function itemRow(qtyName, priceStr, width = WIDTH) {
  qtyName = clean(qtyName)
  priceStr = clean(priceStr)
  if (qtyName.length + priceStr.length + 1 <= width) {
    return [twoCol(qtyName, priceStr, width)]
  }
  return [
    qtyName,
    ' '.repeat(Math.max(1, width - priceStr.length)) + priceStr,
  ]
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

function printLogo() {
  if (!LOGO_RASTER_B64) return
  align(1)
  const binary = atob(LOGO_RASTER_B64)
  for (let i = 0; i < binary.length; i++) {
    push(binary.charCodeAt(i) & 0xff)
  }
  push(0x0a) // LF
}

function header(title, withLogo = false) {
  align(1)
  if (withLogo) {
    printLogo()
    feed(1)
  } else {
    size(1)
    line('KEDAI KOKO')
  }
  size(0)
  line(title)
  align(0)
  divider()
}

// Tiket dapur
export function kitchenTicket(order) {
  init()
  header('TIKET DAPUR', false)

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
    line(padRight(k, 7) + clean(v))
  }
  divider()

  for (const it of order.items) {
    line(`${it.qty}x ${clean(it.name)}`)
    if (it.note) line('  ' + clean(it.note))
  }
  divider()

  align(1)
  line('Siapkan pesanan')
  feed(1)
  line('powered by Solvana Inovasi Digital')
  feed(3)
  cut()
  return Uint8Array.from(bytes)
}

// Struk pembayaran
export function receipt(order) {
  init()
  header('STRUK PEMBAYARAN', true)

  const rows = [
    ['No.', order.number],
    ['Waktu', new Date(order.createdAt).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })],
  ]
  if (order.orderType === 'dine_in') {
    rows.push(['Meja', order.tableNo || '-'])
  }
  for (const [k, v] of rows) {
    line(padRight(k, 7) + clean(v))
  }
  divider()

  for (const it of order.items) {
    const qtyName = `${it.qty}x ${it.name}`
    const priceStr = rupiah(it.price * it.qty)
    const lines = itemRow(qtyName, priceStr)
    for (const l of lines) {
      line(l)
    }
    if (it.note) line('  ' + clean(it.note))
  }
  divider()

  line(twoCol('Subtotal', rupiah(order.subtotal || order.total)))
  if (order.discountAmount > 0) {
    line(twoCol('Diskon', '-' + rupiah(order.discountAmount)))
  }
  bold(true)
  line(twoCol('TOTAL', rupiah(order.total)))
  bold(false)
  line(twoCol('Dibayar', rupiah(order.paid)))
  line(twoCol('Kembalian', rupiah(order.change)))
  line(twoCol('Metode', order.paymentMethod === 'qris' ? 'QRIS' : 'TUNAI'))
  divider()

  align(1)
  bold(true)
  line('LUNAS')
  bold(false)
  line('Terima kasih')
  feed(1)
  line('powered by Solvana Inovasi Digital')
  feed(3)
  cut()
  return Uint8Array.from(bytes)
}

// Uji cetak
export function testTicket() {
  init()
  header('TEST PRINTER', true)
  line(center('Test Printer OK'))
  line(center('Pesan ini tercetak'))
  line(center('dari aplikasi kasir.'))
  feed(1)
  line(center('powered by Solvana Inovasi Digital'))
  feed(3)
  cut()
  return Uint8Array.from(bytes)
}

function rupiah(n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID')
}


