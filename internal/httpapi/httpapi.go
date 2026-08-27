package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"

	"kedaikoko/internal/model"
	"kedaikoko/internal/store"
)

func corsOrigin() string {
	if o := os.Getenv("CORS_ORIGIN"); o != "" {
		return o
	}
	return "*"
}

func setHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", corsOrigin())
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token, Authorization")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	setHeaders(w)
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func handleOptions(w http.ResponseWriter, r *http.Request) {
	setHeaders(w)
	w.WriteHeader(http.StatusNoContent)
}

func apiNotFound(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotFound, "endpoint tidak ditemukan")
}

// Register mendaftarkan seluruh route API ke mux.
func Register(mux *http.ServeMux) {
	mux.HandleFunc("OPTIONS /api/", handleOptions)

	// Auth
	mux.HandleFunc("GET /api/auth/users", HandleAuthUsers)
	mux.HandleFunc("GET /api/auth/me", HandleAuthMe)
	mux.HandleFunc("POST /api/auth/login", HandleLogin)

	// Kesehatan (keep-alive Supabase)
	mux.HandleFunc("GET /api/health", HandleHealth)

	// POS
	mux.HandleFunc("GET /api/products", HandleProducts)
	mux.HandleFunc("GET /api/categories", HandleCategories)
	mux.HandleFunc("GET /api/orders", HandleOrders)
	mux.HandleFunc("POST /api/orders", HandleOrders)
	mux.HandleFunc("POST /api/orders/{id}/void", HandleVoidOrder)

	// Admin
	mux.HandleFunc("GET /api/admin/products", HandleAdminProducts)
	mux.HandleFunc("GET /api/admin/users", HandleAdminUsers)
	mux.HandleFunc("POST /api/admin/users", HandleCreateUser)
	mux.HandleFunc("PUT /api/admin/users/{id}", HandleUpdateUser)
	mux.HandleFunc("DELETE /api/admin/users/{id}", HandleDeleteUser)
	mux.HandleFunc("GET /api/reports/summary", HandleReport)
	mux.HandleFunc("GET /api/reports/orders.csv", HandleReportCSV)
	mux.HandleFunc("GET /api/settings/packaging", HandleGetPackaging)
	mux.HandleFunc("PATCH /api/settings/packaging", HandleSetPackaging)

	mux.HandleFunc("POST /api/products", HandleCreateProduct)
	mux.HandleFunc("PUT /api/products/{id}", HandleUpdateProduct)
	mux.HandleFunc("PATCH /api/products/{id}/availability", HandleSetAvailability)
	mux.HandleFunc("PATCH /api/products/{id}/stock", HandleSetStock)
	mux.HandleFunc("POST /api/products/{id}/archive", HandleArchiveProduct)
	mux.HandleFunc("POST /api/products/{id}/restore", HandleRestoreProduct)

	mux.HandleFunc("POST /api/categories", HandleCreateCategory)
	mux.HandleFunc("PUT /api/categories/{id}", HandleUpdateCategory)
	mux.HandleFunc("DELETE /api/categories/{id}", HandleDeleteCategory)

	mux.HandleFunc("/api/", apiNotFound)
}

func HandleAuthUsers(w http.ResponseWriter, r *http.Request) {
	users, err := store.Default.ActiveUsers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil data pengguna")
		return
	}
	// hanya tampilkan id, nama, role (tanpa hash PIN)
	type pub struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Role string `json:"role"`
	}
	out := make([]pub, 0, len(users))
	for _, u := range users {
		out = append(out, pub{ID: u.ID, Name: u.Name, Role: u.Role})
	}
	writeJSON(w, http.StatusOK, out)
}

func HandleHealth(w http.ResponseWriter, r *http.Request) {
	if err := store.Default.Ping(); err != nil {
		writeError(w, http.StatusServiceUnavailable, "database tidak terjangkau")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func HandleAuthMe(w http.ResponseWriter, r *http.Request) {
	u, ok := currentUser(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func HandleProducts(w http.ResponseWriter, r *http.Request) {
	if !authorized(r) {
		writeError(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	products, err := store.Default.Products(r.URL.Query().Get("category"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil data produk")
		return
	}
	writeJSON(w, http.StatusOK, products)
}

func HandleAdminProducts(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	products, err := store.Default.ProductsAdmin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil data produk")
		return
	}
	writeJSON(w, http.StatusOK, products)
}

func HandleCategories(w http.ResponseWriter, r *http.Request) {
	if !authorized(r) {
		writeError(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	categories, err := store.Default.Categories()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil data kategori")
		return
	}
	writeJSON(w, http.StatusOK, categories)
}

func HandleOrders(w http.ResponseWriter, r *http.Request) {
	if !authorized(r) {
		writeError(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	switch r.Method {
	case http.MethodGet:
		orders, err := store.Default.Orders()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "gagal mengambil data pesanan")
			return
		}
		writeJSON(w, http.StatusOK, orders)
	case http.MethodPost:
		createOrder(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "metode tidak didukung")
	}
}

func createOrder(w http.ResponseWriter, r *http.Request) {
	u, ok := currentUser(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	var req model.CreateOrderRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "data pesanan tidak valid")
		return
	}

	order, err := store.Default.CreateOrder(req, u)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrEmptyOrder),
			errors.Is(err, store.ErrInvalidQty),
			errors.Is(err, store.ErrProductNotFound),
			errors.Is(err, store.ErrOrderTypeRequired),
			errors.Is(err, store.ErrTableNoRequired),
			errors.Is(err, store.ErrPaymentMethod):
			writeError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, store.ErrProductUnavailable),
			errors.Is(err, store.ErrOutOfPackaging):
			writeError(w, http.StatusUnprocessableEntity, err.Error())
		case errors.Is(err, store.ErrPaymentShort):
			writeError(w, http.StatusUnprocessableEntity, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "terjadi kesalahan pada server")
		}
		return
	}
	writeJSON(w, http.StatusCreated, order)
}
