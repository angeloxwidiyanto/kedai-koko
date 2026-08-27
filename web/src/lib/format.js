export function rupiah(n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID')
}

export function timeID(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
