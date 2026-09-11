package store

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"kedaikoko/internal/model"
)

type MemoryStore struct {
	mu         sync.Mutex
	products   []model.Product
	categories []model.Category
	orders     []model.Order
	users      []model.User
	counter    int
	packaging  int
}

func NewMemory() *MemoryStore {
	s := &MemoryStore{
		products:   append([]model.Product(nil), defaultProducts...),
		categories: append([]model.Category(nil), defaultCategories...),
		orders:     sampleOrders(time.Now()),
		packaging:  100,
	}
	s.counter = len(s.orders)
	s.seedAdmin()
	return s
}

func (s *MemoryStore) seedAdmin() {
	for _, u := range s.users {
		if u.Role == "admin" {
			return
		}
	}
	pin := "1234"
	hash, _ := hashPin(pin)
	s.users = append(s.users, model.User{
		ID:        "usr-admin",
		Name:      "Admin",
		PinHash:   hash,
		Role:      "admin",
		Active:    true,
		HasPin:    true,
		CreatedAt: time.Now(),
	})
}

func (s *MemoryStore) Categories() ([]model.Category, error) {
	return append([]model.Category(nil), s.categories...), nil
}

func (s *MemoryStore) Products(category string) ([]model.Product, error) {
	out := make([]model.Product, 0, len(s.products))
	for _, p := range s.products {
		if p.Archived {
			continue
		}
		if category == "" || p.Category == category {
			out = append(out, p)
		}
	}
	return out, nil
}

func (s *MemoryStore) ProductsAdmin() ([]model.Product, error) {
	return append([]model.Product(nil), s.products...), nil
}

func (s *MemoryStore) CreateProduct(p model.Product) (model.Product, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if p.Name == "" {
		return model.Product{}, ErrInvalidQty
	}
	for _, existing := range s.products {
		if existing.ID == p.ID {
			return model.Product{}, ErrProductExists
		}
	}
	if p.ID == "" {
		p.ID = fmt.Sprintf("prod-%d", time.Now().UnixNano())
	}
	if p.Color == "" {
		p.Color = "#f6ddd4"
	}
	if p.Emoji == "" {
		p.Emoji = "🍽️"
	}
	if p.Stock == 0 {
		p.Stock = -1
	}
	p.Available = p.Stock != 0
	s.products = append(s.products, p)
	return p, nil
}

func (s *MemoryStore) UpdateProduct(p model.Product) (model.Product, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.products {
		if s.products[i].ID == p.ID {
			p.Available = s.products[i].Available
			p.Archived = s.products[i].Archived
			p.Stock = s.products[i].Stock
			s.products[i] = p
			return p, nil
		}
	}
	return model.Product{}, ErrProductNotFound
}

func (s *MemoryStore) SetProductAvailability(id string, available bool) (model.Product, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.products {
		if s.products[i].ID == id {
			s.products[i].Available = available
			return s.products[i], nil
		}
	}
	return model.Product{}, ErrProductNotFound
}

func (s *MemoryStore) SetProductStock(id string, stock int) (model.Product, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if stock < -1 {
		return model.Product{}, ErrInvalidStock
	}
	for i := range s.products {
		if s.products[i].ID == id {
			s.products[i].Stock = stock
			if stock >= 0 {
				s.products[i].Available = stock > 0
			}
			return s.products[i], nil
		}
	}
	return model.Product{}, ErrProductNotFound
}

func (s *MemoryStore) ArchiveProduct(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.products {
		if s.products[i].ID == id {
			s.products[i].Archived = true
			return nil
		}
	}
	return ErrProductNotFound
}

func (s *MemoryStore) RestoreProduct(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.products {
		if s.products[i].ID == id {
			s.products[i].Archived = false
			return nil
		}
	}
	return ErrProductNotFound
}

func (s *MemoryStore) CreateCategory(c model.Category) (model.Category, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if c.Name == "" {
		return model.Category{}, ErrInvalidQty
	}
	for _, existing := range s.categories {
		if existing.ID == c.ID {
			return model.Category{}, ErrProductExists
		}
	}
	if c.ID == "" {
		c.ID = fmt.Sprintf("cat-%d", time.Now().UnixNano())
	}
	if c.Icon == "" {
		c.Icon = "more_horiz"
	}
	if c.Emoji == "" {
		c.Emoji = "🍽️"
	}
	s.categories = append(s.categories, c)
	return c, nil
}

func (s *MemoryStore) UpdateCategory(c model.Category) (model.Category, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.categories {
		if s.categories[i].ID == c.ID {
			s.categories[i].Name = c.Name
			if c.Icon != "" {
				s.categories[i].Icon = c.Icon
			}
			if c.Emoji != "" {
				s.categories[i].Emoji = c.Emoji
			}
			return s.categories[i], nil
		}
	}
	return model.Category{}, ErrCategoryNotFound
}

func (s *MemoryStore) DeleteCategory(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, p := range s.products {
		if p.Category == id && !p.Archived {
			return ErrCategoryInUse
		}
	}
	for i := range s.categories {
		if s.categories[i].ID == id {
			s.categories = append(s.categories[:i], s.categories[i+1:]...)
			return nil
		}
	}
	return ErrCategoryNotFound
}

// --- Pengguna ---

func (s *MemoryStore) Users() ([]model.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := append([]model.User(nil), s.users...)
	sort.SliceStable(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	return out, nil
}

func (s *MemoryStore) ActiveUsers() ([]model.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]model.User, 0)
	for _, u := range s.users {
		if u.Active {
			out = append(out, u)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Role != out[j].Role {
			return out[i].Role == "admin"
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

func (s *MemoryStore) GetUser(id string) (model.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, u := range s.users {
		if u.ID == id {
			return u, nil
		}
	}
	return model.User{}, ErrUserNotFound
}

func (s *MemoryStore) CreateUser(u model.User) (model.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if u.Name == "" {
		return model.User{}, ErrInvalidQty
	}
	for _, existing := range s.users {
		if existing.Name == u.Name {
			return model.User{}, ErrUserExists
		}
	}
	if u.ID == "" {
		u.ID = fmt.Sprintf("usr-%d", time.Now().UnixNano())
	}
	if u.Role == "" {
		u.Role = "kasir"
	}
	u.Active = true
	u.CreatedAt = time.Now()
	if u.PinHash == "" {
		return model.User{}, ErrInvalidPin
	}
	u.HasPin = true
	s.users = append(s.users, u)
	return u, nil
}

func (s *MemoryStore) UpdateUser(u model.User, newPin string) (model.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.users {
		if s.users[i].ID == u.ID {
			existing := s.users[i]
			if u.Name != "" {
				for _, other := range s.users {
					if other.ID != u.ID && other.Name == u.Name {
						return model.User{}, ErrUserExists
					}
				}
				existing.Name = u.Name
			}
			if u.Role != "" {
				if existing.Role == "admin" && u.Role != "admin" && s.countAdmins() == 1 {
					return model.User{}, ErrLastAdmin
				}
				existing.Role = u.Role
			}
			if newPin != "" {
				hash, err := hashPin(newPin)
				if err != nil {
					return model.User{}, err
				}
				existing.PinHash = hash
				existing.HasPin = true
			}
			s.users[i] = existing
			return existing, nil
		}
	}
	return model.User{}, ErrUserNotFound
}

func (s *MemoryStore) SetUserActive(id string, active bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.users {
		if s.users[i].ID == id {
			if !active && s.users[i].Role == "admin" && s.countAdmins() == 1 {
				return ErrLastAdmin
			}
			s.users[i].Active = active
			return nil
		}
	}
	return ErrUserNotFound
}

func (s *MemoryStore) DeleteUser(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.users {
		if s.users[i].ID == id {
			if s.users[i].Role == "admin" && s.countAdmins() == 1 {
				return ErrLastAdmin
			}
			s.users = append(s.users[:i], s.users[i+1:]...)
			return nil
		}
	}
	return ErrUserNotFound
}

func (s *MemoryStore) countAdmins() int {
	n := 0
	for _, u := range s.users {
		if u.Role == "admin" && u.Active {
			n++
		}
	}
	return n
}

func (s *MemoryStore) Authenticate(id, pin string) (model.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, u := range s.users {
		if u.ID == id {
			if !u.Active {
				return model.User{}, ErrUserInactive
			}
			if !checkPin(u.PinHash, pin) {
				return model.User{}, ErrInvalidPin
			}
			return u, nil
		}
	}
	return model.User{}, ErrUserNotFound
}

// --- Pesanan ---

func (s *MemoryStore) CreateOrder(req model.CreateOrderRequest, cashier model.User) (model.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if req.ClientOrderID != "" {
		for _, o := range s.orders {
			if o.ID == req.ClientOrderID {
				return o, nil
			}
		}
	}

	if len(req.Items) == 0 {
		return model.Order{}, ErrEmptyOrder
	}
	if req.OrderType != "dine_in" && req.OrderType != "take_away" {
		return model.Order{}, ErrOrderTypeRequired
	}
	if req.OrderType == "dine_in" && req.TableNo == "" {
		return model.Order{}, ErrTableNoRequired
	}
	if req.PaymentMethod != "qris" && req.PaymentMethod != "tunai" {
		return model.Order{}, ErrPaymentMethod
	}

	items := make([]model.OrderItem, 0, len(req.Items))
	subtotal := 0
	totalQty := 0
	for _, it := range req.Items {
		idx := s.indexOfProduct(it.ProductID)
		if idx < 0 {
			return model.Order{}, ErrProductNotFound
		}
		p := &s.products[idx]
		if p.Archived {
			return model.Order{}, ErrProductNotFound
		}
		if !p.Available {
			return model.Order{}, ErrProductUnavailable
		}
		if it.Qty <= 0 {
			return model.Order{}, ErrInvalidQty
		}
		if p.Stock >= 0 && it.Qty > p.Stock {
			return model.Order{}, ErrProductUnavailable
		}
		items = append(items, model.OrderItem{
			ProductID: p.ID,
			Name:      p.Name,
			Emoji:     p.Emoji,
			Price:     p.Price,
			Qty:       it.Qty,
			Note:      it.Note,
		})
		subtotal += p.Price * it.Qty
		totalQty += it.Qty
	}

	// stok kemasan untuk take away (per satuan item)
	if req.OrderType == "take_away" && totalQty > s.packaging {
		return model.Order{}, ErrOutOfPackaging
	}

	discount := calcDiscount(subtotal, req.DiscountType, req.DiscountValue)
	total := subtotal - discount
	if total < 0 {
		total = 0
	}

	paid := req.Paid
	change := paid - total
	if req.PaymentMethod == "qris" {
		paid = total
		change = 0
	} else if paid < total {
		return model.Order{}, ErrPaymentShort
	}

	for _, it := range items {
		idx := s.indexOfProduct(it.ProductID)
		if idx >= 0 && s.products[idx].Stock >= 0 {
			s.products[idx].Stock -= it.Qty
			if s.products[idx].Stock == 0 {
				s.products[idx].Available = false
			}
		}
	}

	// kurangi stok kemasan untuk take away
	if req.OrderType == "take_away" {
		s.packaging -= totalQty
	}

	s.counter++
	id := req.ClientOrderID
	if id == "" {
		id = fmt.Sprintf("ord-%d", time.Now().UnixNano())
	}
	now := time.Now()
	if req.CreatedAt != nil && !req.CreatedAt.IsZero() {
		now = *req.CreatedAt
	}
	order := model.Order{
		ID:             id,
		Number:         fmt.Sprintf("KK-%04d", s.counter),
		OrderType:      req.OrderType,
		TableNo:        req.TableNo,
		Items:          items,
		Subtotal:       subtotal,
		DiscountType:   req.DiscountType,
		DiscountValue:  req.DiscountValue,
		DiscountAmount: discount,
		Total:          total,
		Paid:           paid,
		Change:         change,
		PaymentMethod:  req.PaymentMethod,
		Status:         "paid",
		CashierID:      cashier.ID,
		CashierName:    cashier.Name,
		CreatedAt:      now,
	}
	s.orders = append(s.orders, order)
	return order, nil
}

func (s *MemoryStore) indexOfProduct(id string) int {
	for i := range s.products {
		if s.products[i].ID == id {
			return i
		}
	}
	return -1
}

func (s *MemoryStore) VoidOrder(id, reason, by string) (model.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.orders {
		if s.orders[i].ID == id {
			if s.orders[i].Status != "paid" {
				return model.Order{}, ErrOrderNotPaid
			}
			now := time.Now()
			s.orders[i].Status = "void"
			s.orders[i].VoidedAt = &now
			s.orders[i].VoidReason = reason
			s.orders[i].VoidedBy = by
			// kembalikan stok
			for _, it := range s.orders[i].Items {
				idx := s.indexOfProduct(it.ProductID)
				if idx >= 0 && s.products[idx].Stock >= 0 {
					s.products[idx].Stock += it.Qty
					if s.products[idx].Stock > 0 {
						s.products[idx].Available = true
					}
				}
			}
			// kembalikan stok kemasan untuk bungkus
			if s.orders[i].OrderType == "take_away" {
				for _, it := range s.orders[i].Items {
					s.packaging += it.Qty
				}
			}
			return s.orders[i], nil
		}
	}
	return model.Order{}, ErrOrderNotFound
}

func (s *MemoryStore) Orders() ([]model.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := append([]model.Order(nil), s.orders...)
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out, nil
}

func (s *MemoryStore) OrdersRange(from, to time.Time) ([]model.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]model.Order, 0)
	for _, o := range s.orders {
		if !o.CreatedAt.Before(from) && o.CreatedAt.Before(to) {
			out = append(out, o)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].CreatedAt.Before(out[j].CreatedAt)
	})
	return out, nil
}

func (s *MemoryStore) Report(from, to time.Time) (model.Report, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	r := model.Report{
		From:         from,
		To:           to,
		TopProducts:  []model.TopProduct{},
		RevenueByDay: []model.DailyRevenue{},
		ByCashier:    []model.CashierRevenue{},
		ByCategory:   []model.CategoryRevenue{},
		ByHour:       []model.HourlyRevenue{},
		ByOrderType:  []model.OrderTypeRevenue{},
		ByPaymentMethod: []model.PaymentMethodRevenue{},
	}

	type agg struct {
		name, emoji, category string
		qty, rev              int
	}
	top := map[string]*agg{}
	daily := map[string]*model.DailyRevenue{}
	cashier := map[string]*model.CashierRevenue{}
	category := map[string]*model.CategoryRevenue{}
	hourly := map[int]*model.HourlyRevenue{}
	orderType := map[string]*model.OrderTypeRevenue{}
	paymentMethod := map[string]*model.PaymentMethodRevenue{}

	for _, o := range s.orders {
		if o.CreatedAt.Before(from) || !o.CreatedAt.Before(to) {
			continue
		}
		if o.Status == "void" {
			r.VoidCount++
			continue
		}

		r.TotalRevenue += o.Total
		r.TotalDiscount += o.DiscountAmount
		r.OrderCount++

		day := o.CreatedAt.Format("2006-01-02")
		dr := daily[day]
		if dr == nil {
			dr = &model.DailyRevenue{Date: day}
			daily[day] = dr
		}
		dr.Revenue += o.Total
		dr.Orders++

		cr := cashier[o.CashierID]
		if cr == nil {
			cr = &model.CashierRevenue{CashierID: o.CashierID, CashierName: o.CashierName}
			cashier[o.CashierID] = cr
		}
		cr.Orders++
		cr.Revenue += o.Total

		hr := hourly[o.CreatedAt.Hour()]
		if hr == nil {
			hr = &model.HourlyRevenue{Hour: o.CreatedAt.Hour()}
			hourly[o.CreatedAt.Hour()] = hr
		}
		hr.Orders++
		hr.Revenue += o.Total

		ot := orderType[o.OrderType]
		if ot == nil {
			ot = &model.OrderTypeRevenue{OrderType: o.OrderType}
			orderType[o.OrderType] = ot
		}
		ot.Orders++
		ot.Revenue += o.Total

		pm := paymentMethod[o.PaymentMethod]
		if pm == nil {
			pm = &model.PaymentMethodRevenue{PaymentMethod: o.PaymentMethod}
			paymentMethod[o.PaymentMethod] = pm
		}
		pm.Orders++
		pm.Revenue += o.Total

		for _, it := range o.Items {
			r.ItemsSold += it.Qty
			a := top[it.ProductID]
			if a == nil {
				a = &agg{name: it.Name, emoji: it.Emoji, category: it.ProductID}
				top[it.ProductID] = a
			}
			a.qty += it.Qty
			a.rev += it.Price * it.Qty

			// kategori via produk
			catID := s.categoryOfProduct(it.ProductID)
			ca := category[catID]
			if ca == nil {
				ca = &model.CategoryRevenue{Category: catID}
				category[catID] = ca
			}
			ca.Qty += it.Qty
			ca.Revenue += it.Price * it.Qty
		}
	}

	if r.OrderCount > 0 {
		r.AvgOrder = r.TotalRevenue / r.OrderCount
	}

	for id, a := range top {
		r.TopProducts = append(r.TopProducts, model.TopProduct{
			ProductID: id, Name: a.name, Emoji: a.emoji, Qty: a.qty, Revenue: a.rev,
		})
	}
	sort.Slice(r.TopProducts, func(i, j int) bool {
		if r.TopProducts[i].Qty == r.TopProducts[j].Qty {
			return r.TopProducts[i].Revenue > r.TopProducts[j].Revenue
		}
		return r.TopProducts[i].Qty > r.TopProducts[j].Qty
	})

	for _, d := range daily {
		r.RevenueByDay = append(r.RevenueByDay, *d)
	}
	sort.Slice(r.RevenueByDay, func(i, j int) bool {
		return r.RevenueByDay[i].Date < r.RevenueByDay[j].Date
	})

	for _, c := range cashier {
		r.ByCashier = append(r.ByCashier, *c)
	}
	sort.Slice(r.ByCashier, func(i, j int) bool { return r.ByCashier[i].Revenue > r.ByCashier[j].Revenue })

	for _, c := range category {
		r.ByCategory = append(r.ByCategory, *c)
	}
	sort.Slice(r.ByCategory, func(i, j int) bool { return r.ByCategory[i].Revenue > r.ByCategory[j].Revenue })

	for h := 0; h < 24; h++ {
		if hr, ok := hourly[h]; ok {
			r.ByHour = append(r.ByHour, *hr)
		} else {
			r.ByHour = append(r.ByHour, model.HourlyRevenue{Hour: h})
		}
	}

	for _, ot := range orderType {
		r.ByOrderType = append(r.ByOrderType, *ot)
	}
	sort.Slice(r.ByOrderType, func(i, j int) bool { return r.ByOrderType[i].Revenue > r.ByOrderType[j].Revenue })

	for _, pm := range paymentMethod {
		r.ByPaymentMethod = append(r.ByPaymentMethod, *pm)
	}
	sort.Slice(r.ByPaymentMethod, func(i, j int) bool { return r.ByPaymentMethod[i].Revenue > r.ByPaymentMethod[j].Revenue })

	return r, nil
}

func (s *MemoryStore) GetPackagingStock() (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.packaging, nil
}

func (s *MemoryStore) SetPackagingStock(n int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if n < 0 {
		return ErrInvalidPackaging
	}
	s.packaging = n
	return nil
}

func (s *MemoryStore) Ping() error { return nil }

func (s *MemoryStore) categoryOfProduct(id string) string {
	for _, p := range s.products {
		if p.ID == id {
			return p.Category
		}
	}
	return ""
}

func calcDiscount(subtotal int, dType string, dValue int) int {
	if dValue <= 0 {
		return 0
	}
	switch dType {
	case "pct":
		if dValue > 100 {
			dValue = 100
		}
		return subtotal * dValue / 100
	case "amt":
		if dValue > subtotal {
			return subtotal
		}
		return dValue
	default:
		return 0
	}
}
