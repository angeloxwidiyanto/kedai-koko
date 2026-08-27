package store

import (
	"errors"
	"testing"
	"time"

	"kedaikoko/internal/model"
)

func TestReportAggregates(t *testing.T) {
	s := newTestStore()
	now := time.Now()
	from := now.Add(-24 * time.Hour)
	to := now.Add(24 * time.Hour)

	if _, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-1", 2, ""), itemReq("drinks-1", 1, "")}, 100000, "", 0); err != nil {
		t.Fatalf("CreateOrder 1: %v", err)
	}
	if _, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-1", 1, "")}, 30000, "", 0); err != nil {
		t.Fatalf("CreateOrder 2: %v", err)
	}

	r, err := s.Report(from, to)
	if err != nil {
		t.Fatalf("Report: %v", err)
	}

	wantTotal := (2*30000 + 8000) + 30000 // 98000
	if r.TotalRevenue != wantTotal {
		t.Fatalf("TotalRevenue: want %d got %d", wantTotal, r.TotalRevenue)
	}
	if r.OrderCount != 2 {
		t.Fatalf("OrderCount: want 2 got %d", r.OrderCount)
	}
	if r.ItemsSold != 4 {
		t.Fatalf("ItemsSold: want 4 got %d", r.ItemsSold)
	}
	if r.AvgOrder != wantTotal/2 {
		t.Fatalf("AvgOrder: want %d got %d", wantTotal/2, r.AvgOrder)
	}
	if len(r.TopProducts) == 0 || r.TopProducts[0].ProductID != "rice-1" || r.TopProducts[0].Qty != 3 {
		t.Fatalf("top product wrong: %+v", r.TopProducts)
	}
	if len(r.RevenueByDay) == 0 {
		t.Fatal("expected revenue by day")
	}
	if len(r.ByCashier) == 0 || r.ByCashier[0].CashierName != "Admin" {
		t.Fatalf("by cashier wrong: %+v", r.ByCashier)
	}
	if len(r.ByCategory) == 0 {
		t.Fatal("expected by category")
	}
	if len(r.ByHour) != 24 {
		t.Fatalf("expected 24 hourly buckets, got %d", len(r.ByHour))
	}
}

func TestProductsHideArchived(t *testing.T) {
	s := newTestStore()
	if err := s.ArchiveProduct("rice-1"); err != nil {
		t.Fatalf("ArchiveProduct: %v", err)
	}
	pos, err := s.Products("")
	if err != nil {
		t.Fatalf("Products: %v", err)
	}
	for _, p := range pos {
		if p.ID == "rice-1" {
			t.Fatal("archived product should be hidden from Products()")
		}
	}
	admin, err := s.ProductsAdmin()
	if err != nil {
		t.Fatalf("ProductsAdmin: %v", err)
	}
	found := false
	for _, p := range admin {
		if p.ID == "rice-1" {
			found = true
			if !p.Archived {
				t.Fatal("expected rice-1 to be archived")
			}
		}
	}
	if !found {
		t.Fatal("archived product missing from ProductsAdmin()")
	}
}

func TestAvailabilityAndOrderBlocked(t *testing.T) {
	s := newTestStore()
	if _, err := s.SetProductAvailability("rice-2", false); err != nil {
		t.Fatalf("SetProductAvailability: %v", err)
	}
	_, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-2", 1, "")}, 55000, "", 0)
	if !errors.Is(err, ErrProductUnavailable) {
		t.Fatalf("expected ErrProductUnavailable, got %v", err)
	}
	if _, err := s.SetProductAvailability("rice-2", true); err != nil {
		t.Fatalf("restore: %v", err)
	}
	if _, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-2", 1, "")}, 55000, "", 0); err != nil {
		t.Fatalf("order after restore should work: %v", err)
	}
}

func TestProductCRUD(t *testing.T) {
	s := newTestStore()
	created, err := s.CreateProduct(model.Product{Name: "Ayam Bakar", Category: "rice", Price: 35000, Emoji: "🍗", Color: "#ffd7a0"})
	if err != nil {
		t.Fatalf("CreateProduct: %v", err)
	}
	if created.ID == "" || !created.Available || created.Stock != -1 {
		t.Fatalf("unexpected new product: %+v", created)
	}
	created.Name = "Ayam Bakar Madu"
	created.Price = 38000
	updated, err := s.UpdateProduct(created)
	if err != nil {
		t.Fatalf("UpdateProduct: %v", err)
	}
	if updated.Name != "Ayam Bakar Madu" || updated.Price != 38000 {
		t.Fatalf("update failed: %+v", updated)
	}
	if _, err := s.CreateProduct(model.Product{ID: created.ID, Name: "X"}); !errors.Is(err, ErrProductExists) {
		t.Fatalf("expected ErrProductExists, got %v", err)
	}
}

func TestCategoryCRUDAndInUse(t *testing.T) {
	s := newTestStore()
	c, err := s.CreateCategory(model.Category{Name: "Gorengan", Emoji: "🍟"})
	if err != nil {
		t.Fatalf("CreateCategory: %v", err)
	}
	if c.ID == "" {
		t.Fatal("expected generated category id")
	}
	c.Name = "Gorengan Baru"
	if _, err := s.UpdateCategory(c); err != nil {
		t.Fatalf("UpdateCategory: %v", err)
	}
	if err := s.DeleteCategory("rice"); !errors.Is(err, ErrCategoryInUse) {
		t.Fatalf("expected ErrCategoryInUse, got %v", err)
	}
	if err := s.DeleteCategory(c.ID); err != nil {
		t.Fatalf("DeleteCategory new: %v", err)
	}
}

func TestUserCRUDAndAuth(t *testing.T) {
	s := newTestStore()

	// admin seed sudah ada
	if _, err := s.Authenticate("usr-admin", "1234"); err != nil {
		t.Fatalf("admin should authenticate: %v", err)
	}

	// buat kasir
	h, _ := hashPin("9999")
	u, err := s.CreateUser(model.User{Name: "Budi", Role: "kasir", PinHash: h})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if !u.HasPin || !u.Active {
		t.Fatalf("new user wrong: %+v", u)
	}
	if _, err := s.Authenticate(u.ID, "9999"); err != nil {
		t.Fatalf("kasir should authenticate: %v", err)
	}
	if _, err := s.Authenticate(u.ID, "wrong"); !errors.Is(err, ErrInvalidPin) {
		t.Fatalf("expected ErrInvalidPin, got %v", err)
	}

	// duplikat nama
	if _, err := s.CreateUser(model.User{Name: "Budi", Role: "kasir", PinHash: h}); !errors.Is(err, ErrUserExists) {
		t.Fatalf("expected ErrUserExists, got %v", err)
	}

	// nonaktifkan
	if err := s.SetUserActive(u.ID, false); err != nil {
		t.Fatalf("SetUserActive: %v", err)
	}
	if _, err := s.Authenticate(u.ID, "9999"); !errors.Is(err, ErrUserInactive) {
		t.Fatalf("expected ErrUserInactive, got %v", err)
	}

	// hapus
	if err := s.DeleteUser(u.ID); err != nil {
		t.Fatalf("DeleteUser: %v", err)
	}
}

func TestLastAdminProtection(t *testing.T) {
	s := newTestStore()
	// hanya ada 1 admin (seed); tidak boleh dinonaktifkan / dihapus
	if err := s.SetUserActive("usr-admin", false); !errors.Is(err, ErrLastAdmin) {
		t.Fatalf("expected ErrLastAdmin on deactivate, got %v", err)
	}
	if err := s.DeleteUser("usr-admin"); !errors.Is(err, ErrLastAdmin) {
		t.Fatalf("expected ErrLastAdmin on delete, got %v", err)
	}

	// tidak boleh menurunkan admin terakhir menjadi kasir
	if _, err := s.UpdateUser(model.User{ID: "usr-admin", Name: "Admin", Role: "kasir"}, ""); !errors.Is(err, ErrLastAdmin) {
		t.Fatalf("expected ErrLastAdmin on demote, got %v", err)
	}

	// menambahkan admin kedua memungkinkan demote admin pertama
	h, _ := hashPin("5555")
	if _, err := s.CreateUser(model.User{Name: "Admin2", Role: "admin", PinHash: h}); err != nil {
		t.Fatalf("create admin2: %v", err)
	}
	if _, err := s.UpdateUser(model.User{ID: "usr-admin", Name: "Admin", Role: "kasir"}, ""); err != nil {
		t.Fatalf("demote with 2nd admin should work: %v", err)
	}
}
