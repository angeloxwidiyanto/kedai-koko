import { motion } from 'framer-motion'

const STEPS = [
  {
    icon: 'restaurant_menu',
    title: '1. Pilih menu',
    desc: 'Tekan kategori, lalu pilih makanan atau minuman yang diinginkan.',
  },
  {
    icon: 'add_circle',
    title: '2. Tambah pesanan',
    desc: 'Tekan tombol Tambah. Tekan lagi untuk menambah jumlah.',
  },
  {
    icon: 'payments',
    title: '3. Bayar',
    desc: 'Tekan Selesaikan Pesanan, masukkan uang dari pelanggan, lalu Konfirmasi.',
  },
  {
    icon: 'celebration',
    title: '4. Selesai',
    desc: 'Lihat kembalian di layar dan berikan bersama pesanan.',
  },
]

export default function HelpPage() {
  return (
    <div className="page-inner">
      <div className="page-heading">
        <h1>Bantuan</h1>
        <p>Cara menggunakan kasir Kedai Koko.</p>
      </div>

      <div className="help-steps">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.title}
            className="help-step"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <span className="help-icon">
              <span className="material-symbols-outlined">{s.icon}</span>
            </span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
