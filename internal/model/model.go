package model

import "time"

type Category struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Emoji string `json:"emoji"`
}

type Product struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Price       int      `json:"price"`
	Description string   `json:"description"`
	Emoji       string   `json:"emoji"`
	Color       string   `json:"color"`
	Tags        []string `json:"tags,omitempty"`
	Available   bool     `json:"available"`
	Archived    bool     `json:"archived"`
	ImageURL    string   `json:"imageUrl,omitempty"`
	Stock       int      `json:"stock"`
}

type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	PinHash   string    `json:"-"`
	Role      string    `json:"role"`
	Active    bool      `json:"active"`
	HasPin    bool      `json:"hasPin"`
	CreatedAt time.Time `json:"createdAt"`
}

type OrderItem struct {
	ProductID string `json:"productId"`
	Name      string `json:"name"`
	Emoji     string `json:"emoji"`
	Price     int    `json:"price"`
	Qty       int    `json:"qty"`
	Note      string `json:"note,omitempty"`
}

type Order struct {
	ID             string      `json:"id"`
	Number         string      `json:"number"`
	OrderType      string      `json:"orderType"`
	TableNo        string      `json:"tableNo,omitempty"`
	Items          []OrderItem `json:"items"`
	Subtotal       int         `json:"subtotal"`
	DiscountType   string      `json:"discountType,omitempty"`
	DiscountValue  int         `json:"discountValue,omitempty"`
	DiscountAmount int         `json:"discountAmount"`
	Total          int         `json:"total"`
	Paid           int         `json:"paid"`
	Change         int         `json:"change"`
	PaymentMethod  string      `json:"paymentMethod"`
	Status         string      `json:"status"`
	CashierID      string      `json:"cashierId"`
	CashierName    string      `json:"cashierName"`
	VoidedAt       *time.Time  `json:"voidedAt,omitempty"`
	VoidReason     string      `json:"voidReason,omitempty"`
	VoidedBy       string      `json:"voidedBy,omitempty"`
	CreatedAt      time.Time   `json:"createdAt"`
}

type OrderItemInput struct {
	ProductID string `json:"productId"`
	Qty       int    `json:"qty"`
	Note      string `json:"note,omitempty"`
}

type CreateOrderRequest struct {
	Items         []OrderItemInput `json:"items"`
	Paid          int              `json:"paid"`
	PaymentMethod string           `json:"paymentMethod"`
	OrderType     string           `json:"orderType"`
	TableNo       string           `json:"tableNo,omitempty"`
	DiscountType  string           `json:"discountType,omitempty"`
	DiscountValue int              `json:"discountValue,omitempty"`
}

type TopProduct struct {
	ProductID string `json:"productId"`
	Name      string `json:"name"`
	Emoji     string `json:"emoji"`
	Qty       int    `json:"qty"`
	Revenue   int    `json:"revenue"`
}

type DailyRevenue struct {
	Date    string `json:"date"`
	Revenue int    `json:"revenue"`
	Orders  int    `json:"orders"`
}

type CashierRevenue struct {
	CashierID   string `json:"cashierId"`
	CashierName string `json:"cashierName"`
	Orders      int    `json:"orders"`
	Revenue     int    `json:"revenue"`
}

type CategoryRevenue struct {
	Category string `json:"category"`
	Qty      int    `json:"qty"`
	Revenue  int    `json:"revenue"`
}

type HourlyRevenue struct {
	Hour    int `json:"hour"`
	Orders  int `json:"orders"`
	Revenue int `json:"revenue"`
}

type OrderTypeRevenue struct {
	OrderType string `json:"orderType"`
	Orders    int    `json:"orders"`
	Revenue   int    `json:"revenue"`
}

type PaymentMethodRevenue struct {
	PaymentMethod string `json:"paymentMethod"`
	Orders        int    `json:"orders"`
	Revenue       int    `json:"revenue"`
}

type Report struct {
	From             time.Time            `json:"from"`
	To               time.Time            `json:"to"`
	TotalRevenue     int                  `json:"totalRevenue"`
	TotalDiscount    int                  `json:"totalDiscount"`
	OrderCount       int                  `json:"orderCount"`
	VoidCount        int                  `json:"voidCount"`
	AvgOrder         int                  `json:"avgOrder"`
	ItemsSold        int                  `json:"itemsSold"`
	TopProducts      []TopProduct         `json:"topProducts"`
	RevenueByDay     []DailyRevenue       `json:"revenueByDay"`
	ByCashier        []CashierRevenue     `json:"byCashier"`
	ByCategory       []CategoryRevenue    `json:"byCategory"`
	ByHour           []HourlyRevenue      `json:"byHour"`
	ByOrderType      []OrderTypeRevenue   `json:"byOrderType"`
	ByPaymentMethod  []PaymentMethodRevenue `json:"byPaymentMethod"`
}
