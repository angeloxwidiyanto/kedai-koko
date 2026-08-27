package store

import (
	"time"

	"kedaikoko/internal/model"
)

func newTestStore() *MemoryStore {
	s := &MemoryStore{
		products:   append([]model.Product(nil), defaultProducts...),
		categories: append([]model.Category(nil), defaultCategories...),
		packaging:  1000,
	}
	s.counter = len(s.orders)
	s.seedAdmin()
	return s
}

func testAdmin() model.User {
	h, _ := hashPin("1234")
	return model.User{ID: "usr-admin", Name: "Admin", Role: "admin", PinHash: h, Active: true, HasPin: true, CreatedAt: time.Now()}
}

func itemReq(id string, qty int, note string) model.OrderItemInput {
	return model.OrderItemInput{ProductID: id, Qty: qty, Note: note}
}

func mkOrder(s *MemoryStore, items []model.OrderItemInput, paid int, discountType string, discountValue int) (model.Order, error) {
	return s.CreateOrder(model.CreateOrderRequest{
		Items:         items,
		Paid:          paid,
		PaymentMethod: "tunai",
		OrderType:     "take_away",
		DiscountType:  discountType,
		DiscountValue: discountValue,
	}, testAdmin())
}
