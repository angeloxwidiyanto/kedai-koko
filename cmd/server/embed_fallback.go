//go:build !embed

package main

import "net/http"

func webHandler() (http.Handler, bool) {
	return nil, false
}
