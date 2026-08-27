package store

import (
	"time"

	"kedaikoko/internal/model"
)

var defaultCategories = []model.Category{
	{ID: "rice", Name: "Nasi", Icon: "rice_bowl", Emoji: "🍚"},
	{ID: "snacks", Name: "Camilan", Icon: "fastfood", Emoji: "🍟"},
	{ID: "bread", Name: "Roti & Kue", Icon: "bakery_dining", Emoji: "🍰"},
	{ID: "drinks", Name: "Minuman", Icon: "local_drink", Emoji: "🥤"},
	{ID: "others", Name: "Lainnya", Icon: "more_horiz", Emoji: "🍽️"},
}

var defaultProducts = func() []model.Product {
	ps := []model.Product{
		{ID: "rice-1", Name: "Nasi Uduk", Category: "rice", Price: 30000, Description: "Nasi gurih dengan lauk lengkap.", Emoji: "🍛", Color: "#ffc9a3", Tags: []string{"Halal", "Best Seller"}},
		{ID: "rice-2", Name: "Nasi Salmon Mentai", Category: "rice", Price: 55000, Description: "Nasi dengan salmon dan saus mentai.", Emoji: "🍣", Color: "#ffb6a1", Tags: []string{"Best Seller"}},
		{ID: "rice-3", Name: "Nasi Gyudon", Category: "rice", Price: 55000, Description: "Beef bowl ala Jepang yang lezat.", Emoji: "🥩", Color: "#e8c39e", Tags: []string{"Halal"}},
		{ID: "rice-4", Name: "Nasi Ayam Teriyaki", Category: "rice", Price: 40000, Description: "Ayam panggang saus teriyaki manis.", Emoji: "🍗", Color: "#f4c07a", Tags: []string{"Halal", "Manis"}},
		{ID: "rice-5", Name: "Nasi Goreng Spesial", Category: "rice", Price: 35000, Description: "Nasi goreng dengan telur dan ayam.", Emoji: "🍳", Color: "#ffd7a0", Tags: []string{"Populer"}},

		{ID: "snacks-1", Name: "Kentang Goreng", Category: "snacks", Price: 20000, Description: "Kentang goreng renyah dan gurih.", Emoji: "🍟", Color: "#ffe08a", Tags: []string{"Vegetarian", "Populer"}},
		{ID: "snacks-2", Name: "Pisang Goreng", Category: "snacks", Price: 15000, Description: "Pisang goreng manis hangat.", Emoji: "🍌", Color: "#ffe59e", Tags: []string{"Vegetarian", "Manis"}},
		{ID: "snacks-3", Name: "Lumpia", Category: "snacks", Price: 15000, Description: "Lumpia goreng isi sayur.", Emoji: "🌯", Color: "#f2c894", Tags: []string{"Halal"}},
		{ID: "snacks-4", Name: "Siomay", Category: "snacks", Price: 18000, Description: "Siomay dengan saus kacang.", Emoji: "🥟", Color: "#f5d0b0", Tags: []string{"Halal"}},
		{ID: "snacks-5", Name: "Tahu Crispy", Category: "snacks", Price: 12000, Description: "Tahu goreng renyah.", Emoji: "🧆", Color: "#ffe3b3", Tags: []string{"Vegetarian"}},

		{ID: "bread-1", Name: "Roti Bakar", Category: "bread", Price: 18000, Description: "Roti bakar isi cokelat dan keju.", Emoji: "🍞", Color: "#e7c7a0", Tags: []string{"Manis"}},
		{ID: "bread-2", Name: "Brownies", Category: "bread", Price: 22000, Description: "Brownies cokelat lembut.", Emoji: "🍫", Color: "#c89a7a", Tags: []string{"Manis"}},
		{ID: "bread-3", Name: "Donat", Category: "bread", Price: 12000, Description: "Donat manis dengan gula.", Emoji: "🍩", Color: "#f3b6a0", Tags: []string{"Manis", "Vegetarian"}},
		{ID: "bread-4", Name: "Kue Cubit", Category: "bread", Price: 10000, Description: "Kue cubit mini manis.", Emoji: "🧁", Color: "#f7c6c6", Tags: []string{"Manis"}},

		{ID: "drinks-1", Name: "Es Teh Manis", Category: "drinks", Price: 8000, Description: "Teh manis dingin segar.", Emoji: "🥤", Color: "#cfe3d8", Tags: []string{"Dingin"}},
		{ID: "drinks-2", Name: "Es Jeruk", Category: "drinks", Price: 10000, Description: "Jeruk peras dingin.", Emoji: "🍊", Color: "#ffd1a8", Tags: []string{"Dingin"}},
		{ID: "drinks-3", Name: "Kopi Susu", Category: "drinks", Price: 18000, Description: "Kopi susu gula aren.", Emoji: "☕", Color: "#d9c4a9", Tags: []string{"Dingin"}},
		{ID: "drinks-4", Name: "Jus Alpukat", Category: "drinks", Price: 20000, Description: "Jus alpukat cokelat kental.", Emoji: "🥑", Color: "#cfe6c0", Tags: []string{"Dingin", "Sehat"}},
		{ID: "drinks-5", Name: "Air Mineral", Category: "drinks", Price: 5000, Description: "Air putih kemasan.", Emoji: "💧", Color: "#cfe0ee", Tags: []string{"Dingin"}},

		{ID: "others-1", Name: "Telur Dadar", Category: "others", Price: 8000, Description: "Telur dadar hangat.", Emoji: "🥚", Color: "#ffe08a", Tags: []string{"Vegetarian"}},
		{ID: "others-2", Name: "Es Krim", Category: "others", Price: 15000, Description: "Es krim vanila manis.", Emoji: "🍦", Color: "#fcd9e0", Tags: []string{"Dingin", "Manis"}},
		{ID: "others-3", Name: "Kerupuk", Category: "others", Price: 5000, Description: "Kerupuk gurih renyah.", Emoji: "🍘", Color: "#ffe6c0", Tags: []string{"Vegetarian"}},
	}
	for i := range ps {
		ps[i].Available = true
		ps[i].Stock = -1
	}
	return ps
}()

func sampleOrders(now time.Time) []model.Order {
	return []model.Order{
		{
			ID:        "seed-1",
			Number:    "KK-0001",
			OrderType: "dine_in",
			TableNo:   "3",
			Items: []model.OrderItem{
				{ProductID: "rice-1", Name: "Nasi Uduk", Emoji: "🍛", Price: 30000, Qty: 2},
				{ProductID: "drinks-1", Name: "Es Teh Manis", Emoji: "🥤", Price: 8000, Qty: 2},
			},
			Subtotal:      76000,
			Total:         76000,
			Paid:          100000,
			Change:        24000,
			PaymentMethod: "tunai",
			Status:        "paid",
			CashierID:     "usr-admin",
			CashierName:   "Admin",
			CreatedAt:     now.Add(-2 * time.Hour),
		},
		{
			ID:        "seed-2",
			Number:    "KK-0002",
			OrderType: "take_away",
			Items: []model.OrderItem{
				{ProductID: "rice-3", Name: "Nasi Gyudon", Emoji: "🥩", Price: 55000, Qty: 1},
				{ProductID: "snacks-1", Name: "Kentang Goreng", Emoji: "🍟", Price: 20000, Qty: 1},
			},
			Subtotal:      75000,
			Total:         75000,
			Paid:          75000,
			Change:        0,
			PaymentMethod: "qris",
			Status:        "paid",
			CashierID:     "usr-admin",
			CashierName:   "Admin",
			CreatedAt:     now.Add(-45 * time.Minute),
		},
	}
}
