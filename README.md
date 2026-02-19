# Taglme NFC Console

Cross-platform desktop app (Wails) for working with the Taglme NFC Desktop API.

## Tech

- Wails (Go)
- Vue 3 + Vite + TypeScript
- Naive UI
- Pinia
- All server interaction goes through the JS SDK: `nfc-jsclient`

## Development

Prereqs:
- Go (see `go.mod`)
- Node.js 20+
- Wails CLI v2

Run dev mode:

```bash
wails dev
```

The app stores API base URL in localStorage. Default is `http://127.0.0.1:3011`.

## Build

Build (no packaging):

```bash
wails build -nopackage
```

### Embedding `X-App-Key`

This app sends `X-App-Key` using the JS SDK. The key is embedded into the Go binary at build time via `-ldflags`:

```bash
wails build -nopackage -ldflags "-X main.EmbeddedAppKey=YOUR_APP_KEY"
```

At runtime, the frontend reads it via a Wails binding (`GetEmbeddedAppKey`).

## License & Capabilities

The app will use `/licenses/access` and enforce host constraints (block/clamp + show messages) as described in the project plan.

## Contributing

See CONTRIBUTING.md.
