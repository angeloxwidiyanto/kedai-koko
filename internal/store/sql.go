package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"kedaikoko/internal/model"
)

type SQLStore struct {
	pool *pgxpool.Pool
}

func NewSQL(url string) (*SQLStore, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	// Supabase transaction pooler (pgBouncer) tidak mendukung prepared statement
	// bernama yang di-cache. DescribeExec tetap melakukan Describe (agar tipe
	// parameter bisa ditentukan) tanpa menyimpan statement.
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeDescribeExec

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	s := &SQLStore{pool: pool}
	if err := s.migrate(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return s, nil
}

func (s *SQLStore) Close() {
	s.pool.Close()
}

func (s *SQLStore) migrate(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS categories (
			id text PRIMARY KEY,
			name text NOT NULL,
			icon text NOT NULL,
			emoji text NOT NULL,
			position int NOT NULL DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS products (
			id text PRIMARY KEY,
			name text NOT NULL,
			category text NOT NULL,
			price int NOT NULL,
			description text NOT NULL DEFAULT '',
			emoji text NOT NULL DEFAULT '',
			color text NOT NULL DEFAULT '#f6ddd4',
			tags text[] NOT NULL DEFAULT '{}',
			available boolean NOT NULL DEFAULT true,
			archived boolean NOT NULL DEFAULT false,
			image_url text NOT NULL DEFAULT '',
			stock int NOT NULL DEFAULT -1
		)`,
		`ALTER TABLE products ADD COLUMN IF NOT EXISTS available boolean NOT NULL DEFAULT true`,
		`ALTER TABLE products ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false`,
		`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT ''`,
		`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock int NOT NULL DEFAULT -1`,
		`CREATE TABLE IF NOT EXISTS users (
			id text PRIMARY KEY,
			name text NOT NULL,
			pin_hash text NOT NULL,
			role text NOT NULL DEFAULT 'kasir',
			active boolean NOT NULL DEFAULT true,
			created_at timestamptz NOT NULL DEFAULT now()
		)`,
		`CREATE TABLE IF NOT EXISTS orders (
			id text PRIMARY KEY,
			number text UNIQUE NOT NULL,
			order_type text NOT NULL DEFAULT 'take_away',
			table_no text NOT NULL DEFAULT '',
			subtotal int NOT NULL DEFAULT 0,
			discount_type text NOT NULL DEFAULT '',
			discount_value int NOT NULL DEFAULT 0,
			discount_amount int NOT NULL DEFAULT 0,
			total int NOT NULL,
			paid int NOT NULL,
			change_amount int NOT NULL,
			payment_method text NOT NULL DEFAULT 'tunai',
			status text NOT NULL,
			cashier_id text NOT NULL DEFAULT '',
			cashier_name text NOT NULL DEFAULT '',
			voided_at timestamptz,
			void_reason text NOT NULL DEFAULT '',
			voided_by text NOT NULL DEFAULT '',
			created_at timestamptz NOT NULL
		)`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'take_away'`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_no text NOT NULL DEFAULT ''`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal int NOT NULL DEFAULT 0`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT ''`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_value int NOT NULL DEFAULT 0`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount int NOT NULL DEFAULT 0`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_id text NOT NULL DEFAULT ''`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_name text NOT NULL DEFAULT ''`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided_at timestamptz`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS void_reason text NOT NULL DEFAULT ''`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided_by text NOT NULL DEFAULT ''`,
		`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'tunai'`,
		`CREATE TABLE IF NOT EXISTS order_items (
			id bigserial PRIMARY KEY,
			order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
			product_id text NOT NULL,
			name text NOT NULL,
			emoji text NOT NULL DEFAULT '',
			price int NOT NULL,
			qty int NOT NULL,
			note text NOT NULL DEFAULT ''
		)`,
		`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT ''`,
		`CREATE SEQUENCE IF NOT EXISTS order_number_seq`,
		`CREATE TABLE IF NOT EXISTS settings (
			key text PRIMARY KEY,
			value text NOT NULL
		)`,
	}

	for _, st := range stmts {
		if _, err := s.pool.Exec(ctx, st); err != nil {
			return err
		}
	}
	return s.seed(ctx)
}

func (s *SQLStore) seed(ctx context.Context) error {
	var productCount int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM products`).Scan(&productCount); err != nil {
		return err
	}
	if productCount == 0 {
		for _, p := range defaultProducts {
			if _, err := s.pool.Exec(ctx,
				`INSERT INTO products (id, name, category, price, description, emoji, color, tags, available, stock)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
				p.ID, p.Name, p.Category, p.Price, p.Description, p.Emoji, p.Color, p.Tags, p.Available, p.Stock); err != nil {
				return err
			}
		}
	}

	var categoryCount int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM categories`).Scan(&categoryCount); err != nil {
		return err
	}
	if categoryCount == 0 {
		for i, c := range defaultCategories {
			if _, err := s.pool.Exec(ctx,
				`INSERT INTO categories (id, name, icon, emoji, position)
				 VALUES ($1, $2, $3, $4, $5)`,
				c.ID, c.Name, c.Icon, c.Emoji, i); err != nil {
				return err
			}
		}
	}

	// Normalisasi data lama: status "Selesai" -> "paid"
	_, _ = s.pool.Exec(ctx, `UPDATE orders SET status='paid' WHERE status='Selesai'`)

	// Seed stok kemasan (hanya jika belum ada)
	var packCount int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM settings WHERE key='packaging_stock'`).Scan(&packCount); err != nil {
		return err
	}
	if packCount == 0 {
		_, err := s.pool.Exec(ctx, `INSERT INTO settings (key, value) VALUES ('packaging_stock', '100')`)
		if err != nil {
			return err
		}
	}

	// Seed admin jika belum ada
	var adminCount int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE role='admin'`).Scan(&adminCount); err != nil {
		return err
	}
	if adminCount == 0 {
		pin := "1234"
		hash, err := hashPin(pin)
		if err != nil {
			return err
		}
		_, err = s.pool.Exec(ctx,
			`INSERT INTO users (id, name, pin_hash, role, active, created_at)
			 VALUES ($1, $2, $3, 'admin', true, now())`,
			"usr-admin", "Admin", hash)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *SQLStore) Categories() ([]model.Category, error) {
	ctx := context.Background()
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, icon, emoji FROM categories ORDER BY position`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []model.Category{}
	for rows.Next() {
		var c model.Category
		if err := rows.Scan(&c.ID, &c.Name, &c.Icon, &c.Emoji); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

const productCols = `id, name, category, price, description, emoji, color, tags, available, archived, image_url, stock`

func scanProduct(row pgx.Row) (model.Product, error) {
	var p model.Product
	err := row.Scan(&p.ID, &p.Name, &p.Category, &p.Price, &p.Description, &p.Emoji, &p.Color, &p.Tags, &p.Available, &p.Archived, &p.ImageURL, &p.Stock)
	return p, err
}

func (s *SQLStore) Products(category string) ([]model.Product, error) {
	ctx := context.Background()

	var rows pgx.Rows
	var err error
	if category == "" {
		rows, err = s.pool.Query(ctx,
			`SELECT `+productCols+` FROM products WHERE archived = false ORDER BY id`)
	} else {
		rows, err = s.pool.Query(ctx,
			`SELECT `+productCols+` FROM products WHERE archived = false AND category = $1 ORDER BY id`,
			category)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []model.Product{}
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *SQLStore) ProductsAdmin() ([]model.Product, error) {
	ctx := context.Background()
	rows, err := s.pool.Query(ctx, `SELECT `+productCols+` FROM products ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []model.Product{}
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *SQLStore) CreateProduct(p model.Product) (model.Product, error) {
	ctx := context.Background()
	if p.Name == "" {
		return model.Product{}, ErrInvalidQty
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
	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)`, p.ID).Scan(&exists); err != nil {
		return model.Product{}, err
	}
	if exists {
		return model.Product{}, ErrProductExists
	}

	available := p.Stock != 0
	_, err := s.pool.Exec(ctx,
		`INSERT INTO products (id, name, category, price, description, emoji, color, tags, available, archived, image_url, stock)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, $11)`,
		p.ID, p.Name, p.Category, p.Price, p.Description, p.Emoji, p.Color, p.Tags, available, p.ImageURL, p.Stock)
	if err != nil {
		return model.Product{}, err
	}
	p.Available = available
	p.Archived = false
	return p, nil
}

func (s *SQLStore) UpdateProduct(p model.Product) (model.Product, error) {
	ctx := context.Background()
	tag, err := s.pool.Exec(ctx,
		`UPDATE products SET name=$2, category=$3, price=$4, description=$5, emoji=$6, color=$7, tags=$8, image_url=$9
		 WHERE id=$1`,
		p.ID, p.Name, p.Category, p.Price, p.Description, p.Emoji, p.Color, p.Tags, p.ImageURL)
	if err != nil {
		return model.Product{}, err
	}
	if tag.RowsAffected() == 0 {
		return model.Product{}, ErrProductNotFound
	}
	return scanProduct(s.pool.QueryRow(ctx, `SELECT `+productCols+` FROM products WHERE id=$1`, p.ID))
}

func (s *SQLStore) SetProductAvailability(id string, available bool) (model.Product, error) {
	ctx := context.Background()
	tag, err := s.pool.Exec(ctx, `UPDATE products SET available=$2 WHERE id=$1`, id, available)
	if err != nil {
		return model.Product{}, err
	}
	if tag.RowsAffected() == 0 {
		return model.Product{}, ErrProductNotFound
	}
	return scanProduct(s.pool.QueryRow(ctx, `SELECT `+productCols+` FROM products WHERE id=$1`, id))
}

func (s *SQLStore) SetProductStock(id string, stock int) (model.Product, error) {
	ctx := context.Background()
	if stock < -1 {
		return model.Product{}, ErrInvalidStock
	}
	var available bool
	if stock >= 0 {
		available = stock > 0
	} else {
		available = true
	}
	tag, err := s.pool.Exec(ctx, `UPDATE products SET stock=$2, available=$3 WHERE id=$1`, id, stock, available)
	if err != nil {
		return model.Product{}, err
	}
	if tag.RowsAffected() == 0 {
		return model.Product{}, ErrProductNotFound
	}
	return scanProduct(s.pool.QueryRow(ctx, `SELECT `+productCols+` FROM products WHERE id=$1`, id))
}

func (s *SQLStore) ArchiveProduct(id string) error {
	ctx := context.Background()
	tag, err := s.pool.Exec(ctx, `UPDATE products SET archived=true WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrProductNotFound
	}
	return nil
}

func (s *SQLStore) RestoreProduct(id string) error {
	ctx := context.Background()
	tag, err := s.pool.Exec(ctx, `UPDATE products SET archived=false WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrProductNotFound
	}
	return nil
}

func (s *SQLStore) CreateCategory(c model.Category) (model.Category, error) {
	ctx := context.Background()
	if c.Name == "" {
		return model.Category{}, ErrInvalidQty
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

	var pos int
	_ = s.pool.QueryRow(ctx, `SELECT COALESCE(MAX(position), -1) + 1 FROM categories`).Scan(&pos)

	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM categories WHERE id=$1)`, c.ID).Scan(&exists); err != nil {
		return model.Category{}, err
	}
	if exists {
		return model.Category{}, ErrProductExists
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO categories (id, name, icon, emoji, position) VALUES ($1, $2, $3, $4, $5)`,
		c.ID, c.Name, c.Icon, c.Emoji, pos)
	if err != nil {
		return model.Category{}, err
	}
	return c, nil
}

func (s *SQLStore) UpdateCategory(c model.Category) (model.Category, error) {
	ctx := context.Background()
	tag, err := s.pool.Exec(ctx, `UPDATE categories SET name=$2, icon=$3, emoji=$4 WHERE id=$1`,
		c.ID, c.Name, c.Icon, c.Emoji)
	if err != nil {
		return model.Category{}, err
	}
	if tag.RowsAffected() == 0 {
		return model.Category{}, ErrCategoryNotFound
	}
	return c, nil
}

func (s *SQLStore) DeleteCategory(id string) error {
	ctx := context.Background()
	var inUse bool
	if err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM products WHERE category=$1 AND archived=false)`, id).Scan(&inUse); err != nil {
		return err
	}
	if inUse {
		return ErrCategoryInUse
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM categories WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrCategoryNotFound
	}
	return nil
}

// --- Pengguna ---

const userCols = `id, name, pin_hash, role, active, created_at`

func scanUser(row pgx.Row) (model.User, error) {
	var u model.User
	err := row.Scan(&u.ID, &u.Name, &u.PinHash, &u.Role, &u.Active, &u.CreatedAt)
	u.HasPin = u.PinHash != ""
	return u, err
}

func (s *SQLStore) Users() ([]model.User, error) {
	ctx := context.Background()
	rows, err := s.pool.Query(ctx, `SELECT `+userCols+` FROM users ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *SQLStore) ActiveUsers() ([]model.User, error) {
	ctx := context.Background()
	rows, err := s.pool.Query(ctx,
		`SELECT `+userCols+` FROM users WHERE active = true ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *SQLStore) GetUser(id string) (model.User, error) {
	ctx := context.Background()
	u, err := scanUser(s.pool.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id=$1`, id))
	if err == pgx.ErrNoRows {
		return model.User{}, ErrUserNotFound
	}
	return u, err
}

func (s *SQLStore) CreateUser(u model.User) (model.User, error) {
	ctx := context.Background()
	if u.Name == "" {
		return model.User{}, ErrInvalidQty
	}
	if u.PinHash == "" {
		return model.User{}, ErrInvalidPin
	}
	if u.ID == "" {
		u.ID = fmt.Sprintf("usr-%d", time.Now().UnixNano())
	}
	if u.Role == "" {
		u.Role = "kasir"
	}
	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE name=$1)`, u.Name).Scan(&exists); err != nil {
		return model.User{}, err
	}
	if exists {
		return model.User{}, ErrUserExists
	}
	u.Active = true
	u.CreatedAt = time.Now()
	u.HasPin = true
	_, err := s.pool.Exec(ctx,
		`INSERT INTO users (id, name, pin_hash, role, active, created_at) VALUES ($1, $2, $3, $4, true, $5)`,
		u.ID, u.Name, u.PinHash, u.Role, u.CreatedAt)
	if err != nil {
		return model.User{}, err
	}
	return u, nil
}

func (s *SQLStore) UpdateUser(u model.User, newPin string) (model.User, error) {
	ctx := context.Background()
	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE name=$1 AND id<>$2)`, u.Name, u.ID).Scan(&exists); err != nil {
		return model.User{}, err
	}
	if exists {
		return model.User{}, ErrUserExists
	}

	// cegah menurunkan admin terakhir
	if u.Role != "" && u.Role != "admin" {
		var isAdmin bool
		if err := s.pool.QueryRow(ctx,
			`SELECT role='admin' AND active=true FROM users WHERE id=$1`, u.ID).Scan(&isAdmin); err != nil {
			return model.User{}, err
		}
		if isAdmin {
			var adminCount int
			if err := s.pool.QueryRow(ctx,
				`SELECT count(*) FROM users WHERE role='admin' AND active=true`).Scan(&adminCount); err != nil {
				return model.User{}, err
			}
			if adminCount <= 1 {
				return model.User{}, ErrLastAdmin
			}
		}
	}

	var pinHash string
	if newPin != "" {
		h, err := hashPin(newPin)
		if err != nil {
			return model.User{}, err
		}
		pinHash = h
	}

	if pinHash != "" {
		_, err := s.pool.Exec(ctx, `UPDATE users SET name=$2, role=$3, pin_hash=$4 WHERE id=$1`, u.ID, u.Name, u.Role, pinHash)
		if err != nil {
			return model.User{}, err
		}
	} else {
		_, err := s.pool.Exec(ctx, `UPDATE users SET name=$2, role=$3 WHERE id=$1`, u.ID, u.Name, u.Role)
		if err != nil {
			return model.User{}, err
		}
	}
	return scanUser(s.pool.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id=$1`, u.ID))
}

func (s *SQLStore) SetUserActive(id string, active bool) error {
	ctx := context.Background()
	if !active {
		var adminCount int
		if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE role='admin' AND active=true`).Scan(&adminCount); err != nil {
			return err
		}
		var isAdmin bool
		_ = s.pool.QueryRow(ctx, `SELECT role='admin' FROM users WHERE id=$1`, id).Scan(&isAdmin)
		if isAdmin && adminCount <= 1 {
			return ErrLastAdmin
		}
	}
	tag, err := s.pool.Exec(ctx, `UPDATE users SET active=$2 WHERE id=$1`, id, active)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (s *SQLStore) DeleteUser(id string) error {
	ctx := context.Background()
	var adminCount int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE role='admin' AND active=true`).Scan(&adminCount); err != nil {
		return err
	}
	var isAdmin bool
	_ = s.pool.QueryRow(ctx, `SELECT role='admin' FROM users WHERE id=$1`, id).Scan(&isAdmin)
	if isAdmin && adminCount <= 1 {
		return ErrLastAdmin
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (s *SQLStore) Authenticate(id, pin string) (model.User, error) {
	ctx := context.Background()
	u, err := scanUser(s.pool.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id=$1`, id))
	if err == pgx.ErrNoRows {
		return model.User{}, ErrUserNotFound
	}
	if err != nil {
		return model.User{}, err
	}
	if !u.Active {
		return model.User{}, ErrUserInactive
	}
	if !checkPin(u.PinHash, pin) {
		return model.User{}, ErrInvalidPin
	}
	return u, nil
}

// --- Pesanan ---

const orderCols = `id, number, order_type, table_no, subtotal, discount_type, discount_value, discount_amount, total, paid, change_amount, payment_method, status, cashier_id, cashier_name, voided_at, void_reason, voided_by, created_at`

func scanOrder(row pgx.Row) (model.Order, error) {
	var o model.Order
	err := row.Scan(&o.ID, &o.Number, &o.OrderType, &o.TableNo, &o.Subtotal, &o.DiscountType, &o.DiscountValue, &o.DiscountAmount,
		&o.Total, &o.Paid, &o.Change, &o.PaymentMethod, &o.Status, &o.CashierID, &o.CashierName,
		&o.VoidedAt, &o.VoidReason, &o.VoidedBy, &o.CreatedAt)
	return o, err
}

func (s *SQLStore) CreateOrder(req model.CreateOrderRequest, cashier model.User) (model.Order, error) {
	ctx := context.Background()

	if req.ClientOrderID != "" {
		var existingID string
		if err := s.pool.QueryRow(ctx, `SELECT id FROM orders WHERE id=$1`, req.ClientOrderID).Scan(&existingID); err == nil {
			o, err := scanOrder(s.pool.QueryRow(ctx, `SELECT `+orderCols+` FROM orders WHERE id=$1`, req.ClientOrderID))
			if err == nil {
				items, err := s.loadItems(ctx, []string{req.ClientOrderID})
				if err == nil {
					o.Items = items[req.ClientOrderID]
					return o, nil
				}
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

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return model.Order{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	ids := make([]string, len(req.Items))
	for i, it := range req.Items {
		ids[i] = it.ProductID
	}

	rows, err := tx.Query(ctx,
		`SELECT id, name, emoji, price, available, archived, stock FROM products WHERE id = ANY($1::text[]) FOR UPDATE`, ids)
	if err != nil {
		return model.Order{}, err
	}

	type productRow struct {
		id, name, emoji string
		price           int
		available       bool
		archived        bool
		stock           int
	}
	products := map[string]productRow{}
	for rows.Next() {
		var pr productRow
		if err := rows.Scan(&pr.id, &pr.name, &pr.emoji, &pr.price, &pr.available, &pr.archived, &pr.stock); err != nil {
			rows.Close()
			return model.Order{}, err
		}
		products[pr.id] = pr
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return model.Order{}, err
	}

	items := make([]model.OrderItem, 0, len(req.Items))
	subtotal := 0
	totalQty := 0
	for _, it := range req.Items {
		pr, ok := products[it.ProductID]
		if !ok || pr.archived {
			return model.Order{}, ErrProductNotFound
		}
		if !pr.available {
			return model.Order{}, ErrProductUnavailable
		}
		if it.Qty <= 0 {
			return model.Order{}, ErrInvalidQty
		}
		if pr.stock >= 0 && it.Qty > pr.stock {
			return model.Order{}, ErrProductUnavailable
		}
		items = append(items, model.OrderItem{
			ProductID: pr.id,
			Name:      pr.name,
			Emoji:     pr.emoji,
			Price:     pr.price,
			Qty:       it.Qty,
			Note:      it.Note,
		})
		subtotal += pr.price * it.Qty
		totalQty += it.Qty
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

	// stok kemasan untuk take away (per satuan item), atomic
	if req.OrderType == "take_away" {
		var stock int
		err := tx.QueryRow(ctx,
			`SELECT value::int FROM settings WHERE key='packaging_stock' FOR UPDATE`).Scan(&stock)
		if err == pgx.ErrNoRows {
			stock = 0
		} else if err != nil {
			return model.Order{}, err
		}
		if totalQty > stock {
			return model.Order{}, ErrOutOfPackaging
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO settings (key, value) VALUES ('packaging_stock', $1)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
			fmt.Sprintf("%d", stock-totalQty)); err != nil {
			return model.Order{}, err
		}
	}

	for _, it := range items {
		pr := products[it.ProductID]
		if pr.stock >= 0 {
			newStock := pr.stock - it.Qty
			available := newStock > 0
			if _, err := tx.Exec(ctx,
				`UPDATE products SET stock=$2, available=$3 WHERE id=$1`, it.ProductID, newStock, available); err != nil {
				return model.Order{}, err
			}
		}
	}

	var number string
	if err := tx.QueryRow(ctx,
		`SELECT 'KK-' || lpad(nextval('order_number_seq')::text, 4, '0')`).Scan(&number); err != nil {
		return model.Order{}, err
	}

	id := req.ClientOrderID
	if id == "" {
		id = fmt.Sprintf("ord-%d", time.Now().UnixNano())
	}
	now := time.Now()
	if req.CreatedAt != nil && !req.CreatedAt.IsZero() {
		now = *req.CreatedAt
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO orders (id, number, order_type, table_no, subtotal, discount_type, discount_value, discount_amount, total, paid, change_amount, payment_method, status, cashier_id, cashier_name, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'paid', $13, $14, $15)`,
		id, number, req.OrderType, req.TableNo, subtotal, req.DiscountType, req.DiscountValue, discount, total, paid, change, req.PaymentMethod, cashier.ID, cashier.Name, now); err != nil {
		return model.Order{}, err
	}

	for _, it := range items {
		if _, err := tx.Exec(ctx,
			`INSERT INTO order_items (order_id, product_id, name, emoji, price, qty, note)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			id, it.ProductID, it.Name, it.Emoji, it.Price, it.Qty, it.Note); err != nil {
			return model.Order{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return model.Order{}, err
	}

	return model.Order{
		ID:             id,
		Number:         number,
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
	}, nil
}

func (s *SQLStore) VoidOrder(id, reason, by string) (model.Order, error) {
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return model.Order{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var status string
	if err := tx.QueryRow(ctx, `SELECT status FROM orders WHERE id=$1 FOR UPDATE`, id).Scan(&status); err == pgx.ErrNoRows {
		return model.Order{}, ErrOrderNotFound
	} else if err != nil {
		return model.Order{}, err
	}
	if status != "paid" {
		return model.Order{}, ErrOrderNotPaid
	}

	// ambil jenis pesanan untuk kembalikan kemasan
	var orderType string
	_ = tx.QueryRow(ctx, `SELECT order_type FROM orders WHERE id=$1`, id).Scan(&orderType)

	// kembalikan stok
	itemRows, err := tx.Query(ctx, `SELECT product_id, qty FROM order_items WHERE order_id=$1`, id)
	if err != nil {
		return model.Order{}, err
	}
	type stockRestore struct {
		pid string
		qty int
	}
	var restores []stockRestore
	for itemRows.Next() {
		var sr stockRestore
		if err := itemRows.Scan(&sr.pid, &sr.qty); err != nil {
			itemRows.Close()
			return model.Order{}, err
		}
		restores = append(restores, sr)
	}
	itemRows.Close()

	for _, sr := range restores {
		if _, err := tx.Exec(ctx,
			`UPDATE products SET stock = stock + $2, available = CASE WHEN stock + $2 > 0 THEN true ELSE available END WHERE id=$1 AND stock >= 0`,
			sr.pid, sr.qty); err != nil {
			return model.Order{}, err
		}
	}

	// kembalikan stok kemasan untuk bungkus
	if orderType == "take_away" {
		totalQty := 0
		for _, sr := range restores {
			totalQty += sr.qty
		}
		if totalQty > 0 {
			if _, err := tx.Exec(ctx,
				`UPDATE settings SET value=(COALESCE((SELECT value::int FROM settings WHERE key='packaging_stock'),0) + $2)::text WHERE key='packaging_stock'`,
				totalQty); err != nil {
				return model.Order{}, err
			}
		}
	}

	now := time.Now()
	if _, err := tx.Exec(ctx,
		`UPDATE orders SET status='void', voided_at=$2, void_reason=$3, voided_by=$4 WHERE id=$1`,
		id, now, reason, by); err != nil {
		return model.Order{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return model.Order{}, err
	}

	o, err := scanOrder(s.pool.QueryRow(ctx, `SELECT `+orderCols+` FROM orders WHERE id=$1`, id))
	if err != nil {
		return model.Order{}, err
	}
	items, err := s.loadItems(ctx, []string{id})
	if err != nil {
		return model.Order{}, err
	}
	o.Items = items[id]
	return o, nil
}

func (s *SQLStore) Orders() ([]model.Order, error) {
	return s.ordersWhere(context.Background(), "", nil, 100)
}

func (s *SQLStore) OrdersRange(from, to time.Time) ([]model.Order, error) {
	return s.ordersWhere(context.Background(),
		"WHERE o.created_at >= $1 AND o.created_at < $2 ORDER BY o.created_at ASC",
		[]any{from, to}, 0)
}

func (s *SQLStore) ordersWhere(ctx context.Context, where string, args []any, limit int) ([]model.Order, error) {
	query := `SELECT ` + orderCols + ` FROM orders o ` + where
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}
	if where == "" {
		query = `SELECT ` + orderCols + ` FROM orders o ORDER BY o.created_at DESC LIMIT 100`
	}

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	orders := []model.Order{}
	ids := []string{}
	for rows.Next() {
		o, err := scanOrder(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		o.Items = []model.OrderItem{}
		orders = append(orders, o)
		ids = append(ids, o.ID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return orders, nil
	}

	byOrder, err := s.loadItems(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range orders {
		orders[i].Items = byOrder[orders[i].ID]
	}
	return orders, nil
}

func (s *SQLStore) loadItems(ctx context.Context, ids []string) (map[string][]model.OrderItem, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT order_id, product_id, name, emoji, price, qty, note
		 FROM order_items WHERE order_id = ANY($1::text[]) ORDER BY id`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byOrder := map[string][]model.OrderItem{}
	for rows.Next() {
		var orderID string
		var it model.OrderItem
		if err := rows.Scan(&orderID, &it.ProductID, &it.Name, &it.Emoji, &it.Price, &it.Qty, &it.Note); err != nil {
			return nil, err
		}
		byOrder[orderID] = append(byOrder[orderID], it)
	}
	return byOrder, rows.Err()
}

func (s *SQLStore) Report(from, to time.Time) (model.Report, error) {
	ctx := context.Background()
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

	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(total),0), COUNT(*), COALESCE(SUM(discount_amount),0)
		 FROM orders WHERE created_at >= $1 AND created_at < $2 AND status='paid'`, from, to).
		Scan(&r.TotalRevenue, &r.OrderCount, &r.TotalDiscount)
	if err != nil {
		return r, err
	}
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM orders WHERE created_at >= $1 AND created_at < $2 AND status='void'`, from, to).
		Scan(&r.VoidCount); err != nil {
		return r, err
	}
	if r.OrderCount > 0 {
		r.AvgOrder = r.TotalRevenue / r.OrderCount
	}

	if err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(oi.qty),0)
		 FROM order_items oi JOIN orders o ON o.id = oi.order_id
		 WHERE o.created_at >= $1 AND o.created_at < $2 AND o.status='paid'`, from, to).Scan(&r.ItemsSold); err != nil {
		return r, err
	}

	topRows, err := s.pool.Query(ctx,
		`SELECT oi.product_id, oi.name, oi.emoji, SUM(oi.qty)::int AS qty, SUM(oi.qty * oi.price)::int AS revenue
		 FROM order_items oi JOIN orders o ON o.id = oi.order_id
		 WHERE o.created_at >= $1 AND o.created_at < $2 AND o.status='paid'
		 GROUP BY oi.product_id, oi.name, oi.emoji
		 ORDER BY qty DESC, revenue DESC LIMIT 10`, from, to)
	if err != nil {
		return r, err
	}
	defer topRows.Close()
	for topRows.Next() {
		var tp model.TopProduct
		if err := topRows.Scan(&tp.ProductID, &tp.Name, &tp.Emoji, &tp.Qty, &tp.Revenue); err != nil {
			return r, err
		}
		r.TopProducts = append(r.TopProducts, tp)
	}
	if err := topRows.Err(); err != nil {
		return r, err
	}

	dayRows, err := s.pool.Query(ctx,
		`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS d,
		        SUM(total)::int AS revenue, COUNT(*)::int AS orders
		 FROM orders WHERE created_at >= $1 AND created_at < $2 AND status='paid'
		 GROUP BY d ORDER BY d`, from, to)
	if err != nil {
		return r, err
	}
	defer dayRows.Close()
	for dayRows.Next() {
		var d model.DailyRevenue
		if err := dayRows.Scan(&d.Date, &d.Revenue, &d.Orders); err != nil {
			return r, err
		}
		r.RevenueByDay = append(r.RevenueByDay, d)
	}
	if err := dayRows.Err(); err != nil {
		return r, err
	}

	cashierRows, err := s.pool.Query(ctx,
		`SELECT cashier_id, MAX(cashier_name), COUNT(*), SUM(total)::int
		 FROM orders WHERE created_at >= $1 AND created_at < $2 AND status='paid'
		 GROUP BY cashier_id ORDER BY 4 DESC`, from, to)
	if err != nil {
		return r, err
	}
	defer cashierRows.Close()
	for cashierRows.Next() {
		var c model.CashierRevenue
		if err := cashierRows.Scan(&c.CashierID, &c.CashierName, &c.Orders, &c.Revenue); err != nil {
			return r, err
		}
		r.ByCashier = append(r.ByCashier, c)
	}
	if err := cashierRows.Err(); err != nil {
		return r, err
	}

	catRows, err := s.pool.Query(ctx,
		`SELECT p.category, SUM(oi.qty)::int, SUM(oi.qty * oi.price)::int
		 FROM order_items oi
		 JOIN orders o ON o.id = oi.order_id
		 JOIN products p ON p.id = oi.product_id
		 WHERE o.created_at >= $1 AND o.created_at < $2 AND o.status='paid'
		 GROUP BY p.category ORDER BY 3 DESC`, from, to)
	if err != nil {
		return r, err
	}
	defer catRows.Close()
	for catRows.Next() {
		var c model.CategoryRevenue
		if err := catRows.Scan(&c.Category, &c.Qty, &c.Revenue); err != nil {
			return r, err
		}
		r.ByCategory = append(r.ByCategory, c)
	}
	if err := catRows.Err(); err != nil {
		return r, err
	}

	hourRows, err := s.pool.Query(ctx,
		`SELECT EXTRACT(hour FROM created_at)::int, COUNT(*), SUM(total)::int
		 FROM orders WHERE created_at >= $1 AND created_at < $2 AND status='paid'
		 GROUP BY 1 ORDER BY 1`, from, to)
	if err != nil {
		return r, err
	}
	defer hourRows.Close()
	hourMap := map[int]model.HourlyRevenue{}
	for hourRows.Next() {
		var h model.HourlyRevenue
		if err := hourRows.Scan(&h.Hour, &h.Orders, &h.Revenue); err != nil {
			return r, err
		}
		hourMap[h.Hour] = h
	}
	if err := hourRows.Err(); err != nil {
		return r, err
	}
	for h := 0; h < 24; h++ {
		if hr, ok := hourMap[h]; ok {
			r.ByHour = append(r.ByHour, hr)
		} else {
			r.ByHour = append(r.ByHour, model.HourlyRevenue{Hour: h})
		}
	}

	orderTypeRows, err := s.pool.Query(ctx,
		`SELECT order_type, COUNT(*), SUM(total)::int
		 FROM orders WHERE created_at >= $1 AND created_at < $2 AND status='paid'
		 GROUP BY order_type ORDER BY 3 DESC`, from, to)
	if err != nil {
		return r, err
	}
	defer orderTypeRows.Close()
	for orderTypeRows.Next() {
		var ot model.OrderTypeRevenue
		if err := orderTypeRows.Scan(&ot.OrderType, &ot.Orders, &ot.Revenue); err != nil {
			return r, err
		}
		r.ByOrderType = append(r.ByOrderType, ot)
	}
	if err := orderTypeRows.Err(); err != nil {
		return r, err
	}

	payRows, err := s.pool.Query(ctx,
		`SELECT payment_method, COUNT(*), SUM(total)::int
		 FROM orders WHERE created_at >= $1 AND created_at < $2 AND status='paid'
		 GROUP BY payment_method ORDER BY 3 DESC`, from, to)
	if err != nil {
		return r, err
	}
	defer payRows.Close()
	for payRows.Next() {
		var pm model.PaymentMethodRevenue
		if err := payRows.Scan(&pm.PaymentMethod, &pm.Orders, &pm.Revenue); err != nil {
			return r, err
		}
		r.ByPaymentMethod = append(r.ByPaymentMethod, pm)
	}
	if err := payRows.Err(); err != nil {
		return r, err
	}

	return r, nil
}

func (s *SQLStore) GetPackagingStock() (int, error) {
	ctx := context.Background()
	var stock int
	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE((SELECT value::int FROM settings WHERE key='packaging_stock'), 0)`).Scan(&stock)
	return stock, err
}

func (s *SQLStore) SetPackagingStock(n int) error {
	ctx := context.Background()
	if n < 0 {
		return ErrInvalidPackaging
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO settings (key, value) VALUES ('packaging_stock', $1)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
		fmt.Sprintf("%d", n))
	return err
}

func (s *SQLStore) Ping() error {
	ctx := context.Background()
	return s.pool.Ping(ctx)
}
