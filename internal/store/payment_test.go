package store

import (
	"errors"
	"testing"
	"time"

	"kedaikoko/internal/model"
)

func TestPaymentMethodRequired(t *testing.T) {
	s := newTestStore()
	_, err := s.CreateOrder(model.CreateOrderRequest{
		Items:     []model.OrderItemInput{itemReq("rice-1", 1, "")},
		Paid:      30000,
		OrderType: "take_away",
	}, testAdmin())
	if !errors.Is(err, ErrPaymentMethod) {
		t.Fatalf("expected ErrPaymentMethod, got %v", err)
	}
}

func TestQRISNoChange(t *testing.T) {
	s := newTestStore()
	o, err := s.CreateOrder(model.CreateOrderRequest{
		Items:         []model.OrderItemInput{itemReq("rice-1", 2, "")},
		Paid:          0,
		PaymentMethod: "qris",
		OrderType:     "take_away",
	}, testAdmin())
	if err != nil {
		t.Fatalf("qris order: %v", err)
	}
	if o.Paid != o.Total {
		t.Fatalf("qris paid should equal total: paid=%d total=%d", o.Paid, o.Total)
	}
	if o.Change != 0 {
		t.Fatalf("qris change should be 0, got %d", o.Change)
	}
}

func TestReportByPaymentMethod(t *testing.T) {
	s := newTestStore()
	now := time.Now()
	from := now.Add(-24 * time.Hour)
	to := now.Add(24 * time.Hour)

	if _, err := s.CreateOrder(model.CreateOrderRequest{
		Items:         []model.OrderItemInput{itemReq("rice-1", 1, "")},
		Paid:          30000,
		PaymentMethod: "tunai",
		OrderType:     "take_away",
	}, testAdmin()); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateOrder(model.CreateOrderRequest{
		Items:         []model.OrderItemInput{itemReq("rice-3", 1, "")},
		PaymentMethod: "qris",
		OrderType:     "take_away",
	}, testAdmin()); err != nil {
		t.Fatal(err)
	}

	r, err := s.Report(from, to)
	if err != nil {
		t.Fatal(err)
	}
	byMethod := map[string]int{}
	for _, pm := range r.ByPaymentMethod {
		byMethod[pm.PaymentMethod] = pm.Orders
	}
	if byMethod["tunai"] != 1 || byMethod["qris"] != 1 {
		t.Fatalf("byPaymentMethod wrong: %+v", r.ByPaymentMethod)
	}
}
