package main

// EmbeddedAppKey is compiled into the binary via -ldflags.
// Example:
//   wails build -ldflags "-X main.EmbeddedAppKey=YOUR_KEY"
var EmbeddedAppKey string
