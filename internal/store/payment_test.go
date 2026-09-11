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

func TestClientOrderIDSyncIdempotency(t *testing.T) {
	s := newTestStore()
	customTime := time.Date(2026, 9, 10, 14, 30, 0, 0, time.UTC)
	clientOrderID := "off-ord-12345-abc"

	req := model.CreateOrderRequest{
		ClientOrderID: clientOrderID,
		CreatedAt:     &customTime,
		Items:         []model.OrderItemInput{itemReq("rice-1", 1, "pedas")},
		Paid:          30000,
		PaymentMethod: "tunai",
		OrderType:     "take_away",
	}

	o1, err := s.CreateOrder(req, testAdmin())
	if err != nil {
		t.Fatalf("first create order failed: %v", err)
	}
	if o1.ID != clientOrderID {
		t.Fatalf("expected order ID %s, got %s", clientOrderID, o1.ID)
	}
	if !o1.CreatedAt.Equal(customTime) {
		t.Fatalf("expected created at %v, got %v", customTime, o1.CreatedAt)
	}

	// Retry request with same ClientOrderID (idempotency simulation)
	o2, err := s.CreateOrder(req, testAdmin())
	if err != nil {
		t.Fatalf("second create order (retry) failed: %v", err)
	}
	if o2.ID != o1.ID {
		t.Fatalf("idempotent ID mismatch: %s vs %s", o1.ID, o2.ID)
	}
	if o2.Number != o1.Number {
		t.Fatalf("idempotent number mismatch: %s vs %s", o1.Number, o2.Number)
	}
}

