package store

import (
	"time"

	"kedaikoko/internal/model"
)

var defaultCategories = []model.Category{
	{ID: "rice", Name: "Rice", Icon: "rice_bowl", Emoji: "🍚"},
	{ID: "snacks", Name: "Snacks", Icon: "fastfood", Emoji: "🍟"},
	{ID: "bread-cake", Name: "Bread / Cake", Icon: "bakery_dining", Emoji: "🍰"},
	{ID: "tea", Name: "Tea Hot / Cold", Icon: "emoji_food_beverage", Emoji: "🍵"},
	{ID: "coffee", Name: "Coffee", Icon: "local_cafe", Emoji: "☕"},
	{ID: "sweet-cold", Name: "Sweet & Cold", Icon: "icecream", Emoji: "🍧"},
	{ID: "others", Name: "Others", Icon: "more_horiz", Emoji: "🍽️"},
}

func DefaultCategories() []model.Category {
	return append([]model.Category(nil), defaultCategories...)
}

func DefaultProducts() []model.Product {
	return append([]model.Product(nil), defaultProducts...)
}

var defaultProducts = func() []model.Product {
	ps := []model.Product{
		// RICE
		{ID: "rice-1", Name: "Nasi Uduk", Category: "rice", Price: 30000, Description: "Nasi gurih dengan lauk lengkap.", Emoji: "🍛", Color: "#ffc9a3", Tags: []string{"Halal", "Best Seller"}},
		{ID: "rice-2", Name: "Nasi Salmon Mentai", Category: "rice", Price: 55000, Description: "Nasi dengan salmon lembut dan saus mentai gurih.", Emoji: "🍣", Color: "#ffb6a1", Tags: []string{"Best Seller"}},
		{ID: "rice-3", Name: "Nasi Gyudon", Category: "rice", Price: 55000, Description: "Irisan daging sapi gurih ala Jepang di atas nasi hangat.", Emoji: "🥩", Color: "#e8c39e", Tags: []string{"Halal"}},
		{ID: "rice-4", Name: "Nasi Beef Mentai", Category: "rice", Price: 55000, Description: "Nasi dengan daging sapi pilihan dibalut saus mentai panggang.", Emoji: "🍱", Color: "#f4b09e", Tags: []string{"Halal"}},
		{ID: "rice-5", Name: "Nasi Ayam Teriyaki", Category: "rice", Price: 40000, Description: "Ayam panggang dengan saus teriyaki manis gurih.", Emoji: "🍗", Color: "#f4c07a", Tags: []string{"Halal"}},
		{ID: "rice-6", Name: "Nasi Ayam Woku", Category: "rice", Price: 40000, Description: "Ayam bumbu woku khas Manado yang harum dan pedas segar.", Emoji: "🍲", Color: "#f8af72", Tags: []string{"Halal", "Pedas"}},

		// SNACKS
		{ID: "snack-1", Name: "Bakso Goreng", Category: "snacks", Price: 25000, Description: "Bakso goreng renyah di luar, kenyal di dalam.", Emoji: "🧆", Color: "#f2c894", Tags: []string{"Populer"}},
		{ID: "snack-2", Name: "Otak Otak", Category: "snacks", Price: 20000, Description: "Otak-otak ikan gurih dengan bumbu istimewa.", Emoji: "🍢", Color: "#ffd7a0", Tags: []string{"Halal"}},
		{ID: "snack-3", Name: "Pentol", Category: "snacks", Price: 15000, Description: "Pentol daging kenyal dan gurih.", Emoji: "🍡", Color: "#e8c39e", Tags: []string{"Halal"}},
		{ID: "snack-4", Name: "Kentang Goreng", Category: "snacks", Price: 20000, Description: "Kentang goreng renyah dan gurih.", Emoji: "🍟", Color: "#ffe08a", Tags: []string{"Vegetarian", "Populer"}},
		{ID: "snack-5", Name: "Bihun Goreng", Category: "snacks", Price: 20000, Description: "Bihun goreng bumbu spesial gurih lezat.", Emoji: "🍜", Color: "#f5d0b0", Tags: []string{"Halal"}},
		{ID: "snack-6", Name: "Chick Nugget", Category: "snacks", Price: 25000, Description: "Nugget ayam goreng renyah keemasan.", Emoji: "🍗", Color: "#ffe3b3", Tags: []string{"Halal"}},
		{ID: "snack-7", Name: "Karaage", Category: "snacks", Price: 25000, Description: "Ayam goreng tepung khas Jepang juicy dan renyah.", Emoji: "🍖", Color: "#f4c07a", Tags: []string{"Halal", "Best Seller"}},

		// BREAD / CAKE
		{ID: "bread-1", Name: "Arem Arem", Category: "bread-cake", Price: 15000, Description: "Nasi gulung isi gurih dibungkus daun pisang.", Emoji: "🍙", Color: "#d4e8c1", Tags: []string{"Halal"}},
		{ID: "bread-2", Name: "Kue Sus", Category: "bread-cake", Price: 15000, Description: "Kue sus lembut dengan isian vla manis creamy.", Emoji: "🧁", Color: "#ffe59e", Tags: []string{"Manis"}},

		// TEA HOT / COLD
		{ID: "tea-1", Name: "Lemon Tea", Category: "tea", Price: 20000, Description: "Teh segar dengan perasan lemon (tersedia panas/dingin).", Emoji: "🍋", Color: "#ffe08a", Tags: []string{"Segar"}},
		{ID: "tea-2", Name: "Black Tea", Category: "tea", Price: 15000, Description: "Teh hitam aroma khas (tersedia panas/dingin).", Emoji: "🍵", Color: "#d9c4a9", Tags: []string{"Klasik"}},
		{ID: "tea-3", Name: "Jasmine Tea", Category: "tea", Price: 15000, Description: "Teh melati wangi dan menenangkan (tersedia panas/dingin).", Emoji: "🫖", Color: "#cfe3d8", Tags: []string{"Wangi"}},

		// COFFEE
		{ID: "coffee-1", Name: "Americano", Category: "coffee", Price: 25000, Description: "Kopi espresso dengan air panas atau es segar.", Emoji: "☕", Color: "#d9c4a9", Tags: []string{"Kopi"}},
		{ID: "coffee-2", Name: "Latte", Category: "coffee", Price: 35000, Description: "Espresso berpadu dengan susu steamed lembut.", Emoji: "🥛", Color: "#f3e3d3", Tags: []string{"Kopi", "Populer"}},

		// SWEET & COLD
		{ID: "sweet-1", Name: "Cendol", Category: "sweet-cold", Price: 20000, Description: "Es cendol gula aren dengan santan gurih segar.", Emoji: "🍧", Color: "#cfe6c0", Tags: []string{"Dingin", "Manis"}},
		{ID: "sweet-2", Name: "Pudot", Category: "sweet-cold", Price: 25000, Description: "Puding sedot lembut manis menyegarkan.", Emoji: "🍮", Color: "#fcd9e0", Tags: []string{"Dingin", "Manis"}},

		// OTHERS
		{ID: "others-1", Name: "Emping Original", Category: "others", Price: 30000, Description: "Emping melinjo renyah gurih original.", Emoji: "🍘", Color: "#ffe6c0", Tags: []string{"Camilan"}},
		{ID: "others-2", Name: "Emping Manis Asin", Category: "others", Price: 35000, Description: "Emping melinjo renyah dengan balutan manis asin.", Emoji: "🍘", Color: "#fcd6b5", Tags: []string{"Camilan", "Manis"}},
		{ID: "others-3", Name: "Emping Pedas", Category: "others", Price: 35000, Description: "Emping melinjo bumbu pedas manis gurih.", Emoji: "🌶️", Color: "#f8af72", Tags: []string{"Camilan", "Pedas"}},
		{ID: "others-4", Name: "Air Mineral", Category: "others", Price: 15000, Description: "Air mineral kemasan segar dan dingin.", Emoji: "💧", Color: "#cfe0ee", Tags: []string{"Dingin"}},
	}
	for i := range ps {
		ps[i].Available = true
		ps[i].Stock = -1
	}
	return ps
}()

func sampleOrders(now time.Time) []model.Order {
	return nil
}
