package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"kedaikoko/internal/model"
	"kedaikoko/internal/store"
)

const tokenTTL = 24 * time.Hour

func authSecret() string {
	s := os.Getenv("AUTH_SECRET")
	if s == "" {
		s = "dev-secret-ganti-di-produksi"
	}
	return s
}

type tokenPayload struct {
	UID  string `json:"uid"`
	Role string `json:"role"`
	Exp  int64  `json:"exp"`
}

func SignToken(uid, role string) string {
	payload := tokenPayload{UID: uid, Role: role, Exp: time.Now().Add(tokenTTL).Unix()}
	data, _ := json.Marshal(payload)
	enc := base64.RawURLEncoding.EncodeToString(data)
	sig := sign(enc)
	return enc + "." + sig
}

func sign(data string) string {
	mac := hmac.New(sha256.New, []byte(authSecret()))
	mac.Write([]byte(data))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func VerifyToken(token string) (tokenPayload, bool) {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return tokenPayload{}, false
	}
	if !hmac.Equal([]byte(parts[1]), []byte(sign(parts[0]))) {
		return tokenPayload{}, false
	}
	data, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return tokenPayload{}, false
	}
	var p tokenPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return tokenPayload{}, false
	}
	if time.Now().Unix() > p.Exp {
		return tokenPayload{}, false
	}
	return p, true
}

func bearerToken(r *http.Request) string {
	if h := r.Header.Get("Authorization"); h != "" {
		if strings.HasPrefix(h, "Bearer ") {
			return strings.TrimPrefix(h, "Bearer ")
		}
		return h
	}
	return r.Header.Get("X-Admin-Token")
}

// currentUser mengembalikan user dari token pada request, atau (model.User{}, false)
// bila tidak ada token valid / user nonaktif.
func currentUser(r *http.Request) (model.User, bool) {
	tok := bearerToken(r)
	if tok == "" {
		return model.User{}, false
	}
	payload, ok := VerifyToken(tok)
	if !ok {
		return model.User{}, false
	}
	u, err := store.Default.GetUser(payload.UID)
	if err != nil {
		return model.User{}, false
	}
	if !u.Active {
		return model.User{}, false
	}
	return u, true
}

func authorized(r *http.Request) bool {
	_, ok := currentUser(r)
	return ok
}

func authorizedAdmin(r *http.Request) bool {
	u, ok := currentUser(r)
	return ok && u.Role == "admin"
}
