// Lapisan WebUSB untuk printer termal (SNBC BTP-U60, ESC/POS).

let currentDevice = null
const listeners = new Set()

export function isSupported() {
  return typeof navigator !== 'undefined' && !!navigator.usb
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

// Ambil kembali device yang sudah diizinkan Chrome (auto-reclaim saat reload)
export async function autoReconnect() {
  if (!isSupported() || currentDevice) return
  try {
    const devices = await navigator.usb.getDevices()
    if (devices.length === 0) return
    await claim(devices[0])
  } catch {
    /* tidak masalah, user bisa connect manual */
  }
}

export async function connect() {
  if (!isSupported()) throw new Error('Browser tidak mendukung WebUSB (butuh Chrome)')
  const device = await navigator.usb.requestDevice({ filters: [{ classCode: 7 }] })
  await claim(device)
  return device
}

async function claim(device) {
  await device.open()
  // pilih konfigurasi & klaim interface pertama yang ada endpoint OUT
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
  if (!currentDevice) throw new Error('Printer belum tersambung')
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
