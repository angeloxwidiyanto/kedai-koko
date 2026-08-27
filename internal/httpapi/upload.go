package httpapi

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const maxUploadSize = 5 << 20 // 5 MB

var allowedImageExt = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".webp": true,
}

// HandleUploadImage menerima file gambar dari admin, mengunggah ke Supabase
// Storage bucket "products", dan mengembalikan URL publik.
func HandleUploadImage(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}

	supabaseURL := strings.TrimRight(os.Getenv("SUPABASE_URL"), "/")
	supabaseKey := os.Getenv("SUPABASE_SECRET_KEY")
	if supabaseURL == "" || supabaseKey == "" {
		writeError(w, http.StatusInternalServerError, "storage belum dikonfigurasi")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "gagal membaca file")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file tidak ditemukan")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedImageExt[ext] {
		writeError(w, http.StatusBadRequest, "format gambar harus jpg/png/webp")
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusBadRequest, "gagal membaca file")
		return
	}
	if len(data) == 0 {
		writeError(w, http.StatusBadRequest, "file kosong")
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// nama unik: img-<timestamp>-<random><ext>
	randBytes := make([]byte, 6)
	_, _ = rand.Read(randBytes)
	name := fmt.Sprintf("img-%d-%s%s", time.Now().UnixNano(), hex.EncodeToString(randBytes), ext)
	objectPath := "products/" + name

	uploadURL := supabaseURL + "/storage/v1/object/" + objectPath
	req, err := http.NewRequest(http.MethodPost, uploadURL, bytes.NewReader(data))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal menyiapkan upload")
		return
	}
	req.Header.Set("apikey", supabaseKey)
	req.Header.Set("Authorization", "Bearer "+supabaseKey)
	req.Header.Set("Content-Type", contentType)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "gagal mengunggah ke storage")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		writeError(w, http.StatusBadGateway, "storage menolak upload")
		return
	}

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s", supabaseURL, objectPath)
	writeJSON(w, http.StatusOK, map[string]string{"url": publicURL})
}
