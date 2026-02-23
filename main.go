package main

import (
	"embed"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// In `wails dev`, environment variables from `.env` are not loaded automatically.
	// Load them best-effort so we can provide X-App-Key without ldflags.
	_ = godotenv.Load()

	// Allow setting X-App-Key via env in dev mode.
	// Priority: NFC_CONSOLE_X_APP_KEY > X_APP_KEY > EmbeddedAppKey (ldflags)
	if strings.TrimSpace(EmbeddedAppKey) == "" {
		if v := strings.TrimSpace(os.Getenv("NFC_CONSOLE_X_APP_KEY")); v != "" {
			EmbeddedAppKey = v
		} else if v := strings.TrimSpace(os.Getenv("X_APP_KEY")); v != "" {
			EmbeddedAppKey = v
		}
	}

	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "taglme console",
		Width:     1024,
		Height:    768,
		MinWidth:  800,
		MinHeight: 600,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
