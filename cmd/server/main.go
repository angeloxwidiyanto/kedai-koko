package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"kedaikoko/internal/httpapi"
	"kedaikoko/internal/store"
)

func loadDotEnv() {
	b, err := os.ReadFile(".env")
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])
		val = strings.Trim(val, `"'`)
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, val)
		}
	}
}

func main() {
	loadDotEnv()

	driver, err := store.Init()
	if err != nil {
		log.Fatalf("gagal inisialisasi penyimpanan: %v", err)
	}
	log.Printf("Penyimpanan: %s", driver)

	// Keep-alive otomatis: ping database berkala agar Supabase free tier tidak tidur/pause
	go func() {
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if err := store.Default.Ping(); err != nil {
				log.Printf("[keep-alive] ping database: %v", err)
			} else {
				log.Println("[keep-alive] database ping ok (Supabase tetap aktif)")
			}
		}
	}()

	if os.Getenv("AUTH_SECRET") == "" {
		log.Println("PERINGATAN: AUTH_SECRET tidak diset — memakai secret default (hanya untuk dev).")
	}

	mux := http.NewServeMux()
	httpapi.Register(mux)

	if h, ok := webHandler(); ok {
		mux.Handle("/", h)
	} else {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"message":"API Kedai Koko aktif. Jalankan 'cd web && npm run build' untuk menyajikan aplikasi."}`))
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Kedai Koko berjalan di http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
