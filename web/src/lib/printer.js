// Lapisan printer untuk Kedai Koko:
// 1. RawBT (Android/Samsung Tab via Bluetooth/USB - WebSocket & Intent)
// 2. WebUSB (PC/Laptop Chrome via kabel USB - ESC/POS)
// 3. Browser Print (Dialog sistem / PDF)

const MODE_KEY = 'kedaikoko_print_mode'

let currentDevice = null
const listeners = new Set()
const modeListeners = new Set()

export function isAndroid() {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '')
}

export function isWebUsbSupported() {
  return typeof navigator !== 'undefined' && !!navigator.usb
}

// Kompatibilitas mundur
export function isSupported() {
  return isWebUsbSupported()
}

export function getPrintMode() {
  if (typeof window === 'undefined') return 'browser'
  const saved = localStorage.getItem(MODE_KEY)
  if (saved === 'rawbt' || saved === 'webusb' || saved === 'browser') {
    return saved
  }
  // Default: jika di Android/tablet gunakan RawBT, jika di PC Chrome gunakan WebUSB
  if (isAndroid()) return 'rawbt'
  if (isWebUsbSupported()) return 'webusb'
  return 'browser'
}

export function setPrintMode(mode) {
  if (mode !== 'rawbt' && mode !== 'webusb' && mode !== 'browser') return
  localStorage.setItem(MODE_KEY, mode)
  modeListeners.forEach((fn) => fn(mode))
}

export function subscribeMode(fn) {
  modeListeners.add(fn)
  fn(getPrintMode())
  return () => modeListeners.delete(fn)
}

function notify() {
  listeners.forEach((fn) => fn(currentDevice))
}

export function subscribe(fn) {
  listeners.add(fn)
  fn(currentDevice)
  return () => listeners.delete(fn)
}

export function getDevice() {
  return currentDevice
}

// ===== WebUSB Driver =====

export async function autoReconnect() {
  if (!isWebUsbSupported() || currentDevice) return
  try {
    const devices = await navigator.usb.getDevices()
    if (devices.length === 0) return
    await claim(devices[0])
  } catch {
    /* tidak masalah, user bisa connect manual */
  }
}

export async function connect() {
  if (!isWebUsbSupported()) throw new Error('Browser tidak mendukung WebUSB (butuh Chrome/Edge)')
  const device = await navigator.usb.requestDevice({ filters: [{ classCode: 7 }] })
  await claim(device)
  return device
}

async function claim(device) {
  await device.open()
  let claimed = false
  const config = device.configuration || device.configurations[0]
  for (const iface of config.interfaces) {
    const hasOut = iface.alternates[0].endpoints.some((e) => e.direction === 'out')
    if (!hasOut) continue
    try {
      await device.claimInterface(iface.interfaceNumber)
      claimed = true
      break
    } catch {
      /* coba interface berikutnya */
    }
  }
  if (!claimed) throw new Error('Printer tidak memiliki endpoint output yang bisa dipakai')

  currentDevice = device
  notify()
}

export function send(bytes) {
  if (!currentDevice) throw new Error('Printer belum tersambung via USB')
  const config = currentDevice.configuration || currentDevice.configurations[0]
  for (const iface of config.interfaces) {
    for (const ep of iface.alternates[0].endpoints) {
      if (ep.direction === 'out') {
        return currentDevice.transferOut(ep.endpointNumber, bytes)
      }
    }
  }
  throw new Error('Endpoint output tidak ditemukan')
}

export async function disconnect() {
  if (!currentDevice) return
  try {
    await currentDevice.close()
  } catch {
    /* ignore */
  }
  currentDevice = null
  notify()
}

export async function print(bytes) {
  await send(bytes)
}

// ===== RawBT Driver (Android POS) =====

export function uint8ToBase64(bytes) {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

// Mencoba cetak melalui local WebSocket RawBT (port 40213)
// Keuntungan: cetak langsung di background tanpa alih layar (silent)
export function printViaRawBTWebSocket(bytes, timeoutMs = 800) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket === 'undefined') {
      reject(new Error('WebSocket tidak didukung di browser ini'))
      return
    }

    let finished = false
    let ws
    try {
      ws = new WebSocket('ws://127.0.0.1:40213')
      ws.binaryType = 'arraybuffer'
    } catch (e) {
      reject(e)
      return
    }

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true
        try { ws.close() } catch {}
        reject(new Error('Timeout menghubungi RawBT WebSocket'))
      }
    }, timeoutMs)

    ws.onopen = () => {
      try {
        ws.send(bytes.buffer)
        setTimeout(() => {
          if (!finished) {
            finished = true
            clearTimeout(timer)
            try { ws.close() } catch {}
            resolve({ method: 'websocket' })
          }
        }, 150)
      } catch (err) {
        if (!finished) {
          finished = true
          clearTimeout(timer)
          try { ws.close() } catch {}
          reject(err)
        }
      }
    }

    ws.onerror = (err) => {
      if (!finished) {
        finished = true
        clearTimeout(timer)
        reject(new Error('RawBT WebSocket server tidak aktif'))
      }
    }
  })
}

// Mencoba cetak melalui Intent / URL Scheme RawBT
export function printViaRawBTIntent(bytes) {
  const base64 = uint8ToBase64(bytes)

  if (isAndroid()) {
    // Di Chrome/Edge Android, Intent URL langsung menembus ke RawBT tanpa refresh tab
    const intentUrl = `intent:${base64}#Intent;scheme=rawbt;type=application/octet-stream;package=ru.a402d.rawbtprinter;end;`
    const a = document.createElement('a')
    a.href = intentUrl
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      try { document.body.removeChild(a) } catch {}
    }, 1000)
    return { method: 'intent' }
  }

  // URL Scheme standar
  const schemeUrl = `rawbt:data:application/octet-stream;base64,${base64}`
  const a = document.createElement('a')
  a.href = schemeUrl
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    try { document.body.removeChild(a) } catch {}
  }, 1000)
  return { method: 'scheme' }
}

// Pipeline utama RawBT: WebSocket first -> Fallback ke Intent
export async function printRawBT(bytes) {
  try {
    return await printViaRawBTWebSocket(bytes, 700)
  } catch {
    return printViaRawBTIntent(bytes)
  }
}

// ===== Router Cetak Terpadu =====

export async function printData(bytes) {
  const mode = getPrintMode()
  if (mode === 'rawbt') {
    return await printRawBT(bytes)
  }
  if (mode === 'webusb') {
    return await print(bytes)
  }
  throw new Error('Mode dialog browser aktif (cetak via dialog print sistem)')
}
