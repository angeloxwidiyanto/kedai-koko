package store

import (
	"errors"
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
		Items:     []model.OrderItemInput{itemReq("rice-1", 1, "")},
		Paid:      30000,
		OrderType: "dine_in",
		PaymentMethod: "tunai",
	}, testAdmin())
	if !errors.Is(err, ErrTableNoRequired) {
		t.Fatalf("expected ErrTableNoRequired, got %v", err)
	}

	// dine in dengan meja sukses
	o, err := s.CreateOrder(model.CreateOrderRequest{
		Items:     []model.OrderItemInput{itemReq("rice-1", 1, "")},
		Paid:      30000,
		OrderType: "dine_in",
		PaymentMethod: "tunai",
		TableNo:   "5",
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
		Items:     []model.OrderItemInput{itemReq("rice-1", 2, ""), itemReq("drinks-1", 1, "")},
		Paid:      100000,
		OrderType: "take_away",
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
		Items:     []model.OrderItemInput{itemReq("rice-1", 1, "")},
		Paid:      30000,
		OrderType: "dine_in",
		PaymentMethod: "tunai",
		TableNo:   "3",
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
		Items:     []model.OrderItemInput{itemReq("rice-1", 2, "")},
		Paid:      60000,
		OrderType: "take_away",
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
		Items:     []model.OrderItemInput{itemReq("rice-1", 2, "")},
		Paid:      60000,
		OrderType: "take_away",
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
