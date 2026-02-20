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

### Dev `X-App-Key` via `.env`

In `wails dev`, you can provide `X-App-Key` without `-ldflags` by creating a `.env` file in the repo root:

```env
NFC_CONSOLE_X_APP_KEY=YOUR_APP_KEY
# or:
# X_APP_KEY=YOUR_APP_KEY
```

Priority: `NFC_CONSOLE_X_APP_KEY` > `X_APP_KEY` > embedded build-time key.

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

## Releases

GitHub Releases are built automatically on tags matching `v*` via the workflow `.github/workflows/release.yml`.

Requirements:
- GitHub Actions secret `EMBEDDED_APP_KEY` (can be empty, but API calls may be rejected by your server).

Create a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## License & Capabilities

The app will use `/licenses/access` and enforce host constraints (block/clamp + show messages) as described in the project plan.

## Contributing

See CONTRIBUTING.md.
