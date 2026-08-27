package httpapi

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"kedaikoko/internal/model"
	"kedaikoko/internal/store"
)

func hashPinForHTTP(pin string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// --- Rate limiter login (in-memory, best-effort di serverless) ---

type loginLimiter struct {
	mu       sync.Mutex
	attempts map[string]*attemptWindow
}

type attemptWindow struct {
	count    int
	blocked  time.Time
	lastSeen time.Time
}

var limiter = &loginLimiter{attempts: map[string]*attemptWindow{}}

const (
	maxAttempts     = 5
	lockoutDuration = 2 * time.Minute
	windowDuration  = 10 * time.Minute
)

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (l *loginLimiter) allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	w := l.attempts[ip]
	if w == nil {
		l.attempts[ip] = &attemptWindow{count: 0, lastSeen: now}
		return true
	}
	if now.Before(w.blocked) {
		return false
	}
	if now.Sub(w.lastSeen) > windowDuration {
		w.count = 0
	}
	return true
}

func (l *loginLimiter) success(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, ip)
}

func (l *loginLimiter) failure(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	w := l.attempts[ip]
	if w == nil {
		w = &attemptWindow{}
		l.attempts[ip] = w
	}
	w.count++
	w.lastSeen = now
	if w.count >= maxAttempts {
		w.blocked = now.Add(lockoutDuration)
		return true
	}
	return false
}

// --- Handlers ---

func HandleLogin(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r)
	if !limiter.allow(ip) {
		writeError(w, http.StatusTooManyRequests, "terlalu banyak percobaan, coba lagi nanti")
		return
	}

	var body struct {
		UserID string `json:"userId"`
		Pin    string `json:"pin"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if body.UserID == "" || body.Pin == "" {
		writeError(w, http.StatusBadRequest, "nama dan kode akses wajib diisi")
		return
	}

	u, err := store.Default.Authenticate(body.UserID, body.Pin)
	if err != nil {
		if limiter.failure(ip) {
			writeError(w, http.StatusTooManyRequests, "terlalu banyak percobaan, coba lagi nanti")
			return
		}
		switch {
		case errors.Is(err, store.ErrUserNotFound), errors.Is(err, store.ErrInvalidPin):
			writeError(w, http.StatusUnauthorized, "kode akses salah")
		case errors.Is(err, store.ErrUserInactive):
			writeError(w, http.StatusForbidden, "pengguna nonaktif")
		default:
			writeError(w, http.StatusInternalServerError, "terjadi kesalahan pada server")
		}
		return
	}

	limiter.success(ip)
	token := SignToken(u.ID, u.Role)
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": u})
}

func HandleAdminUsers(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	users, err := store.Default.Users()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil data pengguna")
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func HandleCreateUser(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	var body struct {
		Name string `json:"name"`
		Pin  string `json:"pin"`
		Role string `json:"role"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	if body.Pin == "" {
		writeError(w, http.StatusBadRequest, "kode akses wajib diisi")
		return
	}
	hash, err := hashPinForHTTP(body.Pin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal memproses kode akses")
		return
	}
	role := body.Role
	if role != "admin" {
		role = "kasir"
	}
	u, err := store.Default.CreateUser(model.User{Name: body.Name, Role: role, PinHash: hash})
	if err != nil {
		switch {
		case errors.Is(err, store.ErrUserExists):
			writeError(w, http.StatusConflict, err.Error())
		case errors.Is(err, store.ErrInvalidPin):
			writeError(w, http.StatusBadRequest, err.Error())
		default:
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusCreated, u)
}

func HandleUpdateUser(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	var body struct {
		Name    string `json:"name"`
		Pin     string `json:"pin"`
		Role    string `json:"role"`
		Active  *bool  `json:"active"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	id := r.PathValue("id")

	u := model.User{ID: id, Name: body.Name, Role: body.Role}
	updated, err := store.Default.UpdateUser(u, body.Pin)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrLastAdmin), errors.Is(err, store.ErrUserExists):
			writeError(w, http.StatusConflict, err.Error())
		default:
			writeError(w, http.StatusNotFound, err.Error())
		}
		return
	}
	if body.Active != nil {
		if err := store.Default.SetUserActive(id, *body.Active); err != nil {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		updated.Active = *body.Active
	}
	writeJSON(w, http.StatusOK, updated)
}

func HandleDeleteUser(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	if err := store.Default.DeleteUser(r.PathValue("id")); err != nil {
		if errors.Is(err, store.ErrLastAdmin) {
			writeError(w, http.StatusConflict, err.Error())
		} else {
			writeError(w, http.StatusNotFound, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "dihapus"})
}

func HandleVoidOrder(w http.ResponseWriter, r *http.Request) {
	if !authorized(r) {
		writeError(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	u, _ := currentUser(r)
	var body struct {
		Reason string `json:"reason"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	order, err := store.Default.VoidOrder(r.PathValue("id"), body.Reason, u.Name)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrOrderNotFound):
			writeError(w, http.StatusNotFound, err.Error())
		case errors.Is(err, store.ErrOrderNotPaid):
			writeError(w, http.StatusUnprocessableEntity, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "terjadi kesalahan pada server")
		}
		return
	}
	writeJSON(w, http.StatusOK, order)
}
