package httpapi

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"kedaikoko/internal/model"
	"kedaikoko/internal/store"
)

const dateLayout = "2006-01-02"

func parseRange(r *http.Request) (time.Time, time.Time) {
	now := time.Now()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endOfToday := startOfToday.AddDate(0, 0, 1)
	from := startOfToday.AddDate(0, 0, -30)
	to := endOfToday

	if f := r.URL.Query().Get("from"); f != "" {
		if t, err := time.ParseInLocation(dateLayout, f, time.Local); err == nil {
			from = t
		}
	}
	if t := r.URL.Query().Get("to"); t != "" {
		if tt, err := time.ParseInLocation(dateLayout, t, time.Local); err == nil {
			to = tt.AddDate(0, 0, 1)
		}
	}
	return from, to
}

func HandleReport(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	from, to := parseRange(r)
	report, err := store.Default.Report(from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal membuat laporan")
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func HandleReportCSV(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	from, to := parseRange(r)
	orders, err := store.Default.OrdersRange(from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil data pesanan")
		return
	}

	var buf strings.Builder
	buf.WriteString("\xEF\xBB\xBF") // BOM UTF-8 agar terbaca rapi di Excel
	cw := csv.NewWriter(&buf)

	_ = cw.Write([]string{"Waktu", "No Pesanan", "Kasir", "Status", "Detail Item", "Subtotal", "Diskon", "Total", "Dibayar", "Kembalian"})
	for _, o := range orders {
		parts := make([]string, 0, len(o.Items))
		for _, it := range o.Items {
			s := fmt.Sprintf("%dx %s", it.Qty, it.Name)
			if it.Note != "" {
				s += " (" + it.Note + ")"
			}
			parts = append(parts, s)
		}
		status := "Lunas"
		if o.Status == "void" {
			status = "Batal"
		}
		_ = cw.Write([]string{
			o.CreatedAt.Format("2006-01-02 15:04"),
			o.Number,
			o.CashierName,
			status,
			strings.Join(parts, "; "),
			strconv.Itoa(o.Subtotal),
			strconv.Itoa(o.DiscountAmount),
			strconv.Itoa(o.Total),
			strconv.Itoa(o.Paid),
			strconv.Itoa(o.Change),
		})
	}
	cw.Flush()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf(`attachment; filename="laporan-%s-%s.csv"`,
			from.Format(dateLayout), to.AddDate(0, 0, -1).Format(dateLayout)))
	_, _ = w.Write([]byte(buf.String()))
}

func decodeBody(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "data tidak valid")
		return false
	}
	return true
}

func HandleCreateProduct(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	var p model.Product
	if !decodeBody(w, r, &p) {
		return
	}
	created, err := store.Default.CreateProduct(p)
	if err != nil {
		if errors.Is(err, store.ErrProductExists) {
			writeError(w, http.StatusConflict, err.Error())
		} else {
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func HandleUpdateProduct(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	var p model.Product
	if !decodeBody(w, r, &p) {
		return
	}
	p.ID = r.PathValue("id")
	updated, err := store.Default.UpdateProduct(p)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func HandleSetAvailability(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	var body struct {
		Available bool `json:"available"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	p, err := store.Default.SetProductAvailability(r.PathValue("id"), body.Available)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func HandleSetStock(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	var body struct {
		Stock int `json:"stock"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	p, err := store.Default.SetProductStock(r.PathValue("id"), body.Stock)
	if err != nil {
		if errors.Is(err, store.ErrInvalidStock) {
			writeError(w, http.StatusBadRequest, err.Error())
		} else {
			writeError(w, http.StatusNotFound, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func HandleArchiveProduct(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	if err := store.Default.ArchiveProduct(r.PathValue("id")); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "diarsipkan"})
}

func HandleRestoreProduct(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	if err := store.Default.RestoreProduct(r.PathValue("id")); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "dipulihkan"})
}

func HandleCreateCategory(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	var c model.Category
	if !decodeBody(w, r, &c) {
		return
	}
	created, err := store.Default.CreateCategory(c)
	if err != nil {
		if errors.Is(err, store.ErrProductExists) {
			writeError(w, http.StatusConflict, err.Error())
		} else {
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func HandleUpdateCategory(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	var c model.Category
	if !decodeBody(w, r, &c) {
		return
	}
	c.ID = r.PathValue("id")
	updated, err := store.Default.UpdateCategory(c)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func HandleDeleteCategory(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	if err := store.Default.DeleteCategory(r.PathValue("id")); err != nil {
		if errors.Is(err, store.ErrCategoryInUse) {
			writeError(w, http.StatusConflict, err.Error())
		} else {
			writeError(w, http.StatusNotFound, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "dihapus"})
}

func HandleGetPackaging(w http.ResponseWriter, r *http.Request) {
	if !authorized(r) {
		writeError(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	stock, err := store.Default.GetPackagingStock()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gagal mengambil stok kemasan")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"stock": stock})
}

func HandleSetPackaging(w http.ResponseWriter, r *http.Request) {
	if !authorizedAdmin(r) {
		writeError(w, http.StatusUnauthorized, "khusus admin")
		return
	}
	var body struct {
		Stock int `json:"stock"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	if err := store.Default.SetPackagingStock(body.Stock); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	stock, _ := store.Default.GetPackagingStock()
	writeJSON(w, http.StatusOK, map[string]int{"stock": stock})
}
