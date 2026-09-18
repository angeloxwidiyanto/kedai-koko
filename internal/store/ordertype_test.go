package store

import (
	"errors"
	"strings"
	"testing"

	"kedaikoko/internal/model"
)

func TestOrderTypeRequired(t *testing.T) {
	s := newTestStore()
	_, err := s.CreateOrder(model.CreateOrderRequest{
		Items: []model.OrderItemInput{itemReq("rice-1", 1, "")},
		Paid:  30000,
	}, testAdmin())
	if !errors.Is(err, ErrOrderTypeRequired) {
		t.Fatalf("expected ErrOrderTypeRequired, got %v", err)
	}
}

func TestTableNoRequiredForDineIn(t *testing.T) {
	s := newTestStore()
	_, err := s.CreateOrder(model.CreateOrderRequest{
		Items:         []model.OrderItemInput{itemReq("rice-1", 1, "")},
		Paid:          30000,
		OrderType:     "dine_in",
		PaymentMethod: "tunai",
	}, testAdmin())
	if !errors.Is(err, ErrTableNoRequired) {
		t.Fatalf("expected ErrTableNoRequired, got %v", err)
	}

	// dine in dengan meja sukses
	o, err := s.CreateOrder(model.CreateOrderRequest{
		Items:         []model.OrderItemInput{itemReq("rice-1", 1, "")},
		Paid:          30000,
		OrderType:     "dine_in",
		PaymentMethod: "tunai",
		TableNo:       "5",
	}, testAdmin())
	if err != nil {
		t.Fatalf("dine in with table: %v", err)
	}
	if o.OrderType != "dine_in" || o.TableNo != "5" {
		t.Fatalf("order fields wrong: %+v", o)
	}
}

func TestPackagingConsumedPerItem(t *testing.T) {
	s := newTestStore()
	s.packaging = 5

	// bungkus 3 item -> sisa 2
	o, err := s.CreateOrder(model.CreateOrderRequest{
		Items:         []model.OrderItemInput{itemReq("rice-1", 2, ""), itemReq("tea-1", 1, "")},
		Paid:          100000,
		OrderType:     "take_away",
		PaymentMethod: "tunai",
	}, testAdmin())
	if err != nil {
		t.Fatalf("order: %v", err)
	}
	if o.OrderType != "take_away" {
		t.Fatalf("wrong order type")
	}
	if s.packaging != 2 {
		t.Fatalf("expected packaging 2, got %d", s.packaging)
	}

	// dine in tidak memakan kemasan
	if _, err := s.CreateOrder(model.CreateOrderRequest{
		Items:         []model.OrderItemInput{itemReq("rice-1", 1, "")},
		Paid:          30000,
		OrderType:     "dine_in",
		PaymentMethod: "tunai",
		TableNo:       "3",
	}, testAdmin()); err != nil {
		t.Fatalf("dine in: %v", err)
	}
	if s.packaging != 2 {
		t.Fatalf("dine in should not consume packaging, got %d", s.packaging)
	}
}

func TestPackagingBlocksWhenInsufficient(t *testing.T) {
	s := newTestStore()
	s.packaging = 1

	_, err := s.CreateOrder(model.CreateOrderRequest{
		Items:         []model.OrderItemInput{itemReq("rice-1", 2, "")},
		Paid:          60000,
		OrderType:     "take_away",
		PaymentMethod: "tunai",
	}, testAdmin())
	if !errors.Is(err, ErrOutOfPackaging) {
		t.Fatalf("expected ErrOutOfPackaging, got %v", err)
	}
	if s.packaging != 1 {
		t.Fatalf("packaging should not change on failure, got %d", s.packaging)
	}
}

func TestVoidRestoresPackaging(t *testing.T) {
	s := newTestStore()
	s.packaging = 10

	o, err := s.CreateOrder(model.CreateOrderRequest{
		Items:         []model.OrderItemInput{itemReq("rice-1", 2, "")},
		Paid:          60000,
		OrderType:     "take_away",
		PaymentMethod: "tunai",
	}, testAdmin())
	if err != nil {
		t.Fatalf("order: %v", err)
	}
	if s.packaging != 8 {
		t.Fatalf("expected packaging 8, got %d", s.packaging)
	}

	if _, err := s.VoidOrder(o.ID, "salah", "Admin"); err != nil {
		t.Fatalf("void: %v", err)
	}
	if s.packaging != 10 {
		t.Fatalf("packaging should be restored to 10, got %d", s.packaging)
	}
}

func TestVoidRestoresExtraPackaging(t *testing.T) {
	s := newTestStore()
	s.packaging = 20
	s.packagings = []model.Packaging{{ID: "paper-bowl", Name: "Paper Bowl", Stock: 10}}

	o, err := s.CreateOrder(model.CreateOrderRequest{
		Items:           []model.OrderItemInput{},
		PackagingQty:    3,
		ExtraPackagings: []model.OrderPackagingInput{{PackagingID: "paper-bowl", Qty: 3}},
		PaymentMethod:   "tunai",
	}, testAdmin())
	if err != nil {
		t.Fatalf("order: %v", err)
	}
	if s.packaging != 17 {
		t.Fatalf("expected legacy packaging 17, got %d", s.packaging)
	}
	if s.packagings[0].Stock != 7 {
		t.Fatalf("expected paper-bowl stock 7, got %d", s.packagings[0].Stock)
	}

	if _, err := s.VoidOrder(o.ID, "salah", "Admin"); err != nil {
		t.Fatalf("void: %v", err)
	}
	if s.packaging != 20 {
		t.Fatalf("legacy packaging should be restored to 20, got %d", s.packaging)
	}
	if s.packagings[0].Stock != 10 {
		t.Fatalf("paper-bowl stock should be restored to 10, got %d", s.packagings[0].Stock)
	}
}

func TestPackagingStockMethods(t *testing.T) {
	s := newTestStore()
	s.packaging = 50
	n, err := s.GetPackagingStock()
	if err != nil || n != 50 {
		t.Fatalf("GetPackagingStock: %d %v", n, err)
	}
	if err := s.SetPackagingStock(20); err != nil {
		t.Fatalf("SetPackagingStock: %v", err)
	}
	if s.packaging != 20 {
		t.Fatalf("expected 20, got %d", s.packaging)
	}
	if err := s.SetPackagingStock(-1); !errors.Is(err, ErrInvalidPackaging) {
		t.Fatalf("expected ErrInvalidPackaging, got %v", err)
	}
}

func TestFreePackagingOnlyOrder(t *testing.T) {
	s := newTestStore()
	s.packaging = 10

	o, err := s.CreateOrder(model.CreateOrderRequest{
		Items:         []model.OrderItemInput{},
		PackagingQty:  2,
		PaymentMethod: "tunai",
	}, testAdmin())
	if err != nil {
		t.Fatalf("free packaging only order should succeed: %v", err)
	}
	if o.Total != 0 {
		t.Fatalf("expected total 0, got %d", o.Total)
	}
	if o.PackagingQty != 2 {
		t.Fatalf("expected packaging qty 2, got %d", o.PackagingQty)
	}
	if s.packaging != 8 {
		t.Fatalf("expected packaging stock to be 8, got %d", s.packaging)
	}
}

func TestBypassValidation(t *testing.T) {
	s := newTestStore()

	if _, err := s.SetProductAvailability("rice-1", false); err != nil {
		t.Fatal(err)
	}

	// tanpa bypass -> gagal, dan pesan menyebut nama produk
	_, err := s.CreateOrder(model.CreateOrderRequest{
		Items:         []model.OrderItemInput{itemReq("rice-1", 1, "")},
		Paid:          30000,
		PaymentMethod: "tunai",
		OrderType:     "take_away",
	}, testAdmin())
	if !errors.Is(err, ErrProductUnavailable) {
		t.Fatalf("expected ErrProductUnavailable, got %v", err)
	}
	if !strings.Contains(err.Error(), "Nasi Uduk") {
		t.Fatalf("error should contain product name, got %q", err.Error())
	}

	// dengan bypass -> sukses
	o, err := s.CreateOrder(model.CreateOrderRequest{
		Items:            []model.OrderItemInput{itemReq("rice-1", 1, "")},
		Paid:             30000,
		PaymentMethod:    "tunai",
		OrderType:        "take_away",
		BypassValidation: true,
	}, testAdmin())
	if err != nil {
		t.Fatalf("bypass order should succeed: %v", err)
	}
	if o.Status != "paid" {
		t.Fatalf("bypass order should be paid, got %s", o.Status)
	}

	// produk terarsip + bypass -> sukses
	if err := s.ArchiveProduct("rice-2"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateOrder(model.CreateOrderRequest{
		Items:            []model.OrderItemInput{itemReq("rice-2", 1, "")},
		Paid:             55000,
		PaymentMethod:    "tunai",
		OrderType:        "take_away",
		BypassValidation: true,
	}, testAdmin()); err != nil {
		t.Fatalf("archived bypass order should succeed: %v", err)
	}
}

func TestBypassValidationWithSnapshotPrice(t *testing.T) {
	s := newTestStore()

	// naikkan harga produk saat ini (simulasi price drift)
	ps, err := s.ProductsAdmin()
	if err != nil {
		t.Fatal(err)
	}
	for i := range ps {
		if ps[i].ID == "rice-1" {
			ps[i].Price = 40000
			if _, err := s.UpdateProduct(ps[i]); err != nil {
				t.Fatal(err)
			}
		}
	}

	// snapshot harga lama 30000 + bypass -> total pakai harga snapshot
	o, err := s.CreateOrder(model.CreateOrderRequest{
		Items: []model.OrderItemInput{{
			ProductID: "rice-1",
			Qty:       2,
			Name:      "Nasi Uduk",
			Price:     30000,
			Emoji:     "🍛",
		}},
		Paid:             60000,
		PaymentMethod:    "tunai",
		OrderType:        "take_away",
		BypassValidation: true,
	}, testAdmin())
	if err != nil {
		t.Fatalf("snapshot bypass order: %v", err)
	}
	if o.Subtotal != 60000 || o.Total != 60000 {
		t.Fatalf("expected total from snapshot 60000, got subtotal=%d total=%d", o.Subtotal, o.Total)
	}
	if len(o.Items) != 1 || o.Items[0].Price != 30000 || o.Items[0].Name != "Nasi Uduk" {
		t.Fatalf("expected item snapshot (price 30000, name Nasi Uduk), got %+v", o.Items)
	}
}
