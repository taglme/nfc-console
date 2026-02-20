package main

import (
	"context"
	"fmt"
	"os"
	"strings"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetEmbeddedAppKey returns the build-time embedded X-App-Key.
func (a *App) GetEmbeddedAppKey() string {
	// Allow env override (useful for `wails dev`).
	if v := strings.TrimSpace(os.Getenv("NFC_CONSOLE_X_APP_KEY")); v != "" {
		return v
	}
	if v := strings.TrimSpace(os.Getenv("X_APP_KEY")); v != "" {
		return v
	}
	return strings.TrimSpace(EmbeddedAppKey)
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
