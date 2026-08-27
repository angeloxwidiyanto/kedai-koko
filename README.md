# Kedai Koko — Aplikasi Kasir (Point of Sale)

Aplikasi kasir untuk kedai/kios makanan, dirancang khusus untuk pengguna remaja
dan pemuda dengan kebutuhan khusus. UI/UX mengikuti design system **"Inclusive
Warmth"** (warna hangat, kontras tinggi WCAG AAA, target sentuh 56px, tipografi
Atkinson Hyperlegible Next, dan animasi ramah).

**Stack:** React (Vite) di frontend + Golang di backend, di-deploy sebagai satu
server Go di Vercel (frontend di-build lalu di-embed ke binary Go).

## Struktur

```
Kedai Koko/
├── cmd/
│   └── server/          # Server Go (API + serve frontend ter-embed)
│       ├── main.go
│       ├── embed.go      # go:embed dist (build tag: embed)
│       └── embed_fallback.go
├── internal/
│   ├── model/           # Tipe data (Product, Order, dll)
│   ├── store/           # Backend data: Postgres (sql.go) + in-memory (memory.go)
│   └── httpapi/         # Handler HTTP /api/*
├── web/                 # Aplikasi React (Vite)
│   └── src/
├── go.mod
└── vercel.json
```

## Menjalankan secara lokal (development)

Mode dev memisahkan Vite (hot reload) dan API Go.

```bash
# Terminal 1 — jalankan API di :8080
go run ./cmd/server

# Terminal 2 — jalankan frontend di :5173 (proxy /api ke :8080)
cd web && npm install && npm run dev
```

Buka http://localhost:5173.

## Build production (satu binary)

```bash
cd web && npm install && npm run build && cd ..
go build -tags embed -o bin/server ./cmd/server
./bin/server
```

Buka http://localhost:8080 — aplikasi lengkap (frontend + API) dilayani oleh
satu binary Go.

## Deploy ke Vercel

1. **Push repo ke GitHub** (lihat bagian "GitHub" di bawah).
2. Import repo di Vercel: `Add New → Project → pilih repo`.
3. Vercel otomatis memakai `vercel.json` (framework `go` + build command yang
   meng-compile frontend lalu men-embed-nya ke binary Go).
4. Tambahkan **Environment Variables** di Vercel (Project → Settings → Environment Variables):
   - `DATABASE_URL` — connection string Supabase (Transaction pooler, port `6543`)
   - `AUTH_SECRET` — string acak panjang (mis. `openssl rand -hex 32`)
   - (opsional) `CORS_ORIGIN` — mis. `https://kedai-koko.vercel.app`

Tidak perlu setting tambahan. Server membaca `PORT` dari environment Vercel.

## GitHub (wajib untuk deploy)

Repo ini belum di-inisialisasi git. Langkahnya:

```bash
git init
git add .
git commit -m "Kedai Koko POS"
git branch -M main
git remote add origin https://github.com/USERNAME/kedai-koko.git
git push -u origin main
```

`.gitignore` sudah mengecualikan `.env` (password Supabase), `bin/`, `cmd/server/dist/`,
dan `node_modules/` — jadi kredensial tidak akan ikut ter-commit.

## Keep-alive Supabase (anti-pause)

Supabase free tier **pause otomatis setelah ~7 hari tanpa aktivitas**. Untuk mencegahnya,
panggil endpoint `/api/health` (sudah tersedia, melakukan ping ke database) secara berkala.

Cara termudah & gratis:
- **cron-job.org** (atau UptimeRobot / BetterStack) → buat job HTTP GET ke
  `https://<domain-vercel>/api/health` setiap **1× sehari** (atau tiap 6 jam).

Atau pakai **Vercel Cron Jobs** di `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/health", "schedule": "0 0 * * *" }
  ]
}
```

(Interval terpendek Vercel Cron free plan = 1× sehari, cukup untuk anti-pause.)

## API

| Method | Path                             | Role  | Deskripsi                        |
| ------ | -------------------------------- | ----- | -------------------------------- |
| GET    | `/api/auth/users`                | publik| daftar pengguna aktif (nama+role) |
| GET    | `/api/auth/me`                   | any   | profil user dari token           |
| POST   | `/api/auth/login`                | publik| login (`{userId, pin}`) → token  |
| GET    | `/api/health`                    | publik| ping DB (keep-alive Supabase)    |
| GET    | `/api/products`                  | any   | daftar produk aktif (`?category=`) |
| GET    | `/api/categories`                | any   | daftar kategori                  |
| GET    | `/api/orders`                    | any   | riwayat pesanan                  |
| POST   | `/api/orders`                    | any   | buat pesanan baru                |
| POST   | `/api/orders/{id}/void`          | any   | batalkan pesanan                 |
| GET    | `/api/reports/summary`           | admin | ringkasan keuangan (`?from=&to=`) |
| GET    | `/api/reports/orders.csv`        | admin | export CSV                       |
| GET    | `/api/settings/packaging`        | admin | lihat stok kemasan               |
| PATCH  | `/api/settings/packaging`        | admin | set/isi ulang stok kemasan       |
| GET    | `/api/admin/products`            | admin | semua produk (termasuk arsip)    |
| GET    | `/api/admin/users`               | admin | semua pengguna                   |
| POST   | `/api/admin/users`               | admin | tambah pengguna                  |
| PUT    | `/api/admin/users/{id}`          | admin | ubah pengguna                    |
| DELETE | `/api/admin/users/{id}`          | admin | hapus pengguna                   |
| POST   | `/api/products`                  | admin | tambah produk                    |
| PUT    | `/api/products/{id}`             | admin | ubah produk                      |
| PATCH  | `/api/products/{id}/availability`| admin | toggle Sedia/Habis               |
| PATCH  | `/api/products/{id}/stock`       | admin | set stok                         |
| POST   | `/api/products/{id}/archive`     | admin | arsipkan produk                  |
| POST   | `/api/products/{id}/restore`     | admin | pulihkan produk                  |
| POST   | `/api/categories`                | admin | tambah kategori                  |
| PUT    | `/api/categories/{id}`           | admin | ubah kategori                    |
| DELETE | `/api/categories/{id}`           | admin | hapus kategori (ditolak bila terpakai) |

### Keamanan (login user-based)

Autentikasi memakai **akun user** (tabel `users`) dengan PIN yang di-hash bcrypt.

- Akun default: **Admin** dengan PIN `1234` (ubah setelah login pertama).
- Admin menambahkan kasir lewat menu **Admin → Pengguna**.
- Login menghasilkan **token HMAC** (ditandatangani `AUTH_SECRET`) yang berlaku 24 jam.
- Frontend mengirim token lewat header `Authorization: Bearer <token>`.
- Role: `admin` (laporan + kelola menu + pengguna + POS) vs `kasir` (hanya POS).
- Ada **rate limit** percobaan login gagal (5x → terkunci 2 menit).
- Ada **auto-logout** bila tidak ada aktivitas selama 5 menit.

`AUTH_SECRET` wajib diset di produksi (lihat `.env.example`).

Contoh body `POST /api/orders` (diskon opsional):

```json
{
  "items": [
    { "productId": "rice-1", "qty": 2 },
    { "productId": "drinks-1", "qty": 1, "note": "tanpa gula" }
  ],
  "paid": 100000,
  "orderType": "take_away",
  "tableNo": "",
  "discountType": "pct",
  "discountValue": 10
}
```

`orderType` wajib: `dine_in` (wajib isi `tableNo`) atau `take_away`.
`discountType` bisa `pct` (persen) atau `amt` (nominal).

**Stok kemasan (packaging)**: default `100`, dikelola admin. Order `take_away`
mengurangi kemasan **1 per satuan item**; `dine_in` tidak. Habis → order bungkus
ditolak (`422`). Void order bungkus mengembalikan stok kemasan.

Stok produk: `-1` = tanpa batas, `>=0` = dilacak (berkurang saat order, kembali saat void).

## Database (Supabase Postgres)

Aplikasi mendukung dua backend penyimpanan yang dipilih otomatis saat startup:

- **Tanpa `DATABASE_URL`** → in-memory (cocok untuk demo/prototype; pesanan hilang saat restart).
- **Dengan `DATABASE_URL`** → Postgres (Supabase). Tabel & data menu dibuat otomatis
  saat pertama kali connect (auto-migrate + seed).

### Koneksi lokal

1. Ambil connection string **Session pooler** dari Supabase:
   Project Settings → Database → Connection string → Session pooler (port `6543`).
2. Buat file `.env` di root project (lihat `.env.example`):

   ```
   DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
   ```

3. Jalankan seperti biasa — log akan menampilkan `Penyimpanan: postgres (supabase)`.

Skema: `categories`, `products`, `orders`, `order_items`, plus sequence `order_number_seq`
untuk nomor pesanan (`KK-0001`, `KK-0002`, dst).

### Koneksi di Vercel

Tambahkan environment variable `DATABASE_URL` di Vercel (Project → Settings →
Environment Variables). Gunakan **Session pooler / transaction pooler** (port `6543`),
bukan direct connection, agar aman untuk serverless (menghindari habisnya koneksi).

## Testing

```bash
go test ./...        # test backend (store + httpapi)
cd web && npm test   # test frontend (vitest)
```

## Catatan

- `npm audit` masih menampilkan 2 advisory (moderate/high) pada **dev-server Vite**
  (bukan bundle produksi). Aman untuk deploy; upgrade besar (Vite 7/8) bisa dilakukan
  nanti.
- Rate limiter login bersifat **in-memory** (per-instance). Di Vercel serverless ini
  "best-effort" — pertahanan utamanya tetap hashing bcrypt pada PIN.


