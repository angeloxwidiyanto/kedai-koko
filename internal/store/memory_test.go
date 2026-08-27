package store

import (
	"errors"
	"testing"
	"time"

	"kedaikoko/internal/model"
)

func TestProductsFilterByCategory(t *testing.T) {
	s := newTestStore()

	all, err := s.Products("")
	if err != nil {
		t.Fatalf("Products('') error: %v", err)
	}
	if len(all) != len(defaultProducts) {
		t.Fatalf("expected %d products, got %d", len(defaultProducts), len(all))
	}

	rice, err := s.Products("rice")
	if err != nil {
		t.Fatalf("Products('rice') error: %v", err)
	}
	for _, p := range rice {
		if p.Category != "rice" {
			t.Fatalf("expected only rice, got %s (%s)", p.Name, p.Category)
		}
	}
}

func TestCategories(t *testing.T) {
	s := newTestStore()
	cats, err := s.Categories()
	if err != nil {
		t.Fatalf("Categories error: %v", err)
	}
	if len(cats) != len(defaultCategories) {
		t.Fatalf("expected %d categories, got %d", len(defaultCategories), len(cats))
	}
}

func TestCreateOrderCalculatesTotalAndChange(t *testing.T) {
	s := newTestStore()

	order, err := mkOrder(s, []model.OrderItemInput{
		itemReq("rice-1", 2, ""),   // 30000 * 2
		itemReq("drinks-1", 3, ""), // 8000 * 3
	}, 100000, "", 0)
	if err != nil {
		t.Fatalf("CreateOrder error: %v", err)
	}

	wantTotal := 2*30000 + 3*8000 // 84000
	if order.Total != wantTotal {
		t.Fatalf("expected total %d, got %d", wantTotal, order.Total)
	}
	if order.Subtotal != wantTotal {
		t.Fatalf("expected subtotal %d, got %d", wantTotal, order.Subtotal)
	}
	if order.Change != 100000-wantTotal {
		t.Fatalf("expected change %d, got %d", 100000-wantTotal, order.Change)
	}
	if order.Status != "paid" {
		t.Fatalf("expected status paid, got %s", order.Status)
	}
	if order.CashierName != "Admin" {
		t.Fatalf("expected cashier Admin, got %s", order.CashierName)
	}
}

func TestCreateOrderPreservesNote(t *testing.T) {
	s := newTestStore()
	order, err := mkOrder(s, []model.OrderItemInput{itemReq("drinks-3", 1, "kurang gula, tanpa es")}, 20000, "", 0)
	if err != nil {
		t.Fatalf("CreateOrder error: %v", err)
	}
	if order.Items[0].Note != "kurang gula, tanpa es" {
		t.Fatalf("note not preserved: %q", order.Items[0].Note)
	}
}

func TestCreateOrderErrors(t *testing.T) {
	s := newTestStore()

	t.Run("empty order", func(t *testing.T) {
		_, err := mkOrder(s, nil, 0, "", 0)
		if !errors.Is(err, ErrEmptyOrder) {
			t.Fatalf("expected ErrEmptyOrder, got %v", err)
		}
	})
	t.Run("invalid qty", func(t *testing.T) {
		_, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-1", 0, "")}, 100000, "", 0)
		if !errors.Is(err, ErrInvalidQty) {
			t.Fatalf("expected ErrInvalidQty, got %v", err)
		}
	})
	t.Run("product not found", func(t *testing.T) {
		_, err := mkOrder(s, []model.OrderItemInput{itemReq("nonexistent", 1, "")}, 100000, "", 0)
		if !errors.Is(err, ErrProductNotFound) {
			t.Fatalf("expected ErrProductNotFound, got %v", err)
		}
	})
	t.Run("payment short", func(t *testing.T) {
		_, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-2", 1, "")}, 100, "", 0)
		if !errors.Is(err, ErrPaymentShort) {
			t.Fatalf("expected ErrPaymentShort, got %v", err)
		}
	})
	t.Run("missing paid treated as short", func(t *testing.T) {
		_, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-1", 1, "")}, 0, "", 0)
		if !errors.Is(err, ErrPaymentShort) {
			t.Fatalf("expected ErrPaymentShort for paid=0, got %v", err)
		}
	})
}

func TestDiscount(t *testing.T) {
	s := newTestStore()

	t.Run("percent", func(t *testing.T) {
		o, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-1", 1, "")}, 30000, "pct", 10) // 30000 - 3000
		if err != nil {
			t.Fatalf("err: %v", err)
		}
		if o.DiscountAmount != 3000 || o.Total != 27000 {
			t.Fatalf("pct: discount=%d total=%d", o.DiscountAmount, o.Total)
		}
	})
	t.Run("amount", func(t *testing.T) {
		o, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-1", 1, "")}, 30000, "amt", 5000)
		if err != nil {
			t.Fatalf("err: %v", err)
		}
		if o.DiscountAmount != 5000 || o.Total != 25000 {
			t.Fatalf("amt: discount=%d total=%d", o.DiscountAmount, o.Total)
		}
	})
	t.Run("amount capped at subtotal", func(t *testing.T) {
		o, err := mkOrder(s, []model.OrderItemInput{itemReq("drinks-5", 1, "")}, 5000, "amt", 99999)
		if err != nil {
			t.Fatalf("err: %v", err)
		}
		if o.Total != 0 {
			t.Fatalf("expected total 0, got %d", o.Total)
		}
	})
}

func TestStockDecrementAndBlock(t *testing.T) {
	s := newTestStore()
	if _, err := s.SetProductStock("rice-1", 2); err != nil {
		t.Fatalf("SetProductStock: %v", err)
	}

	// pesan 2 -> stok habis
	if _, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-1", 2, "")}, 60000, "", 0); err != nil {
		t.Fatalf("order 2 should succeed: %v", err)
	}

	prod, err := s.ProductsAdmin()
	if err != nil {
		t.Fatal(err)
	}
	var rice model.Product
	for _, pp := range prod {
		if pp.ID == "rice-1" {
			rice = pp
		}
	}
	if rice.Stock != 0 || rice.Available {
		t.Fatalf("expected stock 0 & unavailable, got stock=%d available=%v", rice.Stock, rice.Available)
	}

	// pesan lagi -> ditolak
	if _, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-1", 1, "")}, 30000, "", 0); !errors.Is(err, ErrProductUnavailable) {
		t.Fatalf("expected ErrProductUnavailable, got %v", err)
	}
}

func TestVoidOrder(t *testing.T) {
	s := newTestStore()
	if _, err := s.SetProductStock("rice-3", 5); err != nil {
		t.Fatal(err)
	}
	o, err := mkOrder(s, []model.OrderItemInput{itemReq("rice-3", 1, "")}, 55000, "", 0)
	if err != nil {
		t.Fatalf("order: %v", err)
	}

	vo, err := s.VoidOrder(o.ID, "salah input", "Admin")
	if err != nil {
		t.Fatalf("void: %v", err)
	}
	if vo.Status != "void" || vo.VoidReason != "salah input" {
		t.Fatalf("void fields wrong: %+v", vo)
	}

	// stok kembali
	prod, _ := s.ProductsAdmin()
	for _, p := range prod {
		if p.ID == "rice-3" && p.Stock != 5 {
			t.Fatalf("expected stock restored to 5, got %d", p.Stock)
		}
	}

	// report harus mengecualikan void
	r, _ := s.Report(time.Now().Add(-24*time.Hour), time.Now().Add(24*time.Hour))
	if r.OrderCount != 0 || r.TotalRevenue != 0 {
		t.Fatalf("void order should not count: count=%d rev=%d", r.OrderCount, r.TotalRevenue)
	}

	// void lagi -> error
	if _, err := s.VoidOrder(o.ID, "x", "Admin"); !errors.Is(err, ErrOrderNotPaid) {
		t.Fatalf("expected ErrOrderNotPaid, got %v", err)
	}
}
