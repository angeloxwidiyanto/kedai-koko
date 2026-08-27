package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"kedaikoko/internal/store"
)

func newTestMux() *http.ServeMux {
	mux := http.NewServeMux()
	Register(mux)
	return mux
}

func doJSON(mux *http.ServeMux, method, path, body string, token string) *httptest.ResponseRecorder {
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	return rr
}

func loginToken(t *testing.T, mux *http.ServeMux, pin string) string {
	t.Helper()
	rr := doJSON(mux, "POST", "/api/auth/login", `{"userId":"usr-admin","pin":"`+pin+`"}`, "")
	if rr.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", rr.Code, rr.Body.String())
	}
	var out struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &out)
	return out.Token
}

func TestTokenSignVerify(t *testing.T) {
	tok := SignToken("usr-x", "admin")
	p, ok := VerifyToken(tok)
	if !ok {
		t.Fatal("token should verify")
	}
	if p.UID != "usr-x" || p.Role != "admin" {
		t.Fatalf("wrong payload: %+v", p)
	}

	// token rusak harus ditolak
	if _, ok := VerifyToken(tok + "tampered"); ok {
		t.Fatal("tampered token should fail")
	}
}

func TestLoginFlow(t *testing.T) {
	old := store.Default
	store.Default = store.NewMemory()
	defer func() { store.Default = old }()

	mux := newTestMux()

	// tanpa token -> 401 di auth/me
	if rr := doJSON(mux, "GET", "/api/auth/me", "", ""); rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}

	// pin salah -> 401
	if rr := doJSON(mux, "POST", "/api/auth/login", `{"userId":"usr-admin","pin":"0000"}`, ""); rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong pin, got %d", rr.Code)
	}

	token := loginToken(t, mux, "1234")

	if rr := doJSON(mux, "GET", "/api/auth/me", "", token); rr.Code != http.StatusOK {
		t.Fatalf("auth/me with token: %d", rr.Code)
	}

	// auth/users publik
	if rr := doJSON(mux, "GET", "/api/auth/users", "", ""); rr.Code != http.StatusOK {
		t.Fatalf("auth/users should be public, got %d", rr.Code)
	}
}

func TestAdminOnlyEndpoints(t *testing.T) {
	old := store.Default
	store.Default = store.NewMemory()
	defer func() { store.Default = old }()

	mux := newTestMux()
	token := loginToken(t, mux, "1234")

	// admin bisa akses report
	if rr := doJSON(mux, "GET", "/api/reports/summary", "", token); rr.Code != http.StatusOK {
		t.Fatalf("admin report: %d", rr.Code)
	}

	// buat kasir, lalu login sebagai kasir
	rr := doJSON(mux, "POST", "/api/admin/users", `{"name":"Sari","pin":"5555","role":"kasir"}`, token)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create kasir: %d %s", rr.Code, rr.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &created)

	kasirToken := loginToken(t, mux, "1234") // admin; lalu kasir pakai user id
	_ = kasirToken
	kr := doJSON(mux, "POST", "/api/auth/login", `{"userId":"`+created.ID+`","pin":"5555"}`, "")
	var kout struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(kr.Body.Bytes(), &kout)

	// kasir diblokir dari report
	if rr := doJSON(mux, "GET", "/api/reports/summary", "", kout.Token); rr.Code != http.StatusUnauthorized {
		t.Fatalf("kasir report should be 401, got %d", rr.Code)
	}
	// kasir diblokir dari admin users
	if rr := doJSON(mux, "GET", "/api/admin/users", "", kout.Token); rr.Code != http.StatusUnauthorized {
		t.Fatalf("kasir admin/users should be 401, got %d", rr.Code)
	}
	// kasir bisa lihat produk
	if rr := doJSON(mux, "GET", "/api/products", "", kout.Token); rr.Code != http.StatusOK {
		t.Fatalf("kasir products: %d", rr.Code)
	}
}

func TestCreateOrderAndVoid(t *testing.T) {
	old := store.Default
	store.Default = store.NewMemory()
	defer func() { store.Default = old }()

	mux := newTestMux()
	token := loginToken(t, mux, "1234")

	rr := doJSON(mux, "POST", "/api/orders",
		`{"items":[{"productId":"rice-1","qty":2}],"paid":100000,"paymentMethod":"tunai","orderType":"take_away","discountType":"pct","discountValue":10}`, token)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create order: %d %s", rr.Code, rr.Body.String())
	}
	var order struct {
		ID             string `json:"id"`
		DiscountAmount int    `json:"discountAmount"`
		Total          int    `json:"total"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &order)
	if order.DiscountAmount != 6000 || order.Total != 54000 {
		t.Fatalf("discount wrong: %+v", order)
	}

	vr := doJSON(mux, "POST", "/api/orders/"+order.ID+"/void", `{"reason":"salah"}`, token)
	if vr.Code != http.StatusOK {
		t.Fatalf("void: %d %s", vr.Code, vr.Body.String())
	}
}

func TestPackagingEndpoints(t *testing.T) {
	old := store.Default
	store.Default = store.NewMemory()
	defer func() { store.Default = old }()

	mux := newTestMux()
	token := loginToken(t, mux, "1234")

	// set stok kemasan kecil
	if rr := doJSON(mux, "PATCH", "/api/settings/packaging", `{"stock":1}`, token); rr.Code != http.StatusOK {
		t.Fatalf("set packaging: %d", rr.Code)
	}

	// order bungkus melebihi stok -> 422
	rr := doJSON(mux, "POST", "/api/orders",
		`{"items":[{"productId":"rice-1","qty":3}],"paid":100000,"paymentMethod":"tunai","orderType":"take_away"}`, token)
	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 out of packaging, got %d %s", rr.Code, rr.Body.String())
	}

	// tanpa orderType -> 400
	rr = doJSON(mux, "POST", "/api/orders",
		`{"items":[{"productId":"rice-1","qty":1}],"paid":30000}`, token)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 missing orderType, got %d", rr.Code)
	}

	// dine in tanpa meja -> 400
	rr = doJSON(mux, "POST", "/api/orders",
		`{"items":[{"productId":"rice-1","qty":1}],"paid":30000,"orderType":"dine_in"}`, token)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 missing tableNo, got %d", rr.Code)
	}

	// get stok kemasan (admin)
	if rr := doJSON(mux, "GET", "/api/settings/packaging", "", token); rr.Code != http.StatusOK {
		t.Fatalf("get packaging: %d", rr.Code)
	}
}
