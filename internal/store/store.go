package store

import (
	"errors"
	"os"
	"time"

	"kedaikoko/internal/model"
)

var (
	ErrProductNotFound    = errors.New("produk tidak ditemukan")
	ErrProductUnavailable = errors.New("produk tidak tersedia")
	ErrProductExists      = errors.New("produk sudah ada")
	ErrCategoryNotFound   = errors.New("kategori tidak ditemukan")
	ErrCategoryInUse      = errors.New("kategori masih dipakai produk")
	ErrEmptyOrder         = errors.New("pesanan masih kosong")
	ErrInvalidQty         = errors.New("jumlah barang tidak valid")
	ErrPaymentShort       = errors.New("pembayaran kurang dari total")
	ErrOrderNotFound      = errors.New("pesanan tidak ditemukan")
	ErrOrderNotPaid       = errors.New("pesanan tidak bisa dibatalkan")

	ErrUserNotFound   = errors.New("pengguna tidak ditemukan")
	ErrUserExists     = errors.New("nama pengguna sudah ada")
	ErrUserInactive   = errors.New("pengguna nonaktif")
	ErrInvalidPin     = errors.New("kode akses salah")
	ErrLastAdmin      = errors.New("minimal harus ada satu admin")
	ErrInvalidStock   = errors.New("jumlah stok tidak valid")

	ErrOrderTypeRequired = errors.New("jenis pesanan wajib dipilih")
	ErrTableNoRequired   = errors.New("nomor meja wajib diisi untuk makan di tempat")
	ErrOutOfPackaging    = errors.New("stok kemasan tidak cukup untuk pesanan bungkus")
	ErrInvalidPackaging  = errors.New("jumlah stok kemasan tidak valid")
	ErrPaymentMethod     = errors.New("metode pembayaran wajib dipilih")
)

type Store interface {
	// Kategori & produk
	Categories() ([]model.Category, error)
	Products(category string) ([]model.Product, error)
	ProductsAdmin() ([]model.Product, error)
	CreateProduct(p model.Product) (model.Product, error)
	UpdateProduct(p model.Product) (model.Product, error)
	SetProductAvailability(id string, available bool) (model.Product, error)
	SetProductStock(id string, stock int) (model.Product, error)
	ArchiveProduct(id string) error
	RestoreProduct(id string) error

	// Kategori
	CreateCategory(c model.Category) (model.Category, error)
	UpdateCategory(c model.Category) (model.Category, error)
	DeleteCategory(id string) error

	// Pengguna
	Users() ([]model.User, error)
	ActiveUsers() ([]model.User, error)
	GetUser(id string) (model.User, error)
	CreateUser(u model.User) (model.User, error)
	UpdateUser(u model.User, newPin string) (model.User, error)
	SetUserActive(id string, active bool) error
	DeleteUser(id string) error
	Authenticate(id, pin string) (model.User, error)

	// Pesanan
	CreateOrder(req model.CreateOrderRequest, cashier model.User) (model.Order, error)
	VoidOrder(id, reason, by string) (model.Order, error)
	Orders() ([]model.Order, error)
	OrdersRange(from, to time.Time) ([]model.Order, error)
	Report(from, to time.Time) (model.Report, error)

	// Stok kemasan
	GetPackagingStock() (int, error)
	SetPackagingStock(n int) error

	// Kesehatan koneksi (untuk keep-alive Supabase)
	Ping() error
}

var Default Store = NewMemory()

// Init memilih backend penyimpanan berdasarkan environment:
//   - DATABASE_URL (atau SUPABASE_DATABASE_URL) berisi → pakai Postgres (Supabase)
//   - kosong → pakai in-memory (untuk dev/prototype)
//
// Mengembalikan nama driver yang dipakai.
func Init() (string, error) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		url = os.Getenv("SUPABASE_DATABASE_URL")
	}
	if url == "" {
		Default = NewMemory()
		return "in-memory", nil
	}

	sqlStore, err := NewSQL(url)
	if err != nil {
		return "", err
	}
	Default = sqlStore
	return "postgres (supabase)", nil
}
